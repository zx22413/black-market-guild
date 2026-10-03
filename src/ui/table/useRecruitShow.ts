import { useEffect, useRef, useState } from 'react';
import type { MatchEvent, PlayerId } from '../../game';
import { recruitShow, type RecruitCue } from './recruitShow';

/** Cues stay mounted a little past the end of their show so the last animation can finish. */
const CLEANUP_MARGIN_MS = 800;

/**
 * Turns each recruitment event, as playback reveals it, into island animations. Only plays when
 * events arrive one by one: skipping ahead, or rebuilding the table, shows no animation.
 */
export function useRecruitShow(played: readonly MatchEvent[], order: readonly PlayerId[]): readonly RecruitCue[] {
  const [cues, setCues] = useState<readonly RecruitCue[]>([]);
  const seen = useRef(played.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const previous = seen.current;
    seen.current = played.length;
    if (played.length !== previous + 1) return;
    const show = recruitShow(played, previous, order);
    if (show.cues.length === 0) return;
    const keys = new Set(show.cues.map((c) => c.key));
    setCues((current) => [...current, ...show.cues]);
    timers.current.push(setTimeout(() => setCues((current) => current.filter((c) => !keys.has(c.key))), show.duration + CLEANUP_MARGIN_MS));
  }, [played, order]);

  return cues;
}
