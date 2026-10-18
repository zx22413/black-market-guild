import { useEffect, useMemo, useRef, useState } from 'react';
import { GOODS, type BuildingId, type GoodId } from '../../v07/game';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { BUILDING_LABELS, BUILDING_TEXT, GOOD_LABELS } from '../labels';
import { around } from '../scene/focusMath';
import { BuildingPreview, ShipCargo, Warehouse, deckSlot, warehouseLocal } from '../scene/InvestIsland';
import { ISLAND_PLATEAU, islandPoint, type TablePin } from '../scene/TableCanvas';
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
  todoReminders,
  unloadOne,
  withBuild,
  type InvestChoice,
} from '../table/investChoice';
import { ReminderDialog } from '../table/ReminderDialog';
import { isHintSeen, isReminderSkipped, markHintSeen, setReminderSkipped } from '../table/reminderSettings';
import { GoodCount } from './GoodIcon';
import { NoteBadge } from './NoteBadge';
import { ArrowIcon, CloseIcon, CrateIcon, Flow, HouseIcon, IconDisc, artIconUrl } from './icons';
import { LockHint } from './LockHint';
import type { StageEnv, StageParts } from './stage';
import { cardArtUrl } from './cardArt';

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
  const { board, seats, angles, laneOf, viewer, submit: submitAction } = active;
  // The deciding player's own island (on a hot-seat table it is not always the one in front).
  const home = angles[laneOf(viewer)]!;
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
  const maxBuilt = context.view.rules.buildings.maxPerPlayer;
  const built = me ? me.buildings.length : 0;
  const at = (where: 'warehouse' | 'ship') => notes.filter((n) => n.at === where).map((n) => <NoteBadge key={n.text} chips={n.chips} text={n.text} label={n.label} />);
  const slot = deckSlot(home, 0, 1);

  const pins: TablePin[] = [
    {
      id: 'build',
      // On the island's front edge as seen on screen, whichever way the island is turned, so it
      // never sits on the warehouse crates (side islands are turned a quarter round).
      position: [hx, ISLAND_PLATEAU, hz + PLAYER_ISLAND_RADIUS * 0.62],
      node: (
        <div className="inv-build" ref={buildArea}>
          <button type="button" className={`${choice.build ? 'on' : ''} ${todo.build ? 'todo' : ''}`} title={canBuildAny(options) ? `已蓋 ${built} 棟，最多 ${maxBuilt} 棟` : '這回合不能蓋建築'} onClick={() => setPicking((v) => !v)}>
            {choice.build ? `${BUILDING_LABELS[choice.build]} ↻` : canBuildAny(options) ? `＋ 建築 ${built}/${maxBuilt}` : '不能蓋'}
          </button>
          {picking && (
            <div className="inv-cards">
              <button
                type="button"
                className={`inv-card ${choice.build === null && buildDecided ? 'sel' : ''}`}
                title="不蓋，保留材料"
                aria-label="不蓋，保留材料"
                onClick={() => pickBuild(null)}
              >
                <span className="inv-ic none">
                  <CloseIcon />
                </span>
                <b>不蓋</b>
              </button>
              {builds.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  className={`inv-card ${b.legal ? '' : 'no'} ${choice.build === b.id ? 'sel' : ''}`}
                  disabled={!b.legal}
                  aria-label={`${BUILDING_LABELS[b.id]}：${BUILDING_TEXT[b.id]}`}
                  onClick={() => pickBuild(b.id)}
                >
                  <span className="inv-ic">
                    <img src={cardArtUrl({ kind: 'building', id: b.id })} alt="" />
                  </span>
                  <b>{BUILDING_LABELS[b.id]}</b>
                  <span className="inv-cost">
                    <IconDisc src={artIconUrl('coin')} />
                    {b.cash}
                    {GOODS.filter((g) => b.goods[g] > 0).map((g) => (
                      <span key={g} className="inv-need">
                        <GoodCount good={g} count={b.goods[g]} size="sm" />
                      </span>
                    ))}
                  </span>
                  {b.reason && <small className="inv-why">{b.reason}</small>}
                  <span className="inv-effect" role="tooltip">
                    {BUILDING_TEXT[b.id]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    },
    // Each stack says how many are still free to load (the crate lids already say which good).
    ...GOODS.map(
      (g, column): TablePin => ({
        id: `stack-${g}`,
        // At the foot of the stack, so the count never covers the icon on the crate lid.
        position: islandPoint(home, warehouseLocal(column)),
        hidden: picking || context.view.myStock[g] - choice.load[g] <= 0,
        node: <span className={`inv-stack good-${g} ${todo.cargo && canLoad(options, choice, g) ? 'todo' : ''}`}>{split.left[g]}</span>,
      }),
    ),
    {
      id: 'warehouse-note',
      position: leftEnd,
      hidden: picking,
      node: (
        <div className="inv-note side-left">
          <span className="note-title" title="倉庫">
            <CrateIcon />
            倉庫
          </span>
          {!isHintSeen('load-cargo') && (
            <span className="note-hint" title="點貨箱裝上船" aria-label="點貨箱裝上船">
              <CrateIcon />
              <ArrowIcon />
              <IconDisc src={artIconUrl('ship-solo')} />
              點箱裝船
            </span>
          )}
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
          <span className="note-title" title="船">
            <IconDisc src={artIconUrl('ship-solo')} />
            裝貨 {summary.loaded}/{summary.capacity}
          </span>
          {summary.loaded > 0 && !isHintSeen('unload-cargo') && (
            <span className="note-hint" title="點船上的貨卸下" aria-label="點船上的貨卸下">
              <IconDisc src={artIconUrl('ship-solo')} />
              <ArrowIcon />
              <CrateIcon />
              點貨卸下
            </span>
          )}
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
          onLoad={(g: GoodId) => {
            markHintSeen('load-cargo');
            setChoice((c) => loadOne(options, c, g));
          }}
        />
        <ShipCargo angle={home} load={choice.load} capacity={summary.capacity} onUnload={(g) => {
          markHintSeen('unload-cargo');
          setChoice((c) => unloadOne(c, g));
        }} />
        {choice.build && <BuildingPreview angle={home} building={choice.build} color={seats[laneOf(viewer)]!.color} />}
      </>
    ),
    bar: (
      <>
        <span className="bar-chips">
          <span className="chip" title="建築">
            <HouseIcon /> {choice.build ? `${BUILDING_LABELS[choice.build]} −${summary.buildCash}` : '不蓋'}
          </span>
          <span className="chip" title="出航">
            <IconDisc src={artIconUrl('ship-solo')} /> {summary.sails ? `${summary.loaded}/${summary.capacity} −${summary.shipCost}` : '不出航'}
          </span>
          <span className="chip cash" title="現金（G）">
            <IconDisc src={artIconUrl('coin')} />
            <Flow from={summary.cashBefore} to={<b>{summary.cashAfter}</b>} />
          </span>
        </span>
        <button type="button" className="primary" disabled={!action} onClick={submit}>
          提交
        </button>
        <LockHint text="提交後不能更改；所有人都提交後，建築與出航同時公開，船上的貨不公開。" />
      </>
    ),
    overlay: reminding && (
      <ReminderDialog
        title="還沒做完"
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
