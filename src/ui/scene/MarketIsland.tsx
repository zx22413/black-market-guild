import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, type BufferGeometry, type Group, type Mesh, type PointLight, type Sprite } from 'three';
import { geometryFromParts } from './buildings/Building';
import { Landmark } from './buildings/Landmark';
import {
  AWNING_OPEN,
  AWNING_REEFED,
  AWNING_SHUT,
  BOARD,
  BOARD_ROWS,
  BOARD_ROW,
  LAMPLIGHTER,
  LANTERN_SIZE,
  LIGHTER_PATH,
  MARKET_AWNINGS,
  MARKET_BELL,
  MARKET_LANTERNS,
  MARKET_SCALE,
  PORTER,
  PORTER_CRATE,
  barLength,
  rowHeight,
} from './buildings/islands/market';
import { limbSwing, walkBob } from './buildings/islands/people';
import type { KitPart } from './buildings/kit';
import type { Walker } from './buildings/islands/design';
import { IslandBase } from './IslandBase';
import { TARGET_ISLAND_HEIGHT, TARGET_ISLAND_SEED } from './islandShape';
import { TARGET_ISLAND_RADIUS } from './layout';
import { useLiveFrame } from './liveFrame';
import { MARKET_GROUND, marketDock } from './marketDocks';
import { awningAngle, bellSwing, flipAngle, flipShowsNew, FLIP, lanternLitAt, pathLength, walkAt } from './marketMotion';
import { glowTexture } from './Night';

// The market island at the middle of the table (docs/ui/v07-event-presentation.md §1.10): the stepped
// bazaar on its island, a pier at every guild's berth, and the parts that move with the round. The
// caller says what the public events show (prices, whether the market is open, the weather, the
// ships that have arrived); this component only plays it.

/** Awnings: out (open for trade), half in against a storm, or folded up against the walls. */
export type AwningState = 'open' | 'reefed' | 'shut';

/** One ship's cargo carried up to the stalls: a crate color per porter, from the berth of the seat at `angle`. */
export interface MarketDelivery {
  readonly key: string;
  readonly angle: number;
  readonly crates: readonly string[];
}

/** How the lanterns are lit: dark, lit one by one by the lamplighter from when night falls, or (the menu) lit and put out in a loop. */
export type LanternMode = 'off' | 'night' | 'cycle';

export interface MarketShow {
  /** Each good's price cell (0..6), board row order (wood, iron, spice, arms); null hides nothing and shows the opening cells. */
  readonly prices: readonly number[] | null;
  /** The bars' colors, one per row. */
  readonly rowColors: readonly string[];
  readonly awnings: AwningState;
  readonly lanterns: LanternMode;
  readonly deliveries: readonly MarketDelivery[];
  /** Strikes the bell whenever it changes (null: no stroke). */
  readonly bellKey?: string | null;
}

const OPENING_CELLS = [2, 2, 3, 3] as const;
const AWNING_ANGLE: Readonly<Record<AwningState, number>> = { open: AWNING_OPEN, reefed: AWNING_REEFED, shut: AWNING_SHUT };
/** Seconds between one awning starting to move and the next, so they roll out round the rings. */
const AWNING_STAGGER = 0.06;
/** The porters' pace (table units per second), the gap between porters, and how long one takes to step into the stall. */
const PORTERS = { speed: 1.7, gap: 0.9, vanish: 0.5, max: 6 } as const;
/** The lamplighter's pace (design units per second), how far his pole reaches across and up, and the menu's loop. */
const LIGHTER = { speed: 0.9, reach: 0.75, climb: 1.7, holdLit: 8, rest: 6 } as const;
const LANTERN_LIT = '#ffb347';
const LANTERN_PAPER = '#d9733a';
/** Light from each ring of lanterns once it is lit (night only): where (design units), how far and how strong. */
const RING_LIGHTS = [
  { at: [0, 1.6, 2.6], reach: 14, ring: 0 },
  { at: [0, 1.6, -2.6], reach: 14, ring: 0 },
  { at: [0, 4.2, 0], reach: 10, ring: 1 },
] as const;
const RING_LIGHT_INTENSITY = 16;

const awningGeometries = MARKET_AWNINGS.map((a) => geometryFromParts(a.parts));
const bellGeometry = geometryFromParts(MARKET_BELL.parts).translate(-MARKET_BELL.pivot[0], -MARKET_BELL.pivot[1], -MARKET_BELL.pivot[2]);
const lanternGeometry = new BoxGeometry(LANTERN_SIZE.width, LANTERN_SIZE.height, LANTERN_SIZE.width).translate(0, -LANTERN_SIZE.height / 2, 0);
const barGeometry = new BoxGeometry(1, BOARD_ROW.height, 0.03).translate(0.5, 0, 0);
const lighterLength = pathLength(LIGHTER_PATH);
const litAt = lanternLitAt(LIGHTER_PATH, MARKET_LANTERNS, LIGHTER.reach, LIGHTER.climb);

