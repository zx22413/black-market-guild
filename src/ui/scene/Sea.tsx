import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { PlaneGeometry, type Mesh } from 'three';
import type { SeaPoint } from './islandShape';
import { perfFlags } from './perfFlags';
import { createSeaMaterial, setShores } from './seaFoam';
import { SEA_LEVEL, seaSink, waveHeight } from './seaWave';
import { useSwell, useWavePhase } from './SwellContext';

/**
 * Rolling sea, smooth-shaded so taller waves read as soft swells instead of a mosaic of facets;
 * how tall and fast the waves are, and how much foam churns at the shores, follows the voyage event.
 */
interface SeaProps {
  readonly color: string;
  /** Island waterlines in world space, for the shore foam. */
  readonly shores: readonly (readonly SeaPoint[])[];
  /** How much the sea darkens toward the corners around the islands, 0..1. */
  readonly vignette?: number;
  /** White wave lines on open water, 0..1, and how faintly the foam glows, 0..1. */
  readonly lines?: number;
  readonly glow?: number;
}

/** The flat open water round the moving sea: wide enough to fill any window, just below the troughs. */
const SKIRT_SIZE = 4000;
const SKIRT_DROP = 0.6;

export function Sea({ color, shores, vignette = 0, lines = 0, glow = 0 }: SeaProps) {
  const swell = useSwell();
  const phase = useWavePhase();
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(400, 400, 80, 80);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const sea = useMemo(() => createSeaMaterial(), []);
  const skirt = useMemo(() => {
    const g = new PlaneGeometry(SKIRT_SIZE, SKIRT_SIZE, 1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useEffect(() => () => skirt.dispose(), [skirt]);
  useEffect(() => {
    sea.material.color.set(color);
  }, [sea, color]);
  useEffect(() => setShores(sea.uniforms, shores), [sea, shores]);
  useEffect(() => {
    sea.uniforms.uVignette.value = vignette;
    sea.uniforms.uLines.value = lines;
    sea.uniforms.uGlow.value = glow;
  }, [sea, vignette, lines, glow]);
  useEffect(() => () => sea.material.dispose(), [sea]);
  const rest = useMemo(() => Float32Array.from(geometry.attributes.position!.array), [geometry]);

  useFrame(() => {
    if (perfFlags.seaFrozen) return;
    const { height, foam } = swell.current;
    const t = phase.current;
    const position = geometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const x = rest[i * 3]!;
      const z = rest[i * 3 + 2]!;
      position.setY(i, waveHeight(x, z, t, height));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    sea.uniforms.uFoam.value = foam;
    sea.uniforms.uTime.value = t;
    if (mesh.current) mesh.current.position.y = SEA_LEVEL - seaSink(height);
  });

  return (
    <>
      <mesh ref={mesh} geometry={geometry} material={sea.material} position={[0, SEA_LEVEL, 0]} receiveShadow />
      {/* Open water past the moving sea, out to the horizon in every direction: a wide window (or a
          far camera) never sees the edge of the table. Same material, flat, a little below the waves. */}
      <mesh geometry={skirt} material={sea.material} position={[0, SEA_LEVEL - SKIRT_DROP, 0]} />
    </>
  );
}
