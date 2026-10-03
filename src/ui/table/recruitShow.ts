import type { Application, MatchEvent, PlayerId, Venture } from '../../game';
import { closesRecruitment } from '../session/board';

/** What an island plays: parchment tearing or quietly withdrawn, a pigeon leaving, a handshake or a torn envelope. */
export type CueKind = 'parchment-hold' | 'parchment-tear' | 'parchment-withdraw' | 'pigeon' | 'handshake' | 'envelope-tear';

export interface RecruitCue {
  /** Unique per show, so React keeps each cue's animation running. */
  readonly key: string;
  readonly kind: CueKind;
  /** The island the cue plays on (a pigeon starts on it). */
  readonly player: PlayerId;
  /** A pigeon's destination island. */
  readonly to?: PlayerId;
  /** A handshake's other guild: the cuffs wear both colors, the recruiter's on the left. */
  readonly partner?: PlayerId;
  /** A handshake's recruiter, whose cuff is drawn on the left on both islands. */
  readonly recruiter?: PlayerId;
  /** Milliseconds from the start of the show, and how long the cue lasts. */
  readonly at: number;
  readonly duration: number;
}

export interface RecruitShow {
  readonly cues: readonly RecruitCue[];
  /** How long to linger after the event before the next one plays. */
  readonly duration: number;
}

export const PARCHMENT_MS = 1400;
export const TEAR_PARCHMENT_MS = 1200;
/** A withdrawn recruitment just fades away with a hint, with no drama. */
export const WITHDRAW_MS = 1500;
export const PIGEON_STAGGER_MS = 550;
export const PIGEON_FLIGHT_MS = 1400;
/** One result group (a pairing or a rejection) plays this long before the next one starts. */
export const HANDSHAKE_MS = 2100;
export const ENVELOPE_TEAR_MS = 1900;
const TAIL_MS = 300;

const NO_SHOW: RecruitShow = { cues: [], duration: 0 };

interface RoundContext {
  readonly recruiters: readonly PlayerId[];
  readonly withdrawn: readonly PlayerId[];
  readonly applications: readonly Application[];
  /** Every joint venture formed so far this round: a mutual pair while applying, then the picks. */
  readonly ventures: readonly Venture[];
  /** An earlier event of the round already closed recruitment. */
  readonly closed: boolean;
}

/** Public recruitment events of the round that `index` belongs to, up to (not including) it. */
function roundContext(played: readonly MatchEvent[], index: number): RoundContext {
  let start = index;
  while (start >= 0 && played[start]?.type !== 'round-started') start--;
  const round = played.slice(start + 1, index);
  return {
    recruiters: round.flatMap((e) => (e.type === 'recruitments-announced' ? e.recruiters : [])),
    withdrawn: round.flatMap((e) => (e.type === 'recruitments-withdrawn' ? e.recruiters : [])),
    applications: round.flatMap((e) => (e.type === 'applications-announced' ? e.applications : [])),
    ventures: round.flatMap((e) => (e.type === 'joint-ventures-formed' ? e.ventures : [])),
    closed: round.some(closesRecruitment),
  };
}

type Group =
  | { readonly kind: 'handshake'; readonly recruiter: PlayerId; readonly applicant: PlayerId }
  | { readonly kind: 'envelope-tear'; readonly recruiter: PlayerId; readonly applicant: PlayerId }
  | { readonly kind: 'parchment-tear'; readonly recruiter: PlayerId };

const groupMs = (group: Group): number => (group.kind === 'handshake' ? HANDSHAKE_MS : group.kind === 'envelope-tear' ? ENVELOPE_TEAR_MS : TEAR_PARCHMENT_MS + 500);

/**
 * One group per pairing and per rejection, in seat order of the recruiter, so the table can tell
 * who teamed up with whom and who fell through: a handshake, then the rejected envelopes of the
 * same recruiter, then (when nobody was picked) the recruiter's own torn parchment.
 */
