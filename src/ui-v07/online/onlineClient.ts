import type { Action } from '../../v07/game';
import { PROTOCOL_VERSION, type ClientMessage, type RoomSnapshot, type ServerMessage } from '../../v07/online';
import type { GameSession, SessionSnapshot } from '../session/gameSession';

/** The Worker's room API; in development Vite forwards it to `npm run server:dev` (vite.config.ts). */
export const API_BASE = '/api';

export type Connection = 'connecting' | 'open' | 'closed';

export interface OnlineState {
  readonly connection: Connection;
  readonly room: RoomSnapshot | null;
  /** Last message the server refused, in words for the player. */
  readonly notice: string | null;
  /** The room cannot be used any more (missing room or outdated page); no reconnects. */
  readonly fatal: boolean;
}

export interface OnlineClient {
  getState(): OnlineState;
  subscribe(listener: () => void): () => void;
  join(name: string): void;
  start(seats: number): void;
  /** Host only, after the match: everyone goes back to this room's lobby. */
  rematch(): void;
  /** Gives up this browser's lobby seat and stops sitting down again on its own. */
  leave(): void;
  /** The running match as a GameSession for the table screen; null before the start. */
  getSession(): GameSession | null;
  close(): void;
}

const RETRY_MS = [500, 1000, 2000, 4000, 8000];

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the seat survives only until this tab closes.
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Blocked storage: nothing was saved either.
  }
}

let memoryToken: string | null = null;

/** The random id this browser is known by in every room; kept so a reload keeps the seat. */
export function playerToken(): string {
  const stored = storageGet('bmg7.token');
  if (stored) return stored;
  memoryToken ??= crypto.randomUUID();
  storageSet('bmg7.token', memoryToken);
  return memoryToken;
}

export const savedName = (): string => storageGet('bmg7.name') ?? '';
export const saveName = (name: string): void => storageSet('bmg7.name', name);
export const savedHostKey = (): string => storageGet('bmg7.hostKey') ?? '';
export const saveHostKey = (key: string): void => storageSet('bmg7.hostKey', key);

/** The room this browser last sat in, offered on the main menu as "back to the room". */
export const lastRoom = (): string | null => storageGet('bmg7.lastRoom');
export const saveLastRoom = (code: string): void => storageSet('bmg7.lastRoom', code);
export function forgetLastRoom(code?: string): void {
  if (code !== undefined && lastRoom() !== code) return;
  storageRemove('bmg7.lastRoom');
}

/** Asks the server for a new room; only works with the host key. */
export async function createRoom(hostKey: string): Promise<string> {
  const response = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostKey, hostToken: playerToken() }),
  });
  const body = (await response.json().catch(() => ({}))) as { room?: string; error?: string };
  if (!response.ok || !body.room) {
    throw new Error(body.error ?? `無法開房（${response.status}）`);
  }
  return body.room;
}

function applyMessage(room: RoomSnapshot | null, message: ServerMessage): RoomSnapshot | null {
  if (message.type === 'sync') return message.room;
  const match = room?.match;
  if (!room || !match) return room;
  switch (message.type) {
    case 'events':
      return { ...room, match: { ...match, events: [...match.events, ...message.events] } };
    case 'private':
      return { ...room, match: { ...match, privateEvents: [...match.privateEvents, message.event] } };
    case 'request':
      return { ...room, match: { ...match, requests: [...match.requests, message.request].sort((a, b) => a.id - b.id) } };
    case 'waiting':
      return { ...room, match: { ...match, waitingOn: message.players } };
    case 'ended':
      return { ...room, phase: 'finished', match: { ...match, requests: [], waitingOn: [], result: message.result, error: message.error } };
    default:
      return room;
  }
}

