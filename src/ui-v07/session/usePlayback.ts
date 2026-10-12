import { useEffect, useMemo, useState } from 'react';
import type { Action, MatchEvent, PlayerId, PlayerView, PrivateEvent } from '../../v07/game';
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
      return 120;
    case 'roles-revealed':
      return event.deployments.length > 0 ? 900 : 0;
    case 'voyage-modifiers':
      return 1400;
    case 'ship-resolved':
      return 1100;
    case 'market-settled':
      return 1000;
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
  readonly confirmHandoff: () => void;
  readonly submit: (action: Action) => void;
}

/**
 * Plays public events one by one, pauses between rounds and hands decisions to the UI only
 * after playback catches up. Hot-seat hides each seat's private view until its player confirms (§4, 5g).
 */
export function usePlayback(session: GameSession): Playback {
  const snapshot = useSession(session);
  const { events, players, requests, startingCash } = snapshot;
  const [cursor, setCursor] = useState(0);
  const [releasedHold, setReleasedHold] = useState(-1);
  const [confirmedSeat, setConfirmedSeat] = useState<{ readonly seat: PlayerId; readonly requestId: number } | null>(null);
  const [lastView, setLastView] = useState<PlayerView | null>(null);

  const hotSeat = players.filter((p) => p.kind === 'local-human').length > 1;
  const holding = cursor < events.length && isHold(events[cursor]) && releasedHold !== cursor;
  const caughtUp = cursor >= events.length;

  useEffect(() => {
    const next = events[cursor];
    if (next === undefined || holding) return;
    const timer = setTimeout(() => setCursor(cursor + 1), eventDelay(next));
    return () => clearTimeout(timer);
  }, [cursor, events, holding]);

  const played = useMemo(() => events.slice(0, cursor), [events, cursor]);
  const board = useMemo(() => buildBoard(players.map((p) => p.id), startingCash, played), [players, startingCash, played]);

  const request = caughtUp ? requests[0] : undefined;
  const seat = request?.context.decision.playerId ?? null;
  // Every new decision of a hot-seat table asks the (next) person to confirm again.
  const confirmed = confirmedSeat !== null && confirmedSeat.seat === seat && confirmedSeat.requestId === request?.id;
  const handoffTo = seat !== null && hotSeat && !confirmed ? seat : null;
  const activeView = request && handoffTo === null ? request.context.view : null;
  useEffect(() => {
    if (activeView) setLastView(activeView);
  }, [activeView]);
  // Hot-seat hides private information between turns; a single human keeps their own view.
  const view = activeView ?? (hotSeat ? null : lastView);
  const privateNotes = useMemo(
    () =>
      view
        ? snapshot.privateEvents.filter(
            (e) => e.playerId === view.playerId && (e.type === 'island-offers' ? false : e.round === board.round),
          )
        : [],
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
      setCursor(target);
    },
    release: () => setReleasedHold(cursor),
    confirmHandoff: () => seat !== null && request && setConfirmedSeat({ seat, requestId: request.id }),
    submit: (action) => {
      if (request) session.submit(request.id, action);
    },
  };
}
