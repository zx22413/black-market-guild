import { useEffect, useMemo, useState } from 'react';
import type { Action, MatchEvent, PlayerId, PlayerView, PrivateEvent } from '../../game';
import { DIE_BEAT_MS, dieSteps } from '../scene/dieSteps';
import { SHOWCASE_MS, showcaseOf, type Showcase } from '../table/eventReveal';
import { recruitShow } from '../table/recruitShow';
import { buildBoard, type Board } from './board';
import type { GameSession, HumanRequest, SessionSnapshot } from './gameSession';
import { useSession } from './useSession';

/** Milliseconds to linger on each event during playback. */
function eventDelay(event: MatchEvent): number {
  switch (event.type) {
    case 'phase-started':
    case 'round-ended':
      return 0;
    case 'cash-changed':
      return 150;
    case 'roles-revealed':
      return 900;
    case 'voyage-modifiers': {
      // Let every die count through its modifiers (plus a possible private intel beat).
      const beats = Math.max(1, ...event.modifiers.map((m) => dieSteps(m, false, null).length + 1));
      return 600 + beats * DIE_BEAT_MS;
    }
    case 'ship-resolved':
      return 1000;
    case 'joint-ventures-formed':
      return 2200;
    default:
      return 450;
  }
}

/** Playback stops before each new round so the previous results can be read. */
const isHold = (event: MatchEvent | undefined): boolean => event?.type === 'round-started' && event.round > 1;

export interface Playback {
  readonly snapshot: SessionSnapshot;
  /** Public events shown so far. */
  readonly played: readonly MatchEvent[];
  /** Table state rebuilt from the played events. */
  readonly board: Board;
  /** Playback is paused before the next round until released. */
  readonly holding: boolean;
  readonly caughtUp: boolean;
  /** A market or voyage event just revealed, shown full screen; playback waits for it. */
  readonly showcase: Showcase | null;
  /** The human decision on screen; only once playback has caught up. */
  readonly request: HumanRequest | undefined;
  /** Hot-seat: the next human must confirm before their secrets are shown. */
  readonly handoffTo: PlayerId | null;
  /** The seat whose private information is visible, if any. */
  readonly view: PlayerView | null;
  /** The view of the decision being made right now. */
  readonly activeView: PlayerView | null;
  /** This round's private events for the visible seat. */
  readonly privateNotes: readonly PrivateEvent[];
  /** Other seats still deciding, once playback has caught up (the one deciding on screen is left out). */
  readonly waiting: readonly PlayerId[];
  readonly skip: () => void;
  readonly release: () => void;
  readonly dismissShowcase: () => void;
  readonly confirmHandoff: () => void;
  readonly submit: (action: Action) => void;
}

/**
 * Plays public events one by one, pauses between rounds and hands decisions to the UI only
 * after playback catches up. Shared by every game screen.
 */
export function usePlayback(session: GameSession): Playback {
  const snapshot = useSession(session);
  const { events, players, requests, startingCash } = snapshot;
  const [cursor, setCursor] = useState(0);
  const [releasedHold, setReleasedHold] = useState(-1);
  const [confirmedSeat, setConfirmedSeat] = useState<PlayerId | null>(null);
  const [lastView, setLastView] = useState<PlayerView | null>(null);
  // The cursor whose revealed event card has been put away (timed out, tapped or skipped).
  const [shownAt, setShownAt] = useState(-1);

  const hotSeat = players.filter((p) => p.kind === 'local-human').length > 1;
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const holding = cursor < events.length && isHold(events[cursor]) && releasedHold !== cursor;
  const caughtUp = cursor >= events.length;
  const showcase = shownAt === cursor ? null : showcaseOf(events[cursor - 1]);

  useEffect(() => {
    if (showcase === null) return;
    const timer = setTimeout(() => setShownAt(cursor), SHOWCASE_MS);
    return () => clearTimeout(timer);
  }, [showcase, cursor]);

  useEffect(() => {
    const next = events[cursor];
    if (next === undefined || holding || showcase !== null) return;
    // The recruitment show (parchments, pigeons, handshakes) plays after its event appears, so the
    // next event waits for it; every other event keeps the plain pause before it.
    const linger = cursor > 0 ? recruitShow(events, cursor - 1, playerIds).duration : 0;
    const timer = setTimeout(() => setCursor(cursor + 1), eventDelay(next) + linger);
    return () => clearTimeout(timer);
  }, [cursor, events, holding, showcase, playerIds]);

  const played = useMemo(() => events.slice(0, cursor), [events, cursor]);
  const board = useMemo(() => buildBoard(players.map((p) => p.id), startingCash, played), [players, startingCash, played]);

  // A decision waits until the revealed event card has been read.
  const request = caughtUp && showcase === null ? requests[0] : undefined;
  const seat = request?.context.decision.playerId ?? null;
  const handoffTo = seat !== null && hotSeat && confirmedSeat !== seat ? seat : null;
  const activeView = request && handoffTo === null ? request.context.view : null;
  useEffect(() => {
    if (activeView) setLastView(activeView);
  }, [activeView]);
  // Hot-seat hides private information between turns; a single human keeps their own view.
  const view = activeView ?? (hotSeat ? null : lastView);
  const privateNotes = useMemo(
    () => (view ? snapshot.privateEvents.filter((e) => e.playerId === view.playerId && e.round === board.round) : []),
    [view, snapshot.privateEvents, board.round],
  );

  const waiting = useMemo(
    () => (caughtUp && snapshot.status === 'running' ? snapshot.waitingOn.filter((id) => id !== seat) : []),
    [caughtUp, snapshot.status, snapshot.waitingOn, seat],
  );

  return {
    snapshot,
    played,
    board,
    holding,
    caughtUp,
    showcase,
    request,
    handoffTo,
    view,
    activeView,
    privateNotes,
    waiting,
    skip: () => {
      const nextHold = events.findIndex((e, i) => i > cursor && isHold(e));
      const target = nextHold === -1 ? events.length : nextHold;
      setReleasedHold(cursor);
      setShownAt(target);
      setCursor(target);
    },
    release: () => setReleasedHold(cursor),
    dismissShowcase: () => setShownAt(cursor),
    confirmHandoff: () => setConfirmedSeat(seat),
    submit: (action) => {
      if (request) session.submit(request.id, action);
    },
  };
}
