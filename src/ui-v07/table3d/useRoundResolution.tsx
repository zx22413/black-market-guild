import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Deployment, GoodId, Goods, MatchEvent, PlayerId, PrivateEvent, ShipId, VoyageEventId } from '../../v07/game';
import type { FitPoint } from '../../ui/scene/CameraRig';
import { TARGET_ISLAND_RADIUS } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import type { ShipState } from '../../ui/scene/tableModel';
import { BeatTag } from '../beats/BeatTag';
import { ReceiptCard } from '../beats/ReceiptCard';
import { buildReceipt, buildShipBeat, resolvedShips, type ShipBeat } from '../beats/shipBeat';
import { useBeatPlayback } from '../beats/useBeatPlayback';
import { ROLE_LABELS } from '../labels';
import { beatLayer } from '../scene/BeatScene';
import type { BeatSeat } from '../scene/beatStage';
import { around } from '../scene/focusMath';
import type { TablePin } from '../scene/TableCanvas';
import { Flights, placePoint, type PlaceContext } from './Flights';
import { MarketCard } from './MarketCard';
import { revealArrows, revealGroups, type RoleArrow } from './revealModel';
import { withGoodIcons } from './GoodIcon';
import { Flow, IconDisc, InfoIcon, artIconUrl } from './icons';
import { LockHint } from './LockHint';
import { RevealChips, SkipButton, StageSteps, WantedBanner, WantedChips } from './ResolveBar';
import { WantedFlag } from '../scene/WantedFlag';
import { RoleArrows } from './RoleArrows';
import { RoleBadges } from './RoleBadges';
import { roleKey, roleResults } from './roleResults';
import { cashSoFar, marketRows, settlementFlights } from './settlementModel';
import { VoyageEventCard, VoyageEventChip } from './VoyageEventCard';

// Everything after the roles are deployed, on the same table (docs/ui/v07-event-presentation.md
// §1.5–§1.9, §2): the roles revealed as arrows, then one beat per ship (yours in full, the others
// at a quicker pace), the market row by row at the harbor, the settlement as flights of coins and
// crates grouped by ship, and your bill. Then the next round.

export type ResolutionStage = 'wanted' | 'event' | 'reveal' | 'voyage' | 'market' | 'settle' | 'receipt';

/** Pace of each part, in ms (initial values to tune in play). */
const PACE = { wanted: 3000, revealGroup: 1600, nextShip: 1000, marketRow: 1000, afterMarket: 1500, flight: 1100, afterSettle: 900 } as const;
const HARBOR_BADGES = [-(TARGET_ISLAND_RADIUS + 3) * Math.SQRT1_2, 0, (TARGET_ISLAND_RADIUS + 3) * Math.SQRT1_2] as const;
/** Ships that do not involve you play this much faster (presentation default, see the doc §4). */
const OTHERS_SPEED = 2.5;

export interface ResolutionInput {
  readonly events: readonly MatchEvent[];
  readonly privateEvents: readonly PrivateEvent[];
  /** The round being resolved, or null when there is none to show. */
  readonly round: number | null;
  /** Hold everything (the reroll card is still open). */
  readonly paused: boolean;
  readonly seats: readonly BeatSeat[];
  readonly angles: readonly number[];
  readonly laneOf: (id: PlayerId) => number;
  /**
   * The seat whose private view is on screen; null on a hot-seat table between turns, when no
   * one's secrets may show (no intel notes, no "你", no personal bill).
   */
  readonly viewer: PlayerId | null;
  readonly nameOf: (id: PlayerId) => string;
  readonly weather: VoyageEventId | null;
  readonly onFinish: () => void;
}

