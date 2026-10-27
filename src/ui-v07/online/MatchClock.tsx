import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { FAST_TICK_SECONDS, TICK_SECONDS, TIMEOUT_DEFAULT, URGENT_SECONDS, clockText } from './clockText';
import type { OnlineClient, OnlineState } from './onlineClient';
import './matchClock.css';

// The online match's own layer over the table (docs/game-design.md §15): the countdown of your
// decision, a notice when your time ran out, the takeover banner with 「取消託管」, and who else a
// bot is playing for. The table itself does not know about timers.

const TOAST_MS = 6000;

/** Seconds left until `deadline`, refreshed four times a second; null without one. */
function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  return deadline === null ? null : (deadline - now) / 1000;
}

/** One tick per second in the last seconds; faster at the very end. */
function useTicks(secondsLeft: number | null): void {
  const last = useRef<number | null>(null);
  const whole = secondsLeft === null ? null : Math.ceil(secondsLeft);
  useEffect(() => {
    const before = last.current;
    last.current = whole;
    if (whole === null || before === null || whole === before || whole <= 0 || whole > TICK_SECONDS) return;
    soundEngine.playSfx('ui-tick', whole <= FAST_TICK_SECONDS ? 1.25 : 1);
  }, [whole]);
}

/** The newest timeout notice, shown for a few seconds. */
function useTimeoutToast(lastTimeout: OnlineState['lastTimeout']): OnlineState['lastTimeout'] {
  const [shown, setShown] = useState<OnlineState['lastTimeout']>(null);
  useEffect(() => {
    if (lastTimeout === null) return;
    setShown(lastTimeout);
    const timer = setTimeout(() => setShown(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [lastTimeout]);
  return shown;
}

interface MatchClockProps {
  readonly state: OnlineState;
  readonly client: OnlineClient;
}

export function MatchClock({ state, client }: MatchClockProps) {
  const match = state.room?.match ?? null;
  const running = match !== null && match.result === null && match.error === null;
  const request = running ? (match.requests[0] ?? null) : null;
  const deadline = request ? (state.deadlines[request.id] ?? null) : null;
  const secondsLeft = useSecondsLeft(deadline);
  useTicks(secondsLeft);
  const toast = useTimeoutToast(state.lastTimeout);
  if (!match || !running) return null;

  const you = match.you;
  const takenOver = you !== null && match.takeover.includes(you);
  const others = match.players.filter((p) => p.id !== you && match.takeover.includes(p.id));
  return (
    <div className="mc-layer">
      {takenOver && (
        <div className="mc-takeover" role="status">
          <span>託管中：由電腦代你決定</span>
          <button type="button" className="mc-resume" onClick={() => client.resume()}>
            取消託管
          </button>
        </div>
      )}
      {others.length > 0 && <div className="mc-others">託管中：{others.map((p) => p.name).join('、')}</div>}
      {secondsLeft !== null && !takenOver && (
        <div className={`mc-clock ${secondsLeft <= URGENT_SECONDS ? 'urgent' : ''}`} role="timer" aria-label="決定剩餘時間">
          {clockText(secondsLeft)}
        </div>
      )}
      {toast && !takenOver && (
        <div className="mc-toast" role="alert">
          <strong>時間到，{TIMEOUT_DEFAULT[toast.phase]}</strong>
          <span>再逾時一次，就會由電腦代你決定</span>
        </div>
      )}
    </div>
  );
}
