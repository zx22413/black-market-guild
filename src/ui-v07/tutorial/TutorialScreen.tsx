import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { TutorialScript } from '../../v07/tutorial';
import { startTutorialSession } from '../session/tutorialSession';
import { DieDiagram } from './DieDiagram';
import { CoachCard, type CoachEndAction } from './CoachCard';
import { FocusMask } from './FocusMask';
import { placeCard, type Hole } from './focus';
import { markLessonDone } from './progress';
import { track } from '../analytics/track';
import './tutorial.css';

// One lesson on the ordinary 3D table, with the host's card beside it. Remounted (by key) to replay.

const Table3DScreen = lazy(() => import('../table3d/Table3DScreen').then((m) => ({ default: m.Table3DScreen })));

/** The card keeps clear of the screen edges, the menu bar on top and the decision bar below. */
const CARD_MARGIN = { side: 16, top: 64, bottom: 110 };
/** On a phone the card may also sit over the decision bar: while a step is read, the table behind it is not pressable anyway. */
const CARD_MARGIN_PHONE = { side: 16, top: 56, bottom: 16 };

/** Pictures the lesson puts up that the host's card must not cover (besides what is lit). */
const KEEP_CLEAR = '.die-diagram, .event-card';
/** Room left between the host's card and those pictures, in px. */
const CLEAR_GAP = 8;

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
  // While a step is read, only 「下一步」 can be pressed: the table (your decision, 「繼續」, …) is out
  // of reach, so nothing else lit invites a click. The last step ends the lesson: the table is free.
  const blocking = ready && coach.step !== null && coach.number < coach.total;
  // A click on the blocked table makes 「下一步」 wave, to show what to press.
  const [nudge, setNudge] = useState(0);

  // The host's card moves to a corner that does not cover what is lit, nor the pictures the lesson
  // itself puts up in the middle of the table (the die diagram, the voyage event card).
  const card = useRef<HTMLElement>(null);
  const [spot, setSpot] = useState<CSSProperties>({});
  const lit = useRef<readonly Hole[]>([]);
  const place = useCallback(() => {
    const el = card.current;
    if (!el) return;
    const covered = [...document.querySelectorAll<HTMLElement>(KEEP_CLEAR)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    const holes = [...lit.current, ...covered.map((r): Hole => ({ x: r.left - CLEAR_GAP, y: r.top - CLEAR_GAP, width: r.width + 2 * CLEAR_GAP, height: r.height + 2 * CLEAR_GAP }))];
    const at = placeCard(holes, { width: window.innerWidth, height: window.innerHeight }, { width: el.offsetWidth, height: el.offsetHeight }, window.innerWidth <= 640 ? CARD_MARGIN_PHONE : CARD_MARGIN);
    setSpot((s) => (s.left === at.left && s.top === at.top ? s : { left: at.left, top: at.top }));
  }, []);
  const onHoles = useCallback(
    (holes: readonly Hole[]) => {
      lit.current = holes;
      place();
    },
    [place],
  );
  // Those pictures come and go (and animate in): look again a few times a second.
  useEffect(() => {
    if (!ready) return undefined;
    place();
    const timer = setInterval(place, 250);
    window.addEventListener('resize', place);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', place);
    };
  }, [ready, place, coach.step]);
  // The last step ends the lesson, whatever moment it belongs to.
  const ended = coach.step !== null && coach.number === coach.total;

  useEffect(() => {
    if (ended) markLessonDone(script.id);
  }, [ended, script.id]);

  // Statistics: the lesson's start, its end (with the time it took), or the step it was left at.
  const lessonStats = useRef({ startedAt: Date.now(), ended: false, step: 0 });
  lessonStats.current.step = coach.number;
  useEffect(() => {
    track('tutorial_start', { lesson: script.id });
    const stats = lessonStats.current;
    return () => {
      if (!stats.ended) track('tutorial_quit', { lesson: script.id, step: stats.step });
    };
  }, [script.id]);
  useEffect(() => {
    if (!ended || lessonStats.current.ended) return;
    lessonStats.current.ended = true;
    track('tutorial_done', { lesson: script.id, seconds: Math.round((Date.now() - lessonStats.current.startedAt) / 1000) });
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
          skipIslandMoments={!script.showIslandReveal}
          islandMarks
          onReady={() => setReady(true)}
          onDraft={session.setDraft}
          onMarket={session.setMarket}
          onStarted={session.setStarted}
          onCalm={session.setCalm}
          onVoyage={session.setVoyage}
          holdVoyage={coach.holdsVoyage}
          holdShow={coach.holdsShow}
          holdMarket={coach.holdsMarket}
          holdEvent={coach.holdsEvent}
          lockSkips
          hideEvent={coach.step?.diagram !== undefined}
        />
      </Suspense>
      {ready && (
        <>
          {blocking && <div className="coach-block" aria-hidden="true" onPointerDown={() => setNudge((n) => n + 1)} />}
          <FocusMask solid={coach.step?.diagram !== undefined} targets={coach.focus} guide={coach.guide} pulse={coach.pulse} onHoles={onHoles} />
          {coach.step?.diagram && <DieDiagram successMin={coach.step.diagram.successMin} dieMax={coach.step.diagram.dieMax} />}
          <CoachCard ref={card} style={spot} view={coach} onRead={session.read} onSkip={onExit} endActions={endActions} nudge={nudge} />
        </>
      )}
    </>
  );
}
