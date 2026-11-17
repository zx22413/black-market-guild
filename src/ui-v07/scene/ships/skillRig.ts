import type { Mat } from '../../../ui/scene/buildings/materials';
import type { ShipTypeId } from '../../../v07/game';
import type { SailSpec } from './cloth';
import type { ShipOars } from './designs';

// V0.8 prototype (an experiment, not rules): what a ship with its skill open wears besides the Blender-built parts
// (public/models/ships/<type>-skill.glb, scripts/blender/blockout-skills.py; design sheet docs/art/skills-concept.svg).
// The cloths are drawn in code like every other sail, so they fill with the wind: the new sails the upgrade steps,
// and the colours it repaints the old ones in. The numbers here are the ones the Blender script builds the spars at.

/** The upgraded ship's model, or null for a type without one. */
export const skillModelUrl = (type: ShipTypeId): string => `${import.meta.env.BASE_URL}models/ships/${type}-skill.glb`;

/** Sails the upgrade adds: the gamble's lateen mizzen, the albatross's spritsail under the bowsprit. */
const EXTRA_SAILS: Partial<Record<ShipTypeId, readonly SailSpec[]>> = {
  gambler: [
    {
      edge: [
        [0.22, 1.95, 0.25],
        [0.22, 4.55, -2.75],
      ],
      pieces: [
        [
          [0.22, 1.95, 0.25],
          [0.22, 4.55, -2.75],
          [0.42, 1.75, -2.55],
        ],
      ],
      mat: 'roofGold',
      bands: { axis: 'fan', pattern: [{ mat: 'roofGold', width: 0.99 }, { mat: 'roofRed', width: 0.99 }] },
      belly: 0.35,
    },
  ],
  standard: [
    {
      edge: [
        [-0.9, 2.15, 3.45],
        [0.9, 2.15, 3.45],
      ],
      pieces: [
        [
          [-0.9, 2.15, 3.45],
          [0.9, 2.15, 3.45],
          [0.78, 1.25, 3.45],
          [-0.78, 1.25, 3.45],
        ],
      ],
      mat: 'canvas',
      belly: 0.3,
      square: true,
    },
  ],
};

/** The colours the upgrade repaints a type's cloth in: the gamble's white stripes turn gold, the ghost's rags purple. */
const REPAINT: Partial<Record<ShipTypeId, Partial<Record<Mat, Mat>>>> = {
  gambler: { canvas: 'roofGold' },
  hidden: { ghostCloth: 'heather' },
};

/** A ship type's sails with its skill open: the old ones repainted, then the ones the upgrade adds. */
export function skillSails(type: ShipTypeId, sails: readonly SailSpec[]): SailSpec[] {
  const paint = REPAINT[type] ?? {};
  const to = (mat: Mat): Mat => paint[mat] ?? mat;
  const repainted = sails.map((s): SailSpec => ({ ...s, mat: to(s.mat), ...(s.bands ? { bands: { ...s.bands, pattern: s.bands.pattern.map((b) => ({ ...b, mat: to(b.mat) })) } } : {}) }));
  return [...repainted, ...(EXTRA_SAILS[type] ?? [])];
}

/** The galley's oars with its skill open: sea-green looms and blades instead of bare wood. */
export function skillOars(oars: ShipOars): ShipOars {
  return { ...oars, oar: oars.oar.map((part) => (part.mat === 'wood' ? { ...part, mat: 'canal' as Mat } : part)) };
}
