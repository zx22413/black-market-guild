import { useEffect, useRef } from 'react';
import { SLOWMO } from '../scene/cameraHandoff';
import { BANDS, bandSpan, crestAt, dropAt, sprayFor, WIPE_MS, type Band } from './waveWipeMath';

// The breaking wave over the lens (waveWipeMath has the shapes and the timing): drawn on one canvas, frame by frame, by
// wall-clock time from `delay` ms after it mounts. Three bands (deep, mid, crest), the crest's cream foam with an ink line
// under it, spray off the crest, a lacy foam tail, and a faint grain on the water.

const COLORS = {
  bands: ['#1b5a66', '#2c7f8c', '#4fa3a6'],
  /** Each band's water near its crest (lighter) and deep down (darker). */
  tops: ['#2a7180', '#3f98a3', '#6cbcbc'],
  depths: ['#123f49', '#1d5f6b', '#2e7f88'],
  streak: '#bfe6df',
  highlight: '#8fd0c8',
  foam: '#f7f0dc',
  ink: '#12434c',
} as const;
/** Sample spacing along an edge (px). */
const STEP = 6;
const SPRAY_COUNT = 32;
/** Canvas pixels per CSS pixel at most: the wave is soft, phones need not draw it at 3×. */
const MAX_DPR = 1.5;

/** A grain tile, made once: dark and light specks, laid over the water at a few percent. */
export function grainTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 96;
  const g = tile.getContext('2d');
  if (!g) return tile;
  const img = g.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.sin(i * 12.9898) * 43758.5453) % 1 > 0 ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 40 + ((i * 7919) % 90);
  }
  g.putImageData(img, 0, 0);
  return tile;
}

/** The band's leading edge at each sample (px). */
function leadEdge(band: Band, t: number, w: number, lead: number): number[] {
  const ys: number[] = [];
  for (let x = 0; x <= w + STEP; x += STEP) ys.push(lead - band.crest * crestAt(x, t, band.seed));
  return ys;
}

/** The band's trailing edge (bumps hanging down) at each sample (px). */
function trailEdge(band: Band, t: number, w: number, trail: number): number[] {
  const ys: number[] = [];
  for (let x = 0; x <= w + STEP; x += STEP) ys.push(trail + band.crest * 0.6 * crestAt(x + 500, t, band.seed + 3));
  return ys;
}

