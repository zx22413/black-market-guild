import type { CSSProperties, ReactNode } from 'react';

// The rule book turning a page when the chapter changes (RulesPanel): a real leaf lifts off the
// spine and swings across, the old page on its front and the new one on its back. On the two-page
// spread the right-hand page turns over to the left going forward (the left-hand one to the right
// going back) while the page it will land on keeps the old chapter until it is covered; on a phone
// the single page turns away to the left. Each face shows the matching half of a full-size copy of
// the spread, so the text sits exactly where it does on the page underneath.

/** How long a page takes to turn (handed to rulesBook.css as --turn-ms). */
export const PAGE_TURN_MS = 620;

export interface PageTurn<T> {
  readonly from: T;
  readonly to: T;
  /** Toward a later chapter: the right-hand page turns over to the left. */
  readonly forward: boolean;
  /** One page instead of a spread (narrow screens). */
  readonly single: boolean;
  /** The spread's box inside the cover, in px. */
  readonly box: { readonly top: number; readonly left: number; readonly width: number; readonly height: number };
}

interface RulesPageTurnProps<T> {
  readonly turn: PageTurn<T>;
  /** The spread's content for a chapter (running head and entries). */
  readonly page: (tab: T) => ReactNode;
  readonly onDone: () => void;
}

export function RulesPageTurn<T>({ turn, page, onDone }: RulesPageTurnProps<T>) {
  const { from, to, forward, single, box } = turn;
  const half = single ? 0 : box.width / 2;
  // A full-size copy of the spread, shifted so the face shows the half it stands over.
  const copy = (tab: T, shift: number) => (
    <div className="rules-spread rules-turn-page" style={{ width: box.width, height: box.height, left: -shift }}>
      {page(tab)}
    </div>
  );
  const leaf = single ? 'single' : forward ? 'forward' : 'back';
  return (
    <div className={`rules-turn ${leaf}`} style={{ ...box, '--turn-ms': `${PAGE_TURN_MS}ms` } as CSSProperties} aria-hidden="true">
      {!single && <div className={`rules-turn-hold ${forward ? 'left' : 'right'}`}>{copy(from, forward ? 0 : half)}</div>}
      <div className="rules-turn-leaf" onAnimationEnd={(e) => e.target === e.currentTarget && onDone()}>
        <div className="rules-turn-face front">{copy(from, forward && !single ? half : 0)}</div>
        <div className="rules-turn-face back">{!single && copy(to, forward ? 0 : half)}</div>
      </div>
    </div>
  );
}
