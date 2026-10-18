import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GOODS, RULES_V07, type Action, type Goods, type PlayerId, type ShipId } from '../../v07/game';
import type { SafeArea } from '../../ui/scene/CameraRig';
import { eventLine } from '../log';
import { beatSeats } from '../scene/beatStage';
import { ShipCargo } from '../scene/InvestIsland';
import { TableCanvas, overviewPoints, useTableLayout, type TableShip } from '../scene/TableCanvas';
import { buildBoard } from '../session/board';
import type { GameSession, HumanRequest } from '../session/gameSession';
import { useSession } from '../session/useSession';
import { BookIcon, ExitIcon, LogIcon } from './icons';
import { islandBadgePins } from './IslandBadge';
import { IslandDraft, IslandReveal } from './IslandDraft';
import { MarketStrip } from './MarketStrip';
import { RankRail } from './RankRail';
import { RerollCard } from './RerollCard';
import { ResultCard } from './ResultCard';
import { resultRows } from './resultModel';
import { RulesPanel } from './RulesPanel';
import { seatPlates } from './seatPlates';
import type { StageEnv } from './stage';
import { useDeployStep } from './useDeployStep';
import { useHudSafe } from './useHudSafe';
import { useInvestStep } from './useInvestStep';
import { useIslandMoments } from './useIslandMoments';
import { useRoundResolution } from './useRoundResolution';
import { lanePoint, usePeekSpotlight } from './usePeekSpotlight';
import { Spotlight } from '../scene/Spotlight';

// The V0.7 match on the 3D table (docs/ui/v07-event-presentation.md): one table that stays
// mounted from the island draft to the result. Works for every kind of session the app has:
//   • alone against bots, and online: "you" is your own seat;
//   • hot-seat (several people on one device): "you" is whoever has confirmed the handoff for the
//     decision on screen; between turns no one's secrets show (§4, migration plan 5g).
// The table faces the first person at it and does not turn between hot-seat turns.

const SAFE: SafeArea = { top: 70, bottom: 96, left: 24, right: 24 };
const NO_GOODS: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };

export interface Table3DScreenProps {
  readonly session: GameSession;
  readonly onExit: () => void;
  /** Dev only: answer every decision with its first legal action and skip every show. */
  readonly autoplay?: boolean;
}

