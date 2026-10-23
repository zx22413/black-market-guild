import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { geometryFromParts } from './buildings/Building';
import { contrabandPile } from './marketDocks';

// The smugglers' pile on the market island's sand (marketDocks.contrabandPile): big crates with the
// game's name, CONTRABAY, sprayed through a stencil on their seaward faces and the cinnabar chop
// stamped beside it (the wordmark of src/ui-v07/skin/titleMark.tsx, H3-A). The mark is a canvas
// texture on a plane just off the face; the fonts are the ones index.html loads for the title.

const MARK = { width: 512, height: 256 } as const;
const PAINT = '#1d1510';
const CHOP = '#a3262f';

/** A small repeatable noise (mulberry32), so the spray's speckle is the same every time. */
function speckle(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws the stencilled name and the chop, then eats speckles out of the paint. */
function paintMark(canvas: HTMLCanvasElement): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const { width: w, height: h } = canvas;
  g.clearRect(0, 0, w, h);
  g.fillStyle = PAINT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 116px 'Stardos Stencil', 'Inter', sans-serif`;
  g.fillText('CONTRABAY', w / 2, h * 0.34, w * 0.98);
  // The chop: a red block with the four characters cut out.
  const size = h * 0.42;
  const [cx, cy] = [w * 0.8, h * 0.74];
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.1);
  g.fillStyle = CHOP;
  g.fillRect(-size / 2, -size / 2, size, size);
  g.globalCompositeOperation = 'destination-out';
  g.font = `900 ${size * 0.4}px 'Noto Serif TC', serif`;
  const q = size * 0.22;
  [['暗', -q, -q], ['潮', q, -q], ['商', -q, q], ['戰', q, q]].forEach(([c, x, y]) => g.fillText(c as string, x as number, (y as number) + size * 0.02));
  g.restore();
  // Spray wear: small holes through all the paint.
  g.globalCompositeOperation = 'destination-out';
  const rand = speckle(7);
  for (let i = 0; i < 1400; i++) {
    const r = 0.6 + rand() * 1.8;
    g.beginPath();
    g.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}

/** The mark's texture, repainted once the stencil and chop faces have loaded. */
function useMarkTexture(): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = MARK.width;
    canvas.height = MARK.height;
    paintMark(canvas);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => {
    let live = true;
    const faces = [`700 116px 'Stardos Stencil'`, `900 40px 'Noto Serif TC'`];
    void Promise.all(faces.map((f) => document.fonts.load(f, f.includes('Serif') ? '暗潮商戰' : 'CONTRABAY')))
      .catch(() => [])
      .then(() => {
        if (!live) return;
        paintMark(texture.image as HTMLCanvasElement);
        texture.needsUpdate = true;
      });
    return () => {
      live = false;
      texture.dispose();
    };
  }, [texture]);
  return texture;
}

export function ContrabandPile({ seatAngles }: { readonly seatAngles: readonly number[] }) {
  const key = seatAngles.map((a) => a.toFixed(4)).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pile = useMemo(() => contrabandPile(seatAngles), [key]);
  const geometry = useMemo(() => geometryFromParts(pile.parts), [pile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mark = useMarkTexture();
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      {pile.marks.map((m, i) => (
        <mesh key={i} position={[...m.at]} rotation={[0, m.yaw, 0]}>
          <planeGeometry args={[m.size[0], m.size[1]]} />
          <meshStandardMaterial map={mark} transparent alphaTest={0.4} depthWrite={false} polygonOffset polygonOffsetFactor={-2} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}
