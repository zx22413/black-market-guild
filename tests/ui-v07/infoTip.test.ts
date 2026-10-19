import { describe, expect, it } from 'vitest';
import { tipPlacement } from '../../src/ui-v07/table3d/InfoTip';

const screen = { width: 1200, height: 800 };
const tip = { width: 240, height: 120 };

describe('icon tip placement', () => {
  it('sits above the icon, centred on it, when there is room', () => {
    const p = tipPlacement({ left: 590, top: 400, bottom: 420, width: 20 }, tip, screen, 60);
    expect(p).toEqual({ left: 480, top: 400 - 8 - 120, below: false });
  });

  it('opens below the icon when the market strip at the top leaves no room above', () => {
    const p = tipPlacement({ left: 590, top: 120, bottom: 140, width: 20 }, tip, screen, 60);
    expect(p.below).toBe(true);
    expect(p.top).toBe(148);
  });

  it('stays on screen at the edges', () => {
    expect(tipPlacement({ left: 2, top: 400, bottom: 420, width: 20 }, tip, screen, 0).left).toBe(8);
    expect(tipPlacement({ left: 1190, top: 400, bottom: 420, width: 20 }, tip, screen, 0).left).toBe(1200 - 240 - 8);
  });
});
