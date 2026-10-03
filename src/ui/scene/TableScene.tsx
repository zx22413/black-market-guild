import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Deployment, PlayerId, ShipId, VoyageEventId } from '../../game';
import { CameraRig, type FitPoint, type SafeArea } from './CameraRig';
import { PlayerIsland, TargetIsland } from './Islands';
import { PigeonFlight } from './PigeonFlight';
import { PROP_HEIGHT, RecruitStage } from './RecruitProps';
import { islandShorelines, playerIslandSeed } from './islandShape';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatAngles, seatPosition, type Vec3 } from './layout';
import { Routes } from './Routes';
import { DESKTOP_MARGINS, LabelTracker, type LabelAnchor, type LabelMargins } from './ScreenLabels';
import type { Layout } from '../table/useLayout';
import { Sea } from './Sea';
import { CrestSpray, ShoreSpray } from './Spray';
import { Clouds } from './Clouds';
import { GoldRush } from './GoldRush';
import { Night } from './Night';
import { SeaFog } from './SeaFog';
import { Storm } from './Storm';
import { Wind } from './Wind';
import type { IntelTrace } from './dieSteps';
import { SeatRail } from './SeatRail';
import { RoleCard, SeatSign, ShipTag, TargetSign } from './SceneLabels';
import { Escorts, VoyageShip, shipPose } from './Ships';
import { SwellProvider } from './SwellContext';
import type { CashFloat } from '../table/useCashFloats';
import { SeatFx } from '../table/RecruitFx';
import type { RecruitCue } from '../table/recruitShow';
import type { SceneSeat, SceneTable } from './tableModel';
import { WEATHER, fillOf } from './weather';
import { WeatherFog } from './WeatherFog';
import './scene.css';

/**
 * Keep the islands clear of the HUD bands, which sit differently on a phone. `bottom` is for the
 * action strip alone; while a hand of cards stands above it, HAND_HEIGHT is added, so the islands
 * sit lower (and larger) in every other phase.
 */
const SAFE_AREAS: Readonly<Record<Layout, SafeArea>> = {
  desktop: { top: 80, bottom: 150, left: 24, right: 250 },
  portrait: { top: 214, bottom: 132, left: 26, right: 26 },
  landscape: { top: 84, bottom: 118, left: 8, right: 150 },
};
/** Extra room the hand of cards takes above the action strip (none on a short phone: it sits beside it). */
const HAND_HEIGHT: Readonly<Record<Layout, number>> = { desktop: 105, portrait: 110, landscape: 0 };
/** How far floating cards keep from the same bands. */
const LABEL_MARGINS: Readonly<Record<Layout, LabelMargins>> = {
  desktop: DESKTOP_MARGINS,
  portrait: { top: 190, right: 6, bottom: 256, side: 6 },
  landscape: { top: 86, right: 152, bottom: 122, side: 6 },
};
const SHIP_LABEL_HEIGHT = 7;
/** How far from an island's rim its role card stands. */
const ROLE_CARD_GAP = 4;
/** How far a side island's role card sits from its name plate. */
const ROLE_CARD_BESIDE_PLATE = 15;
/** How far the far island's recruitment props move sideways, clear of its name plate. */
const FAR_SIDE_SHIFT = 12;
/**
 * The target's name plate sits on the sea at its front-left diagonal: no lane runs there, so it
 * never covers the far island, its tag or an arriving ship.
 */
const TARGET_PLATE: Vec3 = [-(TARGET_ISLAND_RADIUS + 3) * Math.SQRT1_2, 1, (TARGET_ISLAND_RADIUS + 3) * Math.SQRT1_2];

