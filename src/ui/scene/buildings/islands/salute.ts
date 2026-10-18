import type { LandmarkSalute } from './design';

// A fort's salute as pure math: when each gun fires, and how its flash and smoke burst grow and fade.
// Shared by the fort's design, the table's animation (`LandmarkSalute.tsx`) and the tests.

/** How long a shot's smoke hangs in the air, and how many balls of smoke each shot throws. */
export const SHOT = { life: 4.2, puffs: 7, flash: 0.26 } as const;

/** Seconds since gun `gun` last fired at `seconds` on the table clock, or null once its smoke is gone. */
export function shotAge(salute: LandmarkSalute, gun: number, seconds: number): number | null {
  const age = (((seconds - gun * salute.gap) % salute.every) + salute.every) % salute.every;
  return age < SHOT.life ? age : null;
}

/** How bright a shot's muzzle flash is `age` seconds after it fires: a flare that holds a moment, then dies away. */
export function flashLevel(age: number): number {
  if (age < 0 || age >= SHOT.flash) return 0;
  const k = age / SHOT.flash;
  return k < 0.3 ? 1 : 1 - ((k - 0.3) / 0.7) ** 1.5;
}

/**
 * The gun's cartoon shot: it squashes down (shorter, fatter) as if drawing breath, springs out long and
 * thin as it fires, wobbles back to shape, and is kicked back along its barrel by the recoil, rolling
 * forward to its place again. `along` and `across` scale it along and across the barrel; `recoil` is
 * how far back it has been driven (design units at a shot of size 1).
 */
export interface GunMotion {
  readonly along: number;
  readonly across: number;
  readonly recoil: number;
}

/** How long before firing the gun squashes, how far, how hard it springs out and how far it kicks back. */
export const GUN_KICK = { windup: 0.4, squash: 0.28, stretch: 0.45, recoil: 0.16, settle: 1.4 } as const;

const AT_REST: GunMotion = { along: 1, across: 1, recoil: 0 };

/** Gun `gun`'s squash, stretch and recoil at `seconds` on the table clock. */
export function gunMotion(salute: LandmarkSalute, gun: number, seconds: number): GunMotion {
  const phase = (((seconds - gun * salute.gap) % salute.every) + salute.every) % salute.every;
  // Just before it fires, the end of the cycle counts as a moment before the shot.
  const age = phase > salute.every - GUN_KICK.windup ? phase - salute.every : phase;
  if (age < 0) {
    const s = 1 - Math.cos(((age + GUN_KICK.windup) / GUN_KICK.windup) * (Math.PI / 2));
    return { along: 1 - GUN_KICK.squash * s, across: 1 + GUN_KICK.squash * 0.7 * s, recoil: 0 };
  }
  if (age > GUN_KICK.settle) return AT_REST;
  // A damped spring from fully stretched back to rest, a couple of wobbles.
  const spring = Math.exp(-age * 6) * Math.cos(age * 22);
  // Driven back in a tenth of a second, then rolled forward to rest.
  const recoil = age < 0.08 ? age / 0.08 : Math.max(0, 1 - (age - 0.08) / (GUN_KICK.settle - 0.08)) ** 2;
  return { along: 1 + GUN_KICK.stretch * spring, across: 1 - GUN_KICK.stretch * 0.5 * spring, recoil: GUN_KICK.recoil * recoil };
}

/** Puff `j` of a shot, `age` seconds in, at a shot of size 1: how far out along the gun, up and aside it is, its radius and how solid. */
export interface PuffState {
  readonly out: number;
  readonly up: number;
  readonly aside: number;
  readonly radius: number;
  readonly opacity: number;
}

/**
 * The shot's smoke: the balls burst out of the muzzle together, thrown to different distances so they
 * make a cone along the gun, slow to a stop within a second, then swell, rise and thin away.
 */
export function puffState(j: number, age: number): PuffState {
  const share = (j + 1) / SHOT.puffs;
  const thrown = 1 - Math.exp(-age * 5);
  const k = age / SHOT.life;
  return {
    out: 0.08 + 0.55 * share * thrown,
    up: 0.02 + age * 0.07 + 0.04 * Math.sin(j * 2.3),
    aside: 0.06 * Math.sin(j * 1.7 + 0.5) * thrown,
    radius: (0.05 + 0.03 * share) * (0.7 + 2.3 * (1 - Math.exp(-age * 2.2))),
    opacity: 0.95 * Math.min(1, age / 0.04) * Math.pow(1 - k, 1.4),
  };
}