export interface Resolution {
  readonly stage: ResolutionStage | null;
  /** How many events the table should be built from at this point. */
  readonly cutoff: number;
  /** Cash moved by the settlement flights shown so far, on top of the table's cash. */
  readonly cashBonus: Readonly<Record<PlayerId, number>>;
  readonly shipState: (id: ShipId) => ShipState;
  readonly camera: readonly FitPoint[] | null;
  readonly ringed: ReadonlySet<PlayerId> | undefined;
  readonly wrapShip: ((id: ShipId, ship: ReactNode) => ReactNode) | undefined;
  readonly pins: readonly TablePin[];
  readonly scene: ReactNode;
  readonly bar: ReactNode;
  readonly overlay: ReactNode;
  readonly onTableClick: (() => void) | undefined;
  /**
   * During the market beat, the prices for the market strip: the old price until that good's
   * row has been revealed, then the new one (which flashes). Undefined otherwise.
   */
  readonly marketPrices: Goods | undefined;
  readonly changedGoods: ReadonlySet<GoodId> | undefined;
}

/** Counts up by one every `ms` while `running`, from 0 to `max`; restarts when `reset` changes. */
function useTicker(max: number, ms: number, running: boolean, reset: unknown): readonly [number, (n: number) => void] {
  const [n, setN] = useState(0);
  useEffect(() => setN(0), [reset]);
  useEffect(() => {
    if (!running || n >= max) return;
    const timer = setTimeout(() => setN((v) => v + 1), ms);
    return () => clearTimeout(timer);
  }, [running, n, max, ms]);
  return [Math.min(n, max), setN] as const;
}

const lastIndex = (events: readonly MatchEvent[], test: (e: MatchEvent) => boolean): number => {
  let last = -1;
  events.forEach((e, i) => {
    if (test(e)) last = i;
  });
  return last;
};

