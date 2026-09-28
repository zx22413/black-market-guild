/**
 * Tunable preferences of a heuristic bot. Scores are in G of expected value; weights scale
 * specific motives, and temperature adds randomness so opponents cannot fully predict it.
 */
export interface Personality {
  /** Softmax temperature in G; 0 always picks the best-scoring option. */
  readonly temperature: number;
  /** Cash the bot tries to keep after buying assets. */
  readonly cashReserve: number;
  readonly assetEagerness: number;
  /** Bonus for recruiting over waiting to apply. */
  readonly recruitBias: number;
  readonly aggression: number;
  readonly smuggling: number;
  /** Willingness to attack or cheat its own joint partner. */
  readonly betrayal: number;
  /** How strongly remembered hostility lowers trust. */
  readonly grudge: number;
  /** Prior belief that an opponent deploys a pirate on a given round. */
  readonly expectedPirateRate: number;
}

export const PERSONALITIES = {
  balanced: {
    temperature: 30,
    cashReserve: 200,
    assetEagerness: 1,
    recruitBias: 15,
    aggression: 1,
    smuggling: 1,
    betrayal: 0.2,
    grudge: 1,
    expectedPirateRate: 0.3,
  },
  cautious: {
    temperature: 25,
    cashReserve: 350,
    assetEagerness: 0.8,
    recruitBias: 5,
    aggression: 0.5,
    smuggling: 0.3,
    betrayal: 0,
    grudge: 1.5,
    expectedPirateRate: 0.45,
  },
  aggressive: {
    temperature: 35,
    cashReserve: 150,
    assetEagerness: 1,
    recruitBias: 10,
    aggression: 1.8,
    smuggling: 0.8,
    betrayal: 0.6,
    grudge: 0.7,
    expectedPirateRate: 0.25,
  },
  opportunist: {
    temperature: 35,
    cashReserve: 200,
    assetEagerness: 1.1,
    recruitBias: 30,
    aggression: 1.2,
    smuggling: 2,
    betrayal: 1,
    grudge: 0.5,
    expectedPirateRate: 0.3,
  },
} as const satisfies Record<string, Personality>;

export type PersonalityName = keyof typeof PERSONALITIES;
