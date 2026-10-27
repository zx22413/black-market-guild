/**
 * Plays one V0.7 online match against a running Worker with two headless clients (host and
 * guest) driven by bots, plus two bot seats filled by the room; the guest drops and reconnects
 * mid-match. Checks that each client only receives its own requests and private events.
 * Usage: npm run build && npm run server:dev   (in another terminal)
 *        npm run online:smoke -- [--url http://localhost:8787]
 * Anyone may open a room; the Turnstile token is Cloudflare's dummy test token (accepted by the
 * test secret in .dev.vars) unless TURNSTILE_TOKEN is set. A server without TURNSTILE_SECRET ignores it.
 */
import { createBot, type Bot } from '../src/v07/bots';
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '../src/v07/online';

/** Node's process and fs, loaded untyped: the project compiles scripts without Node type definitions. */
interface Process {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  exit(code: number): never;
}
const process = (globalThis as unknown as { process: Process }).process;

const TIMEOUT_MS = 120_000;
/** The guest drops after answering this many requests, then reconnects. */
const DROP_AFTER = 8;

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

/** Cloudflare's dummy Turnstile token, which only the test secret accepts. */
const turnstileToken = (): string => process.env.TURNSTILE_TOKEN ?? 'XXXX.DUMMY.TOKEN.XXXX';

interface Client {
  readonly name: string;
  readonly token: string;
  seat: string | null;
  answered: Set<number>;
  requests: number;
  privateEvents: number;
  socket: WebSocket;
  ended: boolean;
}

const base = option('url', 'http://localhost:8787');
const problems: string[] = [];

/** `onMessage` returns false when it replaced the client's socket; the old socket then stops answering. */
function open(client: Client, room: string, bot: Bot, onMessage: (client: Client, message: ServerMessage) => boolean): WebSocket {
  const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/api/rooms/${room}/ws`);
  const send = (message: ClientMessage) => socket.send(JSON.stringify(message));
  socket.addEventListener('open', () => send({ type: 'hello', token: client.token, protocol: PROTOCOL_VERSION }));
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    if (!onMessage(client, message)) return;
    const requests =
      message.type === 'request' ? [message.request] : message.type === 'sync' ? (message.room.match?.requests ?? []) : [];
    for (const request of requests) {
      if (client.answered.has(request.id)) continue;
      if (client.seat !== null && request.context.decision.playerId !== client.seat) {
        problems.push(`${client.name} got a request for ${request.context.decision.playerId}`);
      }
      client.answered.add(request.id);
      client.requests += 1;
      send({ type: 'submit', requestId: request.id, action: bot.decide(request.context) });
    }
  });
  return socket;
}

async function main(): Promise<void> {
  const make = (name: string): Client => ({
    name,
    token: crypto.randomUUID(),
    seat: null,
    answered: new Set(),
    requests: 0,
    privateEvents: 0,
    socket: undefined as unknown as WebSocket,
    ended: false,
  });
  const host = make('host');
  const guest = make('guest');
  const created = await fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostToken: host.token, turnstile: turnstileToken() }),
  });
  const { room, error } = (await created.json()) as { room?: string; error?: string };
  if (!room) throw new Error(`cannot create a room: ${error ?? created.status}`);
  console.log(`room ${room}`);

  let reconnected = false;
  let result: Extract<ServerMessage, { type: 'ended' }> | null = null;
  const bots = { host: createBot('balanced', 1), guest: createBot('aggressive', 2) };
  const finished = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('match did not finish in time')), TIMEOUT_MS);
    const onMessage = (client: Client, message: ServerMessage): boolean => {
      if (client === guest && !reconnected && guest.requests >= DROP_AFTER) {
        // Drop before handling, so this message (maybe a request) must come back in the reconnect sync.
        reconnected = true;
        console.log(`guest drops after ${guest.requests} requests and reconnects`);
        guest.socket.close();
        guest.socket = open(guest, room, bots.guest, onMessage);
        return false;
      }
      if (message.type === 'error') {
        problems.push(`${client.name}: ${message.code} ${message.message}`);
      } else if (message.type === 'sync') {
        client.seat = message.room.match?.you ?? client.seat;
        if (!message.room.joined) {
          client.socket.send(JSON.stringify({ type: 'join', name: client.name } satisfies ClientMessage));
        } else if (client === host && message.room.phase === 'lobby' && message.room.members.length === 2) {
          host.socket.send(JSON.stringify({ type: 'start', seats: 4 } satisfies ClientMessage));
        }
      } else if (message.type === 'private' && message.event.playerId !== client.seat) {
        problems.push(`${client.name} (${client.seat}) got a private event for ${message.event.playerId}`);
      } else if (message.type === 'ended') {
        client.ended = true;
        result = message;
        if (host.ended && guest.ended) {
          clearTimeout(timer);
          resolve();
        }
      }
      if (message.type === 'private') client.privateEvents += 1;
      return true;
    };
    host.socket = open(host, room, bots.host, onMessage);
    // Join one after the other so the host is seat p1.
    setTimeout(() => (guest.socket = open(guest, room, bots.guest, onMessage)), 300);
  });
  await finished;
  host.socket.close();
  guest.socket.close();

  const ended = result as Extract<ServerMessage, { type: 'ended' }> | null;
  if (ended?.error) problems.push(`match error: ${ended.error}`);
  for (const client of [host, guest]) {
    console.log(`${client.name} (${client.seat}): ${client.requests} decisions, ${client.privateEvents} private events`);
  }
  ended?.result?.standings.forEach((s) => console.log(`  #${s.rank} ${s.playerId} ${s.wealth} G`));
  if (!reconnected) problems.push('the guest never reconnected');
  if (problems.length > 0) {
    throw new Error(`smoke test failed:\n${problems.join('\n')}`);
  }
  console.log('ok');
  // Closing sockets can keep Node's event loop alive for a while; the check is done.
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
