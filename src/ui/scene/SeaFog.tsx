import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { FOG_AREA, FOG_TEXTURES, fogBanks, wrapAcross } from './fogMath';
import { WIND_DIRECTION } from './windMath';

/** How fast the fog banks drift downwind, in units per second. */
const DRIFT_SPEED = 1.4;
const OPACITY = 0.48;
/** Puff footprint relative to its size: a little longer along the wind than across it. */
const STRETCH = { along: 1.5 * 1.82, across: 1.82 } as const;
/** Seconds for the fog to roll in after the event is revealed. */
const FADE_IN = 3;
/** Puffs fade out over this outer share of the drift area, so wrapping around never pops. */
const EDGE = 0.2;
/** Turn that lays a puff's long side along the wind. */
const WIND_TURN = Math.atan2(-WIND_DIRECTION[1], WIND_DIRECTION[0]);

/** Deterministic value in [0, 1) so each puff texture keeps its shape. */
const hash = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** A soft, lumpy white puff: several overlapping radial gradients fading to clear at the edge. */
function puffTexture(variant: number): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let i = 0; i < 7; i++) {
      const cx = size * (0.3 + hash(i, variant * 3 + 1) * 0.4);
      const cy = size * (0.3 + hash(i, variant * 3 + 2) * 0.4);
      const r = size * (0.16 + hash(i, variant * 3 + 3) * 0.16);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      // Falls off early, so each lump's edge fades out softly.
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.2)');
      g.addColorStop(0.75, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  }
  return new CanvasTexture(canvas);
}

const edgeFade = (value: number, half: number) => Math.min(1, (1 - Math.abs(value) / half) / EDGE);

/**
 * Sea fog: low, soft banks of mist lying on the water, drifting downwind with the wind lines and
 * the rain and slowly thickening and thinning. Island cliffs, docks and ships stand up out of it.
 */
export function SeaFog() {
  const banks = useMemo(() => fogBanks(Math.random), []);
  const textures = useMemo(() => Array.from({ length: FOG_TEXTURES }, (_, i) => puffTexture(i)), []);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  const groups = useRef<(Group | null)[]>([]);
  const age = useRef(0);

  useFrame(({ clock }, delta) => {
    age.current += Math.min(delta, 0.1);
    const t = clock.elapsedTime;
    const fadeIn = Math.min(1, age.current / FADE_IN);
    const drift = t * DRIFT_SPEED;
    banks.forEach((bank, i) => {
      const group = groups.current[i];
      if (!group) return;
      const x = wrapAcross(bank.x + WIND_DIRECTION[0] * drift, FOG_AREA.x);
      const z = wrapAcross(bank.z + WIND_DIRECTION[1] * drift, FOG_AREA.z);
      group.position.set(x, 0, z);
      const edge = Math.max(0, Math.min(edgeFade(x, FOG_AREA.x), edgeFade(z, FOG_AREA.z)));
      group.children.forEach((child, j) => {
        const puff = bank.puffs[j]!;
        const breathe = 0.7 + 0.3 * Math.sin(t * 0.25 + puff.phase);
        ((child as Mesh).material as MeshBasicMaterial).opacity = OPACITY * breathe * fadeIn * edge;
      });
    });
  });

  return (
    <>
      {banks.map((bank, i) => (
        <group
          key={i}
          ref={(g) => {
            groups.current[i] = g;
          }}
        >
          {bank.puffs.map((puff, j) => (
            <mesh key={j} position={[puff.dx, puff.height, puff.dz]} rotation={[-Math.PI / 2, 0, WIND_TURN]} scale={[puff.size * STRETCH.along, puff.size * STRETCH.across, 1]}>
              <planeGeometry />
              <meshBasicMaterial map={textures[puff.texture] ?? null} color="#f3f6f6" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