function Awnings({ state }: { readonly state: AwningState }) {
  const hinges = useRef<(Group | null)[]>([]);
  const motion = useRef({ from: AWNING_ANGLE[state], to: AWNING_ANGLE[state], since: -Infinity, now: 0 });
  useEffect(() => {
    const m = motion.current;
    // Start from wherever the awnings are now (the last one round the ring lags the most).
    m.from = awningAngle(m.from, m.to, m.now - m.since - AWNING_STAGGER * MARKET_AWNINGS.length);
    m.to = AWNING_ANGLE[state];
    m.since = m.now;
  }, [state]);
  useLiveFrame(({ clock }) => {
    const m = motion.current;
    m.now = clock.elapsedTime;
    hinges.current.forEach((h, i) => {
      if (h) h.rotation.x = awningAngle(m.from, m.to, m.now - m.since - AWNING_STAGGER * i);
    });
  });
  return (
    <>
      {MARKET_AWNINGS.map((a, i) => (
        <group key={i} rotation={[0, a.spin, 0]}>
          <group position={[...a.hinge]} ref={(g) => void (hinges.current[i] = g)}>
            <mesh geometry={awningGeometries[i]!} castShadow dispose={null}>
              <meshStandardMaterial vertexColors roughness={0.85} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

/** The board's bars on all four faces: each row flips over when its price moves. */
function Board({ prices, colors }: { readonly prices: readonly number[] | null; readonly colors: readonly string[] }) {
  const cells = prices ?? OPENING_CELLS;
  const bars = useRef<(Mesh | null)[]>([]);
  const rows = useRef<(Group | null)[]>([]);
  const state = useRef({ shown: [...cells], next: [...cells], since: Array.from({ length: BOARD_ROWS }, () => -Infinity), now: 0 });
  useEffect(() => {
    const s = state.current;
    cells.forEach((cell, i) => {
      if (cell !== s.next[i]) {
        s.shown[i] = s.next[i]!;
        s.next[i] = cell;
        s.since[i] = s.now;
      }
    });
  }, [cells]);
  useLiveFrame(({ clock }) => {
    const s = state.current;
    s.now = clock.elapsedTime;
    BOARD.faces.forEach((_, f) => {
      for (let i = 0; i < BOARD_ROWS; i++) {
        const elapsed = s.now - s.since[i]! - FLIP.faceLag * f;
        const k = f * BOARD_ROWS + i;
        const row = rows.current[k];
        if (row) row.rotation.x = flipAngle(elapsed);
        bars.current[k]?.scale.set(barLength(flipShowsNew(elapsed) ? s.next[i]! : s.shown[i]!), 1, 1);
      }
    });
  });
  const materials = useMemo(() => colors.map((color) => new MeshStandardMaterial({ color, roughness: 0.7 })), [colors]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  return (
    <>
      {BOARD.faces.map((spin, f) => (
        <group key={f} rotation={[0, spin, 0]}>
          {Array.from({ length: BOARD_ROWS }, (_, i) => (
            <group key={i} position={[0, rowHeight(i), BOARD.out]} ref={(g) => void (rows.current[f * BOARD_ROWS + i] = g)}>
              <mesh
                geometry={barGeometry}
                material={materials[i] ?? materials[0]!}
                position={[BOARD_ROW.left, 0, 0]}
                ref={(m) => void (bars.current[f * BOARD_ROWS + i] = m)}
                dispose={null}
              />
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

function Bell({ strike }: { readonly strike: string | null }) {
  const swing = useRef<Group>(null);
  const struck = useRef({ at: -Infinity, now: 0 });
  useEffect(() => {
    if (strike !== null) struck.current.at = struck.current.now;
  }, [strike]);
  useLiveFrame(({ clock }) => {
    struck.current.now = clock.elapsedTime;
    if (swing.current) swing.current.rotation.x = bellSwing(struck.current.now - struck.current.at);
  });
  return (
    <group position={[...MARKET_BELL.pivot]} ref={swing}>
      <mesh geometry={bellGeometry} castShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}

/** Sets a walking figure's stride on its hinges `distance` (design units) into its walk. */
function stride(walker: Pick<Walker, 'limbs'>, hinges: readonly (Group | null)[], distance: number): void {
  walker.limbs.forEach(({ swing, hinge }, i) => hinges[i]?.rotation.set(0, 0, limbSwing(distance, swing, hinge[1] < 0.6)));
}

const crateGeometry = new BoxGeometry(PORTER_CRATE.size, PORTER_CRATE.size, PORTER_CRATE.size);

/** The porters of each delivery: one per crate, up to `PORTERS.max`, setting off one after another when the delivery first appears. */
function Porters({ deliveries, paths }: { readonly deliveries: readonly MarketDelivery[]; readonly paths: ReadonlyMap<number, readonly [number, number, number][]> }) {
  const starts = useRef(new Map<string, number>());
  const now = useRef(0);
  useLiveFrame(({ clock }) => void (now.current = clock.elapsedTime));
  for (const d of deliveries) if (!starts.current.has(d.key)) starts.current.set(d.key, now.current);
  return (
    <>
      {deliveries.flatMap((d) => {
        const path = paths.get(d.angle);
        if (!path) return [];
        return d.crates.slice(0, PORTERS.max).map((color, j) => (
          <CarriedCrate key={`${d.key}-${j}`} path={path} color={color} start={starts.current.get(d.key) ?? 0} delay={j * PORTERS.gap} />
        ));
      })}
    </>
  );
}

/** A porter and the crate on the head, walking together. */
function CarriedCrate({ path, color, start, delay }: { readonly path: readonly [number, number, number][]; readonly color: string; readonly start: number; readonly delay: number }) {
  const length = useMemo(() => pathLength(path), [path]);
  const body = useMemo(() => geometryFromParts(PORTER.body), []);
  const limbs = useMemo(() => PORTER.limbs.map((limb) => geometryFromParts(limb.parts)), []);
  useEffect(
    () => () => {
      body.dispose();
      limbs.forEach((g) => g.dispose());
    },
    [body, limbs],
  );
  const root = useRef<Group>(null);
  const hinges = useRef<(Group | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime - start - delay;
    const d = t * PORTERS.speed;
    const done = (d - length) / PORTERS.speed;
    g.visible = t >= 0 && done < PORTERS.vanish;
    if (!g.visible) return;
    const { at, heading } = walkAt(path, d);
    const run = d / MARKET_SCALE;
    const shrink = done > 0 ? Math.max(0.01, 1 - done / PORTERS.vanish) : 1;
    g.position.set(at[0], at[1] + walkBob(run) * MARKET_SCALE, at[2]);
    g.rotation.set(0, heading, 0);
    g.scale.setScalar(MARKET_SCALE * shrink);
    stride(PORTER, hinges.current, done > 0 ? 0 : run);
  });
  return (
    <group ref={root} visible={false}>
      <mesh geometry={body} castShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      <mesh geometry={crateGeometry} position={[...PORTER_CRATE.at]} castShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {PORTER.limbs.map(({ hinge }, i) => (
        <group key={i} position={[...hinge]} ref={(h) => void (hinges.current[i] = h)}>
          <mesh geometry={limbs[i]!} castShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** How far along the lamplighter's walk he is `elapsed` seconds into the night (or the menu's loop), and whether he is out walking. */
function lighterProgress(mode: LanternMode, elapsed: number): { readonly distance: number; readonly walking: boolean } {
  if (mode === 'off') return { distance: -1, walking: false };
  const walk = lighterLength / LIGHTER.speed;
  if (mode === 'cycle') {
    const loop = walk + LIGHTER.holdLit + LIGHTER.rest;
    const t = elapsed % loop;
    if (t > walk + LIGHTER.holdLit) return { distance: -1, walking: false };
    return { distance: Math.min(lighterLength, t * LIGHTER.speed), walking: t < walk };
  }
  return { distance: Math.min(lighterLength, elapsed * LIGHTER.speed), walking: elapsed < walk };
}

/** Every lantern, dark paper until the lamplighter reaches it, then glowing; and the lamplighter on his round. */
function Lanterns({ mode, night }: { readonly mode: LanternMode; readonly night: boolean }) {
  const dark = useMemo(() => new MeshStandardMaterial({ color: LANTERN_PAPER, roughness: 0.7 }), []);
  const lit = useMemo(() => new MeshBasicMaterial({ color: LANTERN_LIT, toneMapped: false }), []);
  useEffect(
    () => () => {
      dark.dispose();
      lit.dispose();
    },
    [dark, lit],
  );
  const halo = useMemo(() => glowTexture(), []);
  const bodies = useRef<(Mesh | null)[]>([]);
  const halos = useRef<(Sprite | null)[]>([]);
  const lights = useRef<(PointLight | null)[]>([]);
  const walker = useRef<Group>(null);
  const hinges = useRef<(Group | null)[]>([]);
  const since = useRef<{ mode: LanternMode; at: number | null }>({ mode, at: null });
  const body = useMemo(() => geometryFromParts(LAMPLIGHTER.body as readonly KitPart[]), []);
  const limbs = useMemo(() => LAMPLIGHTER.limbs.map((limb) => geometryFromParts(limb.parts)), []);
  useEffect(() => {
    since.current = { mode, at: null };
  }, [mode]);
  useLiveFrame(({ clock }) => {
    const s = since.current;
    if (s.at === null) s.at = clock.elapsedTime;
    const { distance, walking } = lighterProgress(s.mode, clock.elapsedTime - s.at);
    const litByRing = [0, 0, 0];
    MARKET_LANTERNS.forEach((_, i) => {
      const on = distance >= litAt[i]!;
      const b = bodies.current[i];
      if (b) b.material = on ? lit : dark;
      const h = halos.current[i];
      if (h) h.visible = on;
      if (on) litByRing[ringOf(i)]! += 1;
    });
    RING_LIGHTS.forEach(({ ring }, r) => {
      const light = lights.current[r];
      if (light) light.intensity = night ? RING_LIGHT_INTENSITY * Math.min(1, (2 * litByRing[ring]!) / RING_SIZES[ring]!) : 0;
    });
    const w = walker.current;
    if (w) {
      w.visible = walking;
      if (walking) {
        const { at, heading } = walkAt(LIGHTER_PATH, distance);
        w.position.set(at[0], at[1] + walkBob(distance), at[2]);
        w.rotation.set(0, heading, 0);
        LAMPLIGHTER.limbs.forEach(({ swing, hinge }, i) => hinges.current[i]?.rotation.set(0, 0, limbSwing(distance, swing, hinge[1] < 0.6)));
      }
    }
  });
  return (
    <>
      {MARKET_LANTERNS.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh geometry={lanternGeometry} material={dark} ref={(m) => void (bodies.current[i] = m)} dispose={null} />
          <sprite scale={[0.55, 0.55, 1]} position={[0, -LANTERN_SIZE.height / 2, 0]} visible={false} ref={(s) => void (halos.current[i] = s)}>
            <spriteMaterial map={halo} color={LANTERN_LIT} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
      {RING_LIGHTS.map(({ at, reach }, r) => (
        <pointLight key={r} position={[...at]} color={LANTERN_LIT} distance={reach / MARKET_SCALE} decay={2} intensity={0} ref={(l) => void (lights.current[r] = l)} />
      ))}
      <group ref={walker} visible={false}>
        <mesh geometry={body} castShadow dispose={null}>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
        {LAMPLIGHTER.limbs.map(({ hinge }, i) => (
          <group key={i} position={[...hinge]} ref={(g) => void (hinges.current[i] = g)}>
            <mesh geometry={limbs[i]!} castShadow dispose={null}>
              <meshStandardMaterial vertexColors roughness={0.85} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

/** Which ring a lantern hangs on (0 the first terrace, 1 the second, 2 the top), from its index in `MARKET_LANTERNS`. */
const RING_SIZES = [16, 8, 4] as const;
function ringOf(i: number): number {
  return i < RING_SIZES[0] ? 0 : i < RING_SIZES[0] + RING_SIZES[1] ? 1 : 2;
}

/** The piers at each guild's berth and the stairs up the cliff behind them. */
function Piers({ geometry }: { readonly geometry: BufferGeometry }) {
  return (
    <mesh geometry={geometry} castShadow receiveShadow dispose={null}>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

const DEFAULT_SHOW: MarketShow = { prices: null, rowColors: ['#c08a4e', '#9fb0bd', '#e2823a', '#d35d6e'], awnings: 'open', lanterns: 'off', deliveries: [] };

/** The market island: its ground, the stepped bazaar and its moving parts, and a pier at every seat's berth. */
export function MarketIsland({ seatAngles, show = DEFAULT_SHOW, night = false }: { readonly seatAngles: readonly number[]; readonly show?: MarketShow; readonly night?: boolean }) {
  const key = seatAngles.map((a) => a.toFixed(4)).join('|');
  const docks = useMemo(
    () => new Map(seatAngles.map((a) => [a, marketDock(a)] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const pierGeometry = useMemo(() => geometryFromParts([...docks.values()].flatMap((d) => d.parts)), [docks]);
  useEffect(() => () => pierGeometry.dispose(), [pierGeometry]);
  const paths = useMemo(() => new Map([...docks].map(([a, d]) => [a, d.porterPath.map((p) => [...p] as [number, number, number])] as const)), [docks]);
  return (
    <group>
      <IslandBase radius={TARGET_ISLAND_RADIUS} seed={TARGET_ISLAND_SEED} height={TARGET_ISLAND_HEIGHT} />
      <group position={[0, MARKET_GROUND, 0]} scale={MARKET_SCALE}>
        <Landmark design="market" />
        <Awnings state={show.awnings} />
        <Board prices={show.prices} colors={show.rowColors} />
        <Bell strike={show.bellKey ?? null} />
        <Lanterns mode={show.lanterns} night={night} />
      </group>
      <Piers geometry={pierGeometry} />
      <Porters deliveries={show.deliveries} paths={paths} />
    </group>
  );
}
