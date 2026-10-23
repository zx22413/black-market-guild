import { describe, expect, it } from 'vitest';
import { seatAngles, seatPosition } from '../../src/ui/scene/layout';
import { LAUNCH, aimOff, glide, launchProgress, menuShot, type MenuShotContext } from '../../src/ui-v07/menu/menuShots';
import { orbitPosition } from '../../src/ui-v07/menu/menuMotion';

const angles = seatAngles(4);
const ctx: MenuShotContext = { angles, yours: 0, guide: 3, launchElapsed: 0 };
const flat = ([x, , z]: readonly number[]) => Math.hypot(x!, z!);
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('menu camera stops', () => {
  it('circles the market on the title screen', () => {
    const shot = menuShot('title', 12, ctx);
    expect(shot.position).toEqual(orbitPosition(12));
    expect(shot.target).toEqual([0, 0, 0]);
  });

  it('frames your island from behind it for single player, and the lighthouse for the tutorial', () => {
    for (const [stage, seat] of [['local', 0], ['tutorial', 3]] as const) {
      const shot = menuShot(stage, 5, ctx);
      const island = seatPosition(angles[seat]!);
      expect(dist(shot.target, island)).toBeLessThan(10);
      expect(flat(shot.position)).toBeGreaterThan(flat(island));
      expect(dist(shot.position, island)).toBeLessThan(dist(menuShot('title', 5, ctx).position, [0, 0, 0]));
    }
  });

  it('pulls up to an overview of every lane for the online pages', () => {
    for (const stage of ['online', 'lobby'] as const) {
      const shot = menuShot(stage, 3, ctx);
      expect(shot.position[1]).toBeGreaterThan(orbitPosition(3)[1]);
      expect(flat(shot.target)).toBeLessThan(15);
    }
  });

  it('follows your ship from its dock toward the market at the launch', () => {
    const start = menuShot('launch', 0, { ...ctx, launchElapsed: 0 });
    const end = menuShot('launch', 0, { ...ctx, launchElapsed: LAUNCH.sail });
    expect(flat(end.target)).toBeLessThan(flat(start.target));
    expect(flat(end.position)).toBeLessThan(flat(start.position));
  });
});

describe('launch timing', () => {
  it('runs from the dock (0) to the berth (1), easing at both ends, and stays there', () => {
    expect(launchProgress(0)).toBe(0);
    expect(launchProgress(LAUNCH.sail)).toBe(1);
    expect(launchProgress(LAUNCH.sail + 5)).toBe(1);
    expect(launchProgress(-1)).toBe(0);
    const early = launchProgress(0.1) - launchProgress(0);
    const mid = launchProgress(LAUNCH.sail / 2 + 0.1) - launchProgress(LAUNCH.sail / 2);
    expect(early).toBeLessThan(mid);
  });
});

describe('camera glide and aim', () => {
  it('moves part of the way each frame, more on a longer frame, and arrives', () => {
    const short = glide(0, 10, 1 / 60);
    const long = glide(0, 10, 1 / 20);
    expect(short).toBeGreaterThan(0);
    expect(long).toBeGreaterThan(short);
    let at = 0;
    for (let i = 0; i < 180; i++) at = glide(at, 10, 1 / 60);
    expect(at).toBeCloseTo(10, 1);
  });

  it('leaves the target alone without a shift, and shifts it in proportion to the distance', () => {
    expect(aimOff([0, 50, 100], [0, 0, 0], 0, 0)).toEqual([0, 0, 0]);
    // Camera in front (+z) looking toward -z: its right is +x, so looking left (-x) shows the target on the right.
    const [x, , z] = aimOff([0, 0, 100], [0, 0, 0], 0.2, 0);
    expect(x).toBeCloseTo(-20);
    expect(z).toBeCloseTo(0);
    // Looking nearer the camera shows the target higher.
    expect(aimOff([0, 0, 100], [0, 0, 0], 0, 0.3)[2]).toBeCloseTo(30);
  });
});
