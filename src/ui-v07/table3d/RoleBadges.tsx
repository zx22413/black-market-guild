import type { Deployment, PlayerId, RoleId } from '../../v07/game';
import { ROLE_LABELS } from '../labels';
import { betLabel } from '../table/deployChoice';

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
}

export function RoleBadges({ deployments, colorOf, nameOf }: RoleBadgesProps) {
  return (
    <span className="role-badges">
      {deployments.map((d) => {
        const what = `${ROLE_LABELS[d.role]}${d.bet ? ` 押${betLabel(d.bet)}` : ''} · ${nameOf(d.playerId)}`;
        return (
          <span key={`${d.playerId}-${d.role}`} className="role-badge" style={{ borderColor: colorOf(d.playerId) }} title={what} aria-label={what}>
            <img src={roleIconUrl(d.role)} alt="" />
            {d.bet && <small>{betLabel(d.bet)}</small>}
          </span>
        );
      })}
    </span>
  );
}
