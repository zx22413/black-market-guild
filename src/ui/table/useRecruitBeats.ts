import { useEffect, useRef, useState } from 'react';
import type { MatchEvent, PlayerId } from '../../game';

export interface RecruitBeat {
  readonly id: number;
  readonly playerId: PlayerId;
  readonly ok: boolean;
  readonly text: string;
}

const BEAT_MS = 3000;

/** Who succeeded or failed at joint-venture recruitment once the ventures are announced. */
function beatsFor(played: readonly MatchEvent[], index: number, nameOf: (id: PlayerId) => string): Omit<RecruitBeat, 'id'>[] {
  const formed = played[index];
  if (formed?.type !== 'joint-ventures-formed') return [];
  let roundStart = index;
  while (roundStart >= 0 && played[roundStart]?.type !== 'round-started') roundStart--;
  const round = played.slice(roundStart + 1, index);
  const recruiters = round.flatMap((e) => (e.type === 'recruitments-announced' ? e.recruiters : []));
  const withdrawn = round.flatMap((e) => (e.type === 'recruitments-withdrawn' ? e.recruiters : []));
  const applicants = round.flatMap((e) => (e.type === 'applications-announced' ? e.applications.map((a) => a.applicantId) : []));

  const beats: Omit<RecruitBeat, 'id'>[] = [];
  const matched = new Set<PlayerId>();
  for (const { recruiterId, applicantId } of formed.ventures) {
    matched.add(recruiterId).add(applicantId);
    beats.push({ playerId: recruiterId, ok: true, text: `合資成功・${nameOf(applicantId)}` });
    beats.push({ playerId: applicantId, ok: true, text: `合資成功・${nameOf(recruiterId)}` });
  }
  for (const id of recruiters) {
    if (!withdrawn.includes(id) && !matched.has(id)) beats.push({ playerId: id, ok: false, text: '招募失敗' });
  }
  for (const id of applicants) {
    if (!matched.has(id)) beats.push({ playerId: id, ok: false, text: '應徵落空' });
  }
  return beats;
}

/** Turns newly played joint-venture results into short-lived stamps on the islands. */
export function useRecruitBeats(played: readonly MatchEvent[], nameOf: (id: PlayerId) => string): readonly RecruitBeat[] {
  const [beats, setBeats] = useState<readonly RecruitBeat[]>([]);
  const seen = useRef(played.length);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (played.length < seen.current) seen.current = 0;
    const fresh: RecruitBeat[] = [];
    for (let i = seen.current; i < played.length; i++) {
      beatsFor(played, i, nameOf).forEach((b) => fresh.push({ ...b, id: nextId.current++ }));
    }
    seen.current = played.length;
    if (fresh.length === 0) return;
    setBeats((current) => [...current, ...fresh]);
    const ids = new Set(fresh.map((b) => b.id));
    timers.current.push(setTimeout(() => setBeats((current) => current.filter((b) => !ids.has(b.id))), BEAT_MS));
  }, [played, nameOf]);

  return beats;
}
