import { describe, expect, it } from 'vitest';
import { clampPin } from '../../src/ui-v07/scene/focusMath';

describe('clamped table labels', () => {
  it('leaves a label that fits where it is', () => {
    expect(clampPin(400, 300, 200, 100, 800, 600)).toEqual([400, 300]);
  });

  it('pushes a label in from the edge it would run past', () => {
    // Hung bottom-center: a 460 px card at x = 700 on an 800 px screen would end at 930.
    expect(clampPin(700, 300, 460, 200, 800, 600)).toEqual([800 - 230 - 8, 300]);
    expect(clampPin(50, 300, 200, 100, 800, 600)).toEqual([108, 300]);
    expect(clampPin(400, 50, 200, 100, 800, 600)).toEqual([400, 108]);
    expect(clampPin(400, 700, 200, 100, 800, 600)).toEqual([400, 592]);
  });

  it('centers a label wider than the screen', () => {
    expect(clampPin(100, 300, 900, 100, 800, 600)[0]).toBe(400);
  });
});
