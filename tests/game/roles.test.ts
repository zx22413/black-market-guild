import { describe, expect, it } from 'vitest';
import {
  applyAction,
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  type Action,
  type MatchEvent,
  type MatchState,
  type PrivateEvent,
} from '../../src/game';
import {
  atPhase,
  playUntil,
  scripted,
  startMatch,
  unwrap,
  withCash,
  withRawRolls,
  type Script,
} from './helpers';

const cashOf = (state: MatchState, id: string) => state.players.find((p) => p.id === id)!.cash;

/** Everyone sails solo in round 1: ships r1-s1..r1-s4 belong to p1..p4. */
const ALL_SOLO: Script = { solo: ['p1', 'p2', 'p3', 'p4'] };

function toDeployment(script: Script) {
  const start = startMatch();
  const played = playUntil(start.state, atPhase('role-deployment', 1), scripted(script));
  return { state: played.state, events: [...start.events, ...played.events] };
}

/** Sets raw rolls at deployment, then plays the rest of round 1 with the script. */
function playRound(script: Script, rolls: Readonly<Record<string, number>> = {}) {
  const { state } = toDeployment(script);
  const played = playUntilPrivate(withRawRolls(state, rolls), (s) => s.round !== 1 || s.phase === 'game-over', script);
  return played;
}

/** Like playUntil, but also collects private events. */
function playUntilPrivate(initial: MatchState, stop: (s: MatchState) => boolean, script: Script) {
  const chooser = scripted(script);
  let state = initial;
  const events: MatchEvent[] = [];
  const privateEvents: PrivateEvent[] = [];
  while (!stop(state) && state.phase !== 'game-over') {
    const decision = getPendingDecisions(state)[0]!;
    const transition = unwrap(applyAction(state, chooser(state, decision.playerId, getLegalActions(state, decision.playerId))));
    state = transition.state;
    events.push(...transition.events);
    privateEvents.push(...transition.privateEvents);
  }
  return { state, events, privateEvents };
}

const outcomeOf = (events: readonly MatchEvent[], shipId: string) =>
  events.find((e) => e.type === 'ship-resolved' && e.shipId === shipId && e.round === 1);

const deployKeys = (legal: readonly Action[]) =>
  legal.map((a) => (a.type === 'deploy-role' ? `${a.role ?? '-'}@${a.targetShipId ?? '-'}` : '?'));

describe('deployment options (game-design.md §7 角色部署規則)', () => {
  it('offers only "no role" when no ship sails', () => {
    const { state } = toDeployment({});
    expect(deployKeys(getLegalActions(state, 'p1'))).toEqual(['-@-']);
  });

  it('offers intel, guard and pirate on any sailing ship, and smuggler only on your own ship', () => {
    const { state } = toDeployment({ solo: ['p1', 'p2'] });
    expect(deployKeys(getLegalActions(state, 'p1'))).toEqual([
      '-@-',
      'intel@r1-s1',
      'intel@r1-s2',
      'guard@r1-s1',
      'guard@r1-s2',
      'pirate@r1-s1',
      'pirate@r1-s2',
      'smuggler@r1-s1',
    ]);
  });

  it('does not let a player who stays in port deploy a smuggler', () => {
    const { state } = toDeployment({ solo: ['p1'] });
    expect(deployKeys(getLegalActions(state, 'p3'))).not.toContain('smuggler@r1-s1');
    const result = applyAction(state, { type: 'deploy-role', playerId: 'p3', role: 'smuggler', targetShipId: 'r1-s1' });
    expect(!result.ok && result.error.code).toBe('illegal-action');
  });

  it('checks the deployment fee against cash at lock time', () => {
    const { state } = toDeployment({ solo: ['p1'] });
    const keys = (cash: number) => deployKeys(getLegalActions(withCash(state, 'p2', cash), 'p2'));
    expect(keys(99)).not.toContain('pirate@r1-s1');
    expect(keys(99)).toContain('guard@r1-s1');
    expect(keys(100)).toContain('pirate@r1-s1');
    expect(keys(49)).toEqual(['-@-']);
  });
});

