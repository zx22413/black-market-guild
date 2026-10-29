import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from 'react';
import { DECISION_SECONDS_CHOICES, DEFAULT_DECISION_SECONDS, ROOM_CODE_LENGTH, isRoomCode } from '../../v07/online';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import { MatchView } from '../table/MatchView';
import type { Rematch } from '../table3d/ResultCard';
import { useLaunchOnStart } from '../menu/launch';
import type { MenuView } from '../menu/menuSeats';
import { seatCards, type SeatCard } from './lobbySeats';
import { MatchClock } from './MatchClock';
import { limitLabel } from './clockText';
import { turnstileToken } from './turnstile';
import { track } from '../analytics/track';
import { RESOLUTION_AUTO_SECONDS } from '../table3d/useAutoAdvance';
import { useCountSound } from '../audio/useUiSounds';
import {
  connectRoom,
  createRoom,
  forgetLastRoom,
  savedName,
  type OnlineClient,
  type OnlineState,
} from './onlineClient';

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

function JoinByCode({ onRoom }: { readonly onRoom: (code: string) => void }) {
  const [code, setCode] = useState('');
  const valid = isRoomCode(code);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onRoom(code);
  };
  return (
    <form className="menu-join" onSubmit={submit}>
      <label htmlFor="room-code">輸入房號</label>
      <div className="menu-row">
        <input
          id="room-code"
          className="menu-code-input"
          value={code}
          maxLength={ROOM_CODE_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="K7QX2M"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
        />
        <button type="submit" className="menu-go" disabled={!valid}>
          加入
        </button>
      </div>
      {code.length === ROOM_CODE_LENGTH && !valid && <p className="menu-error">房號只有英文字母與數字，沒有 0、O、1、I、L</p>}
    </form>
  );
}

/** Anyone may open a room (open-questions Q-09); Turnstile checks for bots first, mostly unseen. */
function HostRoom({ onRoom, autoStart = false }: { readonly onRoom: (code: string) => void; readonly autoStart?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Turnstile draws here only when Cloudflare wants a click.
  const challenge = useRef<HTMLDivElement>(null);
  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = challenge.current ? await turnstileToken(challenge.current) : null;
      const code = await createRoom(token);
      track('room_create');
      onRoom(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法開房');
    } finally {
      setBusy(false);
    }
  };
  // Coming from 「邀請朋友一起玩」: open the room right away (once, even under StrictMode).
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void open();
    // `open` is rebuilt every render; this runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);
  return (
    <section className="menu-host">
      <div ref={challenge} className="menu-challenge" />
      {error && <p className="menu-error">{error}</p>}
      <button type="button" className="menu-action" disabled={busy} onClick={open}>
        {busy ? '開房中…' : '建立房間'}
        <small>空位由電腦補上</small>
      </button>
    </section>
  );
}

interface OnlineHomeProps {
  readonly onRoom: (code: string) => void;
  readonly autoCreate: boolean;
  readonly onBack: () => void;
  readonly onView: (view: MenuView | null) => void;
}

function OnlineHome({ onRoom, autoCreate, onBack, onView }: OnlineHomeProps) {
  useLayoutEffect(() => onView({ stage: 'online' }), [onView]);
  return (
    <main className="menu-panel menu-page">
      <h2>線上房間</h2>
      <JoinByCode onRoom={onRoom} />
      <p className="menu-note">朋友傳來的邀請連結，點開就會直接進房。</p>
      {autoCreate && <p className="menu-note">正在建立房間，進大廳後按「複製邀請連結」傳給朋友，空位由電腦補上。</p>}
      <HostRoom onRoom={onRoom} autoStart={autoCreate} />
      <div className="menu-foot">
        <button type="button" className="menu-small" onClick={onBack}>
          返回
        </button>
      </div>
    </main>
  );
}

