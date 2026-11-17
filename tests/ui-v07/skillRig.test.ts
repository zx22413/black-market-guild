import { describe, expect, it } from 'vitest';
import { SHIP_TYPE_IDS } from '../../src/v07/game';
import { sailCloth } from '../../src/ui-v07/scene/ships/cloth';
import { SHIP_DESIGNS } from '../../src/ui-v07/scene/ships/designs';
import { skillDie, skillOars, skillSails } from '../../src/ui-v07/scene/ships/skillRig';

describe('upgraded rigs (V0.8 prototype, not rules)', () => {
  it('keeps every sail a ship had and never changes its shape', () => {
    for (const type of SHIP_TYPE_IDS) {
      const before = SHIP_DESIGNS[type].sails;
      const after = skillSails(type, before);
      expect(after.length).toBeGreaterThanOrEqual(before.length);
      before.forEach((s, i) => {
        expect(after[i]!.edge).toEqual(s.edge);
        expect(after[i]!.pieces).toEqual(s.pieces);
      });
    }
  });

  it('adds a mizzen to the gamble and a spritsail to the albatross, as cloth the game can draw', () => {
    expect(skillSails('gambler', SHIP_DESIGNS.gambler.sails)).toHaveLength(SHIP_DESIGNS.gambler.sails.length + 1);
    expect(skillSails('standard', SHIP_DESIGNS.standard.sails)).toHaveLength(SHIP_DESIGNS.standard.sails.length + 1);
    for (const type of ['gambler', 'standard'] as const) {
      const added = skillSails(type, SHIP_DESIGNS[type].sails).at(-1)!;
      expect(sailCloth(added).parts.length).toBeGreaterThan(0);
    }
  });

  it("turns the gamble's white stripes gold and the ghost's rags purple, and leaves the others' cloth alone", () => {
    const mats = (type: (typeof SHIP_TYPE_IDS)[number]) => skillSails(type, SHIP_DESIGNS[type].sails).flatMap((s) => [s.mat, ...(s.bands?.pattern.map((b) => b.mat) ?? [])]);
    expect(mats('gambler')).not.toContain('canvas');
    expect(mats('gambler')).toContain('roofGold');
    expect(mats('gambler')).toContain('roofRed');
    expect(mats('hidden')).not.toContain('ghostCloth');
    expect(mats('hidden')).toContain('heather');
    expect(skillSails('freighter', SHIP_DESIGNS.freighter.sails)).toEqual(SHIP_DESIGNS.freighter.sails);
    expect(skillSails('breaker', SHIP_DESIGNS.breaker.sails)).toEqual(SHIP_DESIGNS.breaker.sails);
  });

  it("paints the galley's oars sea green without moving them", () => {
    const motion = SHIP_DESIGNS.breaker.motion;
    if (motion.kind !== 'galley') throw new Error('the breaker rows');
    const oars = skillOars(motion.oars);
    expect(oars.locks).toBe(motion.oars.locks);
    expect(oars.oar.some((p) => p.mat === 'canal')).toBe(true);
    expect(oars.oar.some((p) => p.mat === 'wood')).toBe(false);
  });

  it("gilds the gamble's die and the albatross's emblem disc", () => {
    const motion = SHIP_DESIGNS.gambler.motion;
    if (motion.kind !== 'die') throw new Error('the gamble carries a die');
    const die = skillDie(motion.die);
    expect(die.pivot).toBe(motion.die.pivot);
    expect(die.parts.some((p) => p.mat === 'gold')).toBe(true);
    expect(die.parts.some((p) => p.mat === 'marble')).toBe(false);
    expect(skillSails('standard', SHIP_DESIGNS.standard.sails)[0]!.emblem?.mat).toBe('roofGold');
  });
});
