import { describe, expect, it } from 'vitest';
import { FAST_MS, GOOD_WINDOWS, MAX_FLIPS, SLOW_MS, isPhone, judgeWindow, phoneDprLevels, startState } from '../../src/ui-v07/perf/dprPolicy';

const LEVELS = phoneDprLevels(3);

describe('phoneDprLevels', () => {
  it('stops at 1.5 and never exceeds the screen', () => {
    expect(LEVELS).toEqual([1, 1.25, 1.5]);
    expect(phoneDprLevels(1.25)).toEqual([1, 1.25]);
    expect(phoneDprLevels(0.5)).toEqual([1]);
  });
});

describe('isPhone', () => {
  it('needs touch and a small short side', () => {
    expect(isPhone(true, 440)).toBe(true);
    expect(isPhone(true, 1024)).toBe(false);
    expect(isPhone(false, 440)).toBe(false);
  });
});

describe('judgeWindow', () => {
  it('starts at the sharpest level', () => {
    expect(startState(LEVELS).level).toBe(2);
  });

  it('steps down on a slow window and stops at the bottom', () => {
    let s = startState(LEVELS);
    s = judgeWindow(s, SLOW_MS + 1, LEVELS);
    expect(s.level).toBe(1);
    s = judgeWindow(judgeWindow(s, SLOW_MS + 1, LEVELS), SLOW_MS + 1, LEVELS);
    expect(s.level).toBe(0);
  });

  it('steps up only after enough good windows in a row', () => {
    let s = judgeWindow(startState(LEVELS), 40, LEVELS);
    for (let i = 0; i < GOOD_WINDOWS - 1; i++) s = judgeWindow(s, FAST_MS, LEVELS);
    expect(s.level).toBe(1);
    s = judgeWindow(s, 20, LEVELS); // a middling window breaks the streak
    for (let i = 0; i < GOOD_WINDOWS - 1; i++) s = judgeWindow(s, FAST_MS, LEVELS);
    expect(s.level).toBe(1);
    s = judgeWindow(s, FAST_MS, LEVELS);
    expect(s.level).toBe(2);
  });

  it('gives up climbing after steps up keep being undone', () => {
    let s = judgeWindow(startState(LEVELS), 40, LEVELS);
    for (let round = 0; round < MAX_FLIPS; round++) {
      for (let i = 0; i < GOOD_WINDOWS; i++) s = judgeWindow(s, FAST_MS, LEVELS);
      expect(s.level).toBe(2);
      s = judgeWindow(s, 40, LEVELS);
      expect(s.level).toBe(1);
    }
    expect(s.flips).toBe(MAX_FLIPS);
    for (let i = 0; i < GOOD_WINDOWS * 2; i++) s = judgeWindow(s, FAST_MS, LEVELS);
    expect(s.level).toBe(1);
  });
});
