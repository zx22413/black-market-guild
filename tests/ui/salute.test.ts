import { describe, expect, it } from 'vitest';
import type { LandmarkDesign } from '../../src/ui/scene/buildings/islands/design';
import { flashLevel, GUN_KICK, gunMotion, puffState, shotAge, SHOT } from '../../src/ui/scene/buildings/islands/salute';
import { LANDMARK_DESIGNS } from '../../src/ui/scene/buildings/landmarks';

const salute = (LANDMARK_DESIGNS['star-fort'] as LandmarkDesign).salute!;

describe('star fort salute', () => {
  it('fires every bastion gun in turn, then falls quiet until the next salute', () => {
    expect(salute.guns).toHaveLength(5);
    salute.guns.forEach((_, g) => {
      expect(shotAge(salute, g, g * salute.gap)).toBeCloseTo(0);
      expect(shotAge(salute, g, g * salute.gap + salute.every)).toBeCloseTo(0);
    });
    // The last gun's smoke is gone well before the first gun fires again.
    expect((salute.guns.length - 1) * salute.gap + SHOT.life).toBeLessThan(salute.every);
    expect(shotAge(salute, 0, SHOT.life + 0.1)).toBeNull();
  });

  it('points every gun level and outward from the fort', () => {
    for (const { at, toward } of salute.guns) {
      expect(Math.hypot(...toward)).toBeCloseTo(1);
      expect(toward[1]).toBe(0);
      expect(at[0] * toward[0] + at[2] * toward[2]).toBeGreaterThan(0);
    }
  });

  it('flares at the muzzle, holds a moment and dies away', () => {
    expect(flashLevel(0)).toBe(1);
    expect(flashLevel(SHOT.flash * 0.2)).toBe(1);
    expect(flashLevel(SHOT.flash * 0.7)).toBeGreaterThan(0);
    expect(flashLevel(SHOT.flash * 0.7)).toBeLessThan(1);
    expect(flashLevel(SHOT.flash)).toBe(0);
  });

  it('squashes the gun before it fires, springs it out long as it fires and kicks it back, then rests', () => {
    const fires = 2 * salute.gap + salute.every;
    const before = gunMotion(salute, 2, fires - 0.01);
    expect(before.along).toBeLessThan(0.8);
    expect(before.across).toBeGreaterThan(1.1);
    expect(before.recoil).toBe(0);
    const shot = gunMotion(salute, 2, fires + 0.005);
    expect(shot.along).toBeGreaterThan(1.3);
    expect(shot.across).toBeLessThan(0.85);
    expect(gunMotion(salute, 2, fires + 0.08).recoil).toBeCloseTo(GUN_KICK.recoil);
    expect(gunMotion(salute, 2, fires + GUN_KICK.settle + 0.1)).toEqual({ along: 1, across: 1, recoil: 0 });
    // Between salutes it stands still.
    expect(gunMotion(salute, 2, fires + salute.every / 2)).toEqual({ along: 1, across: 1, recoil: 0 });
  });

  it('throws its smoke out along the gun, swelling, rising and thinning away to nothing', () => {
    for (let j = 0; j < SHOT.puffs; j++) {
      const [early, late] = [puffState(j, 0.1), puffState(j, SHOT.life * 0.8)];
      expect(late.out).toBeGreaterThan(early.out);
      expect(late.up).toBeGreaterThan(early.up);
      expect(late.radius).toBeGreaterThan(early.radius);
      expect(late.opacity).toBeLessThan(early.opacity);
      expect(puffState(j, SHOT.life).opacity).toBeCloseTo(0);
    }
  });
});
