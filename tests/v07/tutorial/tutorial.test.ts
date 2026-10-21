import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../../src/v07/bots';
import type { Action, MatchEvent } from '../../../src/v07/game';
import { createMatch } from '../../../src/v07/game';
import {
  ARMS_COVER,
  BASICS,
  BROKER,
  GUARD,
  INTEL,
  ISLANDS,
  PIRATE,
  SMUGGLER,
  TUTORIALS,
  allowedFor,
  isReady,
  playTutorial,
  scriptedAction,
  tutorialById,
  tutorialStage,
  youChoose,
  type TutorialScript,
} from '../../../src/v07/tutorial';

type Pick = (context: DecisionContext) => Action;

const modifiers = (events: readonly MatchEvent[], round: number, shipId: string) =>
  events.flatMap((e) => (e.type === 'voyage-modifiers' && e.round === round ? e.modifiers : [])).find((m) => m.shipId === shipId);
const outcome = (events: readonly MatchEvent[], shipId: string) => events.find((e) => e.type === 'ship-resolved' && e.shipId === shipId);
const cashFor = (events: readonly MatchEvent[], reason: string, playerId: string) =>
  events.reduce((n, e) => (e.type === 'cash-changed' && e.reason === reason && e.playerId === playerId ? n + e.amount : n), 0);

/** Picks your `index`-th allowed action in the given round and phase, the demo elsewhere. */
function pickNth(script: TutorialScript, round: number, phase: string, index: number): Pick {
  return (c) => (c.view.round === round && c.decision.phase === phase ? c.legalActions[index]! : scriptedAction(script, c));
}

/** Every choice you could make for each decision of yours, so each can be played through. */
function everyChoice(script: TutorialScript, round: number, phase: string): readonly Action[] {
  let options: readonly Action[] = [];
  playTutorial(script, (c) => {
    if (c.view.round === round && c.decision.phase === phase) options = c.legalActions;
    return scriptedAction(script, c);
  });
  return options;
}