export interface TableSceneProps {
  readonly table: SceneTable;
  readonly weather: VoyageEventId | null;
  readonly nameOf: (id: PlayerId) => string;
  /** Ships the viewer may click as a role target right now. */
  readonly selectableShips: ReadonlySet<ShipId>;
  readonly onSelectShip: (id: ShipId) => void;
  /** The ship picked as a role target, awaiting confirmation. */
  readonly selectedShip: ShipId | null;
  /** Guild islands the viewer may pick as a joint-venture partner right now. */
  readonly selectableIslands: ReadonlySet<PlayerId>;
  /** The island picked but not yet confirmed. */
  readonly selectedIsland: PlayerId | null;
  readonly onSelectIsland: (id: PlayerId) => void;
  /** Info card hung on the selected island. */
  readonly islandCard: ReactNode;
  /** The viewer's own locked deployment, shown only to them before the reveal. */
  readonly secret: Deployment | null;
  /** The viewer's own role this round, for the card on their island until it is public. */
  readonly secretRole: Deployment | null;
  /** Seats that already locked this phase's choice. */
  readonly submitted: readonly PlayerId[];
  /** What the viewer's intel merchant saw, by ship; shown to the viewer only. */
  readonly intel: ReadonlyMap<ShipId, IntelTrace>;
  /** Recent cash changes floating above each guild's tag. */
  readonly floats: readonly CashFloat[];
  /** The recruitment show: parchments, pigeons, handshakes and torn envelopes over the islands. */
  readonly fx: readonly RecruitCue[];
  /** The joint-venture results are out, so open parchments no longer stand on the table. */
  readonly recruitResolved: boolean;
  /** Rounds finished so far; the right-hand ranking only re-sorts when this changes. */
  readonly rankStep: number;
  /** Called once all models have loaded. */
  readonly onReady: () => void;
  /** Screen layout of the HUD (desktop, phone upright, phone on its side). */
  readonly layout: Layout;
  /** A hand of cards stands above the action strip (buying an asset, deploying a role). */
  readonly handOpen: boolean;
  /** The viewer's own black money, shown on their tag in the phone layouts (no ledger there). */
  readonly blackMoney: number | null;
}

function rim(center: Vec3, radius: number): FitPoint[] {
  return [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 2;
    return { position: [center[0] + Math.cos(a) * radius, 0, center[2] + Math.sin(a) * radius] };
  });
}

/** Every island rim; independent of who is viewing, so the frame never shifts. */
function fitPoints(angles: readonly number[]): FitPoint[] {
  return [
    ...rim([0, 0, 0], TARGET_ISLAND_RADIUS),
    ...angles.flatMap((angle): FitPoint[] => {
      const center = seatPosition(angle);
      return rim(center, PLAYER_ISLAND_RADIUS + 1.5);
    }),
  ];
}

