/**
 * Draws the asset buildings as an isometric SVG blueprint from the same part data the 3D table
 * uses (`src/ui/scene/buildings`), so the drawing and the model cannot drift apart.
 *
 *   npm run art:buildings   (writes docs/art/buildings-blueprint.svg)
 */
import type { AssetId } from '../src/game';
import { BUILDING_DESIGNS, ROOF_MATS, SWATCHES, type BuildingDesign, type Mat, type Swatch } from '../src/ui/scene/buildings/designs';
import { bounds, partFaces, type Face, type Vec3 } from '../src/ui/scene/buildings/polyhedra';
import { facesViewer, paintersOrder, project } from './iso-painter';

const NAMES: Record<AssetId, string> = { shipyard: '造船廠', insurance: '航運保險', salvage: '打撈公司', exchange: '貿易交易所' };
const ORDER: readonly AssetId[] = ['shipyard', 'insurance', 'salvage', 'exchange'];
const SAMPLE_OWNER: Swatch = { top: '#e8645a', bottom: '#c8463f' };
const SAND: Swatch = { top: '#f2d3a0', bottom: '#c99a62' };
const TURF: Swatch = { top: '#8fd168', bottom: '#6aae4c' };

const LIGHT: Vec3 = (() => {
  const l: Vec3 = [0.35, 1, 0.6];
  const n = Math.hypot(...l);
  return [l[0] / n, l[1] / n, l[2] / n];
})();
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function channels(hex: string): number[] {
  return [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16));
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((n) => Math.min(255, Math.round(n)).toString(16).padStart(2, '0')).join('')}`;
}

interface Drawn {
  readonly face: Face;
  readonly swatch: Swatch;
}

function flagSolids(design: BuildingDesign): Drawn[][] {
  const [x, y, z] = design.flag;
  const pole = partFaces({ kind: 'beam', from: [x, y - 0.75, z], to: [x, y, z], width: 0.06, sides: 6, mat: 'woodDark' });
  const cloth = partFaces({ kind: 'box', center: [x + 0.24, y - 0.15, z], size: [0.44, 0.26, 0.03], mat: 'owner' });
  return [pole.map((face) => ({ face, swatch: SWATCHES.woodDark })), cloth.map((face) => ({ face, swatch: SAMPLE_OWNER }))];
}

/** Visible faces of the building and its pennant, back to front. */
function visibleFaces(design: BuildingDesign): Drawn[] {
  const solids = [
    ...design.parts.map((part) => partFaces(part).map((face) => ({ face, swatch: SWATCHES[face.mat as Mat] }))),
    ...flagSolids(design),
  ];
  return paintersOrder(solids.flat().filter((d) => facesViewer(d.face)));
}

/** Painter's order is costly, so each building's is computed once. */
const visibleCache = new Map<BuildingDesign, Drawn[]>();
function visibleFacesOf(design: BuildingDesign): Drawn[] {
  const cached = visibleCache.get(design) ?? visibleFaces(design);
  visibleCache.set(design, cached);
  return cached;
}

/** Swatch color at a height within the face's solid, lit by the face normal. */
function tone({ face, swatch }: Drawn, y: number): string {
  const [low, high] = face.span;
  const t = high - low > 1e-6 ? (y - low) / (high - low) : 1;
  const [top, bottom] = [channels(swatch.top), channels(swatch.bottom)];
  const light = 0.62 + 0.45 * Math.max(0, dot(face.normal, LIGHT));
  return toHex(top.map((c, i) => (bottom[i]! + (c - bottom[i]!) * t) * light));
}

/**
 * A face filled with its swatch's top-to-bottom gradient, laid along the direction world height
 * changes fastest on screen. Strokes match the fill so seams close without drawn outlines.
 */
function shadedPolygon(drawn: Drawn, unit: number, defs: string[]): string {
  const { face } = drawn;
  const screen = face.points.map((p) => project(p, unit));
  const d = screen.map((s) => s.map((n) => n.toFixed(1)).join(',')).join(' ');
  const [a, b, c] = [0, 1, 2].map((i) => ({ s: screen[i]!, y: face.points[i]![1] })) as [
    { s: [number, number]; y: number },
    { s: [number, number]; y: number },
    { s: [number, number]; y: number },
  ];
  // Height is affine on the face plane: solve height = gx * X + gy * Y + g0 from three corners.
  const [bx, by, cx, cy] = [b.s[0] - a.s[0], b.s[1] - a.s[1], c.s[0] - a.s[0], c.s[1] - a.s[1]];
  const det = bx * cy - cx * by;
  const gx = det === 0 ? 0 : ((b.y - a.y) * cy - (c.y - a.y) * by) / det;
  const gy = det === 0 ? 0 : ((c.y - a.y) * bx - (b.y - a.y) * cx) / det;
  const g2 = gx * gx + gy * gy;
  if (g2 < 1e-9) {
    const fill = tone(drawn, a.y);
    return `<polygon points="${d}" fill="${fill}" stroke="${fill}" stroke-width="0.6" stroke-linejoin="round"/>`;
  }
  const [low, high] = face.span;
  const at = (y: number): string => `${(a.s[0] + (gx * (y - a.y)) / g2).toFixed(1)}`;
  const atY = (y: number): string => `${(a.s[1] + (gy * (y - a.y)) / g2).toFixed(1)}`;
  const id = `g${defs.length}`;
  defs.push(
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${at(high)}" y1="${atY(high)}" x2="${at(low)}" y2="${atY(low)}"><stop offset="0" stop-color="${tone(drawn, high)}"/><stop offset="1" stop-color="${tone(drawn, low)}"/></linearGradient>`,
  );
  return `<polygon points="${d}" fill="url(#${id})" stroke="url(#${id})" stroke-width="0.6" stroke-linejoin="round"/>`;
}

