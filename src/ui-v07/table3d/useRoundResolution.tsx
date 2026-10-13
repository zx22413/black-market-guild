import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MatchEvent, PlayerId, PrivateEvent, ShipId, VoyageEventId } from '../../v07/game';
import type { FitPoint } from '../../ui/scene/CameraRig';
import { shipPose } from '../../ui/scene/Ships';
import type { ShipState } from '../../ui/scene/tableModel';
import { BeatTag } from '../beats/BeatTag';
import { ReceiptCard } from '../beats/ReceiptCard';
import { buildReceipt, buildShipBeat, resolvedShips, type ShipBeat } from '../beats/shipBeat';
import { useBeatPlayback } from '../beats/useBeatPlayback';
import { ROLE_LABELS, VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT } from '../labels';
import { beatLayer } from '../scene/BeatScene';
import type { BeatSeat } from '../scene/beatStage';
import { around } from '../scene/focusMath';
import type { TablePin } from '../scene/TableCanvas';
import { Flights, placePoint, type PlaceContext } from './Flights';
import { MarketCard } from './MarketCard';
import { arrowPoint, revealArrows, revealGroups, type RoleArrow } from './revealModel';
import { RoleArrows } from './RoleArrows';
import { cashSoFar, marketRows, settlementFlights } from './settlementModel';

// Everything after the roles are deployed, on the same table (docs/ui/v07-event-presentation.md
// §1.5–§1.9, §2): the roles revealed as arrows, then one beat per ship (yours in full, the others
// at a quicker pace), the market row by row at the harbor, the settlement as flights of coins and
// crates grouped by ship, and your bill. Then the next round.

export type ResolutionStage = 'reveal' | 'voyage' | 'market' | 'settle' | 'receipt';

