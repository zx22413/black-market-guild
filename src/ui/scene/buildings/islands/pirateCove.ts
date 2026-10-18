import { barrel, post } from '../kit';
import { tiltPoint, type Tilt, type Vec2, type Vec3 } from '../polyhedra';
import { cloth } from './cloth';
import type { LandmarkDesign, LandmarkFlag, P } from './design';

// The pirate cove (海盜灣): a brig hove down on a treasure beach, a plunder sale, a boucan and a beach battery.

/** Pirate ship's hull outline, bow toward +x. */
const SHIP_HULL: readonly Vec2[] = [
  [-2.0, -0.42],
  [1.3, -0.5],
  [2.15, 0],
  [1.3, 0.5],
  [-2.0, 0.42],
];

/** Upright parts of the pirate brig, keel on y = 0: hull, sterncastle and two masts (its Jolly Roger waves, `careenedShip.flags`). */
function brig(): P[] {
  const mast = (x: number, top: number, yards: readonly number[]): P[] => [
    { kind: 'beam', from: [x, 0.9, 0], to: [x, top, 0], width: 0.11, sides: 6, mat: 'woodDark' },
    // Furled sails on their yards.
    ...yards.map((y): P => ({ kind: 'beam', from: [x, y, -0.72], to: [x, y, 0.72], width: 0.13, sides: 6, mat: 'plaster' })),
  ];
  return [
    { kind: 'beam', from: [-2.0, 0.07, 0], to: [2.05, 0.07, 0], width: 0.12, mat: 'dark' },
    { kind: 'loft', base: [0, 0.1, 0], outline: SHIP_HULL, height: 0.5, bottom: 0.5, top: 1, mat: 'woodDark' },
    { kind: 'loft', base: [0, 0.6, 0], outline: SHIP_HULL, height: 0.38, bottom: 1, top: 0.95, mat: 'wood' },
    // Gunports along both sides.
    ...[-1.2, -0.6, 0, 0.6].flatMap((x) => [-1, 1].map((sz): P => ({ kind: 'box', center: [x, 0.8, sz * 0.47], size: [0.16, 0.14, 0.06], mat: 'dark' }))),
    // Sterncastle with lit stern windows.
    { kind: 'box', center: [-1.62, 1.16, 0], size: [0.72, 0.36, 0.78], bevel: 0.03, mat: 'wood' },
    { kind: 'box', center: [-1.99, 1.16, 0], size: [0.04, 0.12, 0.5], mat: 'gold' },
    { kind: 'beam', from: [1.9, 0.95, 0], to: [2.95, 1.45, 0], width: 0.08, mat: 'woodDark' },
    ...mast(0.85, 3.7, [2.3, 3.1]),
    ...mast(-0.4, 4.4, [2.5, 3.5]),
  ];
}

const BEACH: readonly Vec2[] = [
  [-2.4, -0.5],
  [-1.6, -1.0],
  [1.4, -1.0],
  [1.95, -0.5],
  [1.95, 1.5],
  [-2.0, 1.45],
];

/** Hove down on the -z side: the ship lies over away from the island, masts slanting out to sea. */
const HEEL: Tilt = { axis: 'x', angle: -0.62, pivot: [0, -0.95, -0.42] };
const heeled = (parts: readonly P[]): P[] => parts.map((part) => ({ ...part, tilt: HEEL }));

/** A pot of pitch boiling on a fire: careeners burned off the weed and tarred the bottom ("breaming"). */
function pitchPot([x, y, z]: Vec3, r: number): P[] {
  return [
    ...[0, 1, 2].map((i): P => ({ kind: 'beam', from: [x + Math.cos(i * 2.1) * r * 1.1, y + r * 0.15, z + Math.sin(i * 2.1) * r * 1.1], to: [x, y + r * 2.4, z], width: r * 0.18, mat: 'woodDark' })),
    { kind: 'prism', base: [x, y, z], radius: r * 0.9, top: 0, height: r * 1.3, sides: 6, mat: 'brass' },
    { kind: 'prism', base: [x, y + r * 0.9, z], radius: r * 0.7, top: r * 0.8, height: r * 0.7, sides: 8, mat: 'metal' },
  ];
}

