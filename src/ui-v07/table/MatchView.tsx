import { Suspense, lazy } from 'react';
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
}

export function MatchView({ session, onExit, rematch }: MatchViewProps) {
  if (panelUi()) return <TableScreen session={session} onExit={onExit} />;
  return (
    <Suspense fallback={<div style={LOADING_STYLE}>整理港口中…</div>}>
      <Table3DScreen session={session} onExit={onExit} rematch={rematch} />
    </Suspense>
  );
}
