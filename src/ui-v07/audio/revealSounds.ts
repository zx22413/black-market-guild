// The sound of a role group as the reveal turns it over: customs' spyglass, the
// guard's armour, the pirate's drawn blade, the smuggler's cloth, the diplomat's chips. Pure, so
// the mapping is tested without audio.

import type { RoleId } from '../../v07/game';
import type { SfxId } from './soundPlan';

const ROLE_SOUND: Readonly<Record<RoleId, SfxId>> = {
  customs: 'role-intel',
  guard: 'role-guard',
  pirate: 'role-pirate',
  smuggler: 'role-smuggler',
  diplomat: 'role-broker',
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
