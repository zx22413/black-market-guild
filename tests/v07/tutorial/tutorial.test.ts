import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../../src/v07/bots';
import type { Action, MatchEvent } from '../../../src/v07/game';
import { RULES_CURRENT, createMatch, priceAt } from '../../../src/v07/game';
import {
  BASICS,
  COVER,
  CUSTOMS,
  GROWTH,
  TIDE,
  DIPLOMAT,
  GUARD,
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
      script.coach.filter((s) => s.diagram === undefined).forEach((s) => expect(s.focus.length, `${script.id}: ${s.title}`).toBeGreaterThan(0));
    }
  });

  it('keeps the numbers of the official V0.8 rules, only a fixed, shorter length', () => {
    const created = createMatch({ seed: 1, players: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }, { id: 'c', name: 'c' }, { id: 'd', name: 'd' }] });
    expect(created.ok).toBe(true);
    const official = created.ok ? created.value.state.rules : null;
    expect(official).toEqual(RULES_CURRENT);
    for (const script of TUTORIALS) {
      // Only the length differs: the event deck's windows (or the deck being off) and the fixed round count.
      expect({ ...script.rules, rounds: RULES_CURRENT.rounds, v08: { ...script.rules.v08, events: RULES_CURRENT.v08.events } }).toEqual(official);
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

  it('round 1: your ship rolls 6 and arrives; round 2 you are wanted', () => {
    expect(modifiers(events, 1, 'r1-p1')).toMatchObject({ base: 6, final: 6 });
    expect(outcome(events, 'r1-p1')).toMatchObject({ outcome: 'arrived' });
    expect(events.find((e) => e.type === 'wanted-marked' && e.round === 2)).toMatchObject({ players: ['p1'] });
  });

  it('round 2: the storm sinks your 2, and the wood the bots crowd in loses price', () => {
    expect(events.find((e) => e.type === 'voyage-event-revealed' && e.round === 2)).toMatchObject({ event: 'storm' });
    expect(modifiers(events, 2, 'r2-p1')).toMatchObject({ base: 2, event: -1, final: 1 });
    expect(outcome(events, 'r2-p1')).toMatchObject({ outcome: 'sank' });
    expect(market(2).priceAfter.wood).toBeLessThan(market(2).priceBefore.wood);
  });

  it('round 3: you sail the gambler and a tailwind lifts your 4 to a 5, which pays', () => {
    expect(events.find((e) => e.type === 'voyage-event-revealed' && e.round === 3)).toMatchObject({ event: 'tailwind' });
    expect(modifiers(events, 3, 'r3-p1')).toMatchObject({ base: 4, event: 1, final: 5 });
    expect(outcome(events, 'r3-p1')).toMatchObject({ outcome: 'arrived' });
  });

  it('round 3: you bring 2 arms where the market takes 1, and the bank seizes one crate of yours (§7.4)', () => {
    const seized = events.filter((e) => e.type === 'v08-effect' && e.round === 3 && e.effect === 'inspected');
    expect(seized).toMatchObject([{ playerId: 'p1', shipId: 'r3-p1', crates: 1 }]);
    expect(market(3)).toMatchObject({ demand: { arms: 1 }, arrived: { arms: 2 } });
    expect(market(3).priceAfter.arms).toBeLessThan(market(3).priceBefore.arms);
    // Whatever you loaded before, round 3 has the two arms crates to load, and every complete choice gets one seized.
    const complete: number[] = [];
    playTutorial(BASICS, (c) => {
      if (c.view.round === 3) c.legalActions.forEach((action, i) => isReady(BASICS, c, action) && complete.push(i));
      return scriptedAction(BASICS, c);
    });
    expect(complete.length).toBeGreaterThan(1);
    for (const i of complete) {
      const log = playTutorial(BASICS, pickNth(BASICS, 3, 'invest', i));
      expect(log.events.filter((e) => e.type === 'v08-effect' && e.round === 3 && e.effect === 'inspected')).toMatchObject([{ shipId: 'r3-p1', crates: 1 }]);
    }
  });

  it('holds for every load you may pick: you are wanted in round 2, the gambler affordable in round 3', () => {
    const first = everyChoice(BASICS, 1, 'invest');
    const second = everyChoice(BASICS, 2, 'invest');
    expect(first.length).toBeGreaterThan(1);
    expect(second.length).toBeGreaterThan(1);
    first.forEach((_, i) =>
      second.forEach((__, j) => {
        const log = playTutorial(BASICS, (c) => c.legalActions[c.view.round === 1 ? i : c.view.round === 2 ? j : 0]!);
        // A tie at the top marks both players as wanted, so you are among them.
        expect(log.events.find((e) => e.type === 'wanted-marked' && e.round === 2)).toMatchObject({ players: expect.arrayContaining(['p1']) });
        expect(outcome(log.events, 'r3-p1')).toMatchObject({ outcome: 'arrived' });
      }),
    );
  });
});

