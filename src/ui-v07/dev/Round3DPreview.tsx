import { useEffect, useMemo, useRef, useState } from 'react';
import { GOODS, RULES_V07, type Action, type Goods, type PlayerId } from '../../v07/game';
import type { SeatConfig } from '../../v07/match';
import type { SafeArea } from '../../ui/scene/CameraRig';
import { beatSeats } from '../scene/beatStage';
import { ShipCargo } from '../scene/InvestIsland';
import { TableCanvas, overviewPoints, useTableLayout, type TableShip } from '../scene/TableCanvas';
import { buildBoard } from '../session/board';
import { startGameSession, type GameSession, type HumanRequest } from '../session/gameSession';
import { useSession } from '../session/useSession';
import { islandBadgePins } from '../table3d/IslandBadge';
import { IslandDraft, IslandReveal } from '../table3d/IslandDraft';
import { MarketStrip } from '../table3d/MarketStrip';
import { RerollCard } from '../table3d/RerollCard';
import { ResultCard } from '../table3d/ResultCard';
import { resultRows } from '../table3d/resultModel';
import { seatPlates } from '../table3d/seatPlates';
import type { StageEnv } from '../table3d/stage';
import { useDeployStep } from '../table3d/useDeployStep';
import { useHudSafe } from '../table3d/useHudSafe';
import { useInvestStep } from '../table3d/useInvestStep';
import { useRoundResolution } from '../table3d/useRoundResolution';

// Dev-only: whole rounds on the 3D table, at /v07.html?dev=round3d (also ?dev=invest3d), &seed=3.
// &autoplay plays your seat with its first legal action and skips the shows (to reach the end).
// A real local match (you against three bots) on one table that stays mounted: invest on your
// island → deploy a role → (intel reroll) → roles revealed as arrows → one beat per ship → the
// market at the harbor → the settlement as flights → your bill → the next round.

const SEATS: SeatConfig[] = [
  { kind: 'local-human', name: '你' },
  { kind: 'bot', name: '黑潮會', strategy: 'aggressive' },
  { kind: 'bot', name: '金錨公會', strategy: 'balanced' },
  { kind: 'bot', name: '霧港商團', strategy: 'builder' },
];
const VIEWER: PlayerId = 'p1';
const SAFE: SafeArea = { top: 70, bottom: 96, left: 24, right: 24 };
const NO_GOODS: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };

export function Round3DPreview() {
  const seed = Number(new URLSearchParams(location.search).get('seed') ?? 3) || 3;
  const [run, setRun] = useState(0);
  const session = useMemo(() => startGameSession({ seed: seed + run, seats: SEATS }), [seed, run]);
  return <RoundStage key={run} session={session} onRestart={() => setRun((n) => n + 1)} />;
}

