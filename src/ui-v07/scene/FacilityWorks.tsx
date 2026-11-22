import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdditiveBlending, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { glowTexture } from '../../ui/scene/Night';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { PLAYER_ISLAND_RADIUS, seatPosition, type Vec3 } from '../../ui/scene/layout';
import type { GoodId } from '../../v07/game';
import { soundEngine } from '../audio/soundEngine';
import type { SfxId } from '../audio/soundPlan';
import { ShieldFx } from './BeatScene';
import { Burst, WaterRing, fan } from './beatFx';
import { CrateModel } from './CrateModel';
import {
  GUN_DECK,
  REPAIR,
  RETURN,
  SEAL,
  TRADE_ROOF,
  VOLLEY,
  YARD_SLIP,
  ballPose,
  coinPose,
  cratePose,
  firesAt,
  hitSpot,
  hitsAt,
  keptAt,
  keptPose,
  paysAt,
  plankLandsAt,
  plankPose,
  plankSpot,
  returnsAt,
  stampsAt,
} from './facilityWorkMath';
import { islandPoint } from './TableCanvas';

// V0.8 prototype (an experiment, not rules): the three buildings doing their work, as shows of their own on the
// table. The armory fires on the ship and takes back what the pirates would have had; the tradehouse hoists its crates
// over the roof, seals them in gold and pays out; the repair yard sends planks to the ship and the crates it kept hop
// up on deck. Every show starts counting when it mounts (key it per work); where things are comes from
// `facilityWorkMath`.

const GOLD = '#ffd25a';
const SHOT = '#ff9a3c';
const SPARKS = fan(9, Math.PI * 2, 5, 6, 5);
const SMOKE = fan(7, Math.PI * 2, 1.6, 2.4, 1);
const GLINT = fan(10, Math.PI * 2, 3, 3.5, 6);
const SPLINTERS = fan(6, Math.PI * 2, 3.5, 5, 7);
/** How high over the water the ship's deck is taken to be, for what lands on it or leaves it. */
const DECK = 2.4;
/** The tradehouse's crates hang larger than a crate on a deck: they are read from the whole table's height. */
const CRATE_SHOWN = 1.35;

const vec = (p: Vec3): Vector3 => new Vector3(...p);

/** Sounds at their moments, from the show's start; cleared if the show is cut short. */
function useTimedSounds(sounds: readonly { readonly at: number; readonly id: SfxId; readonly rate?: number }[]): void {
  useEffect(() => {
    const timers = sounds.map((s) => setTimeout(() => soundEngine.playSfx(s.id, s.rate ?? 1), s.at * 1000));
    return () => timers.forEach(clearTimeout);
    // The sounds are fixed for a show: it is remounted (keyed) for every new work.
  }, []);
}

/** Something that follows `pose(t)` from the show's start, hidden while the pose is null; it spins as it flies. */
function Flyer({ pose, spin = 0, children }: { readonly pose: (t: number) => Vec3 | null; readonly spin?: number; readonly children: ReactNode }) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const at = pose(t);
    g.visible = at !== null;
    if (!at) return;
    g.position.set(...at);
    g.rotation.set(t * spin, t * spin * 1.3, 0);
  });
  return (
    <group ref={group} visible={false}>
      {children}
    </group>
  );
}

function Coin() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[1.6, 1.6, 0.45, 18]} />
      <meshStandardMaterial color="#ffcc4d" emissive="#ffb000" emissiveIntensity={0.45} metalness={0.3} roughness={0.5} />
    </mesh>
  );
}

