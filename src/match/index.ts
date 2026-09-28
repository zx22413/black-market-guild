// Public API of the match runner. UI, simulations and the future server import from here.
export { botController, replayMatch, runMatch, runMatchSync } from './runner';
export { setupFromSeats } from './seats';
export type {
  Controller,
  EventListener,
  MatchLog,
  MatchSetup,
  SeatConfig,
  SeatSetupInput,
  SyncController,
} from './types';
