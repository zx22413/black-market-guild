import { describe, expect, it } from 'vitest';
import {
  REPAIR,
  RETURN,
  SEAL,
  VOLLEY,
  WORK_SECONDS,
  arcPoint,
  ballPose,
  coinPose,
  cratePose,
  firesAt,
  hitSpot,
  hitsAt,
  keptAt,
  keptPose,
  paysAt,
  plankLandsAt,
  plankPose,
  plankSpot,
  returnsAt,
  stampsAt,
} from '../../src/ui-v07/scene/facilityWorkMath';

const deck = [10, 6, -4] as const;
const ship = [0, 2, 12] as const;

describe("the armory's volley (V0.8 prototype, not rules)", () => {
  it('flies each ball from the gun deck to its own spot by the ship, over an arc', () => {
    for (let i = 0; i < VOLLEY.shots; i++) {
      expect(ballPose(deck, ship, i, firesAt(i) - 0.01)).toBeNull();
      expect(ballPose(deck, ship, i, firesAt(i))).toEqual([...deck]);
      const end = ballPose(deck, ship, i, hitsAt(i) - 1e-9)!;
      hitSpot(ship, i).forEach((v, k) => expect(end[k]).toBeCloseTo(v, 4));
      expect(ballPose(deck, ship, i, firesAt(i) + VOLLEY.flight / 2)![1]).toBeGreaterThan(deck[1]);
      expect(ballPose(deck, ship, i, hitsAt(i) + 0.01)).toBeNull();
    }
    const spots = Array.from({ length: VOLLEY.shots }, (_, i) => hitSpot(ship, i).join(','));
    expect(new Set(spots).size).toBe(VOLLEY.shots);
  });

  it('sends the coins home only once the last ball has landed, and is over within the show', () => {
    expect(returnsAt(0)).toBeGreaterThan(hitsAt(VOLLEY.shots - 1));
    expect(returnsAt(RETURN.coins - 1) + RETURN.flight).toBeLessThanOrEqual(WORK_SECONDS);
    expect(coinPose(ship, deck, 0, returnsAt(0) - 0.01, returnsAt, RETURN.flight, RETURN.arc)).toBeNull();
    expect(coinPose(ship, deck, 0, returnsAt(0) + RETURN.flight, returnsAt, RETURN.flight, RETURN.arc)).toEqual([...deck]);
  });

  it('arcs highest at the middle', () => {
    expect(arcPoint([0, 0, 0], [10, 0, 0], 0.5, 4)).toEqual([5, 4, 0]);
  });
});

describe("the tradehouse's seal (V0.8 prototype, not rules)", () => {
  it('brings the crates up one after another, side by side over the roof', () => {
    expect(cratePose(1, 3, SEAL.gap - 0.01)).toBeNull();
    const up = [0, 1, 2].map((i) => cratePose(i, 3, SEAL.stamp - 0.01)!);
    expect(up.map((p) => p.x)).toEqual([-SEAL.apart, 0, SEAL.apart]);
    for (const p of up) {
      expect(p.y).toBeCloseTo(SEAL.lift, 1);
      expect(p.sealed).toBe(false);
      expect(p.ring).toBeNull();
    }
    expect(cratePose(0, 1, 1)!.x).toBe(0);
  });

  it('shuts the ring, then the crate is gold, then it pays, then it goes', () => {
    for (let i = 0; i < SEAL.max; i++) {
      expect(cratePose(i, 3, stampsAt(i) + 0.01)!.ring).toBeGreaterThan(0.9);
      expect(cratePose(i, 3, stampsAt(i) + SEAL.close + 0.01)).toMatchObject({ sealed: true, ring: 0 });
      expect(paysAt(i)).toBeGreaterThan(stampsAt(i) + SEAL.close);
      expect(paysAt(i) + SEAL.flight).toBeLessThanOrEqual(SEAL.leave + SEAL.gone);
    }
    expect(cratePose(0, 3, SEAL.leave + SEAL.gone / 2)!.scale).toBeLessThan(1);
    expect(cratePose(0, 3, SEAL.leave + SEAL.gone + 0.01)).toBeNull();
    expect(SEAL.leave + SEAL.gone).toBeLessThanOrEqual(WORK_SECONDS);
  });
});

describe("the repair yard's run (V0.8 prototype, not rules)", () => {
  it('nails each plank on its own place along the hull', () => {
    for (let i = 0; i < REPAIR.planks; i++) {
      expect(plankPose(deck, ship, i, plankLandsAt(i) - REPAIR.flight - 0.01)).toBeNull();
      const end = plankPose(deck, ship, i, plankLandsAt(i) - 1e-9)!;
      plankSpot(ship, i).forEach((v, k) => expect(end[k]).toBeCloseTo(v, 4));
    }
    expect(new Set(Array.from({ length: REPAIR.planks }, (_, i) => plankSpot(ship, i).join(','))).size).toBe(REPAIR.planks);
  });

  it('pops the kept crates up once the last plank is on, and takes them away as the show ends', () => {
    expect(keptAt(0)).toBeGreaterThan(plankLandsAt(REPAIR.planks - 1));
    expect(keptPose(0, 2, keptAt(0) - 0.01)).toBeNull();
    const shown = keptPose(0, 2, keptAt(0) + REPAIR.hop)!;
    expect(shown.scale).toBeCloseTo(1, 5);
    expect(shown.x).toBe(-REPAIR.apart / 2);
    expect(keptPose(1, 2, keptAt(1) + REPAIR.hop)!.x).toBe(REPAIR.apart / 2);
    expect(keptPose(0, 2, WORK_SECONDS)!.scale).toBeCloseTo(0, 5);
  });
});
