import { DurableObject } from 'cloudflare:workers';
import {
  MAX_MESSAGE_BYTES,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  Room,
  isRoomCode,
  isValidToken,
  parseClientMessage,
  type ServerMessage,
} from '../src/online';

interface Env {
  readonly ROOMS: DurableObjectNamespace<RoomObject>;
  /** Only whoever knows this key may open rooms. Set with `wrangler secret put HOST_KEY`. */
  readonly HOST_KEY?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function randomRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
}

function sameKey(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  if (!env.HOST_KEY) {
    return json({ error: '伺服器尚未設定房主密碼' }, 503);
  }
  const body: unknown = await request.json().catch(() => null);
  const { hostKey, hostToken } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof hostKey !== 'string' || !sameKey(hostKey, env.HOST_KEY)) {
    return json({ error: '房主密碼錯誤' }, 403);
  }
  if (!isValidToken(hostToken)) {
    return json({ error: 'bad host token' }, 400);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomRoomCode();
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    if (await stub.claim(hostToken)) {
      return json({ room: code });
    }
  }
  return json({ error: '無法建立房間，請再試一次' }, 503);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      return createRoom(request, env);
    }
    const match = /^\/api\/rooms\/([^/]+)\/ws$/.exec(url.pathname);
    if (match && isRoomCode(match[1])) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket', { status: 426 });
      }
      return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
    }
    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;

/**
 * One room per Durable Object. Sockets use the plain accept() API rather than hibernation, so
 * the object (and the match running in memory) stays alive while anyone is connected.
 * TODO: the match is not persisted; a redeploy or an eviction ends running matches.
 */
export class RoomObject extends DurableObject<Env> {
  private room: Room | null = null;
  private readonly sockets = new Map<WebSocket, string | null>();

  /** Reserves this room for a host; false if the code is already taken. */
  async claim(hostToken: string): Promise<boolean> {
    if (await this.ctx.storage.get<string>('host')) return false;
    await this.ctx.storage.put('host', hostToken);
    return true;
  }

  private async loadRoom(): Promise<Room | null> {
    if (this.room) return this.room;
    const hostToken = await this.ctx.storage.get<string>('host');
    if (!hostToken) return null;
    this.room = new Room({
      hostToken,
      send: (token, message) => this.send(token, message),
      isOnline: (token) => [...this.sockets.values()].includes(token),
    });
    return this.room;
  }

  private send(token: string, message: ServerMessage): void {
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
      server.send(JSON.stringify({ type: 'error', code: 'no-room', message: '找不到這個房間' } satisfies ServerMessage));
      server.close(4404, 'no room');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.sockets.set(server, null);
    server.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      const message = raw.length <= MAX_MESSAGE_BYTES ? parseClientMessage(raw) : null;
      const owner = this.sockets.get(server) ?? null;
      if (!message || (owner === null && message.type !== 'hello')) {
        server.send(JSON.stringify({ type: 'error', code: 'bad-message', message: '無法辨識的訊息' } satisfies ServerMessage));
        return;
      }
      if (message.type === 'hello') {
        this.sockets.set(server, message.token);
        room.presenceChanged();
      }
      room.receive(message.type === 'hello' ? message.token : owner!, message, randomSeed());
    });
    const drop = () => {
      if (this.sockets.delete(server)) room.presenceChanged();
    };
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);
    return new Response(null, { status: 101, webSocket: client });
  }
}
