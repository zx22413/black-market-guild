import { DurableObject } from 'cloudflare:workers';
import { CONNECT_RULE, CREATE_RULE, MAX_ROOM_SOCKETS, MESSAGE_RULE, hit, originAllowed, type WindowRule } from './limits';

// Shared Worker and Durable Object code for online rooms. Each rules version supplies its room
// module (src/online for V0.6, src/v07/online for V0.7); the HTTP and WebSocket plumbing,
// room codes and the abuse limits (limits.ts) are the same for both. Anyone may open a room
// (open-questions Q-09); Turnstile and per-IP limits keep scripts from flooding it.

export interface Env {
  readonly ROOMS: DurableObjectNamespace<RoomObjectBase>;
  readonly LIMITS: DurableObjectNamespace<LimiterObject>;
  /**
   * Turnstile secret (`wrangler secret put TURNSTILE_SECRET`); room creation checks the bot
   * challenge only when it is set. Local development uses Cloudflare's always-pass test secret.
   */
  readonly TURNSTILE_SECRET?: string;
}

/** A parsed client message; every protocol version starts with `hello`. */
interface ClientMessageLike {
  readonly type: string;
}

interface ServerRoom<M extends ClientMessageLike> {
  receive(token: string, message: M, seed: number): void;
  presenceChanged(): void;
}

/** What one protocol version must provide to the server. */
export interface OnlineModule<M extends ClientMessageLike = ClientMessageLike> {
  readonly MAX_MESSAGE_BYTES: number;
  readonly ROOM_CODE_ALPHABET: string;
  readonly ROOM_CODE_LENGTH: number;
  isRoomCode(code: unknown): code is string;
  isValidToken(token: unknown): token is string;
  parseClientMessage(raw: string): M | null;
  /** When the room is deleted, from when it opened and when it went quiet (docs/game-design.md §15.3). */
  checkExpiry(
    room: { readonly createdAt: number; readonly idleSince: number | null },
    now: number,
  ): { readonly kind: 'expire' } | { readonly kind: 'check-at'; readonly at: number };
  createRoom(options: {
    readonly hostToken: string;
    readonly send: (token: string, message: unknown) => void;
    readonly isOnline: (token: string) => boolean;
    readonly clock: { now(): number; after(ms: number, run: () => void): () => void };
  }): ServerRoom<M>;
}

/** Errors the server itself sends; same shape in every protocol version. */
const serverError = (code: 'bad-message' | 'no-room' | 'busy', message: string) => JSON.stringify({ type: 'error', code, message });

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
}

const clientIp = (request: Request): string => request.headers.get('CF-Connecting-IP') ?? 'local';

/** One more hit for `key` under `rule`, counted by a Durable Object of its own (exact, unlike edge rate limits). */
function allowed(env: Env, key: string, rule: WindowRule): Promise<boolean> {
  return env.LIMITS.get(env.LIMITS.idFromName(key)).hit(rule);
}

/** Asks Cloudflare whether the Turnstile token is real; true when no secret is configured. */
async function passedTurnstile(env: Env, token: unknown, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip !== 'local') form.append('remoteip', ip);
  try {
    const reply = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const outcome = (await reply.json()) as { success?: boolean };
    return outcome.success === true;
  } catch (error) {
    console.error('turnstile verification failed', error);
    return false;
  }
}

async function createRoom(online: OnlineModule, request: Request, env: Env): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const { hostToken, turnstile } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (!online.isValidToken(hostToken)) {
    return json({ error: 'bad host token' }, 400);
  }
  const ip = clientIp(request);
  if (!(await allowed(env, `create:${ip}`, CREATE_RULE))) {
    return json({ error: '建立房間太頻繁，請過幾分鐘再試' }, 429);
  }
  if (!(await passedTurnstile(env, turnstile, ip))) {
    return json({ error: '驗證沒有通過，請重新整理頁面再試' }, 403);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(online.ROOM_CODE_LENGTH));
    const code = [...bytes].map((b) => online.ROOM_CODE_ALPHABET[b % online.ROOM_CODE_ALPHABET.length]).join('');
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    if (await stub.claim(hostToken)) {
      return json({ room: code });
    }
  }
  return json({ error: '無法建立房間，請再試一次' }, 503);
}

/** The Worker entry: room creation and WebSocket upgrades under /api; everything else is static assets. */
export function createWorker(online: OnlineModule): ExportedHandler<Env> {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname === '/api/rooms' && request.method === 'POST') {
        return createRoom(online, request, env);
      }
      const match = /^\/api\/rooms\/([^/]+)\/ws$/.exec(url.pathname);
      if (match && online.isRoomCode(match[1])) {
        if (request.headers.get('Upgrade') !== 'websocket') {
          return new Response('expected websocket', { status: 426 });
        }
        if (!originAllowed(request.headers.get('Origin'), request.url)) {
          return new Response('forbidden', { status: 403 });
        }
        if (!(await allowed(env, `connect:${clientIp(request)}`, CONNECT_RULE))) {
          return new Response('too many connections', { status: 429 });
        }
        return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
      }
      return json({ error: 'not found' }, 404);
    },
  };
}

