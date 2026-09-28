import { useEffect, useMemo, useState } from 'react';
import { RULES_V06, type Action, type MatchEvent, type PlayerId, type PlayerView } from '../../game';
import { paintingUrl, type PaintingKey } from '../art';
import { DecisionPanel } from '../components/DecisionPanel';
import { RoundHeader } from '../components/EventCards';
import { EventLog } from '../components/EventLog';
import { Harbor } from '../components/Harbor';
import { PlayerBoard } from '../components/PlayerBoard';
import { PrivateNotes } from '../components/PrivateNotes';
import { buildBoard, type Board } from '../session/board';
import type { GameSession } from '../session/gameSession';
import { useSession } from '../session/useSession';
import { HandoffScreen } from './HandoffScreen';
import { ResultScreen } from './ResultScreen';

/** Milliseconds to linger on each event during playback. */
function eventDelay(event: MatchEvent): number {
  switch (event.type) {
    case 'phase-started':
    case 'round-ended':
      return 0;
    case 'cash-changed':
      return 150;
    default:
      return 450;
  }
}

/** Playback stops before each new round so the previous results can be read. */
const isHold = (event: MatchEvent | undefined): boolean => event?.type === 'round-started' && event.round > 1;

function backdrop(board: Board): PaintingKey {
  if (board.voyageEvent === 'storm') return 'storm';
  if (board.voyageEvent === 'high-waves') return 'high-waves';
  if (board.voyageEvent === 'moonless-night' || board.voyageEvent === 'sea-fog') return 'night-sea';
  if (board.voyageEvent === 'calm-seas' || board.voyageEvent === 'tailwind') return 'calm-sea';
  if (board.marketEvent === 'black-market-bounty') return 'battle';
  return board.launched ? 'merchant-ship' : 'harbor';
}

interface GameScreenProps {
  readonly session: GameSession;
  readonly onExit: () => void;
}

export function GameScreen({ session, onExit }: GameScreenProps) {
  const snapshot = useSession(session);
  const { events, players, requests, startingCash } = snapshot;
  const [cursor, setCursor] = useState(0);
  const [releasedHold, setReleasedHold] = useState(-1);
  const [confirmedSeat, setConfirmedSeat] = useState<PlayerId | null>(null);
  const [lastView, setLastView] = useState<PlayerView | null>(null);

  const humanSeats = players.filter((p) => p.kind === 'local-human');
  const hotSeat = humanSeats.length > 1;
  const names = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);
  const nameOf = (id: PlayerId) => names.get(id) ?? id;

  const holding = cursor < events.length && isHold(events[cursor]) && releasedHold !== cursor;
  const caughtUp = cursor >= events.length;

  useEffect(() => {
    const next = events[cursor];
    if (next === undefined || holding) return;
    const timer = setTimeout(() => setCursor(cursor + 1), eventDelay(next));
    return () => clearTimeout(timer);
  }, [cursor, events, holding]);

  const played = useMemo(() => events.slice(0, cursor), [events, cursor]);
  const board = useMemo(() => buildBoard(players.map((p) => p.id), startingCash, played), [players, startingCash, played]);

  const request = caughtUp ? requests[0] : undefined;
  const needsHandoff = request !== undefined && hotSeat && confirmedSeat !== request.context.decision.playerId;
  const activeView = request && !needsHandoff ? request.context.view : null;
  useEffect(() => {
    if (activeView) setLastView(activeView);
  }, [activeView]);
  // Hot-seat hides private information between turns; a single human keeps their own view.
  const view = activeView ?? (hotSeat ? null : lastView);

  const skip = () => {
    const nextHold = events.findIndex((e, i) => i > cursor && isHold(e));
    setReleasedHold(cursor);
    setCursor(nextHold === -1 ? events.length : nextHold);
  };

  const submit = (action: Action) => {
    if (!request) return;
    session.submit(request.id, action);
  };

  if (needsHandoff && request) {
    const seat = request.context.decision.playerId;
    return <HandoffScreen playerName={nameOf(seat)} onReady={() => setConfirmedSeat(seat)} />;
  }

  const rules = view?.rules ?? RULES_V06;
  const privateNotes = view
    ? snapshot.privateEvents.filter((e) => e.playerId === view.playerId && e.round === board.round)
    : [];
  const describeShip = (shipId: string) => {
    const ship = board.ships.find((s) => s.id === shipId);
    return ship ? `${ship.owners.map(nameOf).join(' ＋ ')}的${ship.kind === 'joint' ? '合資船' : '獨資船'}` : shipId;
  };
  return (
    <main className="game" style={{ backgroundImage: `url(${paintingUrl(backdrop(board))})` }}>
      <div className="game-toolbar">
        <button className="ghost" onClick={onExit}>
          離開對局
        </button>
        {!caughtUp && !holding && (
          <button className="ghost" onClick={skip}>
            略過演出 ▶▶
          </button>
        )}
      </div>
      <RoundHeader
        round={board.round}
        totalRounds={rules.rounds}
        marketEvent={board.marketEvent}
        voyageEvent={board.voyageEvent}
        rules={rules}
      />
      <div className="game-grid">
        <PlayerBoard
          players={players}
          board={board}
          viewerId={view?.playerId ?? null}
          blackMoney={view?.myBlackMoney ?? 0}
          submitted={activeView?.submittedPlayerIds ?? []}
        />
        <div className="center">
          <Harbor board={board} nameOf={nameOf} myDeployment={activeView?.myDeployment ?? null} />
          <PrivateNotes events={privateNotes} describeShip={describeShip} />
          {holding && (
            <section className="panel continue">
              <p>第 {board.round} 回合結束。</p>
              <button className="primary" onClick={() => setReleasedHold(cursor)}>
                進入下一回合
              </button>
            </section>
          )}
          {request && (
            <DecisionPanel key={request.id} context={request.context} board={board} nameOf={nameOf} onSubmit={submit} />
          )}
          {caughtUp && !request && snapshot.status === 'running' && (
            <section className="panel muted">等待其他商會決定…</section>
          )}
          {caughtUp && snapshot.result && <ResultScreen result={snapshot.result} nameOf={nameOf} onRestart={onExit} />}
          {snapshot.error && <section className="panel error">對局發生錯誤：{snapshot.error}</section>}
        </div>
        <EventLog events={played} names={names} startingCash={startingCash} />
      </div>
    </main>
  );
}