describe('every tutorial', () => {
  it.each(TUTORIALS.map((t) => [t.id, t] as const))('%s plays its demo to the end', (_, script) => {
    const log = playTutorial(script);
    expect(log.finalState.phase).toBe('game-over');
    expect(log.finalState.round).toBe(script.rounds.length);
    expect(log.finalState.players.map((p) => p.island)).toEqual(script.seats.map((s) => s.island));
    expect(log.finalState.players.map((p) => p.island)).toEqual(log.events.flatMap((e) => (e.type === 'islands-chosen' ? Object.values(e.islands) : [])));
  });

  it.each(TUTORIALS.map((t) => [t.id, t] as const))('%s offers its demo among your choices, and a host step for every decision', (_, script) => {
    playTutorial(script, (c) => {
      const allowed = allowedFor(script, c);
      const demo = scriptedAction(script, c);
      expect(allowed).toContainEqual(demo);
      const steps = script.coach.filter((s) => s.trigger.kind === 'decision' && s.trigger.round === c.view.round && s.trigger.phase === c.decision.phase);
      // A lesson may end at a decision: its last step is read instead of acting on it.
      if (steps.at(-1) !== script.coach.at(-1)) expect(steps.at(-1)?.todo).toBeDefined();
      return demo;
    });
  });

  it('counts the demo as a complete choice, and an allowed but unfinished one as not yet', () => {
    for (const script of TUTORIALS) {
      playTutorial(script, (c) => {
        const demo = scriptedAction(script, c);
        if (!(script.id === 'islands' && c.decision.phase === 'invest')) expect(isReady(script, c, demo), `${script.id} ${c.view.round} ${c.decision.phase}`).toBe(true);
        return demo;
      });
    }
    const first = playTutorial(BASICS, (c) => {
      if (c.view.round === 1 && c.decision.phase === 'invest') {
        const woodOnly = c.legalActions.find((a) => a.type === 'invest' && a.load.wood === 1 && a.load.spice === 0)!;
        expect(isReady(BASICS, c, woodOnly)).toBe(false);
      }
      return scriptedAction(BASICS, c);
    });
    expect(first.finalState.phase).toBe('game-over');
  });

  it('only lists decisions you make yourself in the host steps', () => {
    for (const script of TUTORIALS) {
      const yours = new Set<string>();
      playTutorial(script, (c) => {
        yours.add(`${c.view.round}:${c.decision.phase}`);
        return scriptedAction(script, c);
      });
      const coached = script.coach.flatMap((s) => (s.trigger.kind === 'decision' ? [`${s.trigger.round}:${s.trigger.phase}`] : []));
      expect([...new Set(coached)].sort()).toEqual([...yours].sort());
    }
  });

  it('finds each lesson by id; every lesson that plays its rounds ends with a step for the end', () => {
    for (const script of TUTORIALS) {
      expect(tutorialById(script.id)).toBe(script);
      expect(script.coach.at(-1)?.trigger.kind).toBe(script.id === 'islands' ? 'decision' : 'end');
    }
  });

  it('guides every investment and role decision you make: what to click first', () => {
    for (const script of TUTORIALS) {
      playTutorial(script, (c) => {
        const steps = script.coach.filter((s) => s.trigger.kind === 'decision' && s.trigger.round === c.view.round && s.trigger.phase === c.decision.phase);
        const last = steps.at(-1);
        const free = isReady(script, c, c.legalActions[0]!) && c.legalActions.length > 1 && c.decision.phase === 'invest';
        const guided = (c.decision.phase === 'invest' || c.decision.phase === 'role-deployment') && last !== script.coach.at(-1) && !free;
        if (guided) expect(last?.guide?.length, `${script.id} ${c.view.round} ${c.decision.phase}`).toBeGreaterThan(0);
        return scriptedAction(script, c);
      });
    }
  });

  it('lights something on every host step', () => {
    for (const script of TUTORIALS) {
      script.coach.forEach((s) => expect(s.focus.length, `${script.id}: ${s.title}`).toBeGreaterThan(0));
    }
  });

  it('keeps the official rule numbers, only fewer rounds (and the broker lesson without cooldown, to play both bets)', () => {
    const created = createMatch({ seed: 1, players: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }, { id: 'c', name: 'c' }] });
    expect(created.ok).toBe(true);
    for (const script of TUTORIALS) {
      const official = created.ok ? created.value.state.rules : null;
      const rules = script.id === 'broker' ? { ...script.rules, roles: { ...script.rules.roles, cooldown: official?.roles.cooldown } } : script.rules;
      expect({ ...rules, rounds: 6 }).toEqual(official);
    }
  });
});

describe('islands', () => {
  it('offers you the Lumber island and the Lighthouse, and you may play either', () => {
    const options = everyChoice(ISLANDS, 0, 'island-choice');
    expect(options.map((a) => (a.type === 'choose-island' ? a.island : null))).toEqual(['lumber', 'lighthouse']);
    const lighthouse = playTutorial(ISLANDS, pickNth(ISLANDS, 0, 'island-choice', 1));
    expect(lighthouse.finalState.players[0]?.island).toBe('lighthouse');
  });
});

describe('stage', () => {
  it('deals your scripted island and keeps the draw piles their length', () => {
    const created = createMatch({ seed: BASICS.seed, players: BASICS.seats.map((s, i) => ({ id: `p${i + 1}`, name: s.name })), rules: BASICS.rules });
    if (!created.ok) throw new Error(created.error.message);
    const staged = tutorialStage(BASICS)(created.value);
    expect(staged.state.demandDeck).toHaveLength(created.value.state.demandDeck.length);
    expect(staged.state.voyageDeck.slice(0, 3)).toEqual(['calm-seas', 'storm', 'tailwind']);
    const offers = staged.privateEvents.find((e) => e.type === 'island-offers' && e.playerId === 'p1');
    expect(offers?.type === 'island-offers' && offers.islands[0]).toBe('lumber');
    expect(staged.state.islandOffers.p1?.[0]).toBe('lumber');
  });
});

