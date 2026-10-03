import { useState, type ReactNode } from 'react';
import type { Action } from '../../game';

export interface ChoiceOption {
  readonly label: string;
  readonly action: Action;
}

interface ConfirmChoiceProps {
  readonly prompt: ReactNode;
  readonly options: readonly ChoiceOption[];
  readonly onSubmit: (action: Action) => void;
}

/**
 * Select-then-confirm for a small set of legal actions: tapping an option only marks it, and the
 * decision is sent when the confirm button is pressed.
 */
export function ConfirmChoice({ prompt, options, onSubmit }: ConfirmChoiceProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const chosen = picked === null ? undefined : options[picked];
  return (
    <div className="action-pill">
      <span>{prompt}</span>
      <div className="pill-row">
        {options.map((option, i) => (
          <button key={i} type="button" className={`partner-option ${picked === i ? 'selected' : ''}`} aria-pressed={picked === i} onClick={() => setPicked(i)}>
            {option.label}
          </button>
        ))}
      </div>
      <div className="pill-row">
        <button type="button" className="primary" disabled={!chosen} onClick={() => chosen && onSubmit(chosen.action)}>
          {chosen ? `確認：${chosen.label}` : '請先選擇'}
        </button>
      </div>
    </div>
  );
}