function Ready({ onReady }: { readonly onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/** The whole 3D table: guild islands around the target island, lanes, ships and tags. */
export function TableScene(props: TableSceneProps) {
  const { table, weather, nameOf, selectableShips, onSelectShip, selectedShip, selectableIslands, selectedIsland, onSelectIsland, islandCard, secret, secretRole, intel, submitted, floats, fx, recruitResolved, rankStep, onReady, layout, handOpen, blackMoney } = props;
  const safe = useMemo((): SafeArea => {
    const base = SAFE_AREAS[layout];
    return handOpen ? { ...base, bottom: base.bottom + HAND_HEIGHT[layout] } : base;
  }, [layout, handOpen]);
  // Floating cards keep as clear of the bottom as the islands do.
  const labelMargins = useMemo((): LabelMargins => ({ ...LABEL_MARGINS[layout], bottom: safe.bottom + 6 }), [layout, safe]);
  const look = WEATHER[weather ?? 'clear'];
  const angles = useMemo(() => seatAngles(table.seats.length), [table.seats.length]);
  const points = useMemo(() => fitPoints(angles), [angles]);
  const shores = useMemo(() => islandShorelines(angles), [angles]);

  // Where each island's recruitment props float: over the island, except the far island, whose
  // name plate sits above it on screen, so its props stand to the side instead.
  const fxSpots = useMemo(
    () =>
      table.seats.map((_, i): Vec3 => {
        const [x, , z] = seatPosition(angles[i]!);
        const plateAbove = z < 0 && Math.abs(x) <= Math.abs(z);
        return plateAbove ? [x + FAR_SIDE_SHIFT, PROP_HEIGHT, z + 3] : [x, PROP_HEIGHT, z];
      }),
    [table.seats, angles],
  );
  // The middle of each island's grass, where a handshake spreads its ring.
  const grounds = useMemo(() => table.seats.map((_, i): Vec3 => {
    const [x, , z] = seatPosition(angles[i]!);
    return [x, 2.9, z];
  }), [table.seats, angles]);

  const anchors = useMemo((): LabelAnchor[] => {
    const seatAnchors = table.seats.map((_, i): LabelAnchor => {
      const [x, , z] = seatPosition(angles[i]!);
      // Side islands carry the plate under them so it clears their buildings; the others outward.
      if (Math.abs(x) > Math.abs(z)) return { id: `seat-${i}`, position: [x, 1, z + PLAYER_ISLAND_RADIUS + 1] };
      const reach = (PLAYER_ISLAND_RADIUS + 2) / (Math.hypot(x, z) || 1);
      return { id: `seat-${i}`, position: [x + x * reach, 1, z + z * reach] };
    });
    const shipAnchors = table.ships.map((ship): LabelAnchor => {
      const { position } = shipPose(angles[ship.lane]!, ship.state);
      return { id: `ship-${ship.id}`, position: [position.x, SHIP_LABEL_HEIGHT, position.z] };
    });
    // The island card hangs above the picked island, or below it when the top of the screen is
    // full. The island at the far middle would then cover the target island, so its card opens
    // to the left (away from the ranking rail) instead.
    const picked = table.seats.findIndex((s) => s.id === selectedIsland);
    const [cx, , cz] = picked >= 0 ? seatPosition(angles[picked]!) : [0, 0, 0];
    const farMiddle = cz < 0 && Math.abs(cx) < 5;
    const cardAnchors: LabelAnchor[] =
      picked < 0
        ? []
        : [
            {
              id: 'island-card',
              position: [cx, 7, cz - PLAYER_ISLAND_RADIUS * 0.4],
              flip: [cx, 1, cz + PLAYER_ISLAND_RADIUS + 5.5],
              ...(farMiddle ? { side: { position: [cx - PLAYER_ISLAND_RADIUS - 2, 3, cz] as Vec3, dir: -1 as const } } : {}),
            },
          ];
    // A point on each island's grass, under its recruitment props, where their labels hang.
    const fxAnchors = fxSpots.map(([x, , z], i): LabelAnchor => ({ id: `fx-${i}`, position: [x, 3, z] }));
    // Each role card goes where the sea is empty: never between an island and the middle, where
    // the lanes and ship tags are. Side islands hang it below, next to their name plate, on the
    // side toward the middle of the screen (clear of the ranking rail on the right); the near
    // island beside it on the right, hanging down; the far island beside it on the left. Near the
    // top of the screen a card hangs down instead; the tracker keeps it clear of the action strip.
    const roleAnchors = table.seats.map((_, i): LabelAnchor => {
      const [x, , z] = seatPosition(angles[i]!);
      const reach = PLAYER_ISLAND_RADIUS + ROLE_CARD_GAP;
      const position: Vec3 =
        Math.abs(x) > Math.abs(z)
          ? [x - Math.sign(x) * ROLE_CARD_BESIDE_PLATE, 1, z + PLAYER_ISLAND_RADIUS + 15]
          : z > 0
            ? [x + reach, 4, z]
            : [x - reach, 4, z];
      // The near island's card hangs down from its middle, into the open sea above the action
      // strip, rather than standing up over the middle of the table.
      const near = Math.abs(x) <= Math.abs(z) && z > 0;
      return { id: `role-${i}`, position, flip: near ? position : [position[0], position[1], position[2] + 4], hang: near };
    });
    return [{ id: 'target', position: TARGET_PLATE }, ...seatAnchors, ...shipAnchors, ...fxAnchors, ...roleAnchors, ...cardAnchors];
  }, [angles, table, selectedIsland, fxSpots]);

  // Each pigeon flies from its own island to the recruiter's scroll, at the height the props float.
  const pigeons = useMemo(
    () =>
      fx.flatMap((cue) => {
        const from = table.seats.findIndex((s) => s.id === cue.player);
        const to = table.seats.findIndex((s) => s.id === cue.to);
        if (cue.kind !== 'pigeon' || from < 0 || to < 0) return [];
        return [{ key: cue.key, at: cue.at, duration: cue.duration, color: table.seats[from]!.color, from: fxSpots[from]!, to: fxSpots[to]! }];
      }),
    [fx, table.seats, fxSpots],
  );

  const labels = useRef(new Map<string, HTMLElement>());
  const pin = (id: string) => (element: HTMLElement | null) => {
    if (element) labels.current.set(id, element);
    else labels.current.delete(id);
  };

  // The role a guild played: public once revealed (or a smuggler caught); the viewer's own until then, only for them.
  const roleCardOf = (seat: SceneSeat, i: number) => {
    const shown = seat.role ?? (seat.isViewer && secretRole ? { role: secretRole.role, targetShipId: secretRole.targetShipId, caught: false } : null);
    if (!shown) return null;
    const owners = table.ships.find((ship) => ship.id === shown.targetShipId)?.owners ?? [];
    return (
      <RoleCard
        key={`role-${seat.id}-${shown.role}`}
        ref={pin(`role-${i}`)}
        role={shown.role}
        target={`→ ${owners.map(nameOf).join('＋')}的船`}
        secret={!seat.role}
        caught={shown.caught}
      />
    );
  };

  return (
    <>
      <Canvas shadows camera={{ position: [0, 82, 60], fov: 38 }}>
        <CameraRig points={points} safe={safe} />
        <color attach="background" args={[look.sky]} />
        <WeatherFog color={look.sky} near={look.fogNear} far={look.fogFar} />
        <ambientLight intensity={look.ambient} />
        <hemisphereLight args={[fillOf(look).sky, fillOf(look).ground, fillOf(look).intensity]} />
        <directionalLight
          position={[-40, 60, 30]}
          intensity={look.sun}
          color={look.sunColor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
        />
        <SwellProvider target={look.swell}>
          <Suspense fallback={null}>
            <Sea color={look.sea} shores={shores} vignette={look.vignette ?? 0} lines={look.seaLines ?? 0} glow={look.seaGlow ?? 0} />
            <ShoreSpray shores={shores} />
            <CrestSpray shores={shores} />
            {(look.clouds ?? 0) > 0 && <Clouds amount={look.clouds ?? 0} />}
            {weather === 'storm' && <Storm seatAngles={angles} />}
            {weather === 'tailwind' && <Wind />}
            {weather === 'sea-fog' && <SeaFog />}
            {weather === 'moonless-night' && <Night seatAngles={angles} />}
            {weather === 'black-market-rush' && <GoldRush />}
            <Routes angles={angles} colors={table.seats.map((s) => s.color)} />
            <TargetIsland />
            {table.seats.map((seat, i) => (
              <PlayerIsland
                key={seat.id}
                seat={seat}
                angle={angles[i]!}
                seed={playerIslandSeed(i)}
                selectable={selectableIslands.has(seat.id)}
                selected={selectedIsland === seat.id}
                onSelect={() => onSelectIsland(seat.id)}
              />
            ))}
            {table.ships.map((ship) => (
              <group key={ship.id}>
                <VoyageShip
                  ship={ship}
                  angle={angles[ship.lane]!}
                  selectable={selectableShips.has(ship.id)}
                  chosen={selectedShip === ship.id}
                lantern={weather === 'moonless-night'}
                  onSelect={() => onSelectShip(ship.id)}
                />
                <Escorts ship={ship} angle={angles[ship.lane]!} />
              </group>
            ))}
            <RecruitStage cues={fx} seats={table.seats} points={fxSpots} grounds={grounds} standing={!recruitResolved} />
            {pigeons.map((cue) => (
              <PigeonFlight key={cue.key} from={cue.from} to={cue.to} at={cue.at} duration={cue.duration} color={cue.color} />
            ))}
            <Ready onReady={onReady} />
          </Suspense>
        </SwellProvider>
        <LabelTracker anchors={anchors} elements={labels} margins={labelMargins} />
      </Canvas>
      <div className="scene-labels">
        <TargetSign ref={pin('target')} />
        {selectedIsland && islandCard && (
          <div ref={pin('island-card')} className="partner-float">
            {islandCard}
          </div>
        )}
        {table.seats.map((seat, i) => (
          <SeatSign
            key={seat.id}
            ref={pin(`seat-${i}`)}
            seat={seat}
            floats={floats.filter((f) => f.playerId === seat.id)}
          />
        ))}
        {table.seats.map((seat, i) => roleCardOf(seat, i))}
        {table.seats.map((seat, i) => (
          <div key={seat.id} ref={pin(`fx-${i}`)} className="fx-anchor">
            <SeatFx seat={seat} cues={fx} />
          </div>
        ))}
        {table.ships.map((ship) => (
          <ShipTag
            key={ship.id}
            ref={pin(`ship-${ship.id}`)}
            ship={ship}
            nameOf={nameOf}
            colorOf={(id) => table.seats.find((s) => s.id === id)?.color ?? '#7a5a36'}
            secret={secret?.targetShipId === ship.id ? secret : null}
            intel={intel.get(ship.id) ?? null}
            selectable={selectableShips.has(ship.id)}
            chosen={selectedShip === ship.id}
            onSelect={() => onSelectShip(ship.id)}
          />
        ))}
      </div>
      <SeatRail seats={table.seats} nameOf={nameOf} submitted={submitted} rankStep={rankStep} blackMoney={blackMoney} />
    </>
  );
}