function model(design: BuildingDesign, unit: number, defs: string[]): string {
  return visibleFacesOf(design)
    .map((drawn) => shadedPolygon(drawn, unit, defs))
    .join('');
}

function silhouette(design: BuildingDesign, unit: number): string {
  return visibleFacesOf(design)
    .map(({ face }) => {
      const d = face.points.map((p) => project(p, unit).map((n) => n.toFixed(1)).join(',')).join(' ');
      return `<polygon points="${d}" fill="#2b3a55" stroke="#2b3a55" stroke-width="0.5"/>`;
    })
    .join('');
}

const GROUND_HALF = 1.35;
const ART = { width: 470, height: 400 } as const;

/** Grass tile on a sand block under each building, with a soft contact shadow. */
function ground(unit: number, defs: string[]): string {
  const g = GROUND_HALF;
  const block = partFaces({ kind: 'box', center: [0, -0.2, 0], size: [2 * g + 0.5, 0.36, 2 * g + 0.5], bevel: 0.08, mat: 'sand' });
  const grass = partFaces({ kind: 'box', center: [0, -0.01, 0], size: [2 * g, 0.02, 2 * g], bevel: 0.01, mat: 'grass' });
  const draw = (faces: Face[], swatch: Swatch): string =>
    faces
      .filter(facesViewer)
      .map((face) => shadedPolygon({ face, swatch }, unit, defs))
      .join('');
  const s = g - 0.2;
  const shadow = ([[-s, -s], [s, -s], [s, s], [-s, s]] as const)
    .map(([x, z]) => project([x, 0.001, z], unit).map((n) => n.toFixed(1)).join(','))
    .join(' ');
  return `${draw(block, SAND)}${draw(grass, TURF)}<polygon points="${shadow}" fill="#2f5a22" opacity="0.16"/>`;
}

