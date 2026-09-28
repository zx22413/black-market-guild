import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createMatch,
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  type Action,
  type MatchEvent,
  type MatchState,
  type PrivateEvent,
} from '../../src/game';
import {
  atPhase,
  FOUR_PLAYERS,
  NEUTRAL_EVENT_RULES,
  playUntil,
  scripted,
  startMatch,
  unwrap,
  withRawRolls,
  type Script,
} from './helpers';

// Switchable rule: roles.smuggler.anonymous = 1 (under evaluation, docs/open-questions.md Q-06).
const RULES = {
  ...NEUTRAL_EVENT_RULES,
  roles: { ...NEUTRAL_EVENT_RULES.roles, smuggler: { fee: 0, goodsValue: 300, anonymous: 1 } },
};

/** p1 recruits p2 (joint r1-s1); p3 sails solo (r1-s2); p4 stays in port. */
const BASE: Script = { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' }, solo: ['p3'] };

function toDeployment(script: Script) {
  return playUntil(startMatch({ rules: RULES }).state, atPhase('role-deployment', 1), scripted(script)).state;
}

function playRound(script: Script, rolls: Readonly<Record<string, number>>) {
  let state: MatchState = withRawRolls(toDeployment(script), rolls);
  const chooser = scripted(script);
  const events: MatchEvent[] = [];
  const privateEvents: PrivateEvent[] = [];
  const views: ReturnType<typeof getPlayerView>[] = [];
  while (state.round === 1 && state.phase !== 'game-over') {
    const decision = getPendingDecisions(state)[0]!;
    const t = unwrap(applyAction(state, chooser(state, decision.playerId, getLegalActions(state, decision.playerId))));
    state = t.state;
    events.push(...t.events);
    privateEvents.push(...t.privateEvents);
  }
  views.push(getPlayerView(state, 'p1'));
  return { state, events, privateEvents };
}

const keys = (legal: readonly Action[]) =>
  legal.flatMap((a) => (a.type === 'deploy-role' && a.role === 'smuggler' ? [a.targetShipId] : []));

describe('anonymous smuggling configuration', () => {
  it('rejects a smuggler fee, because a public fee would reveal the anonymous smuggler', () => {
    const rules = { ...RULES, roles: { ...RULES.roles, smuggler: { fee: 50, goodsValue: 300, anonymous: 1 } } };
    const result = createMatch({ seed: 1, players: FOUR_PLAYERS, rules });
    expect(!result.ok && result.error.code).toBe('invalid-config');
  });
});

describe('anonymous smuggling targets', () => {
  it('lets anyone smuggle onto any sailing ship except their own solo ship', () => {
    const state = toDeployment(BASE);
    expect(keys(getLegalActions(state, 'p4'))).toEqual(['r1-s1', 'r1-s2']);
    expect(keys(getLegalActions(state, 'p3'))).toEqual(['r1-s1']);
    expect(keys(getLegalActions(state, 'p2'))).toEqual(['r1-s1', 'r1-s2']);
  });
});

describe('anonymous smuggling reveal and payout', () => {
  const script: Script = { ...BASE, deploy: { p4: { role: 'smuggler', target: 'r1-s2' } } };

  it('shows the smuggler as undeployed at the reveal', () => {
    const { events } = playRound(script, { 'r1-s2': 5 });
    const smugglerReveal = events.find((e) => e.type === 'roles-revealed' && e.role === 'smuggler');
    expect(smugglerReveal).toMatchObject({ deployments: [] });
  });

  it('takes the goods as hidden black money: no public cash change, only a private notice', () => {
    const { state, events, privateEvents } = playRound(script, { 'r1-s2': 5 });
    expect(events).toContainEqual({ type: 'ship-smuggled', round: 1, shipId: 'r1-s2', amount: 300 });
    expect(events.some((e) => e.type === 'cash-changed' && e.playerId === 'p4')).toBe(false);
    expect(privateEvents).toContainEqual({ playerId: 'p4', type: 'black-money', round: 1, shipId: 'r1-s2', amount: 300 });
    // the solo owner's 300 G income was fully taken
    expect(events.some((e) => e.type === 'cash-changed' && e.reason === 'shipping-income' && e.playerId === 'p3')).toBe(false);
    const p4 = state.players.find((p) => p.id === 'p4')!;
    expect([p4.cash, p4.blackMoney]).toEqual([1000, 300]);
    expect(getPlayerView(state, 'p4').myBlackMoney).toBe(300);
    expect(JSON.stringify(getPlayerView(state, 'p1'))).not.toContain('blackMoney":300');
    expect(JSON.stringify(events)).not.toContain('"p4","role":"smuggler"');
  });

  it('reveals the smuggler when a guard on the arriving ship catches them', () => {
    const caught: Script = { ...BASE, deploy: { p4: { role: 'smuggler', target: 'r1-s2' }, p1: { role: 'guard', target: 'r1-s2' } } };
    const { events } = playRound(caught, { 'r1-s2': 5 });
    expect(events).toContainEqual({ type: 'smugglers-caught', round: 1, shipId: 'r1-s2', smugglers: ['p4'] });
    expect(events).toContainEqual({
      type: 'cash-changed',
      round: 1,
      playerId: 'p1',
      amount: 300,
      reason: 'smuggling-confiscated',
      shipId: 'r1-s2',
    });
  });

  it('keeps the smuggler anonymous when pirates seize the goods from a sunk ship', () => {
    const seized: Script = { ...BASE, deploy: { p4: { role: 'smuggler', target: 'r1-s2' }, p1: { role: 'pirate', target: 'r1-s2' } } };
    const { events } = playRound(seized, { 'r1-s2': 2 });
    expect(events.some((e) => e.type === 'smugglers-caught')).toBe(false);
    expect(events).toContainEqual({
      type: 'cash-changed',
      round: 1,
      playerId: 'p1',
      amount: 300,
      reason: 'smuggling-seized',
      shipId: 'r1-s2',
    });
  });

  it('splits the base income, rounded down, when three stashes exceed it', () => {
    const big = { ...RULES, roles: { ...RULES.roles, smuggler: { fee: 0, goodsValue: 300, anonymous: 1 } } };
    const script3: Script = {
      ...BASE,
      deploy: {
        p1: { role: 'smuggler', target: 'r1-s1' },
        p3: { role: 'smuggler', target: 'r1-s1' },
        p4: { role: 'smuggler', target: 'r1-s1' },
      },
    };
    let state = withRawRolls(playUntil(startMatch({ rules: big }).state, atPhase('role-deployment', 1), scripted(script3)).state, { 'r1-s1': 6 });
    const privateEvents: PrivateEvent[] = [];
    const events: MatchEvent[] = [];
    while (state.round === 1) {
      const d = getPendingDecisions(state)[0]!;
      const next = unwrap(applyAction(state, scripted(script3)(state, d.playerId, getLegalActions(state, d.playerId))));
      state = next.state;
      events.push(...next.events);
      privateEvents.push(...next.privateEvents);
    }
    // 900 G of goods exceed the 700 G base income: each smuggler takes floor(700 / 3) = 233
    expect(privateEvents.filter((e) => e.type === 'black-money').map((e) => (e.type === 'black-money' ? e.amount : 0))).toEqual([233, 233, 233]);
    expect(events.some((e) => e.type === 'cash-changed' && e.reason === 'shipping-income' && e.shipId === 'r1-s1')).toBe(false);
  });

  it('reveals and adds black money to cash when the match ends', () => {
    let state = startMatch({ rules: RULES }).state;
    const round1 = scripted(script);
    const chooser: typeof round1 = (s, id, legal) => (s.round === 1 ? round1(s, id, legal) : legal[0]!);
    const events: MatchEvent[] = [];
    let rolled = false;
    while (state.phase !== 'game-over') {
      if (!rolled && state.phase === 'role-deployment') {
        state = withRawRolls(state, { 'r1-s2': 6 });
        rolled = true;
      }
      const d = getPendingDecisions(state)[0]!;
      const t = unwrap(applyAction(state, chooser(state, d.playerId, getLegalActions(state, d.playerId))));
      state = t.state;
      events.push(...t.events);
    }
    const reveal = events.find((e) => e.type === 'cash-changed' && e.reason === 'black-money');
    expect(reveal).toMatchObject({ playerId: 'p4' });
    const p4 = state.players.find((p) => p.id === 'p4')!;
    expect(p4.blackMoney).toBe(0);
    expect(state.result?.standings.find((s) => s.playerId === 'p4')?.cash).toBe(p4.cash);
  });
});
