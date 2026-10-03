import type {
  Application,
  AssetId,
  Deployment,
  MarketEventId,
  MatchEvent,
  MatchResult,
  PlayerId,
  ShipId,
  ShipKind,
  Venture,
  VoyageEventId,
  VoyageModifier,
  VoyageOutcome,
} from '../../game';

export interface BoardShip {
  readonly id: ShipId;
  readonly kind: ShipKind;
  readonly owners: readonly PlayerId[];
  readonly recruiters: readonly PlayerId[];
  readonly outcome: VoyageOutcome | null;
  readonly rerolled: boolean;
  /** Total smuggled off this ship; the smugglers stay anonymous unless caught. */
  readonly smuggled: number;
  readonly caughtSmugglers: readonly PlayerId[];
  /** Public roll modifiers, known once they are announced just before the outcome. */
  readonly modifier: VoyageModifier | null;
}

/**
 * Table state rebuilt from public events only, so it is safe for any viewer (spectators
 * included) and can be replayed up to any playback position.
 */
export interface Board {
  readonly round: number;
  readonly marketEvent: MarketEventId | null;
  readonly voyageEvent: VoyageEventId | null;
  readonly cash: Readonly<Record<PlayerId, number>>;
  readonly assets: Readonly<Record<PlayerId, readonly AssetId[]>>;
  readonly recruiters: readonly PlayerId[];
  readonly withdrawn: readonly PlayerId[];
  readonly applications: readonly Application[];
  readonly ventures: readonly Venture[];
  /** Recruitment is over (see closesRecruitment): open recruitments no longer stand on the table. */
  readonly recruitResolved: boolean;
  readonly launched: boolean;
  readonly stayedInPort: readonly PlayerId[];
  readonly ships: readonly BoardShip[];
  readonly revealedRoles: readonly Deployment[];
  readonly result: MatchResult | null;
}

const EMPTY_ROUND = {
  marketEvent: null,
  voyageEvent: null,
  recruiters: [],
  withdrawn: [],
  applications: [],
  ventures: [],
  recruitResolved: false,
  launched: false,
  stayedInPort: [],
  ships: [],
  revealedRoles: [],
} as const;

export function initialBoard(playerIds: readonly PlayerId[], startingCash: number): Board {
  return {
    round: 0,
    ...EMPTY_ROUND,
    cash: Object.fromEntries(playerIds.map((id) => [id, startingCash])),
    assets: Object.fromEntries(playerIds.map((id) => [id, []])),
    result: null,
  };
}

function updateShip(board: Board, shipId: ShipId, patch: (ship: BoardShip) => Partial<BoardShip>): Board {
  return { ...board, ships: board.ships.map((s) => (s.id === shipId ? { ...s, ...patch(s) } : s)) };
}

/** Phases that come after picking: once one of them starts, recruitment is over. */
const AFTER_PICK = new Set(['sailing-choice', 'role-deployment', 'intel-reroll']);

/**
 * Recruitment is over once the round moves on to sailing (or, if nobody has to choose, to the
 * launch). The engine skips phases nobody has to decide, so a round where nobody applied never
 * announces any ventures: this, not the ventures event, is when the results can be shown.
 */
export function closesRecruitment(event: MatchEvent | undefined): boolean {
  return event?.type === 'ships-launched' || (event?.type === 'phase-started' && AFTER_PICK.has(event.phase));
}

export function applyBoardEvent(board: Board, event: MatchEvent): Board {
  switch (event.type) {
    case 'round-started':
      return { ...board, ...EMPTY_ROUND, round: event.round };
    case 'market-event-revealed':
      return { ...board, marketEvent: event.event };
    case 'voyage-event-revealed':
      return { ...board, voyageEvent: event.event };
    case 'assets-purchased': {
      const assets = { ...board.assets };
      event.purchases.forEach((p) => (assets[p.playerId] = [...(assets[p.playerId] ?? []), p.asset]));
      return { ...board, assets };
    }
    case 'recruitments-announced':
      return { ...board, recruiters: event.recruiters };
    case 'recruitments-withdrawn':
      return { ...board, withdrawn: event.recruiters };
    case 'applications-announced':
      return { ...board, applications: event.applications };
    case 'joint-ventures-formed':
      return { ...board, ventures: [...board.ventures, ...event.ventures] };
    case 'ships-launched':
      return {
        ...board,
        recruitResolved: true,
        launched: true,
        stayedInPort: event.stayedInPort,
        ships: event.ships.map((s) => ({ ...s, outcome: null, rerolled: false, smuggled: 0, caughtSmugglers: [], modifier: null })),
      };
    case 'cash-changed':
      return { ...board, cash: { ...board.cash, [event.playerId]: (board.cash[event.playerId] ?? 0) + event.amount } };
    case 'roles-revealed': {
      const revealed = { ...board, revealedRoles: [...board.revealedRoles, ...event.deployments] };
      return {
        ...revealed,
        ships: revealed.ships.map((s) => (event.rerolledShipIds.includes(s.id) ? { ...s, rerolled: true } : s)),
      };
    }
    case 'ship-smuggled':
      return updateShip(board, event.shipId, (s) => ({ smuggled: s.smuggled + event.amount }));
    case 'smugglers-caught':
      return updateShip(board, event.shipId, (s) => ({ caughtSmugglers: [...s.caughtSmugglers, ...event.smugglers] }));
    case 'voyage-modifiers':
      return {
        ...board,
        ships: board.ships.map((s) => ({ ...s, modifier: event.modifiers.find((m) => m.shipId === s.id) ?? s.modifier })),
      };
    case 'ship-resolved':
      return updateShip(board, event.shipId, () => ({ outcome: event.outcome }));
    case 'match-ended':
      return { ...board, result: event.result };
    case 'phase-started':
      // Once sailing starts, recruitment is over (see closesRecruitment).
      return closesRecruitment(event) ? { ...board, recruitResolved: true } : board;
    case 'round-ended':
      return board;
    default: {
      const unhandled: never = event;
      throw new Error(`unhandled event: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function buildBoard(
  playerIds: readonly PlayerId[],
  startingCash: number,
  events: readonly MatchEvent[],
): Board {
  return events.reduce(applyBoardEvent, initialBoard(playerIds, startingCash));
}
