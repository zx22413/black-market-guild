import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import { Vector3 } from 'three';
import type { Vec3 } from './layout';

export interface LabelAnchor {
  readonly id: string;
  readonly position: Vec3;
  /**
   * Floating cards only: where to hang the label from (its top edge) when there is no room
   * above `position`. The label also stays inside the screen horizontally.
   */
  readonly flip?: Vec3;
}

/** Top band of the screen kept free for the event cards. */
const TOP_MARGIN = 96;
const SIDE_MARGIN = 8;

const projected = new Vector3();
const below = new Vector3();

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
      let x = ((projected.x + 1) / 2) * size.width;
      let y = ((1 - projected.y) / 2) * size.height;
      if (anchor.flip) {
        const half = element.offsetWidth / 2;
        x = Math.min(Math.max(x, half + SIDE_MARGIN), size.width - half - SIDE_MARGIN);
        const flipped = y - element.offsetHeight < TOP_MARGIN;
        if (flipped) y = ((1 - below.set(...anchor.flip).project(camera).y) / 2) * size.height;
        element.dataset['flip'] = flipped ? 'below' : 'above';
        element.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${flipped ? '0' : '-100%'})`;
        element.style.visibility = projected.z < 1 ? 'visible' : 'hidden';
        continue;
      }
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      element.style.visibility = projected.z < 1 ? 'visible' : 'hidden';
    }
  });
  return null;
}
