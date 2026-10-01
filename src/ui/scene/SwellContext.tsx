import { useFrame } from '@react-three/fiber';
import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { WAVE_SPEED } from './seaWave';
import { easeSwell, type Swell } from './weather';

interface SeaState {
  readonly swell: RefObject<Swell>;
  /** Wave phase, accumulated per frame so a change of wave speed never makes the waves jump. */
  readonly phase: RefObject<number>;
}

const SwellContext = createContext<SeaState | null>(null);

/**
 * Eases the sea toward the current event's swell once per frame, advances the wave phase, and shares
 * both, so the waves, every ship on them and the spray off their crests move together. Read them
 * inside `useFrame`; they never trigger a re-render.
 */
export function SwellProvider({ target, children }: { readonly target: Swell; readonly children: ReactNode }) {
  const swell = useRef(target);
  const phase = useRef(0);
  useFrame((_, delta) => {
    swell.current = easeSwell(swell.current, target, delta);
    phase.current += delta * WAVE_SPEED * swell.current.speed;
  });
  const state = useMemo(() => ({ swell, phase }), []);
  return <SwellContext value={state}>{children}</SwellContext>;
}

function useSeaState(): SeaState {
  const state = useContext(SwellContext);
  if (!state) throw new Error('useSwell and useWavePhase must be used inside <SwellProvider>');
  return state;
}

export function useSwell(): RefObject<Swell> {
  return useSeaState().swell;
}

export function useWavePhase(): RefObject<number> {
  return useSeaState().phase;
}
