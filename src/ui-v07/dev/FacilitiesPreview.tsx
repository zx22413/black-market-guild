import { useMemo, useState } from 'react';
import { seatAngles, seatPosition } from '../../ui/scene/layout';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import { ISLAND_IDS, V08_BUILDING_IDS, type IslandId, type PlayerId, type V08BuildingId } from '../../v07/game';
import type { BeatSeat } from '../scene/beatStage';
import { around } from '../scene/focusMath';
import { CannonVolley, RepairRun, TollCoins, TradeSeal } from '../scene/FacilityWorks';
import { shipPoint } from '../scene/spotlightMath';
import { TableCanvas } from '../scene/TableCanvas';
import { TideSweep } from '../scene/TideSweep';
import { sweepCues } from '../audio/roundCardSounds';
import { scheduleCues } from '../audio/scheduleCues';
import { soundEngine } from '../audio/soundEngine';
import { TIDE_WATER } from '../scene/tideLook';
import type { TideKind } from '../../v07/game';

// Dev-only: the V0.8 prototype's three buildings (an experiment, not rules) standing on the islands, at
// /v07.html?dev=facilities. &islands=lighthouse,fortress,mine,lumber picks the four islands (seat 0 is the one nearest
// the camera, yours); &seat=0..3 frames one island up close; &set=1 shows islands 5 to 8. The seats get 修船廠, 軍械庫,
// 商行 in turn, the fourth 修船廠 again (&shift=1, 2 starts the turn one or two buildings on). The buttons switch the framed island and the set of islands without a reload.

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
  // 「捲走」 plays 暗潮將至 taking the warehouses' goods (scene/TideSweep.tsx): a different loss on each island.
  const [sweep, setSweep] = useState(0);
  // 「前兆」 shows the 暗潮將至 round's sea (the water turning, standing high round the islands); &tide= picks the tide.
  const [omen, setOmen] = useState(params.has('omen'));
  // 「上工」 plays each building's own show (scene/FacilityWorks.tsx) toward where its owner's ship rides; 「擋潮」 the same with its tide turned away.
  const [work, setWork] = useState<{ readonly n: number; readonly shield: boolean }>({ n: 0, shield: false });
  const tide = (params.get('tide') ?? 'crash') as TideKind;
  // &shift=1 moves every building one seat on (so the tradehouse or the armory stands on the near island).
  const shift = Number(params.get('shift') ?? 0);
  const facilities = Object.fromEntries(seats.map((s, i) => [s.id, raised ? (V08_BUILDING_IDS[(i + shift) % V08_BUILDING_IDS.length] as V08BuildingId) : null]));
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
        <button type="button" data-work onClick={() => setWork((w) => ({ n: w.n + 1, shield: false }))}>
          上工
        </button>
        <button type="button" data-work-shield onClick={() => setWork((w) => ({ n: w.n + 1, shield: true }))}>
          擋潮
        </button>
        <button type="button" data-toll onClick={() => setWork((w) => ({ n: -Math.abs(w.n) - 1, shield: false }))}>
          部署費
        </button>
        <button type="button" data-omen onClick={() => setOmen((on) => !on)}>
          前兆
        </button>
        <button
          type="button"
          data-sweep
          onClick={() => {
            // The sweep's sounds as in a match (useTideSweep), the longest row here being 8 crates.
            soundEngine.unlock();
            scheduleCues(sweepCues(8));
            setSweep((n) => n + 1);
          }}
        >
          捲走
        </button>
        <span style={{ color: '#fff' }}>{islands.join('、')}</span>
      </div>
      <TableCanvas key={set} seats={seats} weather={null} ships={[]} cameraPoints={points} safe={{ top: 0, bottom: 0, left: 0, right: 0 }} pins={[]} onReady={() => undefined} facilities={facilities} facilityPulses={pulses} tide={sweep > 0 || omen ? tide : null} tideRising={omen && sweep === 0}>
        {work.n !== 0 &&
          raised &&
          seats.map((s, i) => {
            const building = facilities[s.id];
            const key = `${work.n}-${work.shield}-${s.id}`;
            const ship = shipPoint(angles[i]!);
            if (building === 'tradehouse') return <TradeSeal key={key} angle={angles[i]!} goods={['spice', 'spice', 'arms']} shield={work.shield} />;
            if (building === 'armory') return work.n < 0 ? <TollCoins key={key} angle={angles[i]!} ship={ship} /> : <CannonVolley key={key} angle={angles[i]!} ship={ship} shield={work.shield} />;
            return <RepairRun key={key} angle={angles[i]!} ship={ship} goods={['wood', 'iron']} shield={work.shield} />;
          })}
        {sweep > 0 && (
          <TideSweep
            key={sweep}
            water={TIDE_WATER[tide]}
            islands={[
              { angle: angles[0]!, crates: ['wood', 'iron', 'arms', 'wood', 'iron'] },
              { angle: angles[1]!, crates: ['wood'] },
              { angle: angles[2]!, crates: ['wood', 'iron', 'spice', 'arms', 'wood', 'iron', 'spice', 'arms'] },
              { angle: angles[3]!, crates: ['arms', 'arms'] },
            ]}
          />
        )}
      </TableCanvas>
    </div>
  );
}
