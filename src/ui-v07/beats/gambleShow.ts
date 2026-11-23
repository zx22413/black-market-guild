// 最後的大市集 (game-design.md §12.1): every ship throws two dice for its raw roll and the higher one counts. The beat
// throws them all and knocks the low ones away. Built from the dice the engine publishes with the round's modifiers
// (`VoyageModifier.dice`), so the dice shown are the dice thrown.

export interface Gamble {
  /** Every die thrown, in the order thrown. */
  readonly dice: readonly number[];
  /** Index of the die that counts: the highest, the first of them on a tie. */
  readonly kept: number;
  readonly value: number;
  /** More than one die shows the highest value. */
  readonly tie: boolean;
}

/** The throw to show, or null when one die was rolled (every round but the last). */
export function gambleOf(dice: readonly number[] | undefined): Gamble | null {
  if (dice === undefined || dice.length < 2) return null;
  const value = Math.max(...dice);
  return { dice, kept: dice.indexOf(value), value, tie: dice.filter((d) => d === value).length > 1 };
}

/** What the tag says beside the dice: before they have landed nothing of the result, then what was thrown and kept. */
export function gambleText(gamble: Gamble, picked: boolean): { readonly title: string; readonly note: string } {
  if (!picked) return { title: '最後一搏', note: `擲 ${gamble.dice.length} 顆，取高的` };
  const all = gamble.dice.every((d) => d === gamble.value);
  return { title: `取高的 ${gamble.value}`, note: all ? `${gamble.dice.length === 2 ? '兩' : gamble.dice.length}顆都是 ${gamble.value}` : `擲出 ${gamble.dice.join(' 與 ')}` };
}
