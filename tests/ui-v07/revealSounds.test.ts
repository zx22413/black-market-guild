import { describe, expect, it } from 'vitest';
import { revealSound } from '../../src/ui-v07/audio/revealSounds';

const groups = [{ role: 'intel' }, { role: 'guard' }, { role: 'pirate' }, { role: 'smuggler' }, { role: 'broker' }] as const;

describe('sound of each role group as it is revealed', () => {
  it('gives every role its own sound', () => {
    expect([1, 2, 3, 4, 5].map((n) => revealSound(groups, n - 1, n))).toEqual(['role-intel', 'role-guard', 'role-pirate', 'role-smuggler', 'role-broker']);
  });

  it('stays quiet when nothing new is revealed', () => {
    expect(revealSound(groups, 2, 2)).toBeNull();
    expect(revealSound(groups, 0, 0)).toBeNull();
  });

  it('sounds only the last group when "reveal all" skips ahead', () => {
    expect(revealSound(groups, 1, 5)).toBe('role-broker');
  });
});
