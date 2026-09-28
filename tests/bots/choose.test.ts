import { describe, expect, it } from 'vitest';
import { choose } from '../../src/bots/choose';
import { BotMemory } from '../../src/bots/memory';
import { createRng, type Action } from '../../src/game';

const act = (asset: 'shipyard' | 'insurance' | null): Action => ({ type: 'buy-asset', playerId: 'p1', asset });

describe('choose', () => {
  it('throws when there is nothing to choose', () => {
    expect(() => choose([], 10, createRng(1))).toThrow(/no options/);
  });

  it('always takes the best option at temperature 0', () => {
    const options = [
      { action: act(null), score: 0 },
      { action: act('shipyard'), score: 5 },
    ];
    expect(choose(options, 0, createRng(1))).toEqual(act('shipyard'));
  });

  it('falls back to a legal option when every score is -Infinity', () => {
    const options = [
      { action: act(null), score: -Infinity },
      { action: act('insurance'), score: -Infinity },
    ];
    expect(options.map((o) => o.action)).toContainEqual(choose(options, 30, createRng(1)));
  });

  it('picks every option sometimes when scores are equal', () => {
    const options = [
      { action: act(null), score: 0 },
      { action: act('shipyard'), score: 0 },
    ];
    const rng = createRng(4);
    const picks = new Set(Array.from({ length: 50 }, () => JSON.stringify(choose(options, 30, rng))));
    expect(picks.size).toBe(2);
  });
});

describe('BotMemory', () => {
  it('learns how often a player guards other players\' ships', () => {
    const memory = new BotMemory();
    memory.observe(
      [
        { type: 'round-started', round: 1 },
        { type: 'ships-launched', round: 1, ships: [{ id: 's1', kind: 'solo', owners: ['p2'], recruiters: [] }], stayedInPort: ['p3'] },
        { type: 'roles-revealed', round: 1, role: 'guard', deployments: [{ playerId: 'p3', role: 'guard', targetShipId: 's1' }], rerolledShipIds: [] },
      ],
      'p1',
    );
    expect(memory.guardOtherShipRate('p3', 0)).toBeGreaterThan(memory.guardOtherShipRate('p2', 0));
    expect(memory.guardOwnShipRate('p3', 0)).toBe(0);
  });
});