/**
 * The pirate cove's careenage, the island's backdrop: with no dockyard to go to, pirates hove their
 * ship down on a hidden beach (Port Royal, Nassau, Tortuga), so a brig lies over on the sand behind the
 * island, her tarred bottom turned up toward the yard and her masts slanting out to sea under the Jolly
 * Roger, held by tackles to anchors in the shallows; shores and a pitch pot stand on the beach beside
 * the cargo landed before heaving down, open chests of gold and silver plate that glow and glint.
 * Authored for about 3×, on the cliff-top beach of the annex.
 */
const careenedShip: LandmarkDesign = {
  motif: '傾側修船的海盜船＋斜桅骷髏旗＋卸上沙灘的金銀財寶',
  glints: [
    [0.72, 0.75, 0.74],
    [0.05, 0.62, 0.66],
    [1.4, 0.55, 0.86],
    [1.25, 0.4, 0.45],
    [0.32, 0.3, 1.05],
    [0.5, 0.35, 0.95],
    [1.0, 0.3, 1.1],
    [-0.28, 0.36, 0.98],
  ],
  parts: [
    // The careenage: a sand beach on the cliff top under the hull.
    { kind: 'loft', base: [0, 0, -0.35], outline: BEACH, height: 0.06, bottom: 1, top: 0.97, mat: 'sand' },
    ...heeled(brig()),
    // Tackles from the mastheads down to anchor posts in the shallows.
    ...([
      [0.85, 3.6, -1.6],
      [-0.4, 4.3, -1.9],
    ] as const).flatMap(([x, y, to]): P[] => [
      { kind: 'beam', from: tiltPoint([x, y, 0], HEEL), to: [x + 0.3, 0.15, to], width: 0.03, mat: 'rope' },
      post(x + 0.3, to, 0, 0.3, 0.09),
    ]),
    // Shores propping the hull, a pitch pot and a pile of scraped weed on the beach.
    ...[-1.2, 0.1, 1.15].map((x): P => ({ kind: 'beam', from: [x, 0.04, 0.12], to: tiltPoint([x, 0.42, 0.36], HEEL), width: 0.07, mat: 'woodDark' })),
    ...pitchPot([-0.55, 0.06, 0.3], 0.12),
    // The cargo landed before heaving down: a mound of gold coin, open chests, Spanish silver and gold
    // bars, jewels and silver plate.
    coinHeap([0.72, 0.06, 0.74], 0.48),
    ...gem([0.6, 0.38, 0.7], 0.06, 'ruby'),
    ...gem([0.86, 0.34, 0.66], 0.05, 'emerald'),
    ...treasureChest([0.05, 0.06, 0.66], 0.55),
    ...gem([0.08, 0.5, 0.58], 0.05, 'emerald'),
    ...treasureChest([1.4, 0.06, 0.86], 0.45),
    ...gem([1.42, 0.42, 0.95], 0.05, 'ruby'),
    ...barStack([1.25, 0.06, 0.45], 'treasure', 3),
    ...barStack([0.32, 0.06, 1.05], 'silver', 2),
    coinHeap([1.0, 0.06, 1.1], 0.2),
    silverPlate([0.65, 0.06, 1.15], 0.14),
    silverPlate([1.62, 0.06, 1.18], 0.12),
    ...goblet([0.72, 0.42, 0.74], 0.22),
    ...goblet([-0.28, 0.06, 0.98], 0.24),
    ...barrel([1.6, 0.06, 0.2]),
  ],
  // The Jolly Roger at the main truck, heeled over with the masts.
  flags: [jollyRoger(-0.37, 4.36, 0, 0.72, HEEL)],
};

