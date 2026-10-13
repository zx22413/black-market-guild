import { useEffect, useMemo, useRef, useState } from 'react';
import { GOODS, type BuildingId, type GoodId } from '../../v07/game';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { BUILDING_LABELS, BUILDING_TEXT, GOOD_LABELS } from '../labels';
import { around } from '../scene/focusMath';
import { BuildingPreview, ShipCargo, Warehouse, deckSlot, stackTop, warehouseLocal } from '../scene/InvestIsland';
import { islandPoint, type TablePin } from '../scene/TableCanvas';
import {
  EMPTY_CHOICE,
  actionFor,
  buildOptions,
  canBuildAny,
  canLoad,
  investNotes,
  investOptions,
  investSummary,
  investTodo,
  loadOne,
  stockSplit,
  submitLabel,
  todoReminders,
  unloadOne,
  withBuild,
  type InvestChoice,
} from '../table/investChoice';
import { ReminderDialog } from '../table/ReminderDialog';
import { isReminderSkipped, setReminderSkipped } from '../table/reminderSettings';
import type { StageEnv, StageParts } from './stage';

// The investment on your own island (docs/ui/v07-event-presentation.md §1.3): building cards,
// warehouse crates onto the docked ship, gold glow on what is still undone, a reminder before
// submitting something unfinished.

export function useInvestStep(env: StageEnv | null): StageParts | null {
  const active = env?.request.context.decision.phase === 'invest' ? env : null;
  const requestId = active?.request.id ?? null;
  const context = active?.request.context ?? null;
  const options = useMemo(() => (context ? investOptions(context) : []), [context]);
  const [choice, setChoice] = useState<InvestChoice>(EMPTY_CHOICE);
  const [picking, setPicking] = useState(false);
  // Picking a building or "不蓋" both count as dealing with the building; until then it glows.
  const [buildDecided, setBuildDecided] = useState(false);
  const [reminding, setReminding] = useState<readonly string[] | null>(null);
  const buildArea = useRef<HTMLDivElement>(null);

  // A new investment (next round) starts from scratch.
  useEffect(() => {
    setChoice(EMPTY_CHOICE);
    setPicking(false);
    setBuildDecided(false);
    setReminding(null);
  }, [requestId]);

  // The building list closes on a click anywhere outside it (the table included).
  useEffect(() => {
    if (!picking) return;
    const close = (e: PointerEvent) => {
      if (!buildArea.current?.contains(e.target as Node)) setPicking(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [picking]);

  if (!active || !context) return null;
  const { board, seats, angles, viewer, submit: submitAction } = active;
  const home = angles[0]!;
  const me = board.players[viewer];
  const builds = buildOptions(context, options);
  const split = stockSplit(context, choice);
  const summary = investSummary(context, choice);
  const notes = investNotes(context, choice);
  const action = actionFor(options, choice);
  const todo = investTodo(options, choice, buildDecided);

  const send = () => {
    if (!action) return;
    setPicking(false);
    setReminding(null);
    submitAction(action);
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

  // Medium shot: your island, your ship at the dock and the edge of the harbor beyond it.
  const [hx, , hz] = seatPosition(home);
  const dock = shipPose(home, 'docked').position;
  const camera = [...around([hx, 0, hz], PLAYER_ISLAND_RADIUS + 4), ...around([dock.x, 0, dock.z], 6), ...around([0, 0, 0], 6)];

  // Notes sit beside what they are about: the warehouse note on the outer side of the crate row,
  // the ship note beside the ship, never on top of them.
  const rowEnds = [islandPoint(home, [warehouseLocal(0)[0] - 1.6, 0, warehouseLocal(0)[2]]), islandPoint(home, [warehouseLocal(3)[0] + 1.6, 0, warehouseLocal(3)[2]])] as const;
  const leftEnd = rowEnds[0][0] < rowEnds[1][0] ? rowEnds[0] : rowEnds[1];
  const left = me ? context.view.rules.buildings.maxPerPlayer - me.buildings.length : 0;
  const at = (where: 'warehouse' | 'ship') => notes.filter((n) => n.at === where).map((n) => <div key={n.text}>{n.text}</div>);
  const slot = deckSlot(home, 0, 1);

  const pins: TablePin[] = [
    {
      id: 'build',
      position: islandPoint(home, [0, 0, -2.5]),
      node: (
        <div className="inv-build" ref={buildArea}>
          <button type="button" className={`${choice.build ? 'on' : ''} ${todo.build ? 'todo' : ''}`} onClick={() => setPicking((v) => !v)}>
            {choice.build ? `預覽：${BUILDING_LABELS[choice.build]} · 換一個` : canBuildAny(options) ? `蓋建築（還能蓋 ${left} 棟）` : '這回合不能蓋建築'}
          </button>
          {picking && (
            <div className="inv-cards">
              <button type="button" className={`inv-card ${choice.build === null && buildDecided ? 'sel' : ''}`} onClick={() => pickBuild(null)}>
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
    },
    // Each stack says what it is and how many are still free to load.
    ...GOODS.map(
      (g, column): TablePin => ({
        id: `stack-${g}`,
        position: islandPoint(home, stackTop(column, context.view.myStock[g] - choice.load[g])),
        hidden: picking,
        node: (
          <span className={`inv-stack good-${g} ${todo.cargo && canLoad(options, choice, g) ? 'todo' : ''}`}>
            {GOOD_LABELS[g].slice(0, 1)} {split.left[g]}
          </span>
        ),
      }),
    ),
    {
      id: 'warehouse-note',
      position: leftEnd,
      hidden: picking,
      node: (
        <div className="inv-note side-left">
          <b>倉庫</b>　點貨箱裝上船
          {at('warehouse')}
        </div>
      ),
    },
    {
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
    },
  ];

  return {
    pins,
    camera,
    scene: (
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
        <ShipCargo angle={home} load={choice.load} capacity={summary.capacity} onUnload={(g) => setChoice((c) => unloadOne(c, g))} />
        {choice.build && <BuildingPreview angle={home} building={choice.build} color={seats[0]!.color} />}
      </>
    ),
    bar: (
      <>
        <span>
          {choice.build ? `蓋 ${BUILDING_LABELS[choice.build]}（−${summary.buildCash} G）` : '不蓋建築'} ·{' '}
          {summary.sails ? `裝 ${summary.loaded}/${summary.capacity} 出航（−${summary.shipCost} G）` : '不出航'} · 現金 {summary.cashBefore} → <b>{summary.cashAfter} G</b>
        </span>
        <button type="button" className="primary" disabled={!action} onClick={submit}>
          {submitLabel(choice, summary)}
        </button>
        <small>提交後不能更改；所有人都提交後，建築與出航同時公開，船上的貨不公開。</small>
      </>
    ),
    overlay: reminding && (
      <ReminderDialog
        title="還有沒做完的地方"
        lines={reminding}
        onBack={() => setReminding(null)}
        onConfirm={(skipNext) => {
          if (skipNext) setReminderSkipped('invest-unfinished', true);
          send();
        }}
      />
    ),
  };
}
