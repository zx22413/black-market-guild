import { useFrame, type RenderCallback } from '@react-three/fiber';
import { createContext, useContext } from 'react';

/** True inside the warm-up's offstage copies (see `EffectWarmup`), which are never drawn. */
export const OffstageContext = createContext(false);

/**
 * `useFrame` for effects that also stand offstage in the shader warm-up: there the copy stays
 * mounted for good, so it skips its per-frame work instead of animating something nobody sees.
 */
export function useLiveFrame(callback: RenderCallback): void {
  const offstage = useContext(OffstageContext);
  useFrame((state, delta, frame) => {
    if (!offstage) callback(state, delta, frame);
  });
}
