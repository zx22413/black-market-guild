// A slow second player for the local online room (see references/verification.md): joins the
// room, then answers each of its requests with a bot's choice only after a delay, so states that
// wait on other players (a sealed submit, 「等待 … 決定…」) stay on screen long enough to check.
// Usage, from the repo root, with `preview_start {name: "online"}` running:
//   node --experimental-websocket --import tsx .claude/skills/game-ui-texture/scripts/slow-guest.ts <ROOM> [delayMs]
import { createBot } from '../../../../src/v07/bots';
import { PROTOCOL_VERSION, type ServerMessage } from '../../../../src/v07/online';

interface Process {
  readonly argv: readonly string[];
  exit(code: number): never;
}
const process = (globalThis as unknown as { process: Process }).process;

const room = process.argv[2];
if (!room) throw new Error('usage: slow-guest.ts <ROOM> [delayMs]');
const delayMs = Number(process.argv[3] ?? 25_000);
const bot = createBot('balanced', 7);
const token = crypto.randomUUID();
const socket = new WebSocket(`ws://localhost:8787/api/rooms/${room}/ws`);
const answered = new Set<number>();

socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'hello', token, protocol: PROTOCOL_VERSION })));
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data)) as ServerMessage;
  if (message.type === 'sync' && !message.room.joined) socket.send(JSON.stringify({ type: 'join', name: '慢慢想' }));
  const requests = message.type === 'request' ? [message.request] : message.type === 'sync' ? (message.room.match?.requests ?? []) : [];
  for (const request of requests) {
    if (answered.has(request.id)) continue;
    answered.add(request.id);
    console.log('request', request.id, request.context.decision.phase);
    setTimeout(() => socket.send(JSON.stringify({ type: 'submit', requestId: request.id, action: bot.decide(request.context) })), delayMs);
  }
  if (message.type === 'ended') {
    console.log('ended');
    socket.close();
    process.exit(0);
  }
});
