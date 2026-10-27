import type { DecisionPhase } from '../../v07/game';

// Pure helpers for the online decision clock and takeover notices (docs/game-design.md §15).

/** Under this many seconds the clock turns urgent. */
export const URGENT_SECONDS = 30;
/** The last seconds tick aloud, the very last ones faster. */
export const TICK_SECONDS = 10;
export const FAST_TICK_SECONDS = 3;

/** "1:05" for 65 seconds left; never below 0:00. */
export function clockText(secondsLeft: number): string {
  const s = Math.max(0, Math.ceil(secondsLeft));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** What was played for the person when their time ran out. */
export const TIMEOUT_DEFAULT: Readonly<Record<DecisionPhase, string>> = {
  'island-choice': '由電腦代選了島',
  invest: '這回合不出航、不建造',
  'role-deployment': '這回合不部署角色',
  'intel-reroll': '不重擲',
};

/** The host's choices for the lobby, in minutes. */
export function limitLabel(seconds: number): string {
  return `${seconds / 60} 分鐘`;
}
