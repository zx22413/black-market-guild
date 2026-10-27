// Cloudflare Worker (deployed): serves the built game (dist/) and the V0.7 online rooms under /api.
import * as online from '../src/v07/online';
import { RoomObjectBase, createWorker, type OnlineModule } from './rooms';

export { LimiterObject } from './rooms';

const v07: OnlineModule<online.ClientMessage> = { ...online, createRoom: (options) => new online.Room(options) };

// The room only ever receives what this module's own parser produced, so widening the message type is safe.
export default createWorker(v07 as OnlineModule);

export class RoomObject extends RoomObjectBase {
  protected readonly online = v07 as OnlineModule;
}
