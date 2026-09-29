import type { CashFloat } from './useCashFloats';

/** Floating "+350 G" notes stacked above a guild's tag or treasury. */
export function CashFloats({ floats }: { readonly floats: readonly CashFloat[] }) {
  if (floats.length === 0) return null;
  return (
    <span className="cash-floats">
      {floats.map((f) => (
        <span key={f.id} className={`cash-float ${f.amount >= 0 ? 'gain' : 'loss'}`}>
          {f.amount >= 0 ? '+' : '−'}
          {Math.abs(f.amount)} G <small>{f.label}</small>
        </span>
      ))}
    </span>
  );
}
