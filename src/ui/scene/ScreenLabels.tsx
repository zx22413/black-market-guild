import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import { Vector3 } from 'three';
import type { Vec3 } from './layout';

export interface LabelAnchor {
  readonly id: string;
  readonly position: Vec3;
}

const projected = new Vector3();

/**
 * Keeps DOM labels pinned above 3D anchors. Lives inside the Canvas and writes transforms
 * straight to the elements each frame, so labels never trigger React re-renders.
 */
export function LabelTracker({
  anchors,
  elements,
}: {
  readonly anchors: readonly LabelAnchor[];
  readonly elements: RefObject<Map<string, HTMLElement>>;
}) {
  useFrame(({ camera, size }) => {
    for (const anchor of anchors) {
      const element = elements.current.get(anchor.id);
      if (!element) continue;
      projected.set(...anchor.position).project(camera);
      const x = ((projected.x + 1) / 2) * size.width;
      const y = ((1 - projected.y) / 2) * size.height;
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      element.style.visibility = projected.z < 1 ? 'visible' : 'hidden';
    }
  });
  return null;
}
