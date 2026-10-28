import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { GameSession } from '../session/gameSession';
import { flushNow, nextMatchNumber, track } from './track';
import { matchMode, roleCounts, roundStats, statsSeat, whereInMatch } from './matchStats';

// Statistics of one match screen: its start, every round's end, its end, or where it was left,
// and how long the 3D table took to load. Mounted once per match by MatchView.

export function useMatchAnalytics(session: GameSession): { readonly onReady: () => void } {
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const startedAt = useRef(Date.now());
  const done = useRef({ started: false, ready: false, ended: false, quit: false, rounds: new Set<number>() });
  const latest = useRef(snap);
  latest.current = snap;

  const mode = matchMode(snap.players);
  const seat = statsSeat(snap.players);

  useEffect(() => {
    if (done.current.started) return;
    done.current.started = true;
    track('match_start', { mode, seats: snap.players.length, nth: nextMatchNumber() });
    // Started once per mount; the players never change within a match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (seat === null) return;
    const ids = snap.players.map((p) => p.id);
    roundStats(snap.events, ids, snap.startingCash, seat).forEach((r) => {
      if (done.current.rounds.has(r.round)) return;
      done.current.rounds.add(r.round);
      track('round_end', { mode, round: r.round, cash: r.cash, rank: r.rank });
    });
    const result = snap.result;
    const mine = result?.standings.find((s) => s.playerId === seat);
    if (mine && !done.current.ended) {
      done.current.ended = true;
      const chosen = snap.events.find((e) => e.type === 'islands-chosen');
      track('match_end', {
        mode,
        rank: mine.rank,
        wealth: mine.wealth,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
        island: chosen?.type === 'islands-chosen' ? (chosen.islands[seat] ?? '') : '',
        roles: roleCounts(snap.events, seat),
      });
    }
  }, [snap, seat, mode]);

  // Left before the end: by the exit button (unmount) or by closing the page.
  useEffect(() => {
    const quit = () => {
      if (done.current.ended || done.current.quit) return;
      done.current.quit = true;
      const at = whereInMatch(latest.current.events);
      track('match_quit', { mode: matchMode(latest.current.players), round: at.round, phase: at.phase });
    };
    const onLeave = () => {
      quit();
      flushNow();
    };
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      quit();
    };
  }, []);

  return {
    onReady: () => {
      if (done.current.ready) return;
      done.current.ready = true;
      track('table_ready', { mode, ms: Date.now() - startedAt.current });
    },
  };
}
