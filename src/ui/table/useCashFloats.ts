import { useEffect, useRef, useState } from 'react';
import type { MatchEvent, PlayerId } from '../../game';
import { CASH_REASON_LABELS } from '../labels';

export interface CashFloat {
  readonly id: number;
  readonly playerId: PlayerId;
  readonly amount: number;
  readonly label: string;
}

const FLOAT_MS = 2200;
/** Skipping playback can reveal a whole round at once; only the latest few float up. */
const MAX_FLOATS = 12;

/** Turns newly played cash changes into short-lived floating numbers. */
export function useCashFloats(played: readonly MatchEvent[]): readonly CashFloat[] {
  const [floats, setFloats] = useState<readonly CashFloat[]>([]);
  const seen = useRef(played.length);
  const nextId = useRef(1);
  // Each batch expires on its own timer; playback keeps adding events meanwhile.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (played.length < seen.current) seen.current = 0;
    const fresh = played.slice(seen.current).flatMap((e): CashFloat[] =>
      e.type === 'cash-changed'
        ? [{ id: nextId.current++, playerId: e.playerId, amount: e.amount, label: CASH_REASON_LABELS[e.reason] }]
        : [],
    );
    seen.current = played.length;
    if (fresh.length === 0) return;
    setFloats((current) => [...current, ...fresh].slice(-MAX_FLOATS));
    const ids = new Set(fresh.map((f) => f.id));
    timers.current.push(setTimeout(() => setFloats((current) => current.filter((f) => !ids.has(f.id))), FLOAT_MS));
  }, [played]);

  return floats;
}
