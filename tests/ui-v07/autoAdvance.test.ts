import { describe, expect, it } from 'vitest';
import { RESOLUTION_AUTO_SECONDS, countdownLabel } from '../../src/ui-v07/table3d/useAutoAdvance';

describe('online resolution auto-advance', () => {
  it('waits twenty seconds before going on', () => {
    expect(RESOLUTION_AUTO_SECONDS).toBe(20);
  });

  it('adds the seconds left to a button label only while counting down', () => {
    expect(countdownLabel('開始航程', null)).toBe('開始航程');
    expect(countdownLabel('開始航程', 12)).toBe('開始航程（12）');
  });
});
