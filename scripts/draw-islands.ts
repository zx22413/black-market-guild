/**
 * Draws each chosen island's look as an isometric SVG blueprint from the same data the 3D table
 * uses: the ground colors and scenery pieces of `src/ui-v07/scene/islandScenery.ts`, built from
 * `src/ui/scene/buildings/landmarks.ts`. The four asset buildings are drawn as pale ghosts in their
 * fixed lots, so the scenery is judged against what will stand beside it.
 *
 *   npm run art:islands   (writes docs/art/islands-blueprint.svg)
 */
import { ASSET_IDS } from '../src/game';
import { BUILDING_DESIGNS } from '../src/ui/scene/buildings/designs';
import { LANDMARK_DESIGNS, landmarkParts } from '../src/ui/scene/buildings/landmarks';
import { SWATCHES, type Mat, type Swatch } from '../src/ui/scene/buildings/materials';
import { partFaces, type Face, type Part, type Vec3 } from '../src/ui/scene/buildings/polyhedra';
import { boatPose } from '../src/ui/scene/buildings/islands/seaLoop';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLAYER_ISLAND_RADIUS } from '../src/ui/scene/layout';
import { SEA_LEVEL } from '../src/ui/scene/seaWave';
import { ISLAND_SCENERY, type IslandScenery, type SceneryPiece } from '../src/ui-v07/scene/islandScenery';
import { facesViewer, paintersOrder, project } from './iso-painter';
import { shadedPolygon, silhouetteOf, swatchChips, type Drawn } from './iso-shade';

const GHOST: Swatch = { top: '#f3efe6', bottom: '#d6cfbf' };
/** The grass plateau's share of the island radius (see `IslandBase`). */
const PLATEAU = PLAYER_ISLAND_RADIUS * 0.78;

function shade(hex: string, k: number): string {
  const c = [0, 1, 2].map((i) => Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * k));
  return `#${c.map((n) => Math.min(255, n).toString(16).padStart(2, '0')).join('')}`;
}

/** Turn about +y (as three.js does), scale, then move: the same placement as the 3D scene. */
function placeFace(face: Face, at: Vec3, scale: number, turn: number): Face {
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  const spin = ([x, y, z]: Vec3): Vec3 => [x * cos + z * sin, y, -x * sin + z * cos];
  const move = (p: Vec3): Vec3 => {
    const [x, y, z] = spin(p);
    return [at[0] + x * scale, at[1] + y * scale, at[2] + z * scale];
  };
  return { ...face, points: face.points.map(move), normal: spin(face.normal), span: [at[1] + face.span[0] * scale, at[1] + face.span[1] * scale] };
}

function partsDrawn(parts: readonly (Part & { readonly mat: string })[], at: Vec3, scale: number, turn: number, swatch?: Swatch): Drawn[] {
  return parts.flatMap((part) => partFaces(part).map((face) => ({ face: placeFace(face, at, scale, turn), swatch: swatch ?? SWATCHES[part.mat as Mat] })));
}

/** The sea at rest below the plateau origin (`PlayerIsland` lifts the plateau 2.6 above the table). */
const SEA_BELOW_PLATEAU = SEA_LEVEL - 2.6;

/** A piece's boat (`LandmarkBoat`), drawn where it sets out on its loop, afloat on the sea at rest. */
function boatDrawn(piece: SceneryPiece, at: Vec3, scale: number): Drawn[] {
  const { boat } = LANDMARK_DESIGNS[piece.design];
  if (!boat) return [];
  const { at: [x, z], heading } = boatPose(boat, 0);
  const y = (SEA_BELOW_PLATEAU - piece.at[1]) / scale;
  const afloat = boat.hull.flatMap((part) => partFaces(part).map((face) => ({ face: placeFace(face, [x, y, z], 1, heading), swatch: SWATCHES[part.mat] })));
  return afloat.map((d) => ({ ...d, face: placeFace(d.face, at, scale, piece.turn ?? 0) }));
}

const pieceDrawn = (piece: SceneryPiece, at: Vec3 = piece.at, scale = piece.scale): Drawn[] => [
  ...partsDrawn(landmarkParts(LANDMARK_DESIGNS[piece.design]), at, scale, piece.turn ?? 0),
  ...boatDrawn(piece, at, scale),
];

