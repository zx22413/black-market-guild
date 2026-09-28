/**
 * Plays one match with random bots through the match runner and prints a readable log.
 * Usage: npm run match:log -- [seed] [playerCount]
 */
import { runMatchSync, setupFromSeats } from '../src/match';
import { formatLog } from '../src/ui/eventText';

const NAMES = ['Alice', 'Bob', 'Carol', 'Dave'];

function parseArgs(): { seed: number; playerCount: number } {
  const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? [];
  const seed = Number.parseInt(argv[2] ?? '42', 10);
  const playerCount = Number.parseInt(argv[3] ?? '4', 10);
  if (!Number.isInteger(seed) || !Number.isInteger(playerCount)) {
    throw new Error('usage: npm run match:log -- [seed] [playerCount]');
  }
  return { seed, playerCount };
}

function main(): void {
  const { seed, playerCount } = parseArgs();
  const seats = NAMES.slice(0, playerCount).map((name) => ({ kind: 'bot' as const, name, strategy: 'random' as const }));
  const setup = setupFromSeats({ seed, seats });
  const log = runMatchSync(setup, setup.bots);
  const names = new Map(setup.players.map((p) => [p.id, p.name]));
  const header = [
    `黑市商會 對局紀錄（seed ${seed}，${playerCount} 人，隨機 Bot）`,
    '規則：V0.6 完整規則（獨資、合資、角色、資產、市場與航海事件皆已生效）。',
  ];
  const lines = formatLog(log.events, names, log.finalState.rules.startingCash);
  console.log([...header, ...lines].join('\n'));
}

main();
