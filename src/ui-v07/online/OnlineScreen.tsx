import { useEffect, useState, useSyncExternalStore } from 'react';
import { connectRoom, createRoom, saveHostKey, savedHostKey, savedName, type OnlineClient, type OnlineState } from './onlineClient';
import { TableScreen } from '../table/TableScreen';

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
    <main className="v7-setup">
      <h1>線上房間 <small>V0.7</small></h1>
      <p className="v7-muted">開一個房間，把連結傳給朋友，空位由電腦補上。</p>
      <label className="v7-seed">
        房主密碼
        <input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
      </label>
      {error && <p className="v7-error">{error}</p>}
      <button className="v7-primary" disabled={busy || key.length === 0} onClick={open}>
        {busy ? '開房中…' : '開新房間'}
      </button>
      <button className="v7-btn" onClick={onBack}>
        返回
      </button>
    </main>
  );
}

function Lobby({ code, client, state, onLeave }: { readonly code: string; readonly client: OnlineClient; readonly state: OnlineState; readonly onLeave: () => void }) {
  const room = state.room;
  const [name, setName] = useState(savedName);
  const [seats, setSeats] = useState(4);
  const [copied, setCopied] = useState(false);
  const joined = room?.joined ?? false;
  const memberCount = room?.members.length ?? 0;
  const seatOptions = room ? [3, 4].filter((n) => n >= Math.max(room.minSeats, memberCount) && n <= room.maxSeats) : [];
  const chosenSeats = seatOptions.includes(seats) ? seats : (seatOptions.at(-1) ?? seats);
  const link = `${location.origin}${location.pathname}?room=${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard blocked: the link stays on screen to copy by hand.
    }
  };

  return (
    <main className="v7-setup">
      <h1>線上房間 <small>{code}</small></h1>
      <p>
        <code className="v7-link">{link}</code>{' '}
        <button className="v7-btn" onClick={copy}>
          {copied ? '已複製' : '複製連結'}
        </button>
      </p>
      <p className={`v7-conn ${state.connection}`}>{CONNECTION_LABELS[state.connection]}</p>
      {state.notice && <p className="v7-error">{state.notice}</p>}

      {room?.phase === 'lobby' && (
        <>
          <div className="v7-chips">
            <input value={name} maxLength={12} placeholder="商會名稱" onChange={(e) => setName(e.target.value)} />
            <button className="v7-btn" disabled={name.trim().length === 0 || state.connection !== 'open'} onClick={() => client.join(name)}>
              {joined ? '改名' : '加入'}
            </button>
          </div>
          <ol className="v7-members">
            {room.members.map((m, i) => (
              <li key={i} className={m.online ? '' : 'away'}>
                {i + 1}P {m.name} {m.isHost && '（房主）'} {!m.online && '（離線）'}
              </li>
            ))}
            {room.members.length === 0 && <li className="away">還沒有人加入</li>}
          </ol>
          {room.isHost ? (
            <>
              <div className="v7-chips" role="group" aria-label="座位數">
                {seatOptions.map((n) => (
                  <button key={n} className={`v7-btn${n === chosenSeats ? ' on' : ''}`} onClick={() => setSeats(n)}>
                    {n} 人局
                  </button>
                ))}
              </div>
              <p className="v7-muted">空位由電腦補上{joined ? '' : '；你也要先加入'}</p>
              <button className="v7-primary" disabled={!joined || state.connection !== 'open'} onClick={() => client.start(chosenSeats)}>
                開始對局
              </button>
            </>
          ) : (
            <p className="v7-muted">{joined ? '等房主開始對局…' : '輸入名稱後按「加入」'}</p>
          )}
        </>
      )}
      {room && room.phase !== 'lobby' && room.match?.you === null && <p className="v7-muted">這個房間的對局已經開始，無法再加入。</p>}
      <button className="v7-btn" onClick={onLeave}>
        離開房間
      </button>
    </main>
  );
}

function Room({ code, onLeave }: { readonly code: string; readonly onLeave: () => void }) {
  const [client] = useState(() => connectRoom(code));
  useEffect(() => () => client.close(), [client]);
  const state = useSyncExternalStore(client.subscribe, client.getState);
  const session = state.room?.match?.you ? client.getSession() : null;
  if (session) {
    return (
      <>
        {state.connection !== 'open' && <div className="v7-banner">{CONNECTION_LABELS[state.connection]}</div>}
        <TableScreen session={session} onExit={onLeave} />
      </>
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
