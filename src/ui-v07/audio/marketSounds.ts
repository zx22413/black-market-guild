// The sound of each row of the market card as it shows: steel drums climbing for a price going up,
// falling for one going down, nothing when it holds. A two-step move (spice) is pitched further.
// Pure, so the mapping is tested without audio.

import type { MarketRow } from '../table3d/settlementModel';
import type { SfxId } from './soundPlan';

/** How much further each extra step pitches the phrase (up for a rise, down for a fall). */
const STEP_PITCH = 1.12;

export function marketSound(rows: readonly MarketRow[], before: number, now: number): { readonly id: SfxId; readonly rate: number } | null {
  if (now <= before) return null;
  const row = rows[now - 1];
  if (!row || row.after === row.before) return null;
  const steps = Math.abs(row.after - row.before);
  const rise = row.after > row.before;
  const pitch = STEP_PITCH ** (steps - 1);
  return { id: rise ? 'price-up' : 'price-down', rate: rise ? pitch : 1 / pitch };
}

/** How long after the last row shows the card closes with its plank (that row's price has settled by then). */
export const MARKET_CLOSE_MS = 1000;

/** Whether the card's last row has just shown, so the plank comes down after it. */
export function marketCloses(rows: readonly MarketRow[], before: number, now: number): boolean {
  return rows.length > 0 && before < rows.length && now >= rows.length;
}
