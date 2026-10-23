import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import type { PlayerId } from '../../v07/game';
import { seatAngles } from '../../ui/scene/layout';
import { Model } from '../../ui/scene/Model';
import { lanePose } from '../../ui/scene/Ships';
import { SEA_LEVEL, seaSurfaceY } from '../../ui/scene/seaWave';
import { useSwell, useWavePhase } from '../../ui/scene/SwellContext';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import type { BeatSeat } from '../scene/beatStage';
import { TableCanvas } from '../scene/TableCanvas';
import type { MarketShow } from '../../ui/scene/MarketIsland';
import { cargoCrates } from '../scene/marketShow';
import { GOOD_COLORS } from '../scene/CrateModel';
import { GOODS } from '../../v07/game';
import { MENU_BERTH, menuArrivals, menuPrices, orbitPosition, orbitTarget, shuttle } from './menuMotion';

// The live table behind the main menu: four guild islands around the market, the camera circling
// slowly and every guild's ship sailing to the market and back. With reduced motion the scene
// holds still on one frame.

const MENU_SEATS: readonly BeatSeat[] = [
  { id: 'menu-1' as PlayerId, name: '', color: PLAYER_COLORS[0], buildings: ['shipyard', 'exchange'], island: 'lighthouse', isViewer: false },
  { id: 'menu-2' as PlayerId, name: '', color: PLAYER_COLORS[1], buildings: ['salvage'], island: 'pirate-cove', isViewer: false },
  { id: 'menu-3' as PlayerId, name: '', color: PLAYER_COLORS[2], buildings: ['insurance', 'shipyard'], island: 'spice-isles', isViewer: false },
  { id: 'menu-4' as PlayerId, name: '', color: PLAYER_COLORS[3], buildings: ['exchange'], island: 'fortress', isViewer: false },
];

/** Ship trip offsets (share of a round trip), so the four ships never move in step. */
const SHIP_OFFSETS = [0, 0.27, 0.55, 0.8] as const;

/** The frame shown when motion is reduced: ships under way, the market in front. */
const STILL_TIME = 6;

/**
 * How far the camera looks off the market island so the table sits clear of the menu panel:
 * to the right on a wide screen (panel on the left), up on a phone (panel at the bottom).
 */
const WIDE_SCREEN = 720;
const SHIFT = { wide: { right: 34, up: 0 }, narrow: { right: 0, up: 46 } } as const;

const prefersStill = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function OrbitCamera({ still }: { readonly still: boolean }) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const shift = width > WIDE_SCREEN ? SHIFT.wide : SHIFT.narrow;
  useFrame(({ clock }) => {
    const time = still ? STILL_TIME : clock.elapsedTime;
    camera.position.set(...orbitPosition(time));
    camera.lookAt(...orbitTarget(time, shift.right, shift.up));
  });
  return null;
}

function ShuttleShip({ angle, offset, still }: { readonly angle: number; readonly offset: number; readonly still: boolean }) {
  const group = useRef<Group>(null);
  const swell = useSwell();
  const phase = useWavePhase();
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const time = still ? STILL_TIME : clock.elapsedTime;
    const { t, outbound } = shuttle(time, offset);
    const pose = lanePose(angle, t * MENU_BERTH);
    g.position.set(pose.position.x, seaSurfaceY(pose.position.x, pose.position.z, phase.current, swell.current.height) - SEA_LEVEL, pose.position.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = pose.heading + (outbound ? 0 : Math.PI);
    g.rotation.z = Math.sin(time * 1.2 + offset * 6) * 0.03 * swell.current.roll;
  });
  return (
    <group ref={group}>
      <Model name="ship-medium" scale={0.546} />
    </group>
  );
}

/** The loads the menu's porters carry, one per ship (wood, iron, spice, arms units). */
const MENU_LOADS = [
  { wood: 2, iron: 1, spice: 0, arms: 0 },
  { wood: 0, iron: 0, spice: 2, arms: 1 },
  { wood: 1, iron: 0, spice: 3, arms: 0 },
  { wood: 0, iron: 2, spice: 0, arms: 2 },
] as const;
/** How often the menu's market looks at the clock (ms): its changes are seconds apart. */
const MARKET_TICK = 400;

function menuMarket(time: number, angles: readonly number[], still: boolean): MarketShow {
  return {
    prices: menuPrices(time),
    rowColors: GOODS.map((g) => GOOD_COLORS[g]),
    awnings: 'open',
    // With reduced motion the lamplighter stays home.
    lanterns: still ? 'off' : 'cycle',
    deliveries: menuArrivals(time, SHIP_OFFSETS).map(({ ship, trip }) => ({ key: `${ship}-${trip}`, angle: angles[ship] ?? 0, crates: cargoCrates(MENU_LOADS[ship % MENU_LOADS.length]!) })),
    bellKey: menuPrices(time).join(','),
  };
}

/** The menu market's show, recomputed a few times a second and only replaced when something changed. */
function useMenuMarket(angles: readonly number[], still: boolean): MarketShow {
  const [show, setShow] = useState(() => menuMarket(still ? STILL_TIME : 0, angles, still));
  useEffect(() => {
    if (still) return;
    const start = performance.now();
    const id = setInterval(() => {
      const next = menuMarket((performance.now() - start) / 1000, angles, false);
      setShow((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, MARKET_TICK);
    return () => clearInterval(id);
  }, [angles, still]);
  return show;
}

export function MenuScene({ onReady }: { readonly onReady: () => void }) {
  const still = useMemo(prefersStill, []);
  const angles = useMemo(() => seatAngles(MENU_SEATS.length), []);
  const market = useMenuMarket(angles, still);
  return (
    <TableCanvas
      seats={MENU_SEATS}
      weather={null}
      ships={[]}
      camera={<OrbitCamera still={still} />}
      cameraPoints={[]}
      safe={{ top: 0, bottom: 0, left: 0, right: 0 }}
      pins={[]}
      onReady={onReady}
      market={market}
    >
      {angles.map((angle, i) => (
        <ShuttleShip key={i} angle={angle} offset={SHIP_OFFSETS[i] ?? 0} still={still} />
      ))}
    </TableCanvas>
  );
}
