import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * Canvas painting helpers for the UI mock-up's 3D signs: text is drawn with the page's web
 * fonts into a texture, so names on props use the same typeface as the HUD.
 */

export const TEX_ROOT = '/docs/ui/mockups/tex';

const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let pending = images.get(src);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`cannot load ${src}`));
      img.src = src;
    });
    images.set(src, pending);
  }
  return pending;
}

/** Deterministic jitter so a sign looks hand-made but never changes between renders. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rough-edged band, like a stroke of paint. */
export function paintBand(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed: number) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const steps = 14;
  for (let i = 0; i <= steps; i++) ctx.lineTo(x + (w * i) / steps, y + (r() - 0.5) * h * 0.22);
  for (let i = steps; i >= 0; i--) ctx.lineTo(x + (w * i) / steps + (r() - 0.5) * 6, y + h + (r() - 0.5) * h * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Cuts text to fit `maxWidth`, ending with an ellipsis. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#fff3c4');
  g.addColorStop(0.45, '#d7ae5b');
  g.addColorStop(1, '#7a5620');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,45,15,.7)';
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawNails(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number) {
  for (const [x, y] of [
    [inset, inset],
    [w - inset, inset],
    [inset, h - inset],
    [w - inset, h - inset],
  ] as const) {
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
    g.addColorStop(0, '#d9d2c2');
    g.addColorStop(1, '#3a3027');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Wood (or parchment) fill with warm tint and darkened, uneven edges. */
export function fillMaterial(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, tint: string) {
  ctx.drawImage(img, 0, 0, img.width, img.width * (h / w), 0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  const edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
  edge.addColorStop(0, 'rgba(255,255,255,1)');
  edge.addColorStop(1, 'rgba(90,60,35,1)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function toTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export async function fontsReady(family: string): Promise<void> {
  await Promise.all([document.fonts.load(`700 64px ${family}`, '黑市商會'), document.fonts.load(`400 64px ${family}`, '黑市商會')]);
}
