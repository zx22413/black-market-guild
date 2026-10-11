import { seedToRngState, shuffle } from '../../game/rng';
import { economyActionKey, getEconomyDeciders, getEconomyLegalActions } from './decisions';
import { submitEconomyDecision, openRound } from './flow';
import { ECONOMY_RULES, type EconomyRules } from './rules';
import { NO_GOODS } from './goods';
import {
  MATERIALS,
  PHASE_ACTION_TYPE,
  PROTO_VOYAGE_EVENT_IDS,
  type EconomyAction,
  type EconomyState,
  type EconomyStep,
  type Goods,
  type ProtoVoyageEventId,
} from './types';

export interface EconomyMatchConfig {
  readonly seed: number;
  readonly players: readonly { readonly id: string; readonly name: string }[];
  readonly rules?: EconomyRules;
}

export type EconomyResultOf<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

/**
 * One card per combination of per-material values in [min, max]; for each player above 3, both
 * ends of a material in play (max > 0) grow by extraPerPlayerAbove3, plus extraMin / extraMax.
 */
export function buildDemandDeck(rules: EconomyRules, playerCount: number): Goods[] {
  const above = Math.max(0, playerCount - 3);
  const { demand } = rules;
  return MATERIALS.reduce<Goods[]>(
    (cards, m) => {
      const bump = demand.max[m] > 0 ? demand.extraPerPlayerAbove3 : 0;
      const min = demand.min[m] + above * (bump + demand.extraMin[m]);
      const max = demand.max[m] + above * (bump + demand.extraMax[m]);
      const values = Array.from({ length: Math.max(1, max - min + 1) }, (_, i) => min + i);
      return cards.flatMap((card) => values.map((v) => ({ ...card, [m]: v })));
    },
    [NO_GOODS],
  );
}

export function buildProtoVoyageDeck(rules: EconomyRules): ProtoVoyageEventId[] {
  return PROTO_VOYAGE_EVENT_IDS.flatMap((id) => Array.from({ length: rules.voyageEvents.copies[id] }, () => id));
}

function validate(config: EconomyMatchConfig, rules: EconomyRules): string | null {
  const count = config.players.length;
  if (!Number.isInteger(config.seed)) {
    return `seed must be an integer, got ${config.seed}`;
  }
  if (count < rules.players.min || count > rules.players.max) {
    return `player count must be ${rules.players.min}-${rules.players.max}, got ${count}`;
  }
  if (new Set(config.players.map((p) => p.id)).size !== count) {
    return 'player ids must be unique';
  }
  if (rules.roles.smuggler.anonymous === 1 && rules.roles.smuggler.fee !== 0) {
    return 'anonymous smuggling requires a zero smuggler fee';
  }
  if (MATERIALS.some((m) => rules.price.start[m] < 0 || rules.price.start[m] >= rules.price.steps)) {
    return `price.start must be within 0-${rules.price.steps - 1}`;
  }
  if (MATERIALS.some((m) => rules.productionEvery[m] < 1)) {
    return 'productionEvery must be at least 1';
  }
  if (buildDemandDeck(rules, count).length < rules.rounds || buildProtoVoyageDeck(rules).length < rules.rounds) {
    return `decks must hold at least ${rules.rounds} cards`;
  }
  return null;
}

export function createEconomyMatch(config: EconomyMatchConfig): EconomyResultOf<EconomyStep> {
  const rules = config.rules ?? ECONOMY_RULES;
  const problem = validate(config, rules);
  if (problem !== null) {
    return { ok: false, error: problem };
  }
  const demand = shuffle(buildDemandDeck(rules, config.players.length), seedToRngState(config.seed));
  const voyage = shuffle(buildProtoVoyageDeck(rules), demand.state);
  const step = openRound(
    {
      rules,
      seed: config.seed,
      round: 0,
      phase: 'invest',
      players: config.players.map(({ id, name }) => ({
        id,
        name,
        cash: rules.startingCash,
        blackMoney: 0,
        buildings: [],
        stock: rules.startingStock,
      })),
      rng: voyage.state,
      demandDeck: demand.items,
      voyageDeck: voyage.items,
      prices: rules.price.start,
      history: [],
      result: null,
    },
    1,
  );
  return { ok: true, value: step };
}

/** Validates and applies one action. Never mutates `state`. */
export function applyEconomyAction(state: EconomyState, action: EconomyAction): EconomyResultOf<EconomyStep> {
  const { phase } = state;
  if (phase === 'game-over') {
    return { ok: false, error: 'the match has already ended' };
  }
  if (PHASE_ACTION_TYPE[phase] !== action.type) {
    return { ok: false, error: `${action.type} is not allowed during ${phase}` };
  }
  if (!getEconomyDeciders(state, phase).includes(action.playerId)) {
    return { ok: false, error: `${action.playerId} has no decision in ${phase}` };
  }
  const key = economyActionKey(action);
  if (!getEconomyLegalActions(state, action.playerId).some((legal) => economyActionKey(legal) === key)) {
    return { ok: false, error: `illegal action: ${key}` };
  }
  return { ok: true, value: submitEconomyDecision(state, phase, action) };
}
