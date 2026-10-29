// Public API of the beginner tutorial (docs/tutorial-outline.md). The UI imports from here only.
import { BASICS } from './basics';
import { ISLANDS } from './islandsLesson';
import { ROLE_SCENARIOS } from './roleScenarios';
import type { TutorialId, TutorialScript } from './types';

export { coachView } from './coach';
export type { CoachMoment, CoachView } from './coach';
export { allowedFor, isReady, playTutorial, scriptedAction, tutorialSetup, youChoose } from './play';
export { tutorialStage } from './stage';
export { BASICS } from './basics';
export { TRAILER } from './trailer';
export { ISLANDS } from './islandsLesson';
export { ARMS_COVER, BROKER, GUARD, INTEL, PIRATE, ROLE_SCENARIOS, SMUGGLER } from './roleScenarios';
export * from './types';

/** Every lesson in menu order: the guided match, the role scenarios, then the island draft. */
export const TUTORIALS: readonly TutorialScript[] = [BASICS, ...ROLE_SCENARIOS, ISLANDS];

export function tutorialById(id: TutorialId): TutorialScript {
  const script = TUTORIALS.find((t) => t.id === id);
  if (script === undefined) throw new Error(`unknown tutorial: ${id}`);
  return script;
}
