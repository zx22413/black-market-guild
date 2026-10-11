import { describe, expect, it } from 'vitest';
import {
  ECONOMY_RULES,
  applyEconomyAction,
  buildDemandDeck,
  createEconomyMatch,
  economyRules,
  getEconomyLegalActions,
  getEconomyPending,
  getEconomyView,
} from '../../../src/proto/economy';
import { apply, cashOf, playRound, start, stockOf, withStock } from './helpers';

describe('economy prototype setup', () => {
  it('produces materials at round start, including round 1', () => {
    const state = start('A');
    expect(state.round).toBe(1);
    expect(state.phase).toBe('invest');
    state.players.forEach((p) => {
      expect(p.stock).toEqual({ wood: 2, iron: 2 });
      expect(p.cash).toBe(1000);
    });
    expect(state.prices).toEqual({ wood: 3, iron: 3 });
  });

  it('nobody is wanted while everyone is tied', () => {
    expect(start('A').roundState.wanted).toEqual([]);
  });

  it('builds one demand card per pair, raised for a fourth player', () => {
    expect(buildDemandDeck(ECONOMY_RULES, 3)).toHaveLength(9);
    expect(buildDemandDeck(ECONOMY_RULES, 3)).toContainEqual({ wood: 1, iron: 3 });
    expect(buildDemandDeck(ECONOMY_RULES, 4)).toContainEqual({ wood: 2, iron: 4 });
    expect(buildDemandDeck(ECONOMY_RULES, 4)).not.toContainEqual({ wood: 1, iron: 1 });
  });

  it('rejects invalid configurations', () => {
    const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
    expect(createEconomyMatch({ seed: 1, players: players(2) }).ok).toBe(false);
    expect(createEconomyMatch({ seed: 1.5, players: players(3) }).ok).toBe(false);
    expect(createEconomyMatch({ seed: 1, players: [...players(2), { id: 'p0', name: 'x' }] }).ok).toBe(false);
    const fee = { ...ECONOMY_RULES, roles: { ...ECONOMY_RULES.roles, smuggler: { ...ECONOMY_RULES.roles.smuggler, fee: 10 } } };
    expect(createEconomyMatch({ seed: 1, players: players(3), rules: fee }).ok).toBe(false);
    const price = { ...ECONOMY_RULES, price: { ...ECONOMY_RULES.price, start: 9 } };
    expect(createEconomyMatch({ seed: 1, players: players(3), rules: price }).ok).toBe(false);
    expect(createEconomyMatch({ seed: 1, players: players(3), rules: { ...ECONOMY_RULES, rounds: 20 } }).ok).toBe(false);
  });
});

describe('invest options', () => {
  it('respects capacity, stock and cash', () => {
    const state = withStock(start('A'), 'p1', { wood: 3, iron: 0 }, 120);
    const options = getEconomyLegalActions(state, 'p1');
    const loads = options.filter((a) => a.type === 'invest' && a.build === null).map((a) => (a.type === 'invest' ? a.load : null));
    expect(loads).toEqual([
      { wood: 0, iron: 0 },
      { wood: 1, iron: 0 },
      { wood: 2, iron: 0 },
    ]);
    // 100 G + 2 wood shipyard leaves 20 G: no ship cost affordable.
    const withShipyard = options.filter((a) => a.type === 'invest' && a.build === 'shipyard');
    expect(withShipyard.map((a) => (a.type === 'invest' ? a.load : null))).toEqual([{ wood: 0, iron: 0 }]);
  });

  it('counts a shipyard built this round toward capacity', () => {
    const state = withStock(start('A'), 'p1', { wood: 5, iron: 0 });
    const loads = getEconomyLegalActions(state, 'p1').filter((a) => a.type === 'invest' && a.build === 'shipyard');
    expect(loads.map((a) => (a.type === 'invest' ? a.load.wood : -1))).toEqual([0, 1, 2, 3]);
  });

  it('charges Option B freight per unit', () => {
    const state = withStock(start('B'), 'p1', { wood: 2, iron: 2 }, 50);
    const loads = getEconomyLegalActions(state, 'p1').map((a) => (a.type === 'invest' ? a.load.wood + a.load.iron : -1));
    expect(Math.max(...loads)).toBe(1);
  });

  it('rejects illegal and out-of-phase actions', () => {
    const state = start('A');
    expect(applyEconomyAction(state, { type: 'invest', playerId: 'p1', build: null, load: { wood: 3, iron: 0 } }).ok).toBe(false);
    expect(applyEconomyAction(state, { type: 'deploy-role', playerId: 'p1', role: null, targetShipId: null }).ok).toBe(false);
    expect(applyEconomyAction(state, { type: 'invest', playerId: 'zz', build: null, load: { wood: 0, iron: 0 } }).ok).toBe(false);
    const once = apply(state, { type: 'invest', playerId: 'p1', build: null, load: { wood: 0, iron: 0 } }).state;
    expect(applyEconomyAction(once, { type: 'invest', playerId: 'p1', build: null, load: { wood: 0, iron: 0 } }).ok).toBe(false);
    expect(getEconomyPending(once).map((d) => d.playerId)).toEqual(['p2', 'p3']);
  });
});

