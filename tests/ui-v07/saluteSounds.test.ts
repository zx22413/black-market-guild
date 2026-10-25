import { describe, expect, it } from 'vitest';
import { saluteSounds } from '../../src/ui-v07/audio/saluteSounds';
import { BARRAGE, SHOTS, landsAt } from '../../src/ui-v07/scene/islandForceMath';

describe("sound of the fortress's salute", () => {
  const sounds = saluteSounds();
  const of = (id: string) => sounds.filter((s) => s.id === id);

  it('pops once as each gun fires', () => {
    expect(of('salute-pop').map((s) => s.at)).toEqual(Array.from({ length: SHOTS }, (_, i) => BARRAGE.first + i * BARRAGE.gap));
  });

  it('splashes as each flare comes down, then dings a little after', () => {
    expect(of('salute-splash').map((s) => s.at)).toEqual(Array.from({ length: SHOTS }, (_, i) => landsAt(i)));
    of('salute-ding').forEach((s, i) => expect(s.at).toBeGreaterThan(landsAt(i)));
  });

  it('rings every ding higher than the one before', () => {
    const rates = of('salute-ding').map((s) => s.rate);
    expect(rates[0]).toBe(1);
    rates.slice(1).forEach((r, i) => expect(r).toBeGreaterThan(rates[i]!));
  });

  it('comes in time order', () => {
    sounds.slice(1).forEach((s, i) => expect(s.at).toBeGreaterThanOrEqual(sounds[i]!.at));
  });
});
