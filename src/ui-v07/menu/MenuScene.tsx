import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerId } from '../../v07/game';
import { seatAngles, type Vec3 } from '../../ui/scene/layout';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import type { BeatSeat } from '../scene/beatStage';
import { TableCanvas, platePosition, type TablePin } from '../scene/TableCanvas';
import type { MarketShow } from '../../ui/scene/MarketIsland';
import { cargoCrates } from '../scene/marketShow';
import { GOOD_COLORS } from '../scene/CrateModel';
import { GOODS } from '../../v07/game';
import { prefersStill } from './launch';
import { IslandFlag, IslandMist, MenuShip } from './MenuProps';
import { menuArrivals, menuPrices } from './menuMotion';
import { menuSeatLooks, type MenuSeatLook, type MenuView } from './menuSeats';
import { aimOff, glide, menuShot, type MenuStage } from './menuShots';

// The live table behind the main menu: four guild islands around the market. Each menu page has
// its own camera stop and its own small show (menuShots, menuSeats): circling the market on the
// title screen, your ship waiting at your dock for single player, flags on every island online,
// the lobby's seats mirrored on the islands, the lighthouse's beam for the tutorial, and every
// ship sailing out when a match starts. With reduced motion the camera cuts instead of gliding
// and the scene holds still.

/** Island 0 is yours (in front); the lighthouse island is the tutorial's stop. */
const MENU_SEATS: readonly BeatSeat[] = [
  { id: 'menu-1' as PlayerId, name: '', color: PLAYER_COLORS[0], buildings: ['shipyard', 'exchange'], island: 'spice-isles', isViewer: false },
  { id: 'menu-2' as PlayerId, name: '', color: PLAYER_COLORS[1], buildings: ['salvage'], island: 'pirate-cove', isViewer: false },
  { id: 'menu-3' as PlayerId, name: '', color: PLAYER_COLORS[2], buildings: ['insurance', 'shipyard'], island: 'fortress', isViewer: false },
  { id: 'menu-4' as PlayerId, name: '', color: PLAYER_COLORS[3], buildings: ['exchange'], island: 'lighthouse', isViewer: false },
];
const YOURS = 0;
const GUIDE = MENU_SEATS.findIndex((s) => s.island === 'lighthouse');
const GUIDE_LIT: ReadonlySet<PlayerId> = new Set([MENU_SEATS[GUIDE]!.id]);

/** Ship trip offsets (share of a round trip), so the four ships never move in step. */
const SHIP_OFFSETS = [0, 0.27, 0.55, 0.8] as const;

/** The frame shown when motion is reduced: ships under way, the market in front. */
const STILL_TIME = 6;

/**
 * How far off center the table sits, as a share of the camera's distance, so it stays clear of the
 * menu panel: to the right on a wide screen (panel on the left), up on a phone (panel at the bottom).
 * The launch has no panel and looks straight ahead.
 */
const WIDE_SCREEN = 720;
const SHIFT = { wide: { right: 0.21, up: 0 }, narrow: { right: 0, up: 0.29 } } as const;

function StageCamera({ stage, angles, launchStart, still }: { readonly stage: MenuStage; readonly angles: readonly number[]; readonly launchStart: number; readonly still: boolean }) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const at = useRef<{ position: Vec3; target: Vec3 } | null>(null);
  useFrame(({ clock }, delta) => {
    const time = still ? STILL_TIME : clock.elapsedTime;
    const shot = menuShot(stage, time, { angles, yours: YOURS, guide: GUIDE, launchElapsed: performance.now() / 1000 - launchStart });
    const shift = stage === 'launch' ? { right: 0, up: 0 } : width > WIDE_SCREEN ? SHIFT.wide : SHIFT.narrow;
    const want = { position: shot.position, target: aimOff(shot.position, shot.target, shift.right, shift.up) };
    const prev = at.current;
    // The first frame and reduced motion cut straight to the stop; otherwise the camera glides there.
    const move = (from: Vec3, to: Vec3): Vec3 => (prev === null || still ? to : [glide(from[0], to[0], delta), glide(from[1], to[1], delta), glide(from[2], to[2], delta)]);
    const next = { position: move(prev?.position ?? want.position, want.position), target: move(prev?.target ?? want.target, want.target) };
    at.current = next;
    camera.position.set(...next.position);
    camera.lookAt(...next.target);
  });
  return null;
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

