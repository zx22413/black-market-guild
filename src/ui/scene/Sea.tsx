import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { PlaneGeometry, type Mesh } from 'three';

/** Gently rolling low-poly sea; vertices bob on a slow sine pattern. */
export function Sea({ color }: { readonly color: string }) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(400, 400, 80, 80);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const rest = useMemo(() => Float32Array.from(geometry.attributes.position!.array), [geometry]);

  useFrame(({ clock }) => {
    const position = geometry.attributes.position!;
    const t = clock.elapsedTime * 0.6;
    for (let i = 0; i < position.count; i++) {
      const x = rest[i * 3]!;
      const z = rest[i * 3 + 2]!;
      position.setY(i, Math.sin(x * 0.15 + t) * 0.25 + Math.cos(z * 0.18 + t * 0.8) * 0.2);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh ref={mesh} geometry={geometry} position={[0, -0.3, 0]} receiveShadow>
      <meshStandardMaterial color={color} flatShading roughness={0.6} metalness={0.1} />
    </mesh>
  );
}