describe('secret deployment and single reveal (game-design.md §4, §5 step 5)', () => {
  const script: Script = { ...ALL_SOLO, deploy: { p1: { role: 'pirate', target: 'r1-s2' }, p2: { role: 'guard', target: 'r1-s2' } } };

  it('keeps deployments hidden from other players until the reveal', () => {
    const { state } = toDeployment(script);
    const afterLock = playUntilPrivate(state, atPhase('intel-reroll'), { ...script, deploy: { ...script.deploy, p3: { role: 'intel', target: 'r1-s1' } } }).state;
    expect(afterLock.phase).toBe('intel-reroll');
    const view = getPlayerView(afterLock, 'p4');
    expect(view.revealedRoles).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('pirate');
    expect(getPlayerView(afterLock, 'p1').myDeployment).toEqual({ playerId: 'p1', role: 'pirate', targetShipId: 'r1-s2' });
  });

  it('also hides your role from another player who targeted the same ship', () => {
    const withIntel = { ...script, deploy: { ...script.deploy, p3: { role: 'intel' as const, target: 'r1-s2' } } };
    const { state } = toDeployment(withIntel);
    const afterLock = playUntilPrivate(state, atPhase('intel-reroll'), withIntel).state;
    const p2View = getPlayerView(afterLock, 'p2');
    expect(p2View.myDeployment).toEqual({ playerId: 'p2', role: 'guard', targetShipId: 'r1-s2' });
    expect(p2View.revealedRoles).toEqual([]);
    expect(JSON.stringify(p2View)).not.toContain('pirate');
  });

  it('reveals roles in action order after the voyage event, each group followed by its fees', () => {
    const withSmuggler: Script = { ...script, deploy: { ...script.deploy, p3: { role: 'smuggler', target: 'r1-s3' } } };
    const { state } = toDeployment(withSmuggler);
    const cashAtLock = [cashOf(state, 'p1'), cashOf(state, 'p2'), cashOf(state, 'p3')];
    const { events } = playUntilPrivate(state, (s) => s.round !== 1, withSmuggler);
    const voyageAt = events.findIndex((e) => e.type === 'voyage-event-revealed');
    const resolvedAt = events.findIndex((e) => e.type === 'ship-resolved');
    const revealSection = events.slice(voyageAt + 1, resolvedAt);
    expect(revealSection).toEqual([
      { type: 'roles-revealed', round: 1, role: 'intel', deployments: [], rerolledShipIds: [] },
      {
        type: 'roles-revealed',
        round: 1,
        role: 'guard',
        deployments: [{ playerId: 'p2', role: 'guard', targetShipId: 'r1-s2' }],
        rerolledShipIds: [],
      },
      { type: 'cash-changed', round: 1, playerId: 'p2', amount: -50, reason: 'role-fee', shipId: null },
      {
        type: 'roles-revealed',
        round: 1,
        role: 'pirate',
        deployments: [{ playerId: 'p1', role: 'pirate', targetShipId: 'r1-s2' }],
        rerolledShipIds: [],
      },
      { type: 'cash-changed', round: 1, playerId: 'p1', amount: -100, reason: 'role-fee', shipId: null },
      {
        type: 'roles-revealed',
        round: 1,
        role: 'smuggler',
        deployments: [{ playerId: 'p3', role: 'smuggler', targetShipId: 'r1-s3' }],
        rerolledShipIds: [],
      },
      { type: 'cash-changed', round: 1, playerId: 'p3', amount: -50, reason: 'role-fee', shipId: null },
    ]);
    expect(cashAtLock).toEqual([900, 900, 900]);
  });

});