/** Open treasure chest heaped with gold coin on `base`, its lid thrown back toward -x. */
function treasureChest([x, y, z]: Vec3, w: number): P[] {
  return [
    { kind: 'box', center: [x, y + w * 0.3, z], size: [w * 0.7, w * 0.6, w], bevel: w * 0.04, mat: 'woodDark' },
    ...[-0.35, 0.35].map((k): P => ({ kind: 'box', center: [x, y + w * 0.3, z + k * w], size: [w * 0.74, w * 0.64, w * 0.08], mat: 'brass' })),
    { kind: 'prism', base: [x, y + w * 0.6, z], radius: w * 0.4, top: w * 0.12, height: w * 0.24, sides: 7, mat: 'treasure' },
    { kind: 'box', center: [x - w * 0.42, y + w * 0.8, z], size: [w * 0.08, w * 0.45, w], bevel: w * 0.02, mat: 'woodDark' },
  ];
}

/** Heap of gold coin on `base`. */
function coinHeap([x, y, z]: Vec3, r: number): P {
  return { kind: 'prism', base: [x, y, z], radius: r, top: r * 0.25, height: r * 0.75, sides: 8, mat: 'treasure' };
}

/** Stack of cast bars on `base`, three to a layer, each layer laid across the one below. */
function barStack([x, y, z]: Vec3, mat: 'treasure' | 'silver', layers: number): P[] {
  return Array.from({ length: layers }, (_, layer) =>
    [-1, 0, 1].map((i): P => {
      const across = layer % 2 === 1;
      const offset = i * 0.085;
      return {
        kind: 'box',
        center: [x + (across ? offset : 0), y + 0.04 + layer * 0.08, z + (across ? 0 : offset)],
        size: across ? [0.075, 0.075, 0.24] : [0.24, 0.075, 0.075],
        bevel: 0.015,
        mat,
      };
    }),
  ).flat();
}

/** A cut jewel on `base`: a double cone. */
function gem([x, y, z]: Vec3, r: number, mat: 'ruby' | 'emerald'): P[] {
  return [
    { kind: 'prism', base: [x, y, z], radius: r * 0.3, top: r, height: r * 0.6, sides: 6, mat },
    { kind: 'prism', base: [x, y + r * 0.6, z], radius: r, top: 0, height: r * 0.8, sides: 6, mat },
  ];
}

/** Silver goblet on `base`. */
function goblet([x, y, z]: Vec3, h: number): P[] {
  return [
    { kind: 'prism', base: [x, y, z], radius: h * 0.32, top: h * 0.08, height: h * 0.2, sides: 8, mat: 'silver' },
    { kind: 'prism', base: [x, y + h * 0.2, z], radius: h * 0.08, height: h * 0.4, sides: 6, mat: 'silver' },
    { kind: 'prism', base: [x, y + h * 0.6, z], radius: h * 0.16, top: h * 0.32, height: h * 0.4, sides: 8, mat: 'silver' },
  ];
}

/** Silver plate lying on `base`. */
function silverPlate([x, y, z]: Vec3, r: number): P {
  return { kind: 'prism', base: [x, y, z], radius: r, top: r * 0.8, height: r * 0.15, sides: 10, mat: 'silver' };
}

/** A bolt of silk lying along z. */
const silkBolt = ([x, y, z]: Vec3, mat: 'mace' | 'cardamom' | 'spiceYellow'): P => ({ kind: 'beam', from: [x, y + 0.09, z - 0.32], to: [x, y + 0.09, z + 0.32], width: 0.18, sides: 8, mat });

/**
 * Plunder sale in the yard, as Port Royal's taverns auctioned prize goods: an open chest of gold on
 * a trestle table, rum barrels, bolts of silk and a pair of crossed cutlasses stuck in a cask, laid
 * out along x so both sides of the island see the gold.
 */
