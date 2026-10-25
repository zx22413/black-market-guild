import { describe, expect, it } from 'vitest';
import { flightSound } from '../../src/ui-v07/audio/flightSounds';
import type { Flight } from '../../src/ui-v07/table3d/settlementModel';

const flight = (kind: Flight['kind'], amount: number | null = 100): Flight => ({
  key: 'k',
  kind,
  from: { kind: 'harbor' },
  to: { kind: 'island', playerId: 'p1' },
  playerId: 'p1',
  amount,
  good: null,
  units: 0,
  label: '',
  shipId: null,
  building: null,
});

describe('sound of each settlement flight', () => {
  it('rings up sales louder than the other income', () => {
    expect(flightSound(flight('sale'))).toBe('settle-sale');
    for (const kind of ['escort-fee', 'broker-bet', 'broker-lift', 'broker-control'] as const) expect(flightSound(flight(kind))).toBe('settle-coins');
    expect(flightSound(flight('exchange-commission'))).toBe('settle-tick');
  });

  it('tells the smuggler apart from the one who catches or robs him', () => {
    expect(flightSound(flight('smuggling'))).toBe('settle-smuggle');
    expect(flightSound(flight('smuggling-confiscated'))).toBe('settle-caught');
    expect(flightSound(flight('smuggling-fine', -100))).toBe('settle-fine');
    expect(flightSound(flight('smuggling-seized'))).toBe('settle-loot');
    expect(flightSound(flight('pirate-loot'))).toBe('settle-loot');
  });

  it('sounds the goods: seized arms, insurance, salvaged cargo, spoiled spice', () => {
    expect(flightSound(flight('arms-confiscated'))).toBe('settle-arms');
    expect(flightSound(flight('insurance'))).toBe('settle-insurance');
    expect(flightSound(flight('salvage', null))).toBe('settle-salvage');
    expect(flightSound(flight('spoil', null))).toBe('settle-spoil');
  });

  it('leaves out the costs paid before the settlement', () => {
    for (const kind of ['build', 'ship-cost', 'role-fee'] as const) expect(flightSound(flight(kind, -100))).toBeNull();
  });
});