describe('intel merchant (game-design.md §7 情報商人)', () => {
  const intelScript: Script = { ...ALL_SOLO, deploy: { p3: { role: 'intel', target: 'r1-s1' } } };

  it('asks only intel merchants whether to reroll, showing them the raw roll of their target', () => {
    const { state } = toDeployment(intelScript);
    const locked = playUntilPrivate(withRawRolls(state, { 'r1-s1': 2 }), atPhase('intel-reroll'), intelScript);
    expect(getPendingDecisions(locked.state).map((d) => d.playerId)).toEqual(['p3']);
    expect(getPlayerView(locked.state, 'p3').intel).toEqual({ shipId: 'r1-s1', rawRoll: 2, rerolledRoll: null });
    expect(getPlayerView(locked.state, 'p1').intel).toBeNull();
    expect(JSON.stringify(getPlayerView(locked.state, 'p1'))).not.toContain('rawRoll');
    expect(locked.privateEvents).toEqual([{ playerId: 'p3', type: 'intel-report', round: 1, shipId: 'r1-s1', rawRoll: 2 }]);
  });

  it('decides before the voyage event is revealed', () => {
    const { state } = toDeployment(intelScript);
    const locked = playUntilPrivate(state, atPhase('intel-reroll'), intelScript);
    expect(locked.state.roundState.voyageEvent).toBeNull();
    expect(getPlayerView(locked.state, 'p3').voyageEvent).toBeNull();
  });

  it('skips the reroll step when nobody deployed an intel merchant', () => {
    const { events } = playRound(ALL_SOLO);
    expect(events.some((e) => e.type === 'phase-started' && e.phase === 'intel-reroll')).toBe(false);
  });

  it('rerolls once, must accept the new roll, and tells only the intel merchant the new value', () => {
    const script = { ...intelScript, reroll: ['p3'] };
    const { state } = toDeployment(script);
    const locked = playUntilPrivate(withRawRolls(state, { 'r1-s1': 2 }), atPhase('intel-reroll'), script).state;
    const rerolled = unwrap(applyAction(locked, { type: 'intel-reroll', playerId: 'p3', reroll: true }));
    const report = rerolled.privateEvents.find((e) => e.type === 'intel-reroll-result');
    expect(report).toMatchObject({ playerId: 'p3', shipId: 'r1-s1' });
    const newRoll = report?.type === 'intel-reroll-result' ? report.rerolledRoll : 0;
    expect(newRoll).toBeGreaterThanOrEqual(1);
    expect(newRoll).toBeLessThanOrEqual(6);
    const resolved = rerolled.events.find((e) => e.type === 'ship-resolved' && e.shipId === 'r1-s1');
    expect(resolved).toMatchObject({ outcome: newRoll >= 4 ? 'arrived' : 'sank' });
    expect(rerolled.events.find((e) => e.type === 'roles-revealed' && e.role === 'intel')).toMatchObject({
      rerolledShipIds: ['r1-s1'],
    });
    expect(JSON.stringify(rerolled.events)).not.toContain('rerolledRoll');
  });

  it('rerolls a ship once if any of several intel merchants on it chooses to', () => {
    const script: Script = {
      ...ALL_SOLO,
      deploy: { p3: { role: 'intel', target: 'r1-s1' }, p4: { role: 'intel', target: 'r1-s1' } },
      reroll: ['p4'],
    };
    const { state } = toDeployment(script);
    const { privateEvents } = playUntilPrivate(withRawRolls(state, { 'r1-s1': 1 }), (s) => s.round !== 1, script);
    const reports = privateEvents.filter((e) => e.type === 'intel-report');
    expect(reports.map((e) => [e.playerId, e.type === 'intel-report' && e.rawRoll])).toEqual([
      ['p3', 1],
      ['p4', 1],
    ]);
    const results = privateEvents.filter((e) => e.type === 'intel-reroll-result');
    expect(results.map((e) => e.playerId)).toEqual(['p3', 'p4']);
    expect(new Set(results.map((e) => e.type === 'intel-reroll-result' && e.rerolledRoll)).size).toBe(1);
  });

  it('keeps the raw roll when the intel merchant declines to reroll', () => {
    const { events, privateEvents } = playRound(intelScript, { 'r1-s1': 5 });
    expect(outcomeOf(events, 'r1-s1')).toMatchObject({ outcome: 'arrived' });
    expect(privateEvents.some((e) => e.type === 'intel-reroll-result')).toBe(false);
  });
});

describe('guards and pirates (game-design.md §7 修正順序)', () => {
  it.each([
    ['guard +2 saves a 2', { p2: { role: 'guard', target: 'r1-s1' } }, 2, 'arrived'],
    ['two guards stack to +4', { p2: { role: 'guard', target: 'r1-s1' }, p3: { role: 'guard', target: 'r1-s1' } }, 1, 'arrived'],
    ['pirate −2 sinks a 5', { p2: { role: 'pirate', target: 'r1-s1' } }, 5, 'sank'],
    ['pirate −2 spares a 6', { p2: { role: 'pirate', target: 'r1-s1' } }, 6, 'arrived'],
    ['two pirates sink a 6', { p2: { role: 'pirate', target: 'r1-s1' }, p3: { role: 'pirate', target: 'r1-s1' } }, 6, 'sank'],
    ['guard and pirate cancel out', { p2: { role: 'guard', target: 'r1-s1' }, p3: { role: 'pirate', target: 'r1-s1' } }, 4, 'arrived'],
    ['guard and pirate cancel out (sink)', { p2: { role: 'guard', target: 'r1-s1' }, p3: { role: 'pirate', target: 'r1-s1' } }, 3, 'sank'],
    ['a guard on another ship does not help', { p2: { role: 'guard', target: 'r1-s2' } }, 3, 'sank'],
  ] as const)('%s', (_label, deploy, roll, outcome) => {
    const { events } = playRound({ ...ALL_SOLO, deploy }, { 'r1-s1': roll });
    expect(outcomeOf(events, 'r1-s1')).toMatchObject({ outcome });
  });
});

