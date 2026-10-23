import { useId } from 'react';

// The game's name, 暗潮商戰 / Contrabay (docs/title-wordmark.html, H3-A): stencilled and spray-painted
// like the marks on a smuggler's crate, with the 2×2 cinnabar chop (P1) as its seal. Drawn as SVG
// because the spray is an SVG filter, and Safari applies SVG filters to HTML text unreliably. The
// faces: Noto Sans TC 900 for the Chinese, Stardos Stencil for the English, Noto Serif TC 900 for the
// chop (index.html loads the last two cut down to these glyphs).

/** A `useId` that is safe inside `url(#…)`. */
function useSvgId(): string {
  return `tm${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** The spray: a fine speckle eats into the paint, a soft overspray halo sits behind it. */
function SprayFilter({ id }: { readonly id: string }) {
  return (
    <filter id={id} x="-4%" y="-8%" width="108%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="2" result="s" />
      <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -11 8.2" result="holes" />
      <feComposite in="SourceGraphic" in2="holes" operator="in" result="paint" />
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="fuzz" />
      <feComponentTransfer in="fuzz" result="halo">
        <feFuncA type="linear" slope="0.3" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="halo" />
        <feMergeNode in="paint" />
      </feMerge>
    </filter>
  );
}

/**
 * The stencilled name. `zh`: 暗潮商戰 large, one stencil bridge cut through every character, and
 * CONTRABAY under it. `en`: CONTRABAY large (the stencil face brings its own bridges), 暗潮商戰 small.
 * Colour comes from `currentColor`.
 */
export function GameTitle({ lang = 'zh', className }: { readonly lang?: 'zh' | 'en'; readonly className?: string }) {
  const id = useSvgId();
  const label = lang === 'zh' ? '暗潮商戰 Contrabay' : 'Contrabay 暗潮商戰';
  return (
    <svg className={`title-stencil ${lang} ${className ?? ''}`} viewBox={lang === 'zh' ? '0 0 300 106' : '0 0 300 92'} role="img" aria-label={label}>
      <defs>
        <SprayFilter id={`${id}-spray`} />
        {lang === 'zh' && (
          <mask id={`${id}-bridge`}>
            <rect width="300" height="106" fill="#fff" />
            <rect y="35.5" width="300" height="2.2" fill="#000" />
            <rect y="91" width="300" height="1.4" fill="#000" />
          </mask>
        )}
      </defs>
      {lang === 'zh' ? (
        <g filter={`url(#${id}-spray)`} mask={`url(#${id}-bridge)`} fill="currentColor">
          <text className="title-zh" x="152" y="36" textAnchor="middle" dominantBaseline="central" fontSize="64" letterSpacing="5">
            暗潮商戰
          </text>
          <text className="title-en" x="152" y="92" textAnchor="middle" dominantBaseline="central" fontSize="23" letterSpacing="7">
            CONTRABAY
          </text>
        </g>
      ) : (
        <g filter={`url(#${id}-spray)`} fill="currentColor">
          <text className="title-en" x="150" y="36" textAnchor="middle" dominantBaseline="central" fontSize="46" letterSpacing="1">
            CONTRABAY
          </text>
          <text className="title-zh" x="151" y="77" textAnchor="middle" dominantBaseline="central" fontSize="19" letterSpacing="14">
            暗潮商戰
          </text>
        </g>
      )}
    </svg>
  );
}

const CHOP_CELLS = [
  ['暗', 62, 62],
  ['潮', 138, 62],
  ['商', 62, 138],
  ['戰', 138, 138],
] as const;

/**
 * The 2×2 cinnabar chop (P1): a red block with the four characters cut out, its edge and face worn.
 * It stands for the game itself; the round wax seal stays the mark of a sealed, secret choice.
 */
export function CinnabarChop({ className }: { readonly className?: string }) {
  const id = useSvgId();
  return (
    <svg className={`cinnabar-chop ${className ?? ''}`} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <mask id={`${id}-cut`}>
          <rect width="200" height="200" fill="#fff" />
          {CHOP_CELLS.map(([c, x, y]) => (
            <text key={c} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="72" fill="#000">
              {c}
            </text>
          ))}
        </mask>
        <filter id={`${id}-worn`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="9" result="s" />
          <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 10.6" result="holes" />
          <feComposite in="d" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${id}-worn)`}>
        <rect x="12" y="12" width="176" height="176" rx="8" fill="currentColor" mask={`url(#${id}-cut)`} />
      </g>
    </svg>
  );
}
