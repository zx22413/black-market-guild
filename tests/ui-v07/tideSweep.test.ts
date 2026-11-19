import { describe, expect, it } from 'vitest';
import { RULES_V07, RULES_V08_PROTO, getPlayerView, type IslandId, type PlayerView, type PublicEvents } from '../../src/v07/game';
import { sweptAtRoundEnd } from '../../src/ui-v07/table/tideSweep';
import { G, edit, start } from '../v07/game/helpers';

function viewOf(island: IslandId, darkTide: boolean, rules = RULES_V08_PROTO): PlayerView {
  const view = getPlayerView(edit(start(4, rules, { p1: island }), 'p1', {}), 'p1');
  return view.events === undefined ? view : { ...view, events: { ...view.events, darkTide } as PublicEvents };
}

describe('what 暗潮將至 will take from the warehouse (V0.8 prototype, not rules)', () => {
  const percent = RULES_V08_PROTO.v08.events.warehouseLossPercent;
  const share = (n: number) => Math.floor((n * percent) / 100);

  it('takes the rules share of each good left, rounded down', () => {
    expect(sweptAtRoundEnd(viewOf('mine', true), G(5, 3, 0, 1))).toEqual(G(share(5), share(3), 0, share(1)));
  });

  it('takes nothing in any other round, or without the event deck', () => {
    expect(sweptAtRoundEnd(viewOf('mine', false), G(5, 3, 0, 1))).toEqual(G(0));
    expect(sweptAtRoundEnd(viewOf('mine', true, RULES_V07), G(5, 3, 0, 1))).toEqual(G(0));
  });

  it('leaves out spice that spoils first, and counts the spice an island keeps', () => {
    expect(sweptAtRoundEnd(viewOf('mine', true), G(0, 0, 4, 0)).spice).toBe(0);
    expect(sweptAtRoundEnd(viewOf('spice-isles', true), G(0, 0, 4, 0)).spice).toBe(share(4));
  });

  it('takes less once goods are loaded', () => {
    expect(sweptAtRoundEnd(viewOf('mine', true), G(1)).wood).toBe(share(1));
    expect(sweptAtRoundEnd(viewOf('mine', true), G(-1)).wood).toBe(0);
  });
});
