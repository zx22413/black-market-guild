import { describe, expect, it } from 'vitest';
import {
  RULES_V07,
  RULES_V08,
  beaconShift,
  islandFaded,
  ownShipApplies,
  ownShipShift,
  shipCostFor,
  shipTypeAvailableFor,
  type PublicEvents,
  type Rules,
} from '../../../src/v07/game';
import { G, edit, find, plain, playRound, withDemand } from './helpers';

/** V0.8 prototype island balance (2026-11-16, test values, not rules). */
const withIslands = (patch: Partial<Rules['v08']['islands']>): Rules => ({
  ...RULES_V08,
  v08: { ...RULES_V08.v08, islands: { ...RULES_V08.v08.islands, ...patch } },
});
const phase = (p: 1 | 2, darkTide = false) => ({ phase: p, darkTide }) as unknown as PublicEvents;
const lighthouseRound = (rules: Rules, raw: number, pirate = false) =>
  playRound(withDemand(edit(plain(4, rules), 'p1', { island: 'lighthouse', stock: G(3, 3, 1, 1) }), G(2, 2, 2, 1)), {
    loads: { p1: G(1) },
    rolls: { p1: raw },
    ...(pirate ? { roles: { p2: ['pirate', 'p1'] as const } } : {}),
  });
const modifiers = (events: ReturnType<typeof playRound>['events']) => find(events, 'voyage-modifiers')[0]!.modifiers[0]!;

describe('V0.8 prototype: island balance', () => {
  it('lets the free port pay half of every ship fee in the prototype only', () => {
    expect(RULES_V07.islands.traits['free-port']).toMatchObject({ capacityDelta: -1, shipCostDelta: 0, freeShips: ['gambler'] });
    expect(RULES_V08.islands.traits['free-port']).toMatchObject({ capacityDelta: 0, shipCostDelta: 0, freeShips: [] });
    expect(shipCostFor(RULES_V08, 'free-port', 'gambler')).toBe(25);
    expect(shipCostFor(RULES_V08, 'free-port', 'hidden')).toBe(20);
    expect(shipCostFor(RULES_V08, 'free-port', 'freighter')).toBe(37);
    expect(shipCostFor(RULES_V08, 'free-port', 'standard')).toBe(0);
    expect(shipCostFor(RULES_V08, 'mine', 'freighter')).toBe(75);
    expect(shipCostFor(RULES_V07, 'free-port', 'gambler')).toBe(0);
  });

  it('gives the lighthouse its +1 only on a raw die of 3 or more (user idea, 2026-11-16)', () => {
    expect(ownShipApplies(RULES_V08, 2)).toBe(false);
    expect(ownShipApplies(RULES_V08, 3)).toBe(true);
    expect(ownShipApplies(RULES_V07, 1)).toBe(true);
    expect(modifiers(lighthouseRound(RULES_V08, 2).events)).toMatchObject({ island: 0, final: 2 });
    expect(modifiers(lighthouseRound(RULES_V08, 3).events)).toMatchObject({ island: 1, final: 4 });
    // A raw 1 still sinks the lighthouse's standard ship.
    expect(modifiers(lighthouseRound(RULES_V08, 1).events)).toMatchObject({ island: 0, final: 1 });
  });

  it('keeps the earlier lighthouse ideas as switches (off in the baseline)', () => {
    const fading = withIslands({ lighthouseFades: 1 });
    expect(ownShipShift(RULES_V08, 1, phase(2))).toBe(1);
    expect(ownShipShift(fading, 1, phase(2))).toBe(0);
    expect(ownShipShift(fading, 1, phase(1, true), true)).toBe(0);
    expect(islandFaded(fading, phase(2))).toBe(true);
    expect(beaconShift(RULES_V08, 'lighthouse')).toBe(0);
    const beacon = withIslands({ lighthouseBeacon: -1, ownShipMinRaw: 0 });
    expect(beaconShift(beacon, 'lighthouse')).toBe(-1);
    // 4 + 1 (lighthouse) − 2 (pirate under the beacon) = 3.
    expect(modifiers(lighthouseRound(beacon, 4, true).events)).toMatchObject({ pirate: -2, island: 1, final: 3 });
  });

  it('keeps the free port’s restless gambler as a switch (off in the baseline)', () => {
    expect(shipTypeAvailableFor(RULES_V08, 'free-port', 'gambler', 3, 4)).toBe(false);
    expect(shipTypeAvailableFor(withIslands({ freePortGamblerNoRest: 1 }), 'free-port', 'gambler', 3, 4)).toBe(true);
    expect(shipTypeAvailableFor(withIslands({ freePortGamblerNoRest: 1 }), 'lighthouse', 'gambler', 3, 4)).toBe(false);
  });
});
