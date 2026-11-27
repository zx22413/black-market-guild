// The dock works raised round a ship whose skill is opened (scene/ships/DockWorks.tsx) as sound, on the show's own
// script (dockWorksShow.ts): a splash as each bay of piles breaks the water, the staging's planks set down, the canvas
// let down, the shipwrights' hammering in the dust, the unveiling in gold light, and the splash as the works go under.
// Pure, so the timing is tested without audio.

import { BAY_COUNT, WORKS_SCRIPT, type WorksMode } from '../scene/ships/dockWorksShow';
import type { TimedSound } from './saluteSounds';

/** The piles' splashes are small and low; each next bay a little higher, so the row reads as one run. */
const PILE = { rate: 0.8, rise: 0.06 } as const;

export function dockWorksSounds(mode: WorksMode): TimedSound[] {
  const s = WORKS_SCRIPT[mode];
  // A beat before the clock starts (the works already standing) makes no sound.
  const at = (t: number): boolean => t >= 0;
  const sounds: TimedSound[] = [
    ...Array.from({ length: BAY_COUNT }, (_, i): TimedSound => ({ at: s.piles + i * s.stagger, id: 'salute-splash', rate: PILE.rate + i * PILE.rise })),
    { at: s.frame, id: 'produce', rate: 0.9 },
    { at: s.cloth, id: 'works-cloth', rate: 1 },
    { at: s.smoke[0], id: 'works-hammer', rate: 1 },
    { at: s.unveil, id: 'works-unveil', rate: 1 },
    ...(s.strike === null ? [] : [{ at: s.strike, id: 'salute-splash' as const, rate: 0.7 }]),
  ];
  return sounds.filter((x) => at(x.at)).sort((a, b) => a.at - b.at);
}
