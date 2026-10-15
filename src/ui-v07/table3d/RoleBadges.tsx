import type { Deployment, PlayerId, RoleId } from '../../v07/game';
import { ROLE_LABELS } from '../labels';
import { betLabel } from '../table/deployChoice';
import { roleKey, type RoleResult } from './roleResults';

// The role icons hanging on what each role targeted (a ship, or the harbor for brokers): one round
// badge per deployed role, ringed in the color of the player who sent it. Icons are the
// game-icons.net set in public/art/icons (sources in public/art/SOURCES.md).

/** The broker's rising chart is its own icon, so it never looks like the exchange's scales. */
const ICON: Readonly<Record<RoleId, string>> = {
  intel: 'role-intel',
  guard: 'role-guard',
  pirate: 'role-pirate',
  smuggler: 'role-smuggler',
  broker: 'role-broker',
};

export const roleIconUrl = (role: RoleId): string => `${import.meta.env.BASE_URL}art/icons/${ICON[role]}.svg`;

export interface RoleBadgesProps {
  readonly deployments: readonly Deployment[];
  readonly colorOf: (id: PlayerId) => string;
  readonly nameOf: (id: PlayerId) => string;
  /** The stamp to show on a badge once its result is known (the V0.6 查獲 stamp, for every role). */
  readonly stamp?: ((d: Deployment) => RoleResult | null) | undefined;
}

export function RoleBadges({ deployments, colorOf, nameOf, stamp }: RoleBadgesProps) {
  return (
    <span className="role-badges">
      {deployments.map((d) => {
        const result = stamp?.(d) ?? null;
        const what = `${ROLE_LABELS[d.role]}${d.bet ? ` 押${betLabel(d.bet)}` : ''} · ${nameOf(d.playerId)}${result ? `：${result.text}` : ''}`;
        return (
          <span key={roleKey(d)} className="role-badge" style={{ borderColor: colorOf(d.playerId) }} title={what} aria-label={what}>
            <img src={roleIconUrl(d.role)} alt="" />
            {d.bet && <small>{betLabel(d.bet)}</small>}
            {result && <b className={`role-stamp ${result.tone}`}>{result.text}</b>}
          </span>
        );
      })}
    </span>
  );
}
