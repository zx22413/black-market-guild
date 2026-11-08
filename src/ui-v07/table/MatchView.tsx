import { Suspense, lazy } from 'react';
import { useMatchAnalytics } from '../analytics/useMatchAnalytics';
import type { GameSession } from '../session/gameSession';
import type { Rematch } from '../table3d/ResultCard';
import { TableScreen } from './TableScreen';

// The match screen: the 3D table (loaded on demand, it is the heavy part of the app), or the plain
// panel version with ?ui=panel — kept as a fallback (phones, debugging) until the 3D table also
// covers phone layouts.

const Table3DScreen = lazy(() => import('../table3d/Table3DScreen').then((m) => ({ default: m.Table3DScreen })));

const panelUi = (): boolean => new URLSearchParams(location.search).get('ui') === 'panel';

const LOADING_STYLE = { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#10242b', color: '#f1ead8', fontSize: 18, letterSpacing: '0.1em' } as const;

interface MatchViewProps {
  readonly session: GameSession;
  readonly onExit: () => void;
  readonly rematch?: Rematch | undefined;
  /** Online rooms: the resolution's presses go on by themselves after this many seconds. */
  readonly autoAdvanceSeconds?: number;
  /** Online spectator stand: the table plays itself, with no presses to wait for and nothing counted. */
  readonly spectator?: boolean;
  /** Online: told while the table still replays a round the room has already decided. */
  readonly onReplaying?: (replaying: boolean) => void;
}

export function MatchView({ session, onExit, rematch, autoAdvanceSeconds, spectator = false, onReplaying }: MatchViewProps) {
  const { onReady } = useMatchAnalytics(session, !spectator);
  if (panelUi()) return <TableScreen session={session} onExit={onExit} />;
  return (
    <Suspense fallback={<div style={LOADING_STYLE}>整理港口中…</div>}>
      <Table3DScreen session={session} onExit={onExit} rematch={rematch} onReady={onReady} spectator={spectator} {...(onReplaying === undefined ? {} : { onReplaying })} {...(autoAdvanceSeconds === undefined ? {} : { autoAdvanceSeconds })} />
    </Suspense>
  );
}
