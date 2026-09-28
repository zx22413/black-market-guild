import { useSyncExternalStore } from 'react';
import type { GameSession, SessionSnapshot } from './gameSession';

export function useSession(session: GameSession): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}
