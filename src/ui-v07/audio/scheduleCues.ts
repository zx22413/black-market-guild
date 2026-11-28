import type { Cue } from './roundCardSounds';
import { soundEngine } from './soundEngine';

/**
 * Plays `cues` at their times from now, and each of `more` as its own run, `run(0)`, `run(1)`… one after another for
 * as long as the show lasts (a card that is up: its bubbles, its shells, its crowd). Returns the stop.
 */
export function scheduleCues(cues: readonly Cue[], ...more: readonly ((i: number) => Cue)[]): () => void {
  const play = (c: Cue) => soundEngine.playSfx(c.id, c.rate, c.gain ?? 1);
  const timers = cues.map((c) => setTimeout(() => play(c), c.at * 1000));
  const started = performance.now();
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const chain = (run: (i: number) => Cue, i: number) => {
    const c = run(i);
    const timer = setTimeout(() => {
      pending.delete(timer);
      play(c);
      chain(run, i + 1);
    }, Math.max(0, c.at * 1000 - (performance.now() - started)));
    pending.add(timer);
  };
  more.forEach((run) => chain(run, 0));
  return () => {
    timers.forEach(clearTimeout);
    pending.forEach(clearTimeout);
  };
}