describe('investing and launching', () => {
  it('builds before loading and pays the ship cost (Option A)', () => {
    let state = start('A');
    state = apply(state, { type: 'invest', playerId: 'p1', build: 'insurance', load: { wood: 1, iron: 1 } }).state;
    state = apply(state, { type: 'invest', playerId: 'p2', build: null, load: { wood: 2, iron: 0 } }).state;
    const launched = apply(state, { type: 'invest', playerId: 'p3', build: null, load: { wood: 0, iron: 0 } });
    state = launched.state;
    expect(state.phase).toBe('role-deployment');
    expect(cashOf(state, 'p1')).toBe(1000 - 100 - 100);
    expect(stockOf(state, 'p1')).toEqual({ wood: 0, iron: 0 });
    expect(state.players[0]!.buildings).toEqual(['insurance']);
    expect(state.roundState.ships.map((s) => s.id)).toEqual(['r1-p1', 'r1-p2']);
    const announced = launched.events.find((e) => e.type === 'ships-launched');
    expect(announced?.type === 'ships-launched' && announced.ships.every((s) => s.cargo === null)).toBe(true);
  });

  it('hides Option A cargo from everyone but the owner until resolution', () => {
    let state = start('A');
    for (const id of ['p1', 'p2', 'p3']) {
      state = apply(state, { type: 'invest', playerId: id, build: null, load: { wood: 1, iron: 0 } }).state;
    }
    const view = getEconomyView(state, 'p2');
    expect(view.ships.find((s) => s.owner === 'p2')?.cargo).toEqual([{ playerId: 'p2', goods: { wood: 1, iron: 0 } }]);
    expect(view.ships.find((s) => s.owner === 'p1')?.cargo).toBeNull();
    expect(view.players.find((p) => p.id === 'p1')?.stockAtRoundStart).toEqual({ wood: 2, iron: 2 });
  });

  it('puts Option B cargo on public neutral ships by material', () => {
    let state = start('B');
    state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: { wood: 1, iron: 1 } }).state;
    state = apply(state, { type: 'invest', playerId: 'p2', build: null, load: { wood: 2, iron: 0 } }).state;
    state = apply(state, { type: 'invest', playerId: 'p3', build: null, load: { wood: 0, iron: 0 } }).state;
    expect(cashOf(state, 'p1')).toBe(1000 - 60);
    const view = getEconomyView(state, 'p3');
    expect(view.ships).toEqual([
      {
        id: 'r1-wood',
        owner: null,
        material: 'wood',
        cargo: [
          { playerId: 'p1', goods: { wood: 1, iron: 0 } },
          { playerId: 'p2', goods: { wood: 2, iron: 0 } },
        ],
      },
      { id: 'r1-iron', owner: null, material: 'iron', cargo: [{ playerId: 'p1', goods: { wood: 0, iron: 1 } }] },
    ]);
  });

  it('skips role deployment when no ship sails', () => {
    const { state } = playRound(start('A'), { loads: {} });
    expect(state.round).toBe(2);
    expect(state.phase).toBe('invest');
    expect(stockOf(state, 'p1')).toEqual({ wood: 3, iron: 3 });
  });

  it('keeps smugglers off ships carrying their own cargo', () => {
    let state = start('B');
    state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: { wood: 1, iron: 0 } }).state;
    state = apply(state, { type: 'invest', playerId: 'p2', build: null, load: { wood: 0, iron: 1 } }).state;
    state = apply(state, { type: 'invest', playerId: 'p3', build: null, load: { wood: 0, iron: 0 } }).state;
    const smuggle = getEconomyLegalActions(state, 'p1').filter((a) => a.type === 'deploy-role' && a.role === 'smuggler');
    expect(smuggle.map((a) => (a.type === 'deploy-role' ? a.targetShipId : null))).toEqual(['r1-iron']);
  });

  it('reports the intel target roll, rerolled if chosen', () => {
    let state = playRound(start('A'), { loads: { p1: { wood: 1, iron: 0 } } }).state;
    expect(state.round).toBe(2);
    for (const id of ['p1', 'p2', 'p3']) {
      state = apply(state, { type: 'invest', playerId: id, build: null, load: id === 'p1' ? { wood: 1, iron: 0 } : { wood: 0, iron: 0 } }).state;
    }
    state = { ...state, roundState: { ...state.roundState, ships: state.roundState.ships.map((s) => ({ ...s, rawRoll: 2 })) } };
    state = apply(state, { type: 'deploy-role', playerId: 'p1', role: 'intel', targetShipId: 'r2-p1' }).state;
    state = apply(state, { type: 'deploy-role', playerId: 'p2', role: null, targetShipId: null }).state;
    state = apply(state, { type: 'deploy-role', playerId: 'p3', role: null, targetShipId: null }).state;
    expect(state.phase).toBe('intel-reroll');
    expect(getEconomyView(state, 'p1').intelRoll).toBe(2);
    expect(getEconomyView(state, 'p2').intelRoll).toBeNull();
    const after = apply(state, { type: 'intel-reroll', playerId: 'p1', reroll: true });
    const resolved = after.events.find((e) => e.type === 'ship-resolved');
    expect(resolved?.type === 'ship-resolved' && resolved.base).not.toBeUndefined();
    expect(after.events.some((e) => e.type === 'roles-revealed' && e.rerolledShipIds.includes('r2-p1'))).toBe(true);
  });

  it('never mutates the input state and survives a JSON round trip', () => {
    const state = start('A');
    const frozen = JSON.stringify(state);
    apply(state, { type: 'invest', playerId: 'p1', build: 'insurance', load: { wood: 1, iron: 1 } });
    expect(JSON.stringify(state)).toBe(frozen);
    expect(JSON.parse(frozen)).toEqual(state);
  });

  it('uses the mode from economyRules', () => {
    expect(economyRules('B').mode).toBe('B');
    expect(ECONOMY_RULES.mode).toBe('A');
  });
});