function tracePath(g: CanvasRenderingContext2D, ys: readonly number[], dy = 0, reverse = false): void {
  const n = ys.length;
  for (let k = 0; k < n; k++) {
    const i = reverse ? n - 1 - k : k;
    const x = i * STEP;
    const y = ys[i]! + dy;
    if (k === 0 && !reverse) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
}

/**
 * A few light streaks inside a band, following its crest a little way below it, broken into dashes that drift: the
 * cartoon lines of moving water.
 */
function drawStreaks(g: CanvasRenderingContext2D, band: Band, ys: readonly number[], b: number, lead: number): void {
  g.strokeStyle = COLORS.streak;
  g.lineCap = 'round';
  g.lineWidth = 2 + b;
  for (let row = 0; row < 3; row++) {
    const below = band.crest * (0.55 + row * 0.7);
    g.globalAlpha = 0.28 - row * 0.07;
    g.beginPath();
    // Dashes: a stretch on, a stretch off, offset per row and band so they never line up.
    const on = 9 + row * 3;
    const off = 7 + ((row + b) % 3) * 4;
    const shift = (row * 5 + b * 7) % (on + off);
    for (let i = 0; i < ys.length; i++) {
      const phase = (i + shift) % (on + off);
      // Streaks rise toward the crests above them, flattened, so they read as part of the same swell.
      const y = lead + below + (ys[i]! - lead) * 0.45;
      if (phase === 0) g.moveTo(i * STEP, y);
      else if (phase < on) g.lineTo(i * STEP, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** The crest band's foam: a cream ribbon along the edge, thicker at the tips, with round lumps; an ink line under it. */
function drawFoam(g: CanvasRenderingContext2D, band: Band, ys: readonly number[], t: number, lead: number): void {
  const thick = (i: number) => 9 + 16 * Math.max(0, (lead - ys[i]!) / band.crest);
  g.beginPath();
  ys.forEach((y, i) => (i === 0 ? g.moveTo(0, y + thick(0) + 3) : g.lineTo(i * STEP, y + thick(i) + 3)));
  g.strokeStyle = COLORS.highlight;
  g.globalAlpha = 0.75;
  g.lineWidth = 3;
  g.stroke();
  g.globalAlpha = 1;
  g.beginPath();
  ys.forEach((y, i) => (i === 0 ? g.moveTo(0, y + 2.5) : g.lineTo(i * STEP, y + 2.5)));
  g.strokeStyle = COLORS.ink;
  g.lineWidth = 2.5;
  g.stroke();
  g.beginPath();
  tracePath(g, ys);
  for (let i = ys.length - 1; i >= 0; i--) g.lineTo(i * STEP, ys[i]! + thick(i));
  g.closePath();
  g.fillStyle = COLORS.foam;
  g.fill();
  // Lumps along the ribbon, every few samples, sized by how they drift.
  g.beginPath();
  for (let i = 2; i < ys.length; i += 7) {
    const r = 4 + 5 * (0.5 + 0.5 * Math.sin(i * 1.7 + t * 0.01));
    g.moveTo(i * STEP + r, ys[i]! + r * 0.4);
    g.arc(i * STEP, ys[i]! + r * 0.4, r, 0, Math.PI * 2);
  }
  g.fill();
}

/** The crest band's tail as it draws back: lace of foam bubbles along the edge, smaller ones left behind. */
function drawLace(g: CanvasRenderingContext2D, ys: readonly number[], t: number): void {
  g.fillStyle = COLORS.foam;
  g.globalAlpha = 0.9;
  g.beginPath();
  for (let i = 0; i < ys.length; i += 3) {
    const r = 2.5 + 4 * (0.5 + 0.5 * Math.sin(i * 2.3 + t * 0.008));
    g.moveTo(i * STEP + r, ys[i]!);
    g.arc(i * STEP, ys[i]!, r, 0, Math.PI * 2);
    if (i % 9 === 0) {
      const r2 = r * 0.5;
      const y2 = ys[i]! + 10 + 8 * Math.sin(i);
      g.moveTo(i * STEP + 4 + r2, y2);
      g.arc(i * STEP + 4, y2, r2, 0, Math.PI * 2);
    }
  }
  g.fill();
  g.globalAlpha = 1;
}

/** Draws the wipe `t` ms in (the wipe's own time) on a canvas `w`×`h` CSS px. Exported for checking single frames in dev. */
export function drawFrame(g: CanvasRenderingContext2D, t: number, w: number, h: number, grain: CanvasPattern | null, spray: ReturnType<typeof sprayFor>): void {
  g.clearRect(0, 0, w, h);
  BANDS.forEach((band, b) => {
    const bt = t - band.delay;
    if (bt <= 0) return;
    const { lead, trail } = bandSpan(bt, h, band.crest);
    if (trail < -band.crest * 2) return;
    const top = leadEdge(band, t, w, lead);
    const bottom = trailEdge(band, t, w, trail);
    g.beginPath();
    tracePath(g, top);
    tracePath(g, bottom, 0, true);
    g.closePath();
    // Lighter water under the crest, darker deeper down: the band reads as a body of water, not a stripe.
    const fill = g.createLinearGradient(0, lead - band.crest, 0, lead + h * 0.6);
    fill.addColorStop(0, COLORS.tops[b]!);
    fill.addColorStop(0.25, COLORS.bands[b]!);
    fill.addColorStop(1, COLORS.depths[b]!);
    g.fillStyle = fill;
    g.fill();
    drawStreaks(g, band, top, b, lead);
    const crestBand = b === BANDS.length - 1;
    if (crestBand) drawFoam(g, band, top, t, lead);
    else {
      g.beginPath();
      tracePath(g, top, 2);
      g.strokeStyle = COLORS.ink;
      g.globalAlpha = 0.6;
      g.lineWidth = 2;
      g.stroke();
      g.globalAlpha = 1;
    }
    if (crestBand && trail < h + band.crest) drawLace(g, bottom, t);
  });
  if (grain) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.08;
    g.fillStyle = grain;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  // The spray rides the crest: each drop hops up from where the crest band's edge is now and falls back onto it, so it
  // stays with the breaking wave instead of being left behind like snow.
  const crestBand = BANDS[BANDS.length - 1]!;
  g.fillStyle = COLORS.foam;
  g.strokeStyle = COLORS.ink;
  g.lineWidth = 1.5;
  for (const d of spray) {
    const from = bandSpan(t - crestBand.delay, h, crestBand.crest).lead - crestBand.crest * crestAt(d.x, t, crestBand.seed);
    const p = dropAt(d, t, from, h);
    if (!p) continue;
    g.globalAlpha = p.fade;
    g.beginPath();
    g.arc(p.x, p.y, d.r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** The wave over the lens, starting `delay` ms after it mounts. */
export function WaveWipe({ delay }: { readonly delay: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext('2d');
    if (!el || !g) return undefined;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grain = g.createPattern(grainTile(), 'repeat');
    const spray = sprayFor(w, h, SPRAY_COUNT);
    const start = performance.now() + delay;
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - start) / SLOWMO;
      if (t > WIPE_MS) {
        g.clearRect(0, 0, w, h);
        return;
      }
      raf = requestAnimationFrame(tick);
      if (t >= 0) drawFrame(g, t, w, h, grain, spray);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [delay]);
  return <canvas ref={canvas} className="wave-wipe" aria-hidden="true" />;
}
