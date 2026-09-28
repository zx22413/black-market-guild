import type { MatchEvent, PlayerId, ShipId } from '../game';

/**
 * What a bot remembers from public events: how often each opponent guards or pirates, and
 * who acted against ships this bot sailed on (piracy or smuggling), which lowers trust.
 */
export class BotMemory {
  private roundsSeen = 0;
  private readonly pirates = new Map<PlayerId, number>();
  private readonly ownGuards = new Map<PlayerId, number>();
  private readonly otherGuards = new Map<PlayerId, number>();
  private readonly smuggles = new Map<PlayerId, number>();
  private readonly hostility = new Map<PlayerId, number>();
  private owners = new Map<ShipId, readonly PlayerId[]>();

  observe(events: readonly MatchEvent[], self: PlayerId): void {
    for (const event of events) {
      if (event.type === 'round-started') {
        this.roundsSeen += 1;
        this.owners = new Map();
      } else if (event.type === 'ships-launched') {
        event.ships.forEach((ship) => this.owners.set(ship.id, ship.owners));
      } else if (event.type === 'roles-revealed') {
        event.deployments.forEach((d) => this.record(d.playerId, d.role, this.owners.get(d.targetShipId) ?? [], self));
      } else if (event.type === 'smugglers-caught') {
        // Anonymous smugglers are only identified when caught.
        event.smugglers.forEach((id) => this.record(id, 'smuggler', this.owners.get(event.shipId) ?? [], self));
      }
    }
  }

  private record(actor: PlayerId, role: string, targetOwners: readonly PlayerId[], self: PlayerId): void {
    const bump = (map: Map<PlayerId, number>, amount = 1) => map.set(actor, (map.get(actor) ?? 0) + amount);
    if (role === 'pirate') {
      bump(this.pirates);
      if (targetOwners.includes(self) && actor !== self) {
        bump(this.hostility, targetOwners.includes(actor) ? 2 : 1);
      }
    } else if (role === 'guard') {
      bump(targetOwners.includes(actor) ? this.ownGuards : this.otherGuards);
    } else if (role === 'smuggler') {
      bump(this.smuggles);
      if (targetOwners.includes(self) && actor !== self) {
        bump(this.hostility);
      }
    }
  }

  private rate(map: Map<PlayerId, number>, player: PlayerId, prior: number): number {
    const priorWeight = 2;
    return ((map.get(player) ?? 0) + prior * priorWeight) / (this.roundsSeen + priorWeight);
  }

  pirateRate(player: PlayerId, prior: number): number {
    return this.rate(this.pirates, player, prior);
  }

  guardOwnShipRate(player: PlayerId, prior: number): number {
    return this.rate(this.ownGuards, player, prior);
  }

  guardOtherShipRate(player: PlayerId, prior: number): number {
    return this.rate(this.otherGuards, player, prior);
  }

  smuggleRate(player: PlayerId, prior: number): number {
    return this.rate(this.smuggles, player, prior);
  }

  /** 1 for a stranger, lower for players who acted against this bot's ships. */
  trust(player: PlayerId, grudge: number): number {
    return 1 / (1 + grudge * (this.hostility.get(player) ?? 0));
  }
}