/** Pace of each part, in ms (initial values to tune in play). */
const PACE = { revealGroup: 1600, nextShip: 700, marketRow: 1000, afterMarket: 1500, flight: 1100, afterSettle: 900 } as const;
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
  readonly viewer: PlayerId;
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
  const [stage, setStage] = useState<ResolutionStage>('reveal');
  useEffect(() => setStage('reveal'), [round]);
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
  const mine = (b: ShipBeat) => b.owner === viewer || groups.some((g) => g.deployments.some((d) => d.playerId === viewer && (d.targetShipId === b.shipId || d.peekShipId === b.shipId)));
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
      const timer = setTimeout(() => setStage('receipt'), PACE.afterSettle);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [stage, rowsShown, rows.length, flightsShown, flights.length]);

  // How far the table is built at each stage.
  const cutoff = useMemo(() => {
    if (round === null) return events.length;
    const revealEnd = lastIndex(events, (e) => e.type === 'roles-revealed' && e.round === round) + 1;
    if (stage === 'reveal' || stage === 'voyage') return revealEnd;
    if (stage === 'market' || stage === 'settle') return lastIndex(events, (e) => e.type === 'market-settled' && e.round === round) + 1;
    return lastIndex(events, (e) => e.type === 'round-ended' && e.round === round) + 1;
  }, [events, round, stage]);

  const restingState = (id: ShipId): ShipState => (outcomes.get(id) === 'sank' ? 'sunk' : outcomes.get(id) === 'arrived' ? 'arrived' : 'sailing');
  const tag = beat ? <BeatTag beat={beat} view={playback.view} names={Object.fromEntries(seats.map((s) => [s.id, s.name]))} viewer={viewer} /> : null;
  const layer = beat ? beatLayer({ beat, view: playback.view, angles, laneOf, weather, tag }) : null;
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
    return { stage: null, cutoff: events.length, cashBonus: {}, shipState: () => 'docked', camera: null, ringed: undefined, wrapShip: undefined, pins: [], scene: null, bar: null, overlay: null, onTableClick: undefined };
  }

  const colorOf = (id: string) => seats.find((s) => s.id === id)?.color ?? '#888';
  const olderArrows = new Set(arrows.filter((a) => stage !== 'reveal' || a.group < groupsShown - 1).map((a) => a.key));
  const showArrows = stage === 'reveal' || stage === 'voyage';
  // During the voyage only the arrows at the ship being played stay: the rest would cross the close-up.
  const shownArrows: readonly RoleArrow[] = stage === 'voyage' ? arrows.filter((a) => beat !== null && a.targetShipId === beat.shipId) : arrows;
  const arrowPins: TablePin[] =
    stage === 'reveal'
      ? arrows
          .filter((a) => !a.faint)
          .map((a) => ({
            id: `arrow-${a.key}`,
            position: arrowPoint(a, 0.5),
            node: (
              <span className={`arrow-chip ${olderArrows.has(a.key) ? 'dim' : ''}`} style={{ borderColor: colorOf(a.playerId) }}>
                {a.label} · {a.playerId === viewer ? '你' : nameOf(a.playerId)}
              </span>
            ),
          }))
      : [];

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
        node: <span className="secret-chip">只有你知道：原始骰值 {k.raw ?? '?'}{k.rerolled !== null ? ` → 重擲後 ${k.rerolled}` : ''}</span>,
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
              {flying.amount !== null && <b>{flying.amount >= 0 ? '+' : '−'}{Math.abs(flying.amount)} G</b>} {flying.playerId === viewer ? '你' : nameOf(flying.playerId)} · {flying.label}
            </span>
          ),
        },
      ]
    : [];
  const marketPins: TablePin[] =
    stage === 'market' ? [{ id: 'market-card', position: [0, 10, 0], node: <MarketCard rows={rows} shown={rowsShown} /> }] : [];

  const camera: readonly FitPoint[] | null =
    stage === 'voyage' ? (layer?.camera ?? null) : stage === 'market' ? [...around([0, 0, 0], 20), { position: [0, 10, 0], clearance: 220 }] : null;

  const current = groups[Math.max(0, groupsShown - 1)];
  const allRevealed = groupsShown >= groups.length;
  const skip = (label: string, action: () => void, primary = false) => (
    <button type="button" className={primary ? 'primary' : ''} onClick={action}>
      {label}
    </button>
  );
  const bar =
    stage === 'reveal' ? (
      <>
        <span>
          {weather && (
            <>
              航海事件：<b>{VOYAGE_EVENT_LABELS[weather]}</b>（{VOYAGE_EVENT_TEXT[weather]}）
            </>
          )}
          {groups.length === 0 ? '這回合沒有人部署角色。' : allRevealed ? `角色全部揭露：${groups.map((g) => `${ROLE_LABELS[g.role]}${g.deployments.length > 1 ? `×${g.deployments.length}` : ''}`).join('、')}` : `角色揭露：${current ? ROLE_LABELS[current.role] : ''}（${groupsShown}/${groups.length}）`}
        </span>
        {allRevealed ? skip(beats.length > 0 ? '開始航程' : '到黑市', () => setStage(beats.length > 0 ? 'voyage' : 'market'), true) : skip('全部揭露', () => setGroupsShown(groups.length))}
      </>
    ) : stage === 'voyage' ? (
      <>
        <span>
          航程 {voyageIndex + 1}/{beats.length}：{beat ? (beat.owner === viewer ? '你的船' : `${nameOf(beat.owner)}的船`) : ''}
          {beat && !mine(beat) && <small>（和你無關，快速帶過）</small>}
        </span>
        {skip('跳過航程', () => setStage('market'))}
      </>
    ) : stage === 'market' ? (
      <>
        <span>黑市成交：到港量和需求比，決定新價格；這回合的貨都用新價格賣（§7.3）。</span>
        {skip('跳過', () => setStage('settle'))}
      </>
    ) : stage === 'settle' ? (
      <>
        <span>結帳 {flightsShown}/{flights.length}{flying ? `：${flying.label}` : ''}</span>
        {skip('跳到帳單', () => setStage('receipt'))}
      </>
    ) : (
      <span>本回合帳單</span>
    );

  const receipt = round !== null ? buildReceipt(events, round, viewer) : { lines: [], net: 0 };
  return {
    stage,
    cutoff,
    cashBonus: stage === 'settle' ? cashSoFar(flights, flightsShown) : {},
    shipState,
    camera,
    ringed: layer?.ringed,
    wrapShip: layer?.wrapShip,
    pins: [...arrowPins, ...intelPins, ...(layer?.pins ?? []), ...marketPins, ...flightPins],
    scene: (
      <>
        {showArrows && <RoleArrows arrows={shownArrows} colorOf={colorOf} dimmed={(a) => olderArrows.has(a.key)} />}
        {layer?.scene}
        {flying && <Flights key={flying.key} flights={[flying]} ctx={placeCtx} />}
      </>
    ),
    bar,
    overlay: stage === 'receipt' ? <ReceiptCard round={round!} viewer={viewer} lines={receipt.lines} net={receipt.net} onClose={onFinish} /> : null,
    onTableClick: stage === 'voyage' ? () => (playback.next() ? undefined : nextShip()) : undefined,
  };
}
