import { Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { TutorialScript } from '../../v07/tutorial';
import { startTutorialSession } from '../session/tutorialSession';
import { CoachCard, type CoachEndAction } from './CoachCard';
import { FocusMask } from './FocusMask';
import { markLessonDone } from './progress';
import './tutorial.css';

// One lesson on the ordinary 3D table, with the host's card beside it. Remounted (by key) to replay.

const Table3DScreen = lazy(() => import('../table3d/Table3DScreen').then((m) => ({ default: m.Table3DScreen })));

const LOADING_STYLE = { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#10242b', color: '#f1ead8', fontSize: 18, letterSpacing: '0.1em' } as const;

interface TutorialScreenProps {
  readonly script: TutorialScript;
  /** The lesson after this one, if any. */
  readonly next: TutorialScript | null;
  readonly onReplay: () => void;
  readonly onNext: () => void;
  readonly onExit: () => void;
}

export function TutorialScreen({ script, next, onReplay, onNext, onExit }: TutorialScreenProps) {
  const session = useMemo(() => startTutorialSession(script), [script]);
  const coach = useSyncExternalStore(session.subscribe, session.getCoach);
  // The host waits for the table: nothing to point at while it loads.
  const [ready, setReady] = useState(false);
  // Your decision is on the table, but out of reach until the host's steps before it are read
  // (the last step ends the lesson: the table may be looked at freely).
  const blocking = ready && coach.holdsDecision && coach.step !== null && coach.number < coach.total;
  // The last step ends the lesson, whatever moment it belongs to.
  const ended = coach.step !== null && coach.number === coach.total;

  useEffect(() => {
    if (ended) markLessonDone(script.id);
  }, [ended, script.id]);

  const endActions: CoachEndAction[] = [
    { label: '再玩一次', onClick: onReplay },
    { label: '回教學選單', onClick: onExit, ...(next ? {} : { primary: true }) },
    ...(next ? [{ label: `下一課：${next.title}`, primary: true, onClick: onNext }] : []),
  ];

  return (
    <>
      <Suspense fallback={<div style={LOADING_STYLE}>整理港口中…</div>}>
        <Table3DScreen
          session={session}
          onExit={onExit}
          showResult={false}
          rounds={script.rules.rounds}
          onShown={session.setShown}
          skipIslandReveal={!script.showIslandReveal}
          islandMarks
          onReady={() => setReady(true)}
          onDraft={session.setDraft}
        />
      </Suspense>
      {ready && (
        <>
          {blocking && <div className="coach-block" aria-hidden="true" />}
          <FocusMask targets={coach.focus} pulse={coach.pulse} />
          <CoachCard view={coach} onRead={session.read} onSkip={onExit} endActions={endActions} />
        </>
      )}
    </>
  );
}
