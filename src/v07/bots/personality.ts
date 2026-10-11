/** Weights for one bot personality; scores are in G and sampled with a softmax temperature. */
export interface Personality {
  /** Penalty per G of cargo value at risk. */
  readonly risk: number;
  /** Multiplier on pirate loot. */
  readonly aggression: number;
  /** Multiplier on a building's estimated worth. */
  readonly builder: number;
  /** Multiplier on the future value of materials kept in the warehouse. */
  readonly patience: number;
  /** Softmax temperature in G; 0 always picks the best-scoring option. */
  readonly temperature: number;
}

/** Ported from src/proto/economy/bots; the island tastes became a real estimate (islands.ts). */
export const PERSONALITIES = {
  balanced: { risk: 0.2, aggression: 1, builder: 1, patience: 0.9, temperature: 25 },
  cautious: { risk: 0.5, aggression: 0.6, builder: 1, patience: 1, temperature: 25 },
  aggressive: { risk: 0, aggression: 1.5, builder: 0.8, patience: 0.8, temperature: 25 },
  builder: { risk: 0.2, aggression: 0.8, builder: 1.5, patience: 1, temperature: 25 },
} as const satisfies Record<string, Personality>;

export type PersonalityName = keyof typeof PERSONALITIES;