function toSessionSnapshot(room: RoomSnapshot): SessionSnapshot | null {
  const match = room.match;
  if (!match) return null;
  return {
    status: match.error ? 'error' : match.result ? 'finished' : 'running',
    players: match.players,
    events: match.events,
    privateEvents: match.privateEvents,
    requests: match.requests,
    waitingOn: match.waitingOn,
    startingCash: match.startingCash,
    result: match.result,
    error: match.error,
  };
}

/** Connects to one room and keeps reconnecting (phones drop sockets when the screen sleeps). */
export function connectRoom(code: string): OnlineClient {
  const token = playerToken();
  const listeners = new Set<() => void>();
  let state: OnlineState = { connection: 'connecting', room: null, notice: null, fatal: false };
  let socket: WebSocket | null = null;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let lastMatch: RoomSnapshot['match'] = null;
  let sessionSnapshot: SessionSnapshot | null = null;
  let session: GameSession | null = null;

  const update = (patch: Partial<OnlineState>): void => {
    state = { ...state, ...patch };
    // Keep the snapshot object stable unless the match itself changed (useSyncExternalStore).
    const match = state.room?.match ?? null;
    if (match !== lastMatch) {
      lastMatch = match;
      sessionSnapshot = state.room ? toSessionSnapshot(state.room) : null;
      // Back in the lobby (rematch): the next match gets a fresh session for a fresh table.
      if (sessionSnapshot === null) session = null;
    }
    listeners.forEach((listener) => listener());
  };

  const send = (message: ClientMessage): void => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  const scheduleRetry = (): void => {
    if (closed || state.fatal || retryTimer !== null) return;
    const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!;
    attempt++;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      open();
    }, delay);
  };

  const onMessage = (event: MessageEvent): void => {
    let message: ServerMessage;
    try {
      message = JSON.parse(String(event.data)) as ServerMessage;
    } catch {
      return;
    }
    if (message.type === 'error') {
      const fatal = message.code === 'no-room' || message.code === 'outdated';
      if (message.code === 'no-room') forgetLastRoom(code);
      update({ notice: message.message, fatal: state.fatal || fatal });
      return;
    }
    const room = applyMessage(state.room, message);
    update({ room, ...(message.type === 'sync' ? { notice: null } : {}) });
    if (room?.joined) saveLastRoom(code);
    // After a server restart the lobby forgets people; rejoin whoever had joined this room.
    if (message.type === 'sync' && !room?.joined && room?.phase === 'lobby' && storageGet(`bmg7.joined.${code}`)) {
      send({ type: 'join', name: savedName() });
    }
  };

  function open(): void {
    if (closed) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}${API_BASE}/rooms/${code}/ws`);
    socket = ws;
    update({ connection: 'connecting' });
    ws.addEventListener('open', () => {
      attempt = 0;
      update({ connection: 'open' });
      send({ type: 'hello', token, protocol: PROTOCOL_VERSION });
    });
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', () => {
      if (socket !== ws) return;
      socket = null;
      update({ connection: 'closed' });
      scheduleRetry();
    });
  }

  const wake = (): void => {
    if (document.visibilityState !== 'visible' || socket !== null) return;
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    attempt = 0;
    open();
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  open();

  const submit = (requestId: number, action: Action): void => {
    const room = state.room;
    const match = room?.match;
    if (!room || !match) return;
    update({ room: { ...room, match: { ...match, requests: match.requests.filter((r) => r.id !== requestId) } } });
    send({ type: 'submit', requestId, action });
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    join: (name) => {
      saveName(name);
      storageSet(`bmg7.joined.${code}`, '1');
      send({ type: 'join', name });
    },
    start: (seats) => send({ type: 'start', seats }),
    rematch: () => send({ type: 'rematch' }),
    leave: () => {
      storageRemove(`bmg7.joined.${code}`);
      send({ type: 'leave' });
    },
    getSession: () => {
      if (sessionSnapshot === null) return null;
      session ??= {
        getSnapshot: () => sessionSnapshot!,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        submit,
      };
      return session;
    },
    close: () => {
      closed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      socket?.close();
      socket = null;
    },
  };
}
