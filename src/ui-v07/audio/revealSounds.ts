// The sound of a role group as the reveal turns it over: the intel merchant's spyglass, the
// guard's armour, the pirate's drawn blade, the smuggler's cloth, the broker's chips. Pure, so
// the mapping is tested without audio.

import type { RoleId } from '../../v07/game';
import type { SfxId } from './soundPlan';

const ROLE_SOUND: Readonly<Record<RoleId, SfxId>> = {
  intel: 'role-intel',
  guard: 'role-guard',
  pirate: 'role-pirate',
  smuggler: 'role-smuggler',
  broker: 'role-broker',
};

/**
 * The sound for the groups revealed between `before` and `now` (counts of groups shown). When
 * "reveal all" turns several over at once only the last one sounds.
 */
export function revealSound(groups: readonly { readonly role: RoleId }[], before: number, now: number): SfxId | null {
  if (now <= before) return null;
  const group = groups[now - 1];
  return group ? ROLE_SOUND[group.role] : null;
}
