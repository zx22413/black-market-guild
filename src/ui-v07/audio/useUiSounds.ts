import { useEffect, useRef } from 'react';
import { soundEngine } from './soundEngine';
import type { SfxId } from './soundPlan';

// Small hooks for sounds tied to the interface rather than the rules: one when something shows
// up, one when a count goes up or down, and the light click every plain button makes.

/** Plays `id` once when the component appears (a timer the cleanup cancels: once even under React's double mount in development). */
export function useSoundOnce(id: SfxId): void {
  useEffect(() => {
    const timer = setTimeout(() => soundEngine.playSfx(id), 0);
    return () => clearTimeout(timer);
  }, [id]);
}

/** Plays `up` when `count` grows and `down` (if any) when it shrinks; the first value is only taken in. */
export function useCountSound(count: number, up: SfxId, down: SfxId | null = null): void {
  const last = useRef<number | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = count;
    if (before === null || count === before) return;
    const sound = count > before ? up : down;
    if (sound) soundEngine.playSfx(sound);
  }, [count, up, down]);
}

/** Buttons that make their own sound (the seal, the island cards and the draft's 選定, the role cards, the rule book's tabs and clasp). */
const OWN_SOUND = '.seal-submit, .isle-slot, .draft .primary, .dep-card, .rules-tab, .rules-close';

/** Every other enabled button clicks lightly when pressed. */
export function useUiClicks(): void {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.('button');
      if (!button || button.disabled || button.closest(OWN_SOUND)) return;
      soundEngine.playSfx('ui-click');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
}
