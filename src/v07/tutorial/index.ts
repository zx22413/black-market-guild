// Public API of the beginner tutorial (docs/tutorial-outline.md). The UI imports from here only.
import { BASICS } from './basics';
import { GROWTH } from './growth';
import { TIDE } from './tideLesson';
import { ISLANDS } from './islandsLesson';
import { ROLE_SCENARIOS } from './roleScenarios';
import type { TutorialId, TutorialScript } from './types';

export { coachView } from './coach';
export type { CoachMoment, CoachView } from './coach';
export { allowedFor, isReady, playTutorial, scriptedAction, tutorialSetup, youChoose } from './play';
export { tutorialStage } from './stage';
export { BASICS } from './basics';
export { GROWTH } from './growth';
export { TIDE } from './tideLesson';
export { TRAILER } from './trailer';
export { ISLANDS } from './islandsLesson';
export { CUSTOMS, DIPLOMAT, GUARD, PIRATE, ROLE_SCENARIOS, SMUGGLER } from './roleScenarios';
export * from './types';

/** Every lesson in menu order: the guided match, growth and the dark tide (V0.8), the role scenarios, then the island draft. */
export const TUTORIALS: readonly TutorialScript[] = [BASICS, GROWTH, TIDE, ...ROLE_SCENARIOS, ISLANDS];

export function tutorialById(id: TutorialId): TutorialScript {
  const script = TUTORIALS.find((t) => t.id === id);
  if (script === undefined) throw new Error(`unknown tutorial: ${id}`);
  return script;
}
