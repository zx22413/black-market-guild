import type { DecisionPhase } from '../../v07/game';
import {
  DECISION_SECONDS_CHOICES,
  DECISION_SHOW_CAP_SECONDS,
  DEFAULT_DECISION_SECONDS,
  DISCONNECT_GRACE_SECONDS,
  TAKEOVER_AFTER_TIMEOUTS,
} from '../../v07/online';

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

/** The online chapter of the rules book: docs/game-design.md §15 in short, numbers from the protocol. */
export function onlineRules(): readonly { readonly title: string; readonly text: string }[] {
  const choices = DECISION_SECONDS_CHOICES.map((n) => n / 60).join('、');
  return [
    {
      title: '限時',
      text: `線上房間的每個決定都有限時，房主開局前選 ${choices} 分鐘（預設 ${DEFAULT_DECISION_SECONDS / 60} 分鐘）。畫面出現決定時才開始倒數，最晚在送出後 ${DECISION_SHOW_CAP_SECONDS} 秒開始。`,
    },
    { title: '時間到', text: '自動略過：不出航、不建造、不部署、不重擲；選島由電腦代選。' },
    {
      title: '託管',
      text: `連續逾時 ${TAKEOVER_AFTER_TIMEOUTS} 次，或斷線超過 ${DISCONNECT_GRACE_SECONDS} 秒，就由電腦代你決定；回到遊戲按「取消託管」就接回。自己做過一次決定，逾時次數就歸零。`,
    },
    { title: '暫停', text: '所有真人都斷線或都在託管中時，對局暫停；有人回來或取消託管才繼續。' },
    { title: '加入', text: '對局開始後不能再加入新玩家；已經入座的人隨時可以重新連上。單機與同機輪流沒有限時。' },
  ];
}
