// How slowly the round's shows play: each ship beat (its start die, modifiers, outcome, cargo and
// money) and the islands at work (the lighthouse's beam, the cove's raiders, the fortress's salute,
// an island hopping when it counts). Every one of their timings is multiplied by this. One place to
// tune the pace by eye; 1 is the first cut, which went by too fast to follow.

export const SHOW_TEMPO = 1.6;

/** The same timings, slowed by the tempo (seconds or milliseconds, whatever they were in). */
export function slowed<T extends Readonly<Record<string, number>>>(timings: T): { readonly [K in keyof T]: number } {
  return Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, v * SHOW_TEMPO])) as { readonly [K in keyof T]: number };
}
