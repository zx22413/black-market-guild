import type { DecisionContext } from '../../v07/bots';
import type { Action, PlayerId } from '../../v07/game';

export interface FormProps {
  readonly context: DecisionContext;
  readonly nameOf: (id: PlayerId) => string;
  readonly onSubmit: (action: Action) => void;
}

export type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;

/** Narrows the offered legal actions to one action type. */
export function legalOf<T extends Action['type']>(context: DecisionContext, type: T): ActionOf<T>[] {
  return context.legalActions.filter((a): a is ActionOf<T> => a.type === type);
}
