import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/game';
import {
  ENVELOPE_TEAR_MS,
  HANDSHAKE_MS,
  PIGEON_FLIGHT_MS,
  PIGEON_STAGGER_MS,
  recruitShow,
} from '../../src/ui/table/recruitShow';

const ORDER = ['p1', 'p2', 'p3', 'p4'];
const start: MatchEvent = { type: 'round-started', round: 1 };

function round(...events: MatchEvent[]): MatchEvent[] {
  return [start, ...events];
}
const recruiters = (ids: string[]): MatchEvent => ({ type: 'recruitments-announced', round: 1, recruiters: ids });
const withdrawn = (ids: string[]): MatchEvent => ({ type: 'recruitments-withdrawn', round: 1, recruiters: ids });
const applied = (pairs: [string, string][]): MatchEvent => ({
  type: 'applications-announced',
  round: 1,
  applications: pairs.map(([applicantId, recruiterId]) => ({ applicantId, recruiterId })),
});
const formed = (pairs: [string, string][]): MatchEvent => ({
  type: 'joint-ventures-formed',
  round: 1,
  ventures: pairs.map(([recruiterId, applicantId]) => ({ recruiterId, applicantId })),
});

describe('recruitment show', () => {
  it('ignores events that are not part of recruitment', () => {
    expect(recruitShow(round({ type: 'phase-started', round: 1, phase: 'recruit' }), 1, ORDER).duration).toBe(0);
  });

  it('gives the parchments time to pop up when recruiters are announced', () => {
    const events = round(recruiters(['p2']));
    expect(recruitShow(events, 1, ORDER).duration).toBeGreaterThan(1000);
    expect(recruitShow(round(recruiters([])), 1, ORDER).duration).toBe(0);
  });

  it('quietly withdraws the parchment of a recruiter who applied elsewhere, without tearing it', () => {
    const show = recruitShow(round(recruiters(['p2']), withdrawn(['p2'])), 2, ORDER);
    expect(show.cues.map((c) => [c.kind, c.player])).toEqual([['parchment-withdraw', 'p2']]);
  });

  it('sends one pigeon per application, one after another', () => {
    const events = round(recruiters(['p2', 'p3']), applied([['p1', 'p2'], ['p4', 'p3']]));
    const show = recruitShow(events, 2, ORDER);
    expect(show.cues.map((c) => [c.kind, c.player, c.to, c.at])).toEqual([
      ['pigeon', 'p1', 'p2', 0],
      ['pigeon', 'p4', 'p3', PIGEON_STAGGER_MS],
    ]);
    expect(show.duration).toBeGreaterThanOrEqual(PIGEON_STAGGER_MS + PIGEON_FLIGHT_MS);
  });

  it('plays a handshake on both islands for a pairing', () => {
    const events = round(recruiters(['p2']), applied([['p1', 'p2']]), formed([['p2', 'p1']]));
    const show = recruitShow(events, 3, ORDER);
    const handshakes = show.cues.filter((c) => c.kind === 'handshake');
    expect(handshakes.map((c) => c.player).sort()).toEqual(['p1', 'p2']);
    expect(handshakes.every((c) => c.at === 0 && c.duration === HANDSHAKE_MS)).toBe(true);
  });

  it('tears the envelope of a rejected applicant after the recruiter picked someone else', () => {
    const events = round(recruiters(['p2']), applied([['p1', 'p2'], ['p3', 'p2']]), formed([['p2', 'p1']]));
    const show = recruitShow(events, 3, ORDER);
    const tear = show.cues.find((c) => c.kind === 'envelope-tear');
    expect(tear?.player).toBe('p3');
    // The pairing plays first, then the rejection.
    expect(tear?.at).toBe(HANDSHAKE_MS);
    expect(show.duration).toBeGreaterThanOrEqual(HANDSHAKE_MS + ENVELOPE_TEAR_MS);
  });

  it('tears the parchment of a recruiter nobody applied to', () => {
    const events = round(recruiters(['p2']), applied([]), formed([]));
    const show = recruitShow(events, 3, ORDER);
    expect(show.cues.filter((c) => c.kind === 'parchment-tear').map((c) => c.player)).toEqual(['p2']);
  });

  it('plays the groups one after another, ordered by the recruiter\'s seat', () => {
    const events = round(recruiters(['p4', 'p2']), applied([['p1', 'p4'], ['p3', 'p2']]), formed([['p4', 'p1'], ['p2', 'p3']]));
    const show = recruitShow(events, 3, ORDER);
    const starts = show.cues.filter((c) => c.kind === 'handshake').map((c) => [c.player, c.at]);
    // p2 (seat 2) and its partner p3 go first, then p4 and p1.
    expect(starts).toEqual([['p2', 0], ['p3', 0], ['p4', HANDSHAKE_MS], ['p1', HANDSHAKE_MS]]);
  });

  it('keeps a parchment up until its own group comes up', () => {
    const events = round(recruiters(['p2', 'p4']), applied([['p1', 'p2'], ['p3', 'p4']]), formed([['p2', 'p1'], ['p4', 'p3']]));
    const holds = recruitShow(events, 3, ORDER).cues.filter((c) => c.kind === 'parchment-hold');
    expect(holds.map((c) => [c.player, c.duration])).toEqual([['p2', 0], ['p4', HANDSHAKE_MS]]);
  });

  it('does not count a withdrawn recruiter as a failed recruitment', () => {
    const events = round(recruiters(['p2', 'p3']), withdrawn(['p2']), applied([['p2', 'p3']]), formed([['p3', 'p2']]));
    const show = recruitShow(events, 4, ORDER);
    expect(show.cues.some((c) => c.kind === 'parchment-tear')).toBe(false);
  });
});
