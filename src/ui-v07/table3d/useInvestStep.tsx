import { useEffect, useMemo, useRef, useState } from 'react';
import { GOODS, producedFor, type BuildingId, type GoodId } from '../../v07/game';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import type { FitPoint } from '../../ui/scene/CameraRig';
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
  unloadedBy,
  withBuild,
  type InvestChoice,
} from '../table/investChoice';
import { ReminderDialog } from '../table/ReminderDialog';
import { isHintSeen, isReminderSkipped, markHintSeen, setReminderSkipped } from '../table/reminderSettings';
import { GoodCount, GoodIcon } from './GoodIcon';
import { CRATE_SIZE } from '../scene/CrateModel';
import { MINT_SECONDS } from '../scene/mintMath';
import { NoteBadge } from './NoteBadge';
import { RestockTag } from './RestockTag';
import { nextProductionRound } from '../table/restock';
import { ArrowIcon, CloseIcon, CrateIcon, Flow, HouseIcon, IconDisc, InfoIcon, tokenIconUrl } from './icons';
import { LockHint } from './LockHint';
import { usePhone } from './usePhone';
import { SealSubmit } from './SealSubmit';
import { soundEngine } from '../audio/soundEngine';
import type { StageEnv, StageParts } from './stage';
import { cardArtUrl } from './cardArt';

// The investment on your own island (docs/ui/v07-event-presentation.md §1.3): building cards,
// warehouse crates onto the docked ship, gold glow on what is still undone, a reminder before
// submitting something unfinished.


