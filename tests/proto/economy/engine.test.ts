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
import { G, apply, cashOf, playRound, start, stockOf, withStock } from './helpers';

describe('economy prototype setup', () => {
  it('produces materials at round start, including round 1', () => {
    const state = start('A');
    expect(state.round).toBe(1);
    expect(state.phase).toBe('invest');
    state.players.forEach((p) => {
      expect(p.stock).toEqual(G(2, 2));
      expect(p.cash).toBe(1000);
    });
    expect(state.prices).toEqual(G(3, 3, 3, 3));
  });

  it('nobody is wanted while everyone is tied', () => {
    expect(start('A').roundState.wanted).toEqual([]);
  });

  it('builds one demand card per pair, raised for a fourth player', () => {
    expect(buildDemandDeck(ECONOMY_RULES, 3)).toHaveLength(9);
    expect(buildDemandDeck(ECONOMY_RULES, 3)).toContainEqual(G(1, 3));
    expect(buildDemandDeck(ECONOMY_RULES, 4)).toContainEqual(G(2, 4));
    expect(buildDemandDeck(ECONOMY_RULES, 4)).not.toContainEqual(G(1, 1));
  });

  it('can raise only the upper end of a demand range for a fourth player', () => {
    const rules = {
      ...ECONOMY_RULES,
      demand: { ...ECONOMY_RULES.demand, max: G(2, 2), extraPerPlayerAbove3: 0, extraMax: G(1, 1) },
    };
    const values = (n: number) => [...new Set(buildDemandDeck(rules, n).map((c) => c.wood))].sort();
    expect(values(3)).toEqual([1, 2]);
    expect(values(4)).toEqual([1, 2, 3]);
  });

  it('rejects invalid configurations', () => {
    const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
    expect(createEconomyMatch({ seed: 1, players: players(2) }).ok).toBe(false);
    expect(createEconomyMatch({ seed: 1.5, players: players(3) }).ok).toBe(false);
    expect(createEconomyMatch({ seed: 1, players: [...players(2), { id: 'p0', name: 'x' }] }).ok).toBe(false);
    const fee = { ...ECONOMY_RULES, roles: { ...ECONOMY_RULES.roles, smuggler: { ...ECONOMY_RULES.roles.smuggler, fee: 10 } } };
    expect(createEconomyMatch({ seed: 1, players: players(3), rules: fee }).ok).toBe(false);
    const price = { ...ECONOMY_RULES, price: { ...ECONOMY_RULES.price, start: G(9, 3, 3, 3) } };
    expect(createEconomyMatch({ seed: 1, players: players(3), rules: price }).ok).toBe(false);
    expect(createEconomyMatch({ seed: 1, players: players(3), rules: { ...ECONOMY_RULES, rounds: 20 } }).ok).toBe(false);
  });
});

