import { GOODS, traitOf, type GoodId, type Goods, type PlayerView } from '../../v07/game';

// V0.8 prototype (rules.v08.events, an experiment, not rules): what 「暗潮將至」 will take from the viewer's warehouse
// at the end of this round, shown while there is still time to load it. It follows the engine's own order (the spice
// spoils first, then the tide takes its share of each good that is left, rounded down) and reads the share from `rules`.
// Only an estimate of the goods kept back now: goods that reach the warehouse later in the round are not in it.

const NONE: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };

/** Units of each good the tide takes at the end of this round if `left` stays in the warehouse (all zeros in any other round). */
export function sweptAtRoundEnd(view: PlayerView, left: Goods): Goods {
  if (view.events?.darkTide !== true) return NONE;
  const percent = view.rules.v08.events.warehouseLossPercent;
  const me = view.players.find((p) => p.id === view.playerId);
  // Spice that spoils is gone before the tide comes: the spoiling warning already says so.
  const spoils = traitOf(view.rules, me?.island ?? null).keepsSpice !== 1;
  return Object.fromEntries(GOODS.map((g: GoodId) => [g, g === 'spice' && spoils ? 0 : Math.floor((Math.max(0, left[g]) * percent) / 100)])) as Goods;
}
