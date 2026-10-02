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
  /**
   * Floating cards only: hang the label beside `side.position` instead, to its left (`dir` −1) or
   * right (+1), centered on it but kept clear of the top band. Used where above or below would
   * cover the middle of the table.
   */
  readonly side?: { readonly position: Vec3; readonly dir: -1 | 1 };
}

/** Top band of the screen kept free for the event cards. */
const TOP_MARGIN = 112;
const SIDE_MARGIN = 8;
/** Bottom band kept free for the hand of cards and the action strip. */
const BOTTOM_MARGIN = 190;

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
      if (anchor.side) {
        const { dir } = anchor.side;
        const sideX = ((below.set(...anchor.side.position).project(camera).x + 1) / 2) * size.width;
        const sideY = ((1 - below.y) / 2) * size.height;
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        const left = Math.min(Math.max(dir < 0 ? sideX - width : sideX, SIDE_MARGIN), size.width - width - SIDE_MARGIN);
        const top = Math.min(Math.max(sideY - height / 2, TOP_MARGIN), size.height - height - BOTTOM_MARGIN);
        element.dataset['flip'] = dir < 0 ? 'left' : 'right';
        element.style.setProperty('--tail', `${Math.min(Math.max(sideY - top, 18), height - 18)}px`);
        element.style.transform = `translate(${left}px, ${top}px)`;
        element.style.visibility = projected.z < 1 ? 'visible' : 'hidden';
        continue;
      }
      if (anchor.flip) {
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        x = Math.min(Math.max(x, width / 2 + SIDE_MARGIN), size.width - width / 2 - SIDE_MARGIN);
        const flipped = y - height < TOP_MARGIN;
        const hang = flipped ? ((1 - below.set(...anchor.flip).project(camera).y) / 2) * size.height : y - height;
        // Stay between the event cards and the action strip; a card that had to slide loses its tail.
        const top = Math.max(TOP_MARGIN, Math.min(hang, size.height - BOTTOM_MARGIN - height));
        element.dataset['flip'] = top !== hang ? 'free' : flipped ? 'below' : 'above';
        element.style.transform = `translate(${x - width / 2}px, ${top}px)`;
        element.style.visibility = projected.z < 1 ? 'visible' : 'hidden';
        continue;
      }
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      element.style.visibility = projected.z < 1 ? 'visible' : 'hidden';
    }
  });
  return null;
}
