import { useEffect, useMemo, useState } from 'react';
import { GOODS, type Action, type Goods, type PlayerId } from '../../v07/game';
import type { SeatConfig } from '../../v07/match';
import type { SafeArea } from '../../ui/scene/CameraRig';
import { shipPose } from '../../ui/scene/Ships';
import { VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT } from '../labels';
import { beatSeats } from '../scene/beatStage';
import { ShipCargo } from '../scene/InvestIsland';
import { TableCanvas, overviewPoints, useTableLayout, type TablePin, type TableShip } from '../scene/TableCanvas';
import { buildBoard } from '../session/board';
import { startGameSession, type GameSession } from '../session/gameSession';
import { useSession } from '../session/useSession';
import { MarketStrip } from '../table3d/MarketStrip';
import { RerollCard } from '../table3d/RerollCard';
import { RoleArrows } from '../table3d/RoleArrows';
import { arrowPoint, revealArrows, revealGroups } from '../table3d/revealModel';
import { seatPlates } from '../table3d/seatPlates';
import type { StageEnv } from '../table3d/stage';
import { useDeployStep } from '../table3d/useDeployStep';
import { useInvestStep } from '../table3d/useInvestStep';
import { ROLE_LABELS } from '../labels';

// Dev-only: a whole round on the 3D table, at /v07.html?dev=round3d (also ?dev=invest3d), &seed=3.
// A real local match (you against three bots), one table that stays mounted: invest on your
// island → deploy a role → (intel reroll) → the roles revealed as arrows. The voyage resolution is
// the separate ship-beat prototype (?dev=beat3d); here "下一回合" skips to the next investment.

