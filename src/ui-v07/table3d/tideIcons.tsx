import type { TideKind } from '../../v07/game';

// V0.8 prototype: one glyph per dark tide, drawn here (no outside art): a wave under what the tide brings.
// storm: a bolt; pirate: crossed sabres; inspection: a searching eye; crash: a falling price line.

const WAVE = 'M1 19c2.500-2.500 5-2.500 7.500 0s5 2.500 7.500 0 5-2.500 7 0v4H1z';

const MARKS: Readonly<Record<TideKind, readonly string[]>> = {
  storm: ['M13.500 1 6 11h4.500L9 17l8-10h-4.500z'],
  pirate: ['M4 2c5 1 9 5 11 10l-2 1.500C11 9 8 5.500 3 4z', 'M20 2c-5 1-9 5-11 10l2 1.500C13 9 16 5.500 21 4z', 'M7 13.500l3 2-1.200 1.800-3-2zM17 13.500l-3 2 1.200 1.800 3-2z'],
  inspection: ['M12 3c5 0 8.500 3.500 10 6-1.500 2.500-5 6-10 6S3.500 11.500 2 9c1.500-2.500 5-6 10-6zm0 2.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7z', 'M12 7.300a1.700 1.700 0 1 1 0 3.400 1.700 1.700 0 0 1 0-3.400z'],
  crash: ['M2 3h3l4 5 3-3 6 7V8.500L22 16h-7.500l3.500-1-6-6-3 3-5.500-6z'],
};

export function TideIcon({ kind, wave = true }: { readonly kind: TideKind; readonly wave?: boolean }) {
  return (
    <svg className={`tide-icon tide-icon-${kind}`} viewBox="0 0 24 24" aria-hidden="true">
      {MARKS[kind].map((d) => (
        <path key={d} d={d} fillRule="evenodd" />
      ))}
      {wave && <path className="tide-icon-wave" d={WAVE} />}
    </svg>
  );
}
