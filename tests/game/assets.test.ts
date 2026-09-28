import { describe, expect, it } from 'vitest';
import {
  applyAction,
  getLegalActions,
  getPlayerView,
  type AssetId,
  type MatchEvent,
  type MatchState,
} from '../../src/game';
import {
  atPhase,
  playUntil,
  scripted,
  startMatch,
  withAssets,
  withCash,
  withRawRolls,
  type Script,
} from './helpers';

const cashOf = (state: MatchState, id: string) => state.players.find((p) => p.id === id)!.cash;

/** Round 1 start with the given holdings already in place. */
function startWith(holdings: Readonly<Record<string, readonly AssetId[]>>): MatchState {
  return Object.entries(holdings).reduce((s, [id, assets]) => withAssets(s, id, assets), startMatch().state);
}

/** Plays round 1 with the script, forcing raw rolls at deployment; returns round 1 events. */
function playRound(initial: MatchState, script: Script, rolls: Readonly<Record<string, number>> = {}) {
  const toDeploy = playUntil(initial, atPhase('role-deployment', 1), scripted(script));
  const rest = playUntil(withRawRolls(toDeploy.state, rolls), (s) => s.round !== 1 || s.phase === 'game-over', scripted(script));
  return { state: rest.state, events: [...toDeploy.events, ...rest.events] };
}

const paid = (events: readonly MatchEvent[], reason: string) =>
  events.flatMap((e) => (e.type === 'cash-changed' && e.reason === reason ? [[e.playerId, e.amount, e.shipId]] : []));

const costs = (events: readonly MatchEvent[]) =>
  events.flatMap((e) => (e.type === 'cash-changed' && e.reason === 'ship-cost' ? [[e.playerId, e.amount]] : []));

describe('buying assets (game-design.md §8 資產取得規則)', () => {
  it('offers each asset the player can afford and does not already hold', () => {
    const options = (state: MatchState) =>
      getLegalActions(state, 'p1').map((a) => (a.type === 'buy-asset' ? a.asset : '?'));
    const start = startMatch().state;
    expect(options(start)).toEqual([null, 'shipyard', 'insurance', 'salvage', 'exchange']);
    expect(options(withCash(start, 'p1', 350))).toEqual([null, 'shipyard', 'insurance']);
    expect(options(withCash(start, 'p1', 299))).toEqual([null]);
    expect(options(withAssets(start, 'p1', ['insurance']))).toEqual([null, 'shipyard', 'salvage', 'exchange']);
  });

  it('pays immediately, announces purchases publicly, and takes effect the same round', () => {
    const script: Script = { buy: { p1: 'shipyard', p3: 'salvage' }, solo: ['p1'] };
    const { state, events } = playUntil(startMatch().state, atPhase('role-deployment', 1), scripted(script));
    const announced = events.findIndex((e) => e.type === 'assets-purchased');
    expect(events[announced]).toEqual({
      type: 'assets-purchased',
      round: 1,
      purchases: [
        { playerId: 'p1', asset: 'shipyard' },
        { playerId: 'p3', asset: 'salvage' },
      ],
    });
    expect(paid(events, 'asset-purchase')).toEqual([
      ['p1', -300, null],
      ['p3', -400, null],
    ]);
    expect(events.findIndex((e) => e.type === 'cash-changed' && e.reason === 'asset-purchase')).toBeGreaterThan(announced);
    expect(getPlayerView(state, 'p2').players.map((p) => p.assets)).toEqual([['shipyard'], [], ['salvage'], []]);
    // Shipyard applies to this round's solo voyage: 1000 - 300 - 50
    expect(cashOf(state, 'p1')).toBe(650);
  });

  it('keeps assets across rounds and never offers a second copy', () => {
    const { state } = playUntil(startMatch().state, atPhase('asset-purchase', 2), scripted({ buy: { p1: 'exchange' } }));
    expect(state.players[0]!.assets).toEqual(['exchange']);
    const options = getLegalActions(state, 'p1').map((a) => a.type === 'buy-asset' && a.asset);
    expect(options).not.toContain('exchange');
    const result = applyAction(state, { type: 'buy-asset', playerId: 'p1', asset: 'exchange' });
    expect(!result.ok && result.error.code).toBe('illegal-action');
  });

  it('counts held assets at half price in final wealth (game-design.md §8 最終財富)', () => {
    const { state } = playUntil(startMatch().state, () => false, scripted({ buy: { p1: 'shipyard' } }));
    expect(state.result?.standings.find((s) => s.playerId === 'p1')).toMatchObject({
      cash: 700,
      assetValue: 150,
      wealth: 850,
    });
  });
});

