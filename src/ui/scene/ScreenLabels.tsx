import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
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
  /** Floating cards only: always hang the label from `flip` (top edge there), never stand it above `position`. */
  readonly hang?: boolean;
  /**
   * Floating cards only: hang the label beside `side.position` instead, to its left (`dir` −1) or
   * right (+1), centered on it but kept clear of the top band. Used where above or below would
   * cover the middle of the table.
   */
  readonly side?: { readonly position: Vec3; readonly dir: -1 | 1 };
}

/** Screen bands floating cards keep clear of, in pixels: they change with the HUD layout. */
export interface LabelMargins {
  /** The event cards across the top. */
  readonly top: number;
  /** The guild ranking rail on the right. */
  readonly right: number;
  /** The hand of cards and the action strip at the bottom. */
  readonly bottom: number;
  readonly side: number;
}

export const DESKTOP_MARGINS: LabelMargins = { top: 112, right: 260, bottom: 256, side: 8 };

const projected = new Vector3();
const below = new Vector3();

/**
 * A translate to whole device pixels. The labels' parchment is a 9-slice bitmap: placed at a
 * fractional pixel, each slice's edges are anti-aliased on their own and the seams between them
 * show as faint lines across the paper.
 */
function translate(x: number, y: number): string {
  const ratio = window.devicePixelRatio || 1;
  const snap = (v: number) => Math.round(v * ratio) / ratio;
  return `translate(${snap(x)}px, ${snap(y)}px)`;
}

interface Written {
  transform?: string;
  flip?: string;
  tail?: string;
  visibility?: string;
}

/**
 * Element sizes, kept up to date by a ResizeObserver, and the styles last written to each
 * element. Reading `offsetWidth` after moving another label forces the browser to lay out the
 * page again, once per label per frame, which is what made the camera glide stutter.
 */
function useLabelCache() {
  const cache = useMemo(() => {
    const sizes = new Map<HTMLElement, { width: number; height: number }>();
    const written = new WeakMap<HTMLElement, Written>();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.borderBoxSize[0];
        if (box) sizes.set(entry.target as HTMLElement, { width: box.inlineSize, height: box.blockSize });
      }
    });
    const sizeOf = (element: HTMLElement) => {
      let size = sizes.get(element);
      if (!size) {
        // First sight of this label: measure it once, then let the observer keep it current.
        size = { width: element.offsetWidth, height: element.offsetHeight };
        sizes.set(element, size);
        observer.observe(element);
      }
      return size;
    };
    /** Stops watching labels that left the page. */
    const prune = (live: ReadonlyMap<string, HTMLElement>) => {
      if (sizes.size <= live.size) return;
      const kept = new Set(live.values());
      for (const element of sizes.keys()) {
        if (kept.has(element)) continue;
        observer.unobserve(element);
        sizes.delete(element);
      }
    };
    const write = (element: HTMLElement, next: Written) => {
      const last = written.get(element) ?? {};
      if (next.transform !== undefined && next.transform !== last.transform) element.style.transform = next.transform;
      if (next.flip !== undefined && next.flip !== last.flip) element.dataset['flip'] = next.flip;
      if (next.tail !== undefined && next.tail !== last.tail) element.style.setProperty('--tail', next.tail);
      if (next.visibility !== undefined && next.visibility !== last.visibility) element.style.visibility = next.visibility;
      written.set(element, { ...last, ...next });
    };
    return { sizeOf, prune, write, disconnect: () => observer.disconnect() };
  }, []);
  useEffect(() => cache.disconnect, [cache]);
  return cache;
}

/**
 * Keeps DOM labels pinned above 3D anchors. Lives inside the Canvas and writes transforms
 * straight to the elements each frame, so labels never trigger React re-renders. It only reads
 * cached sizes and only writes styles that changed, so moving the camera never forces a layout.
 */
export function LabelTracker({
  anchors,
  elements,
  margins = DESKTOP_MARGINS,
}: {
  readonly anchors: readonly LabelAnchor[];
  readonly elements: RefObject<Map<string, HTMLElement>>;
  readonly margins?: LabelMargins;
}) {
  const { top: TOP_MARGIN, right: RIGHT_MARGIN, bottom: BOTTOM_MARGIN, side: SIDE_MARGIN } = margins;
  const { sizeOf, prune, write } = useLabelCache();
  useFrame(({ camera, size }) => {
    // Measure any new labels before writing anything, so at most one layout happens.
    const sized = anchors.map((anchor) => {
      const element = elements.current.get(anchor.id);
      return element ? sizeOf(element) : null;
    });
    anchors.forEach((anchor, i) => {
      const element = elements.current.get(anchor.id);
      if (!element) return;
      projected.set(...anchor.position).project(camera);
      let x = ((projected.x + 1) / 2) * size.width;
      const y = ((1 - projected.y) / 2) * size.height;
      const visibility = projected.z < 1 ? 'visible' : 'hidden';
      const { width, height } = sized[i] ?? { width: 0, height: 0 };
      if (anchor.side) {
        const { dir } = anchor.side;
        const sideX = ((below.set(...anchor.side.position).project(camera).x + 1) / 2) * size.width;
        const sideY = ((1 - below.y) / 2) * size.height;
        const left = Math.min(Math.max(dir < 0 ? sideX - width : sideX, SIDE_MARGIN), size.width - width - RIGHT_MARGIN);
        const top = Math.min(Math.max(sideY - height / 2, TOP_MARGIN), size.height - height - BOTTOM_MARGIN);
        write(element, {
          flip: dir < 0 ? 'left' : 'right',
          tail: `${Math.min(Math.max(sideY - top, 18), height - 18)}px`,
          transform: translate(left, top),
          visibility,
        });
        return;
      }
      if (anchor.flip) {
        x = Math.min(Math.max(x, width / 2 + SIDE_MARGIN), size.width - width / 2 - RIGHT_MARGIN);
        const flipped = anchor.hang === true || y - height < TOP_MARGIN;
        const hang = flipped ? ((1 - below.set(...anchor.flip).project(camera).y) / 2) * size.height : y - height;
        // Stay between the event cards and the action strip; a card that had to slide loses its tail.
        const top = Math.max(TOP_MARGIN, Math.min(hang, size.height - BOTTOM_MARGIN - height));
        write(element, {
          flip: top !== hang ? 'free' : flipped ? 'below' : 'above',
          transform: translate(x - width / 2, top),
          visibility,
        });
        return;
      }
      // Centered above the anchor, worked out here rather than with a percentage so it can be snapped.
      write(element, { transform: translate(x - width / 2, y - height), visibility });
    });
    prune(elements.current);
  });
  return null;
}
