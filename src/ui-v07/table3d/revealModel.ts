import type { Deployment, MatchEvent, PlayerId, RoleId } from '../../v07/game';
import { seatPosition, type Vec3 } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { GOOD_LABELS, ROLE_LABELS } from '../labels';
import { betLabel } from '../table/deployChoice';

// The role reveal as arrows (docs/ui/v07-event-presentation.md §1.5): each deployed role is an
// arrow in its player's color from that player's island to its target, group by group in reveal
// order. The lighthouse intel's extra look is a faint arrow with no label, kept low-key.

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
  /** Text at the middle of the arrow; empty for the faint extra look. */
  readonly label: string;
  /** The ship it points at; null for the broker (the harbor). */
  readonly targetShipId: string | null;
}

const ISLAND_HEIGHT = 5;
const SHIP_HEIGHT = 3;
const HARBOR: Vec3 = [0, 9, 0];
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
    const main = d.role === 'broker' ? HARBOR : d.targetShipId ? shipAt(d.targetShipId) : null;
    const arrows: RoleArrow[] = [];
    if (main) {
      const label = d.role === 'broker' && d.bet ? `${ROLE_LABELS.broker} 押${betLabel(d.bet)}` : ROLE_LABELS[d.role];
      arrows.push({ key: `${d.playerId}-${d.role}`, playerId: d.playerId, role: d.role, from, control: arc(from, main), to: main, faint: false, label, targetShipId: d.role === 'broker' ? null : d.targetShipId });
    }
    const aimAt = d.role === 'broker' && d.targetShipId ? shipAt(d.targetShipId) : null;
    if (aimAt && d.bet) {
      arrows.push({ key: `${d.playerId}-aim`, playerId: d.playerId, role: d.role, from, control: arc(from, aimAt), to: aimAt, faint: false, label: `${ROLE_LABELS.broker} ${d.bet.direction > 0 ? '抬' : '壓'}${GOOD_LABELS[d.bet.good]}`, targetShipId: d.targetShipId });
    }
    const peek = d.peekShipId ? shipAt(d.peekShipId) : null;
    if (peek) arrows.push({ key: `${d.playerId}-peek`, playerId: d.playerId, role: d.role, from, control: arc(from, peek), to: peek, faint: true, label: '', targetShipId: d.peekShipId });
    return arrows;
  });
}
