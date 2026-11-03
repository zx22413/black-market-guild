import type { Deployment, MatchEvent, PlayerId, RoleId } from '../../v07/game';
import { seatPosition, type Vec3 } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { ROLE_LABELS } from '../labels';
import { deploymentNote } from '../table/deployChoice';

// The role reveal as arrows (docs/ui/v07-event-presentation.md §1.5): each deployed role is an
// arrow in its player's color from that player's island to its target, group by group in reveal
// order.

export interface RevealGroup {
  readonly role: RoleId;
  readonly deployments: readonly Deployment[];
}

/** The round's reveal groups in reveal order (§9.4), skipping roles nobody played. */
export function revealGroups(events: readonly MatchEvent[], round: number): RevealGroup[] {
  return events.flatMap((e) =>
    e.type === 'roles-revealed' && e.round === round && e.deployments.length > 0 ? [{ role: e.role, deployments: e.deployments }] : [],
  );
}

export interface RoleArrow {
  readonly key: string;
  readonly playerId: PlayerId;
  readonly role: RoleId;
  readonly from: Vec3;
  readonly control: Vec3;
  readonly to: Vec3;
  readonly faint: boolean;
  /** Text at the middle of the arrow. */
  readonly label: string;
  /** The ship it points at. */
  readonly targetShipId: string | null;
}

const ISLAND_HEIGHT = 5;
const SHIP_HEIGHT = 3;
const ARC = 12;

function arc(from: Vec3, to: Vec3): Vec3 {
  return [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + ARC, (from[2] + to[2]) / 2];
}

/** Point `t` of the arrow's curve (quadratic Bézier), e.g. 0.5 for the label. */
export function arrowPoint(a: RoleArrow, t: number): Vec3 {
  const u = 1 - t;
  const p = (i: 0 | 1 | 2) => u * u * a.from[i] + 2 * u * t * a.control[i] + t * t * a.to[i];
  return [p(0), p(1), p(2)];
}

export function revealArrows(
  group: RevealGroup,
  angles: readonly number[],
  laneOf: (id: PlayerId) => number,
  shipOwner: (shipId: string) => PlayerId | undefined,
): RoleArrow[] {
  const islandOf = (id: PlayerId): Vec3 => {
    const [x, , z] = seatPosition(angles[laneOf(id)]!);
    return [x, ISLAND_HEIGHT, z];
  };
  const shipAt = (shipId: string): Vec3 | null => {
    const owner = shipOwner(shipId);
    if (owner === undefined) return null;
    const p = shipPose(angles[laneOf(owner)]!, 'sailing').position;
    return [p.x, SHIP_HEIGHT, p.z];
  };
  return group.deployments.flatMap((d): RoleArrow[] => {
    const from = islandOf(d.playerId);
    const main = d.targetShipId ? shipAt(d.targetShipId) : null;
    const arrows: RoleArrow[] = [];
    if (main) {
      const note = deploymentNote(d);
      const label = note ? `${ROLE_LABELS[d.role]} ${note}` : ROLE_LABELS[d.role];
      arrows.push({ key: `${d.playerId}-${d.role}`, playerId: d.playerId, role: d.role, from, control: arc(from, main), to: main, faint: false, label, targetShipId: d.targetShipId });
    }
    return arrows;
  });
}

/** What the player has picked so far, as the dashed arrows shown before submitting (§1.4). */
export interface PickedRole {
  readonly role: RoleId;
  readonly target: string | null;
}

export function pickArrows(
  playerId: PlayerId,
  picked: PickedRole,
  angles: readonly number[],
  laneOf: (id: PlayerId) => number,
  shipOwner: (shipId: string) => PlayerId | undefined,
): RoleArrow[] {
  const [x, , z] = seatPosition(angles[laneOf(playerId)]!);
  const from: Vec3 = [x, ISLAND_HEIGHT, z];
  // Before the voyage the ships still sit at the dock (the same spot the ship tags hang on).
  const owner = picked.target === null ? undefined : shipOwner(picked.target);
  if (owner === undefined) return [];
  const p = shipPose(angles[laneOf(owner)]!, 'docked').position;
  const to: Vec3 = [p.x, SHIP_HEIGHT, p.z];
  return [{ key: 'pick-target', playerId, role: picked.role, from, control: arc(from, to), to, faint: false, label: '', targetShipId: null }];
}