export function useRoundResolution(input: ResolutionInput): Resolution {
  const { events, privateEvents, round, paused, seats, angles, laneOf, viewer, nameOf, weather, onFinish } = input;
  // Who is wanted this round (§9.6, marked at the round's start): a red flag goes up on their
  // islands for a moment, then the voyage event's card (§5 step 5), then the roles are revealed.
  const wantedIds = useMemo(() => events.flatMap((e) => (e.type === 'wanted-marked' && e.round === round ? e.players : [])), [events, round]);
  const afterWanted: ResolutionStage = weather ? 'event' : 'reveal';
  const firstStage: ResolutionStage = wantedIds.length > 0 ? 'wanted' : afterWanted;
  const [stage, setStage] = useState<ResolutionStage>(firstStage);
  // The caller passes a new function every render; timers call the latest one.
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const finish = () => finishRef.current();
  useEffect(() => setStage(firstStage), [round]); // eslint-disable-line react-hooks/exhaustive-deps
  // The flag stays up for a few seconds (unless skipped), then the event card follows.
  useEffect(() => {
    if (stage !== 'wanted' || paused) return;
    const timer = setTimeout(() => setStage(afterWanted), PACE.wanted);
    return () => clearTimeout(timer);
  }, [stage, paused, afterWanted]);
  const active = round !== null;
  const roundEvents = useMemo(() => (round === null ? [] : events.filter((e) => !('round' in e) || e.round === round)), [events, round]);

  // Who owns which ship this round, from the launch.
  const owners = useMemo(() => {
    const launch = roundEvents.find((e): e is Extract<MatchEvent, { type: 'ships-launched' }> => e.type === 'ships-launched');
    return new Map((launch?.ships ?? []).map((s) => [s.id, s.owner]));
  }, [roundEvents]);
  const outcomes = useMemo(() => new Map(roundEvents.flatMap((e) => (e.type === 'ship-resolved' ? [[e.shipId, e.outcome] as const] : []))), [roundEvents]);

  // Reveal: role groups one by one.
  const groups = useMemo(() => (round === null ? [] : revealGroups(events, round)), [events, round]);
  const [groupsShown, setGroupsShown] = useTicker(groups.length, PACE.revealGroup, active && stage === 'reveal' && !paused, round);
  const arrows = useMemo(
    () => groups.slice(0, groupsShown).flatMap((g, gi) => revealArrows(g, angles, laneOf, (id) => owners.get(id)).map((a) => ({ ...a, group: gi }))),
    [groups, groupsShown, angles, laneOf, owners],
  );

  // Voyage: one beat per ship in resolution order; yours (or ones you sent a role to) in full.
  const beats = useMemo(() => (round === null ? [] : resolvedShips(events, round).flatMap((id) => buildShipBeat(events, id) ?? [])), [events, round]);
  // With no one viewing (hot-seat) every ship plays at full pace: each concerns someone at the table.
  const mine = (b: ShipBeat) =>
    viewer === null || b.owner === viewer || groups.some((g) => g.deployments.some((d) => d.playerId === viewer && (d.targetShipId === b.shipId || d.peekShipId === b.shipId)));
  const [voyageIndex, setVoyageIndex] = useState(0);
  useEffect(() => setVoyageIndex(0), [round]);
  const beat = stage === 'voyage' ? (beats[voyageIndex] ?? null) : null;
  const playback = useBeatPlayback(beat, beat && !mine(beat) ? OTHERS_SPEED : 1, !paused, false);
  const nextShip = () => {
    if (voyageIndex + 1 < beats.length) setVoyageIndex(voyageIndex + 1);
    else setStage('market');
  };
  useEffect(() => {
    if (stage !== 'voyage' || !playback.view.done) return;
    const timer = setTimeout(nextShip, PACE.nextShip);
    return () => clearTimeout(timer);
  }); // re-armed on every render while the beat is done

  // Market rows, then the settlement flights.
  const cardDemand = useMemo(() => {
    const d = roundEvents.find((e): e is Extract<MatchEvent, { type: 'demand-revealed' }> => e.type === 'demand-revealed');
    return d?.demand ?? { wood: 0, iron: 0, spice: 0, arms: 0 };
  }, [roundEvents]);
  const rows = useMemo(() => (round === null ? [] : marketRows(events, round, cardDemand)), [events, round, cardDemand]);
  const [rowsShown, setRowsShown] = useTicker(rows.length, PACE.marketRow, stage === 'market', `${round}-market`);
  const flights = useMemo(() => (round === null ? [] : settlementFlights(events, round)), [events, round]);
  const [flightsShown, setFlightsShown] = useTicker(flights.length, PACE.flight, stage === 'settle', `${round}-settle`);
  useEffect(() => {
    if (stage === 'market' && rowsShown >= rows.length) {
      const timer = setTimeout(() => setStage('settle'), PACE.afterMarket);
      return () => clearTimeout(timer);
    }
    if (stage === 'settle' && flightsShown >= flights.length) {
      // The bill is personal: with no one viewing (hot-seat between turns) the round just ends.
      const timer = setTimeout(() => (viewer === null ? finish() : setStage('receipt')), PACE.afterSettle);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [stage, rowsShown, rows.length, flightsShown, flights.length, viewer]); // finish reads a ref

  // How far the table is built at each stage.
  const cutoff = useMemo(() => {
    if (round === null) return events.length;
    const revealEnd = lastIndex(events, (e) => e.type === 'roles-revealed' && e.round === round) + 1;
    // Before the event is announced the table does not know it yet: stop just short of it.
    const eventAt = lastIndex(events, (e) => e.type === 'voyage-event-revealed' && e.round === round);
    if (stage === 'wanted') return eventAt >= 0 ? eventAt : revealEnd;
    if (stage === 'event' || stage === 'reveal' || stage === 'voyage') return revealEnd;
    if (stage === 'market' || stage === 'settle') return lastIndex(events, (e) => e.type === 'market-settled' && e.round === round) + 1;
    return lastIndex(events, (e) => e.type === 'round-ended' && e.round === round) + 1;
  }, [events, round, stage]);

  const restingState = (id: ShipId): ShipState => (outcomes.get(id) === 'sank' ? 'sunk' : outcomes.get(id) === 'arrived' ? 'arrived' : 'sailing');
  const tag = beat ? <BeatTag beat={beat} view={playback.view} names={Object.fromEntries(seats.map((s) => [s.id, s.name]))} viewer={viewer} /> : null;
  const layer = beat ? beatLayer({ beat, view: playback.view, angles, laneOf, weather, tag, seats }) : null;
  const shipState = (id: ShipId): ShipState => {
    if (stage === 'reveal') return 'sailing';
    if (stage === 'voyage') {
      const at = beats.findIndex((b) => b.shipId === id);
      if (at < voyageIndex) return restingState(id);
      if (at === voyageIndex && layer) return layer.focusState;
      return 'sailing';
    }
    return restingState(id);
  };

  if (!active) {
    return { stage: null, cutoff: events.length, cashBonus: {}, shipState: () => 'docked', camera: null, ringed: undefined, wrapShip: undefined, pins: [], scene: null, bar: null, overlay: null, onTableClick: undefined, marketPrices: undefined, changedGoods: undefined };
  }

  const colorOf = (id: string) => seats.find((s) => s.id === id)?.color ?? '#888';
  const olderArrows = new Set(arrows.filter((a) => stage !== 'reveal' || a.group < groupsShown - 1).map((a) => a.key));
  const showArrows = stage === 'reveal' || stage === 'voyage';
  // During the voyage only the arrows at the ship being played stay: the rest would cross the close-up.
  const shownArrows: readonly RoleArrow[] = stage === 'voyage' ? arrows.filter((a) => beat !== null && a.targetShipId === beat.shipId) : arrows;
  // Only your intel merchant's dice, low-key, while the reveal is on (§4).
  const intelPins: TablePin[] = [];
  if (stage === 'reveal') {
    const seen = new Map<string, { raw: number | null; rerolled: number | null }>();
    for (const e of privateEvents) {
      if (e.playerId !== viewer || (e.type !== 'intel-report' && e.type !== 'intel-reroll-result') || e.round !== round) continue;
      const known = seen.get(e.shipId) ?? { raw: null, rerolled: null };
      seen.set(e.shipId, e.type === 'intel-report' ? { ...known, raw: e.rawRoll } : { ...known, rerolled: e.rerolledRoll });
    }
    for (const [shipId, k] of seen) {
      const owner = owners.get(shipId);
      if (!owner) continue;
      const p = shipPose(angles[laneOf(owner)]!, 'sailing').position;
      intelPins.push({
        id: `intel-${shipId}`,
        position: [p.x, 0, p.z + 4],
        node: (
          <span className="secret-chip" title="只有你知道">
            {k.rerolled !== null ? <Flow from={k.raw ?? '?'} to={<b>{k.rerolled}</b>} /> : `原始骰值 ${k.raw ?? '?'}`}
          </span>
        ),
      });
    }
  }

  // Settlement: the flight in the air and its label at the destination.
  const placeCtx: PlaceContext = { angles, laneOf, ships: new Map([...owners].map(([id, owner]) => [id, { owner, state: restingState(id) }])) };
  const flying = stage === 'settle' && flightsShown > 0 ? flights[flightsShown - 1]! : null;
  const flightPins: TablePin[] = flying
    ? [
        {
          id: `flight-${flying.key}`,
          position: placePoint(flying.to, placeCtx),
          node: (
            <span key={flying.key} className={`flight-chip ${flying.amount !== null && flying.amount < 0 ? 'down' : ''}`} style={{ borderColor: colorOf(flying.playerId) }}>
              {flying.amount !== null && <b>{flying.amount >= 0 ? '+' : '−'}{Math.abs(flying.amount)} G</b>} {flying.playerId === viewer ? '你' : nameOf(flying.playerId)} · {withGoodIcons(flying.label)}
            </span>
          ),
        },
      ]
    : [];
  // Role badges hang on what each role targeted, ringed in the sender's color, from its reveal
  // until the bill (the lighthouse's extra look stays low-key: no badge).
  // Roles stay secret until the reveal: no badges while the flag and the event card are up.
  const badgeGroups = stage === 'reveal' ? groups.slice(0, groupsShown) : stage === 'receipt' || stage === 'wanted' || stage === 'event' ? [] : groups;
  const badgeCtx: PlaceContext = { angles, laneOf, ships: new Map([...owners].map(([id, owner]) => [id, { owner, state: shipState(id) }])) };
  const onShips = new Map<ShipId, Deployment[]>();
  const onHarbor: Deployment[] = [];
  for (const g of badgeGroups) {
    for (const d of g.deployments) {
      if (d.role === 'broker') onHarbor.push(d);
      else if (d.targetShipId) onShips.set(d.targetShipId, [...(onShips.get(d.targetShipId) ?? []), d]);
    }
  }
  const nameOrYou = (id: PlayerId) => (id === viewer ? '你' : nameOf(id));
  // A badge is stamped once what it came to is on screen: its ship's outcome, or the market for brokers.
  const results = round === null ? new Map() : roleResults(events, round);
  const shipDone = (shipId: ShipId): boolean => {
    if (stage === 'market' || stage === 'settle') return true;
    const at = beats.findIndex((b) => b.shipId === shipId);
    return stage === 'voyage' && at >= 0 && (at < voyageIndex || (at === voyageIndex && playback.view.showOutcome));
  };
  const marketDone = stage === 'settle' || (stage === 'market' && rowsShown >= rows.length);
  const stamp = (d: Deployment) => {
    const result = results.get(roleKey(d));
    return result && (result.shipId === null ? marketDone : shipDone(result.shipId)) ? result : null;
  };
  const badgePins: TablePin[] = [
    ...[...onShips].map(([shipId, ds]): TablePin => {
      const [x, , z] = placePoint({ kind: 'ship', shipId }, badgeCtx);
      return { id: `badges-${shipId}`, position: [x, 0, z + 4.5], node: <RoleBadges deployments={ds} colorOf={colorOf} nameOf={nameOrYou} stamp={stamp} /> };
    }),
    // Brokers bet on the market: their badges hang at the harbor, on its front-left diagonal where
    // no lane runs (so they never look like they sit on a ship).
    ...(onHarbor.length > 0 ? [{ id: 'badges-harbor', position: HARBOR_BADGES, node: <RoleBadges deployments={onHarbor} colorOf={colorOf} nameOf={nameOrYou} stamp={stamp} /> }] : []),
  ];

  const marketPins: TablePin[] =
    stage === 'market' ? [{ id: 'market-card', position: [0, 10, 0], node: <MarketCard rows={rows} shown={rowsShown} /> }] : [];

  const camera: readonly FitPoint[] | null =
    stage === 'voyage' ? (layer?.camera ?? null) : stage === 'market' ? [...around([0, 0, 0], 20), { position: [0, 10, 0], clearance: 220 }] : null;

  const current = groups[Math.max(0, groupsShown - 1)];
  const allRevealed = groupsShown >= groups.length;
  const go = (label: string, action: () => void) => (
    <button type="button" className="primary" onClick={action}>
      {label}
    </button>
  );
  const owner = beat ? (beat.owner === viewer ? '你' : nameOf(beat.owner)) : '';
  const wantedSeats = wantedIds.map((id) => ({ name: id === viewer ? '你' : nameOf(id), color: colorOf(id) }));
  const bar = (
    <>
      <StageSteps stage={stage ?? 'event'} />
      {stage === 'wanted' ? (
        <>
          <WantedChips seats={wantedSeats} />
          <SkipButton label="跳過" onClick={() => setStage(afterWanted)} />
        </>
      ) : stage === 'event' ? (
        go('繼續', () => setStage('reveal'))
      ) : stage === 'reveal' ? (
        <>
          {groups.length === 0 ? <span className="chip muted">沒有人部署角色</span> : <RevealChips groups={groups} shown={groupsShown} />}
          {allRevealed ? go(beats.length > 0 ? '開始航程' : '繼續', () => setStage(beats.length > 0 ? 'voyage' : 'market')) : <SkipButton label="全部揭露" onClick={() => setGroupsShown(groups.length)} />}
        </>
      ) : stage === 'voyage' ? (
        <>
          <span className={`bar-chips ${beat && !mine(beat) ? 'dim' : ''}`} title={beat && !mine(beat) ? '和你無關，快速帶過' : undefined}>
            <span className="chip">
              <i className="seat-dot" style={{ background: beat ? colorOf(beat.owner) : '#888' }} />
              {owner}
            </span>
            <span className="chip">
              {voyageIndex + 1}/{beats.length}
            </span>
          </span>
          <SkipButton label="跳過航程" onClick={() => setStage('market')} />
        </>
      ) : stage === 'market' ? (
        <>
          <LockHint icon={<InfoIcon />} text="到港量和需求比較，決定新價格；這回合的貨都用新價格賣。" />
          <SkipButton label="跳過" onClick={() => setStage('settle')} />
        </>
      ) : stage === 'settle' ? (
        <>
          <span className="bar-chips">
            <span className="chip">
              <IconDisc src={artIconUrl('coin')} />
              {flightsShown}/{flights.length}
            </span>
            {flying && <span className="chip">{withGoodIcons(flying.label)}</span>}
          </span>
          <SkipButton label={viewer === null ? '跳過結帳' : '跳到帳單'} onClick={() => (viewer === null ? finish() : setStage('receipt'))} />
        </>
      ) : null}
    </>
  );

  const receipt = round !== null && viewer !== null ? buildReceipt(events, round, viewer) : { lines: [], net: 0 };
  const revealedRows = rows.slice(0, rowsShown);
  const marketPrices =
    stage === 'market' && rows.length > 0
      ? (Object.fromEntries(rows.map((r) => [r.good, revealedRows.includes(r) ? r.after : r.before])) as Goods)
      : undefined;
  const changedGoods = stage === 'market' ? new Set(revealedRows.filter((r) => r.after !== r.before).map((r) => r.good)) : undefined;
  return {
    stage,
    cutoff,
    cashBonus: stage === 'settle' ? cashSoFar(flights, flightsShown) : {},
    shipState,
    camera,
    ringed: layer?.ringed,
    wrapShip: layer?.wrapShip,
    pins: [...badgePins, ...intelPins, ...(layer?.pins ?? []), ...marketPins, ...flightPins],
    scene: (
      <>
        {stage === 'wanted' && wantedIds.map((id) => <WantedFlag key={`${round}-${id}`} angle={angles[laneOf(id)]!} />)}
        {showArrows && <RoleArrows arrows={shownArrows} colorOf={colorOf} dimmed={(a) => olderArrows.has(a.key)} />}
        {layer?.scene}
        {flying && <Flights key={flying.key} flights={[flying]} ctx={placeCtx} />}
      </>
    ),
    bar,
    overlay: (
      <>
        {stage === 'wanted' && <WantedBanner seats={wantedSeats} />}
        {weather && stage !== 'wanted' && stage !== 'event' && stage !== 'receipt' && <VoyageEventChip event={weather} />}
        {weather && stage === 'event' && <VoyageEventCard key={round} event={weather} onDone={() => setStage('reveal')} />}
        {stage === 'receipt' && viewer !== null ? <ReceiptCard round={round!} viewer={viewer} lines={receipt.lines} net={receipt.net} onClose={finish} /> : null}
      </>
    ),
    onTableClick: stage === 'voyage' ? () => (playback.next() ? undefined : nextShip()) : undefined,
    marketPrices,
    changedGoods,
  };
}
