import { describe, expect, it } from 'vitest';
import { summarizeFrames } from '../../src/ui-v07/perf/frameStats';
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

describe('perfEnabled', () => {
  it('only opens with perf=1', () => {
    expect(perfEnabled('?perf=1')).toBe(true);
    expect(perfEnabled('?perf=0')).toBe(false);
    expect(perfEnabled('')).toBe(false);
  });
});
