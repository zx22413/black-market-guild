import { useId } from 'react';

// Hand-drawn ornaments for the skin lab (dev/SkinLabPreview.tsx): brass corner plates (the rule
// book) and the wax seal. The bar's end caps, the panel frame and the compass rose now live in
// skin/layers.css as data URIs.
// Flat shapes, no outline, lit from the top, the same as the card art (docs/ui/v07-style-layers.md).

/** A `useId` that is safe inside `url(#…)`. */
function useSvgId(): string {
  return `lab${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Top-lit brass: light rim, mid body, dark foot. */
function BrassFill({ id }: { readonly id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fbe4a0" />
      <stop offset="0.35" stopColor="#dcae52" />
      <stop offset="1" stopColor="#8a6420" />
    </linearGradient>
  );
}

function Rivet({ cx, cy }: { readonly cx: number; readonly cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy + 0.8} r={2.6} fill="#5b3f12" />
      <circle cx={cx} cy={cy} r={2.4} fill="#e9c36f" />
      <circle cx={cx - 0.7} cy={cy - 0.8} r={0.9} fill="#fff4cf" />
    </g>
  );
}

/** A brass corner plate; drawn for the top-left corner, CSS turns it for the other three. */
export function BrassCorner({ at }: { readonly at: 'tl' | 'tr' | 'bl' | 'br' }) {
  const fill = useSvgId();
  return (
    <svg className={`lab-corner ${at}`} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <defs>
        <BrassFill id={fill} />
      </defs>
      <path d="M2 4 L4 2 H34 L28 8 H14 Q8 8 8 14 V28 L2 34 Z" fill="#5b3f12" transform="translate(0 1)" />
      <path d="M2 4 L4 2 H34 L28 8 H14 Q8 8 8 14 V28 L2 34 Z" fill={`url(#${fill})`} />
      <path d="M28 4.6 H14 Q5 4.6 4.6 14 V28" fill="none" stroke="#fbe4a0" strokeWidth="0.8" opacity="0.6" />
      <Rivet cx={6} cy={6} />
    </svg>
  );
}

/** The wax blob's outline: a circle pushed in and out at fixed points, so it looks poured, not stamped. */
const WAX_BUMPS = [3, -2, 4, 1, -3, 2, 5, -1, 2, -4, 3, 0, 4, -2, 1, 3, -3, 2] as const;
const WAX_PATH = (() => {
  const pts = WAX_BUMPS.map((bump, i) => {
    const a = (i / WAX_BUMPS.length) * Math.PI * 2;
    const r = 42 + bump;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });
  const mid = (i: number) => {
    const p = pts[i % pts.length]!;
    const q = pts[(i + 1) % pts.length]!;
    return `${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  };
  return `M${mid(0)} ${pts.map((_, i) => `Q${pts[(i + 1) % pts.length]![0].toFixed(1)} ${pts[(i + 1) % pts.length]![1].toFixed(1)} ${mid(i + 1)}`).join(' ')} Z`;
})();

/**
 * A red wax seal: a poured blob with a raised ring pressed into it. The word on it is HTML laid on
 * top (dev/SkinLabPreview.tsx), so the seal itself carries no text.
 */
export function WaxSeal() {
  const fill = useSvgId();
  return (
    <svg className="lab-wax" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={fill} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#d8545c" />
          <stop offset="0.55" stopColor="#a3262f" />
          <stop offset="1" stopColor="#74161e" />
        </radialGradient>
      </defs>
      <path d={WAX_PATH} fill="#5d1218" transform="translate(0 3)" />
      <path d={WAX_PATH} fill={`url(#${fill})`} />
      <circle r="29" fill="none" stroke="#5d1218" strokeWidth="3" opacity="0.55" />
      <circle r="29" fill="none" stroke="#e98a8f" strokeWidth="1" opacity="0.45" transform="translate(0 1.5)" />
      <circle r="24" fill="#8f1d26" opacity="0.35" />
      <ellipse cx="-16" cy="-22" rx="9" ry="4" fill="#fff" opacity="0.18" transform="rotate(-30 -16 -22)" />
    </svg>
  );
}
