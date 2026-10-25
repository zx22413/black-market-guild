import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CylinderGeometry, ShaderMaterial, Vector2, Vector3, type Group, type Mesh, type MeshBasicMaterial, type Sprite } from 'three';
import { BEAM_COLOR, beamMaterial } from '../../ui/scene/buildings/Landmark';
import { glowTexture } from '../../ui/scene/Night';
import type { Vec3 } from '../../ui/scene/layout';
import { soundEngine } from '../audio/soundEngine';
import { DARKNESS, SPOT_TIME, spotlightFrame, type SpotlightCue } from './spotlightMath';

// The lighthouse at work on the 3D table: everything goes dark but the lighthouse's lamp and the
// ships its beams fall on, the beams swing onto them, lock with a flash and, at the reveal, close
// onto the ship that was rerolled. The timing is `spotlightFrame`; this only draws it.

/** Most beams at once (the lighthouse intel looks at two ships); the dark shader has room for these plus the lamp. */
const MAX_BEAMS = 2;
/** World radius kept lit round each ship the beams fall on, and round the lamp. */
const SHIP_LIGHT = 7;
const LAMP_LIGHT = 3.5;
/** The beam's width at the sea, per unit of its length, and the glow pool's size there. */
const SPREAD = 0.13;
const POOL = 4.5;
/** How strong the beam is at full strength (the night beam is 0.2). */
const BEAM_OPACITY = 0.5;
/** Drawn after everything else, over the dark. */
const OVER = 1000;

