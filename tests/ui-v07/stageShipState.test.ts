import { describe, expect, it } from 'vitest';
import { stageShipState, type ResolutionStage } from '../../src/ui-v07/table3d/useRoundResolution';
import type { ShipState } from '../../src/ui/scene/tableModel';

// How far along its lane each state puts a ship (Ships.tsx LANE_T): sunk ships stay where they went down.
const ALONG: Readonly<Record<ShipState, number>> = { docked: 0, atSea: 0.3, sailing: 0.5, sunk: 0.5, arrived: 0.86 };

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

  it('sends a freighter out at sea when it casts off and leaves it there for the rest of the round', () => {
    const states = (['wanted', 'event', 'reveal', 'voyage', 'market', 'settle', 'receipt'] as const).map((stage) => stageShipState(stage, -1, 1, 'atSea', null, 'out'));
    expect(states).toEqual(['docked', 'atSea', 'atSea', 'atSea', 'atSea', 'atSea', 'atSea']);
  });

  it('keeps an arriving freighter at sea until its own beat, sails it in for the beat and leaves it at its outcome', () => {
    const state = (stage: ResolutionStage, voyageIndex: number, focus: ShipState | null) => stageShipState(stage, 1, voyageIndex, 'arrived', focus, 'in');
    expect(state('wanted', 0, null)).toBe('atSea');
    expect(state('reveal', 0, null)).toBe('atSea');
    expect(state('voyage', 0, 'sailing')).toBe('atSea');
    expect(state('voyage', 1, 'sailing')).toBe('sailing');
    expect(state('voyage', 1, 'arrived')).toBe('arrived');
    expect(state('voyage', 2, null)).toBe('arrived');
    expect(state('market', 2, null)).toBe('arrived');
  });
});
