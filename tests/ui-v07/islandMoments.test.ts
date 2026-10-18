import { describe, expect, it } from 'vitest';
import { RULES_V07, type IslandId } from '../../src/v07/game';
import { launchMoments, openingMoments } from '../../src/ui-v07/table3d/islandMoments';

const all: Record<string, IslandId> = {
  a: 'lumber',
  b: 'mine',
  c: 'spice-isles',
  d: 'smuggler-port',
  e: 'free-port',
  f: 'fortress',
  g: 'lighthouse',
  h: 'pirate-cove',
};
const none = (_id: string): number => 0;
const chipsOf = (round: number, carried = none) =>
  Object.fromEntries(openingMoments(all, round, RULES_V07, carried).map((m) => [m.playerId, m.chips.map((c) => `${c.good}:${c.text}:${c.tone}`)]));

describe('island moments', () => {
  it('pulses at the round start only for production that differs from an ordinary island', () => {
    // Round 1: everyone makes one of each; only the spice isles' extra spice stands out.
    expect(chipsOf(1)).toEqual({ c: ['spice:+1:gain'] });
    // Round 2: the lumber camp's wood, the mine's iron, the spice and the smugglers' arms.
    expect(chipsOf(2)).toEqual({ a: ['wood:+1:gain'], b: ['iron:+1:gain'], c: ['spice:+1:gain'], d: ['arms:+1:gain'] });
    // Round 3: an ordinary island makes iron and wood; the lumber camp has no iron, the mine no wood.
    expect(chipsOf(3)).toEqual({ a: ['iron:沒產:loss'], b: ['wood:沒產:loss'], c: ['spice:+1:gain'] });
    // Round 6: no wood or iron for anyone; the camp and the mine have nothing to show.
    expect(chipsOf(6).a).toBeUndefined();
    expect(chipsOf(6).b).toBeUndefined();
  });

  it('shows the spice kept over only for the island that keeps it', () => {
    const carried = (id: string) => (id === 'c' || id === 'a' ? 2 : 0);
    expect(chipsOf(2, carried).c).toEqual(['spice:+1:gain', 'spice:保住 2:gain']);
    expect(chipsOf(2, carried).a).toEqual(['wood:+1:gain']);
  });

  it('greys an island whose moment only costs it', () => {
    const tones = Object.fromEntries(openingMoments(all, 3, RULES_V07, none).map((m) => [m.playerId, m.tone]));
    expect(tones).toEqual({ a: 'loss', b: 'loss', c: 'gain' });
  });

  it('pulses at the launch for a cheaper or dearer ship and a smaller hold, for those who launched', () => {
    const launch = Object.fromEntries(launchMoments(all, ['e', 'g', 'a'], RULES_V07).map((m) => [m.playerId, m.chips.map((c) => `${c.text}:${c.tone}`)]));
    expect(launch).toEqual({ e: ['出航 50 G:gain', '可裝 −1:loss'], g: ['出航 150 G:loss'] });
    expect(launchMoments(all, ['f'], RULES_V07)).toEqual([]);
  });
});
