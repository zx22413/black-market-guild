/**
 * Hand-drawn-look UI parts as SVG (npm run art:ui → public/art/ui/*.svg).
 *
 * Cartoon wood and parchment in the spirit of painted mobile-game UI: bold dark outlines, flat
 * base colors shaded by one smooth gradient, a few brush-like grain strokes,
 * chipped corners and nails. Jitter comes from a seeded generator, so the files are stable.
 * Frames and papers are drawn for CSS `border-image` 9-slicing: keep knots and nails inside
 * the corner slices, where they are never stretched. See docs/ui/style-guide.md.
 */

/** Node's fs, loaded untyped: the project compiles scripts without Node type definitions. */
interface Fs {
  mkdirSync(path: string, options: { recursive: boolean }): void;
  writeFileSync(path: string, data: string): void;
}
const NODE_FS = 'node:fs';
const OUT = new URL('../public/art/ui/', import.meta.url);

const WOOD = { base: '#bd7e43', light: '#dca264', dark: '#8b532a', grain: '#7b4520', outline: '#3d2211' } as const;
const PAPER = { base: '#f3e2bd', light: '#fbf0d6', burn: '#c89b5f', outline: '#6b4524' } as const;
const ROPE = { base: '#d2ab6b', shade: '#8e6434', outline: '#4f3217' } as const;

type Pt = readonly [number, number];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);
const poly = (pts: readonly Pt[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;

/** Rectangle outline with hand-cut edges: `steps` wobbly points per side, `chip` cut corners. */
function roughRect(x: number, y: number, w: number, h: number, jitter: number, r: () => number, steps = 6, chip = 5): Pt[] {
  const j = () => (r() - 0.5) * 2 * jitter;
  const pts: Pt[] = [];
  const side = (ax: number, ay: number, bx: number, by: number) => {
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      pts.push([ax + (bx - ax) * t + (i ? j() : 0), ay + (by - ay) * t + (i ? j() : 0)]);
    }
  };
  side(x + chip, y, x + w - chip, y);
  pts.push([x + w, y + chip]);
  side(x + w, y + chip, x + w, y + h - chip);
  pts.push([x + w - chip, y + h]);
  side(x + w - chip, y + h, x + chip, y + h);
  pts.push([x, y + h - chip]);
  side(x, y + h - chip, x, y + chip);
  return pts;
}

/** A brush stroke along the plank: a wavy line with rounded ends. */
function grainLine(x0: number, x1: number, y: number, amp: number, r: () => number, vertical: boolean): string {
  const n = 5;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = x0 + ((x1 - x0) * i) / n;
    const b = y + (r() - 0.5) * amp;
    pts.push(vertical ? [b, a] : [a, b]);
  }
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]!;
    const [cx, cy] = pts[i]!;
    d += ` Q${f(px)} ${f(py)} ${f((px + cx) / 2)} ${f((py + cy) / 2)}`;
  }
  return d;
}

function nail(x: number, y: number, size = 4.5): string {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${size}" fill="#4a3322" stroke="${WOOD.outline}" stroke-width="1.5"/><circle cx="${f(x - size * 0.3)}" cy="${f(y - size * 0.3)}" r="${f(size * 0.35)}" fill="#c9b79c"/>`;
}

let clipId = 0;
interface PlankOptions {
  readonly vertical?: boolean;
  readonly knots?: readonly Pt[];
  readonly grain?: number;
  readonly outline?: number;
}

