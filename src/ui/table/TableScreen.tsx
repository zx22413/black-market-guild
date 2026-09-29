import { useCallback, useMemo, useState } from 'react';
import { RULES_V06, type Action, type PlayerId, type RoleId, type ShipId } from '../../game';
import { EventLog } from '../components/EventLog';
import { Icon } from '../components/Icon';
import { PrivateNotes } from '../components/PrivateNotes';
import { MARKET_EVENT_LABELS } from '../labels';
import { TableScene } from '../scene/TableScene';
import { buildSceneTable } from '../scene/tableModel';
import { HandoffScreen } from '../screens/HandoffScreen';
import { ResultScreen } from '../screens/ResultScreen';
import type { GameSession } from '../session/gameSession';
import { usePlayback } from '../session/usePlayback';
import { DecisionDock } from './DecisionDock';
import { CashBadge, EventBand } from './TableHud';
import './table.css';

interface TableScreenProps {
  readonly session: GameSession;
  readonly onExit: () => void;
}

/** The playable 3D table: the scene fills the screen, controls sit in its corners. */
export function TableScreen({ session, onExit }: TableScreenProps) {
  const playback = usePlayback(session);
  const { snapshot, board, played, request, view, activeView, holding, caughtUp } = playback;
  const [role, setRole] = useState<RoleId | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  const names = useMemo(() => new Map(snapshot.players.map((p) => [p.id, p.name])), [snapshot.players]);
  const nameOf = useCallback((id: PlayerId) => names.get(id) ?? id, [names]);
  // Spectators see the table from the first seat, with every guild's public tag.
  const viewerId = view?.playerId ?? null;
  const table = useMemo(() => buildSceneTable(board, snapshot.players, viewerId), [board, snapshot.players, viewerId]);
  const describeShip = useCallback(
    (id: ShipId) => {
      const ship = board.ships.find((s) => s.id === id);
      return ship ? `${ship.owners.map(nameOf).join('＋')}的${ship.kind === 'joint' ? '合資船' : '船'}` : id;
    },
    [board.ships, nameOf],
  );

  const deploying = request?.context.decision.phase === 'role-deployment' && activeView !== null;
  const selectableShips = useMemo(() => {
    if (!deploying || role === null) return new Set<ShipId>();
    return new Set(
      request.context.legalActions.flatMap((a) => (a.type === 'deploy-role' && a.role === role && a.targetShipId ? [a.targetShipId] : [])),
    );
  }, [deploying, role, request]);

  const submit = (action: Action) => {
    setRole(null);
    playback.submit(action);
  };
  const selectShip = (shipId: ShipId) => {
    const action = request?.context.legalActions.find((a) => a.type === 'deploy-role' && a.role === role && a.targetShipId === shipId);
    if (action) submit(action);
  };

  const rules = view?.rules ?? RULES_V06;
  const viewerSeat = table.seats.find((s) => s.isViewer);
  return (
    <div className="scene-root">
      <TableScene
        table={table}
        weather={board.voyageEvent}
        notice={board.marketEvent ? MARKET_EVENT_LABELS[board.marketEvent] : null}
        nameOf={nameOf}
        selectableShips={selectableShips}
        onSelectShip={selectShip}
        secret={activeView?.myDeployment ?? null}
        submitted={activeView?.submittedPlayerIds ?? []}
        onReady={markReady}
      />
      {!ready && <div className="scene-loading">整理港口中…</div>}

      <EventBand round={board.round} rules={rules} marketEvent={board.marketEvent} voyageEvent={board.voyageEvent} />

      <div className="hud hud-top-right">
        {!caughtUp && !holding && (
          <button className="hud-button" onClick={playback.skip}>
            略過演出 ▶▶
          </button>
        )}
        <button className="hud-icon-button" aria-label="航海日誌" title="航海日誌" onClick={() => setLogOpen(!logOpen)}>
          <Icon name="asset-insurance" size={24} />
        </button>
        <button className="hud-button" onClick={onExit}>
          離開
        </button>
      </div>

      {viewerSeat && <CashBadge name={viewerSeat.name} cash={viewerSeat.cash} blackMoney={view?.myBlackMoney ?? 0} />}

      <div className="hud hud-private">
        <PrivateNotes events={playback.privateNotes} describeShip={describeShip} />
      </div>

      <div className="hud hud-dock">
        {holding && (
          <div className="action-pill">
            <span>第 {board.round} 回合結束</span>
            <button className="primary" onClick={playback.release}>
              進入下一回合
            </button>
          </div>
        )}
        {request && activeView && (
          <DecisionDock
            key={request.id}
            context={request.context}
            nameOf={nameOf}
            describeShip={describeShip}
            role={role}
            onRole={setRole}
            onSubmit={submit}
          />
        )}
        {caughtUp && !request && snapshot.status === 'running' && (
          <div className="action-pill">
            <span>等待其他商會決定…</span>
          </div>
        )}
      </div>

      {logOpen && (
        <aside className="log-drawer">
          <button className="hud-button close" onClick={() => setLogOpen(false)}>
            收起
          </button>
          <EventLog events={played} names={names} startingCash={snapshot.startingCash} />
        </aside>
      )}

      {caughtUp && snapshot.result && (
        <div className="result-overlay">
          <ResultScreen result={snapshot.result} nameOf={nameOf} onRestart={onExit} />
        </div>
      )}
      {snapshot.error && <div className="result-overlay error">對局發生錯誤：{snapshot.error}</div>}
      {/* Covers the table instead of replacing it, so the 3D scene is not rebuilt on every turn. */}
      {playback.handoffTo && (
        <div className="handoff-overlay">
          <HandoffScreen playerName={nameOf(playback.handoffTo)} onReady={playback.confirmHandoff} />
        </div>
      )}
    </div>
  );
}