export function Table3DScreen({ session, onExit, autoplay = false }: Table3DScreenProps) {
  const snap = useSession(session);
  const [ready, setReady] = useState(false);

  const people = useMemo(() => snap.players.filter((p) => p.kind === 'local-human'), [snap.players]);
  const hotSeat = people.length > 1;
  const facing = people[0]?.id ?? snap.players[0]?.id ?? null;

  // Hot-seat: each decision waits until its player confirms they are the one at the device.
  const request = snap.requests[0];
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const seatOnScreen = request?.context.decision.playerId ?? null;
  const unlocked = request !== undefined && (!hotSeat || confirmed === request.id);
  // The seat whose secrets may show: your own seat when one person plays here; nobody for an
  // online spectator (no seat of their own).
  const viewer: PlayerId | null = hotSeat ? (unlocked ? seatOnScreen : null) : (people[0]?.id ?? null);

  useEffect(() => {
    if (!autoplay || !request) return;
    // StrictMode runs effects twice in development: submit only while the request is still open.
    if (session.getSnapshot().requests.some((r) => r.id === request.id)) session.submit(request.id, request.context.legalActions[0]!);
  }, [autoplay, request, session]);

  // Island draft, then everyone's islands revealed at once, before round 1.
  const chosen = snap.events.find((e) => e.type === 'islands-chosen');
  const [islandsSeen, setIslandsSeen] = useState(false);
  const showIslands = !autoplay && chosen?.type === 'islands-chosen' && !islandsSeen;

  // A round is resolved in one go once the last decision is in; replay it step by step and hold
  // the table until it has been seen.
  const [dismissed, setDismissed] = useState(0);
  const resolvingRound = useMemo(() => {
    const rounds = snap.events.flatMap((e) => (e.type === 'roles-revealed' && e.round > dismissed ? [e.round] : []));
    return rounds.length > 0 ? Math.min(...rounds) : null;
  }, [snap.events, dismissed]);
  useEffect(() => {
    if (autoplay && resolvingRound !== null) setDismissed(resolvingRound);
  }, [autoplay, resolvingRound]);
  const holding = resolvingRound !== null;

  const ids = useMemo(() => snap.players.map((p) => p.id), [snap.players]);
  const names = useMemo(() => new Map(snap.players.map((p) => [p.id, p.name])), [snap.players]);
  const nameOf = useCallback((id: PlayerId) => names.get(id) ?? id, [names]);

  const phase = request?.context.decision.phase;
  const free = !holding && !showIslands && unlocked && !autoplay;
  const drafting = free && phase === 'island-choice' ? request : null;
  const rerolling = free && phase === 'intel-reroll' ? request : null;
  const [rerollShown, setRerollShown] = useState<{ readonly request: HumanRequest; readonly shipId: ShipId } | null>(null);
  // Who still has to confirm the device before their decision shows (hot-seat).
  const handoffTo = hotSeat && request && !unlocked && !holding && !showIslands && !autoplay ? seatOnScreen : null;

  const seatsBoard = useMemo(() => buildBoard(ids, snap.startingCash, snap.events), [ids, snap.events, snap.startingCash]);
  const seats = useMemo(
    () =>
      beatSeats(
        snap.players,
        facing,
        Object.fromEntries(ids.map((id) => [id, seatsBoard.players[id]?.buildings ?? []])),
        Object.fromEntries(ids.map((id) => [id, seatsBoard.players[id]?.island ?? null])),
      ),
    [snap.players, facing, ids, seatsBoard],
  );
  const { angles, laneOf } = useTableLayout(seats);
  const colorOf = (id: PlayerId) => seats.find((s) => s.id === id)?.color ?? '#888';

  const weatherEvent = useMemo(
    () => (resolvingRound === null ? null : (snap.events.find((e) => e.type === 'voyage-event-revealed' && e.round === resolvingRound) ?? null)),
    [snap.events, resolvingRound],
  );
  const resolution = useRoundResolution({
    events: snap.events,
    privateEvents: snap.privateEvents,
    round: autoplay ? null : resolvingRound,
    paused: rerollShown !== null,
    seats,
    angles,
    laneOf,
    // The resolution shows to the whole table: on a hot-seat device no one's secrets.
    viewer: hotSeat ? null : viewer,
    nameOf,
    weather: weatherEvent?.type === 'voyage-event-revealed' ? weatherEvent.event : null,
    onFinish: () => setDismissed(resolvingRound ?? 0),
  });
  const events = useMemo(() => snap.events.slice(0, resolution.cutoff), [snap.events, resolution.cutoff]);
  const board = useMemo(() => buildBoard(ids, snap.startingCash, events), [ids, events, snap.startingCash]);

  // The islands that change production or costs get their moment first: at the round's start and at the launch.
  const moments = useIslandMoments({
    events: snap.events,
    board,
    free: ready && !holding && !showIslands && !autoplay && rerollShown === null,
    angleOf: (id) => angles[laneOf(id)]!,
  });
  const env: StageEnv | null =
    free && !moments.blocking && request && viewer && (phase === 'invest' || phase === 'role-deployment')
      ? { request, board, seats, angles, laneOf, viewer, nameOf, submit: (a: Action) => session.submit(request.id, a) }
      : null;
  const invest = useInvestStep(env);
  const deploy = useDeployStep(env);
  const step = invest ?? deploy;

  // Ships: at the dock until the voyage event is out, then at sea; the resolution moves them on.
  const ships: TableShip[] = board.ships.map((s) => {
    // While the reroll card (or the lighthouse's beams around it) is up, the ships stay at the dock.
    const base: TableShip = { id: s.id, owner: s.owner, state: rerollShown ? 'docked' : holding ? resolution.shipState(s.id) : board.voyageEvent ? 'sailing' : 'docked' };
    return step?.ship ? step.ship(base) : base;
  });
  const stateOf = (id: ShipId) => ships.find((x) => x.id === id)?.state;
  // Only the visible seat's own cargo (§4); hidden between hot-seat turns.
  const loaded = viewer ? snap.privateEvents.filter((e) => e.type === 'cargo-loaded' && e.playerId === viewer && e.round === board.round) : [];
  const lastLoaded = loaded[loaded.length - 1];
  const myCargo = lastLoaded?.type === 'cargo-loaded' ? lastLoaded.cargo : NO_GOODS;

  const waiting = new Set(snap.waitingOn);
  const deciding = !holding && snap.status === 'running' && board.round > 0;
  const plates = seatPlates(
    seats,
    angles,
    board,
    (id) => (deciding ? (waiting.has(id) ? '思考中' : '已決定') : ''),
    false,
    (id) => (board.players[id]?.cash ?? 0) + (resolution.cashBonus[id] ?? 0),
  );
  const islandBadges = islandBadgePins(seats, angles, (id) => board.players[id]?.island ?? null);
  const pins = [...plates, ...islandBadges, ...moments.pins, ...(step?.pins ?? []), ...resolution.pins];
  const camera = step?.camera ?? resolution.camera ?? overviewPoints(angles, seats.map((s) => s.island));

  const marketRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const topHud = useMemo(() => [marketRef], []);
  const bottomHud = useMemo(() => [dockRef, barRef], []);
  const safe = useHudSafe(topHud, bottomHud, SAFE);

  const rerollResult = rerollShown
    ? snap.privateEvents.find((e) => e.type === 'intel-reroll-result' && e.playerId === rerollShown.request.context.decision.playerId && e.shipId === rerollShown.shipId && e.round === rerollShown.request.context.view.round)
    : undefined;
  const cardRequest = rerollShown?.request ?? rerolling;
  // The lighthouse intel's private look: beams on the ships it looked at, before and around the card.
  const peek = usePeekSpotlight({
    request: cardRequest,
    rerolledShip: rerollShown?.shipId ?? null,
    islandOf: (id) => board.players[id]?.island ?? null,
    angleOf: (id) => angles[laneOf(id)]!,
    shipAt: (id) => {
      const owner = board.ships.find((s) => s.id === id)?.owner;
      return lanePoint(owner, (o) => angles[laneOf(o)]!, stateOf(id) === 'docked' ? 'docked' : 'sailing');
    },
  });

  const finished = !holding && snap.result !== null;
  const rows = useMemo(() => (snap.result ? resultRows(snap.events, snap.result, snap.startingCash, RULES_V07) : []), [snap.result, snap.events, snap.startingCash]);
  const winners = useMemo(() => new Set(snap.result?.winners ?? []), [snap.result]);

  // The voyage log, for whoever wants to read back what happened.
  const [logOpen, setLogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const shipOwnerName = (id: ShipId) => {
    const owner = snap.events.flatMap((e) => (e.type === 'ships-launched' ? e.ships : [])).find((s) => s.id === id)?.owner;
    return owner ? `${nameOf(owner)}的船` : id;
  };
  const logLines = events.flatMap((e) => eventLine(e, { nameOf, shipOf: shipOwnerName })?.split('\n') ?? []);

  const waitingNames = snap.waitingOn.filter((id) => id !== seatOnScreen).map(nameOf);
  const idle = !holding && !step && !cardRequest && !finished && !drafting && !showIslands && !handoffTo && !moments.blocking;

  return (
    <div className="beat-preview">
      <TableCanvas
        seats={seats}
        weather={board.voyageEvent}
        ships={ships}
        cameraPoints={camera}
        safe={safe}
        pins={pins}
        onReady={() => setReady(true)}
        dim={step?.dim ?? false}
        pulses={moments.pulses}
        {...(finished ? { ringed: winners } : resolution.ringed ? { ringed: resolution.ringed } : {})}
        {...(resolution.wrapShip ? { wrapShip: resolution.wrapShip } : {})}
        {...(step?.onSelectShip ? { onSelectShip: step.onSelectShip } : {})}
        {...(resolution.onTableClick ? { onClick: resolution.onTableClick } : {})}
      >
        {step?.scene}
        {board.ships
          // Cargo rides on the deck until the ship has arrived or sunk; then the beat shows it.
          .filter((s) => stateOf(s.id) === 'docked' || stateOf(s.id) === 'sailing')
          .map((s) => (
            // The viewer's ship shows its cargo; others carry one tarp bundle: neither goods nor count are public (§4).
            <ShipCargo
              key={`cargo-${s.id}`}
              angle={angles[laneOf(s.owner)]!}
              load={s.owner === viewer ? myCargo : { ...NO_GOODS, wood: 1 }}
              capacity={s.owner === viewer ? GOODS.reduce((n, g) => n + myCargo[g], 0) : 1}
              covered={s.owner !== viewer}
              state={stateOf(s.id) === 'docked' ? 'docked' : 'sailing'}
            />
          ))}
        {resolution.scene}
        {peek.cue && <Spotlight key={peek.cue.key} cue={peek.cue} />}
      </TableCanvas>

      <MarketStrip ref={marketRef} board={board} bets={step?.bets} prices={resolution.marketPrices} changed={resolution.changedGoods} />
      {ready && board.round > 0 && (
        <RankRail
          seats={seats}
          board={board}
          rules={RULES_V07}
          cashOf={(id) => (board.players[id]?.cash ?? 0) + (resolution.cashBonus[id] ?? 0)}
          status={(id) => (deciding ? (waiting.has(id) ? '思考中' : '已決定') : '')}
          rankStep={events.filter((e) => e.type === 'round-ended').length}
        />
      )}
      <div className="t3-menu">
        <span className="t3-round">{board.round === 0 ? '選島' : `第 ${board.round}／${RULES_V07.rounds} 回合`}</span>
        <button type="button" title="規則" aria-label="規則" aria-expanded={rulesOpen} onClick={() => setRulesOpen(true)}>
          <BookIcon />
        </button>
        <button type="button" title="航海日誌" aria-label="航海日誌" aria-expanded={logOpen} onClick={() => setLogOpen(!logOpen)}>
          <LogIcon />
        </button>
        <button type="button" title="離開" aria-label="離開" onClick={onExit}>
          <ExitIcon />
        </button>
      </div>

      {!ready && <div className="t3-loading">整理港口中…</div>}
      {ready && step?.dock && (
        <div ref={dockRef} className="dep-dock">
          {step.dock}
        </div>
      )}
      {ready && (
        <div ref={barRef} className="inv-bar">
          {step?.bar}
          {holding && !rerollShown && resolution.bar}
          {idle && <span>{snap.status === 'running' ? (waitingNames.length > 0 ? `等待 ${waitingNames.join('、')} 決定…` : '結算中…') : ''}</span>}
          {snap.error && <span className="t3-error">對局發生錯誤：{snap.error}</span>}
        </div>
      )}

      {ready && step?.overlay}
      {/* The round's show waits behind the private reroll moment (its card or the beams closing). */}
      {ready && !rerollShown && resolution.overlay}
      {ready && drafting && <IslandDraft key={drafting.id} context={drafting.context} onSubmit={(a) => session.submit(drafting.id, a)} />}
      {ready && showIslands && chosen?.type === 'islands-chosen' && <IslandReveal islands={chosen.islands} seats={seats} onClose={() => setIslandsSeen(true)} />}
      {ready && cardRequest && peek.cardShown && (
        <RerollCard
          context={cardRequest.context}
          board={board}
          viewer={cardRequest.context.decision.playerId}
          nameOf={nameOf}
          rerolled={rerollShown ? { shipId: rerollShown.shipId, value: rerollResult?.type === 'intel-reroll-result' ? rerollResult.rerolledRoll : null } : null}
          onClose={() => setRerollShown(null)}
          onSubmit={(a) => {
            if (!rerolling) return;
            if (a.type === 'intel-reroll' && a.rerollShipId !== null) setRerollShown({ request: rerolling, shipId: a.rerollShipId });
            session.submit(rerolling.id, a);
          }}
        />
      )}
      {ready && finished && <ResultCard rows={rows} nameOf={nameOf} colorOf={colorOf} viewer={hotSeat ? null : viewer} rounds={RULES_V07.rounds} onRestart={onExit} />}

      {ready && handoffTo && (
        <div className="beat-backdrop handoff-backdrop" role="dialog" aria-modal="true" aria-label="換人">
          <div className="beat-card handoff">
            <p>請將裝置交給</p>
            <h1 style={{ color: colorOf(handoffTo) }}>{nameOf(handoffTo)}</h1>
            <p className="handoff-note">其他玩家請勿偷看。</p>
            <button type="button" className="primary" onClick={() => request && setConfirmed(request.id)}>
              我是 {nameOf(handoffTo)}，開始
            </button>
          </div>
        </div>
      )}

      {rulesOpen && <RulesPanel onClose={() => setRulesOpen(false)} />}
      {logOpen && (
        <aside className="v7-log t3-log" aria-label="航海日誌">
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
    </div>
  );
}
