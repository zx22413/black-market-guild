import { describe, expect, it } from 'vitest';
import { RULES_V06, type MarketEventId, type MatchEvent, type MatchState, type VoyageEventId } from '../../src/game';
import {
  atPhase,
  playUntil,
  scripted,
  startMatch,
  withAssets,
  withMarketEvent,
  withNextVoyageEvent,
  withRawRolls,
  type Script,
} from './helpers';

interface Setup {
  readonly market?: MarketEventId;
  readonly voyage?: VoyageEventId;
  readonly rolls?: Readonly<Record<string, number>>;
  readonly assets?: Readonly<Record<string, readonly ('salvage' | 'exchange' | 'insurance' | 'shipyard')[]>>;
}

/** Plays round 1 with the given market event, next voyage event and raw rolls. */
function playRound(script: Script, setup: Setup = {}) {
  let initial = startMatch({ rules: RULES_V06 }).state;
  if (setup.market) {
    initial = withMarketEvent(initial, setup.market);
  }
  for (const [id, assets] of Object.entries(setup.assets ?? {})) {
    initial = withAssets(initial, id, assets);
  }
  const toDeploy = playUntil(initial, atPhase('role-deployment', 1), scripted(script));
  let ready: MatchState = withRawRolls(toDeploy.state, setup.rolls ?? {});
  ready = withNextVoyageEvent(ready, setup.voyage ?? 'calm-seas');
  const rest = playUntil(ready, (s) => s.round !== 1 || s.phase === 'game-over', scripted(script));
  return { events: [...toDeploy.events, ...rest.events] };
}

const outcome = (events: readonly MatchEvent[], shipId: string) =>
  events.find((e) => e.type === 'ship-resolved' && e.shipId === shipId && e.round === 1);

const gains = (events: readonly MatchEvent[], reason: string) =>
  events.flatMap((e) => (e.type === 'cash-changed' && e.reason === reason ? [[e.playerId, e.amount]] : []));

