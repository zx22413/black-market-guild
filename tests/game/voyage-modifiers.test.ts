import { describe, expect, it } from 'vitest';
import { RULES_V06, applyAction, type MatchEvent } from '../../src/game';
import {
  atPhase,
  playUntil,
  scripted,
  startMatch,
  unwrap,
  withAssets,
  withMarketEvent,
  withNextVoyageEvent,
  withRawRolls,
  type Script,
} from './helpers';

// Public resolution summary announced before voyages resolve (game-design.md §4 結算起始骰值與修正,
// §7 航行修正順序): the starting roll used (after any reroll), each modifier step and the final value.

const SCRIPT: Script = {
  solo: ['p1', 'p2', 'p3', 'p4'],
  deploy: {
    p2: { role: 'guard', target: 'r1-s1' },
    p3: { role: 'pirate', target: 'r1-s1' },
    p4: { role: 'guard', target: 'r1-s2' },
  },
};

function toDeployment(script: Script) {
  const start = startMatch({ rules: RULES_V06 });
  const beforeBuy = withMarketEvent(withAssets(start.state, 'p4', ['insurance']), 'sea-danger-warning');
  const toDeploy = playUntil(beforeBuy, atPhase('role-deployment', 1), scripted(script));
  return withRawRolls(withNextVoyageEvent(toDeploy.state, 'storm'), { 'r1-s1': 5, 'r1-s2': 2, 'r1-s3': 3, 'r1-s4': 6 });
}

function playRound1(): MatchEvent[] {
  return playUntil(toDeployment(SCRIPT), (s) => s.round !== 1, scripted(SCRIPT)).events;
}

describe('voyage modifiers event', () => {
  it('announces the starting roll, each modifier step and the clamped final value', () => {
    const event = playRound1().find((e) => e.type === 'voyage-modifiers');
    expect(event).toEqual({
      type: 'voyage-modifiers',
      round: 1,
      modifiers: [
        { shipId: 'r1-s1', base: 5, guard: 1, pirate: -1, event: -2, final: 3 },
        // p4 holds insurance, so its guard adds +2.
        { shipId: 'r1-s2', base: 2, guard: 2, pirate: 0, event: -2, final: 2 },
        // 3 - 2 = 1 is already the minimum; the clamp keeps it at 1.
        { shipId: 'r1-s3', base: 3, guard: 0, pirate: 0, event: -2, final: 1 },
        { shipId: 'r1-s4', base: 6, guard: 0, pirate: 0, event: -2, final: 4 },
      ],
    });
  });

  it('comes after the role reveal and before any ship is resolved', () => {
    const events = playRound1();
    const at = (type: MatchEvent['type']) => events.findIndex((e) => e.type === type);
    expect(at('voyage-modifiers')).toBeGreaterThan(events.map((e) => e.type).lastIndexOf('roles-revealed'));
    expect(at('voyage-modifiers')).toBeLessThan(at('ship-resolved'));
  });

  it('uses the rerolled value for a rerolled ship and never reveals its original roll', () => {
    const script: Script = { solo: ['p1', 'p2'], deploy: { p3: { role: 'intel', target: 'r1-s1' } }, reroll: ['p3'] };
    const start = startMatch({ rules: RULES_V06 });
    const toDeploy = playUntil(start.state, atPhase('role-deployment', 1), scripted(script));
    const toReroll = playUntil(withRawRolls(toDeploy.state, { 'r1-s1': 1, 'r1-s2': 4 }), atPhase('intel-reroll', 1), scripted(script));
    const transition = unwrap(applyAction(toReroll.state, { type: 'intel-reroll', playerId: 'p3', reroll: true }));

    const rerolled = transition.privateEvents.find((e) => e.type === 'intel-reroll-result');
    const summary = transition.events.find((e) => e.type === 'voyage-modifiers');
    expect(rerolled?.playerId).toBe('p3');
    const ship = summary?.type === 'voyage-modifiers' ? summary.modifiers.find((m) => m.shipId === 'r1-s1') : undefined;
    expect(ship?.base).toBe(rerolled?.type === 'intel-reroll-result' ? rerolled.rerolledRoll : undefined);
    expect(Object.keys(ship ?? {}).sort()).toEqual(['base', 'event', 'final', 'guard', 'pirate', 'shipId']);
  });
});
