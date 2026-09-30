import type { VoyageModifier } from '../../game';

/** Milliseconds between die beats; playback waits for the longest die before outcomes. */
export const DIE_BEAT_MS = 650;

/** One beat of the die animation: the value shown and what just changed it. */
export interface DieStep {
  readonly value: number;
  readonly label: string;
}

/** What the viewer's own intel merchant saw on a ship; private to the viewer. */
export interface IntelTrace {
  readonly raw: number;
  readonly rerolled: number | null;
}

const signed = (n: number): string => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

const STEPS = [
  ['guard', '護衛'],
  ['pirate', '海盜'],
  ['event', '事件'],
] as const;

/**
 * The running value of a ship's die, one modifier at a time (game-design.md §7 order):
 * start → guards → pirates → events → clamp. Only the intel merchant who saw it gets the
 * original roll before the reroll; everyone else starts from the public starting roll.
 */
export function dieSteps(modifier: VoyageModifier, rerolled: boolean, intel: IntelTrace | null): DieStep[] {
  const steps: DieStep[] =
    intel?.rerolled != null
      ? [
          { value: intel.raw, label: '原始（僅你知道）' },
          { value: modifier.base, label: '重擲' },
        ]
      : [{ value: modifier.base, label: rerolled ? '重擲後' : '起始' }];
  let running = modifier.base;
  for (const [key, label] of STEPS) {
    if (modifier[key] === 0) continue;
    running += modifier[key];
    steps.push({ value: running, label: `${label} ${signed(modifier[key])}` });
  }
  if (running !== modifier.final) {
    steps.push({ value: modifier.final, label: '骰值上下限' });
  }
  return steps;
}
