import { useEffect, useMemo } from 'react';
import { CylinderGeometry, MeshStandardMaterial } from 'three';
import type { Vec3 } from '../../scene/layout';
import { SWATCHES } from '../../scene/buildings/materials';
import { rng } from './paint';

/**
 * Gold coins drawn like the rest of the table: a few flat-shaded faces in the Kenney gold
 * swatch, no metal or reflections (docs/art/lowpoly-style.md). A thin raised disc on each face
 * reads as the stamp, so a stack looks like coins and not ingots.
 */

const RADIUS = 1.25;
const THICKNESS = 0.36;
const SIDES = 10;

function useCoinParts() {
  const parts = useMemo(() => {
    const body = new CylinderGeometry(RADIUS, RADIUS, THICKNESS, SIDES);
    const face = new CylinderGeometry(RADIUS * 0.72, RADIUS * 0.72, 0.05, SIDES);
    // Cylinder groups: side, top, bottom.
    const bodyMaterials = [
      new MeshStandardMaterial({ color: SWATCHES.roofGold.bottom, roughness: 0.75, flatShading: true }),
      new MeshStandardMaterial({ color: SWATCHES.gold.bottom, roughness: 0.7, flatShading: true }),
      new MeshStandardMaterial({ color: SWATCHES.roofGold.bottom, roughness: 0.75, flatShading: true }),
    ];
    const faceMaterial = new MeshStandardMaterial({ color: SWATCHES.gold.top, roughness: 0.65, flatShading: true });
    return { body, face, bodyMaterials, faceMaterial };
  }, []);
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.face.dispose();
      parts.bodyMaterials.forEach((m) => m.dispose());
      parts.faceMaterial.dispose();
    },
    [parts],
  );
  return parts;
}

/** Coins in neat piles of up to five; one coin per 100 G. */
export function CoinStack({ position, cash, seed }: { readonly position: Vec3; readonly cash: number; readonly seed: number }) {
  const { body, face, bodyMaterials, faceMaterial } = useCoinParts();
  const coins = useMemo(() => {
    const r = rng(seed);
    const count = Math.max(1, Math.round(cash / 100));
    return Array.from({ length: count }, (_, i) => {
      const pile = Math.floor(i / 5);
      const level = i % 5;
      return {
        x: pile * 2.7 + (r() - 0.5) * 0.18,
        y: THICKNESS / 2 + level * (THICKNESS + 0.02),
        z: (pile % 2) * 1.2 + (r() - 0.5) * 0.18,
        rot: r() * Math.PI,
        top: level === 4 || i === count - 1,
      };
    });
  }, [cash, seed]);
  return (
    <group position={position}>
      {coins.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} rotation={[0, c.rot, 0]}>
          <mesh geometry={body} material={bodyMaterials} castShadow receiveShadow />
          {c.top && <mesh geometry={face} material={faceMaterial} position={[0, THICKNESS / 2 + 0.02, 0]} />}
        </group>
      ))}
    </group>
  );
}