function RoundStage({ session, onRestart }: { readonly session: GameSession; readonly onRestart: () => void }) {
  const snap = useSession(session);
  const request = snap.requests[0];
  const [ready, setReady] = useState(false);

  // Dev shortcut: answer every decision with the first legal action and skip every show.
  // StrictMode runs effects twice in development, so submit only while the request is still open.
  const autoplay = useMemo(() => new URLSearchParams(location.search).has('autoplay'), []);
  useEffect(() => {
    if (!autoplay || !request) return;
    if (session.getSnapshot().requests.some((r) => r.id === request.id)) session.submit(request.id, request.context.legalActions[0]!);
  }, [autoplay, request, session]);

  // The island draft, then everyone's islands revealed at once, before round 1 begins.
  const drafting = !autoplay && request?.context.decision.phase === 'island-choice' ? request : null;
  const chosen = snap.events.find((e) => e.type === 'islands-chosen');
  const [islandsSeen, setIslandsSeen] = useState(false);
  const showIslands = !autoplay && chosen?.type === 'islands-chosen' && !islandsSeen;

  // The bots answer at once, so after you deploy the whole round is already played out in the
  // events; the resolution replays it step by step and holds the table until you have seen it.
  const [dismissed, setDismissed] = useState(0);
  const resolvingRound = useMemo(() => {
    const rounds = snap.events.flatMap((e) => (e.type === 'roles-revealed' && e.round > dismissed ? [e.round] : []));
    return rounds.length > 0 ? Math.min(...rounds) : null;
  }, [snap.events, dismissed]);

  const ids = useMemo(() => snap.players.map((p) => p.id), [snap.players]);
  const names = useMemo(() => Object.fromEntries(snap.players.map((p) => [p.id, p.name])), [snap.players]);
  const nameOf = (id: PlayerId) => names[id] ?? id;

  // The reroll card stays open after a reroll until the new die has landed.
  const phase = request?.context.decision.phase;
  const rerolling = resolvingRound === null && request && phase === 'intel-reroll' ? request : null;
  const [rerollShown, setRerollShown] = useState<{ readonly request: HumanRequest; readonly shipId: string } | null>(null);

  // Seats (with their buildings) come from the table as far as it has been shown.
  const seatsBoard = useMemo(() => buildBoard(ids, snap.startingCash, snap.events), [ids, snap.events, snap.startingCash]);
  const seats = useMemo(
    () => beatSeats(snap.players, VIEWER, Object.fromEntries(ids.map((id) => [id, seatsBoard.players[id]?.buildings ?? []]))),
    [snap.players, ids, seatsBoard],
  );
  const { angles, laneOf } = useTableLayout(seats);

  const weatherEvent = useMemo(
    () => (resolvingRound === null ? null : (snap.events.find((e) => e.type === 'voyage-event-revealed' && e.round === resolvingRound) ?? null)),
    [snap.events, resolvingRound],
  );
  const resolution = useRoundResolution({
    events: snap.events,
    privateEvents: snap.privateEvents,
    round: resolvingRound,
    paused: rerollShown !== null,
    seats,
    angles,
    laneOf,
    viewer: VIEWER,
    nameOf,
    weather: weatherEvent?.type === 'voyage-event-revealed' ? weatherEvent.event : null,
    onFinish: () => setDismissed(resolvingRound ?? 0),
  });
  const holding = resolvingRound !== null;
  useEffect(() => {
    if (autoplay && resolvingRound !== null) setDismissed(resolvingRound);
  }, [autoplay, resolvingRound]);
  const events = useMemo(() => snap.events.slice(0, resolution.cutoff), [snap.events, resolution.cutoff]);
  const board = useMemo(() => buildBoard(ids, snap.startingCash, events), [ids, events, snap.startingCash]);

  const env: StageEnv | null =
    request && !holding && !showIslands && (phase === 'invest' || phase === 'role-deployment')
      ? { request, board, seats, angles, laneOf, viewer: VIEWER, nameOf, submit: (a: Action) => session.submit(request.id, a) }
      : null;
  const invest = useInvestStep(env);
  const deploy = useDeployStep(env);
  const step = invest ?? deploy;

  // Ships: at the dock until the voyage event is out, then at sea; the resolution moves them on.
  const ships: TableShip[] = board.ships.map((s) => {
    const base: TableShip = { id: s.id, owner: s.owner, state: holding ? resolution.shipState(s.id) : board.voyageEvent ? 'sailing' : 'docked' };
    return step?.ship ? step.ship(base) : base;
  });
  const loaded = snap.privateEvents.filter((e) => e.type === 'cargo-loaded' && e.playerId === VIEWER && e.round === board.round);
  const lastLoaded = loaded[loaded.length - 1];
  const myCargo = lastLoaded?.type === 'cargo-loaded' ? lastLoaded.cargo : NO_GOODS;

  const plates = seatPlates(
    seats,
    angles,
    board,
    (id) => {
      if (holding || !request) return '';
      return snap.players.find((p) => p.id === id)?.kind === 'local-human' ? '決定中' : '已決定';
    },
    // Information stays readable while deciding: only the 3D table dims.
    false,
    (id) => (board.players[id]?.cash ?? 0) + (resolution.cashBonus[id] ?? 0),
  );
  const islandBadges = islandBadgePins(seats, angles, (id) => board.players[id]?.island ?? null);
  const pins = [...plates, ...islandBadges, ...(step?.pins ?? []), ...resolution.pins];
  const camera = step?.camera ?? resolution.camera ?? overviewPoints(angles);

  // The camera keeps the islands clear of the HUD actually on screen.
  const marketRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const topHud = useMemo(() => [marketRef], []);
  const bottomHud = useMemo(() => [dockRef, barRef], []);
  const safe = useHudSafe(topHud, bottomHud, SAFE);
  const rerollResult = rerollShown
    ? snap.privateEvents.find((e) => e.type === 'intel-reroll-result' && e.playerId === VIEWER && e.shipId === rerollShown.shipId && e.round === rerollShown.request.context.view.round)
    : undefined;
  const cardRequest = rerollShown?.request ?? rerolling;
  // The match is over once every round has been shown: the result card over the table, the
  // winners' islands ringed.
  const finished = !holding && snap.result !== null;
  const rows = useMemo(() => (snap.result ? resultRows(snap.events, snap.result, snap.startingCash, RULES_V07) : []), [snap.result, snap.events, snap.startingCash]);
  const winners = useMemo(() => new Set(snap.result?.winners ?? []), [snap.result]);
  const stateOf = (id: string) => ships.find((x) => x.id === id)?.state;

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
            // Your ship shows your cargo; others carry one tarp bundle: neither goods nor count are public (§4).
            <ShipCargo
              key={`cargo-${s.id}`}
              angle={angles[laneOf(s.owner)]!}
              load={s.owner === VIEWER ? myCargo : { ...NO_GOODS, wood: 1 }}
              capacity={s.owner === VIEWER ? GOODS.reduce((n, g) => n + myCargo[g], 0) : 1}
              covered={s.owner !== VIEWER}
              state={stateOf(s.id) === 'docked' ? 'docked' : 'sailing'}
            />
          ))}
        {resolution.scene}
      </TableCanvas>
      <MarketStrip ref={marketRef} board={board} bets={step?.bets} prices={resolution.marketPrices} changed={resolution.changedGoods} />
      {ready && step?.dock && (
        <div ref={dockRef} className="dep-dock">
          {step.dock}
        </div>
      )}
      {ready && (
        <div ref={barRef} className="inv-bar">
          {step?.bar}
          {holding && !rerollShown && resolution.bar}
          {!holding && !step && !cardRequest && !finished && !drafting && !showIslands && (
            <>
              <span>準備中…</span>
              <button type="button" onClick={onRestart}>
                再試一次
              </button>
            </>
          )}
        </div>
      )}
      {step?.overlay}
      {resolution.overlay}
      {ready && drafting && <IslandDraft key={drafting.id} context={drafting.context} onSubmit={(a) => session.submit(drafting.id, a)} />}
      {ready && showIslands && chosen?.type === 'islands-chosen' && <IslandReveal islands={chosen.islands} seats={seats} onClose={() => setIslandsSeen(true)} />}
      {finished && ready && (
        <ResultCard rows={rows} nameOf={nameOf} colorOf={(id) => seats.find((s) => s.id === id)?.color ?? '#888'} viewer={VIEWER} rounds={RULES_V07.rounds} onRestart={onRestart} />
      )}
      {cardRequest && (
        <RerollCard
          context={cardRequest.context}
          board={board}
          viewer={VIEWER}
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
    </div>
  );
}
