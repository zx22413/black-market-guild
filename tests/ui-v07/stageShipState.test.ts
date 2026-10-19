import { describe, expect, it } from 'vitest';
import { stageShipState, type ResolutionStage } from '../../src/ui-v07/table3d/useRoundResolution';
import type { ShipState } from '../../src/ui/scene/tableModel';

// How far along its lane each state puts a ship (Ships.tsx LANE_T): sunk ships stay where they went down.
const ALONG: Readonly<Record<ShipState, number>> = { docked: 0, sailing: 0.5, sunk: 0.5, arrived: 0.86 };

describe('ships in the round show', () => {
  it('only ever move on through the stages, whatever their outcome (no jumping ahead to it and back)', () => {
    for (const resting of ['arrived', 'sunk'] as const) {
      const order: [ResolutionStage, number, ShipState | null][] = [
        ['wanted', 0, null],
        ['event', 0, null],
        ['reveal', 0, null],
        ['voyage', 0, 'sailing'],
        ['voyage', 0, resting],
        ['voyage', 1, null],
        ['market', 1, null],
        ['settle', 1, null],
        ['receipt', 1, null],
      ];
      const states = order.map(([stage, voyageIndex, focus]) => stageShipState(stage, 0, voyageIndex, resting, focus));
      expect(states.slice(0, 3)).toEqual(['docked', 'sailing', 'sailing']);
      states.slice(1).forEach((s, i) => expect(ALONG[s]).toBeGreaterThanOrEqual(ALONG[states[i]!]));
      expect(states.at(-1)).toBe(resting);
    }
  });

  it('keeps ships that have not had their beat yet at sea', () => {
    expect(stageShipState('voyage', 3, 1, 'arrived', 'sailing')).toBe('sailing');
  });
});