describe('invest options', () => {
  it('respects capacity, stock and cash', () => {
    const state = withStock(start('A'), 'p1', G(3, 0), 120);
    const options = getEconomyLegalActions(state, 'p1');
    const loads = options.filter((a) => a.type === 'invest' && a.build === null).map((a) => (a.type === 'invest' ? a.load : null));
    expect(loads).toEqual([
      G(0, 0),
      G(1, 0),
      G(2, 0),
    ]);
    // 100 G + 2 wood shipyard leaves 20 G: no ship cost affordable.
    const withShipyard = options.filter((a) => a.type === 'invest' && a.build === 'shipyard');
    expect(withShipyard.map((a) => (a.type === 'invest' ? a.load : null))).toEqual([G(0, 0)]);
  });

  it('counts a shipyard built this round toward capacity', () => {
    const state = withStock(start('A'), 'p1', G(5, 0));
    const loads = getEconomyLegalActions(state, 'p1').filter((a) => a.type === 'invest' && a.build === 'shipyard');
    expect(loads.map((a) => (a.type === 'invest' ? a.load.wood : -1))).toEqual([0, 1, 2, 3]);
  });

  it('charges Option B freight per unit', () => {
    const state = withStock(start('B'), 'p1', G(2, 2), 50);
    const loads = getEconomyLegalActions(state, 'p1').map((a) => (a.type === 'invest' ? a.load.wood + a.load.iron : -1));
    expect(Math.max(...loads)).toBe(1);
  });

  it('rejects illegal and out-of-phase actions', () => {
    const state = start('A');
    expect(applyEconomyAction(state, { type: 'invest', playerId: 'p1', build: null, load: G(3, 0), direct: G(0), manipulate: null }).ok).toBe(false);
    expect(applyEconomyAction(state, { type: 'deploy-role', playerId: 'p1', role: null, targetShipId: null, bet: null, peekShipId: null }).ok).toBe(false);
    expect(applyEconomyAction(state, { type: 'invest', playerId: 'zz', build: null, load: G(0, 0), direct: G(0), manipulate: null }).ok).toBe(false);
    const once = apply(state, { type: 'invest', playerId: 'p1', build: null, load: G(0, 0), direct: G(0), manipulate: null }).state;
    expect(applyEconomyAction(once, { type: 'invest', playerId: 'p1', build: null, load: G(0, 0), direct: G(0), manipulate: null }).ok).toBe(false);
    expect(getEconomyPending(once).map((d) => d.playerId)).toEqual(['p2', 'p3']);
  });
});

