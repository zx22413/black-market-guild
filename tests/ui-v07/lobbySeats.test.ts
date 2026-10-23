import { describe, expect, it } from 'vitest';
import { seatCards } from '../../src/ui-v07/online/lobbySeats';

const host = { name: '房主', isHost: true, online: true };
const guest = { name: '客人', isHost: false, online: false };

describe('lobby seat cards', () => {
  it('lists members in join order, then open seats up to the seat count', () => {
    expect(seatCards([host, guest], 4)).toEqual([{ kind: 'member', ...host }, { kind: 'member', ...guest }, { kind: 'empty' }, { kind: 'empty' }]);
  });

  it('never drops a member when the seat count is smaller', () => {
    expect(seatCards([host, guest], 1).map((c) => c.kind)).toEqual(['member', 'member']);
    expect(seatCards([], 3).map((c) => c.kind)).toEqual(['empty', 'empty', 'empty']);
  });
});
