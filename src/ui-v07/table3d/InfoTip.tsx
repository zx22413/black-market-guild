import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// A small explanation on any icon of the table: shown while the pointer is over it (desktop) or after a
// tap (touch; tap elsewhere to close), never only on hover. It floats in its own layer on top of the
// screen, above the icon or below it when the top of the screen (the market strip) leaves no room,
// so no label layer or panel edge ever cuts it. Inside a button it only follows the pointer, so a
// tap still goes to the button.

/** Gap between the icon and its tip, and the margin kept from the screen edges. */
const GAP = 8;
const EDGE = 8;

export interface InfoTipProps {
  readonly title: ReactNode;
  readonly text: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Where the tip goes on screen, given the icon's box and the tip's size (pure, for the tests). */
export function tipPlacement(
  anchor: { readonly left: number; readonly top: number; readonly bottom: number; readonly width: number },
  tip: { readonly width: number; readonly height: number },
  screen: { readonly width: number; readonly height: number },
  /** The bottom of the HUD along the top of the screen: the tip never goes under it. */
  ceiling: number,
): { readonly left: number; readonly top: number; readonly below: boolean } {
  const above = anchor.top - GAP - tip.height;
  const below = above < ceiling + EDGE && anchor.bottom + GAP + tip.height <= screen.height - EDGE;
  const centred = anchor.left + anchor.width / 2 - tip.width / 2;
  return {
    left: Math.min(Math.max(EDGE, centred), Math.max(EDGE, screen.width - tip.width - EDGE)),
    top: below ? anchor.bottom + GAP : Math.max(EDGE, above),
    below,
  };
}

export function InfoTip({ title, text, children, className = '' }: InfoTipProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [place, setPlace] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const open = hover || pinned;

  // A tap elsewhere closes a pinned tip.
  useEffect(() => {
    if (!pinned) return undefined;
    const close = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [pinned]);

  // Measure the tip once it is drawn, then put it in place.
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    const a = anchor.current?.getBoundingClientRect();
    const t = tip.current?.getBoundingClientRect();
    if (!a || !t) return;
    const ceiling = document.querySelector('.inv-market')?.getBoundingClientRect().bottom ?? 0;
    setPlace(tipPlacement({ left: a.left, top: a.top, bottom: a.bottom, width: a.width }, { width: t.width, height: t.height }, { width: innerWidth, height: innerHeight }, ceiling));
  }, [open]);

  return (
    <span
      ref={anchor}
      className={`info-tip-anchor ${className}`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      onClick={(e) => {
        // In a button the tap is the button's; the tip still follows the pointer.
        if (anchor.current?.parentElement?.closest('button')) return;
        e.stopPropagation();
        setPinned((v) => !v);
      }}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tip}
            className={`info-tip ${place?.below ? 'below' : ''}`}
            role="tooltip"
            style={place ? { left: place.left, top: place.top } : { left: -9999, top: 0, visibility: 'hidden' }}
          >
            <b>{title}</b>
            <span>{text}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}
