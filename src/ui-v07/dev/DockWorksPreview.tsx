import { useMemo, useState } from 'react';
import { seatAngles } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import { SHIP_TYPE_IDS, type PlayerId, type ShipId, type ShipTypeId } from '../../v07/game';
import type { BeatSeat } from '../scene/beatStage';
import { around } from '../scene/focusMath';
import { ShipSideCamera } from '../scene/ShipSideCamera';
import { TableCanvas, type TableShip } from '../scene/TableCanvas';
import type { WorksMode } from '../scene/ships/dockWorksShow';

// Dev-only: the V0.8 prototype's dock works (an experiment, not rules) round a docked ship, at /v07.html?dev=dockworks.
// &ship=gambler picks the ship type; &rate=0.2 plays the show five times slower; &view=table looks from the table camera instead of the ship-pick camera. The
// buttons play the show: 「搭建」 (you open the skill: the whole show, the works stay open), 「出航公開」 (another
// player's skill made public at the launch), 「收工」 (the open works go back under), 「清除」 (no works).

export function DockWorksPreview() {
  const params = new URLSearchParams(window.location.search);
  const [type, setType] = useState<ShipTypeId>((params.get('ship') as ShipTypeId | null) ?? 'standard');
  const [table, setTable] = useState(params.get('view') === 'table');
  const rate = Number(params.get('rate')) || 1;
  const [run, setRun] = useState<{ mode: WorksMode; key: string; skill: boolean; rate: number } | null>(null);
  const angles = useMemo(() => seatAngles(4), []);
  const seats: BeatSeat[] = angles.map((_, i) => ({ id: `p${i}` as PlayerId, name: '', color: PLAYER_COLORS[i]!, buildings: [], island: (['lighthouse', 'mine', 'lumber', 'spice-isles'] as const)[i]!, isViewer: i === 0 }));
  const shipId = 'dock-p0' as ShipId;
  const ships: TableShip[] = [{ id: shipId, owner: 'p0' as PlayerId, state: 'docked', type }];
  const play = (mode: WorksMode, skill = true) => setRun({ mode, key: `${mode}-${Date.now()}`, skill, rate });
  // The table camera here looks at the dock, where the works stand, not at the whole island.
  const dock = shipPose(angles[0]!, 'docked').position;
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div style={{ position: 'absolute', zIndex: 5, top: 8, left: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" data-works="build" onClick={() => play('build')}>搭建</button>
        <button type="button" data-works="launch" onClick={() => play('launch')}>出航公開</button>
        <button type="button" data-works="strike" onClick={() => play('strike')}>收工</button>
        <button type="button" data-works="clear" onClick={() => setRun(null)}>清除</button>
        <button type="button" data-works="view" onClick={() => setTable((v) => !v)}>{table ? '選船鏡頭' : '整桌鏡頭'}</button>
        {SHIP_TYPE_IDS.map((id) => (
          <button key={id} type="button" data-ship={id} onClick={() => { setType(id); setRun(null); }}>{id}</button>
        ))}
      </div>
      <TableCanvas
        seats={seats}
        weather={null}
        ships={ships}
        {...(table ? {} : { camera: <ShipSideCamera angle={angles[0]!} shot="ship" ship={type} /> })}
        cameraPoints={table ? around([dock.x, 0, dock.z], 9) : []}
        safe={{ top: 0, bottom: 0, left: 0, right: 0 }}
        pins={[]}
        onReady={() => undefined}
        {...(run ? { works: new Map([[shipId, run]]) } : {})}
      />
    </div>
  );
}
