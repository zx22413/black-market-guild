import { useTexture } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { SpriteMaterial, type Sprite } from 'three';
import { spawnMote, type Mote } from './goldMath';
import { useLiveFrame } from './liveFrame';

/** Kenney Particle Pack sparkles (CC0; see public/art/SOURCES.md), in `MOTE_KINDS` order. */
const SPARKLES = ['star_05', 'star_06', 'star_07'].map((name) => `${import.meta.env.BASE_URL}art/particles/${name}.png`);
const MOTES = 80;
const GOLD = '#ffd25c';
const OPACITY = 1;
/** Fade in over this share of a mote's life, and out over the last share. */
const FADE_IN = 0.12;
const FADE_OUT = 0.4;

interface Live {
  mote: Mote;
  age: number;
}

/**
 * Black market rush: gold sparkles rising from around the black market port and, more thinly, all
 * over the table, twinkling and turning as they drift up and fade, like the glint of coin changing
 * hands. The sprites are white-on-black, so they serve as alpha masks: the gold stays gold over any
 * sea, where additive blending would wash it green over teal water.
 */
export function GoldRush() {
  const textures = useTexture(SPARKLES);
  const materials = useMemo(
    // Unaffected by tone mapping so the gold glints at full brightness; the mask is set from the
    // start so every material is compiled with it.
    () => Array.from({ length: MOTES }, () => new SpriteMaterial({ color: GOLD, alphaMap: textures[0] ?? null, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
    [textures],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  // Start every mote part-way through its life, so the sky is already glittering when the rush begins.
  const live = useMemo((): Live[] => Array.from({ length: MOTES }, () => {
    const mote = spawnMote(Math.random);
    return { mote, age: Math.random() * mote.life };
  }), []);
  const sprites = useRef<(Sprite | null)[]>([]);

  useLiveFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const t = clock.elapsedTime;
    live.forEach((slot, i) => {
      slot.age += delta;
      if (slot.age >= slot.mote.life) {
        slot.mote = spawnMote(Math.random);
        slot.age = 0;
      }
      const { mote, age } = slot;
      const sprite = sprites.current[i];
      const material = materials[i]!;
      if (!sprite) return;
      const k = age / mote.life;
      const fade = Math.min(1, k / FADE_IN, (1 - k) / FADE_OUT);
      const twinkle = 0.65 + 0.35 * Math.sin(t * 6 + mote.swayPhase * 3);
      material.alphaMap = textures[mote.kind] ?? null;
      material.opacity = OPACITY * fade * twinkle;
      material.rotation = mote.swayPhase + age * mote.spin;
      sprite.position.set(mote.x + Math.sin(age * 1.5 + mote.swayPhase) * mote.sway, mote.y + age * mote.rise, mote.z);
      sprite.scale.setScalar(mote.size * (0.7 + 0.3 * twinkle));
    });
  });

  return (
    <>
      {materials.map((material, i) => (
        <sprite
          key={i}
          ref={(s) => {
            sprites.current[i] = s;
          }}
          material={material}
        />
      ))}
    </>
  );
}
