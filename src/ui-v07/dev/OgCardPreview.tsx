import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { PlayerId, VoyageEventId } from '../../v07/game';
import { GOODS } from '../../v07/game';
import { seatAngles } from '../../ui/scene/layout';
import { Model } from '../../ui/scene/Model';
import { lanePose } from '../../ui/scene/Ships';
import { seaSurfaceY } from '../../ui/scene/seaWave';
import { useSwell, useWavePhase } from '../../ui/scene/SwellContext';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import type { MarketShow } from '../../ui/scene/MarketIsland';
import { GOOD_COLORS } from '../scene/CrateModel';
import type { BeatSeat } from '../scene/beatStage';
import { TableCanvas } from '../scene/TableCanvas';
import { MENU_BERTH, menuPrices } from '../menu/menuMotion';
import { IslandFlag } from '../menu/MenuProps';
import { CinnabarChop, GameTitle } from '../skin/titleMark';
import '../menu/menu.css';

// Dev-only: the link preview card (Open Graph image, 1200×630) at /v07.html?dev=og-card. The fleet
// sails from every island to the market under full canvas, with the title on the left.
//   shot=sail   daylight with a tailwind's swell, the camera low over the water   (default)
//   shot=night  the same voyage on a moonless night: lanterns and the lighthouse lit
//   cam=x,y,z&look=x,y,z  try another camera; t=0.2,0.5,… each ship's place on its lane (0 dock, 1 market);
//   hero=x,z,yaw  the ship sailing in the foreground
// Captured to public/og-card.png with headless Chrome (docs/online/public-launch-plan.md §9).

const SEATS: readonly BeatSeat[] = [
  { id: 'og-1' as PlayerId, name: '', color: PLAYER_COLORS[0], buildings: ['shipyard', 'exchange'], island: 'spice-isles', isViewer: false },
  { id: 'og-2' as PlayerId, name: '', color: PLAYER_COLORS[1], buildings: ['salvage'], island: 'pirate-cove', isViewer: false },
  { id: 'og-3' as PlayerId, name: '', color: PLAYER_COLORS[2], buildings: ['insurance', 'shipyard'], island: 'fortress', isViewer: false },
  { id: 'og-4' as PlayerId, name: '', color: PLAYER_COLORS[3], buildings: ['exchange'], island: 'lighthouse', isViewer: false },
];
const ALL_LIT: ReadonlySet<PlayerId> = new Set(SEATS.map((s) => s.id));
/**
 * How deep the hulls sit below the water. The table's ships ride SEA_LEVEL above the surface,
 * which reads right from the table's high cameras; this low camera would see them float.
 */
const DRAFT = Number(new URLSearchParams(window.location.search).get('draft') ?? 0.2);
/** The hulls' lean in the wind and the hero's bow lifted by a wave (radians). */
const HEEL = Number(new URLSearchParams(window.location.search).get('heel') ?? 0.08);
const PITCH = Number(new URLSearchParams(window.location.search).get('pitch') ?? -0.05);

type Vec = readonly [number, number, number];
interface Shot {
  readonly cam: Vec;
  readonly look: Vec;
  readonly t: readonly number[];
  /** The foreground ship: x, z and heading. */
  readonly hero: Vec;
  readonly weather: VoyageEventId | null;
}
/** A tailwind: higher swell with foam and wind streaks, the right sea for full canvas. */
const SAIL: Shot = { cam: [22, 4, 34], look: [-24, 8, -2], t: [0.45, 0.5, 0.55, 0.66], hero: [11.6, 18.2, 2.2], weather: 'tailwind' };
const SHOTS: Readonly<Record<'sail' | 'night', Shot>> = { sail: SAIL, night: { ...SAIL, weather: 'moonless-night' } };

const vec = (raw: string | null): Vec | null => {
  const parts = raw?.split(',').map(Number) ?? [];
  return parts.length === 3 && parts.every(Number.isFinite) ? (parts as unknown as Vec) : null;
};

function Camera({ cam, look }: { readonly cam: Vec; readonly look: Vec }) {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    camera.position.set(...cam);
    camera.lookAt(...look);
  });
  return null;
}

/** A ship held at a spot of the sea, riding the swell. */
function HeroShip({ x, z, yaw }: { readonly x: number; readonly z: number; readonly yaw: number }) {
  const group = useRef<Group>(null);
  const swell = useSwell();
  const phase = useWavePhase();
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.set(x, seaSurfaceY(x, z, phase.current, swell.current.height) - DRAFT, z);
    // Heeled by the wind and lifted at the bow by a wave: it reads as sailing, not parked.
    g.rotation.order = 'YXZ';
    g.rotation.y = yaw;
    g.rotation.z = HEEL;
    g.rotation.x = PITCH;
  });
  return (
    <group ref={group}>
      <Model name="ship-medium" scale={0.546} />
    </group>
  );
}

