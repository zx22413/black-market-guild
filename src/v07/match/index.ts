// Public API of the V0.7 match runner (docs/v07-migration-plan.md stage 3). Simulations, and later
// the UI and the server, import from here.
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
