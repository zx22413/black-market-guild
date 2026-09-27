import { chain, changeCash } from '../cash';
import type { MatchState, Purchase, Step } from '../types';

/**
 * Announces this round's purchases, then charges them; assets take effect this round
 * (game-design.md §8 資產取得規則).
 */
export function resolvePurchases(state: MatchState): Step {
  const { submissions } = state.roundState;
  const purchases: Purchase[] = state.players.flatMap(({ id }) => {
    const action = submissions[id];
    return action?.type === 'buy-asset' && action.asset !== null ? [{ playerId: id, asset: action.asset }] : [];
  });
  const owned: MatchState = {
    ...state,
    players: state.players.map((p) => {
      const bought = purchases.find((purchase) => purchase.playerId === p.id);
      return bought ? { ...p, assets: [...p.assets, bought.asset] } : p;
    }),
  };
  const charged = chain(
    owned,
    purchases.map((purchase) => (current: MatchState) =>
      changeCash(current, purchase.playerId, -current.rules.assets[purchase.asset].price, 'asset-purchase', null),
    ),
  );
  return {
    state: charged.state,
    events: [{ type: 'assets-purchased', round: state.round, purchases }, ...charged.events],
  };
}