/**
 * One room per Durable Object; subclasses pick the protocol version. Sockets use the plain
 * accept() API rather than hibernation, so the object (and the match running in memory) stays
 * alive while anyone is connected. An alarm deletes the room once it has been quiet for long
 * enough or is too old (OnlineModule.checkExpiry); storage keeps `createdAt` and `idleSince`.
 * TODO: the match is not persisted; a redeploy or an eviction ends running matches.
 */
export abstract class RoomObjectBase extends DurableObject<Env> {
  protected abstract readonly online: OnlineModule;
  private room: ServerRoom<ClientMessageLike> | null = null;
  private readonly sockets = new Map<WebSocket, string | null>();

  /** Reserves this room for a host; false if the code is already taken. */
  async claim(hostToken: string): Promise<boolean> {
    if (await this.ctx.storage.get<string>('host')) return false;
    const now = Date.now();
    await this.ctx.storage.put({ host: hostToken, createdAt: now, idleSince: now });
    await this.scheduleExpiry();
    return true;
  }

  /** Sets the alarm for the room's next expiry check, or deletes it right away. */
  private async scheduleExpiry(): Promise<void> {
    const now = Date.now();
    let createdAt = await this.ctx.storage.get<number>('createdAt');
    if (createdAt === undefined) {
      // A room opened before rooms expired: its age counts from now.
      createdAt = now;
      await this.ctx.storage.put('createdAt', createdAt);
    }
    const stored = (await this.ctx.storage.get<number>('idleSince')) ?? null;
    const idleSince = this.sockets.size > 0 ? null : (stored ?? now);
    const check = this.online.checkExpiry({ createdAt, idleSince }, now);
    if (check.kind === 'expire') await this.expire();
    else await this.ctx.storage.setAlarm(check.at);
  }

  override async alarm(): Promise<void> {
    if (!(await this.ctx.storage.get<string>('host'))) return;
    await this.scheduleExpiry();
  }

  /** Deletes the room: everyone is told it is gone and the code is free again. */
  private async expire(): Promise<void> {
    const gone = serverError('no-room', '房間已過期或不存在');
    this.sockets.forEach((_, socket) => {
      socket.send(gone);
      socket.close(4410, 'room expired');
    });
    this.sockets.clear();
    this.room = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  private async loadRoom(): Promise<ServerRoom<ClientMessageLike> | null> {
    if (this.room) return this.room;
    const hostToken = await this.ctx.storage.get<string>('host');
    if (!hostToken) return null;
    this.room = this.online.createRoom({
      hostToken,
      send: (token, message) => this.send(token, message),
      isOnline: (token) => [...this.sockets.values()].includes(token),
      clock: {
        now: () => Date.now(),
        after: (ms, run) => {
          const timer = setTimeout(run, ms);
          return () => clearTimeout(timer);
        },
      },
    });
    return this.room;
  }

  private send(token: string, message: unknown): void {
    const data = JSON.stringify(message);
    this.sockets.forEach((owner, socket) => {
      if (owner === token) socket.send(data);
    });
  }

  override async fetch(): Promise<Response> {
    const room = await this.loadRoom();
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    if (!room) {
      server.send(serverError('no-room', '房間已過期或不存在'));
      server.close(4404, 'no room');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (this.sockets.size >= MAX_ROOM_SOCKETS) {
      server.send(serverError('busy', '這個房間的連線太多，請稍後再試'));
      server.close(4429, 'room busy');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.sockets.set(server, null);
    let sent: readonly number[] = [];
    await this.ctx.storage.delete('idleSince');
    await this.scheduleExpiry();
    server.addEventListener('message', (event) => {
      const rate = hit(sent, Date.now(), MESSAGE_RULE);
      sent = rate.times;
      if (!rate.allowed) {
        server.close(4408, 'too many messages');
        return;
      }
      const raw = typeof event.data === 'string' ? event.data : '';
      const message = raw.length <= this.online.MAX_MESSAGE_BYTES ? this.online.parseClientMessage(raw) : null;
      const owner = this.sockets.get(server) ?? null;
      const helloToken = message?.type === 'hello' && 'token' in message && typeof message.token === 'string' ? message.token : null;
      if (!message || (owner === null && helloToken === null)) {
        server.send(serverError('bad-message', '無法辨識的訊息'));
        return;
      }
      if (helloToken !== null) {
        this.sockets.set(server, helloToken);
        room.presenceChanged();
      }
      room.receive(helloToken ?? owner!, message, randomSeed());
    });
    const drop = () => {
      if (!this.sockets.delete(server)) return;
      room.presenceChanged();
      if (this.sockets.size === 0) {
        void this.ctx.storage.put('idleSince', Date.now()).then(() => this.scheduleExpiry());
      }
    };
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);
    return new Response(null, { status: 101, webSocket: client });
  }
}

/**
 * Counts hits for one key (an action and an IP address) in a sliding window. Its storage is
 * dropped once the window has passed, so quiet keys leave nothing behind.
 */
export class LimiterObject extends DurableObject<Env> {
  async hit(rule: WindowRule): Promise<boolean> {
    const now = Date.now();
    const times = (await this.ctx.storage.get<readonly number[]>('times')) ?? [];
    const result = hit(times, now, rule);
    await this.ctx.storage.put('times', result.times);
    await this.ctx.storage.setAlarm(now + rule.windowMs);
    return result.allowed;
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
