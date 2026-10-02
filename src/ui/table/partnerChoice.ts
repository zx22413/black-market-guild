import type { DecisionContext } from '../../bots';
import type { Action, PlayerId } from '../../game';

/** The viewer's pending pick in a partner phase: a seat, an explicit "none", or nothing yet. */
export type PartnerPick = { readonly kind: 'player'; readonly id: PlayerId } | { readonly kind: 'decline' };

export interface PartnerChoice {
  readonly phase: 'apply' | 'pick';
  /** Seats the viewer may legally apply to (or pick), in action order. */
  readonly candidates: readonly PlayerId[];
  /** The "apply to nobody" / "pick nobody" action. */
  readonly decline: Action | null;
  /** The legal action that commits the given pick, if there is one. */
  readonly actionFor: (pick: PartnerPick) => Action | null;
}

/** Reads the apply / pick decision out of the legal actions; null in every other phase. */
export function partnerChoice(context: DecisionContext): PartnerChoice | null {
  const { phase } = context.decision;
  if (phase !== 'apply' && phase !== 'pick') return null;
  const byPlayer = new Map<PlayerId, Action>();
  let decline: Action | null = null;
  for (const action of context.legalActions) {
    if (action.type === 'apply') {
      if (action.recruiterId) byPlayer.set(action.recruiterId, action);
      else decline = action;
    } else if (action.type === 'pick') {
      if (action.applicantId) byPlayer.set(action.applicantId, action);
      else decline = action;
    }
  }
  return {
    phase,
    candidates: [...byPlayer.keys()],
    decline,
    actionFor: (pick) => (pick.kind === 'decline' ? decline : (byPlayer.get(pick.id) ?? null)),
  };
}
