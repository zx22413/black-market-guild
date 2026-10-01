import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { PlaneGeometry, type Mesh } from 'three';
import type { SeaPoint } from './islandShape';
import { createSeaMaterial, setShores } from './seaFoam';
import { useSwell } from './SwellContext';

/** Clear-day travel speed of the waves, in radians per second. */
const WAVE_SPEED = 0.6;
/** Rest height of the sea surface and the clear-day crest above it (sum of the two rolling waves). */
const SEA_LEVEL = -0.3;
const CLEAR_CREST = 0.45;

/**
 * Rolling sea, smooth-shaded so taller waves read as soft swells instead of a mosaic of facets;
 * how tall and fast the waves are, and how much foam churns at the shores, follows the voyage event.
 */
interface SeaProps {
  readonly color: string;
  /** Island waterlines in world space, for the shore foam. */
  readonly shores: readonly (readonly SeaPoint[])[];
}

export function Sea({ color, shores }: SeaProps) {
  const swell = useSwell();
  const mesh = useRef<Mesh>(null);
  // Wave phase accumulated per frame, so a change of speed never makes the waves jump.
  const phase = useRef(0);
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
  useEffect(() => () => sea.material.dispose(), [sea]);
  const rest = useMemo(() => Float32Array.from(geometry.attributes.position!.array), [geometry]);

  useFrame((_, delta) => {
    const { height, speed, foam } = swell.current;
    phase.current += delta * WAVE_SPEED * speed;
    const t = phase.current;
    const position = geometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const x = rest[i * 3]!;
      const z = rest[i * 3 + 2]!;
      position.setY(i, (Math.sin(x * 0.15 + t) * 0.25 + Math.cos(z * 0.18 + t * 0.8) * 0.2) * height);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    // Rough seas sink half their extra height, so crests stay under the sea lanes and troughs stay
    // above the islands' cliff bottoms.
    sea.uniforms.uFoam.value = foam;
    sea.uniforms.uTime.value = t;
    if (mesh.current) mesh.current.position.y = SEA_LEVEL - (Math.max(0, height - 1) * CLEAR_CREST) / 2;
  });

  return (
    <mesh ref={mesh} geometry={geometry} material={sea.material} position={[0, SEA_LEVEL, 0]} receiveShadow />
  );
}