function groupsOf(ventures: readonly Venture[], ctx: RoundContext, order: readonly PlayerId[]): Group[] {
  const matched = new Set(ventures.flatMap((v) => [v.recruiterId, v.applicantId]));
  const groups: Group[] = [
    ...ventures.map((v): Group => ({ kind: 'handshake', recruiter: v.recruiterId, applicant: v.applicantId })),
    ...ctx.applications
      .filter((a) => !matched.has(a.applicantId))
      .map((a): Group => ({ kind: 'envelope-tear', recruiter: a.recruiterId, applicant: a.applicantId })),
    ...ctx.recruiters
      .filter((id) => !ctx.withdrawn.includes(id) && !matched.has(id))
      .map((id): Group => ({ kind: 'parchment-tear', recruiter: id })),
  ];
  const rank = (id: PlayerId): number => {
    const seat = order.indexOf(id);
    return seat < 0 ? order.length : seat;
  };
  const stage = { handshake: 0, 'envelope-tear': 1, 'parchment-tear': 2 } as const;
  return groups
    .map((group, i) => ({ group, i }))
    .sort((a, b) => rank(a.group.recruiter) - rank(b.group.recruiter) || stage[a.group.kind] - stage[b.group.kind] || a.i - b.i)
    .map(({ group }) => group);
}

/**
 * The animation that goes with the public event at `index`: parchments, withdrawals and pigeons
 * as recruitment goes on, and the results, pair by pair, once recruitment closes.
 */
export function recruitShow(played: readonly MatchEvent[], index: number, order: readonly PlayerId[]): RecruitShow {
  const event = played[index];
  const tag = `${index}`;
  switch (event?.type) {
    case 'recruitments-announced':
      // The parchments are drawn from the table state; this only gives them time to pop up.
      return event.recruiters.length > 0 ? { cues: [], duration: PARCHMENT_MS } : NO_SHOW;
    case 'recruitments-withdrawn':
      return event.recruiters.length > 0
        ? {
            cues: event.recruiters.map((id) => ({ key: `${tag}-withdraw-${id}`, kind: 'parchment-withdraw', player: id, at: 0, duration: WITHDRAW_MS })),
            duration: WITHDRAW_MS + TAIL_MS,
          }
        : NO_SHOW;
    case 'applications-announced': {
      if (event.applications.length === 0) return NO_SHOW;
      const cues = event.applications.map(
        (a, i): RecruitCue => ({ key: `${tag}-pigeon-${a.applicantId}`, kind: 'pigeon', player: a.applicantId, to: a.recruiterId, at: i * PIGEON_STAGGER_MS, duration: PIGEON_FLIGHT_MS }),
      );
      return { cues, duration: (event.applications.length - 1) * PIGEON_STAGGER_MS + PIGEON_FLIGHT_MS + TAIL_MS };
    }
    default: {
      if (!closesRecruitment(event)) return NO_SHOW;
      const ctx = roundContext(played, index);
      if (ctx.closed) return NO_SHOW;
      const groups = groupsOf(ctx.ventures, ctx, order);
      if (groups.length === 0) return NO_SHOW;
      const cues: RecruitCue[] = [];
      const holdUntil = new Map<PlayerId, number>();
      let at = 0;
      groups.forEach((group, g) => {
        const length = groupMs(group);
        const id = `${tag}-${g}`;
        if (group.kind === 'handshake') {
          const pair = { recruiter: group.recruiter, at, duration: length } as const;
          cues.push({ key: `${id}-r`, kind: 'handshake', player: group.recruiter, partner: group.applicant, ...pair });
          cues.push({ key: `${id}-a`, kind: 'handshake', player: group.applicant, partner: group.recruiter, ...pair });
        } else if (group.kind === 'envelope-tear') {
          cues.push({ key: id, kind: 'envelope-tear', player: group.applicant, at, duration: length });
        } else {
          cues.push({ key: id, kind: 'parchment-tear', player: group.recruiter, at, duration: TEAR_PARCHMENT_MS });
        }
        // A recruiter's parchment stays up until the first group about them starts.
        if (!holdUntil.has(group.recruiter)) holdUntil.set(group.recruiter, at);
        at += length;
      });
      // Parchments that stood on the table until now stay up until their own group comes up;
      // a parchment that tears away itself needs no ghost.
      const tearing = new Set(groups.flatMap((g) => (g.kind === 'parchment-tear' ? [g.recruiter] : [])));
      const standing = ctx.recruiters.filter((id) => !ctx.withdrawn.includes(id) && !tearing.has(id));
      standing.forEach((id) => cues.push({ key: `${tag}-hold-${id}`, kind: 'parchment-hold', player: id, at: 0, duration: holdUntil.get(id) ?? 0 }));
      tearing.forEach((id) => cues.push({ key: `${tag}-hold-${id}`, kind: 'parchment-hold', player: id, at: 0, duration: holdUntil.get(id) ?? 0 }));
      return { cues, duration: at + TAIL_MS };
    }
  }
}
