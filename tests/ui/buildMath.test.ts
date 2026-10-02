import { describe, expect, it } from 'vitest';
import {
  BUILD_SECONDS,
  RISE_SECONDS,
  SPARK_KINDS,
  buildSparks,
  completionFlash,
  groundRing,
  riseScale,
  sparkProgress,
} from '../../src/ui/scene/buildMath';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('building completion effect', () => {
  it('rises from a thin slab to full height and settles', () => {
    expect(riseScale(0)).toBeGreaterThan(0);
    expect(riseScale(0)).toBeLessThan(0.1);
    expect(riseScale(RISE_SECONDS)).toBeCloseTo(1, 5);
    expect(riseScale(BUILD_SECONDS)).toBeCloseTo(1, 5);
  });

  it('overshoots a little before settling and never shrinks backwards early', () => {
    const samples = Array.from({ length: 30 }, (_, i) => riseScale((i / 29) * RISE_SECONDS));
    expect(Math.max(...samples)).toBeGreaterThan(1);
    expect(Math.max(...samples)).toBeLessThan(1.2);
    expect(riseScale(RISE_SECONDS * 0.3)).toBeGreaterThan(riseScale(RISE_SECONDS * 0.1));
  });

  it('flashes only once complete, then fades out', () => {
    expect(completionFlash(RISE_SECONDS * 0.5)).toBe(0);
    expect(completionFlash(RISE_SECONDS)).toBe(1);
    expect(completionFlash(RISE_SECONDS + 0.4)).toBeGreaterThan(0);
    expect(completionFlash(BUILD_SECONDS)).toBe(0);
  });

  it('sends a shockwave ring outward that fades away', () => {
    const early = groundRing(RISE_SECONDS + 0.1);
    const late = groundRing(RISE_SECONDS + 0.9);
    expect(late.radius).toBeGreaterThan(early.radius);
    expect(late.opacity).toBeLessThan(early.opacity);
    expect(groundRing(BUILD_SECONDS + 1).opacity).toBe(0);
  });

  it('trails sparks while rising and bursts more when finished', () => {
    const sparks = buildSparks(seeded(5));
    expect(sparks.filter((s) => s.delay < RISE_SECONDS - 0.2).length).toBeGreaterThan(5);
    expect(sparks.filter((s) => s.delay >= RISE_SECONDS).length).toBeGreaterThan(10);
    for (const s of sparks) {
      expect(s.kind).toBeLessThan(SPARK_KINDS);
      expect(s.delay + s.life).toBeLessThanOrEqual(BUILD_SECONDS + 0.01);
    }
  });

  it('reports spark progress only while it is alive', () => {
    const [spark] = buildSparks(seeded(9));
    expect(sparkProgress(spark!, spark!.delay - 0.01)).toBeNull();
    expect(sparkProgress(spark!, spark!.delay + spark!.life / 2)).toBeCloseTo(0.5, 5);
    expect(sparkProgress(spark!, spark!.delay + spark!.life + 0.01)).toBeNull();
  });
});
