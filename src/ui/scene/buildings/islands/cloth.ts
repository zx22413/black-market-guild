import type { KitPart } from '../kit';
import type { Mat } from '../materials';
import type { Vec3 } from '../polyhedra';

/** A flag is cut into strips this wide at most, so the waving shader can ripple it (`LandmarkFlag`). */
const FLAG_STRIP = 0.06;

/**
 * A flat box of flag cloth in the plane z = center's z, cut into strips along x. Marks laid on a field
 * (`thick` a little more than the field's) show on both of its faces.
 */
export function cloth([cx, cy, cz]: Vec3, [w, h]: readonly [number, number], mat: Mat, thick = 0.012): KitPart[] {
  const n = Math.max(1, Math.ceil(w / FLAG_STRIP - 1e-9));
  return Array.from({ length: n }, (_, i): KitPart => ({ kind: 'box', center: [cx - w / 2 + (w / n) * (i + 0.5), cy, cz], size: [w / n, h, thick], mat }));
}
