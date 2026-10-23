import { describe, expect, it } from 'vitest';
import { menuSeatLooks } from '../../src/ui-v07/menu/menuSeats';

describe('menu islands per page', () => {
  it('keeps every ship shuttling with no flags on the title screen and at the lighthouse', () => {
    for (const stage of ['title', 'tutorial'] as const) {
      expect(menuSeatLooks({ stage }, 4)).toEqual(Array.from({ length: 4 }, () => ({ flag: false, mist: false, ship: 'shuttle', label: null })));
    }
  });

  it('holds your ship at its dock with a lit lantern for single player', () => {
    const looks = menuSeatLooks({ stage: 'local' }, 4);
    expect(looks[0]).toMatchObject({ ship: 'waiting' });
    expect(looks.slice(1).every((l) => l.ship === 'shuttle')).toBe(true);
  });

  it('raises every flag on the online page', () => {
    expect(menuSeatLooks({ stage: 'online' }, 4).every((l) => l.flag && !l.mist)).toBe(true);
  });

  it('shows the lobby on the islands: a flag, a docked ship and the name for each person, mist for open seats', () => {
    const looks = menuSeatLooks({ stage: 'lobby', seats: [{ kind: 'member', name: '房主' }, { kind: 'empty' }, { kind: 'empty' }] }, 4);
    expect(looks[0]).toEqual({ flag: true, mist: false, ship: 'docked', label: '房主' });
    expect(looks[1]).toEqual({ flag: false, mist: true, ship: 'hidden', label: '電腦補上' });
    // A three-seat match leaves the fourth island out of it.
    expect(looks[3]).toEqual({ flag: false, mist: true, ship: 'hidden', label: null });
  });

  it('sends out one ship per seat of the match at the launch', () => {
    const looks = menuSeatLooks({ stage: 'launch', seatCount: 3 }, 4);
    expect(looks.map((l) => l.ship)).toEqual(['launch', 'launch', 'launch', 'hidden']);
    expect(looks.map((l) => l.flag)).toEqual([true, true, true, false]);
  });
});