describe('investing and launching', () => {
  it('builds before loading and pays the ship cost (Option A)', () => {
    let state = start('A');
    state = apply(state, { type: 'invest', playerId: 'p1', build: 'insurance', load: G(1, 1), direct: G(0), manipulate: null }).state;
    state = apply(state, { type: 'invest', playerId: 'p2', build: null, load: G(2, 0), direct: G(0), manipulate: null }).state;
    const launched = apply(state, { type: 'invest', playerId: 'p3', build: null, load: G(0, 0), direct: G(0), manipulate: null });
    state = launched.state;
    expect(state.phase).toBe('role-deployment');
    expect(cashOf(state, 'p1')).toBe(1000 - 100 - 100);
    expect(stockOf(state, 'p1')).toEqual(G(0, 0));
    expect(state.players[0]!.buildings).toEqual(['insurance']);
    expect(state.roundState.ships.map((s) => s.id)).toEqual(['r1-p1', 'r1-p2']);
    const announced = launched.events.find((e) => e.type === 'ships-launched');
    expect(announced?.type === 'ships-launched' && announced.ships.every((s) => s.cargo === null)).toBe(true);
  });

  it('hides Option A cargo from everyone but the owner until resolution', () => {
    let state = start('A');
    for (const id of ['p1', 'p2', 'p3']) {
      state = apply(state, { type: 'invest', playerId: id, build: null, load: G(1, 0), direct: G(0), manipulate: null }).state;
    }
    const view = getEconomyView(state, 'p2');
    expect(view.ships.find((s) => s.owner === 'p2')?.cargo).toEqual([{ playerId: 'p2', goods: G(1, 0) }]);
    expect(view.ships.find((s) => s.owner === 'p1')?.cargo).toBeNull();
    expect(view.players.find((p) => p.id === 'p1')?.stockAtRoundStart).toEqual(G(2, 2));
  });

  it('puts Option B cargo on public neutral ships by material', () => {
    let state = start('B');
    state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: G(1, 1), direct: G(0), manipulate: null }).state;
    state = apply(state, { type: 'invest', playerId: 'p2', build: null, load: G(2, 0), direct: G(0), manipulate: null }).state;
    state = apply(state, { type: 'invest', playerId: 'p3', build: null, load: G(0, 0), direct: G(0), manipulate: null }).state;
    expect(cashOf(state, 'p1')).toBe(1000 - 60);
    const view = getEconomyView(state, 'p3');
    expect(view.ships).toEqual([
      {
        id: 'r1-wood',
        owner: null,
        material: 'wood',
        cargo: [
          { playerId: 'p1', goods: G(1, 0) },
          { playerId: 'p2', goods: G(2, 0) },
        ],
      },
      { id: 'r1-iron', owner: null, material: 'iron', cargo: [{ playerId: 'p1', goods: G(0, 1) }] },
    ]);
  });

  it('skips role deployment when no ship sails', () => {
    const { state } = playRound(start('A'), { loads: {} });
    expect(state.round).toBe(2);
    expect(state.phase).toBe('invest');
    expect(stockOf(state, 'p1')).toEqual(G(3, 3));
  });

  it('keeps smugglers off ships carrying their own cargo', () => {
    let state = start('B');
    state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: G(1, 0), direct: G(0), manipulate: null }).state;
    state = apply(state, { type: 'invest', playerId: 'p2', build: null, load: G(0, 1), direct: G(0), manipulate: null }).state;
    state = apply(state, { type: 'invest', playerId: 'p3', build: null, load: G(0, 0), direct: G(0), manipulate: null }).state;
    const smuggle = getEconomyLegalActions(state, 'p1').filter((a) => a.type === 'deploy-role' && a.role === 'smuggler');
    expect(smuggle.map((a) => (a.type === 'deploy-role' ? a.targetShipId : null))).toEqual(['r1-iron']);
  });

  it('reports the intel target roll, rerolled if chosen', () => {
    let state = playRound(start('A'), { loads: { p1: G(1, 0) } }).state;
    expect(state.round).toBe(2);
    for (const id of ['p1', 'p2', 'p3']) {
      state = apply(state, { type: 'invest', playerId: id, build: null, load: id === 'p1' ? G(1, 0) : G(0, 0), direct: G(0), manipulate: null }).state;
    }
    state = { ...state, roundState: { ...state.roundState, ships: state.roundState.ships.map((s) => ({ ...s, rawRoll: 2 })) } };
    state = apply(state, { type: 'deploy-role', playerId: 'p1', role: 'intel', targetShipId: 'r2-p1', bet: null, peekShipId: null }).state;
    state = apply(state, { type: 'deploy-role', playerId: 'p2', role: null, targetShipId: null, bet: null, peekShipId: null }).state;
    state = apply(state, { type: 'deploy-role', playerId: 'p3', role: null, targetShipId: null, bet: null, peekShipId: null }).state;
    expect(state.phase).toBe('intel-reroll');
    expect(getEconomyView(state, 'p1').intelRoll).toBe(2);
    expect(getEconomyView(state, 'p2').intelRoll).toBeNull();
    const after = apply(state, { type: 'intel-reroll', playerId: 'p1', rerollShipId: 'r2-p1' });
    const resolved = after.events.find((e) => e.type === 'ship-resolved');
    expect(resolved?.type === 'ship-resolved' && resolved.base).not.toBeUndefined();
    expect(after.events.some((e) => e.type === 'roles-revealed' && e.rerolledShipIds.includes('r2-p1'))).toBe(true);
  });

  it('never mutates the input state and survives a JSON round trip', () => {
    const state = start('A');
    const frozen = JSON.stringify(state);
    apply(state, { type: 'invest', playerId: 'p1', build: 'insurance', load: G(1, 1), direct: G(0), manipulate: null });
    expect(JSON.stringify(state)).toBe(frozen);
    expect(JSON.parse(frozen)).toEqual(state);
  });

  it('uses the mode from economyRules', () => {
    expect(economyRules('B').mode).toBe('B');
    expect(ECONOMY_RULES.mode).toBe('A');
  });
});

describe('building limit', () => {
  it('offers no new building once a player holds the maximum', () => {
    const rules = { ...economyRules('A'), maxBuildingsPerPlayer: 2 };
    let state = start('A', 3, rules);
    state = { ...state, players: state.players.map((p) => (p.id === 'p1' ? { ...p, buildings: ['shipyard', 'salvage'] } : p)) };
    expect(getEconomyLegalActions(state, 'p1').every((a) => a.type === 'invest' && a.build === null)).toBe(true);
    expect(getEconomyLegalActions(state, 'p2').some((a) => a.type === 'invest' && a.build === 'insurance')).toBe(true);
  });
});
