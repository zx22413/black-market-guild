import { describe, expect, it } from 'vitest';
import { isBlankFrame, summarizeFrames } from '../../src/ui-v07/perf/frameStats';
import { perfEnabled } from '../../src/ui-v07/perf/perfStore';

describe('summarizeFrames', () => {
  it('has nothing to say without frames', () => {
    expect(summarizeFrames([])).toBeNull();
  });

  it('reports fps, tail and hitches', () => {
    const steady = Array.from({ length: 19 }, () => 16);
    const s = summarizeFrames([...steady, 100])!;
    expect(s.worstMs).toBe(100);
    expect(s.hitches).toBe(1);
    expect(s.avgMs).toBeCloseTo((19 * 16 + 100) / 20);
    expect(s.fps).toBeCloseTo(1000 / s.avgMs);
    expect(s.p95Ms).toBe(100);
  });
});

describe('isBlankFrame', () => {
  const steady = Array.from({ length: 30 }, () => 560);
  it('flags a frame that drew a fraction of the usual', () => {
    expect(isBlankFrame(12, steady)).toBe(true);
  });
  it('lets ordinary variation through', () => {
    expect(isBlankFrame(330, steady)).toBe(false);
    expect(isBlankFrame(700, steady)).toBe(false);
  });
  it('has no opinion before it has seen enough frames, or on a scene that is small anyway', () => {
    expect(isBlankFrame(0, [560, 560])).toBe(false);
    expect(isBlankFrame(10, Array.from({ length: 30 }, () => 80))).toBe(false);
  });
});

describe('perfEnabled', () => {
  it('only opens with perf=1', () => {
    expect(perfEnabled('?perf=1')).toBe(true);
    expect(perfEnabled('?perf=0')).toBe(false);
    expect(perfEnabled('')).toBe(false);
  });
});