const plunderSale: LandmarkDesign = {
  motif: '戰利品拍賣（發光金幣寶箱＋銀器＋蘭姆酒桶＋絲綢）',
  glints: [
    [-0.18, 0.85, 0.05],
    [0.28, 0.68, 0.1],
    [0.33, 0.75, -0.17],
  ],
  parts: [
    { kind: 'box', center: [0, 0.42, 0], size: [1.1, 0.06, 0.6], bevel: 0.015, mat: 'wood' },
    ...[-0.45, 0.45].flatMap((x) => [-0.22, 0.22].map((z) => post(x, z, 0, 0.4, 0.06))),
    ...treasureChest([-0.18, 0.45, 0], 0.5),
    coinHeap([0.28, 0.45, 0.08], 0.2),
    ...goblet([0.33, 0.45, -0.17], 0.22),
    silverPlate([0.05, 0.45, 0.2], 0.1),
    ...barrel([-0.78, 0, 0.15]),
    ...barrel([-0.82, 0, -0.3]),
    ...barrel([-0.8, 0.44, -0.08]),
    silkBolt([0.68, 0, -0.1], 'mace'),
    silkBolt([0.88, 0, -0.05], 'cardamom'),
    silkBolt([0.78, 0.17, -0.08], 'spiceYellow'),
    // A cask with two cutlasses stuck crosswise in it.
    ...barrel([0.45, 0, 0.55]),
    { kind: 'beam', from: [0.35, 0.4, 0.55], to: [0.6, 0.9, 0.55], width: 0.04, mat: 'marble' },
    { kind: 'beam', from: [0.55, 0.4, 0.55], to: [0.3, 0.9, 0.55], width: 0.04, mat: 'marble' },
    ...[0.39, 0.51].map((x): P => ({ kind: 'box', center: [x, 0.47, 0.55], size: [0.12, 0.03, 0.08], mat: 'brass' })),
  ],
};

/** A low fire: a ring of stones round a bed of glowing embers with a few flame tongues. */
function campfire([x, y, z]: Vec3, r: number): P[] {
  return [
    ...Array.from({ length: 7 }, (_, i): P => {
      const a = (i / 7) * Math.PI * 2;
      return { kind: 'prism', base: [x + Math.cos(a) * r, y, z + Math.sin(a) * r], radius: r * 0.28, top: r * 0.16, height: r * 0.22, sides: 5, mat: 'stone' };
    }),
    { kind: 'prism', base: [x, y, z], radius: r * 0.75, top: r * 0.5, height: r * 0.12, sides: 8, mat: 'ember' },
    ...([
      [0, 0, 0.7],
      [0.3, 0.15, 0.45],
      [-0.25, -0.2, 0.5],
    ] as const).map(([dx, dz, h]): P => ({ kind: 'prism', base: [x + dx * r, y + r * 0.1, z + dz * r], radius: r * 0.22, top: 0, height: r * h, sides: 5, mat: 'flame' })),
  ];
}

/**
 * Boucan: the wooden smoking rack of the Hispaniola hunters who gave the buccaneers their name, a grill
 * of green sticks on four forked posts over a smoky fire, hung with strips of meat, with a log pile.
 */
const boucan: LandmarkDesign = {
  motif: '燻肉架 boucan（海盜 buccaneer 的由來）＋營火',
  parts: [
    ...[-0.45, 0.45].flatMap((x) => [-0.3, 0.3].map((z) => post(x, z, 0, 0.72, 0.06))),
    ...[-0.3, 0.3].map((z): P => ({ kind: 'beam', from: [-0.52, 0.7, z], to: [0.52, 0.7, z], width: 0.05, mat: 'woodDark' })),
    ...[-0.36, -0.18, 0, 0.18, 0.36].map((x): P => ({ kind: 'beam', from: [x, 0.74, -0.36], to: [x, 0.74, 0.36], width: 0.035, mat: 'wood' })),
    ...([
      [-0.27, -0.12],
      [-0.09, 0.14],
      [0.1, -0.1],
      [0.27, 0.12],
    ] as const).map(([x, z]): P => ({ kind: 'box', center: [x, 0.78, z], size: [0.13, 0.04, 0.22], bevel: 0.015, mat: 'mace' })),
    ...campfire([0, 0, 0], 0.26),
    // Firewood.
    ...[0, 1, 2].map((i): P => ({ kind: 'beam', from: [0.62, 0.055 + (i === 2 ? 0.09 : 0), -0.25 + (i % 2) * 0.1 + (i === 2 ? 0.05 : 0)], to: [0.62, 0.055 + (i === 2 ? 0.09 : 0), 0.25 + (i % 2) * 0.1 + (i === 2 ? 0.05 : 0)], width: 0.09, sides: 6, mat: 'woodDark' })),
  ],
  // Smoke curling up from the fire through the grill.
  smoke: [{ at: [0, 0.15, 0], size: 1 }],
  lights: [{ at: [0, 0.35, 0], reach: 10 }],
};

