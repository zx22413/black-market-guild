// V0.8 prototype (an experiment, not rules): the last round's effect as a chip beside the voyage event's, once it is
// turned up; hover (or focus) for its lines, so the round's special rule can be looked up at any time.

export function FinalRoundChip({ title, lines }: { readonly title: string; readonly lines: readonly string[] }) {
  return (
    <div className="event-chip final" tabIndex={0} aria-label={`最後一回合：${title}。${lines.join('')}`}>
      <span className="final-flag" aria-hidden="true">⚑</span>
      <b>{title}</b>
      <span className="event-chip-tip">
        {lines.map((line) => (
          <span key={line} className="final-line">
            {line}
          </span>
        ))}
      </span>
    </div>
  );
}
