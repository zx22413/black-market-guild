import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3, type Group } from 'three';
import type { PlayerId } from '../../../v07/game';
import { laneCurve, seatAngles } from '../../../ui/scene/layout';
import { Model } from '../../../ui/scene/Model';
import { lanePose } from '../../../ui/scene/Ships';
import { SEA_LEVEL, seaSurfaceY } from '../../../ui/scene/seaWave';
import { useSwell, useWavePhase } from '../../../ui/scene/SwellContext';
import { PLAYER_COLORS } from '../../../ui/scene/tableModel';
import type { BeatSeat } from '../../scene/beatStage';
import { TableCanvas } from '../../scene/TableCanvas';
import { MENU_BERTH } from '../../menu/menuMotion';
import { markReady } from './director';
import { CRANE, endShot, shotAt, smooth, type Shot } from './openingShots';

// The trailer's opening (/v07.html?dev=trailer&part=open): the trailer match's four islands in a
// storm, every ship setting out at once. The camera rides the waves beside your ship, then cranes
// up until the whole table is in the frame (openingShots.ts). Story time starts when the page is
// ready, so the capture's --from 0 is the first frame of the shot. With `ending` (&part=end) the
// storm has passed: clear sky, the ships halfway out, the camera drifting high over the table
// with the table kept right of center for the end card.

const SEATS: readonly BeatSeat[] = [
  { id: 'p1' as PlayerId, name: '你', color: PLAYER_COLORS[0], buildings: [], island: 'lumber', isViewer: true },
  { id: 'p2' as PlayerId, name: '凡德商行', color: PLAYER_COLORS[1], buildings: [], island: 'mine', isViewer: false },
  { id: 'p3' as PlayerId, name: '黑潮會', color: PLAYER_COLORS[2], buildings: [], island: 'spice-isles', isViewer: false },
  { id: 'p4' as PlayerId, name: '金錨公會', color: PLAYER_COLORS[3], buildings: [], island: 'smuggler-port', isViewer: false },
];

/** Seconds a ship takes from its dock to the market's berth: slow, so it is still near home when the crane ends. */
const VOYAGE = 18;
/** Where along the lane the ships are when the shot begins: just clear of their docks. */
const START = 0.16;

/** Seconds of story time, from the moment the page became ready. */
const storyRef: { start: number | null } = { start: null };
const story = (): number => (storyRef.start === null ? 0 : (performance.now() - storyRef.start) / 1000);

/** Where along the lane the ships are when the end shot begins. */
const END_START = 0.35;

let startAt = START;
const progress = (s: number): number => Math.min(MENU_BERTH, startAt + (s / VOYAGE) * MENU_BERTH);

function SailingShip({ angle, index }: { readonly angle: number; readonly index: number }) {
  const group = useRef<Group>(null);
  const swell = useSwell();
  const phase = useWavePhase();
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = story();
    const pose = lanePose(angle, progress(s));
    g.position.set(pose.position.x, seaSurfaceY(pose.position.x, pose.position.z, phase.current, swell.current.height) - SEA_LEVEL, pose.position.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = pose.heading;
    // Pitching and rolling in the swell, each ship out of step with the others.
    g.rotation.x = Math.sin(s * 1.7 + index * 1.3) * 0.06 * swell.current.roll;
    g.rotation.z = Math.sin(s * 1.2 + index * 2.1) * 0.08 * swell.current.roll;
  });
  return (
    <group ref={group}>
      <Model name="ship-medium" scale={0.546} />
    </group>
  );
}

const ahead = new Vector3();

/**
 * The chase stop: low over the water off your ship's bow, a little to one side, looking back at it
 * as it sails toward the camera with its island behind it. The camera keeps pace a little slower
 * than the ship, so the ship comes on.
 */
function chaseShot(angle: number, s: number): Shot {
  const curve = laneCurve(angle);
  const t = progress(s);
  const ship = curve.getPoint(t);
  const forward = curve.getTangent(t).setY(0).normalize();
  const side = new Vector3(forward.z, 0, -forward.x);
  const lead = 11 - s * 1.4;
  ahead.copy(ship).addScaledVector(forward, -2);
  return {
    position: [ship.x + forward.x * lead + side.x * 7, 2.6, ship.z + forward.z * lead + side.z * 7],
    target: [ahead.x, 2.2, ahead.z],
  };
}

function EndCamera() {
  const camera = useThree((st) => st.camera);
  useFrame(() => {
    const shot = endShot(story());
    camera.position.set(...shot.position);
    camera.lookAt(...shot.target);
  });
  return null;
}

function DirectorCamera({ angle }: { readonly angle: number }) {
  const camera = useThree((st) => st.camera);
  const swell = useSwell();
  useFrame(() => {
    const s = story();
    const shot = shotAt(s, chaseShot(angle, Math.min(s, CRANE.start)), chaseShot(angle, s));
    // The chase camera rides the swell; the bob fades as it climbs.
    const ride = 1 - smooth(Math.min(1, Math.max(0, (s - CRANE.start) / 0.8)));
    camera.position.set(shot.position[0], shot.position[1] + Math.sin(s * 1.9) * 0.45 * swell.current.height * ride, shot.position[2]);
    camera.lookAt(...shot.target);
  });
  return null;
}

export function TrailerOpening({ ending = false }: { readonly ending?: boolean }) {
  const angles = useMemo(() => seatAngles(SEATS.length), []);
  startAt = ending ? END_START : START;
  return (
    <TableCanvas
      seats={SEATS}
      weather={ending ? null : 'storm'}
      ships={[]}
      // The camera rides the swell, so it is drawn inside the sea's provider (among the children).
      camera={<></>}
      cameraPoints={[]}
      safe={{ top: 0, bottom: 0, left: 0, right: 0 }}
      pins={[]}
      onReady={() => {
        storyRef.start = performance.now();
        markReady();
      }}
    >
      {ending ? <EndCamera /> : <DirectorCamera angle={angles[0] ?? 0} />}
      {angles.map((angle, i) => (
        <SailingShip key={i} angle={angle} index={i} />
      ))}
    </TableCanvas>
  );
}
