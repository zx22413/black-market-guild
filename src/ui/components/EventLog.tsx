import { useEffect, useMemo, useRef } from 'react';
import type { MatchEvent } from '../../game';
import { formatLog } from '../eventText';

interface EventLogProps {
  readonly events: readonly MatchEvent[];
  readonly names: ReadonlyMap<string, string>;
  readonly startingCash: number;
}

/** Readable log of the public events played so far, newest at the bottom. */
export function EventLog({ events, names, startingCash }: EventLogProps) {
  const lines = useMemo(
    () => formatLog(events, names, startingCash).filter((l) => l !== ''),
    [events, names, startingCash],
  );
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Scroll only the log itself, never the page.
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [lines.length]);
  return (
    <section className="panel event-log">
      <h2>航海日誌</h2>
      <ol ref={list}>
        {lines.map((line, i) => (
          <li key={i} className={line.startsWith('──') || line.startsWith('══') ? 'log-heading' : ''}>
            {line.trim()}
          </li>
        ))}
      </ol>
    </section>
  );
}
