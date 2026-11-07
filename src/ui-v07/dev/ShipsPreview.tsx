import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { BUILDING_IDS, ISLAND_IDS, SHIP_TYPE_IDS, type IslandId, type PlayerId, type ShipTypeId, type VoyageEventId } from '../../v07/game';
import { seatAngles } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { PLAYER_COLORS, type ShipState } from '../../ui/scene/tableModel';
import type { BeatSeat } from '../scene/beatStage';
import { berthsOf } from '../scene/berth';
import { TableCanvas, type TableShip } from '../scene/TableCanvas';

// Dev-only: the five ship types on the table at /v07.html?dev=ships. Query: `state` docked | sailing | arrived (default docked),
// `weather` (moonless-night for the lanterns and the ghost ship's glow), `view` table (the game's camera) | close (circles
// one ship; `ship` = standard | gambler | freighter | hidden | breaker) | side (beside that ship at deck height),
// `islands` (comma-separated island ids for the four seats, e.g. smuggler-port,mine; blank keeps the default look),
// `assets` (any value: every seat has all four buildings up), `seat` (the seat whose island `close`/`side` look at).

const OWNERS = [0, 1, 2, 3, 0] as const;

function Camera({ target, view }: { readonly target: readonly [number, number, number]; readonly view: 'table' | 'close' | 'side' }) {
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    if (view === 'table') {
      camera.position.set(0, 82, 60);
      camera.lookAt(0, 0, 0);
      return;
    }
    const a = view === 'side' ? 0.9 : clock.elapsedTime * 0.25;
    const [r, h] = view === 'side' ? [10, 3.5] : [11, 7];
    camera.position.set(target[0] + Math.sin(a) * r, h, target[2] + Math.cos(a) * r);
    camera.lookAt(target[0], 2.4, target[2]);
  });
  return null;
}

export function ShipsPreview() {
  const q = new URLSearchParams(window.location.search);
  const asked = q.get('state');
  const state = (asked === 'sailing' || asked === 'arrived' ? asked : 'docked') satisfies ShipState;
  const weather = (q.get('weather') ?? null) as VoyageEventId | null;
  const view = (['close', 'side'].includes(q.get('view') ?? '') ? q.get('view') : 'table') as 'table' | 'close' | 'side';
  const focus = (SHIP_TYPE_IDS as readonly string[]).includes(q.get('ship') ?? '') ? (q.get('ship') as ShipTypeId) : 'standard';
  const angles = useMemo(() => seatAngles(4), []);
  const islands = (q.get('islands') ?? '').split(',').map((id) => ((ISLAND_IDS as readonly string[]).includes(id) ? (id as IslandId) : null));
  const buildings = q.has('assets') ? BUILDING_IDS : [];
  const seats: BeatSeat[] = angles.map((_, i) => ({ id: `p${i}` as PlayerId, name: '', color: PLAYER_COLORS[i]!, buildings, island: islands[i] ?? null, isViewer: i === 0 }));
  const ships: TableShip[] = SHIP_TYPE_IDS.map((type, i) => ({ id: `s-${type}` as never, owner: seats[OWNERS[i]!]!.id, state, type }));
  const berths = berthsOf(ships);
  const index = SHIP_TYPE_IDS.indexOf(focus);
  const pose = shipPose(angles[OWNERS[index]!]!, state, berths.get(ships[index]!.id) ?? 0);
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <TableCanvas
        seats={seats}
        weather={weather}
        ships={ships}
        camera={<Camera view={view} target={[pose.position.x, 0, pose.position.z]} />}
        cameraPoints={[]}
        safe={{ top: 0, bottom: 0, left: 0, right: 0 }}
        pins={[]}
        onReady={() => undefined}
      />
    </div>
  );
}
