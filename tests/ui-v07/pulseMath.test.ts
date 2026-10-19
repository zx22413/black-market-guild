import { describe, expect, it } from 'vitest';
import { DUST, PULSE, dustMote, pulseFrame } from '../../src/ui-v07/scene/pulseMath';

describe('island pulse', () => {
  it('rests before and after, squashes, hops and lands back on its spot', () => {
    expect(pulseFrame(-1)).toEqual({ hop: 0, wide: 1, tall: 1, ring: 1, glow: 0 });
    const squashed = pulseFrame(PULSE.squash * 0.9);
    expect(squashed.tall).toBeLessThan(1);
    expect(squashed.wide).toBeGreaterThan(1);
    expect(pulseFrame(PULSE.squash + PULSE.hop / 2).hop).toBeGreaterThan(1);
    const after = pulseFrame(PULSE.squash + PULSE.hop + PULSE.settle + 0.01);
    expect([after.hop, after.wide, after.tall]).toEqual([0, 1, 1]);
    expect(pulseFrame(PULSE.glow + 0.01).glow).toBe(0);
  });

  it('glows from the start and fades by the end', () => {
    expect(pulseFrame(PULSE.glow * 0.15).glow).toBeCloseTo(1);
    expect(pulseFrame(PULSE.glow * 0.9).glow).toBeLessThan(0.2);
  });
});

describe('gold dust over an island', () => {
  it('rises from all over the island while the glow lasts, the same way every time', () => {
    const r = 13;
    let seen = 0;
    for (let i = 0; i < DUST.motes; i++) {
      expect(dustMote(i, -0.01, r)).toBeNull();
      const m = dustMote(i, PULSE.glow * 0.6, r);
      if (m) {
        seen++;
        expect(Math.hypot(m.x, m.z)).toBeLessThanOrEqual(r * DUST.spread);
        expect(m.opacity).toBeGreaterThanOrEqual(0);
        expect(dustMote(i, PULSE.glow * 0.6, r)).toEqual(m);
      }
      expect(dustMote(i, PULSE.glow * 0.6 + DUST.life.max + 0.01, r)).toBeNull();
    }
    expect(seen).toBeGreaterThan(DUST.motes / 4);
  });
});
