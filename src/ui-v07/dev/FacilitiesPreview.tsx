import { useMemo, useState } from 'react';
import { seatAngles, seatPosition } from '../../ui/scene/layout';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import { ISLAND_IDS, V08_BUILDING_IDS, type IslandId, type PlayerId, type V08BuildingId } from '../../v07/game';
import type { BeatSeat } from '../scene/beatStage';
import { around } from '../scene/focusMath';
import { TableCanvas } from '../scene/TableCanvas';

// Dev-only: the V0.8 prototype's three buildings (an experiment, not rules) standing on the islands, at
// /v07.html?dev=facilities. &islands=lighthouse,fortress,mine,lumber picks the four islands (seat 0 is the one nearest
// the camera, yours); &seat=0..3 frames one island up close; &set=1 shows islands 5 to 8. The seats get 修船廠, 軍械庫,
// 商行 in turn, the fourth 修船廠 again. The buttons switch the framed island and the set of islands without a reload.

export function FacilitiesPreview() {
  const params = new URLSearchParams(window.location.search);
  const [set, setSet] = useState(params.get('set') === '1' ? 1 : 0);
  const [focus, setFocus] = useState<string | null>(params.get('seat'));
  const islands = (params.get('islands')?.split(',') ?? ISLAND_IDS.slice(set * 4, set * 4 + 4)) as IslandId[];
  const angles = useMemo(() => seatAngles(4), []);
  const seats: BeatSeat[] = angles.map((_, i) => ({ id: `p${i}` as PlayerId, name: '', color: PLAYER_COLORS[i]!, buildings: [], island: islands[i] ?? null, isViewer: i === 0 }));
  // &raise starts with empty islands: 「落成」 then raises the buildings on screen; 「反應」 makes them hop as when they do their work.
  const [raised, setRaised] = useState(!params.has('raise'));
  const [pulse, setPulse] = useState(0);
  const facilities = Object.fromEntries(seats.map((s, i) => [s.id, raised ? (V08_BUILDING_IDS[i % V08_BUILDING_IDS.length] as V08BuildingId) : null]));
  const pulses = new Map(pulse > 0 ? seats.map((s) => [s.id, `pulse-${pulse}`] as const) : []);
  const points = focus === null ? angles.flatMap((a) => around(seatPosition(a), 11)) : around(seatPosition(angles[Number(focus)] ?? angles[0]!), 15, 60);
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div style={{ position: 'absolute', zIndex: 5, top: 8, left: 8, display: 'flex', gap: 6 }}>
        {['all', '0', '1', '2', '3'].map((k) => (
          <button key={k} type="button" data-seat={k} onClick={() => setFocus(k === 'all' ? null : k)}>
            {k === 'all' ? '全部' : `島 ${k}`}
          </button>
        ))}
        <button type="button" data-set onClick={() => setSet((n) => 1 - n)}>
          換另外四座島
        </button>
        <button type="button" data-raise onClick={() => setRaised(true)}>
          落成
        </button>
        <button type="button" data-pulse onClick={() => setPulse((n) => n + 1)}>
          反應
        </button>
        <span style={{ color: '#fff' }}>{islands.join('、')}</span>
      </div>
      <TableCanvas key={set} seats={seats} weather={null} ships={[]} cameraPoints={points} safe={{ top: 0, bottom: 0, left: 0, right: 0 }} pins={[]} onReady={() => undefined} facilities={facilities} facilityPulses={pulses} />
    </div>
  );
}
