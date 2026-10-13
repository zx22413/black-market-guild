import { useEffect, useMemo, useRef, useState } from 'react';
import { GOODS, type BuildingId, type GoodId, type PlayerId } from '../../v07/game';
import type { SeatConfig } from '../../v07/match';
import type { SafeArea } from '../../ui/scene/CameraRig';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { BUILDING_LABELS, BUILDING_TEXT, GOOD_LABELS, ISLAND_LABELS, stepLabel } from '../labels';
import { buildBoard, type Board } from '../session/board';
import { startGameSession, type GameSession } from '../session/gameSession';
import { useSession } from '../session/useSession';
import { beatSeats } from '../scene/beatStage';
import { around } from '../scene/focusMath';
import { BuildingPreview, ShipCargo, Warehouse, deckSlot, stackTop, warehouseLocal } from '../scene/InvestIsland';
import { TableCanvas, islandPoint, overviewPoints, platePosition, useTableLayout, type TablePin, type TableShip } from '../scene/TableCanvas';
import {
  EMPTY_CHOICE,
  NO_LOAD,
  actionFor,
  buildOptions,
  canBuildAny,
  canLoad,
  investNotes,
  investOptions,
  investSummary,
  investTodo,
  todoReminders,
  loadOne,
  stockSplit,
  submitLabel,
  unloadOne,
  withBuild,
  type InvestChoice,
} from '../table/investChoice';
import { ReminderDialog } from '../table/ReminderDialog';
import { isReminderSkipped, setReminderSkipped } from '../table/reminderSettings';

// Dev-only: the investment decision on your own island in 3D, at /v07.html?dev=invest3d (&seed=3).
// A real local match (you against three bots); the island draft is picked for you so the page
// opens on round 1's investment. After you submit, the builds and launches are revealed together.

const SEATS: SeatConfig[] = [
  { kind: 'local-human', name: '你' },
  { kind: 'bot', name: '黑潮會', strategy: 'aggressive' },
  { kind: 'bot', name: '金錨公會', strategy: 'balanced' },
  { kind: 'bot', name: '霧港商團', strategy: 'builder' },
];
/** The market strip above and the summary bar below stay clear of the table. */
const SAFE: SafeArea = { top: 70, bottom: 96, left: 24, right: 24 };

export function Invest3DPreview() {
  const seed = Number(new URLSearchParams(location.search).get('seed') ?? 3) || 3;
  const [run, setRun] = useState(0);
  const session = useMemo(() => startGameSession({ seed: seed + run, seats: SEATS }), [seed, run]);
  return <InvestStage key={run} session={session} onRestart={() => setRun((n) => n + 1)} />;
}

function MarketStrip({ board }: { readonly board: Board }) {
  return (
    <div className="inv-market">
      <b>黑市</b>
      {GOODS.map((g) => (
        <span key={g} className={`inv-chip good-${g}`}>
          {GOOD_LABELS[g]} {stepLabel(board.prices[g])} G · 需 {board.demand[g]}
        </span>
      ))}
      {board.wanted.length > 0 && <span className="inv-chip wanted">通緝中</span>}
    </div>
  );
}