/**
 * The menu market at `time`. `shuttling` has a '1' for every ship on its market run (only those
 * bring cargo for the porters); `bell` changes to ring the bell.
 */
function menuMarket(time: number, angles: readonly number[], still: boolean, shuttling: string, bell: string): MarketShow {
  return {
    prices: menuPrices(time),
    rowColors: GOODS.map((g) => GOOD_COLORS[g]),
    awnings: 'open',
    // With reduced motion the lamplighter stays home.
    lanterns: still ? 'off' : 'cycle',
    deliveries: menuArrivals(time, SHIP_OFFSETS).filter(({ ship }) => shuttling[ship] === '1').map(({ ship, trip }) => ({ key: `${ship}-${trip}`, angle: angles[ship] ?? 0, crates: cargoCrates(MENU_LOADS[ship % MENU_LOADS.length]!) })),
    bellKey: `${menuPrices(time).join(',')}|${bell}`,
  };
}

/** The menu market's show, recomputed a few times a second and only replaced when something changed. */
function useMenuMarket(angles: readonly number[], still: boolean, shuttling: string, bell: string): MarketShow {
  const [show, setShow] = useState(() => menuMarket(still ? STILL_TIME : 0, angles, still, shuttling, bell));
  const [start] = useState(() => performance.now());
  useEffect(() => {
    const tick = () => {
      const next = menuMarket(still ? STILL_TIME : (performance.now() - start) / 1000, angles, still, shuttling, bell);
      setShow((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    tick();
    if (still) return;
    const id = setInterval(tick, MARKET_TICK);
    return () => clearInterval(id);
  }, [angles, still, shuttling, bell, start]);
  return show;
}

/** A plate over each lobby island: the guild's name, or the open seat. */
function lobbyPins(looks: readonly MenuSeatLook[], angles: readonly number[]): TablePin[] {
  return looks.flatMap((look, i): TablePin[] =>
    look.label === null
      ? []
      : [{ id: `seat-${i}`, position: platePosition(angles[i] ?? 0), node: <span className={`menu-pin ${look.flag ? '' : 'open'}`}>{look.label}</span> }],
  );
}

interface MenuSceneProps {
  readonly view: MenuView;
  readonly onReady: () => void;
}

export function MenuScene({ view, onReady }: MenuSceneProps) {
  const still = useMemo(prefersStill, []);
  const angles = useMemo(() => seatAngles(MENU_SEATS.length), []);
  const looks = menuSeatLooks(view, MENU_SEATS.length);
  // A bell stroke whenever someone sits down in the lobby.
  const shuttling = looks.map((l) => (l.ship === 'shuttle' ? '1' : '0')).join('');
  const market = useMenuMarket(angles, still, shuttling, String(looks.filter((l) => l.flag).length));
  const launchStart = useMemo(() => (view.stage === 'launch' ? performance.now() / 1000 : 0), [view.stage]);
  return (
    <TableCanvas
      seats={MENU_SEATS}
      weather={null}
      ships={[]}
      camera={<StageCamera stage={view.stage} angles={angles} launchStart={launchStart} still={still} />}
      cameraPoints={[]}
      safe={{ top: 0, bottom: 0, left: 0, right: 0 }}
      pins={view.stage === 'lobby' ? lobbyPins(looks, angles) : []}
      onReady={onReady}
      market={market}
      {...(view.stage === 'tutorial' ? { litSeats: GUIDE_LIT } : {})}
    >
      {angles.map((angle, i) => (
        <group key={i}>
          <MenuShip angle={angle} offset={SHIP_OFFSETS[i] ?? 0} mode={looks[i]!.ship} launchStart={launchStart} still={still} stillTime={STILL_TIME} />
          <IslandFlag angle={angle} color={MENU_SEATS[i]!.color} raised={looks[i]!.flag} still={still} />
          <IslandMist angle={angle} on={looks[i]!.mist} still={still} />
        </group>
      ))}
    </TableCanvas>
  );
}
