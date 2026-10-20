import { useState } from 'react';

// A gentle "are you sure?" before submitting something unfinished: says what is missing, lets the
// player go back or submit anyway, and can be switched off with "不再提醒".

export interface ReminderDialogProps {
  readonly title: string;
  readonly lines: readonly string[];
  readonly onBack: () => void;
  /** `skipNext`: the player ticked "不再提醒". */
  readonly onConfirm: (skipNext: boolean) => void;
}

export function ReminderDialog({ title, lines, onBack, onConfirm }: ReminderDialogProps) {
  const [skip, setSkip] = useState(false);
  return (
    <div className="beat-backdrop reminder-backdrop" onClick={onBack} role="dialog" aria-modal="true" aria-label={title}>
      <div className="beat-card reminder" data-focus="dialog" onClick={(e) => e.stopPropagation()}>
        <header className="beat-head">
          <strong>{title}</strong>
        </header>
        <ul className="reminder-lines">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <label className="reminder-skip">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          不再提醒
        </label>
        <footer className="beat-foot">
          <button type="button" className="primary" onClick={onBack} autoFocus>
            回去補上
          </button>
          <button type="button" onClick={() => onConfirm(skip)}>
            仍要提交
          </button>
        </footer>
      </div>
    </div>
  );
}