/** One cartoon plank: outline, one smooth shading gradient, grain strokes, optional knots. */
function plank(x: number, y: number, w: number, h: number, seed: number, o: PlankOptions = {}): string {
  const r = rng(seed);
  const vertical = o.vertical ?? false;
  const shape = poly(roughRect(x, y, w, h, 1.6, r, 7, 6));
  const id = `c${clipId++}`;
  const across = vertical ? w : h;
  // One smooth light-to-shade gradient across the plank, not stacked color bands.
  const [x2, y2] = vertical ? [1, 0] : [0, 1];
  const shading = `<linearGradient id="${id}g" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${WOOD.light}"/><stop offset="0.45" stop-color="${WOOD.base}"/><stop offset="1" stop-color="${WOOD.dark}"/></linearGradient>`;
  const lines: string[] = [];
  const count = o.grain ?? 3;
  for (let i = 0; i < count; i++) {
    const pos = (vertical ? x : y) + across * (0.3 + (0.42 * (i + r() * 0.5)) / count);
    const len = vertical ? h : w;
    const start = (vertical ? y : x) + len * (r() * 0.25);
    const end = (vertical ? y : x) + len * (0.7 + r() * 0.3);
    lines.push(`<path d="${grainLine(start, end, pos, across * 0.08, r, vertical)}" fill="none" stroke="${WOOD.grain}" stroke-width="${f(2 + r() * 1.2)}" stroke-linecap="round" opacity="0.7"/>`);
  }
  const knots = (o.knots ?? [])
    .map(
      ([kx, ky]) =>
        `<ellipse cx="${f(kx)}" cy="${f(ky)}" rx="${vertical ? 4 : 9}" ry="${vertical ? 9 : 4}" fill="none" stroke="${WOOD.grain}" stroke-width="2" opacity="0.8"/><ellipse cx="${f(kx)}" cy="${f(ky)}" rx="${vertical ? 1.6 : 3.5}" ry="${vertical ? 3.5 : 1.6}" fill="${WOOD.grain}" opacity="0.8"/>`,
    )
    .join('');
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath>${shading}<g clip-path="url(#${id})"><path d="${shape}" fill="url(#${id}g)"/>${lines.join('')}${knots}</g><path d="${shape}" fill="none" stroke="${WOOD.outline}" stroke-width="${o.outline ?? 3.5}" stroke-linejoin="round"/>`;
}

/** Strength of the speckle texture on paper fills (wood and outlines stay clean). */
const GRAIN_STRENGTH = 0.6;

/**
 * Speckled grain clipped to the drawing: dark specks where the noise is high, light ones where
 * it is low, so the surface gets texture without getting darker overall.
 */
function grainFilter(w: number, h: number): string {
  const k = GRAIN_STRENGTH;
  return `<filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.13  0 0 0 0 0.05  ${k} 0 0 0 ${-k / 2}" result="dark"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.86  ${-k} 0 0 0 ${k / 2}" result="light"/><feMerge result="specks"><feMergeNode in="dark"/><feMergeNode in="light"/></feMerge><feComposite in="specks" in2="SourceGraphic" operator="in" result="grain"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/></feMerge></filter>`;
}

/** An SVG document; with `grain`, fills wrapped in `url(#grain)` get the speckle texture. */
function svg(w: number, h: number, body: string, defs = '', grain = true): string {
  const allDefs = `${defs}${grain ? grainFilter(w, h) : ''}`;
  const content = body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${allDefs ? `<defs>${allDefs}</defs>` : ''}${content}</svg>\n`;
}

/** Big wooden frame for 9-slicing at 72px: side posts under the top and bottom beams. */
function frame(): string {
  const W = 480;
  const H = 360;
  const t = 52;
  const m = 6;
  return svg(
    W,
    H,
    [
      plank(m + 4, m + 18, t, H - 2 * m - 36, 11, { vertical: true, knots: [[m + 30, 50]] }),
      plank(W - m - 4 - t, m + 18, t, H - 2 * m - 36, 12, { vertical: true, knots: [[W - m - 30, H - 55]] }),
      plank(m, m, W - 2 * m, t, 13, { knots: [[48, m + 28]] }),
      plank(m, H - m - t, W - 2 * m, t, 14, { knots: [[W - 50, H - m - 26]] }),
      // Inner edge: a dark lip where the paper sits.
      `<rect x="${m + t + 1}" y="${m + t - 2}" width="${W - 2 * (m + t + 1)}" height="${H - 2 * (m + t - 2)}" fill="none" stroke="${WOOD.outline}" stroke-width="4" opacity="0.55"/>`,
      nail(m + 22, m + 24),
      nail(W - m - 22, m + 24),
      nail(m + 22, H - m - 24),
      nail(W - m - 22, H - m - 24),
    ].join(''),
  );
}

/** Parchment sheet for 9-slicing at 44px: uneven edge, burnt rim fading inward. */
function parchment(): string {
  const W = 400;
  const H = 300;
  const r = rng(21);
  const edge = poly(roughRect(5, 5, W - 10, H - 10, 2.2, r, 10, 8));
  const defs = `<clipPath id="p"><path d="${edge}"/></clipPath><filter id="blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>`;
  return svg(
    W,
    H,
    `<g clip-path="url(#p)"><g filter="url(#grain)"><path d="${edge}" fill="${PAPER.base}"/><path d="${edge}" fill="none" stroke="${PAPER.burn}" stroke-width="34" filter="url(#blur)" opacity="0.75"/><ellipse cx="38" cy="${H - 40}" rx="22" ry="14" fill="${PAPER.burn}" opacity="0.18"/><ellipse cx="${W - 44}" cy="34" rx="16" ry="11" fill="${PAPER.burn}" opacity="0.16"/></g></g><path d="${edge}" fill="none" stroke="${PAPER.outline}" stroke-width="2.5" stroke-linejoin="round" opacity="0.8"/>`,
    defs,
  );
}

/** Title plaque: a wooden board with a torn paper sheet nailed on; text goes on top in HTML. */
function plaque(): string {
  const W = 360;
  const H = 130;
  const r = rng(31);
  const paper = poly(roughRect(34, 22, W - 68, H - 44, 4.5, r, 12, 10));
  return svg(
    W,
    H,
    `<g transform="rotate(-1.5 ${W / 2} ${H / 2})">${plank(8, 16, W - 16, H - 32, 32, { grain: 4, outline: 4, knots: [[26, H / 2]] })}</g>` +
      `<g transform="rotate(1 ${W / 2} ${H / 2})"><g filter="url(#grain)"><path d="${paper}" fill="${PAPER.base}"/></g><path d="${paper}" fill="none" stroke="${PAPER.burn}" stroke-width="10" opacity="0.45"/><path d="${paper}" fill="none" stroke="${PAPER.outline}" stroke-width="2.5" stroke-linejoin="round"/></g>` +
      nail(24, 34) +
      nail(W - 24, H - 34),
  );
}

/** Arrow-shaped plank button pointing right. */
function arrowButton(): string {
  const W = 260;
  const H = 84;
  const r = rng(41);
  const j = () => (r() - 0.5) * 3;
  const tip = 40;
  const shape: Pt[] = [
    [8, 12 + j()],
    [W / 2, 10 + j()],
    [W - tip, 8],
    [W - tip + 2, 2],
    [W - 4, H / 2],
    [W - tip + 2, H - 2],
    [W - tip, H - 8],
    [W / 2, H - 10 + j()],
    [8, H - 12 + j()],
    [4, H / 2 + j()],
  ];
  const d = poly(shape);
  const lines = [0.38, 0.62]
    .map((p) => `<path d="${grainLine(26, W - tip - 10, H * p, 6, r, false)}" fill="none" stroke="${WOOD.grain}" stroke-width="2.4" stroke-linecap="round" opacity="0.65"/>`)
    .join('');
  return svg(
    W,
    H,
    `<clipPath id="a"><path d="${d}"/></clipPath><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${WOOD.light}"/><stop offset="0.45" stop-color="${WOOD.base}"/><stop offset="1" stop-color="${WOOD.dark}"/></linearGradient><g clip-path="url(#a)"><path d="${d}" fill="url(#ag)"/>${lines}</g><path d="${d}" fill="none" stroke="${WOOD.outline}" stroke-width="4" stroke-linejoin="round"/>${nail(24, H / 2)}`,
  );
}

/** Small plank for 9-sliced tag buttons (slice 20). */
function tag(): string {
  return svg(180, 60, plank(3, 4, 174, 52, 51, { grain: 2, outline: 3 }));
}

/** Round wooden token button: a log slice with growth rings. */
function roundButton(): string {
  const S = 88;
  const c = S / 2;
  const r = rng(61);
  const ring = (rad: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rr = rad + (r() - 0.5) * 2;
      pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]);
    }
    return poly(pts);
  };
  return svg(
    S,
    S,
    `<path d="${ring(40)}" fill="${WOOD.dark}" stroke="${WOOD.outline}" stroke-width="3.5" stroke-linejoin="round"/><path d="${ring(33)}" fill="${WOOD.base}"/><path d="${ring(33)}" fill="none" stroke="${WOOD.light}" stroke-width="3" opacity="0.6" transform="translate(-1 -1.5)"/><path d="${ring(22)}" fill="none" stroke="${WOOD.grain}" stroke-width="2" opacity="0.55"/><path d="${ring(12)}" fill="none" stroke="${WOOD.grain}" stroke-width="2" opacity="0.5"/>`,
  );
}

