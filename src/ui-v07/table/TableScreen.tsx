import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RULES_V07, type Goods, type IslandId, type PlayerId, type ShipId } from '../../v07/game';
import { ISLAND_LABELS, VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT } from '../labels';
import { eventLine } from '../log';
import type { GameSession } from '../session/gameSession';
import { usePlayback } from '../session/usePlayback';
import { DeployForm } from './DeployForm';
import { InvestForm } from './InvestForm';
import { IslandForm } from './IslandForm';
import { MarketPanel } from './MarketPanel';
import { PlayersPanel } from './PlayersPanel';
import { RerollForm } from './RerollForm';
import { ResultPanel } from './ResultPanel';
import { ShipsPanel } from './ShipsPanel';
import { Card } from './parts';
import type { FormProps } from './forms';

const PHASE_LABELS = { 'island-choice': '選島', invest: '投資', 'role-deployment': '部署角色', 'intel-reroll': '情報重擲' } as const;

interface TableScreenProps {
  readonly session: GameSession;
  readonly onExit: () => void;
}

/**
 * The playable table, first version: plain panels (market, warehouses, ships) and one decision
 * panel. The tabletop scene replaces the panels in later sub-stages (docs/v07-migration-plan.md 5c).
 */
export function TableScreen({ session, onExit }: TableScreenProps) {
  const playback = usePlayback(session);
  const { snapshot, board, played, request, view, activeView, holding, caughtUp } = playback;
  const [logOpen, setLogOpen] = useState(false);
  const actRef = useRef<HTMLElement>(null);

  const order = useMemo(() => snapshot.players.map((p) => p.id), [snapshot.players]);
  const names = useMemo(() => new Map(snapshot.players.map((p) => [p.id, p.name])), [snapshot.players]);
  const nameOf = useCallback((id: PlayerId) => names.get(id) ?? id, [names]);
  const viewerId = view?.playerId ?? null;

  // Only the visible seat's own cargo (private, §4); hot-seat hides it between turns (view is null).
  const myCargo = useMemo(() => {
    const cargo: Record<ShipId, Goods> = {};
    for (const s of view?.ships ?? []) if (s.owner === view?.playerId && s.cargo) cargo[s.id] = s.cargo;
    for (const e of playback.privateNotes) if (e.type === 'cargo-loaded') cargo[e.shipId] = e.cargo;
    return cargo;
  }, [view, playback.privateNotes]);

  const shipOwnerName = useCallback(
    (id: ShipId) => {
      const ship = played.flatMap((e) => (e.type === 'ships-launched' ? e.ships : [])).find((s) => s.id === id);
      return ship ? `${nameOf(ship.owner)}的船` : id;
    },
    [played, nameOf],
  );
  const logLines = useMemo(
    () => played.flatMap((e) => eventLine(e, { nameOf, shipOf: shipOwnerName })?.split('\n') ?? []),
    [played, nameOf, shipOwnerName],
  );

  // A new decision brings the player back to the top of the decision panel (phones scroll a lot).
  const requestId = request?.id;
  useEffect(() => {
    actRef.current?.scrollTo?.({ top: 0 });
  }, [requestId]);

  const phase = request && activeView ? request.context.decision.phase : null;
  const formProps: FormProps | null =
    request && activeView ? { context: request.context, nameOf, onSubmit: playback.submit } : null;
  const waitingNames = playback.waiting.map(nameOf);

  return (
    <div className="v7-table">
      <header className="v7-top">
        <div className="v7-title">
          <strong>{board.round === 0 ? '選島' : `第 ${board.round} / ${RULES_V07.rounds} 回合`}</strong>
          {phase && <span className="v7-phase">{PHASE_LABELS[phase]}</span>}
        </div>
        {board.voyageEvent && (
          <span className="v7-event" title={VOYAGE_EVENT_TEXT[board.voyageEvent]}>
            航海事件：{VOYAGE_EVENT_LABELS[board.voyageEvent]}（{VOYAGE_EVENT_TEXT[board.voyageEvent]}）
          </span>
        )}
        <div className="v7-top-actions">
          {!caughtUp && !holding && (
            <button className="v7-btn" onClick={playback.skip}>
              略過演出 ▶▶
            </button>
          )}
          <button className="v7-btn" aria-expanded={logOpen} onClick={() => setLogOpen(!logOpen)}>
            航海日誌
          </button>
          <button className="v7-btn" onClick={onExit}>
            離開
          </button>
        </div>
      </header>

      {board.round > 0 && <MarketPanel prices={board.prices} demand={board.demand} settlement={board.settlement} compact />}

      <div className="v7-body">
        <aside className="v7-info">
          <Card title="商會">
            <PlayersPanel board={board} order={order} nameOf={nameOf} viewerId={viewerId} waiting={playback.waiting} />
          </Card>
          {board.round > 0 && (
            <Card title="本回合的船">
              <ShipsPanel board={board} nameOf={nameOf} myCargo={myCargo} viewerId={viewerId} />
            </Card>
          )}
        </aside>

        <main className="v7-act" ref={actRef}>
          {holding && (
            <Card title={`第 ${board.round} 回合結束`}>
              <p className="v7-muted">看一下結算結果，準備好了就進入下一回合。</p>
              <button className="v7-primary" onClick={playback.release}>
                進入下一回合
              </button>
            </Card>
          )}

          {request && activeView && formProps && (
            <Card title={`${PHASE_LABELS[request.context.decision.phase]}${viewerId ? `・${nameOf(viewerId)}` : ''}`}>
              {phase === 'island-choice' && <IslandForm key={request.id} {...formProps} />}
              {phase === 'invest' && <InvestForm key={request.id} {...formProps} />}
              {phase === 'role-deployment' && <DeployForm key={request.id} {...formProps} />}
              {phase === 'intel-reroll' && <RerollForm key={request.id} {...formProps} />}
            </Card>
          )}

          {caughtUp && !request && snapshot.status === 'running' && !playback.handoffTo && (
            <Card title="等待中">
              <p className="v7-muted">{waitingNames.length > 0 ? `等待 ${waitingNames.join('、')} 決定…` : '結算中…'}</p>
            </Card>
          )}

          {!caughtUp && !holding && <p className="v7-muted v7-playing">演出中…</p>}

          {view && (
            <Card title="只有你知道" className="v7-private">
              <PrivateNotes view={view} island={board.players[view.playerId]?.island ?? null} notes={playback.privateNotes} nameOf={nameOf} />
            </Card>
          )}

          {caughtUp && snapshot.result && <ResultPanel result={snapshot.result} nameOf={nameOf} onRestart={onExit} />}
          {snapshot.error && <p className="v7-error">對局發生錯誤：{snapshot.error}</p>}
        </main>
      </div>

      {logOpen && (
        <aside className="v7-log" aria-label="航海日誌">
          <button className="v7-btn close" onClick={() => setLogOpen(false)}>
            收起
          </button>
          <ol>
            {logLines.map((line, i) => (
              <li key={i} className={line.startsWith('──') ? 'round' : ''}>
                {line}
              </li>
            ))}
          </ol>
        </aside>
      )}

      {playback.handoffTo && (
        <div className="v7-handoff">
          <div>
            <p>請將裝置交給</p>
            <h1>{nameOf(playback.handoffTo)}</h1>
            <p className="v7-muted">其他玩家請勿偷看。</p>
            <button className="v7-primary" onClick={playback.confirmHandoff}>
              我是 {nameOf(playback.handoffTo)}，開始
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrivateNotes({
  view,
  island,
  notes,
  nameOf,
}: {
  readonly view: NonNullable<ReturnType<typeof usePlayback>['view']>;
  readonly island: IslandId | null;
  readonly notes: ReturnType<typeof usePlayback>['privateNotes'];
  readonly nameOf: (id: PlayerId) => string;
}) {
  const intel = notes.flatMap((n) => (n.type === 'intel-report' || n.type === 'intel-reroll-result' ? [n] : []));
  const ownerOf = (shipId: ShipId) => nameOf(view.ships.find((s) => s.id === shipId)?.owner ?? '');
  return (
    <div className="v7-private-body">
      <p>
        你的島：<b>{island ? ISLAND_LABELS[island] : '尚未選定'}</b>
      </p>
      {intel.length === 0 ? (
        <p className="v7-muted">你的貨、情報骰值只會出現在這裡。</p>
      ) : (
        <ul>
          {intel.map((n, i) => (
            <li key={i}>
              {ownerOf(n.shipId)}的船：{n.type === 'intel-report' ? `原始骰值 ${n.rawRoll}` : `重擲後 ${n.rerolledRoll}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
