import { describe, expect, it } from 'vitest';
import { startGameSession, type GameSession, type SessionSnapshot } from '../../src/ui/session/gameSession';

/** Resolves once the session snapshot satisfies the predicate. */
function waitFor(session: GameSession, predicate: (s: SessionSnapshot) => boolean): Promise<SessionSnapshot> {
  return new Promise((resolve) => {
    const check = () => {
      const snapshot = session.getSnapshot();
      if (predicate(snapshot)) {
        unsubscribe();
        resolve(snapshot);
      }
    };
    const unsubscribe = session.subscribe(check);
    check();
  });
}

/** Answers every human request with its first legal action until the match ends. */
async function autoplay(session: GameSession): Promise<SessionSnapshot> {
  for (;;) {
    const snapshot = await waitFor(session, (s) => s.status !== 'running' || s.requests.length > 0);
    const request = snapshot.requests[0];
    if (snapshot.status !== 'running' || !request) {
      return snapshot;
    }
    session.submit(request.id, request.context.legalActions[0]!);
  }
}

describe('game session', () => {
  it('lists the seats still deciding (people only) in waitingOn', async () => {
    const session = startGameSession({
      seed: 3,
      seats: [
        { kind: 'local-human', name: '甲' },
        { kind: 'local-human', name: '乙' },
        { kind: 'bot', name: 'Bot', strategy: 'balanced' },
      ],
    });
    const both = await waitFor(session, (s) => s.requests.length === 2);
    expect(both.waitingOn).toEqual(['p1', 'p2']);
    session.submit(both.requests[0]!.id, both.requests[0]!.context.legalActions[0]!);
    expect(session.getSnapshot().waitingOn).toEqual(['p2']);
  });

  it('asks the human seat and finishes a 1 human + 2 bot match', async () => {
    const session = startGameSession({
      seed: 7,
      seats: [
        { kind: 'local-human', name: '玩家' },
        { kind: 'bot', name: 'Bot A', strategy: 'balanced' },
        { kind: 'bot', name: 'Bot B', strategy: 'random' },
      ],
    });
    const first = await waitFor(session, (s) => s.requests.length > 0);
    expect(first.requests[0]!.context.decision).toEqual({ playerId: 'p1', phase: 'asset-purchase' });

    const final = await autoplay(session);
    expect(final.status).toBe('finished');
    expect(final.result?.standings).toHaveLength(3);
    expect(final.events.filter((e) => e.type === 'round-started')).toHaveLength(6);
  });

  it('queues simultaneous hot-seat decisions in seat order', async () => {
    const session = startGameSession({
      seed: 3,
      seats: [
        { kind: 'local-human', name: 'A' },
        { kind: 'bot', name: 'B', strategy: 'random' },
        { kind: 'local-human', name: 'C' },
      ],
    });
    const snapshot = await waitFor(session, (s) => s.requests.length === 2);
    expect(snapshot.requests.map((r) => r.context.decision.playerId)).toEqual(['p1', 'p3']);
    expect((await autoplay(session)).status).toBe('finished');
  });

  it('rejects actions that were not offered', async () => {
    const session = startGameSession({
      seed: 1,
      seats: [
        { kind: 'local-human', name: 'A' },
        { kind: 'bot', name: 'B', strategy: 'random' },
        { kind: 'bot', name: 'C', strategy: 'random' },
      ],
    });
    const { requests } = await waitFor(session, (s) => s.requests.length > 0);
    const forged = { ...requests[0]!.context.legalActions[0]! };
    expect(() => session.submit(requests[0]!.id, forged)).toThrow(/legal actions/);
    expect(() => session.submit(999, forged)).toThrow(/no pending request/);
  });

  it('plays an all-bot match for spectating', async () => {
    const session = startGameSession({
      seed: 11,
      seats: [
        { kind: 'bot', name: 'A', strategy: 'balanced' },
        { kind: 'bot', name: 'B', strategy: 'aggressive' },
        { kind: 'bot', name: 'C', strategy: 'cautious' },
        { kind: 'bot', name: 'D', strategy: 'opportunist' },
      ],
    });
    const final = await waitFor(session, (s) => s.status !== 'running');
    expect(final.status).toBe('finished');
    expect(final.events.at(-1)?.type).toBe('match-ended');
  });
});
