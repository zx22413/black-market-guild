import { forwardRef, type CSSProperties } from 'react';
import type { CoachView } from '../../v07/tutorial';

// The host's card (docs/tutorial-outline.md §1): beside the table, never over it, so the part being
// explained stays in view. A step is read with 「下一步」; at the end, the card offers what to do next.

export interface CoachEndAction {
  readonly label: string;
  readonly primary?: boolean;
  readonly onClick: () => void;
}

interface CoachCardProps {
  readonly view: CoachView;
  readonly onRead: () => void;
  readonly onSkip: () => void;
  /** Shown instead of 「下一步」 on the last step. */
  readonly endActions: readonly CoachEndAction[];
  /** Where the card sits (it moves out of the way of what is lit). */
  readonly style?: CSSProperties;
  /** Bumped when the blocked table is clicked: 「下一步」 waves (a new value replays it). */
  readonly nudge?: number;
}

export const CoachCard = forwardRef<HTMLElement, CoachCardProps>(function CoachCard({ view, onRead, onSkip, endActions, style, nudge = 0 }, ref) {
  const { step, todo, ready } = view;
  if (step === null) {
    return todo ? (
      <aside ref={ref} style={style} className={`coach coach-todo ${ready ? 'ready' : ''}`} aria-live="polite">
        <span className="coach-todo-mark" aria-hidden="true" />
        {ready ? '好了，按「提交」。' : todo}
      </aside>
    ) : null;
  }
  // Only the very last step offers what to do next; earlier steps read with 「下一步」.
  const ending = view.number === view.total;
  return (
    <aside ref={ref} style={style} className="coach" aria-live="polite" aria-label="教學說明">
      <header className="coach-head">
        <strong>{step.title}</strong>
        <span className="coach-count">
          {view.number}／{view.total}
        </span>
      </header>
      {step.lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {step.todo && <p className="coach-next">{step.todo}</p>}
      <footer className="coach-foot">
        {ending ? (
          endActions.map((a) => (
            <button key={a.label} type="button" className={a.primary ? 'primary' : ''} onClick={a.onClick}>
              {a.label}
            </button>
          ))
        ) : (
          <>
            <button type="button" onClick={onSkip}>
              離開教學
            </button>
            {/* The only thing to press while a step is read: it breathes, and waves when the table is clicked. */}
            <button key={`next-${nudge}`} type="button" className={`primary coach-next-btn ${nudge > 0 ? 'nudged' : ''}`} onClick={onRead}>
              下一步
            </button>
          </>
        )}
      </footer>
    </aside>
  );
});