/** A full-screen dark veil with soft round holes (in drawing-buffer pixels) where the light is. */
function veilMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uDark: { value: 0 }, uHoles: { value: Array.from({ length: MAX_BEAMS + 1 }, () => new Vector3()) } },
    vertexShader: `
      void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform float uDark;
      uniform vec3 uHoles[${MAX_BEAMS + 1}];
      void main() {
        float lit = 0.0;
        for (int i = 0; i < ${MAX_BEAMS + 1}; i++) {
          vec3 h = uHoles[i];
          if (h.z > 0.0) lit = max(lit, 1.0 - smoothstep(h.z * 0.45, h.z, distance(gl_FragCoord.xy, h.xy)));
        }
        gl_FragColor = vec4(0.02, 0.03, 0.08, uDark * (1.0 - lit));
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

export function Spotlight({ cue }: { readonly cue: SpotlightCue }) {
  // The beam's sweep as it swings onto the ships, a ding as it locks, and another as the beams close onto the one that was rerolled.
  // The one place the lighthouse sounds, whoever's beam it is (a beat's island step, an intel look).
  useEffect(() => {
    const skip = cue.skip ?? 0;
    const sounds = [
      { at: SPOT_TIME.swingFrom, id: 'beam-sweep' as const },
      { at: SPOT_TIME.lock, id: 'beacon-ding' as const },
      ...(cue.settle === null ? [] : [{ at: SPOT_TIME.closeFrom, id: 'beacon-ding' as const }]),
    ].filter(({ at }) => at >= skip);
    const timers = sounds.map(({ at, id }) => setTimeout(() => soundEngine.playSfx(id), (at - skip) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [cue.key]);
  const start = useRef<number | null>(null);
  const beams = useRef<(Group | null)[]>([]);
  const pools = useRef<(Mesh | null)[]>([]);
  const lampGlow = useRef<Sprite>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const veil = useMemo(veilMaterial, []);
  // One material per beam, so each fades on its own.
  const count = Math.min(cue.targets.length, MAX_BEAMS);
  const lights = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const m = beamMaterial();
        m.depthTest = false;
        return m;
      }),
    [count],
  );
  // A cone one unit long, narrow at the lamp and opening along +x; scaled to each beam's length.
  const cone = useMemo(() => {
    const g = new CylinderGeometry(SPREAD, 0.004, 1, 16, 1, true);
    g.translate(0, 0.5, 0);
    g.rotateZ(-Math.PI / 2);
    return g;
  }, []);
  const glow = useMemo(() => glowTexture(), []);
  useEffect(() => () => [veil, cone, ...lights].forEach((d) => d.dispose()), [veil, cone, lights]);
  const scratch = useMemo(() => ({ size: new Vector2(), p: new Vector3(), q: new Vector3() }), []);

  useFrame(({ clock }) => {
    start.current ??= clock.elapsedTime;
    const frame = spotlightFrame(cue, clock.elapsedTime - start.current);
    const [lx, ly, lz] = cue.lamp;
    frame.beams.slice(0, count).forEach((beam, i) => {
      const g = beams.current[i];
      const [ex, ey, ez] = beam.end;
      const [dx, dy, dz] = [ex - lx, ey - ly, ez - lz];
      const flat = Math.hypot(dx, dz);
      if (g) {
        g.visible = beam.strength > 0;
        g.rotation.set(0, Math.atan2(-dz, dx), Math.atan2(dy, flat), 'YZX');
        g.scale.setScalar(Math.hypot(flat, dy));
      }
      lights[i]!.uniforms.uOpacity!.value = BEAM_OPACITY * beam.strength * (1 + frame.flare);
      const pool = pools.current[i];
      if (pool) {
        pool.visible = beam.strength > 0;
        pool.position.set(ex, 0.4, ez);
        pool.scale.setScalar(POOL * (1 + frame.flare * 0.6));
        (pool.material as MeshBasicMaterial).opacity = Math.min(1, beam.strength * (0.55 + frame.flare));
      }
    });
    const lamp = lampGlow.current;
    if (lamp) {
      lamp.visible = frame.dark > 0;
      lamp.scale.setScalar(2.2 + frame.flare * 2);
      lamp.material.opacity = frame.dark / DARKNESS;
    }
    // The veil's holes: the lamp and every beam's end, projected to drawing-buffer pixels.
    gl.getDrawingBufferSize(scratch.size);
    const hole = (at: Vec3, radius: number, out: Vector3) => {
      scratch.p.set(...at).project(camera);
      scratch.q.set(at[0] + radius, at[1], at[2]).project(camera);
      const x = ((scratch.p.x + 1) / 2) * scratch.size.x;
      const y = ((scratch.p.y + 1) / 2) * scratch.size.y;
      out.set(x, y, Math.hypot(((scratch.q.x - scratch.p.x) / 2) * scratch.size.x, ((scratch.q.y - scratch.p.y) / 2) * scratch.size.y));
    };
    const holes = veil.uniforms.uHoles!.value as Vector3[];
    hole(cue.lamp, LAMP_LIGHT, holes[0]!);
    for (let i = 0; i < MAX_BEAMS; i++) {
      const beam = frame.beams[i];
      if (beam && beam.strength > 0) hole(beam.end, SHIP_LIGHT, holes[i + 1]!);
      else holes[i + 1]!.set(0, 0, 0);
    }
    veil.uniforms.uDark!.value = frame.dark;
  });

  return (
    <group>
      <mesh material={veil} frustumCulled={false} renderOrder={OVER}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <sprite ref={lampGlow} position={[...cue.lamp]} renderOrder={OVER + 1} visible={false}>
        <spriteMaterial map={glow} color={BEAM_COLOR} transparent blending={AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      {lights.map((light, i) => (
        <group key={i}>
          <group
            ref={(g) => {
              beams.current[i] = g;
            }}
            position={[...cue.lamp]}
            visible={false}
          >
            <mesh geometry={cone} material={light} renderOrder={OVER + 1} />
          </group>
          <mesh
            ref={(m) => {
              pools.current[i] = m;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={OVER + 1}
            visible={false}
          >
            <circleGeometry args={[1, 32]} />
            <meshBasicMaterial map={glow} color={BEAM_COLOR} transparent blending={AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
