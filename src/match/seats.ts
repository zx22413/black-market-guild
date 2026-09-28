import { createBot, type Bot } from '../bots';
import type { PlayerId } from '../game';
import type { MatchSetup, SeatSetupInput } from './types';

/** Derives a distinct, reproducible seed for each bot seat from the match seed. */
function seatSeed(matchSeed: number, seatIndex: number): number {
  return (Math.imul(matchSeed, 31) + seatIndex + 1) | 0;
}

/** Assigns player ids p1..pN and creates bots for bot seats. */
export function setupFromSeats(input: SeatSetupInput): MatchSetup {
  const players = input.seats.map((seat, i) => ({ id: `p${i + 1}`, name: seat.name }));
  const bots: Record<PlayerId, Bot> = {};
  const humanSeats: PlayerId[] = [];
  const remoteSeats: PlayerId[] = [];
  input.seats.forEach((seat, i) => {
    const id = players[i]!.id;
    if (seat.kind === 'bot') {
      bots[id] = createBot(seat.strategy, seatSeed(input.seed, i));
    } else if (seat.kind === 'local-human') {
      humanSeats.push(id);
    } else {
      remoteSeats.push(id);
    }
  });
  return {
    seed: input.seed,
    ...(input.rules ? { rules: input.rules } : {}),
    players,
    bots,
    humanSeats,
    remoteSeats,
  };
}
