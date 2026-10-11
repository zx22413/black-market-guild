import { publicShip } from './invest';
import type { EconomyRules } from './rules';
import { playerOf } from './state';
import type {
  BuildingId,
  Deployment,
  EconPlayer,
  EconomyPhase,
  EconRoleId,
  EconomyState,
  Goods,
  IslandId,
  PlayerId,
  PublicShip,
} from './types';

export interface PublicEconPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly cash: number;
  readonly buildings: readonly BuildingId[];
  readonly island: IslandId | null;
  /** Warehouse after production, before anyone loaded this round. */
  readonly stockAtRoundStart: Goods;
}

/** Everything one player may know; bots decide from this view only. */
export interface EconomyView {
  readonly rules: EconomyRules;
  readonly playerId: PlayerId;
  readonly round: number;
  readonly phase: EconomyPhase | 'game-over';
  readonly me: EconPlayer;
  readonly players: readonly PublicEconPlayer[];
  readonly prices: Goods;
  readonly demand: Goods;
  readonly wanted: readonly PlayerId[];
  readonly ships: readonly PublicShip[];
  readonly myDeployment: Deployment | null;
  /** Islands I may choose from during the island draft. */
  readonly myIslandOffers: readonly IslandId[];
  /** My role hand this round (draw mode); null when every role is open. */
  readonly myHand: readonly EconRoleId[] | null;
  /** The intel merchant's view of its target: the rerolled value if rerolled, else the raw roll. */
  readonly intelRoll: number | null;
  /** Lighthouse intel: the second ship looked at and its roll. */
  readonly intelPeek: { readonly shipId: string; readonly roll: number | null } | null;
}

export function getEconomyView(state: EconomyState, playerId: PlayerId): EconomyView {
  const { roundState } = state;
  const myDeployment = roundState.deployments.find((d) => d.playerId === playerId) ?? null;
  const target = myDeployment?.role === 'intel' ? roundState.ships.find((s) => s.id === myDeployment.targetShipId) : undefined;
  return {
    rules: state.rules,
    playerId,
    round: state.round,
    phase: state.phase,
    me: playerOf(state, playerId),
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      cash: p.cash,
      buildings: p.buildings,
      island: p.island,
      stockAtRoundStart: roundState.stockAtStart[p.id] ?? p.stock,
    })),
    prices: state.prices,
    demand: roundState.demand,
    wanted: roundState.wanted,
    ships: roundState.ships.map((s) => publicShip(state, s, playerId)),
    myDeployment,
    myHand: roundState.hands[playerId] ?? null,
    myIslandOffers: state.islandOffers[playerId] ?? [],
    intelRoll: target === undefined ? null : (target.rerolledRoll ?? target.rawRoll),
    intelPeek: peekView(state, myDeployment),
  };
}

function peekView(state: EconomyState, deployment: Deployment | null): EconomyView['intelPeek'] {
  if (deployment?.role !== 'intel' || deployment.peekShipId === null) {
    return null;
  }
  const ship = state.roundState.ships.find((s) => s.id === deployment.peekShipId);
  return { shipId: deployment.peekShipId, roll: ship === undefined ? null : (ship.rerolledRoll ?? ship.rawRoll) };
}
