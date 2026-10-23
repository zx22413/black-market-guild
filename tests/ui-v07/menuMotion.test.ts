import { describe, expect, it } from 'vitest';
import { MENU_FLIP_EVERY, ORBIT, SHUTTLE, menuArrivals, menuPrices, orbitPosition, orbitTarget, shuttle } from '../../src/ui-v07/menu/menuMotion';

describe('main menu camera orbit', () => {
  it('circles the market island at a fixed height and distance', () => {
    for (const time of [0, 7.5, 30, 1000]) {
      const [x, y, z] = orbitPosition(time);
      expect(y).toBe(ORBIT.height);
      expect(Math.hypot(x, z)).toBeCloseTo(ORBIT.radius);
    }
  });

  it('takes one full period to come back around', () => {
    const start = orbitPosition(0);
    orbitPosition(ORBIT.period).forEach((v, i) => expect(v).toBeCloseTo(start[i]!));
    expect(orbitPosition(ORBIT.period / 2)[2]).toBeCloseTo(-start[2]!);
  });

  it('starts in front of the table, where the game camera looks from', () => {
    const [x, , z] = orbitPosition(0);
    expect(x).toBeCloseTo(0);
    expect(z).toBeGreaterThan(0);
  });
});

describe('main menu camera aim', () => {
  it('looks straight at the market island without a shift', () => {
    orbitTarget(12, 0, 0).forEach((v) => expect(v).toBeCloseTo(0));
  });

  it('aims left of the island to show it on the right, and nearer the camera to show it higher', () => {
    // At time 0 the camera is in front (+z) looking toward -z: its right is +x.
    const [lx, , lz] = orbitTarget(0, 10, 0);
    expect(lx).toBeCloseTo(-10);
    expect(lz).toBeCloseTo(0);
    const [ux, , uz] = orbitTarget(0, 0, 10);
    expect(ux).toBeCloseTo(0);
    expect(uz).toBeCloseTo(10);
  });

  it('keeps the shift the same size all the way around', () => {
    for (const time of [0, 20, 75, 140]) {
      const [x, , z] = orbitTarget(time, 30, 40);
      expect(Math.hypot(x, z)).toBeCloseTo(50);
    }
  });
});

describe('main menu ship shuttle', () => {
  it('sails out to the market, waits there, sails home and waits at the dock', () => {
    const { sail, wait } = SHUTTLE;
    expect(shuttle(0, 0)).toEqual({ t: 0, outbound: true });
    expect(shuttle(sail / 2, 0).t).toBeCloseTo(0.5);
    expect(shuttle(sail / 2, 0).outbound).toBe(true);
    expect(shuttle(sail + wait / 2, 0)).toEqual({ t: 1, outbound: true });
    expect(shuttle(sail + wait + sail / 2, 0)).toMatchObject({ outbound: false });
    expect(shuttle(sail + wait + sail / 2, 0).t).toBeCloseTo(0.5);
    expect(shuttle(2 * sail + wait + wait / 2, 0)).toEqual({ t: 0, outbound: false });
  });

  it('repeats every round trip and stays on the lane', () => {
    const trip = 2 * (SHUTTLE.sail + SHUTTLE.wait);
    for (const time of [0.3, 4, 11, 19]) {
      expect(shuttle(time + trip, 0).t).toBeCloseTo(shuttle(time, 0).t);
      const { t } = shuttle(time, 0.37);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });

  it('eases in and out, so ships slow down at both ends', () => {
    const step = 0.05;
    const near = shuttle(step, 0).t - shuttle(0, 0).t;
    const mid = shuttle(SHUTTLE.sail / 2 + step, 0).t - shuttle(SHUTTLE.sail / 2, 0).t;
    expect(near).toBeLessThan(mid);
  });

  it('spreads ships out with their offsets', () => {
    expect(shuttle(1, 0).t).not.toBeCloseTo(shuttle(1, 0.5).t);
  });
});

describe('main menu market', () => {
  it('starts the board at the opening cells and moves one row a cell at each flip, on the track', () => {
    expect(menuPrices(0)).toEqual([2, 2, 3, 3]);
    let last = menuPrices(0);
    for (let k = 1; k < 60; k++) {
      const now = menuPrices(k * MENU_FLIP_EVERY);
      now.forEach((c) => expect(c >= 0 && c <= 6).toBe(true));
      const moved = now.reduce((n, c, i) => n + Math.abs(c - last[i]!), 0);
      expect(moved).toBe(1);
      last = now;
    }
  });

  it('counts a ship as at the market while it waits there, a new trip each time', () => {
    const at = SHUTTLE.sail + 1;
    expect(menuArrivals(at, [0])).toEqual([{ ship: 0, trip: 0 }]);
    expect(menuArrivals(1, [0])).toEqual([]);
    expect(menuArrivals(at + 2 * (SHUTTLE.sail + SHUTTLE.wait), [0])).toEqual([{ ship: 0, trip: 1 }]);
  });
});