/** A ship's gun on its truck carriage, muzzle toward +z. */
function shipGun(x: number, z: number): P[] {
  return [
    { kind: 'box', center: [x, 0.2, z], size: [0.3, 0.18, 0.55], bevel: 0.02, mat: 'woodDark' },
    ...[-0.16, 0.16].flatMap((dz) => [-1, 1].map((s): P => ({ kind: 'beam', from: [x + s * 0.15, 0.115, z + dz], to: [x + s * 0.2, 0.115, z + dz], width: 0.2, sides: 8, mat: 'wood' }))),
    { kind: 'beam', from: [x, 0.38, z - 0.3], to: [x, 0.38, z + 0.55], width: 0.15, sides: 8, mat: 'metal' },
    { kind: 'beam', from: [x, 0.38, z + 0.5], to: [x, 0.38, z + 0.58], width: 0.2, sides: 8, mat: 'metal' },
  ];
}

/** Pyramid of round shot on `base`. */
function shotPile([x, y, z]: Vec3, r: number): P[] {
  const ball = (dx: number, dy: number, dz: number): P => ({ kind: 'beam', from: [x + dx - r, y + dy + r, z + dz], to: [x + dx + r, y + dy + r, z + dz], width: r * 2, sides: 8, mat: 'dark' });
  return [ball(-r, 0, -r), ball(r, 0, -r), ball(-r, 0, r), ball(r, 0, r), ball(0, r * 1.4, 0)];
}

/**
 * Black flag with a white skull over crossed bones, hung from its pole at (x, y, z) and flying toward +x
 * `w` wide; the bones are laid in short steps so they bend with the cloth.
 */
function jollyRoger(x: number, y: number, z: number, w: number, tilt?: Tilt): LandmarkFlag {
  const h = w * 0.66;
  const bone = (from: readonly [number, number], to: readonly [number, number]): P[] =>
    Array.from({ length: 5 }, (_, i) => {
      const t = (i + 0.5) / 5;
      return cloth([x + w * (from[0] + (to[0] - from[0]) * t), y - h * (from[1] + (to[1] - from[1]) * t), z], [w * 0.11, w * 0.06], 'marble', 0.02);
    }).flat();
  return {
    parts: [
      ...cloth([x + w / 2, y - h / 2, z], [w, h], 'dark'),
      ...cloth([x + w * 0.48, y - h * 0.34, z], [w * 0.24, w * 0.2], 'marble', 0.02),
      ...bone([0.24, 0.86], [0.74, 0.6]),
      ...bone([0.24, 0.6], [0.74, 0.86]),
    ],
    hinge: [x, y, z],
    ...(tilt ? { tilt } : {}),
  };
}

/**
 * Beach battery, as the pirates of Nassau landed their guns to cover the harbor: two ship's guns on a
 * plank platform behind a parapet of palm logs, round shot piled beside them and the Jolly Roger flying
 * over the battery.
 */
const beachBattery: LandmarkDesign = {
  motif: '海灘砲台（卸下的艦砲＋棕櫚木胸牆＋骷髏旗）',
  parts: [
    { kind: 'box', center: [0, 0.025, 0], size: [1.22, 0.05, 0.9], bevel: 0.01, mat: 'wood' },
    ...shipGun(-0.32, -0.12),
    ...shipGun(0.32, -0.12),
    ...[0.08, 0.22].map((y): P => ({ kind: 'beam', from: [-0.6, y, 0.5], to: [0.6, y, 0.5], width: 0.14, sides: 7, mat: 'wood' })),
    ...shotPile([0, 0.05, -0.32], 0.05),
    post(-0.6, -0.35, 0, 1.25, 0.05),
  ],
  flags: [jollyRoger(-0.58, 1.24, -0.35, 0.42)],
};

export const PIRATE_COVE_LANDMARKS = {
  'careened-ship': careenedShip,
  'plunder-sale': plunderSale,
  boucan,
  'beach-battery': beachBattery,
} as const satisfies Record<string, LandmarkDesign>;
