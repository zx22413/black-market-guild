import type { Action } from '../game';

// What a seat does when its decision time runs out (docs/game-design.md §15.1): stay in port,
// deploy nothing, keep the roll. The island draft has no such choice; a bot picks there.

/** The "do nothing" action among the legal ones; null when there is none (the island draft). */
export function timeoutAction(legalActions: readonly Action[]): Action | null {
  return legalActions.find(isPass) ?? null;
}

function isPass(action: Action): boolean {
  switch (action.type) {
    case 'invest':
      return action.build === null && Object.values(action.load).every((units) => units === 0);
    case 'deploy-role':
      return action.role === null;
    case 'intel-reroll':
      return action.rerollShipId === null;
    case 'choose-island':
      return false;
  }
}
