import { useMemo, useState } from 'react';
import type { BuildingId, MatchEvent, PlayerId, VoyageEventId } from '../../v07/game';
import { RULES_V07 } from '../../v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../v07/match';
import type { SafeArea } from '../../ui/scene/CameraRig';
import { devWeatherOverride } from '../../ui/scene/weather';
import { ReceiptCard } from '../beats/ReceiptCard';
import { BeatTag } from '../beats/BeatTag';
import { buildReceipt, buildShipBeat, type ShipBeat } from '../beats/shipBeat';
import { useBeatPlayback } from '../beats/useBeatPlayback';
import { VOYAGE_EVENT_LABELS } from '../labels';
import { buildBoard } from '../session/board';
import { BeatScene } from '../scene/BeatScene';
import { beatSeats } from '../scene/beatStage';

// Dev-only: one ship beat played on the 3D table, at /v07.html?dev=beat3d (&seed=7,
// &weather=storm to force a sea). Seeded all-bot match, public events only; the first seat is "你".

const SEATS: SeatConfig[] = [
  { kind: 'bot', name: '你', strategy: 'aggressive' },
  { kind: 'bot', name: '黑潮會', strategy: 'aggressive' },
  { kind: 'bot', name: '金錨公會', strategy: 'balanced' },
  { kind: 'bot', name: '霧港商團', strategy: 'builder' },
];
const VIEWER: PlayerId = 'p1';
/** The dev bar above and the playback buttons below stay clear of the table. */
const SAFE: SafeArea = { top: 56, bottom: 64, left: 24, right: 24 };

const interest = (b: ShipBeat): number =>
  (b.steps.some((s) => s.kind === 'pirate') ? 4 : 0) + (b.outcome === 'sank' ? 2 : 0) + (b.steps.length > 1 ? 1 : 0);

function roundStage(events: readonly MatchEvent[], beat: ShipBeat, playerIds: readonly PlayerId[]) {
  // The table as it stood when the round's ships set out: everything before the first resolution.
  const firstResolved = events.findIndex((e) => e.type === 'ship-resolved' && e.round === beat.round);
  const board = buildBoard(playerIds, RULES_V07.startingCash, events.slice(0, firstResolved), RULES_V07);
  const buildings: Record<PlayerId, readonly BuildingId[]> = Object.fromEntries(playerIds.map((id) => [id, board.players[id]?.buildings ?? []]));
  const launched = events.find((e): e is Extract<MatchEvent, { type: 'ships-launched' }> => e.type === 'ships-launched' && e.round === beat.round);
  return { buildings, ships: launched?.ships.map((s) => ({ id: s.id, owner: s.owner })) ?? [], weather: board.voyageEvent };
}

function Stage({ beat, events, players, weather }: { readonly beat: ShipBeat; readonly events: readonly MatchEvent[]; readonly players: readonly { id: PlayerId; name: string }[]; readonly weather: VoyageEventId | null }) {
  const [ready, setReady] = useState(false);
  const playback = useBeatPlayback(beat, 1, ready);
  const [receipt, setReceipt] = useState(false);
  const names = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name])), [players]);
  const stage = useMemo(() => roundStage(events, beat, players.map((p) => p.id)), [events, beat, players]);
  const seats = useMemo(() => beatSeats(players, VIEWER, stage.buildings), [players, stage]);
  return (
    <>
      <BeatScene
        seats={seats}
        ships={stage.ships}
        beat={beat}
        view={playback.view}
        weather={weather ?? stage.weather}
        safe={SAFE}
        onReady={() => setReady(true)}
        onClick={() => (playback.next() ? undefined : setReceipt(true))}
        tag={<BeatTag beat={beat} view={playback.view} names={names} viewer={VIEWER} />}
      />
      {ready && !receipt && (
        <div className="beat3d-controls">
          <button type="button" onClick={() => playback.jump(0)}>
            再看一次
          </button>
          <button type="button" onClick={() => playback.jump(playback.total)}>
            跳到結果
          </button>
          <button type="button" className="primary" onClick={() => (playback.view.done ? setReceipt(true) : playback.next())}>
            {playback.view.done ? '看帳單' : '下一步 ▸'}
          </button>
        </div>
      )}
      {receipt && <ReceiptCard round={beat.round} viewer={VIEWER} {...buildReceipt(events, beat.round, VIEWER)} onClose={() => setReceipt(false)} />}
    </>
  );
}

export function Beat3DPreview() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') ?? 7) || 7;
  const forcedWeather = devWeatherOverride(location.search) as VoyageEventId | null;
  const { beats, events, players } = useMemo(() => {
    const setup = setupFromSeats({ seed, seats: SEATS });
    const log = runMatchSync(setup, setup.bots);
    const ids = log.events.flatMap((e) => (e.type === 'ship-resolved' ? [e.shipId] : []));
    return {
      beats: ids.map((id) => buildShipBeat(log.events, id)).filter((b): b is ShipBeat => b !== null),
      events: log.events,
      players: setup.players,
    };
  }, [seed]);
  const [index, setIndex] = useState(() => {
    const best = Math.max(...beats.map(interest));
    return Math.max(0, beats.findIndex((b) => interest(b) === best));
  });
  const [run, setRun] = useState(0);
  const beat = beats[index];
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const roundWeather = (round: number) => events.find((e) => e.type === 'voyage-event-revealed' && e.round === round);

  return (
    <div className="beat-preview">
      <div className="beat-preview-bar">
        <label>
          船{' '}
          <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
            {beats.map((b, i) => {
              const w = roundWeather(b.round);
              return (
                <option key={b.shipId} value={i}>
                  第 {b.round} 回合 · {names[b.owner]} · {b.outcome === 'sank' ? '沉沒' : '抵達'}
                  {b.steps.some((s) => s.kind === 'pirate') ? ' · 海盜' : ''}
                  {w?.type === 'voyage-event-revealed' ? ` · ${VOYAGE_EVENT_LABELS[w.event]}` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <button type="button" onClick={() => setRun((n) => n + 1)}>
          重播
        </button>
        <span>seed {seed}</span>
      </div>
      {beat && <Stage key={`${beat.shipId}-${run}`} beat={beat} events={events} players={players} weather={forcedWeather} />}
    </div>
  );
}
