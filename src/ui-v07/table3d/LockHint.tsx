import { useState } from 'react';

// A small lock next to the submit button: tap or hover to read why a submit is final. Works on
// touch (a tap toggles it), so it never depends on hover alone.

interface LockHintProps {
  readonly text: string;
}

export function LockHint({ text }: LockHintProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="bar-lock-wrap" onMouseLeave={() => setOpen(false)}>
      <button type="button" className="bar-lock" aria-label={text} aria-expanded={open} onClick={() => setOpen((v) => !v)} onMouseEnter={() => setOpen(true)}>
        🔒
      </button>
      {open && (
        <span className="bar-lock-tip" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