describe('pirate loot (game-design.md §7 海盜)', () => {
  const lootEvents = (events: readonly MatchEvent[]) =>
    events.filter((e) => e.type === 'cash-changed' && e.reason === 'pirate-loot');

  it('pays 150 G to a lone pirate whose target sinks', () => {
    const { events } = playRound({ ...ALL_SOLO, deploy: { p2: { role: 'pirate', target: 'r1-s1' } } }, { 'r1-s1': 4 });
    expect(lootEvents(events)).toEqual([
      { type: 'cash-changed', round: 1, playerId: 'p2', amount: 150, reason: 'pirate-loot', shipId: 'r1-s1' },
    ]);
  });

  it.each([
    [2, 75],
    [3, 50],
    [4, 37],
  ])('splits the loot among %i pirates, rounding down to %i G each', (count, each) => {
    const pirates = ['p1', 'p2', 'p3', 'p4'].slice(0, count);
    const deploy = Object.fromEntries(pirates.map((p) => [p, { role: 'pirate' as const, target: 'r1-s1' }]));
    const { events } = playRound({ ...ALL_SOLO, deploy }, { 'r1-s1': 6 });
    expect(lootEvents(events).map((e) => e.type === 'cash-changed' && [e.playerId, e.amount])).toEqual(
      pirates.map((p) => [p, each]),
    );
  });

  it('pays no loot when the target arrives or when a sinking ship had no pirate', () => {
    const { events } = playRound(
      { ...ALL_SOLO, deploy: { p2: { role: 'pirate', target: 'r1-s1' } } },
      { 'r1-s1': 6, 'r1-s3': 1 },
    );
    expect(outcomeOf(events, 'r1-s3')).toMatchObject({ outcome: 'sank' });
    expect(lootEvents(events)).toEqual([]);
  });

  it('lets a partner betray their own joint ship and still collect the loot', () => {
    const script: Script = {
      recruit: ['p1'],
      apply: { p2: 'p1' },
      pick: { p1: 'p2' },
      deploy: { p2: { role: 'pirate', target: 'r1-s1' } },
    };
    const { state, events } = playRound(script, { 'r1-s1': 5 });
    expect(outcomeOf(events, 'r1-s1')).toMatchObject({ outcome: 'sank' });
    // p2: 1000 - 100 share - 100 pirate fee + 150 loot; p1: 1000 - 100 share
    expect([cashOf(state, 'p1'), cashOf(state, 'p2')]).toEqual([900, 950]);
  });
});

describe('smuggler (game-design.md §7 走私商人)', () => {
  const jointSmuggler: Script = {
    recruit: ['p1'],
    apply: { p2: 'p1' },
    pick: { p1: 'p2' },
    deploy: { p2: { role: 'smuggler', target: 'r1-s1' } },
  };

  it('pays the smuggler alone an extra 100 G when their ship arrives', () => {
    const { state, events } = playRound(jointSmuggler, { 'r1-s1': 4 });
    expect(events).toContainEqual({
      type: 'cash-changed',
      round: 1,
      playerId: 'p2',
      amount: 100,
      reason: 'smuggling',
      shipId: 'r1-s1',
    });
    // p1: 1000 - 100 + 350; p2: 1000 - 100 - 50 fee + 350 + 100
    expect([cashOf(state, 'p1'), cashOf(state, 'p2')]).toEqual([1250, 1300]);
  });

  it('pays each smuggler independently for their own arrived ship', () => {
    const script: Script = {
      ...ALL_SOLO,
      deploy: { p1: { role: 'smuggler', target: 'r1-s1' }, p3: { role: 'smuggler', target: 'r1-s3' } },
    };
    const { events } = playRound(script, { 'r1-s1': 6, 'r1-s3': 5 });
    const paid = events.filter((e) => e.type === 'cash-changed' && e.reason === 'smuggling');
    expect(paid.map((e) => e.type === 'cash-changed' && [e.playerId, e.amount, e.shipId])).toEqual([
      ['p1', 100, 'r1-s1'],
      ['p3', 100, 'r1-s3'],
    ]);
  });

  it('pays nothing extra when the ship sinks', () => {
    const { events } = playRound(jointSmuggler, { 'r1-s1': 3 });
    expect(events.some((e) => e.type === 'cash-changed' && e.reason === 'smuggling')).toBe(false);
  });
});

describe('payout order (game-design.md §5 step 6)', () => {
  it('pays shipping income, then smuggling, then pirate loot', () => {
    const script: Script = {
      ...ALL_SOLO,
      deploy: { p1: { role: 'smuggler', target: 'r1-s1' }, p2: { role: 'pirate', target: 'r1-s3' } },
    };
    const { events } = playRound(script, { 'r1-s1': 6, 'r1-s3': 1 });
    const reasons: string[] = events
      .filter((e) => e.type === 'cash-changed' && e.amount > 0)
      .map((e) => (e.type === 'cash-changed' ? e.reason : ''));
    const firstOf = (r: string) => reasons.indexOf(r);
    expect(firstOf('shipping-income')).toBeLessThan(firstOf('smuggling'));
    expect(firstOf('smuggling')).toBeLessThan(firstOf('pirate-loot'));
  });
});