const SEATS: SeatConfig[] = [
  { kind: 'local-human', name: '你' },
  { kind: 'bot', name: '黑潮會', strategy: 'aggressive' },
  { kind: 'bot', name: '金錨公會', strategy: 'balanced' },
  { kind: 'bot', name: '霧港商團', strategy: 'builder' },
];
const VIEWER: PlayerId = 'p1';
/** The market strip above and the bar (with the role hand) below stay clear of the table. */
const SAFE: SafeArea = { top: 70, bottom: 96, left: 24, right: 24 };
const SAFE_WITH_HAND: SafeArea = { ...SAFE, bottom: 250 };
/** One reveal group (all the pirates, say) every this many ms. */
const REVEAL_STEP_MS = 1600;
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

  // The island draft is not what this page tests: take the first offer.
  // StrictMode runs effects twice in development, so submit only while the request is still open.
  useEffect(() => {
    if (request?.context.decision.phase !== 'island-choice') return;
    if (session.getSnapshot().requests.some((r) => r.id === request.id)) session.submit(request.id, request.context.legalActions[0]!);
  }, [request, session]);

  // The bots answer at once, so after you deploy the whole round has already been played out.
  // Hold the table at the end of the role reveal until you move on.
  const [dismissed, setDismissed] = useState(0);
  const revealRound = useMemo(() => {
    const rounds = snap.events.flatMap((e) => (e.type === 'roles-revealed' && e.round > dismissed ? [e.round] : []));
    return rounds.length > 0 ? Math.min(...rounds) : null;
  }, [snap.events, dismissed]);
  const cutoff = useMemo(() => {
    if (revealRound === null) return snap.events.length;
    let last = -1;
    snap.events.forEach((e, i) => {
      if (e.type === 'roles-revealed' && e.round === revealRound) last = i;
    });
    return last + 1;
  }, [snap.events, revealRound]);
  const events = useMemo(() => snap.events.slice(0, cutoff), [snap.events, cutoff]);

  const ids = snap.players.map((p) => p.id);
  const board = useMemo(() => buildBoard(ids, snap.startingCash, events), [events, snap.startingCash]);
  const names = useMemo(() => Object.fromEntries(snap.players.map((p) => [p.id, p.name])), [snap.players]);
  const nameOf = (id: PlayerId) => names[id] ?? id;
  const seats = useMemo(
    () => beatSeats(snap.players, VIEWER, Object.fromEntries(ids.map((id) => [id, board.players[id]?.buildings ?? []]))),
    [snap.players, board],
  );
  const { angles, laneOf } = useTableLayout(seats);

  const holding = revealRound !== null;
  const phase = request?.context.decision.phase;
  const env: StageEnv | null =
    request && !holding && (phase === 'invest' || phase === 'role-deployment')
      ? { request, board, seats, angles, laneOf, viewer: VIEWER, nameOf, submit: (a: Action) => session.submit(request.id, a) }
      : null;
  const invest = useInvestStep(env);
  const deploy = useDeployStep(env);
  const step = invest ?? deploy;
  const rerolling = !holding && request && phase === 'intel-reroll' ? request : null;

  // Reveal the role groups one by one.
  const groups = useMemo(() => (revealRound === null ? [] : revealGroups(snap.events, revealRound)), [snap.events, revealRound]);
  const [groupsShown, setGroupsShown] = useState(0);
  useEffect(() => {
    setGroupsShown(0);
    if (revealRound === null) return;
    const timer = setInterval(() => setGroupsShown((n) => n + 1), REVEAL_STEP_MS);
    return () => clearInterval(timer);
  }, [revealRound]);
  // The timer may run past the last group; everything below counts at most all of them.
  const revealedCount = Math.min(groupsShown, groups.length);
  const shownGroups = useMemo(() => groups.slice(0, revealedCount), [groups, revealedCount]);
  const shipOwner = (id: string) => board.ships.find((s) => s.id === id)?.owner;
  // Memoized: each arrow builds a tube geometry, so keep the same objects between renders.
  const arrows = useMemo(
    () => shownGroups.flatMap((g, gi) => revealArrows(g, angles, (id) => Math.max(0, seats.findIndex((s) => s.id === id)), (id) => board.ships.find((s) => s.id === id)?.owner).map((a) => ({ ...a, group: gi }))),
    [shownGroups, angles, seats, board.ships],
  );
  const colorOf = (id: string) => seats.find((s) => s.id === id)?.color ?? '#888';
  // Earlier groups fade a little once the next one appears.
  const olderArrows = new Set(arrows.filter((a) => a.group < revealedCount - 1).map((a) => a.key));

  // Ships: at the dock until the voyage event is out, then at sea; your own cargo is yours to see.
  const shipState = board.voyageEvent ? 'sailing' : 'docked';
  const ships: TableShip[] = board.ships.map((s) => {
    const base: TableShip = { id: s.id, owner: s.owner, state: shipState };
    return step?.ship ? step.ship(base) : base;
  });
  const loaded = snap.privateEvents.filter((e) => e.type === 'cargo-loaded' && e.playerId === VIEWER && e.round === board.round);
  const lastLoaded = loaded[loaded.length - 1];
  const myCargo = lastLoaded?.type === 'cargo-loaded' ? lastLoaded.cargo : NO_GOODS;

  // Only your intel merchant's dice, low-key, during the reveal (§4): one line per ship looked at.
  const intelPins: TablePin[] = [];
  if (holding) {
    const seen = new Map<string, { raw: number | null; rerolled: number | null }>();
    for (const e of snap.privateEvents) {
      if (e.playerId !== VIEWER || (e.type !== 'intel-report' && e.type !== 'intel-reroll-result') || e.round !== revealRound) continue;
      const known = seen.get(e.shipId) ?? { raw: null, rerolled: null };
      seen.set(e.shipId, e.type === 'intel-report' ? { ...known, raw: e.rawRoll } : { ...known, rerolled: e.rerolledRoll });
    }
    for (const [shipId, k] of seen) {
      const owner = shipOwner(shipId);
      if (!owner) continue;
      const p = shipPose(angles[laneOf(owner)]!, 'sailing').position;
      const text = `原始骰值 ${k.raw ?? '?'}${k.rerolled !== null ? ` → 重擲後 ${k.rerolled}` : ''}`;
      intelPins.push({ id: `intel-${shipId}`, position: [p.x, 0, p.z + 4], node: <span className="secret-chip">只有你知道：{text}</span> });
    }
  }

  const plates = seatPlates(seats, angles, board, (id) => {
    if (holding || !request) return '';
    const kind = snap.players.find((p) => p.id === id)?.kind;
    return kind === 'local-human' ? '決定中' : '已決定';
  });
  const arrowPins: TablePin[] = arrows
    .filter((a) => !a.faint)
    .map((a) => ({
      id: `arrow-${a.key}`,
      position: arrowPoint(a, 0.5),
      node: (
        <span className={`arrow-chip ${a.group < revealedCount - 1 ? 'dim' : ''}`} style={{ borderColor: colorOf(a.playerId) }}>
          {a.label} · {a.playerId === VIEWER ? '你' : nameOf(a.playerId)}
        </span>
      ),
    }));
  const pins = [...plates, ...(step?.pins ?? []), ...arrowPins, ...intelPins];
  const camera = step?.camera ?? overviewPoints(angles);
  const latest = groups[revealedCount - 1];
  const allRevealed = revealedCount >= groups.length;

  return (
    <div className="beat-preview">
      <TableCanvas
        seats={seats}
        weather={board.voyageEvent}
        ships={ships}
        cameraPoints={camera}
        safe={step?.dock ? SAFE_WITH_HAND : SAFE}
        pins={pins}
        onReady={() => setReady(true)}
        {...(step?.onSelectShip ? { onSelectShip: step.onSelectShip } : {})}
      >
        {step?.scene}
        {board.ships.map((s) => (
          // Your ship shows your cargo; others carry one tarp bundle: neither goods nor count are public (§4).
          <ShipCargo
            key={`cargo-${s.id}`}
            angle={angles[laneOf(s.owner)]!}
            load={s.owner === VIEWER ? myCargo : { ...NO_GOODS, wood: 1 }}
            capacity={s.owner === VIEWER ? GOODS.reduce((n, g) => n + myCargo[g], 0) : 1}
            covered={s.owner !== VIEWER}
            state={shipState}
          />
        ))}
        <RoleArrows arrows={arrows} colorOf={colorOf} dimmed={(a) => olderArrows.has(a.key)} />
      </TableCanvas>
      <MarketStrip board={board} bets={step?.bets} />
      {ready && step?.dock && <div className="dep-dock">{step.dock}</div>}
      {ready && (
        <div className="inv-bar">
          {step?.bar}
          {holding && (
            <>
              <span>
                {board.voyageEvent && (
                  <>
                    航海事件：<b>{VOYAGE_EVENT_LABELS[board.voyageEvent]}</b>（{VOYAGE_EVENT_TEXT[board.voyageEvent]}）
                  </>
                )}
                {groups.length === 0
                  ? '這回合沒有人部署角色。'
                  : allRevealed
                    ? `角色全部揭露：${groups.map((g) => `${ROLE_LABELS[g.role]}${g.deployments.length > 1 ? `×${g.deployments.length}` : ''}`).join('、')}`
                    : latest
                      ? `角色揭露：${ROLE_LABELS[latest.role]}（${revealedCount}/${groups.length}）`
                      : '角色揭露…'}
              </span>
              <button type="button" className={allRevealed ? 'primary' : ''} onClick={() => (allRevealed ? setDismissed(revealRound ?? 0) : setGroupsShown(groups.length))}>
                {allRevealed ? '下一回合（航程結算見 ?dev=beat3d）' : '全部揭露'}
              </button>
            </>
          )}
          {!holding && !step && !rerolling && (
            <>
              <span>{snap.status === 'finished' ? '對局結束。' : '準備中…'}</span>
              <button type="button" onClick={onRestart}>
                再試一次
              </button>
            </>
          )}
        </div>
      )}
      {step?.overlay}
      {rerolling && <RerollCard context={rerolling.context} board={board} viewer={VIEWER} nameOf={nameOf} onSubmit={(a) => session.submit(rerolling.id, a)} />}
    </div>
  );
}