/** p1 recruits p2 (joint ship r1-s1); p3 sails solo on r1-s2. */
const JOINT_AND_SOLO: Script = { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' }, solo: ['p3'] };

describe('market events (game-design.md §9)', () => {
  it('royal joint order adds 200 G to an arrived joint ship, split evenly; solo ships are unaffected', () => {
    const { events } = playRound(JOINT_AND_SOLO, { market: 'royal-joint-order', rolls: { 'r1-s1': 5, 'r1-s2': 5 } });
    expect(gains(events, 'shipping-income')).toEqual([
      ['p1', 450],
      ['p2', 450],
      ['p3', 300],
    ]);
  });

  it('private trade charter adds 100 G to an arrived solo ship only', () => {
    const { events } = playRound(JOINT_AND_SOLO, { market: 'private-trade-charter', rolls: { 'r1-s1': 5, 'r1-s2': 5 } });
    expect(gains(events, 'shipping-income')).toEqual([
      ['p1', 350],
      ['p2', 350],
      ['p3', 400],
    ]);
  });

  it('luxury boom adds 100 G to every arrived ship, split on joint ships', () => {
    const { events } = playRound(JOINT_AND_SOLO, { market: 'luxury-boom', rolls: { 'r1-s1': 5, 'r1-s2': 5 } });
    expect(gains(events, 'shipping-income')).toEqual([
      ['p1', 400],
      ['p2', 400],
      ['p3', 400],
    ]);
  });

  it.each([
    [1, [['p4', 250]]],
    [2, [['p1', 125], ['p4', 125]]],
  ] as const)('black market bounty raises the loot to 250 G, split among %i pirate(s)', (count, expected) => {
    const deploy =
      count === 1
        ? { p4: { role: 'pirate' as const, target: 'r1-s2' } }
        : { p1: { role: 'pirate' as const, target: 'r1-s2' }, p4: { role: 'pirate' as const, target: 'r1-s2' } };
    const { events } = playRound({ ...JOINT_AND_SOLO, deploy }, { market: 'black-market-bounty', rolls: { 'r1-s2': 4 } });
    expect(outcome(events, 'r1-s2')).toMatchObject({ outcome: 'sank' });
    expect(gains(events, 'pirate-loot')).toEqual(expected);
  });

  it('sea danger warning gives every ship −1', () => {
    const { events } = playRound(JOINT_AND_SOLO, { market: 'sea-danger-warning', rolls: { 'r1-s1': 4, 'r1-s2': 5 } });
    expect(outcome(events, 'r1-s1')).toMatchObject({ outcome: 'sank' });
    expect(outcome(events, 'r1-s2')).toMatchObject({ outcome: 'arrived' });
  });

  it('salvage boom raises each salvage payout to 120 G, keeping the cap of 2', () => {
    const { events } = playRound(
      { solo: ['p1', 'p2', 'p3'] },
      { market: 'salvage-boom', assets: { p4: ['salvage'] }, rolls: { 'r1-s1': 1, 'r1-s2': 1, 'r1-s3': 1 } },
    );
    expect(gains(events, 'salvage')).toEqual([
      ['p4', 120],
      ['p4', 120],
    ]);
  });
});

describe('voyage events (game-design.md §10)', () => {
  it.each([
    ['tailwind', 3, 'arrived'],
    ['storm', 4, 'sank'],
    ['calm-seas', 4, 'arrived'],
    ['calm-seas', 3, 'sank'],
  ] as const)('%s with a raw %i: the ship %s', (voyage, roll, result) => {
    const { events } = playRound({ solo: ['p1'] }, { voyage, rolls: { 'r1-s1': roll } });
    expect(outcome(events, 'r1-s1')).toMatchObject({ outcome: result });
  });

  it('sea fog gives +1 once to ships targeted by pirates, even when several pirates target it', () => {
    const one = playRound(
      { solo: ['p1', 'p2'], deploy: { p3: { role: 'pirate', target: 'r1-s1' } } },
      { voyage: 'sea-fog', rolls: { 'r1-s1': 4, 'r1-s2': 3 } },
    );
    // 4 - 1 + 1 = 4 arrives; the untargeted ship gets no bonus
    expect(outcome(one.events, 'r1-s1')).toMatchObject({ outcome: 'arrived' });
    expect(outcome(one.events, 'r1-s2')).toMatchObject({ outcome: 'sank' });
    const two = playRound(
      { solo: ['p1'], deploy: { p3: { role: 'pirate', target: 'r1-s1' }, p4: { role: 'pirate', target: 'r1-s1' } } },
      { voyage: 'sea-fog', rolls: { 'r1-s1': 4 } },
    );
    // 4 - 2 + 1 = 3 sinks: the fog counts once
    expect(outcome(two.events, 'r1-s1')).toMatchObject({ outcome: 'sank' });
  });

  it('moonless night gives −1 once to ships targeted by guards', () => {
    const two = playRound(
      { solo: ['p1', 'p2'], deploy: { p3: { role: 'guard', target: 'r1-s1' }, p4: { role: 'guard', target: 'r1-s1' } } },
      { voyage: 'moonless-night', rolls: { 'r1-s1': 3, 'r1-s2': 4 } },
    );
    // 3 + 2 - 1 = 4 arrives: the penalty counts once; the unguarded ship is unaffected
    expect(outcome(two.events, 'r1-s1')).toMatchObject({ outcome: 'arrived' });
    expect(outcome(two.events, 'r1-s2')).toMatchObject({ outcome: 'arrived' });
    const single = playRound(
      { solo: ['p1'], deploy: { p3: { role: 'guard', target: 'r1-s1' } } },
      { voyage: 'moonless-night', rolls: { 'r1-s1': 3 } },
    );
    // 3 + 1 - 1 = 3 sinks
    expect(outcome(single.events, 'r1-s1')).toMatchObject({ outcome: 'sank' });
  });

  it('high waves give −1 to solo ships only', () => {
    const { events } = playRound(JOINT_AND_SOLO, { voyage: 'high-waves', rolls: { 'r1-s1': 4, 'r1-s2': 4 } });
    expect(outcome(events, 'r1-s1')).toMatchObject({ outcome: 'arrived' });
    expect(outcome(events, 'r1-s2')).toMatchObject({ outcome: 'sank' });
  });

  it('black market rush raises the smuggled goods to 400 G', () => {
    const { events } = playRound(
      { ...JOINT_AND_SOLO, deploy: { p2: { role: 'smuggler', target: 'r1-s1' } } },
      { voyage: 'black-market-rush', rolls: { 'r1-s1': 5 } },
    );
    expect(gains(events, 'smuggling')).toEqual([['p2', 400]]);
    expect(gains(events, 'shipping-income').slice(0, 2)).toEqual([
      ['p1', 150],
      ['p2', 150],
    ]);
  });
});

describe('event stacking (game-design.md §10 事件修正的疊加)', () => {
  it.each([
    ['sea danger and storm stack to −2', 'storm', 5, 'sank'],
    ['sea danger and tailwind cancel out', 'tailwind', 4, 'arrived'],
  ] as const)('%s', (_label, voyage, roll, result) => {
    const { events } = playRound({ solo: ['p1'] }, { market: 'sea-danger-warning', voyage, rolls: { 'r1-s1': roll } });
    expect(outcome(events, 'r1-s1')).toMatchObject({ outcome: result });
  });

  it('applies events after pirates and before the clamp', () => {
    const { events } = playRound(
      { solo: ['p1'], deploy: { p2: { role: 'pirate', target: 'r1-s1' } } },
      { voyage: 'tailwind', rolls: { 'r1-s1': 5 } },
    );
    // 5 - 1 + 1 = 5 arrives
    expect(outcome(events, 'r1-s1')).toMatchObject({ outcome: 'arrived' });
  });

  it('adds royal order and luxury boom bonuses after the smuggling take', () => {
    const { events } = playRound(
      { ...JOINT_AND_SOLO, deploy: { p2: { role: 'smuggler', target: 'r1-s1' } } },
      { market: 'luxury-boom', rolls: { 'r1-s1': 6 } },
    );
    // 700 - 300 = 400, + 100 luxury = 500, split 250 each
    expect(gains(events, 'shipping-income').slice(0, 2)).toEqual([
      ['p1', 250],
      ['p2', 250],
    ]);
  });
});
