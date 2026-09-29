import { describe, expect, it } from 'vitest';
import { RULES_V06, type MatchEvent } from '../../src/game';
import { atPhase, playUntil, scripted, startMatch, withAssets, withMarketEvent, withNextVoyageEvent, type Script } from './helpers';

// Public modifier breakdown announced before voyages resolve (game-design.md §4, §7 航行修正順序).
// Everything in it is derivable from public information; the dice stay hidden.

const SCRIPT: Script = {
  solo: ['p1', 'p2', 'p3', 'p4'],
  deploy: {
    p2: { role: 'guard', target: 'r1-s1' },
    p3: { role: 'pirate', target: 'r1-s1' },
    p4: { role: 'guard', target: 'r1-s2' },
  },
};

function playRound1(): MatchEvent[] {
  const start = startMatch({ rules: RULES_V06 });
  const beforeBuy = withMarketEvent(withAssets(start.state, 'p4', ['insurance']), 'sea-danger-warning');
  const toDeploy = playUntil(beforeBuy, atPhase('role-deployment', 1), scripted(SCRIPT));
  const stormy = withNextVoyageEvent(toDeploy.state, 'storm');
  return playUntil(stormy, (s) => s.round !== 1, scripted(SCRIPT)).events;
}

describe('voyage modifiers event', () => {
  it('announces guard, pirate and event modifiers per ship', () => {
    const event = playRound1().find((e) => e.type === 'voyage-modifiers');
    expect(event).toEqual({
      type: 'voyage-modifiers',
      round: 1,
      modifiers: [
        { shipId: 'r1-s1', guard: 1, pirate: -1, event: -2 },
        // p4 holds insurance, so its guard adds +2.
        { shipId: 'r1-s2', guard: 2, pirate: 0, event: -2 },
        { shipId: 'r1-s3', guard: 0, pirate: 0, event: -2 },
        { shipId: 'r1-s4', guard: 0, pirate: 0, event: -2 },
      ],
    });
  });

  it('comes after the role reveal and before any ship is resolved, without dice', () => {
    const events = playRound1();
    const at = (type: MatchEvent['type']) => events.findIndex((e) => e.type === type);
    expect(at('voyage-modifiers')).toBeGreaterThan(events.map((e) => e.type).lastIndexOf('roles-revealed'));
    expect(at('voyage-modifiers')).toBeLessThan(at('ship-resolved'));
    expect(JSON.stringify(events.find((e) => e.type === 'voyage-modifiers'))).not.toMatch(/roll/i);
  });
});
