// Which part of the investment the player is in, for the 「left the match」 statistic: the engine
// only knows the phase `invest`, but under the ship-bay rules that phase is two screens (pick the
// ship, then load the cargo), and where people leave is the point of counting. The investment step
// (table3d/useInvestStep) tells this module; useMatchAnalytics reads it when a match is left.

export type InvestStage = 'ship' | 'cargo';

let stage: InvestStage | null = null;

/** Set while the investment is on screen, and back to null when it is not. */
export function setInvestStage(next: InvestStage | null): void {
  stage = next;
}

export function currentInvestStage(): InvestStage | null {
  return stage;
}

/** The phase to record: `invest` becomes `invest-ship` or `invest-cargo` when the stage is known, anything else stays. */
export function splitInvestPhase(phase: string, at: InvestStage | null): string {
  return phase === 'invest' && at !== null ? `invest-${at}` : phase;
}
