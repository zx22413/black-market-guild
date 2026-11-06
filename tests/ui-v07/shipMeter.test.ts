import { describe, expect, it } from 'vitest';
import { shipMeter } from '../../src/ui-v07/beats/shipMeter';

const summary = (type: Parameters<typeof shipMeter>[0]) => {
  const cells = shipMeter(type);
  return { cells: cells.length, red: cells.filter((c) => c.sinks).length, green: cells.filter((c) => !c.sinks).length, top: cells[0]!.value };
};

describe('ship die meters', () => {
  it('shows the albatross as 1 red and 5 green', () => {
    expect(summary('standard')).toEqual({ cells: 6, red: 1, green: 5, top: 6 });
  });

  it('shows the gamble as 4 red and 2 green', () => {
    expect(summary('gambler')).toEqual({ cells: 6, red: 4, green: 2, top: 6 });
  });

  it('shows the tsunami as nine cells, only the 1 red', () => {
    expect(summary('breaker')).toEqual({ cells: 9, red: 1, green: 8, top: 9 });
  });

  it('shows the whale as all green (it does not sink)', () => {
    expect(summary('freighter')).toEqual({ cells: 6, red: 0, green: 6, top: 6 });
  });

  it('lists the highest value first', () => {
    expect(shipMeter('standard').map((c) => c.value)).toEqual([6, 5, 4, 3, 2, 1]);
  });
});