describe('shipyard (game-design.md §8 造船廠, 合資加成)', () => {
  it('cuts the holder solo cost to 50 G and lets them sail with only 50 G', () => {
    const initial = withCash(startWith({ p1: ['shipyard'] }), 'p1', 50);
    const { state } = playUntil(initial, atPhase('sailing-choice'));
    expect(getLegalActions(state, 'p1').map((a) => a.type === 'choose-sailing' && a.choice)).toEqual(['stay', 'solo']);
    const { events } = playRound(initial, { solo: ['p1'] });
    expect(costs(events)).toEqual([['p1', -50]]);
  });

  it.each([
    ['recruiter holds it: both pay 50', { p1: ['shipyard'] }, [['p1', -50], ['p2', -50]]],
    ['applicant holds it: only the applicant saves', { p2: ['shipyard'] }, [['p1', -100], ['p2', -50]]],
    ['both hold it: no stacking', { p1: ['shipyard'], p2: ['shipyard'] }, [['p1', -50], ['p2', -50]]],
  ] as const)('joint ship where the %s', (_label, holdings, expected) => {
    const { events } = playRound(startWith(holdings), { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' } });
    expect(costs(events)).toEqual(expected);
  });

  it('lets a poor applicant apply only to recruiters whose shipyard covers the gap', () => {
    const initial = withCash(startWith({ p1: ['shipyard'] }), 'p2', 60);
    const { state } = playUntil(initial, atPhase('apply'), scripted({ recruit: ['p1', 'p3'] }));
    expect(getLegalActions(state, 'p2').map((a) => a.type === 'apply' && a.recruiterId)).toEqual([null, 'p1']);
  });

  it('applies a shipyard bought this round to that round\'s recruitment', () => {
    const { events } = playRound(startMatch().state, {
      buy: { p1: 'shipyard' },
      recruit: ['p1'],
      apply: { p2: 'p1' },
      pick: { p1: 'p2' },
    });
    expect(costs(events)).toEqual([
      ['p1', -50],
      ['p2', -50],
    ]);
  });

  it('lets a shipyard holder recruit with only 50 G', () => {
    const initial = withCash(startWith({ p1: ['shipyard'] }), 'p1', 50);
    const { state } = playUntil(initial, atPhase('recruit'));
    expect(getLegalActions(state, 'p1').map((a) => a.type === 'recruit' && a.recruit)).toEqual([false, true]);
  });
});

describe('shipping insurance (game-design.md §8 航運保險)', () => {
  it('pays the holder 150 G when their solo ship sinks, and nothing when it arrives', () => {
    const initial = startWith({ p1: ['insurance'], p2: ['insurance'] });
    const { events } = playRound(initial, { solo: ['p1', 'p2'] }, { 'r1-s1': 2, 'r1-s2': 5 });
    expect(paid(events, 'insurance')).toEqual([['p1', 150, 'r1-s1']]);
  });

  it('pays only the holder when a joint ship sinks (no joint bonus)', () => {
    const { events } = playRound(
      startWith({ p1: ['insurance'] }),
      { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' } },
      { 'r1-s1': 1 },
    );
    expect(paid(events, 'insurance')).toEqual([['p1', 150, 'r1-s1']]);
  });

  it.each([
    ['an insured guard gives +2', ['insurance'], 2, 'arrived'],
    ['an uninsured guard gives +1', [], 2, 'sank'],
  ] as const)('%s', (_label, guardAssets, roll, outcome) => {
    const { events } = playRound(
      startWith({ p2: guardAssets }),
      { solo: ['p1'], deploy: { p2: { role: 'guard', target: 'r1-s1' } } },
      { 'r1-s1': roll },
    );
    expect(events.find((e) => e.type === 'ship-resolved')).toMatchObject({ outcome });
  });
});

describe('salvage company (game-design.md §8 打撈公司)', () => {
  it('pays 60 G per sunk ship of other players, at most 2 per round', () => {
    const { events } = playRound(
      startWith({ p4: ['salvage'] }),
      { solo: ['p1', 'p2', 'p3'] },
      { 'r1-s1': 1, 'r1-s2': 2, 'r1-s3': 3 },
    );
    expect(paid(events, 'salvage')).toEqual([
      ['p4', 60, 'r1-s1'],
      ['p4', 60, 'r1-s2'],
    ]);
  });

  it('never salvages ships the holder sails on, including their joint ship', () => {
    const { events } = playRound(
      startWith({ p2: ['salvage'] }),
      { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' }, solo: ['p3'] },
      { 'r1-s1': 1, 'r1-s2': 1 },
    );
    expect(paid(events, 'salvage')).toEqual([['p2', 60, 'r1-s2']]);
  });

  it('counts a sunk joint ship once', () => {
    const { events } = playRound(
      startWith({ p4: ['salvage'] }),
      { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' } },
      { 'r1-s1': 1 },
    );
    expect(paid(events, 'salvage')).toEqual([['p4', 60, 'r1-s1']]);
  });
});

describe('trade exchange (game-design.md §8 貿易交易所, 合資加成)', () => {
  it('pays 40 G per arrived ship of other players, at most 2 per round, never for own ships', () => {
    const { events } = playRound(
      startWith({ p4: ['exchange'] }),
      { solo: ['p1', 'p2', 'p3', 'p4'] },
      { 'r1-s1': 6, 'r1-s2': 6, 'r1-s3': 6, 'r1-s4': 6 },
    );
    expect(paid(events, 'exchange')).toEqual([
      ['p4', 40, 'r1-s1'],
      ['p4', 40, 'r1-s2'],
    ]);
  });

  it('adds 100 G to the income of a joint ship whose recruiter holds it, split evenly', () => {
    const { events } = playRound(
      startWith({ p1: ['exchange'] }),
      { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' } },
      { 'r1-s1': 5 },
    );
    expect(paid(events, 'shipping-income')).toEqual([
      ['p1', 400, 'r1-s1'],
      ['p2', 400, 'r1-s1'],
    ]);
  });

  it('gives no joint bonus when only the applicant holds it', () => {
    const { events } = playRound(
      startWith({ p2: ['exchange'] }),
      { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' } },
      { 'r1-s1': 5 },
    );
    expect(paid(events, 'shipping-income')).toEqual([
      ['p1', 350, 'r1-s1'],
      ['p2', 350, 'r1-s1'],
    ]);
  });
});

describe('payout order (game-design.md §5 step 6)', () => {
  it('pays smuggling, income, loot, insurance, salvage, then exchange', () => {
    const initial = startWith({ p3: ['insurance'], p4: ['salvage', 'exchange'] });
    const script: Script = {
      recruit: ['p1'],
      apply: { p2: 'p1' },
      pick: { p1: 'p2' },
      solo: ['p3'],
      deploy: { p2: { role: 'smuggler', target: 'r1-s1' }, p4: { role: 'pirate', target: 'r1-s2' } },
    };
    const { events } = playRound(initial, script, { 'r1-s1': 6, 'r1-s2': 1 });
    const reasons = events.flatMap((e) => (e.type === 'cash-changed' && e.amount > 0 ? [e.reason] : []));
    expect(reasons).toEqual([
      'smuggling',
      'shipping-income',
      'shipping-income',
      'pirate-loot',
      'insurance',
      'salvage',
      'exchange',
    ]);
  });
});
