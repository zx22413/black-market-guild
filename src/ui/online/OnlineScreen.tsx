import { lazy, Suspense, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { uiArtVars, uiBackdropUrl } from '../art';
import {
  connectRoom,
  createRoom,
  saveHostKey,
  savedHostKey,
  savedName,
  type OnlineClient,
  type OnlineState,
} from './onlineClient';
import '../screens/setup.css';
import './online.css';

const TableScreen = lazy(() => import('../table/TableScreen').then((m) => ({ default: m.TableScreen })));

const CONNECTION_LABELS: Readonly<Record<OnlineState['connection'], string>> = {
  connecting: '連線中…',
  open: '已連線',
  closed: '連線中斷，重新連線中…',
};

/** Puts the room code in the address bar so the page itself is the invite link. */
function setRoomInUrl(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(null, '', url);
}

function Board({ title, children, footer }: { readonly title: string; readonly children: ReactNode; readonly footer?: ReactNode }) {
  const style = { ...uiArtVars(), '--setup-backdrop': `url(${uiBackdropUrl})` } as CSSProperties;
  return (
    <main className="setup online" style={style}>
      <div className="setup-board">
        <div className="setup-plaque">
          <h1>{title}</h1>
        </div>
        <section className="setup-paper">{children}</section>
      </div>
      {footer}
    </main>
  );
}

function HostPanel({ onRoom, onBack }: { readonly onRoom: (code: string) => void; readonly onBack: () => void }) {
  const [key, setKey] = useState(savedHostKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await createRoom(key);
      saveHostKey(key);
      onRoom(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法開房');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Board
      title="線上房間"
      footer={
        <button className="arrow-button" disabled={busy || key.length === 0} onClick={open}>
          {busy ? '開房中…' : '開新房間'}
        </button>
      }
    >
      <p className="setup-lead">開一個房間，把連結傳給朋友，空位由電腦補上</p>
      <label className="name-line online-field">
        <span>房主密碼</span>
        <input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
      </label>
      <p className="online-hint">朋友不需要密碼，點你傳的連結就能加入</p>
      {error && <p className="online-error">{error}</p>}
      <button className="tag-button" onClick={onBack}>
        返回
      </button>
    </Board>
  );
}

function useOnline(client: OnlineClient): OnlineState {
  return useSyncExternalStore(client.subscribe, client.getState);
}

function InviteRow({ code }: { readonly code: string }) {
  const link = `${location.origin}/?room=${code}`;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: '黑市商會', text: `一起來玩黑市商會，房號 ${code}`, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // The share sheet was dismissed or the clipboard is blocked; the link stays on screen.
    }
  };
  return (
    <div className="online-invite">
      <span className="online-code">房號 {code}</span>
      <code>{link}</code>
      <button className="tag-button" onClick={share}>
        {copied ? '已複製' : '分享連結'}
      </button>
    </div>
  );
}

function Lobby({ code, client, state, onLeave }: { readonly code: string; readonly client: OnlineClient; readonly state: OnlineState; readonly onLeave: () => void }) {
  const room = state.room;
  const [name, setName] = useState(savedName);
  const [seats, setSeats] = useState(4);
  const joined = room?.joined ?? false;
  const memberCount = room?.members.length ?? 0;
  const seatOptions = room ? [3, 4].filter((n) => n >= Math.max(room.minSeats, memberCount) && n <= room.maxSeats) : [];
  const chosenSeats = seatOptions.includes(seats) ? seats : (seatOptions.at(-1) ?? seats);
  const footer = room?.isHost ? (
    <button className="arrow-button" disabled={!joined || state.connection !== 'open'} onClick={() => client.start(chosenSeats)}>
      開始對局
    </button>
  ) : undefined;

  return (
    <Board title="線上房間" footer={footer}>
      <InviteRow code={code} />
      <p className={`online-status ${state.connection}`}>{CONNECTION_LABELS[state.connection]}</p>
      {state.notice && <p className="online-error">{state.notice}</p>}

      {room?.phase === 'lobby' && (
        <>
          <div className="online-join">
            <label className="name-line online-field">
              <span>你的名稱</span>
              <input value={name} maxLength={12} placeholder="商會名稱" onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="tag-button on" disabled={name.trim().length === 0 || state.connection !== 'open'} onClick={() => client.join(name)}>
              {joined ? '改名' : '加入'}
            </button>
          </div>

          <ol className="online-members">
            {room.members.map((m, i) => (
              <li key={i} className={m.online ? '' : 'away'}>
                <span className="seat-no">{i + 1}P</span>
                <span>{m.name}</span>
                {m.isHost && <span className="online-tag">房主</span>}
                {!m.online && <span className="online-tag">離線</span>}
              </li>
            ))}
            {room.members.length === 0 && <li className="away">還沒有人加入</li>}
          </ol>

          {room.isHost ? (
            <div className="setup-modes" role="group" aria-label="座位數">
              {seatOptions.map((n) => (
                <button key={n} className={`tag-button${n === chosenSeats ? ' on' : ''}`} onClick={() => setSeats(n)}>
                  {n} 人局
                </button>
              ))}
              <span className="online-hint">空位由電腦補上{joined ? '' : '；你也要先加入'}</span>
            </div>
          ) : (
            <p className="online-hint">{joined ? '等房主開始對局…' : '輸入名稱後按「加入」'}</p>
          )}
        </>
      )}

      {room && room.phase !== 'lobby' && room.match?.you === null && <p className="online-hint">這個房間的對局已經開始，無法再加入。</p>}

      <button className="tag-button" onClick={onLeave}>
        離開房間
      </button>
    </Board>
  );
}

function Room({ code, onLeave }: { readonly code: string; readonly onLeave: () => void }) {
  const [client] = useState(() => connectRoom(code));
  useEffect(() => () => client.close(), [client]);
  const state = useOnline(client);
  const session = state.room?.match?.you ? client.getSession() : null;

  if (session) {
    return (
      <Suspense fallback={<div className="scene-boot">整理港口中…</div>}>
        {state.connection !== 'open' && <div className="online-banner">{CONNECTION_LABELS[state.connection]}</div>}
        <TableScreen session={session} onExit={onLeave} />
      </Suspense>
    );
  }
  return <Lobby code={code} client={client} state={state} onLeave={onLeave} />;
}

interface OnlineScreenProps {
  readonly initialRoom: string | null;
  readonly onExit: () => void;
}

/** Online play: the host opens a room with the host key, friends join through the link. */
export function OnlineScreen({ initialRoom, onExit }: OnlineScreenProps) {
  const [code, setCode] = useState(initialRoom);
  const leave = () => {
    setRoomInUrl(null);
    onExit();
  };
  if (!code) {
    return (
      <HostPanel
        onRoom={(room) => {
          setRoomInUrl(room);
          setCode(room);
        }}
        onBack={leave}
      />
    );
  }
  return <Room key={code} code={code} onLeave={leave} />;
}
