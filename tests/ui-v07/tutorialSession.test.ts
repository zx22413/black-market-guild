import { describe, expect, it } from 'vitest';
import { startTutorialSession } from '../../src/ui-v07/session/tutorialSession';
import { BASICS, INTEL, scriptedAction } from '../../src/v07/tutorial';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('tutorial session', () => {
  it('shows your first decision but holds it until the host steps before it are read', async () => {
    const session = startTutorialSession(BASICS);
    session.setCalm(true);
    await settle();
    expect(session.getSnapshot().requests[0]?.context.decision).toMatchObject({ playerId: 'p1', phase: 'invest' });
    expect(session.getCoach()).toMatchObject({ step: BASICS.coach[0], holdsDecision: true });

    const before = BASICS.coach.filter((s) => s.trigger.kind === 'decision' && s.trigger.round === 1).length;
    for (let i = 0; i < before; i += 1) session.read();
    expect(session.getCoach()).toMatchObject({ step: null, holdsDecision: false, todo: BASICS.coach[before - 1]!.todo });
    expect(session.getCoach().focus).toEqual(BASICS.coach[before - 1]!.focus);
  });

  it('waits to show a decision\'s steps until nothing is still playing in front of it', async () => {
    const session = startTutorialSession(BASICS);
    await settle();
    expect(session.getCoach().step).toBeNull();
    session.setCalm(true);
    expect(session.getCoach().step).toBe(BASICS.coach[0]);
  });

  it('lights 「提交」 once the choice on the table matches the lesson', async () => {
    const session = startTutorialSession(BASICS);
    session.setCalm(true);
    await settle();
    BASICS.coach.slice(0, 4).forEach(() => session.read());
    const request = session.getSnapshot().requests[0]!;
    const woodOnly = request.context.legalActions.find((a) => a.type === 'invest' && a.load.spice === 0)!;
    session.setDraft(woodOnly);
    expect(session.getCoach()).toMatchObject({ ready: false });
    session.setDraft(scriptedAction(BASICS, request.context));
    expect(session.getCoach()).toMatchObject({ ready: true, focus: [{ kind: 'submit' }] });
    session.setDraft(null);
    expect(session.getCoach().ready).toBe(false);
  });

  it('explains round 1\'s prices on the market card, holding the card until read', async () => {
    const session = startTutorialSession(BASICS);
    session.setCalm(true);
    await settle();
    for (let guard = 0; guard < 10 && session.getSnapshot().requests[0]?.context.decision.phase !== 'invest'; guard += 1) await settle();
    BASICS.coach.slice(0, 4).forEach(() => session.read());
    const request = session.getSnapshot().requests[0]!;
    session.submit(request.id, scriptedAction(BASICS, request.context));
    await settle();
    session.setStarted(1);
    session.read();
    session.read();
    expect(session.getCoach().step).toBeNull();
    session.setMarket(1);
    expect(session.getCoach()).toMatchObject({ step: { trigger: { kind: 'market', round: 1 } }, holdsMarket: true, focus: [{ kind: 'market-card' }] });
    session.read();
    expect(session.getCoach().holdsMarket).toBe(false);
  });

  it('offers only the loads the lesson allows', async () => {
    const session = startTutorialSession(BASICS);
    session.setCalm(true);
    await settle();
    BASICS.coach.slice(0, 4).forEach(() => session.read());
    const request = session.getSnapshot().requests[0]!;
    const loads = request.context.legalActions.map((a) => (a.type === 'invest' ? a.load : null));
    expect(loads).toHaveLength(3);
    expect(loads.every((l) => l !== null && l.iron === 0 && l.arms === 0 && l.wood <= 1 && l.spice <= 1)).toBe(true);
  });

  it('plays your investment for you in a role lesson and waits at the role decision', async () => {
    const session = startTutorialSession(INTEL);
    session.setCalm(true);
    await settle();
    INTEL.coach.filter((s) => s.trigger.kind === 'decision' && s.trigger.phase === 'role-deployment').forEach(() => session.read());
    const request = session.getSnapshot().requests[0]!;
    expect(request.context.decision.phase).toBe('role-deployment');
    expect(session.getSnapshot().privateEvents.some((e) => e.type === 'cargo-loaded' && e.playerId === 'p1')).toBe(true);
    session.submit(request.id, scriptedAction(INTEL, request.context));
    await settle();
    // The reroll decision waits for its own host step.
    expect(session.getCoach()).toMatchObject({ holdsDecision: true, step: { trigger: { phase: 'intel-reroll' } } });
    session.read();
    const reroll = session.getSnapshot().requests[0]!;
    expect(reroll.context.decision.phase).toBe('intel-reroll');
    expect(session.getSnapshot().privateEvents.find((e) => e.type === 'intel-report')).toMatchObject({ rawRoll: 2 });
  });

  it('reaches the end step once the table has shown the last round', async () => {
    const session = startTutorialSession(INTEL);
    session.setCalm(true);
    session.setStarted(9);
    await settle();
    for (let guard = 0; guard < 20; guard += 1) {
      const request = session.getSnapshot().requests[0];
      if (session.getCoach().step) session.read();
      else if (request) session.submit(request.id, scriptedAction(INTEL, request.context));
      await settle();
    }
    expect(session.getSnapshot().status).toBe('finished');
    expect(session.getCoach().step).toBeNull();
    session.setShown(1, true);
    expect(session.getCoach().step?.trigger.kind).toBe('end');
  });
});