/** A ship held at one spot of its lane, riding the swell like the menu's ships. */
function FrozenShip({ angle, t }: { readonly angle: number; readonly t: number }) {
  const group = useRef<Group>(null);
  const swell = useSwell();
  const phase = useWavePhase();
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const pose = lanePose(angle, t * MENU_BERTH);
    g.position.set(pose.position.x, seaSurfaceY(pose.position.x, pose.position.z, phase.current, swell.current.height) - DRAFT, pose.position.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = pose.heading;
    g.rotation.z = HEEL * 0.7;
  });
  return (
    <group ref={group}>
      <Model name="ship-medium" scale={0.546} />
    </group>
  );
}

/** Cover lines to compare (`copy=1…`): a hook, then what the game is. */
const COPY: readonly { readonly hook: readonly string[]; readonly line: string }[] = [
  // Chosen 2026-10-29 for the cover.
  { hook: ['誰在護航？誰在打劫？', '你能平安到港嗎？'], line: '各懷鬼胎，讓骰子決定命運' },
  { hook: ['所有人同時秘密下注', '同一批骰子的航海商戰'], line: '免費線上玩・單人一局約 10 分鐘' },
  { hook: ['誰在護航？誰在打劫？', '揭曉前，沒人知道。'], line: '秘密下注的航海商戰・免費線上玩' },
  { hook: ['你押它沉，', '他押它平安到港。'], line: '同一批骰子，各懷鬼胎・免費線上玩' },
  { hook: ['別人的船沉了，', '你可能賺最多。'], line: '秘密下注的航海商戰・一局 10 分鐘' },
];

export function OgCardPreview() {
  const q = new URLSearchParams(window.location.search);
  const shot = SHOTS[q.get('shot') === 'night' ? 'night' : 'sail'];
  const cam = vec(q.get('cam')) ?? shot.cam;
  const look = vec(q.get('look')) ?? shot.look;
  const t = q.get('t')?.split(',').map(Number) ?? shot.t;
  const hero = vec(q.get('hero')) ?? shot.hero;
  const night = shot.weather === 'moonless-night';
  const copy = COPY[Number(q.get('copy') ?? 1) - 1] ?? COPY[0]!;
  const angles = useMemo(() => seatAngles(SEATS.length), []);
  const market: MarketShow = {
    prices: menuPrices(0),
    rowColors: GOODS.map((g) => GOOD_COLORS[g]),
    awnings: 'open',
    lanterns: night ? 'night' : 'off',
    deliveries: [],
    bellKey: 'og',
  };
  return (
    <div className={`og-card ${night ? 'night' : ''}`}>
      <div className="og-scene">
        <TableCanvas
          seats={SEATS}
          weather={shot.weather}
          ships={[]}
          camera={<Camera cam={cam} look={look} />}
          cameraPoints={[]}
          safe={{ top: 0, bottom: 0, left: 0, right: 0 }}
          pins={[]}
          onReady={() => document.documentElement.setAttribute('data-og-ready', '1')}
          market={market}
          {...(night ? { litSeats: ALL_LIT } : {})}
        >
          <HeroShip x={hero[0]} z={hero[1]} yaw={hero[2]} />
          {angles.map((angle, i) => (
            <group key={i}>
              <FrozenShip angle={angle} t={t[i] ?? 0.4} />
              <IslandFlag angle={angle} color={SEATS[i]!.color} raised still />
            </group>
          ))}
        </TableCanvas>
      </div>
      <div className="og-shade" />
      <div className="og-copy">
        <div className="og-title">
          <GameTitle />
          <CinnabarChop className="og-chop" />
        </div>
        <p className="og-tagline">
          {copy.hook[0]}
          <br />
          {copy.hook[1]}
        </p>
        <p className="og-note">{copy.line}</p>
      </div>
      <style>{OG_CSS}</style>
    </div>
  );
}

const OG_CSS = `
html, body { margin: 0; background: #0e1c22; }
.og-card { position: fixed; left: 0; top: 0; width: 1200px; height: 630px; overflow: hidden; font-family: 'Noto Sans TC', sans-serif; }
.og-scene, .og-scene > * { position: absolute; inset: 0; }
.og-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(8 20 26 / 0.9) 0%, rgb(8 20 26 / 0.72) 30%, rgb(8 20 26 / 0) 58%); pointer-events: none; }
.og-card.night .og-shade { background: linear-gradient(90deg, rgb(4 10 16 / 0.92) 0%, rgb(4 10 16 / 0.7) 32%, rgb(4 10 16 / 0) 60%); }
.og-copy { position: absolute; left: 72px; top: 0; bottom: 0; width: 470px; display: flex; flex-direction: column; justify-content: center; gap: 22px; color: #f4e9d2; }
.og-title { position: relative; width: 380px; }
.og-title .title-stencil { display: block; width: 380px; height: auto; color: #f4e9d2; filter: drop-shadow(0 3px 0 rgb(0 0 0 / 0.55)); }
.og-chop { position: absolute; top: 6px; left: calc(100% + 8px); width: 58px; color: #c2412b; rotate: -6deg; }
.og-tagline { margin: 0; font-size: 40px; font-weight: 900; line-height: 1.35; letter-spacing: 0.04em; text-shadow: 0 2px 8px rgb(0 0 0 / 0.6); }
.og-note { margin: 0; font-size: 24px; font-weight: 700; color: #e6c27a; letter-spacing: 0.06em; text-shadow: 0 2px 6px rgb(0 0 0 / 0.6); }
`;
