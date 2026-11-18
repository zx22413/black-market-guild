import { describe, expect, it } from 'vitest';
import { SHIP_TYPE_IDS } from '../../src/v07/game';
import { BAY_COUNT, HULL_HALF_WIDTH, WORKS_SCRIPT, worksPose, worksSides } from '../../src/ui-v07/scene/ships/dockWorksShow';

// V0.8 prototype (not rules): the dock works' show.
describe('worksPose', () => {
  it('starts with everything under the water and the ship as it was', () => {
    const p = worksPose('build', 0);
    expect(p.piles).toEqual(Array(BAY_COUNT).fill(0));
    expect([p.frame, p.cloth, p.curtain, p.smoke, p.gold]).toEqual([0, 0, 0, 0, -1]);
    expect(p.swapped).toBe(false);
  });

  it('brings the piles up one bay after another', () => {
    const p = worksPose('build', 0.2);
    expect(p.piles[0]!).toBeGreaterThan(p.piles[1]!);
    expect(p.piles[1]!).toBeGreaterThan(p.piles[3]!);
  });

  it('changes the ship only behind the curtain and in the dust, in both shows', () => {
    for (const mode of ['build', 'launch'] as const) {
      const s = WORKS_SCRIPT[mode];
      expect(worksPose(mode, s.swap - 0.01).swapped).toBe(false);
      const at = worksPose(mode, s.swap);
      expect(at.swapped).toBe(true);
      expect(at.curtain).toBe(1);
      expect(at.smoke).toBe(1);
      expect(s.swap).toBeLessThan(s.unveil);
    }
  });

  it('drops the curtain and its poles in gold light, and leaves the staging standing open after a build', () => {
    const s = WORKS_SCRIPT.build;
    const mid = worksPose('build', s.unveil + 0.5);
    expect(mid.gold).toBeGreaterThan(0);
    const end = worksPose('build', s.end + 1);
    expect([end.curtain, end.poles[0], end.poles[1], end.gold, end.smoke]).toEqual([0, 0, 0, -1, 0]);
    expect([end.piles[0], end.frame, end.cloth]).toEqual([1, 1, 1]);
    expect(end.done).toBe(true);
  });

  it('strikes everything at the end of a launch, and at once in a strike', () => {
    const launch = worksPose('launch', WORKS_SCRIPT.launch.end + 0.5);
    expect([launch.piles[0], launch.frame, launch.cloth, launch.curtain]).toEqual([0, 0, 0, 0]);
    expect(launch.swapped).toBe(true);
    const open = worksPose('strike', 0);
    expect([open.piles[0], open.frame, open.cloth, open.curtain, open.smoke, open.gold]).toEqual([1, 1, 1, 0, 0, -1]);
    expect(worksPose('strike', 1).piles[0]).toBe(0);
  });

  it('throws a ring of spray where each pile breaks the water, coming up and going under', () => {
    const rising = worksPose('build', 0.2);
    expect(rising.splashes[0]!).toBeGreaterThan(0);
    // The last bay and the poles have not come up yet.
    expect(rising.splashes[5]).toBe(-1);
    expect(worksPose('build', 2.2).splashes.every((r) => r === -1)).toBe(true);
    // The curtain's poles go under right after the unveiling, the staging only when the works are struck.
    const after = worksPose('build', WORKS_SCRIPT.build.unveil + 0.4);
    expect(after.splashes[4]!).toBeGreaterThan(0);
    expect(after.splashes[0]).toBe(-1);
    expect(worksPose('strike', 0.2).splashes[0]!).toBeGreaterThan(0);
  });

  it('leaves the fallen curtain lying on the water for a while, then lets it sink', () => {
    const { unveil } = WORKS_SCRIPT.build;
    expect(worksPose('build', unveil - 0.1).heap).toBe(0);
    expect(worksPose('build', unveil + 0.8).heap).toBe(1);
    expect(worksPose('build', unveil + 3).heap).toBe(0);
    // Nothing was let go in a strike of works that already stand open.
    expect(worksPose('strike', 0.3).heap).toBe(0);
  });

  it('stands the two sides off every hull by the same gap', () => {
    for (const type of SHIP_TYPE_IDS) {
      const { staging, curtain } = worksSides(type);
      expect(staging - HULL_HALF_WIDTH[type]).toBeCloseTo(0.42);
      expect(-curtain - HULL_HALF_WIDTH[type]).toBeCloseTo(0.3);
    }
  });
});