/** The round's steel-drum phrase plays first; the warehouse's crates land when it is done. */
const ROUND_OPEN_MS = 650;
/** When a stack's production count pops up (its column's place in the warehouse row staggers them). */
const mintChipDelay = (column: number): number => 150 + column * 120;
/** Each next pop a little higher, like bubbles rising. */
const BUBBLE_RISE = 0.12;

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
  // Crates a change of building took off the ship, said beside the ship until the next change.
  const [unloaded, setUnloaded] = useState<string | null>(null);
  // This round's production arriving in the warehouse: shown in gold for a moment, then plain.
  const [minting, setMinting] = useState(true);
  // Whether this round made anything here, read when its crates' sound is due, and the warehouse
  // columns whose counts pop up (one bubble each).
  const producing = useRef(false);
  const popping = useRef<readonly number[]>([]);
  const buildArea = useRef<HTMLDivElement>(null);
  // On a phone the building list is a sheet over the bottom of the table (hudPhone.css), not a row on the island.
  const phone = usePhone();
  const sheet = useRef<HTMLDivElement>(null);

  // A new investment (next round) starts from scratch.
  useEffect(() => {
    setChoice(EMPTY_CHOICE);
    setPicking(false);
    setBuildDecided(false);
    setReminding(null);
    setUnloaded(null);
    setMinting(true);
    const timer = setTimeout(() => setMinting(false), MINT_SECONDS * 1000);
    // The round opens with its steel-drum phrase; the island's new crates land in the warehouse after it.
    const pops = popping.current.map((column, i) => setTimeout(() => soundEngine.playSfx('bubble', 1 + i * BUBBLE_RISE), mintChipDelay(column)));
    const opening = requestId === null ? [] : [setTimeout(() => soundEngine.playSfx('round-open'), 0), setTimeout(() => producing.current && soundEngine.playSfx('produce'), ROUND_OPEN_MS), ...pops];
    return () => [timer, ...opening].forEach(clearTimeout);
  }, [requestId]);

  // The building list closes on a click anywhere outside it (the table included).
  useEffect(() => {
    if (!picking) return;
    const close = (e: PointerEvent) => {
      const inside = [buildArea.current, sheet.current].some((el) => el?.contains(e.target as Node));
      if (!inside) setPicking(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [picking]);

  // What the choice would submit, for whoever follows along (the tutorial lights 「提交」 when it fits).
  const draft = active ? (actionFor(options, choice) ?? null) : null;
  const onDraft = active?.onDraft;
  useEffect(() => onDraft?.(draft), [onDraft, draft]);

  if (!active || !context) return null;
  const { board, seats, angles, laneOf, viewer, submit: submitAction } = active;
  // The deciding player's own island (on a hot-seat table it is not always the one in front).
  const home = angles[laneOf(viewer)]!;
  const me = board.players[viewer];
  const builds = buildOptions(context, options, choice.load);
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
  // Load one crate of a good onto the ship: from a click on its stack or on the stack's label.
  const loadGood = (g: GoodId) => {
    markHintSeen('load-cargo');
    setUnloaded(null);
    setChoice((c) => loadOne(options, c, g));
  };
  const pickBuild = (build: BuildingId | null) => {
    const next = withBuild(options, choice, build);
    const off = unloadedBy(choice.load, next.load);
    const names = GOODS.filter((g) => off[g] > 0).map((g) => `${off[g]} ${GOOD_LABELS[g]}`);
    setUnloaded(names.length > 0 ? `可裝貨量變少，已卸下 ${names.join('、')}` : null);
    setChoice(next);
    setBuildDecided(true);
    setPicking(false);
  };

  const [hx, , hz] = seatPosition(home);
  const dock = shipPose(home, 'docked').position;
  // The nameplate hangs on the outer side of the island, away from the harbor: keep it in the shot too.
  const reach = Math.hypot(hx, hz) || 1;
  // (On a phone the plate hangs below its point, so the point goes farther out.)
  const out = phone ? 9.5 : 4;
  const plate: FitPoint = { position: [hx + (hx / reach) * out, 0, hz + (hz / reach) * out] };
  // Close shot: your island and your ship at the dock, so the crates are big enough to tell apart.
  // A phone is as narrow as the island is wide, so it crops the island's far sides to bring the
  // crates up to size; the stack labels, clocks and note hang from the crates and spread with it.
  const camera = phone
    ? [...around([hx, 0, hz], PLAYER_ISLAND_RADIUS - 3), ...around([dock.x, 0, dock.z], 5), plate]
    : [...around([hx, 0, hz], PLAYER_ISLAND_RADIUS), ...around([dock.x, 0, dock.z], 7), plate];

  // Notes sit beside what they are about: the warehouse note on the outer side of the crate row,
  // the ship note beside the ship, never on top of them.
  const rowEnds = [islandPoint(home, [warehouseLocal(0)[0] - 1.6, 0, warehouseLocal(0)[2]]), islandPoint(home, [warehouseLocal(3)[0] + 1.6, 0, warehouseLocal(3)[2]])] as const;
  const leftEnd = rowEnds[0][0] < rowEnds[1][0] ? rowEnds[0] : rowEnds[1];
  const underRow = islandPoint(home, [(warehouseLocal(0)[0] + warehouseLocal(3)[0]) / 2, 0, warehouseLocal(0)[2]]);
  const maxBuilt = context.view.rules.buildings.maxPerPlayer;
  const built = me ? me.buildings.length : 0;
  const at = (where: 'warehouse' | 'ship') => notes.filter((n) => n.at === where).map((n) => <NoteBadge key={n.text} chips={n.chips} text={n.text} label={n.label} />);
  const slot = deckSlot(home, 0, 1);
  // What the island made this round (§6.2 with its island's trait): those crates arrive in gold
  // and the count pops over each stack, the same for every island.
  const produced = me ? producedFor(context.view.rules, me.island, board.round) : null;
  const fresh = minting ? produced : null;
  producing.current = produced !== null && GOODS.some((g) => produced[g] > 0);
  popping.current = produced ? GOODS.flatMap((g, column) => (produced[g] > 0 && context.view.myStock[g] > 0 ? [column] : [])) : [];
  const freshPins: TablePin[] = fresh
    ? GOODS.flatMap((good, column): TablePin[] => {
        const made = fresh[good];
        const shown = context.view.myStock[good] - choice.load[good];
        if (made <= 0 || shown <= 0) return [];
        const [x, , z] = warehouseLocal(column);
        return [
          {
            id: `fresh-${good}`,
            position: islandPoint(home, [x, shown * (CRATE_SIZE + 0.05) + 0.4, z]),
            node: (
              <span className="mint-chip" title={`這回合生產 ${made} ${GOOD_LABELS[good]}`} style={{ animationDelay: `${mintChipDelay(column)}ms` }}>
                +{made}
              </span>
            ),
          },
        ];
      })
    : [];

  const cards = picking ? (
      <div ref={phone ? sheet : undefined} className={`inv-cards ${phone ? 'sheet' : ''}`}>
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
            data-focus={`build-${b.id}`}
            data-done={choice.build === b.id}
            disabled={!b.legal}
            aria-label={`${BUILDING_LABELS[b.id]}：${BUILDING_TEXT[b.id]}`}
            onClick={() => pickBuild(b.id)}
          >
            <span className="inv-ic">
              <img src={cardArtUrl({ kind: 'building', id: b.id })} alt="" />
            </span>
            <b>{BUILDING_LABELS[b.id]}</b>
            <span className="inv-cost">
              <IconDisc src={tokenIconUrl('coin')} />
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
  ) : null;

  const pins: TablePin[] = [
    ...freshPins,
    {
      id: 'build',
      // On the island's front edge as seen on screen, whichever way the island is turned, so it
      // never sits on the warehouse crates (side islands are turned a quarter round).
      position: [hx, ISLAND_PLATEAU, hz + PLAYER_ISLAND_RADIUS * 0.62],
      node: (
        <div className="inv-build" ref={buildArea}>
          <button type="button" data-focus="build-open" className={`${choice.build ? 'on' : ''} ${todo.build ? 'todo' : ''}`} title={canBuildAny(options) ? `已蓋 ${built} 棟，最多 ${maxBuilt} 棟` : '這回合不能蓋建築'} onClick={() => setPicking((v) => !v)}>
            {choice.build ? `${BUILDING_LABELS[choice.build]} ↻` : canBuildAny(options) ? `＋ 建築 ${built}/${maxBuilt}` : '不能蓋'}
          </button>
          {!phone && cards}
        </div>
      ),
    },
    // Each stack says which good it is and how many are still free to load (the crate lids are too
    // small to tell the goods apart from the table camera). The label is part of the stack: a click on
    // it loads a crate like a click on the stack, never opens a tip (the glowing icon invites a click).
    ...GOODS.map((g, column): TablePin => {
      const loadable = canLoad(options, choice, g);
      const label = (
        <>
          <GoodIcon good={g} size="sm" tip={false} />
          {split.left[g]}
        </>
      );
      return {
        id: `stack-${g}`,
        // At the foot of the stack, so the count never covers the icon on the crate lid.
        position: islandPoint(home, warehouseLocal(column)),
        hidden: picking || context.view.myStock[g] - choice.load[g] <= 0,
        node: loadable ? (
          <button
            type="button"
            className={`inv-stack good-${g} ${todo.cargo ? 'todo' : ''}`}
            title={`裝一箱${GOOD_LABELS[g]}上船`}
            data-crate={g}
            data-loaded={choice.load[g]}
            onClick={() => loadGood(g)}
          >
            {label}
          </button>
        ) : (
          <span className={`inv-stack good-${g}`} title={GOOD_LABELS[g]}>
            {label}
          </span>
        ),
      };
    }),
    // A clock under each stack, shown even when the stack is empty: how many rounds until the island makes more.
    ...GOODS.map((g, column): TablePin => {
      const [x, , z] = warehouseLocal(column);
      return {
        id: `restock-${g}`,
        // The stack label's own point: the slot drops the clock a few px below it, however close the camera is.
        position: islandPoint(home, warehouseLocal(column)),
        hidden: picking,
        node: (
          <span className="restock-slot">
            <RestockTag good={g} next={nextProductionRound(context.view.rules, me?.island ?? null, g, board.round)} round={board.round} />
          </span>
        ),
      };
    }),
    {
      id: 'warehouse-note',
      // Beside the crate row, or on a phone (no room at its side without covering the first stack) under it.
      position: phone ? underRow : leftEnd,
      hidden: picking,
      node: (
        <div className={`inv-note ${phone ? 'below' : 'side-left'}`} data-focus={`island-${viewer}`}>
          <span className="note-title" title="倉庫">
            <CrateIcon />
            倉庫
          </span>
          {!isHintSeen('load-cargo') && (
            <span className="note-hint" title="點貨箱裝上船" aria-label="點貨箱裝上船">
              <CrateIcon />
              <ArrowIcon />
              <IconDisc src={tokenIconUrl('ship')} />
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
        <div className="inv-note side-right" data-focus={`island-${viewer}`}>
          <span className="note-title" title="船">
            <IconDisc src={tokenIconUrl('ship')} />
            裝貨 {summary.loaded}/{summary.capacity}
          </span>
          {summary.loaded > 0 && !isHintSeen('unload-cargo') && (
            <span className="note-hint" title="點船上的貨卸下" aria-label="點船上的貨卸下">
              <IconDisc src={tokenIconUrl('ship')} />
              <ArrowIcon />
              <CrateIcon />
              點貨卸下
            </span>
          )}
          {unloaded && <span className="note-hint">{unloaded}</span>}
          {at('ship')}
        </div>
      ),
    },
  ];

  // What a submit seals: kept on the bar under the seal while the others decide.
  const chips = (
    <span className="bar-chips">
      <span className="chip" title="建築">
        <HouseIcon /> {choice.build ? `${BUILDING_LABELS[choice.build]} −${summary.buildCash}` : '不蓋'}
      </span>
      <span className="chip" title="出航">
        <IconDisc src={tokenIconUrl('ship')} /> {summary.sails ? `${summary.loaded}/${summary.capacity} −${summary.shipCost}` : '不出航'}
      </span>
      <span className="chip cash" title="現金（G）">
        <IconDisc src={tokenIconUrl('coin')} />
        <Flow from={summary.cashBefore} to={<b>{summary.cashAfter}</b>} />
      </span>
    </span>
  );
  return {
    pins,
    camera,
    ...(phone ? { rivalRow: true } : { closeShot: true }),
    scene: (
      <>
        <Warehouse
          angle={home}
          stock={context.view.myStock}
          forBuild={split.forBuild}
          onShip={choice.load}
          canLoad={(g: GoodId) => canLoad(options, choice, g)}
          glow={todo.cargo}
          fresh={fresh}
          onLoad={loadGood}
        />
        <ShipCargo angle={home} load={choice.load} capacity={summary.capacity} onUnload={(g) => {
          markHintSeen('unload-cargo');
          setUnloaded(null);
          setChoice((c) => unloadOne(c, g));
        }} />
        {choice.build && <BuildingPreview angle={home} building={choice.build} color={seats[laneOf(viewer)]!.color} />}
      </>
    ),
    bar: (
      <>
        {chips}
        <SealSubmit disabled={!action} glow={todoReminders(todo).length === 0} onClick={submit} />
        <LockHint icon={<InfoIcon />} text="提交後不能更改；所有人都提交後，建築與出航同時公開，船上的貨不公開。" />
      </>
    ),
    sealedChips: chips,
    overlay: (
      <>
        {phone && cards}
        {reminding && (
          <ReminderDialog
            title="還沒做完"
            lines={reminding}
            onBack={() => setReminding(null)}
            onConfirm={(skipNext) => {
              if (skipNext) setReminderSkipped('invest-unfinished', true);
              send();
            }}
          />
        )}
      </>
    ),
  };
}
