import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { PlaneGeometry, type Mesh } from 'three';
import type { SeaPoint } from './islandShape';
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
    <mesh ref={mesh} geometry={geometry} material={sea.material} position={[0, SEA_LEVEL, 0]} receiveShadow />
  );
}
