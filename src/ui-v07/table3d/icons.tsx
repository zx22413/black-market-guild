import type { ReactNode } from 'react';
import { RULES_V07, type GoodId } from '../../v07/game';
import { wantedText } from '../labels';

// Small drawn icons for the table UI, so no arrow, lock or sign is made out of text characters.
// Line icons follow the surrounding text color; the picture icons are drawn in the card art's style
// (public/art/tokens and public/art/cards, sources in public/art/SOURCES.md).

/** The small token icons (public/art/tokens), drawn in the card art's style: colour, ink outline, no background. */
export type TokenIcon = 'coin' | 'dice' | 'reroll' | 'ship' | `good-${GoodId}`;
export const tokenIconUrl = (name: TokenIcon): string => `${import.meta.env.BASE_URL}art/tokens/${name}.svg`;

const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** "From" then "to": a small chevron arrow between two things. */
export function ArrowIcon() {
  return (
    <svg className="ico-arrow" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M2.5 8h10M9 4l4 4-4 4" {...LINE} />
    </svg>
  );
}

/** Up or down triangle for a price or number that moved. */
export function TrendIcon({ dir }: { readonly dir: 1 | -1 | 0 }) {
  if (dir === 0) {
    return (
      <svg className="ico-trend" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        <path d="M2 4.5h8M2 7.5h8" {...LINE} />
      </svg>
    );
  }
  return (
    <svg className={`ico-trend ${dir > 0 ? 'up' : 'down'}`} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path d={dir > 0 ? 'M6 2l4.5 8h-9z' : 'M6 10l4.5-8h-9z'} fill="currentColor" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7" rx="1.5" {...LINE} />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" {...LINE} />
    </svg>
  );
}

/** A little house: the building slot. */
export function HouseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M2 8l6-5 6 5M3.5 7v6.5h9V7" {...LINE} />
    </svg>
  );
}

/** A cross: close. */
export function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M4 4l8 8M12 4l-8 8" {...LINE} />
    </svg>
  );
}

/** A little crate: the warehouse. */
export function CrateIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M2.5 4.5l5.5-2 5.5 2v7l-5.5 2-5.5-2zM2.5 4.5L8 6.5l5.5-2M8 6.5v7" {...LINE} />
    </svg>
  );
}

/** A warning triangle: something to watch for. */
export function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 2.5l6 10.5H2z" {...LINE} />
      <path d="M8 6.5v3M8 11.3v.1" {...LINE} />
    </svg>
  );
}

/** An open book: the rules. */
export function BookIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 4.5C6.5 3.5 4.5 3.3 2.5 3.5v8.5c2-.2 4 0 5.5 1M8 4.5c1.5-1 3.5-1.2 5.5-1v8.5c-2-.2-4 0-5.5 1M8 4.5V13" {...LINE} />
    </svg>
  );
}

/** Lines of text: the voyage log. */
export function LogIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 4h10M3 8h10M3 12h6" {...LINE} />
    </svg>
  );
}

/** A door with an arrow out: leave the table. */
export function ExitIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M6.5 3H3.5v10h3M7 8h6M10.5 5.5L13 8l-2.5 2.5" {...LINE} />
    </svg>
  );
}

/** An hourglass-like clock: how long something takes or rests. */
export function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" {...LINE} />
      <path d="M8 4.8V8l2.2 1.4" {...LINE} />
    </svg>
  );
}

/** Skip ahead: two triangles. */
export function FastForwardIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M2.5 3.5l5 4.5-5 4.5zM8.5 3.5l5 4.5-5 4.5z" fill="currentColor" />
    </svg>
  );
}

/** A circled "i": an explanation on tap or hover. */
export function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" {...LINE} />
      <path d="M8 7.2v3.6M8 5.1v.1" {...LINE} />
    </svg>
  );
}

/** A round dark badge holding one of the cream art icons (coin, ship, a role). */
/**
 * A small icon in a line of text. A token icon (coin, dice, ship) stands on its own; `badge` puts a
 * card icon (cardArt.ts) on the card art's sky-and-sea disc, as the island icons are.
 */
export function IconDisc({ src, badge = false }: { readonly src: string; readonly badge?: boolean }) {
  return (
    <span className={`chip-ic ${badge ? 'badge' : ''}`} aria-hidden="true">
      <img src={src} alt="" />
    </span>
  );
}

/** Two values with an arrow between them: 「1000 ▸ 900」. */
export function Flow({ from, to }: { readonly from: ReactNode; readonly to: ReactNode }) {
  return (
    <span className="flow">
      {from}
      <ArrowIcon />
      {to}
    </span>
  );
}

/** 思考中／已決定 as a mark: three pulsing dots while thinking, a check once decided. */
export function StatusMark({ label }: { readonly label: string }) {
  if (label === '') return null;
  const done = label === '已決定';
  return (
    <span className={`status-mark ${done ? 'done' : 'thinking'}`} title={label} role="img" aria-label={label}>
      {done ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path d="M3.5 8.5l3 3 6-7" {...LINE} />
        </svg>
      ) : (
        <>
          <i />
          <i />
          <i />
        </>
      )}
    </span>
  );
}

/** A wanted player (§9.6): a red disc with a mark; hover or tap for what it means. */
export function WantedMark() {
  const text = wantedText(RULES_V07.wanted.lootBonus);
  return (
    <span className="wanted-mark" data-tip={text} tabIndex={0} role="img" aria-label={text}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
        <path d="M8 3.5v5.5M8 12v.1" {...LINE} strokeWidth={2.2} />
      </svg>
    </span>
  );
}

/** A flag on a pole: the wanted notice. */
export function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
      <path d="M6 21V3" {...LINE} strokeWidth={2.2} />
      <path d="M6 4h12l-3 4.5 3 4.5H6z" fill="currentColor" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  );
}