/** A draped rope; the twist is a dash pattern over the rope body. */
function rope(): string {
  const W = 320;
  const H = 70;
  const d = `M6 10 C 80 60, 180 70, 314 22`;
  return svg(
    W,
    H,
    `<path d="${d}" fill="none" stroke="${ROPE.outline}" stroke-width="13" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${ROPE.base}" stroke-width="9" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${ROPE.shade}" stroke-width="9" stroke-dasharray="3 6" opacity="0.8"/><circle cx="6" cy="10" r="6" fill="${ROPE.base}" stroke="${ROPE.outline}" stroke-width="2.5"/><circle cx="314" cy="22" r="6" fill="${ROPE.base}" stroke="${ROPE.outline}" stroke-width="2.5"/>`,
  );
}

function pencil(): string {
  return svg(
    32,
    32,
    `<g transform="rotate(45 16 16)" stroke="${WOOD.outline}" stroke-width="2" stroke-linejoin="round"><rect x="12" y="3" width="8" height="18" fill="#6b4524"/><path d="M12 21 L16 29 L20 21 Z" fill="#e9d2a6"/><path d="M15 27 L16 29 L17 27 Z" fill="${WOOD.outline}"/></g>`,
    '',
    false,
  );
}

function plus(): string {
  return svg(
    64,
    64,
    `<circle cx="32" cy="32" r="26" fill="none" stroke="#7a5a3a" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/><path d="M32 21 V43 M21 32 H43" stroke="#7a5a3a" stroke-width="4" stroke-linecap="round"/>`,
    '',
    false,
  );
}

