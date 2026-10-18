import { describe, expect, it } from 'vitest';
import { PULSE, pulseFrame } from '../../src/ui-v07/scene/pulseMath';

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
