import { useEffect, useMemo, useState } from 'react';
import type { PlayerId } from '../../../v07/game';
import { TRAILER } from '../../../v07/tutorial';
import { startTutorialSession } from '../../session/tutorialSession';
import { Table3DScreen } from '../../table3d/Table3DScreen';
import { CURSOR_TRAVEL, autoClick, type ClickStep, type CursorMove } from './autoClick';
import { mark, markReady } from './director';

// The trailer's match (/v07.html?dev=trailer&part=game): the real table playing the TRAILER
// script (src/v07/tutorial/trailer.ts), your two decisions clicked by a visible cursor. The
// capture films it and notes the moments the edit cuts to.

const STEPS: readonly ClickStep[] = [
  // Round 1: load wood and spice, seal it.
  { selector: '[data-crate="wood"]', wait: 900, mark: 'invest-wood' },
  { selector: '[data-crate="spice"]', wait: 250, mark: 'invest-spice' },
  { selector: '[data-focus="submit"]', wait: 350, mark: 'invest-seal', last: true },
  // Round 2: your guard on your own ship, sealed.
  { selector: '[data-role-card="guard"]', wait: 900, mark: 'deploy-guard' },
  { selector: '[data-target="p1"]', wait: 250, mark: 'deploy-target' },
  { selector: '[data-focus="submit"]', wait: 350, mark: 'deploy-seal', last: true },
];

/** The presses of the resolution (「開始航程」, the bill) go on by themselves after this long. */
const AUTO_ADVANCE_SECONDS = 2;

function Cursor({ move }: { readonly move: CursorMove | null }) {
  if (!move) return null;
  return (
    <svg
      className={`trailer-cursor ${move.pressed ? 'pressed' : ''} ${move.hidden ? 'hidden' : ''}`}
      style={{ transform: `translate(${move.x}px, ${move.y}px)`, transitionDuration: `${CURSOR_TRAVEL}ms` }}
      width="34"
      height="40"
      viewBox="0 0 17 20"
      aria-hidden="true"
    >
      <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill="#fff" stroke="#1b1b1b" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function TrailerGame() {
  const session = useMemo(() => startTutorialSession(TRAILER), []);
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState<CursorMove | null>(null);
  useEffect(() => {
    if (!ready) return undefined;
    markReady();
    return autoClick(STEPS, setCursor);
  }, [ready]);
  return (
    <>
      <Table3DScreen
        session={session}
        onExit={() => undefined}
        showResult={false}
        rounds={TRAILER.rules.rounds}
        skipIslandReveal
        skipIslandMoments
        autoAdvanceSeconds={AUTO_ADVANCE_SECONDS}
        onReady={() => setReady(true)}
        onMarket={(round) => mark(`market-${round}`)}
        onStarted={(round) => mark(`resolution-${round}`)}
        onVoyage={(round: number, owner: PlayerId) => mark(`voyage-${round}-${owner}`)}
        onShown={(round, ended) => mark(ended ? 'ended' : `shown-${round}`)}
      />
      <Cursor move={cursor} />
    </>
  );
}