/** A bright puff that swells and fades at `at`, `delay` seconds into the show (a gun firing). */
function Flash({ at, delay, color = '#ffd27a', size = 1 }: { readonly at: Vec3; readonly delay: number; readonly color?: string; readonly size?: number }) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const since = clock.elapsedTime - start.current - delay;
    m.visible = since >= 0 && since < 0.2;
    if (!m.visible) return;
    m.scale.setScalar(size * (0.8 + since * 9));
    (m.material as MeshBasicMaterial).opacity = 1 - since / 0.2;
  });
  return (
    <mesh ref={mesh} position={at} visible={false}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/**
 * The armory's guns: a volley from the gun deck onto the ship, a splash and sparks where each ball lands, and the coins
 * the pirates did not get flying back to the tower. `shield`: the armory turned 海盜潮 away, a gold dome goes up over the ship.
 * `coins: false`: covering fire only (the armed ship's +1), no money comes back.
 */
export function CannonVolley({ angle, ship, shield = false, coins = true }: { readonly angle: number; readonly ship: Vec3; readonly shield?: boolean; readonly coins?: boolean }) {
  const deck = islandPoint(angle, GUN_DECK);
  const target: Vec3 = [ship[0], DECK, ship[2]];
  const glow = useMemo(() => glowTexture(), []);
  useTimedSounds([
    ...Array.from({ length: VOLLEY.shots }, (_, i) => [
      { at: firesAt(i), id: 'salute-pop' as const, rate: 0.7 },
      { at: hitsAt(i), id: 'salute-splash' as const },
    ]).flat(),
    ...(coins ? [{ at: returnsAt(RETURN.coins - 1) + RETURN.flight, id: 'settle-coins' as const }] : []),
  ]);
  return (
    <>
      {Array.from({ length: VOLLEY.shots }, (_, i) => {
        const spot = hitSpot(target, i);
        return (
          <group key={i}>
            <Flash at={deck} delay={firesAt(i)} size={2} />
            <Burst at={vec(deck)} height={deck[1]} particles={SMOKE} color="#d8d2c8" size={0.55} delay={firesAt(i)} length={0.9} gravity={-1.5} />
            <Flyer pose={(t) => ballPose(deck, target, i, t)} spin={6}>
              <mesh>
                <icosahedronGeometry args={[0.95, 0]} />
                <meshStandardMaterial color="#2b2f36" flatShading roughness={0.5} metalness={0.4} />
              </mesh>
              <sprite scale={[4.6, 4.6, 1]}>
                <spriteMaterial map={glow} color={SHOT} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
              </sprite>
            </Flyer>
            <Flash at={spot} delay={hitsAt(i)} color={SHOT} size={1.7} />
            <Burst at={vec(spot)} height={spot[1]} particles={SPARKS} color={SHOT} size={0.45} delay={hitsAt(i)} length={0.7} gravity={9} />
            <WaterRing at={vec(spot)} color="#fff2c8" delay={hitsAt(i)} from={1} to={7} length={0.7} />
          </group>
        );
      })}
      {coins &&
        Array.from({ length: RETURN.coins }, (_, i) => (
          <Flyer key={i} pose={(t) => coinPose(target, deck, i, t, returnsAt, RETURN.flight, RETURN.arc)} spin={7}>
            <Coin />
          </Flyer>
        ))}
      {coins && <Burst at={vec(deck)} height={deck[1]} particles={GLINT} color={GOLD} size={0.42} delay={returnsAt(0) + RETURN.flight} length={0.8} gravity={-1} />}
      {shield && <ShieldFx at={vec(ship)} delay={hitsAt(0)} color={GOLD} />}
    </>
  );
}

/** The armory's toll: the pirate's fee leaves the ship it was sent to and lands on the gun deck. */
export function TollCoins({ angle, ship }: { readonly angle: number; readonly ship: Vec3 }) {
  const deck = islandPoint(angle, GUN_DECK);
  const from: Vec3 = [ship[0], DECK, ship[2]];
  const leaves = (i: number): number => 0.15 + i * RETURN.gap;
  useTimedSounds([{ at: leaves(RETURN.coins - 1) + RETURN.flight, id: 'settle-coins' }]);
  return (
    <>
      <WaterRing at={vec(ship)} color={GOLD} delay={0} from={1} to={8} length={0.7} />
      {Array.from({ length: RETURN.coins }, (_, i) => (
        <Flyer key={i} pose={(t) => coinPose(from, deck, i, t, leaves, RETURN.flight, RETURN.arc)} spin={7}>
          <Coin />
        </Flyer>
      ))}
      <Burst at={vec(deck)} height={deck[1]} particles={GLINT} color={GOLD} size={0.42} delay={leaves(0) + RETURN.flight} length={0.9} gravity={-1} />
    </>
  );
}

/** One crate over the tradehouse: it comes up plain, a gold ring shuts round it and it turns to gold, then it goes back down. */
function SealedCrate({ angle, good, index, count }: { readonly angle: number; readonly good: GoodId; readonly index: number; readonly count: number }) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  const [sealed, setSealed] = useState(false);
  useFrame(({ clock }) => {
    const g = group.current;
    const r = ring.current;
    if (!g || !r) return;
    start.current ??= clock.elapsedTime;
    const pose = cratePose(index, count, clock.elapsedTime - start.current);
    g.visible = pose !== null;
    if (!pose) return;
    g.position.set(...islandPoint(angle, [TRADE_ROOF[0] + pose.x, TRADE_ROOF[1] + pose.y, TRADE_ROOF[2]]));
    g.scale.setScalar(pose.scale * CRATE_SHOWN);
    g.rotation.y = playerIslandHeading(angle) + (clock.elapsedTime - start.current) * 1.2;
    if (pose.sealed !== sealed) setSealed(pose.sealed);
    r.visible = pose.ring !== null;
    if (pose.ring !== null) {
      r.scale.setScalar(1 + pose.ring * 1.8);
      (r.material as MeshBasicMaterial).opacity = 0.35 + 0.65 * (1 - pose.ring);
    }
  });
  return (
    <group ref={group} visible={false}>
      {/* Two crates, not one prop: a crate decides its gold when it appears (CrateModel's mint). */}
      <CrateModel key={sealed ? 'sealed' : 'plain'} good={good} minted={sealed} glow={sealed} />
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[1.5, 0.16, 8, 28]} />
        <meshBasicMaterial color={GOLD} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * The tradehouse's seal: its crates hang over the roof, each sealed in gold, and a coin drops from each onto the
 * island. `shield`: the tradehouse turned 崩盤潮 away, the tide's ring runs in on the island and a gold dome stops it.
 */
export function TradeSeal({ angle, goods, shield = false }: { readonly angle: number; readonly goods: readonly GoodId[]; readonly shield?: boolean }) {
  const crates = goods.slice(0, SEAL.max);
  const [cx, , cz] = seatPosition(angle);
  const home = islandPoint(angle, [0, 0.6, 0]);
  const hang = (i: number): Vec3 => islandPoint(angle, [TRADE_ROOF[0] + (i - (crates.length - 1) / 2) * SEAL.apart, TRADE_ROOF[1] + SEAL.lift, TRADE_ROOF[2]]);
  useTimedSounds([...crates.map((_, i) => ({ at: stampsAt(i), id: 'seal' as const })), { at: paysAt(0) + SEAL.flight, id: 'settle-sale' as const }]);
  return (
    <>
      {crates.map((good, i) => (
        <group key={i}>
          <SealedCrate angle={angle} good={good} index={i} count={crates.length} />
          <Burst at={vec(hang(i))} height={hang(i)[1]} particles={GLINT} color={GOLD} size={0.4} delay={stampsAt(i) + SEAL.close} length={0.8} gravity={2} />
          <Flyer pose={(t) => coinPose(hang(i), home, i, t, paysAt, SEAL.flight, SEAL.arc)} spin={7}>
            <Coin />
          </Flyer>
        </group>
      ))}
      {shield && (
        <>
          <WaterRing at={new Vector3(cx, 0, cz)} color="#49c79a" delay={0} from={PLAYER_ISLAND_RADIUS + 12} to={PLAYER_ISLAND_RADIUS + 1} length={0.7} />
          <ShieldFx at={new Vector3(cx, 0, cz)} delay={0.45} color={GOLD} size={2} />
        </>
      )}
    </>
  );
}

/**
 * The repair yard's run: planks fly from the slip and are nailed on the hull, then the crates the yard kept on board
 * hop up on deck. `shield`: the yard turned 風暴潮 away, a gold dome goes up over the ship.
 */
export function RepairRun({ angle, ship, goods, shield = false }: { readonly angle: number; readonly ship: Vec3; readonly goods: readonly GoodId[]; readonly shield?: boolean }) {
  const slip = islandPoint(angle, YARD_SLIP);
  const hull: Vec3 = [ship[0], DECK - 0.6, ship[2]];
  const kept = goods.slice(0, REPAIR.max);
  useTimedSounds([
    ...Array.from({ length: REPAIR.planks }, (_, i) => ({ at: plankLandsAt(i), id: 'build' as const, rate: 1.1 + i * 0.08 })),
    ...(kept.length > 0 ? [{ at: keptAt(0), id: 'island-pop' as const }] : []),
  ]);
  return (
    <>
      <Burst at={vec(slip)} height={slip[1]} particles={SMOKE} color="#e9dcc0" size={0.4} delay={0} length={0.8} gravity={2} />
      {Array.from({ length: REPAIR.planks }, (_, i) => {
        const spot = plankSpot(hull, i);
        return (
          <group key={i}>
            <Flyer pose={(t) => plankPose(slip, hull, i, t)} spin={5}>
              <mesh>
                <boxGeometry args={[3.4, 0.32, 0.8]} />
                <meshStandardMaterial color="#c79a5b" flatShading roughness={0.85} />
              </mesh>
            </Flyer>
            <Flash at={[spot[0], spot[1] + 0.6, spot[2]]} delay={plankLandsAt(i)} size={0.7} />
            <Burst at={vec(spot)} height={spot[1] + 0.6} particles={SPLINTERS} color="#e8c58a" size={0.34} delay={plankLandsAt(i)} length={0.6} gravity={10} box />
          </group>
        );
      })}
      {kept.map((good, i) => (
        <Flyer
          key={i}
          pose={(t) => {
            const p = keptPose(i, kept.length, t);
            return p && p.scale > 0.02 ? [ship[0] + p.x, p.y, ship[2]] : null;
          }}
        >
          <group scale={1.25}>
            <CrateModel good={good} minted glow />
          </group>
        </Flyer>
      ))}
      <WaterRing at={vec(ship)} color={GOLD} delay={plankLandsAt(REPAIR.planks - 1)} from={1} to={10} length={0.8} />
      {shield && <ShieldFx at={vec(ship)} delay={plankLandsAt(0)} color={GOLD} />}
    </>
  );
}
