import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { IslandId } from '../../v07/game';
import { ISLAND_LABELS, ISLAND_TEXT } from '../labels';
import { CinnabarChop } from '../skin/titleMark';
import { IslandGlance } from './IslandGlance';
import { cardLean, pointerTilt, roughEdge } from './cardCraft';
import './islandCard.css';

// An island as an RPG-style playing card (docs/ui/v07-style-layers.md): a dark wood frame with gold
// trim, a flat vector illustration of the island (public/art/islands/*.svg, self-drawn), the name in
// foil on a ribbon across the picture's lower edge, and its effects on a parchment panel below. Paper grain, a torn edge
// and a slight lean differ per island but never change; the card follows the pointer and flips over
// when it is dealt.

/** How far the card tips under the pointer, in degrees. */
const TILT_MAX = 7;

export const islandArtUrl = (island: IslandId): string => `${import.meta.env.BASE_URL}art/islands/${island}.svg`;

export interface IslandCardProps {
  readonly island: IslandId;
  /** Face down until dealt; turning it up plays the flip. */
  readonly faceUp: boolean;
  readonly selected?: boolean;
  /** Also show the island's full rule sentences on a slip under the card. */
  readonly showFull?: boolean;
  readonly size?: 'large' | 'small';
}

function prefersStill(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function IslandCard({ island, faceUp, selected = false, showFull = false, size = 'large' }: IslandCardProps) {
  const self = useRef<HTMLSpanElement>(null);
  const text = ISLAND_TEXT[island];
  const tilt = (e: PointerEvent<HTMLSpanElement>) => {
    const el = self.current;
    if (!el || !faceUp || prefersStill()) return;
    const box = el.getBoundingClientRect();
    const t = pointerTilt(e.clientX - box.left, e.clientY - box.top, box.width, box.height, TILT_MAX);
    el.style.setProperty('--rx', `${t.rotateX}deg`);
    el.style.setProperty('--ry', `${t.rotateY}deg`);
    el.style.setProperty('--gx', `${t.glareX}%`);
    el.style.setProperty('--gy', `${t.glareY}%`);
    el.classList.add('tilting');
  };
  const settle = () => {
    const el = self.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.classList.remove('tilting');
  };
  const style = { '--lean': `${cardLean(island)}deg`, '--edge': roughEdge(island) } as CSSProperties;
  return (
    <span className="isle-holder">
    <span
      ref={self}
      className={`isle-card ${size} ${faceUp ? 'up' : 'down'} ${selected ? 'on' : ''}`}
      style={style}
      onPointerMove={tilt}
      onPointerLeave={settle}
    >
      <span className="isle-inner">
        <span className="isle-face front" aria-hidden={!faceUp}>
          <span className="isle-paper">
            <span className="isle-art">
              <img
                src={islandArtUrl(island)}
                alt=""
                draggable={false}
                // If a picture fails to load, the window shows its plain sky and sea.
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden';
                }}
              />
              <span className="isle-glare" />
            </span>
            <span className="isle-ribbon">
              <b className="isle-name">{ISLAND_LABELS[island]}</b>
            </span>
            <span className="isle-body">
              <IslandGlance island={island} />
            </span>
            <CompassRose className="isle-emboss corner" />
          </span>
        </span>
        <span className="isle-face back" aria-hidden={faceUp}>
          <span className="isle-paper">
            <CompassRose className="isle-emboss center" />
            <span className="isle-back-title">
              暗潮商戰
              <CinnabarChop className="isle-back-chop" />
            </span>
          </span>
        </span>
      </span>
    </span>
    {showFull && faceUp && (
      <span className="isle-full">
        <span>{text.pro}</span>
        <span>{text.con}</span>
      </span>
    )}
    </span>
  );
}

/** Deals a card: face down first, then turned up after `delay` ms (at once if motion is reduced). */
export function useDealt(delay: number): boolean {
  const [up, setUp] = useState(prefersStill);
  useEffect(() => {
    if (up) return;
    const timer = setTimeout(() => setUp(true), delay);
    return () => clearTimeout(timer);
  }, [delay, up]);
  return up;
}

/** A compass rose blind-embossed into the paper (the relief comes from CSS shadows). */
function CompassRose({ className }: { readonly className: string }) {
  return (
    <svg className={className} viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r="44" fill="none" strokeWidth="2.5" />
      <circle r="36" fill="none" strokeWidth="1.2" />
      <path d="M0 -46 L7 -7 L0 0 L-7 -7 Z M46 0 L7 7 L0 0 L7 -7 Z M0 46 L-7 7 L0 0 L7 7 Z M-46 0 L-7 -7 L0 0 L-7 7 Z" />
      <path d="M0 -26 L4 -4 L26 0 L4 4 L0 26 L-4 4 L-26 0 L-4 -4 Z" transform="rotate(45)" opacity="0.7" />
    </svg>
  );
}