describe('basics: the guided match', () => {
  const { events } = playTutorial(BASICS);
  const market = (round: number) => events.find((e): e is Extract<MatchEvent, { type: 'market-settled' }> => e.type === 'market-settled' && e.round === round)!;

  it('plays three rounds and teaches no role: your role decisions are played for you', () => {
    expect(BASICS.rules.rounds).toBe(3);
    expect(events.filter((e) => e.type === 'round-ended')).toHaveLength(3);
    playTutorial(BASICS, (c) => {
      expect(c.decision.phase).toBe('invest');
      return scriptedAction(BASICS, c);
    });
  });

  it('round 1: your ship rolls 5 and arrives; round 2 you are wanted', () => {
    expect(modifiers(events, 1, 'r1-p1')).toMatchObject({ base: 5, final: 5 });
    expect(outcome(events, 'r1-p1')).toMatchObject({ outcome: 'arrived' });
    expect(events.find((e) => e.type === 'wanted-marked' && e.round === 2)).toMatchObject({ players: ['p1'] });
  });

  it('round 2: the storm sinks your 4, and the wood the bots crowd in loses price', () => {
    expect(events.find((e) => e.type === 'voyage-event-revealed' && e.round === 2)).toMatchObject({ event: 'storm' });
    expect(modifiers(events, 2, 'r2-p1')).toMatchObject({ base: 4, event: -1, final: 3 });
    expect(outcome(events, 'r2-p1')).toMatchObject({ outcome: 'sank' });
    expect(market(2).priceAfter.wood).toBeLessThan(market(2).priceBefore.wood);
  });

  it('round 3: you build the shipyard and a tailwind brings your 3 home', () => {
    expect(events.find((e) => e.type === 'buildings-built' && e.round === 3)).toMatchObject({ builds: [{ playerId: 'p1', building: 'shipyard' }] });
    expect(modifiers(events, 3, 'r3-p1')).toMatchObject({ base: 3, event: 1, final: 4 });
    expect(outcome(events, 'r3-p1')).toMatchObject({ outcome: 'arrived' });
  });

  it('holds for every load you may pick: wanted in round 2, the shipyard affordable in round 3', () => {
    const first = everyChoice(BASICS, 1, 'invest');
    const second = everyChoice(BASICS, 2, 'invest');
    expect(first.length).toBeGreaterThan(1);
    expect(second.length).toBeGreaterThan(1);
    first.forEach((_, i) =>
      second.forEach((__, j) => {
        const log = playTutorial(BASICS, (c) => c.legalActions[c.view.round === 1 ? i : c.view.round === 2 ? j : 0]!);
        expect(log.events.find((e) => e.type === 'wanted-marked' && e.round === 2)).toMatchObject({ players: ['p1'] });
        expect(log.events.find((e) => e.type === 'buildings-built' && e.round === 3)).toMatchObject({ builds: [{ playerId: 'p1', building: 'shipyard' }] });
      }),
    );
  });
});