function CopyLink({ code }: { readonly code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}?room=${code}`;
  const copy = async () => {
    track('invite_copy');
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard blocked: the code itself is on screen to read out.
    }
  };
  return (
    <button type="button" className="menu-small" onClick={copy} title={link}>
      {copied ? '已複製' : '複製邀請連結'}
    </button>
  );
}

interface NameRowProps {
  readonly client: OnlineClient;
  readonly joined: boolean;
  readonly connected: boolean;
  /** For the statistics: sitting down as the host, and whether the room came from a link. */
  readonly code: string;
  readonly isHost: boolean;
  readonly viaLink: boolean;
}

function NameRow({ client, joined, connected, code, isHost, viaLink }: NameRowProps) {
  const [name, setName] = useState(savedName);
  return (
    <form
      className="menu-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!joined) track('room_join', { role: isHost ? 'host' : 'guest', link: viaLink, room: code });
        client.join(name);
      }}
    >
      <input value={name} maxLength={12} placeholder="商會名稱" aria-label="商會名稱" onChange={(e) => setName(e.target.value)} />
      <button type="submit" className={joined ? 'menu-small' : 'menu-go'} disabled={name.trim().length === 0 || !connected}>
        {joined ? '改名' : '入座'}
      </button>
    </form>
  );
}

/** The seat's guild colour (the colour it gets at the table), for the name plate's ribbon. */
function seatRibbon(index: number): CSSProperties {
  return { '--seat': PLAYER_COLORS[index % PLAYER_COLORS.length] } as CSSProperties;
}

interface SeatsProps {
  readonly cards: readonly SeatCard[];
  /** The host's 「移出」 on everyone else's card; null for other people. */
  readonly onKick: ((member: number) => void) | null;
}

function Seats({ cards, onKick }: SeatsProps) {
  return (
    <ol className="menu-seats">
      {cards.map((card, i) =>
        card.kind === 'member' ? (
          <li key={i} className={`menu-seat ${card.online ? '' : 'away'}`} style={seatRibbon(i)}>
            <small>
              {i + 1}P{card.isHost && '・房主'}
            </small>
            <strong>{card.name}</strong>
            <small className={card.online ? 'menu-online' : 'menu-offline'}>{card.online ? '在線' : '離線'}</small>
            {onKick && !card.isHost && (
              <button type="button" className="menu-kick" onClick={() => onKick(i)} aria-label={`移出 ${card.name}`}>
                移出
              </button>
            )}
          </li>
        ) : (
          <li key={i} className="menu-seat empty">
            <small>{i + 1}P</small>
            <strong>空位</strong>
            <small>開始時由電腦補上</small>
          </li>
        ),
      )}
    </ol>
  );
}

interface LobbyProps {
  readonly code: string;
  readonly viaLink: boolean;
  readonly client: OnlineClient;
  readonly state: OnlineState;
  readonly onLeave: () => void;
  readonly onView: (view: MenuView | null) => void;
}

function Lobby({ code, viaLink, client, state, onLeave, onView }: LobbyProps) {
  const room = state.room;
  const [seats, setSeats] = useState(4);
  const decisionSeconds = room?.decisionSeconds ?? DEFAULT_DECISION_SECONDS;
  const joined = room?.joined ?? false;
  const connected = state.connection === 'open';
  const members = room?.members ?? [];
  // Someone sitting down or leaving the lobby.
  useCountSound(members.length, 'ui-join', 'ui-leave');
  const seatOptions = room ? [3, 4].filter((n) => n >= Math.max(room.minSeats, members.length) && n <= room.maxSeats) : [];
  const chosenSeats = seatOptions.includes(seats) ? seats : (seatOptions.at(-1) ?? seats);
  const shownSeats = room?.isHost ? chosenSeats : (room?.maxSeats ?? 4);
  const cards = seatCards(members, shownSeats);
  // The menu table mirrors the seat cards: a flag for everyone who sat down, mist over open seats.
  const tableKey = cards.map((c) => (c.kind === 'member' ? `m:${c.name}` : 'e')).join('|');
  useLayoutEffect(() => {
    onView({ stage: 'lobby', seats: cards.map((c) => (c.kind === 'member' ? { kind: 'member', name: c.name } : { kind: 'empty' })) });
    // `cards` is rebuilt every render; `tableKey` says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, onView]);

  return (
    <main className="menu-panel menu-page menu-lobby">
      <header className="menu-room">
        <span className="menu-room-code" aria-label="房號">
          {code}
        </span>
        <CopyLink code={code} />
        <span className={`menu-conn ${state.connection}`}>{CONNECTION_LABELS[state.connection]}</span>
      </header>
      {state.notice && <p className="menu-error">{state.notice}</p>}

      {room?.phase === 'lobby' && (
        <>
          <Seats cards={cards} onKick={room.isHost ? (member) => client.kick(member) : null} />
          {room.isHost ? (
            <button type="button" className="menu-small menu-lock" aria-pressed={room.locked} onClick={() => client.lock(!room.locked)}>
              {room.locked ? '已鎖房：按一下開放入座' : '鎖房（不讓新的人入座）'}
            </button>
          ) : (
            room.locked && <p className="menu-note">房主已鎖房，新的人無法入座。</p>
          )}
          <NameRow client={client} joined={joined} connected={connected} code={code} isHost={room.isHost} viaLink={viaLink} />
          {room.isHost ? (
            <div className="menu-foot">
              <div className="menu-kind" role="radiogroup" aria-label="座位數">
                {seatOptions.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={n === chosenSeats} className={n === chosenSeats ? 'on' : ''} onClick={() => setSeats(n)}>
                    {n} 人局
                  </button>
                ))}
              </div>
              <div className="menu-kind" role="radiogroup" aria-label="每個決定的限時">
                {DECISION_SECONDS_CHOICES.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={n === decisionSeconds} className={n === decisionSeconds ? 'on' : ''} onClick={() => client.setLimit(n)}>
                    {limitLabel(n)}
                  </button>
                ))}
              </div>
              <button type="button" className="menu-go" disabled={!joined || !connected} onClick={() => client.start(chosenSeats)}>
                開始對局
              </button>
            </div>
          ) : (
            <p className="menu-note">{joined ? `等房主開始對局…（每個決定限時 ${limitLabel(decisionSeconds)}，由房主選）` : '輸入名稱後按「入座」'}</p>
          )}
        </>
      )}
      {room && room.phase !== 'lobby' && room.match?.you === null && <p className="menu-note">這個房間的對局已經開始，無法再加入。</p>}
      <div className="menu-foot">
        <button type="button" className="menu-small" onClick={onLeave}>
          離開房間
        </button>
      </div>
    </main>
  );
}

interface RoomProps {
  readonly code: string;
  readonly viaLink: boolean;
  readonly onLeave: (forget: boolean) => void;
  readonly onView: (view: MenuView | null) => void;
}

function Room({ code, viaLink, onLeave, onView }: RoomProps) {
  // Created inside the effect so React StrictMode's mount-unmount-mount does not leave a closed client.
  const [client, setClient] = useState<OnlineClient | null>(null);
  useEffect(() => {
    const next = connectRoom(code);
    setClient(next);
    return () => next.close();
  }, [code]);
  if (!client) return null;
  return <RoomView code={code} viaLink={viaLink} client={client} onLeave={onLeave} onView={onView} />;
}

interface RoomViewProps {
  readonly code: string;
  readonly viaLink: boolean;
  readonly client: OnlineClient;
  readonly onLeave: (forget: boolean) => void;
  readonly onView: (view: MenuView | null) => void;
}

/** Each match of a room gets its own session object; a new one means a fresh table (after a rematch). */
const matchKeys = new WeakMap<object, number>();
let nextMatchKey = 1;
function matchKey(session: object): number {
  let key = matchKeys.get(session);
  if (key === undefined) {
    key = nextMatchKey++;
    matchKeys.set(session, key);
  }
  return key;
}

function RoomView({ code, viaLink, client, onLeave, onView }: RoomViewProps) {
  const state = useSyncExternalStore(client.subscribe, client.getState);
  // Statistics: how an online match went for this seat, once it ends.
  // Once per match: the flag drops when the room goes back to its lobby.
  const endTracked = useRef(false);
  const finishedMatch = state.room?.phase === 'finished' ? (state.room.match ?? null) : null;
  useEffect(() => {
    if (!finishedMatch) {
      endTracked.current = false;
      return;
    }
    if (endTracked.current || !finishedMatch.you || !finishedMatch.result) return;
    endTracked.current = true;
    track('online_end', {
      room: code,
      humans: finishedMatch.players.filter((p) => p.kind !== 'bot').length,
      timeouts: state.timeoutCount,
      takeover: state.wasTakenOver,
    });
  }, [finishedMatch, code, state.timeoutCount, state.wasTakenOver]);
  const session = state.room?.match?.you ? client.getSession() : null;
  // A match started while we watched the lobby: the menu table sends the ships out first.
  const launching = useLaunchOnStart(state.room?.phase ?? null) && session !== null;
  const seatCount = state.room?.match?.players.length ?? 0;
  const inMatch = session !== null && !launching;
  // Before paint, so the menu's 3D table is gone before the match's table mounts (one WebGL scene at a time).
  useLayoutEffect(() => {
    if (launching) onView({ stage: 'launch', seatCount });
    else if (inMatch) onView(null);
  }, [launching, inMatch, seatCount, onView]);
  if (launching) return null;
  if (session) {
    const finished = state.room?.phase === 'finished';
    const rematch: Rematch = state.room?.isHost ? { kind: 'now', onRematch: () => client.rematch() } : { kind: 'host-decides' };
    return (
      <>
        {state.connection !== 'open' && <div className="v7-banner">{CONNECTION_LABELS[state.connection]}</div>}
        {/* Leaving mid-match keeps the room on the main menu as "back to the room". */}
        <MatchView key={matchKey(session)} session={session} onExit={() => onLeave(finished)} rematch={rematch} autoAdvanceSeconds={RESOLUTION_AUTO_SECONDS} />
        <MatchClock state={state} client={client} />
      </>
    );
  }
  return (
    <Lobby
      code={code}
      viaLink={viaLink}
      client={client}
      state={state}
      onView={onView}
      onLeave={() => {
        client.leave();
        onLeave(true);
      }}
    />
  );
}

interface OnlineScreenProps {
  readonly initialRoom: string | null;
  /** Open a new room at once (from the single-player result card). */
  readonly autoCreate?: boolean;
  readonly onExit: () => void;
  /** What the menu table behind should show; null while a match has the screen (the table stops). */
  readonly onView: (view: MenuView | null) => void;
}

/** Online play: join a room by code or link; the host also opens rooms. */
export function OnlineScreen({ initialRoom, autoCreate = false, onExit, onView }: OnlineScreenProps) {
  const [code, setCode] = useState(initialRoom);
  // Also when coming back from the main menu's "back to the room": a reload stays in the room.
  useEffect(() => {
    if (code) setRoomInUrl(code);
  }, [code]);
  const leave = (forget: boolean) => {
    if (forget && code) forgetLastRoom(code);
    setRoomInUrl(null);
    onExit();
  };
  if (!code) return <OnlineHome onRoom={setCode} autoCreate={autoCreate} onBack={() => leave(false)} onView={onView} />;
  return <Room key={code} code={code} viaLink={code === initialRoom} onLeave={leave} onView={onView} />;
}
