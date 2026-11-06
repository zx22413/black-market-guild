import { RULES_V07, shipSinks, type Rules, type ShipTypeId } from '../../v07/game';

/** One cell of a ship's die meter: its final value, and whether a ship ending on it goes down. */
export interface MeterCell {
  readonly value: number;
  readonly sinks: boolean;
}

/**
 * The die meter of a ship type, top value first: every final value from the type's own table (the albatross's 1 sinks and
 * 2–6 arrive; the gamble sinks on 1–4; the tsunami runs to 9), red where it pays nothing and green where it pays.
 */
export function shipMeter(type: ShipTypeId, rules: Rules = RULES_V07): readonly MeterCell[] {
  const top = rules.ships.enabled === 1 ? Math.max(...Object.keys(rules.ships.types[type].curve).map(Number)) : rules.sailing.dieMax;
  return Array.from({ length: top }, (_, i) => top - i).map((value) => ({ value, sinks: shipSinks(rules, type, value) }));
}