describe('growth: a building and a ship skill (V0.8)', () => {
  const { events, finalState } = playTutorial(GROWTH);
  const resolved = (shipId: string) => events.find((e): e is Extract<MatchEvent, { type: 'ship-resolved' }> => e.type === 'ship-resolved' && e.shipId === shipId);

  it('round 1: you build the repairyard, and your 3 loses 1 crate (the arms) instead of 2', () => {
    expect(events.find((e) => e.type === 'materials-used' && e.round === 1)).toMatchObject({ uses: [{ playerId: 'p1', material: { kind: 'build', building: 'repairyard' } }] });
    expect(modifiers(events, 1, 'r1-p1')).toMatchObject({ final: 3 });
    expect(resolved('r1-p1')).toMatchObject({ outcome: 'arrived', lost: { wood: 0, iron: 0, spice: 0, arms: 1 } });
  });

  it('round 2: you open the gambler, raise, and a 6 sells at ×4', () => {
    expect(events.find((e) => e.type === 'materials-used' && e.round === 2)).toMatchObject({ uses: [{ playerId: 'p1', material: { kind: 'open', ship: 'gambler' } }] });
    expect(events.find((e) => e.type === 'ships-launched' && e.round === 2)).toMatchObject({ ships: [expect.objectContaining({ owner: 'p1', type: 'gambler', raised: true })] });
    expect(resolved('r2-p1')).toMatchObject({ outcome: 'arrived' });
    expect(finalState.players[0]!.facility).toBe('repairyard');
  });

  it('every load you may pick still plays to the end', { timeout: 60_000 }, () => {
    for (const round of [1, 2]) {
      const choices = everyChoice(GROWTH, round, 'invest');
      expect(choices.length).toBeGreaterThan(1);
      choices.forEach((_, i) => expect(playTutorial(GROWTH, pickNth(GROWTH, round, 'invest', i)).finalState.phase).toBe('game-over'));
    }
  });
});

describe('dark tide: the bet and the last market (V0.8)', () => {
  const { events } = playTutorial(TIDE);
  const resolved = (shipId: string) => events.find((e): e is Extract<MatchEvent, { type: 'ship-resolved' }> => e.type === 'ship-resolved' && e.shipId === shipId);

  it('shows the scripted candidates, picks the storm tide at 暗潮將至 in round 2 and ends with 最後的大市集 in round 3', () => {
    expect(events.find((e) => e.type === 'tide-candidates')).toMatchObject({ candidates: ['storm', 'crash'] });
    expect(events.find((e) => e.type === 'dark-tide-rising')).toMatchObject({ round: 2 });
    expect(events.find((e) => e.type === 'tide-revealed')).toMatchObject({ round: 2, tide: 'storm' });
    expect(events.some((e) => e.type === 'voyage-event-revealed' && e.round === 2)).toBe(false);
    expect(events.find((e) => e.type === 'dark-tide-loss')).toMatchObject({ round: 2 });
    expect(events.find((e) => e.type === 'final-round')).toMatchObject({ round: 3, effect: 'final-market' });
  });

  it('round 3: both 3s, the repairyard keeps yours to 1 lost crate while the rival loses all its iron', () => {
    expect(modifiers(events, 3, 'r3-p1')).toMatchObject({ final: 3 });
    expect(modifiers(events, 3, 'r3-p2')).toMatchObject({ final: 3 });
    const mine = resolved('r3-p1')!;
    expect(mine.outcome).toBe('arrived');
    expect(Object.values(mine.lost ?? {}).reduce((a, b) => a + b, 0)).toBe(1);
    expect(resolved('r3-p2')).toMatchObject({ outcome: 'arrived', lost: { wood: 0, iron: 2, spice: 0, arms: 0 } });
  });

  it('every load you may pick still plays to the end', { timeout: 60_000 }, () => {
    for (const round of [1, 2, 3]) {
      const choices = everyChoice(TIDE, round, 'invest');
      expect(choices.length).toBeGreaterThan(1);
      choices.forEach((_, i) => expect(playTutorial(TIDE, pickNth(TIDE, round, 'invest', i)).finalState.phase).toBe('game-over'));
    }
  });
});

