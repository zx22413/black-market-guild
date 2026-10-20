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
}

export function CoachCard({ view, onRead, onSkip, endActions }: CoachCardProps) {
  const { step, todo, ready } = view;
  if (step === null) {
    return todo ? (
      <aside className={`coach coach-todo ${ready ? 'ready' : ''}`} aria-live="polite">
        <span className="coach-todo-mark" aria-hidden="true" />
        {ready ? '好了，按「提交」。' : todo}
      </aside>
    ) : null;
  }
  // Only the very last step offers what to do next; earlier steps read with 「下一步」.
  const ending = view.number === view.total;
  return (
    <aside className="coach" aria-live="polite" aria-label="教學說明">
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
            <button type="button" className="primary" onClick={onRead}>
              下一步
            </button>
          </>
        )}
      </footer>
    </aside>
  );
}
