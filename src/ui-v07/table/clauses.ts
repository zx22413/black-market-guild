// A rule sentence as its clauses, one per line on a card: the rule texts join their clauses with 「；」
// (labels.ts, v08Text.ts). Only the layout changes; the words stay the text source's. A 「；」 inside
// brackets belongs to its clause.

const OPEN = new Set(['（', '(']);
const CLOSE = new Set(['）', ')']);

export function clauses(text: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  [...text].forEach((ch, i, all) => {
    if (OPEN.has(ch)) depth += 1;
    else if (CLOSE.has(ch)) depth = Math.max(0, depth - 1);
    const end = i === all.length - 1;
    if ((ch === '；' && depth === 0) || end) {
      parts.push(all.slice(from, ch === '；' && depth === 0 ? i : i + 1).join(''));
      from = i + 1;
    }
  });
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}
