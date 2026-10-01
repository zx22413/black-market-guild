import { useFrame } from '@react-three/fiber';
import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { easeSwell, type Swell } from './weather';

const SwellContext = createContext<RefObject<Swell> | null>(null);

/**
 * Eases the sea toward the current event's swell once per frame and shares it, so the waves and
 * every ship on them change together. Read it inside `useFrame`; it never triggers a re-render.
 */
export function SwellProvider({ target, children }: { readonly target: Swell; readonly children: ReactNode }) {
  const swell = useRef(target);
  useFrame((_, delta) => {
    swell.current = easeSwell(swell.current, target, delta);
  });
  return <SwellContext value={swell}>{children}</SwellContext>;
}

export function useSwell(): RefObject<Swell> {
  const swell = useContext(SwellContext);
  if (!swell) throw new Error('useSwell must be used inside <SwellProvider>');
  return swell;
}
