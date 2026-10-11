// Cloudflare Worker (deployed): serves the built game (dist/) and the V0.6 online rooms under /api.
// The V0.7 rooms run locally from worker-v07.ts until the migration cuts over (docs/v07-migration-plan.md).
import * as online from '../src/online';
import { RoomObjectBase, createWorker, type OnlineModule } from './rooms';

const v06: OnlineModule<online.ClientMessage> = { ...online, createRoom: (options) => new online.Room(options) };

// The room only ever receives what this module's own parser produced, so widening the message type is safe.
export default createWorker(v06 as OnlineModule);

export class RoomObject extends RoomObjectBase {
  protected readonly online = v06 as OnlineModule;
}
