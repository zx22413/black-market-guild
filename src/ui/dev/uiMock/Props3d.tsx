import { useEffect, useMemo, useState } from 'react';
import type { CanvasTexture } from 'three';
import type { Vec3 } from '../../scene/layout';
import { TEX_ROOT, drawCoin, drawNails, fillMaterial, fitText, fontsReady, loadImage, paintBand, rng, toTexture } from './paint';

/**
 * 3D props for the "props" mock-up: guild information painted on objects standing on the
 * table instead of floating panels. Dev-only; not wired to the engine.
 */

const WOOD_DARK = '#5a3a22';

/** Yellow and other pale seat colors take dark ink. */
function isLight(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 165;
}
const WOOD_EDGE = '#3e2715';
const BOARD_TILT = -0.9;
/** Board width in table units; the camera sees about 6.5 px per unit at 1600×900. */
const SIGN_WIDTH = 21;

function usePainted(draw: (ctx: CanvasRenderingContext2D) => Promise<void>, w: number, h: number, key: string): CanvasTexture | null {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    let alive = true;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx)
      .then(() => {
        if (alive) setTexture(toTexture(canvas));
      })
      .catch((error: unknown) => console.error('ui-mock paint failed', error));
    return () => {
      alive = false;
    };
    // `key` captures everything `draw` depends on.
  }, [key, w, h]);
  return texture;
}

export interface SignInfo {
  readonly name: string;
  readonly cash: number;
  readonly color: string;
  readonly ready: boolean;
  readonly status: { readonly text: string; readonly dot: string | null } | null;
}

function useBoardTexture(info: SignInfo, font: string, seed: number) {
  return usePainted(
    async (ctx) => {
      const [wood] = await Promise.all([loadImage(`${TEX_ROOT}/wood.jpg`), fontsReady(font)]);
      const w = 1024;
      const h = 480;
      fillMaterial(ctx, wood, w, h, '#e0b890');
      paintBand(ctx, 0, 0, w, 196, info.color, seed);
      drawNails(ctx, w, h, 26);
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = isLight(info.color) ? '#2b1d10' : '#fff8e6';
      if (isLight(info.color)) ctx.shadowColor = 'rgba(255,240,200,.5)';
      ctx.font = `700 138px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(fitText(ctx, info.name, info.ready ? 800 : 920), w / 2 - (info.ready ? 50 : 0), 100);
      if (info.ready) {
        ctx.font = `700 110px ${font}`;
        ctx.fillText('✓', w - 95, 100);
      }
      ctx.shadowBlur = 0;
      const r = rng(seed + 7);
      const text = String(info.cash);
      ctx.font = `700 170px Palatino, 'Book Antiqua', serif`;
      const numW = ctx.measureText(text).width;
      // With a status label on the right, the amount moves into the left part of the board.
      const centre = info.status ? w * 0.36 : w / 2;
      const left = centre - (numW + 150) / 2;
      drawCoin(ctx, left + 60, 340, 58);
      ctx.save();
      ctx.translate(left + 150 + numW / 2, 345);
      ctx.rotate((r() - 0.5) * 0.04);
      ctx.fillStyle = '#fbeed0';
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(text, 0, 0);
      ctx.restore();
      if (info.status) {
        const paper = await loadImage(`${TEX_ROOT}/parchment.jpg`);
        ctx.save();
        ctx.translate(w - 200, h - 80);
        ctx.rotate(-0.06);
        ctx.shadowColor = 'rgba(0,0,0,.5)';
        ctx.shadowBlur = 10;
        ctx.drawImage(paper, 0, 0, 500, 190, -180, -66, 360, 132);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2b1d10';
        ctx.font = `700 96px ${font}`;
        ctx.textAlign = 'center';
        ctx.fillText(info.status.text, info.status.dot ? -34 : 0, 6);
        if (info.status.dot) {
          ctx.translate(92, 4);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = info.status.dot;
          ctx.fillRect(-24, -24, 48, 48);
          ctx.strokeStyle = '#2b1d10';
          ctx.lineWidth = 5;
          ctx.strokeRect(-24, -24, 48, 48);
        }
        ctx.restore();
      }
    },
    1024,
    480,
    `${info.name}|${info.cash}|${info.color}|${info.ready}|${info.status?.text}|${info.status?.dot}|${font}`,
  );
}

/** A lectern-style sign board on two posts, tilted toward the table camera. */
export function SignPost({ position, info, font, seed }: { readonly position: Vec3; readonly info: SignInfo; readonly font: string; readonly seed: number }) {
  const board = useBoardTexture(info, font, seed);
  const width = SIGN_WIDTH;
  const height = width * (480 / 1024);
  return (
    <group position={position}>
      {[-width / 2 + 1, width / 2 - 1].map((x) => (
        <mesh key={x} position={[x, 5, -1.6]} castShadow>
          <boxGeometry args={[0.7, 10, 0.7]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
      ))}
      <group position={[0, 10.5, 0]} rotation={[BOARD_TILT, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[width + 0.5, height + 0.5, 0.45]} />
          <meshStandardMaterial color={WOOD_EDGE} flatShading />
        </mesh>
        {board && (
          <mesh position={[0, 0, 0.5]}>
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial map={board} roughness={0.85} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function useTrackerTexture(round: number, total: number, phase: string, font: string) {
  return usePainted(
    async (ctx) => {
      const [wood] = await Promise.all([loadImage(`${TEX_ROOT}/wood.jpg`), fontsReady(font)]);
      fillMaterial(ctx, wood, 1024, 300, '#e6c49c');
      drawNails(ctx, 1024, 300, 22);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff4dc';
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 6;
      ctx.font = `700 124px ${font}`;
      ctx.textAlign = 'left';
      ctx.fillText(`第 ${round} 回合`, 60, 106);
      ctx.font = `400 80px ${font}`;
      ctx.fillStyle = '#f1dcae';
      ctx.fillText(phase, 600, 112);
      ctx.shadowBlur = 0;
      for (let i = 0; i < total; i++) {
        const x = 110 + i * 150;
        ctx.beginPath();
        ctx.arc(x, 228, 34, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30,18,8,.65)';
        ctx.fill();
        if (i < round) drawCoin(ctx, x, 228, 30);
      }
    },
    1024,
    300,
    `${round}|${total}|${phase}|${font}`,
  );
}

/** Round tracker: a floating plank with one coin per round played. */
export function RoundTracker({ position, round, total, phase, font }: { readonly position: Vec3; readonly round: number; readonly total: number; readonly phase: string; readonly font: string }) {
  const texture = useTrackerTexture(round, total, phase, font);
  const w = 30;
  const h = w * (300 / 1024);
  return (
    <group position={position} rotation={[-0.95, -0.08, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.5, h + 0.5, 0.5]} />
        <meshStandardMaterial color={WOOD_EDGE} flatShading />
      </mesh>
      {texture && (
        <mesh position={[0, 0, 0.5]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={texture} roughness={0.85} />
        </mesh>
      )}
    </group>
  );
}
