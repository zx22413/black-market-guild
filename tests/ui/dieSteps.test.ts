import { describe, expect, it } from 'vitest';
import { dieSteps } from '../../src/ui/scene/dieSteps';

const modifier = { shipId: 'r1-s1', base: 5, guard: 1, pirate: -1, event: -2, final: 3 };

describe('die animation steps', () => {
  it('walks the public starting roll through each modifier', () => {
    expect(dieSteps(modifier, false, null)).toEqual([
      { value: 5, label: '起始' },
      { value: 6, label: '護衛 +1' },
      { value: 5, label: '海盜 −1' },
      { value: 3, label: '事件 −2' },
    ]);
  });

  it('skips zero steps and shows the clamp when it changes the value', () => {
    expect(dieSteps({ shipId: 's', base: 2, guard: 0, pirate: -2, event: -1, final: 1 }, true, null)).toEqual([
      { value: 2, label: '重擲後' },
      { value: 0, label: '海盜 −2' },
      { value: -1, label: '事件 −1' },
      { value: 1, label: '骰值上下限' },
    ]);
  });

  it('shows the original roll only to the intel merchant who rerolled', () => {
    const steps = dieSteps({ shipId: 's', base: 5, guard: 0, pirate: 0, event: 0, final: 5 }, true, { raw: 1, rerolled: 5 });
    expect(steps).toEqual([
      { value: 1, label: '原始（僅你知道）' },
      { value: 5, label: '重擲' },
    ]);
    // An intel merchant who kept the roll sees nothing extra: the public start is that roll.
    expect(dieSteps({ shipId: 's', base: 4, guard: 0, pirate: 0, event: 0, final: 4 }, false, { raw: 4, rerolled: null })).toEqual([
      { value: 4, label: '起始' },
    ]);
  });
});
