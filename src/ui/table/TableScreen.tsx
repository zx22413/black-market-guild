import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { RULES_V06, type Action, type Deployment, type PlayerId, type RoleId, type ShipId } from '../../game';
import { EventLog } from '../components/EventLog';
import { uiArtVars } from '../art';
import { Icon } from '../components/Icon';
import { PrivateNotes } from '../components/PrivateNotes';
import { TableScene } from '../scene/TableScene';
import type { IntelTrace } from '../scene/dieSteps';
import { buildSceneTable } from '../scene/tableModel';
import { devWeatherOverride } from '../scene/weather';
import { HandoffScreen } from '../screens/HandoffScreen';
import { ResultScreen } from '../screens/ResultScreen';
import type { GameSession } from '../session/gameSession';
import { usePlayback } from '../session/usePlayback';
import { DecisionDock } from './DecisionDock';
import { PartnerCard, useAssetInspection } from './PartnerCard';
import { partnerChoice, type PartnerPick } from './partnerChoice';
import { EventBand, LedgerCard } from './TableHud';
import { useCashFloats } from './useCashFloats';
import { useRecruitShow } from './useRecruitShow';
import './table.css';
import './hudSkin.css';

const DEV_WEATHER = import.meta.env.DEV ? devWeatherOverride(window.location.search) : null;

interface TableScreenProps {
  readonly session: GameSession;
  readonly onExit: () => void;
}

/** The playable 3D table: the scene fills the screen, controls sit in its corners. */
export function TableScreen({ session, onExit }: TableScreenProps) {
  const playback = usePlayback(session);
  const { snapshot, board, played, request, view, activeView, holding, caughtUp } = playback;
  const [role, setRole] = useState<RoleId | null>(null);
  const [ship, setShip] = useState<ShipId | null>(null);
  const [noDeploy, setNoDeploy] = useState(false);
  // Roles the humans at this screen locked this round, kept so each can see their own card on their island.
  const [lockedRoles, setLockedRoles] = useState<ReadonlyMap<PlayerId, Deployment & { readonly round: number }>>(new Map());
  const [partner, setPartner] = useState<PartnerPick | null>(null);
  const inspection = useAssetInspection();
  const [logOpen, setLogOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const floats = useCashFloats(played);
  const markReady = useCallback(() => setReady(true), []);

  const names = useMemo(() => new Map(snapshot.players.map((p) => [p.id, p.name])), [snapshot.players]);
  const nameOf = useCallback((id: PlayerId) => names.get(id) ?? id, [names]);
  const playerIds = useMemo(() => snapshot.players.map((p) => p.id), [snapshot.players]);
  const fx = useRecruitShow(played, playerIds);
  // Spectators see the table from the first seat, with every guild's public tag.
  const viewerId = view?.playerId ?? null;
  // Hot-seat: keep facing the last player between turns; the table turns only once the next
  // player has confirmed, instead of swinging back to the first seat in between.
  const [facingId, setFacingId] = useState<PlayerId | null>(null);
  useEffect(() => {
    if (viewerId !== null) setFacingId(viewerId);
  }, [viewerId]);
  const rules = view?.rules ?? RULES_V06;
  const table = useMemo(
    () => buildSceneTable(board, snapshot.players, viewerId, rules, viewerId ?? facingId),
    [board, snapshot.players, viewerId, rules, facingId],
  );
  // The viewer's own intel reports this round, replayed on the ship tag at resolution.
  const intel = useMemo(() => {
    const traces = new Map<ShipId, IntelTrace>();
    for (const note of playback.privateNotes) {
      if (note.type === 'intel-report') traces.set(note.shipId, { raw: note.rawRoll, rerolled: null });
      if (note.type === 'intel-reroll-result') {
        const seen = traces.get(note.shipId);
        if (seen) traces.set(note.shipId, { ...seen, rerolled: note.rerolledRoll });
      }
    }
    return traces;
  }, [playback.privateNotes]);
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

  // A new decision starts with nothing picked, so a stale pick never carries into the next phase.
  const requestId = request?.id;
  const { reset: resetInspection, close: closeInspection } = inspection;
  useEffect(() => {
    setShip(null);
    setNoDeploy(false);
    setPartner(null);
    resetInspection();
  }, [requestId, resetInspection]);
  const pickedId = partner?.kind === 'player' ? partner.id : null;
  useEffect(closeInspection, [pickedId, closeInspection]);
  const candidates = useMemo(() => (request && activeView ? (partnerChoice(request.context)?.candidates ?? []) : []), [request, activeView]);
  const partnerPhase = request?.context.decision.phase === 'pick' ? 'pick' : 'apply';
  const selectableIslands = useMemo(() => new Set<PlayerId>(candidates), [candidates]);

  const chooseRole = (next: RoleId | null) => {
    setRole(next);
    setShip(null);
    setNoDeploy(false);
  };
  const chooseNoDeploy = () => {
    setRole(null);
    setShip(null);
    setNoDeploy(true);
  };
  const submit = (action: Action) => {
    if (action.type === 'deploy-role' && action.role && action.targetShipId) {
      const locked = { playerId: action.playerId, role: action.role, targetShipId: action.targetShipId, round: board.round };
      setLockedRoles((current) => new Map([...current, [action.playerId, locked]]));
    }
    setRole(null);
    setShip(null);
    setNoDeploy(false);
    setPartner(null);
    playback.submit(action);
  };
  const selectShip = (shipId: ShipId) => {
    if (selectableShips.has(shipId)) setShip(shipId);
  };

  const viewerSeat = table.seats.find((s) => s.isViewer);
  // Only the seat whose private view is on screen sees its own locked role (hot-seat hides it between turns).
  const myLocked = view ? lockedRoles.get(view.playerId) : undefined;
  const secretRole = myLocked && myLocked.round === board.round ? myLocked : null;
  return (
    <div className="scene-root" style={uiArtVars() as CSSProperties}>
      <TableScene
        table={table}
        weather={DEV_WEATHER ?? board.voyageEvent}
        nameOf={nameOf}
        selectableShips={selectableShips}
        onSelectShip={selectShip}
        selectedShip={ship}
        selectableIslands={selectableIslands}
        selectedIsland={partner?.kind === 'player' ? partner.id : null}
        onSelectIsland={(id) => setPartner({ kind: 'player', id })}
        islandCard={(() => {
          const seat = table.seats.find((s) => s.id === pickedId);
          return seat ? <PartnerCard seat={seat} rules={rules} phase={partnerPhase} viewerAssets={viewerSeat?.assets ?? []} inspection={inspection} /> : null;
        })()}
        secret={activeView?.myDeployment ?? null}
        secretRole={secretRole}
        intel={intel}
        submitted={activeView?.submittedPlayerIds ?? []}
        floats={floats}
        fx={fx}
        recruitResolved={board.recruitResolved}
        rankStep={played.filter((e) => e.type === 'round-ended').length}
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

      {viewerSeat && (
        <LedgerCard seat={viewerSeat} blackMoney={view?.myBlackMoney ?? 0} />
      )}

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
            describeShip={describeShip}
            role={role}
            onRole={chooseRole}
            ship={ship}
            onShip={selectShip}
            noDeploy={noDeploy}
            onNoDeploy={chooseNoDeploy}
            onSubmit={submit}
            seats={table.seats}
            partner={partner}
            onPartner={setPartner}
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
