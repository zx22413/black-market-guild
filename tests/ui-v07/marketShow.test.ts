import { describe, expect, it } from 'vitest';
import type { Goods, MatchEvent, PlayerId, ShipId } from '../../src/v07/game';
import { GOOD_COLORS } from '../../src/ui-v07/scene/CrateModel';
import { cargoCrates, marketShow } from '../../src/ui-v07/scene/marketShow';

const PRICES: Goods = { wood: 2, iron: 2, spice: 3, arms: 3 };
const A = 'a' as PlayerId;
const SHIP = 's1' as ShipId;
const cargo: Goods = { wood: 2, iron: 0, spice: 1, arms: 0 };
const started: MatchEvent = { type: 'round-started', round: 1 };
const resolved: MatchEvent = { type: 'ship-resolved', round: 1, shipId: SHIP, outcome: 'arrived', cargo };
const show = (events: readonly MatchEvent[], extra: Partial<Parameters<typeof marketShow>[0]> = {}) =>
  marketShow({ events, prices: PRICES, weather: null, arrived: [], ...extra });

describe('market island show', () => {
  it('opens the stalls when a round starts and shuts them when it ends', () => {
    expect(show([]).awnings).toBe('open');
    expect(show([started]).awnings).toBe('open');
    expect(show([started, { type: 'round-ended', round: 1 }]).awnings).toBe('shut');
    expect(show([started, { type: 'round-ended', round: 1 }, { type: 'round-started', round: 2 }]).awnings).toBe('open');
  });

  it('reefs the awnings in a storm and lights the lanterns on a moonless night', () => {
    expect(show([started], { weather: 'storm' }).awnings).toBe('reefed');
    expect(show([started], { weather: 'moonless-night' }).lanterns).toBe('night');
    expect(show([started], { weather: 'tailwind' }).lanterns).toBe('off');
  });

  it('fills the market for a black market rush: crowds, every lantern lit in daylight', () => {
    const rush = show([started], { weather: 'black-market-rush' });
    expect(rush.rush).toBe(true);
    expect(rush.lanterns).toBe('festive');
    expect(rush.awnings).toBe('open');
    expect(show([started]).rush).toBe(false);
  });

  it('sends porters only once an arrived ship has shown its cargo, one crate per unit', () => {
    const arrived = [{ shipId: SHIP, owner: A, angle: 1 }];
    expect(show([started], { arrived }).deliveries).toEqual([]);
    expect(show([started, resolved], { arrived }).deliveries).toEqual([{ key: '1-s1', angle: 1, crates: [GOOD_COLORS.wood, GOOD_COLORS.wood, GOOD_COLORS.spice] }]);
    expect(show([started, { ...resolved, outcome: 'sank' }], { arrived }).deliveries).toEqual([]);
  });

  it('shows the prices on the board in goods order and rings the bell on a new round or a price move', () => {
    const a = show([started]);
    expect(a.prices).toEqual([2, 2, 3, 3]);
    expect(show([started], { prices: { ...PRICES, spice: 4 } }).bellKey).not.toBe(a.bellKey);
    expect(show([started, { type: 'round-started', round: 2 }]).bellKey).not.toBe(a.bellKey);
    expect(show([started]).bellKey).toBe(a.bellKey);
  });

  it('lists crate colors in the goods order', () => {
    expect(cargoCrates({ wood: 0, iron: 1, spice: 0, arms: 2 })).toEqual([GOOD_COLORS.iron, GOOD_COLORS.arms, GOOD_COLORS.arms]);
  });
});