describe('role scenarios', () => {
  it('guard: your 3 plus the guard is a 4 and arrives', () => {
    const { events } = playTutorial(GUARD);
    expect(modifiers(events, 1, 'r1-p1')).toMatchObject({ base: 3, guard: 1, final: 4 });
    expect(outcome(events, 'r1-p1')).toMatchObject({ outcome: 'arrived' });
  });

  it('pirate: the targeted 4 sinks and the loot is yours', () => {
    const { events } = playTutorial(PIRATE);
    expect(modifiers(events, 1, 'r1-p2')).toMatchObject({ base: 4, pirate: -1, final: 3 });
    expect(cashFor(events, 'pirate-loot', 'p1')).toBe(PIRATE.rules.roles.pirate.loot);
  });

  it('intel: you see a 2; a reroll brings a 5, keeping it sinks', () => {
    const rerolled = playTutorial(INTEL);
    const report = rerolled.privateEvents.find((e) => e.type === 'intel-report');
    expect(report).toMatchObject({ playerId: 'p1', rawRoll: 2 });
    expect(modifiers(rerolled.events, 1, 'r1-p1')).toMatchObject({ base: 5 });
    expect(outcome(rerolled.events, 'r1-p1')).toMatchObject({ outcome: 'arrived' });

    const kept = playTutorial(INTEL, (c) => (c.decision.phase === 'intel-reroll' ? c.legalActions.find((a) => a.type === 'intel-reroll' && a.rerollShipId === null)! : scriptedAction(INTEL, c)));
    expect(modifiers(kept.events, 1, 'r1-p1')).toMatchObject({ base: 2 });
    expect(outcome(kept.events, 'r1-p1')).toMatchObject({ outcome: 'sank' });
  });

  it('smuggler: the unguarded ship pays you, the guarded one catches you', () => {
    const choices = everyChoice(SMUGGLER, 1, 'role-deployment');
    expect(choices).toHaveLength(2);
    const results = choices.map((_, i) => playTutorial(SMUGGLER, pickNth(SMUGGLER, 1, 'role-deployment', i)).events.find((e) => e.type === 'smuggling-settled'));
    expect(results.map((r) => (r?.type === 'smuggling-settled' ? `${r.shipId}:${r.result}` : '')).sort()).toEqual(['r1-p2:taken', 'r1-p3:caught']);
    expect(cashFor(playTutorial(SMUGGLER).events, 'smuggling', 'p1')).toBe(SMUGGLER.rules.voyageEvents.blackMarketRushGoodsValue);
  });

  it('arms cover: covered arms sell; uncovered ones are confiscated by the guard', () => {
    const covered = playTutorial(ARMS_COVER);
    expect(covered.events.some((e) => e.type === 'arms-confiscated')).toBe(false);
    expect(cashFor(covered.events, 'escort-fee', 'p2')).toBe(ARMS_COVER.rules.roles.guard.escortFee);

    const uncovered = playTutorial(ARMS_COVER, (c) => (c.decision.phase === 'role-deployment' ? c.legalActions.find((a) => a.type === 'deploy-role' && a.role === null)! : scriptedAction(ARMS_COVER, c)));
    expect(uncovered.events.find((e) => e.type === 'arms-confiscated')).toMatchObject({ shipId: 'r1-p1', guards: ['p2'] });
  });

  it('broker: the bull bet lifts wood demand to 2, one crate arrives, the bet pays and your ship sells higher', () => {
    const { events } = playTutorial(BROKER);
    const market = events.find((e) => e.type === 'market-settled');
    expect(market).toMatchObject({ demand: { wood: 2 }, arrived: { wood: 1 } });
    expect(market?.type === 'market-settled' && market.priceAfter.wood).toBe(market?.type === 'market-settled' ? market.priceBefore.wood + 1 : -1);
    // Both rounds' bets pay (the bear bet in round 2 is checked below).
    expect(cashFor(events, 'broker-bet', 'p1')).toBe(BROKER.rules.roles.broker.payout * 2);
    expect(cashFor(events, 'broker-lift', 'p1')).toBeGreaterThan(0);
  });

  it('broker round 2: the bear bet on the rival ship drops iron demand to 0, the crate arrives and you take the difference', () => {
    const { events } = playTutorial(BROKER);
    const markets = events.filter((e) => e.type === 'market-settled');
    expect(markets).toHaveLength(2);
    const second = markets[1];
    expect(second).toMatchObject({ demand: { iron: 0 }, arrived: { iron: 1 } });
    expect(second?.type === 'market-settled' && second.priceAfter.iron).toBeLessThan(second?.type === 'market-settled' ? second.priceBefore.iron : 0);
    expect(cashFor(events, 'broker-control', 'p1')).toBeGreaterThan(0);
  });

  it('lets you make only the role decision; the investment is played for you', () => {
    for (const script of [GUARD, PIRATE, INTEL, SMUGGLER, ARMS_COVER, BROKER]) {
      playTutorial(script, (c) => {
        expect(youChoose(script, c)).toBe(true);
        expect(c.decision.phase).not.toBe('invest');
        return scriptedAction(script, c);
      });
    }
  });
});