function InvestStage({ session, onRestart }: { readonly session: GameSession; readonly onRestart: () => void }) {
  const snap = useSession(session);
  const request = snap.requests[0];
  const viewer: PlayerId = 'p1';

  // The island draft is not what this page tests: take the first offer.
  // StrictMode runs effects twice in development, so submit only while the request is still open.
  useEffect(() => {
    if (request?.context.decision.phase !== 'island-choice') return;
    if (session.getSnapshot().requests.some((r) => r.id === request.id)) session.submit(request.id, request.context.legalActions[0]!);
  }, [request, session]);

  const ids = snap.players.map((p) => p.id);
  const board = useMemo(() => buildBoard(ids, snap.startingCash, snap.events), [snap.events, snap.startingCash]);
  const names = Object.fromEntries(snap.players.map((p) => [p.id, p.name]));
  const seats = useMemo(
    () => beatSeats(snap.players, viewer, Object.fromEntries(ids.map((id) => [id, board.players[id]?.buildings ?? []]))),
    [snap.players, board],
  );
  const { angles, laneOf } = useTableLayout(seats);
  const home = angles[0]!;

  const investing = request?.context.decision.phase === 'invest' ? request : null;
  const context = investing?.context ?? null;
  const options = useMemo(() => (context ? investOptions(context) : []), [context]);
  const [choice, setChoice] = useState<InvestChoice>(EMPTY_CHOICE);
  const [picking, setPicking] = useState(false);
  // Picking a building or "不蓋" both count as dealing with the building; until then it glows.
  const [buildDecided, setBuildDecided] = useState(false);
  const [reminding, setReminding] = useState<readonly string[] | null>(null);
  const buildArea = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState<InvestChoice | null>(null);
  const [ready, setReady] = useState(false);
  const revealed = submitted !== null && board.launched;

  const me = board.players[viewer];
  const builds = context ? buildOptions(context, options) : [];
  const split = context ? stockSplit(context, choice) : null;
  const summary = context ? investSummary(context, choice) : null;
  const notes = context ? investNotes(context, choice) : [];
  const action = context ? actionFor(options, choice) : undefined;
  const todo = investTodo(options, choice, buildDecided);
  const send = () => {
    if (!investing || !action) return;
    setSubmitted(choice);
    setPicking(false);
    setReminding(null);
    session.submit(investing.id, action);
  };
  // Something left undone: remind once before submitting, unless the player turned it off.
  const submit = () => {
    const lines = todoReminders(todo);
    if (lines.length > 0 && !isReminderSkipped('invest-unfinished')) setReminding(lines);
    else send();
  };
  const pickBuild = (build: BuildingId | null) => {
    setChoice(withBuild(options, choice, build));
    setBuildDecided(true);
    setPicking(false);
  };

  // The building list closes on a click anywhere outside it (the table included).
  useEffect(() => {
    if (!picking) return;
    const close = (e: PointerEvent) => {
      if (!buildArea.current?.contains(e.target as Node)) setPicking(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [picking]);


  // Camera: your island and your ship while deciding; the whole table for the reveal.
  const deciding = context !== null && submitted === null;
  const [hx, , hz] = seatPosition(home);
  const dock = shipPose(home, 'docked').position;
  const cameraPoints = useMemo(
    () =>
      deciding
        ? // Medium shot: your island, your ship at the dock and the edge of the harbor beyond it.
          [...around([hx, 0, hz], PLAYER_ISLAND_RADIUS + 4), ...around([dock.x, 0, dock.z], 6), ...around([0, 0, 0], 6)]
        : overviewPoints(angles),
    [deciding, angles, hx, hz, dock.x, dock.z],
  );
  // Notes sit beside what they are about: the warehouse note on the outer side of the crate row,
  // the ship note beside the ship, never on top of them.
  const rowEnds = [islandPoint(home, [warehouseLocal(0)[0] - 1.6, 0, warehouseLocal(0)[2]]), islandPoint(home, [warehouseLocal(3)[0] + 1.6, 0, warehouseLocal(3)[2]])] as const;
  const leftEnd = rowEnds[0][0] < rowEnds[1][0] ? rowEnds[0] : rowEnds[1];

  const ships: TableShip[] = board.launched ? board.ships.map((s) => ({ id: s.id, owner: s.owner, state: 'docked' })) : [];
  const myShipLoad = submitted?.load ?? NO_LOAD;

  const waiting = new Set(context?.view.submittedPlayerIds ?? []);
  const pins: TablePin[] = seats.map((s, i) => {
    const p = board.players[s.id];
    const status = s.isViewer ? (submitted ? '已決定' : deciding ? '決定中' : '') : deciding ? (waiting.has(s.id) ? '已決定' : '思考中') : '';
    return {
      id: `seat-${s.id}`,
      position: platePosition(angles[i]!),
      node: (
        <span className="beat3d-plate inv-plate" style={{ borderColor: s.color }}>
          {s.isViewer ? '你' : s.name}
          {p?.island && <small> · {ISLAND_LABELS[p.island]}</small>}
          {!s.isViewer && p && (
            <span className="inv-stock">
              倉 {GOODS.filter((g) => p.stock[g] > 0).map((g) => `${GOOD_LABELS[g].slice(0, 1)}${p.stock[g]}`).join(' ') || '空'}
            </span>
          )}
          {status && <em className={status === '已決定' ? 'done' : ''}>{status}</em>}
          {board.wanted.includes(s.id) && <em className="wanted">緝</em>}
        </span>
      ),
    };
  });

  if (deciding && context && summary && split) {
    const left = me ? context.view.rules.buildings.maxPerPlayer - me.buildings.length : 0;
    pins.push({
      id: 'build',
      position: islandPoint(home, [0, 0, -2.5]),
      node: (
        <div className="inv-build" ref={buildArea}>
          <button type="button" className={`${choice.build ? 'on' : ''} ${todo.build ? 'todo' : ''}`} onClick={() => setPicking((v) => !v)}>
            {choice.build ? `預覽：${BUILDING_LABELS[choice.build]} · 換一個` : canBuildAny(options) ? `蓋建築（還能蓋 ${left} 棟）` : '這回合不能蓋建築'}
          </button>
          {picking && (
            <div className="inv-cards">
              <button type="button" className={`inv-card ${choice.build === null ? 'sel' : ''}`} onClick={() => pickBuild(null)}>
                <b>不蓋</b>
                <small>保留材料</small>
              </button>
              {builds.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  className={`inv-card ${b.legal ? '' : 'no'} ${choice.build === b.id ? 'sel' : ''}`}
                  disabled={!b.legal}
                  title={BUILDING_TEXT[b.id]}
                  onClick={() => pickBuild(b.id)}
                >
                  <b>{BUILDING_LABELS[b.id]}</b>
                  <small>
                    {b.cash} G{GOODS.filter((g) => b.goods[g] > 0).map((g) => `＋${b.goods[g]}${GOOD_LABELS[g]}`)}
                  </small>
                  <small className="inv-effect">{BUILDING_TEXT[b.id]}</small>
                  {b.reason && <small className="inv-why">{b.reason}</small>}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    });
    // Each stack says what it is and how many are still free to load.
    GOODS.forEach((g, column) => {
      const height = context.view.myStock[g] - choice.load[g];
      pins.push({
        id: `stack-${g}`,
        position: islandPoint(home, stackTop(column, height)),
        hidden: picking,
        node: (
          <span className={`inv-stack good-${g} ${todo.cargo && canLoad(options, choice, g) ? 'todo' : ''}`}>
            {GOOD_LABELS[g].slice(0, 1)} {split.left[g]}
          </span>
        ),
      });
    });
    const at = (where: 'warehouse' | 'ship') => notes.filter((n) => n.at === where).map((n) => <div key={n.text}>{n.text}</div>);
    pins.push({
      id: 'warehouse-note',
      position: leftEnd,
      hidden: picking,
      node: (
        <div className="inv-note side-left">
          <b>倉庫</b>　點貨箱裝上船
          {at('warehouse')}
        </div>
      ),
    });
    const slot = deckSlot(home, 0, 1);
    pins.push({
      id: 'ship-note',
      position: [slot[0] + 5, slot[1], slot[2]],
      hidden: picking,
      node: (
        <div className="inv-note side-right">
          <b>你的船</b>　{summary.loaded}/{summary.capacity}
          {choice.build === 'shipyard' && '（造船廠 +1）'}　點船上的貨卸下
          {at('ship')}
        </div>
      ),
    });
  }

  return (
    <div className="beat-preview">
      <TableCanvas seats={seats} weather={null} ships={ships} cameraPoints={cameraPoints} safe={SAFE} pins={pins} onReady={() => setReady(true)}>
        {deciding && context && split && (
          <>
            <Warehouse
              angle={home}
              stock={context.view.myStock}
              forBuild={split.forBuild}
              onShip={choice.load}
              canLoad={(g: GoodId) => canLoad(options, choice, g)}
              glow={todo.cargo}
              onLoad={(g: GoodId) => setChoice((c) => loadOne(options, c, g))}
            />
            <ShipCargo angle={home} load={choice.load} capacity={summary?.capacity ?? 3} onUnload={(g) => setChoice((c) => unloadOne(c, g))} />
            {choice.build && <BuildingPreview angle={home} building={choice.build} color={seats[0]!.color} />}
          </>
        )}
        {revealed &&
          ships.map((s) => (
            // Other ships carry one tarp bundle: neither the goods nor how many are public (§4).
            <ShipCargo key={s.id} angle={angles[laneOf(s.owner)]!} load={s.owner === viewer ? myShipLoad : { ...NO_LOAD, wood: 1 }} capacity={1} covered={s.owner !== viewer} />
          ))}
      </TableCanvas>
      <MarketStrip board={board} />
      {reminding && (
        <ReminderDialog
          title="還有沒做完的地方"
          lines={reminding}
          onBack={() => setReminding(null)}
          onConfirm={(skipNext) => {
            if (skipNext) setReminderSkipped('invest-unfinished', true);
            send();
          }}
        />
      )}
      {ready && (
        <div className="inv-bar">
          {deciding && summary && (
            <>
              <span>
                {choice.build ? `蓋 ${BUILDING_LABELS[choice.build]}（−${summary.buildCash} G）` : '不蓋建築'} · {summary.sails ? `裝 ${summary.loaded}/${summary.capacity} 出航（−${summary.shipCost} G）` : '不出航'} · 現金 {summary.cashBefore} → <b>{summary.cashAfter} G</b>
              </span>
              <button type="button" className="primary" disabled={!action} onClick={submit}>
                {submitLabel(choice, summary)}
              </button>
              <small>提交後不能更改；所有人都提交後，建築與出航同時公開，船上的貨不公開。</small>
            </>
          )}
          {submitted && !revealed && <span>已提交，等待其他人…</span>}
          {revealed && (
            <>
              <span>
                投資揭曉：
                {board.ships.length > 0 ? `${board.ships.map((s) => names[s.owner]).join('、')} 出航（貨箱蓋布）` : '沒有人出航'}
                {board.stayedInPort.length > 0 && `；${board.stayedInPort.map((id) => names[id]).join('、')} 留港`}。下一步部署角色的 3D 互動尚未做。
              </span>
              <button type="button" onClick={onRestart}>
                再試一次
              </button>
            </>
          )}
          {!deciding && !submitted && <span>準備中…</span>}
        </div>
      )}
    </div>
  );
}
