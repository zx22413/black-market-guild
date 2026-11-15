import { describe, expect, it } from 'vitest';
import { RULES_V07, RULES_V08_PROTO, beaconShift, islandFaded, ownShipShift, shipCostFor, shipTypeAvailableFor, type PublicEvents } from '../../../src/v07/game';
import { G, edit, find, plain, playRound, withDemand } from './helpers';

/** V0.8 prototype island balance (2026-11-16, test values, not rules). */
describe('V0.8 prototype: island balance', () => {
  it('turns the free port’s −1 capacity into a 25 G harbour tax in the prototype only', () => {
    expect(RULES_V07.islands.traits['free-port']).toMatchObject({ capacityDelta: -1, shipCostDelta: 0 });
    expect(RULES_V08_PROTO.islands.traits['free-port']).toMatchObject({ capacityDelta: 0, shipCostDelta: 25, freeShips: ['gambler'] });
    // The gambler's own fee is waived; the tax applies to every ship.
    expect(shipCostFor(RULES_V08_PROTO, 'free-port', 'gambler')).toBe(25);
    expect(shipCostFor(RULES_V08_PROTO, 'free-port', 'standard')).toBe(25);
  });

  it('keeps the fade switch available but off: the user chose the beacon instead (2026-11-16)', () => {
    const phase = (p: 1 | 2, darkTide = false) => ({ phase: p, darkTide }) as unknown as PublicEvents;
    const fading = { ...RULES_V08_PROTO, v08: { ...RULES_V08_PROTO.v08, islands: { ...RULES_V08_PROTO.v08.islands, lighthouseFades: 1 } } };
    expect(ownShipShift(RULES_V08_PROTO, 1, phase(2))).toBe(1);
    expect(ownShipShift(fading, 1, phase(1))).toBe(1);
    expect(ownShipShift(fading, 1, phase(2))).toBe(0);
    expect(ownShipShift(fading, 1, phase(1, true), true)).toBe(0);
    expect(islandFaded(fading, phase(2))).toBe(true);
    expect(ownShipShift(RULES_V07, 1, phase(2))).toBe(1);
  });

  it('lights the lighthouse owner up for pirates: each pirate is −2 against its ships', () => {
    expect(beaconShift(RULES_V08_PROTO, 'lighthouse')).toBe(-1);
    expect(beaconShift(RULES_V08_PROTO, 'mine')).toBe(0);
    expect(beaconShift(RULES_V07, 'lighthouse')).toBe(0);
    const ready = withDemand(edit(plain(4, RULES_V08_PROTO), 'p1', { island: 'lighthouse', stock: G(3, 3, 1, 1) }), G(2, 2, 2, 1));
    const { events } = playRound(ready, { loads: { p1: G(1) }, rolls: { p1: 4 }, roles: { p2: ['pirate', 'p1'] } });
    // 4 + 1 (lighthouse) − 2 (pirate under the beacon) = 3.
    expect(find(events, 'voyage-modifiers')[0]!.modifiers[0]).toMatchObject({ pirate: -2, island: 1, final: 3 });
  });

  it('lets the free port’s gambler sail every round in the prototype', () => {
    // Launched in round 3: elsewhere it rests in round 4.
    expect(shipTypeAvailableFor(RULES_V08_PROTO, 'free-port', 'gambler', 3, 4)).toBe(true);
    expect(shipTypeAvailableFor(RULES_V08_PROTO, 'lighthouse', 'gambler', 3, 4)).toBe(false);
    expect(shipTypeAvailableFor(RULES_V07, 'free-port', 'gambler', 3, 4)).toBe(false);
  });
});
