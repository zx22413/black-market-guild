import { describe, expect, it } from 'vitest';
import { beatCues, beatView, dieTop } from '../../src/ui-v07/beats/beatTimeline';
import type { ShipBeat } from '../../src/ui-v07/beats/shipBeat';

const beat = (type: ShipBeat['type'], start: number, values: number[], final: number): ShipBeat =>
  ({
    type,
    start,
    final,
    steps: values.map((value) => ({ kind: 'guard', delta: 1, value, actors: [], source: null, boosted: [] })),
    cash: [],
    goods: [],
    confiscated: [],
    cargo: {},
  }) as unknown as ShipBeat;

describe('dieTop', () => {
  it('is 6 for a capped ship and 9 for the tsunami', () => {
    expect(dieTop(beat('standard', 3, [], 3))).toBe(6);
    expect(dieTop(beat('breaker', 3, [], 3))).toBe(9);
  });

  it('shows a tsunami die above 6 while a standard ship stays at 6', () => {
    const view = (b: ShipBeat) => beatView(b, beatCues(b), beatCues(b).findIndex((c) => c.kind === 'step') + 1).die;
    expect(view(beat('breaker', 6, [8], 8))).toBe(8);
    expect(view(beat('standard', 6, [8], 6))).toBe(6);
  });
});