/** Small parchment for HUD tags, notes and cards (9-slice at 16px). */
function paperSmall(): string {
  const W = 160;
  const H = 100;
  const r = rng(71);
  const edge = poly(roughRect(3, 3, W - 6, H - 6, 1.2, r, 8, 4));
  const defs = `<clipPath id="ps"><path d="${edge}"/></clipPath><filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>`;
  return svg(
    W,
    H,
    `<g clip-path="url(#ps)"><g filter="url(#grain)"><path d="${edge}" fill="${PAPER.base}"/><path d="${edge}" fill="none" stroke="${PAPER.burn}" stroke-width="12" filter="url(#soft)" opacity="0.7"/></g></g><path d="${edge}" fill="none" stroke="${PAPER.outline}" stroke-width="2" stroke-linejoin="round" opacity="0.85"/>`,
    defs,
  );
}

/** A small board of three nailed planks, for paper pinned onto wood (drawn to size, not sliced). */
function boardWood(): string {
  const W = 260;
  const H = 180;
  const gap = 3;
  const h = (H - 8 - 2 * gap) / 3;
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const y = 4 + i * (h + gap);
    parts.push(plank(3 + (i % 2) * 3, y, W - 9, h, 91 + i, { grain: 2, outline: 3, knots: i === 1 ? [[W - 40, y + h / 2]] : [] }));
    parts.push(nail(16 + (i % 2) * 3, y + h / 2, 3.5), nail(W - 14, y + h / 2, 3.5));
  }
  return svg(W, H, parts.join(''));
}

/**
 * Masks for the seat-colored rope on name tags: the rope's color comes from CSS, so the shape is
 * a mask (white = rope). `outer` is the dark outline, `inner` the colored body, same path.
 */
const ROPE_V = 'M8 7 C 12.5 22, 3.5 36, 8 52 S 12.5 80, 8 94';
function ropeMask(width: number): () => string {
  return () =>
    svg(
      16,
      100,
      `<path d="${ROPE_V}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round"/><circle cx="8" cy="6" r="${width / 2 + 1.5}" fill="#fff"/>`,
      '',
      false,
    );
}

const FILES: Record<string, () => string> = {
  'rope-mask-outer.svg': ropeMask(9),
  'rope-mask-inner.svg': ropeMask(6),
  'board-wood.svg': boardWood,
  'paper-small.svg': paperSmall,
  'frame-wood.svg': frame,
  'paper.svg': parchment,
  'plaque.svg': plaque,
  'button-arrow.svg': arrowButton,
  'button-tag.svg': tag,
  'button-round.svg': roundButton,
  'rope.svg': rope,
  'icon-pencil.svg': pencil,
  'icon-plus.svg': plus,
};

const fs = (await import(NODE_FS)) as Fs;
fs.mkdirSync(OUT.pathname, { recursive: true });
for (const [name, draw] of Object.entries(FILES)) {
  fs.writeFileSync(new URL(name, OUT).pathname, draw());
}
console.log(`wrote ${Object.keys(FILES).length} files to ${OUT.pathname}`);