/** Cliff top at -0.2 and grass top at 0.25 above the plateau origin, as `IslandBase` draws them. */
function groundDrawn(scenery: IslandScenery, radius: number, cliffRadius: number): Drawn[] {
  const { top, cliff } = scenery.ground;
  const ring = partFaces({ kind: 'prism', base: [0, -1.5, 0], radius: cliffRadius, top: cliffRadius * 0.92, height: 1.3, sides: 11, mat: 'cliff' });
  const plateau = partFaces({ kind: 'prism', base: [0, -0.05, 0], radius, height: 0.3, sides: 11, mat: 'ground' });
  return [
    ...ring.map((face) => ({ face, swatch: { top: cliff, bottom: shade(cliff, 0.8) } })),
    ...plateau.map((face) => ({ face, swatch: { top, bottom: shade(top, 0.9) } })),
  ];
}

const visible = (drawn: readonly Drawn[]): Drawn[] => paintersOrder(drawn.filter((d) => facesViewer(d.face)));
const paint = (drawn: readonly Drawn[], unit: number, defs: string[]): string => drawn.map((d) => shadedPolygon(d, unit, defs)).join('');

function screenBox(drawn: readonly Drawn[], unit: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const xy = drawn.flatMap((d) => d.face.points.map((p) => project(p, unit)));
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Draws `drawn` centered in a `width` × `height` box at `unit`, or smaller if it would not fit. */
function fitted(drawn: readonly Drawn[], width: number, height: number, unit: number, defs: string[], silhouette = false): string {
  const box = screenBox(drawn, 1);
  const u = Math.min(unit, width / (box.maxX - box.minX), height / (box.maxY - box.minY));
  const [ox, oy] = [width / 2 - ((box.minX + box.maxX) / 2) * u, height / 2 - ((box.minY + box.maxY) / 2) * u];
  const body = silhouette ? silhouetteOf(drawn, u) : paint(drawn, u, defs);
  return `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)})">${body}</g>`;
}

/** A close-up of one piece on a tile of the island's ground. */
function closeUp(scenery: IslandScenery, piece: SceneryPiece, defs: string[]): string {
  const tile = partFaces({ kind: 'box', center: [0, -0.12, 0], size: [2.7, 0.24, 2.7], bevel: 0.06, mat: 'ground' });
  const drawn = visible([
    ...tile.map((face) => ({ face, swatch: { top: scenery.ground.top, bottom: shade(scenery.ground.top, 0.8) } })),
    // Without its boat, which sails too far off for a close-up.
    ...partsDrawn(landmarkParts(LANDMARK_DESIGNS[piece.design]), [0, 0, 0], 1, piece.turn ?? 0),
  ]);
  return fitted(drawn, 400, 240, 90, defs);
}

/** Swatch chips fit the card's right column 13 to a row. */
const CHIPS_PER_ROW = 13;
function chipRows(chips: readonly Swatch[]): string {
  const rows = Array.from({ length: Math.ceil(chips.length / CHIPS_PER_ROW) }, (_, i) => chips.slice(i * CHIPS_PER_ROW, (i + 1) * CHIPS_PER_ROW));
  const top = rows.length > 1 ? 652 : 670;
  return rows.map((row, i) => `<g transform="translate(930,${top + i * 30})">${swatchChips(row)}</g>`).join('');
}

function panel(scenery: IslandScenery, index: number, defs: string[]): string {
  const ghosts = ASSET_IDS.flatMap((asset) => partsDrawn(BUILDING_DESIGNS[asset].parts, ASSET_LOTS[asset], ASSET_BUILDING_SCALE, 0, GHOST));
  const all = [...groundDrawn(scenery, PLATEAU, PLAYER_ISLAND_RADIUS), ...ghosts, ...scenery.pieces.flatMap((p) => pieceDrawn(p))];
  const island = visible(all);
  // Seen from behind: how your own island faces the table camera.
  const back = visible(all.map((d) => ({ ...d, face: placeFace(d.face, [0, 0, 0], 1, Math.PI) })));
  const main = scenery.pieces.find((p) => !p.backdrop)!;
  const second = scenery.pieces.find((p) => p.backdrop) ?? scenery.pieces[1]!;
  const designs = [...new Set(scenery.pieces.map((p) => p.design))];
  const mats = [...new Set(designs.flatMap((id) => landmarkParts(LANDMARK_DESIGNS[id]).map((p) => p.mat)))];
  const y0 = 150 + index * 780;
  const head = scenery.ground.top;
  const chips = [{ top: head, bottom: shade(head, 0.9) }, ...mats.map((m) => SWATCHES[m])];
  const list = designs
    .map((id, i) => `<text x="0" y="${i * (designs.length > 4 ? 21 : 24)}" class="note">・${LANDMARK_DESIGNS[id].motif}</text>`)
    .join('');
  return `
  <g transform="translate(40,${y0})">
    <rect width="1360" height="740" rx="18" fill="#fbf3e2"/>
    <path d="M18 0 H1342 A18 18 0 0 1 1360 18 V64 H0 V18 A18 18 0 0 1 18 0 Z" fill="${shade(head, 0.85)}"/>
    <path d="M18 0 H1342 A18 18 0 0 1 1360 18 V28 H0 V18 A18 18 0 0 1 18 0 Z" fill="${head}"/>
    <text x="28" y="44" class="title">${scenery.name}</text>
    <text x="1332" y="42" class="motif" text-anchor="end">淡色為四棟資產建築的固定位置（示意）</text>
    <g transform="translate(10,100)">${fitted(island, 440, 520, 40, defs)}</g>
    <g transform="translate(460,100)">${fitted(back, 440, 520, 40, defs)}</g>
    <text x="230" y="100" class="note" text-anchor="middle">碼頭側</text>
    <text x="680" y="100" class="note" text-anchor="middle">背面（自己的島從鏡頭看是這面）</text>
    <g transform="translate(930,80)"><rect width="410" height="250" rx="12" fill="#f3e8d2"/><g transform="translate(5,5)">${closeUp(scenery, main, defs)}</g></g>
    <text x="1135" y="350" class="note" text-anchor="middle">${LANDMARK_DESIGNS[main.design].motif}</text>
    <g transform="translate(930,370)"><rect width="410" height="250" rx="12" fill="#f3e8d2"/><g transform="translate(5,5)">${closeUp(scenery, second, defs)}</g></g>
    <text x="1135" y="640" class="note" text-anchor="middle">${LANDMARK_DESIGNS[second.design].motif}</text>
    <g transform="translate(40,${designs.length > 4 ? 642 : 664})">${list}</g>
    <g transform="translate(560,640)">${fitted(island, 160, 66, 6, defs, true)}</g>
    <text x="640" y="728" class="note" text-anchor="middle">桌面距離剪影</text>
    ${chipRows(chips)}
    <text x="930" y="${chips.length > CHIPS_PER_ROW ? 732 : 722}" class="note">地面色＋造景材質</text>
  </g>`;
}

const sceneries = Object.values(ISLAND_SCENERY).filter((s): s is IslandScenery => s !== undefined);
const defs: string[] = [];
const panels = sceneries.map((s, i) => panel(s, i, defs)).join('');
const height = 150 + sceneries.length * 780;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 1440 ${height}">
  <style>
    text { font-family: 'Noto Serif TC', 'Songti TC', 'PingFang TC', serif; }
    .title { font-size: 30px; font-weight: 700; fill: #fffaf0; }
    .motif { font-size: 18px; fill: #fffaf0; }
    .note { font-size: 15px; fill: #5b4631; }
    .head { font-size: 40px; font-weight: 700; fill: #fbf3e2; }
    .sub { font-size: 18px; fill: #cfe3ee; }
  </style>
  <defs>${defs.join('')}</defs>
  <rect width="1440" height="${height}" fill="#2d5d7c"/>
  <g stroke="#3b6d8e" stroke-width="1">${Array.from({ length: 24 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="${height}"/>`).join('')}${Array.from({ length: Math.ceil(height / 60) }, (_, i) => `<line x1="0" y1="${i * 60}" x2="1440" y2="${i * 60}"/>`).join('')}</g>
  <text x="40" y="72" class="head">黑市商會・島嶼外觀設計圖</text>
  <text x="40" y="110" class="sub">選島後才換上｜地面色＋招牌建築與造景｜不使用資產建築的屋頂色｜碼頭朝左下</text>
  ${panels}
</svg>`;

console.log(svg);
