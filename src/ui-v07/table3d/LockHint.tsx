import { useState, type ReactNode } from 'react';
import { LockIcon } from './icons';

// A small lock next to the submit button: tap or hover to read why a submit is final. Works on
// touch (a tap toggles it), so it never depends on hover alone.

interface LockHintProps {
  readonly text: string;
  /** What the button shows; a lock unless told otherwise (an info mark for plain explanations). */
  readonly icon?: ReactNode;
  /** Which way the tip opens; up unless the button sits at the top of the screen. */
  readonly placement?: 'up' | 'down';
}

export function LockHint({ text, icon = <LockIcon />, placement = 'up' }: LockHintProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="bar-lock-wrap" onMouseLeave={() => setOpen(false)}>
      <button type="button" className="bar-lock" aria-label={text} aria-expanded={open} onClick={() => setOpen((v) => !v)} onMouseEnter={() => setOpen(true)}>
        {icon}
      </button>
      {open && (
        <span className={`bar-lock-tip ${placement}`} role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