describe('role scenarios', () => {
  it('guard: your 1 plus the guard is a 2 and arrives', () => {
    const { events } = playTutorial(GUARD);
    expect(modifiers(events, 1, 'r1-p1')).toMatchObject({ base: 1, guard: 1, final: 2 });
    expect(outcome(events, 'r1-p1')).toMatchObject({ outcome: 'arrived' });
  });

  it('pirate: the targeted 2 drops to a 1, sinks, and the loot is yours', () => {
    const { events } = playTutorial(PIRATE);
    expect(modifiers(events, 1, 'r1-p2')).toMatchObject({ base: 2, pirate: -1, final: 1 });
    expect(outcome(events, 'r1-p2')).toMatchObject({ outcome: 'sank' });
    expect(cashFor(events, 'pirate-loot', 'p1')).toBeGreaterThan(0);
  });

  it('customs: the named arms go to you and the owner keeps the rest', () => {
    const { events } = playTutorial(CUSTOMS);
    expect(events.find((e) => e.type === 'goods-confiscated')).toMatchObject({ shipId: 'r1-p2', good: 'arms', customs: ['p1'] });
    expect(cashFor(events, 'goods-confiscated', 'p1')).toBeGreaterThan(0);
  });

  it('smuggler: the ship without customs pays you, the one with customs catches you', () => {
    const choices = everyChoice(SMUGGLER, 1, 'role-deployment');
    expect(choices).toHaveLength(2);
    const results = choices.map((_, i) => playTutorial(SMUGGLER, pickNth(SMUGGLER, 1, 'role-deployment', i)).events.find((e) => e.type === 'smuggling-settled'));
    expect(results.map((r) => (r?.type === 'smuggling-settled' ? `${r.shipId}:${r.result}` : '')).sort()).toEqual(['r1-p2:taken', 'r1-p3:caught']);
    expect(cashFor(playTutorial(SMUGGLER).events, 'smuggling', 'p1')).toBe(SMUGGLER.rules.voyageEvents.blackMarketRushGoodsValue);
  });

  it('cover: your smuggler on your own ship keeps the arms the bank would have seized (§7.4, §9.5)', () => {
    const choices = everyChoice(COVER, 1, 'role-deployment');
    expect(choices).toMatchObject([{ type: 'deploy-role', role: 'smuggler', targetShipId: 'r1-p1' }]);
    const { events } = playTutorial(COVER);
    const effects = events.flatMap((e) => (e.type === 'v08-effect' ? [e] : []));
    const settled = events.find((e): e is Extract<MatchEvent, { type: 'market-settled' }> => e.type === 'market-settled')!;
    // More arms arrive than the market takes, and yours are the ones the bank would reach.
    expect(settled.arrived.arms).toBeGreaterThan(settled.demand.arms);
    expect(effects.filter((e) => e.effect === 'inspection-covered')).toMatchObject([{ playerId: 'p1', shipId: 'r1-p1', crates: 1 }]);
    expect(effects.filter((e) => e.effect === 'inspected')).toEqual([]);
    // The covered crate sells: your sale is the wood and the arms at the new prices.
    const price = (good: 'wood' | 'arms') => priceAt(COVER.rules, good, settled.priceAfter[good]);
    expect(cashFor(events, 'sale', 'p1')).toBe(price('wood') + price('arms'));
    expect(cashFor(events, 'smuggling', 'p1')).toBe(0);
  });

  it('diplomat: the right guess voids the pirate and takes money from it', () => {
    const { events } = playTutorial(DIPLOMAT);
    expect(modifiers(events, 1, 'r1-p1')).toMatchObject({ pirate: 0 });
    expect(cashFor(events, 'diplomat-take', 'p1')).toBe(DIPLOMAT.rules.roles.diplomat.take);
  });

  it('lets you make only the role decision; the investment is played for you', () => {
    for (const script of [GUARD, PIRATE, CUSTOMS, SMUGGLER, COVER, DIPLOMAT]) {
      playTutorial(script, (c) => {
        expect(youChoose(script, c)).toBe(true);
        expect(c.decision.phase).not.toBe('invest');
        return scriptedAction(script, c);
      });
    }
  });
});