/** Screen extent of a building on its ground tile at unit scale. */
function extent(design: BuildingDesign): { minX: number; maxX: number; minY: number; maxY: number } {
  const g = GROUND_HALF + 0.25;
  const points: Vec3[] = [
    ...visibleFacesOf(design).flatMap((d) => d.face.points),
    [-g, -0.38, -g],
    [g, -0.38, -g],
    [g, -0.38, g],
    [-g, -0.38, g],
  ];
  const xy = points.map((p) => project(p, 1));
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** One scale for every panel, so the buildings keep their relative sizes. */
const UNIT = Math.min(
  ...ORDER.map((asset) => {
    const e = extent(BUILDING_DESIGNS[asset]);
    return Math.min(ART.width / (e.maxX - e.minX), ART.height / (e.maxY - e.minY));
  }),
);

function panel(asset: AssetId, index: number, defs: string[]): string {
  const design = BUILDING_DESIGNS[asset];
  const { max } = bounds(design.parts);
  const e = extent(design);
  const origin = [30 + ART.width / 2 - ((e.minX + e.maxX) / 2) * UNIT, 84 + ART.height - e.maxY * UNIT];
  const [col, row] = [index % 2, Math.floor(index / 2)];
  const [x0, y0] = [40 + col * 700, 150 + row * 560];
  const roof = SWATCHES[ROOF_MATS[asset]];
  const swatches = [...new Set(design.parts.map((p) => p.mat))]
    .map((mat, i) => {
      const s = SWATCHES[mat];
      return `<g transform="translate(${i * 30},0)"><rect width="24" height="24" rx="5" fill="${s.bottom}"/><rect width="24" height="12" rx="5" fill="${s.top}"/><rect y="6" width="24" height="6" fill="${s.top}"/></g>`;
    })
    .join('');
  return `
  <g transform="translate(${x0},${y0})">
    <rect width="660" height="520" rx="18" fill="#fbf3e2"/>
    <path d="M18 0 H642 A18 18 0 0 1 660 18 V64 H0 V18 A18 18 0 0 1 18 0 Z" fill="${roof.bottom}"/>
    <path d="M18 0 H642 A18 18 0 0 1 660 18 V28 H0 V18 A18 18 0 0 1 18 0 Z" fill="${roof.top}"/>
    <text x="28" y="44" class="title">${NAMES[asset]}</text>
    <text x="632" y="42" class="motif" text-anchor="end">${design.motif}</text>
    <g transform="translate(${origin[0]!.toFixed(1)},${origin[1]!.toFixed(1)})">${ground(UNIT, defs)}${model(design, UNIT, defs)}</g>
    <g transform="translate(575,420)">${silhouette(design, 12)}</g>
    <text x="575" y="470" class="note" text-anchor="middle">桌面距離剪影</text>
    <g transform="translate(28,462)">${swatches}</g>
    <text x="28" y="506" class="note">高 ${max[1].toFixed(1)} 單位・${design.parts.length} 個零件</text>
  </g>`;
}

const defs: string[] = [];
const panels = ORDER.map((asset, i) => panel(asset, i, defs)).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 1440 1290">
  <style>
    text { font-family: 'Noto Serif TC', 'Songti TC', 'PingFang TC', serif; }
    .title { font-size: 30px; font-weight: 700; fill: #fffaf0; }
    .motif { font-size: 18px; fill: #fffaf0; }
    .note { font-size: 15px; fill: #5b4631; }
    .head { font-size: 40px; font-weight: 700; fill: #fbf3e2; }
    .sub { font-size: 18px; fill: #cfe3ee; }
  </style>
  <defs>${defs.join('')}</defs>
  <rect width="1440" height="1290" fill="#2d5d7c"/>
  <g stroke="#3b6d8e" stroke-width="1">${Array.from({ length: 24 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="1290"/>`).join('')}${Array.from({ length: 22 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="1440" y2="${i * 60}"/>`).join('')}</g>
  <text x="40" y="72" class="head">黑市商會・資產建築設計圖</text>
  <text x="40" y="110" class="sub">低面數＋倒角｜Kenney 色表漸層材質（上亮下暗、帶色相偏移）｜各資產專屬屋頂色｜旗幟為持有者顏色（示意為紅）</text>
  ${panels}
</svg>`;

console.log(svg);
