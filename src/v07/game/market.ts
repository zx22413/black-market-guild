import { chain, changeCash, holds, payAll, playerOf, updatePlayer, type StepFn } from './cash';
import { addGoods, mapGoods, nextPriceStep, only, priceAt, subtractGoods, units } from './goods';
import { traitOf } from './islands';
import { crateContext, effectiveDeployments, termsOf, voyageModifier } from './resolution';
import { GOODS, type GoodId, type Goods, type MatchEvent, type MatchState, type PlayerId, type RoleId, type Ship, type Step, type V08Effect } from './types';
import { activeTide, arrivalLoot, crashShieldActs, darkNight, eventPriceStep, inspectionAllowance, publicEvents, rushValue } from './v08-events';
import { crateTerms, facilityOf, hasVariant, protectedGoods, salvageCount, skillLevel, skillsOn, takeHighest } from './v08';

interface Prices {
  readonly before: Goods;
  readonly after: Goods;
  /** v08.tradehouse.immuneCrashTide: the new steps without 崩盤潮's multiplier (only while the shield acts). */
  readonly untided?: Goods;
}

/**
 * §5 step 7, §7.3: the new price is set by arrivals against demand and applies to this round's
 * sales. Then, in order: arrivals (customs confiscation, smuggling, pirate loot, sales) → sinkings
 * (loot, seized goods) → exchange commission → insurance → salvage → spice spoils.
 */
export function settleMarket(state: MatchState): Step {
  const { rules } = state;
  const { ships } = state.roundState;
  const { demand } = state.roundState;
  const arrivedShips = ships.filter((s) => s.outcome === 'arrived');
  const sunkShips = ships.filter((s) => s.outcome === 'sank');
  // V0.8 prototype: lost crates never arrive; crates a freighter salvages do; private crates only with hidden.privateArrives.
  const claims = salvageClaims(state, arrivedShips, sunkShips);
  const landed = arrivedShips.reduce((sum, s) => addGoods(sum, arrivedCrates(s)), mapGoods(() => 0));
  const privateLanded =
    rules.v08.hidden.privateArrives === 1
      ? arrivedShips.reduce((sum, s) => (s.privateCargo === undefined ? sum : addGoods(sum, s.privateCargo)), landed)
      : landed;
  const arrived = claims.reduce((sum, c) => addGoods(sum, c.goods), privateLanded);
  // V0.8 prototype (v08.events): 貨滿為患 doubles drops, 黑市大開 stops them; off, eventPriceStep is nextPriceStep.
  const pe = publicEvents(state);
  const event = state.roundState.voyageEvent;
  const next = (g: GoodId) => (pe === undefined ? nextPriceStep(rules, g, state.prices[g], arrived[g], demand[g]) : eventPriceStep(rules, pe, event, g, state.prices[g], arrived[g], demand[g]));
  const after = mapGoods(next);
  // v08.tradehouse.immuneCrashTide: the steps the drops would reach without the crash tide (other multipliers kept).
  const untided = pe !== undefined && crashShieldActs(rules, pe) ? mapGoods((g) => eventPriceStep(rules, pe, event, g, state.prices[g], arrived[g], demand[g], true)) : undefined;
  const prices: Prices = { before: state.prices, after, ...(untided === undefined ? {} : { untided }) };
  const settled: MatchEvent = { type: 'market-settled', round: state.round, demand, arrived, priceBefore: prices.before, priceAfter: prices.after };
  const protect = state.roundState.protect;
  const named: MatchEvent[] = protect === undefined ? [] : [{ type: 'trade-protected', round: state.round, protect }];
  const inspected = inspectArms(state, arrivedShips, arrived.arms, prices);
  const result = chain({ ...state, prices: prices.after }, [
    (s) => ({ state: s, events: inspected.events }),
    ...inspected.ships.map((ship) => settleArrival(ship, prices)),
    ...claims.map((claim) => paySalvage(claim, prices)),
    ...sunkShips.map((ship) => settleSinking(ship, prices)),
    payCommission,
    payInsurance,
    salvage(sunkShips, prices.after),
    spoilSpice,
    darkTideLoss,
  ]);
  return { state: result.state, events: [settled, ...named, ...result.events] };
}

/**
 * V0.8 prototype, 軍火超量查緝 (v08.inspection): arriving arms beyond demand + allowance are seized by the bank, one crate
 * at a time from the uncovered ship with the most arms left (ties: richer owner first, then ship order). Regular crates
 * go before private ones; seized crates are added to the ship's lost crates, so the owner, customs and pirates never see them.
 */
function inspectArms(state: MatchState, ships: readonly Ship[], arrivedArms: number, prices: Prices): { ships: readonly Ship[]; events: MatchEvent[] } {
  const { inspection } = state.rules.v08;
  // V0.8 prototype (嚴查, v08.events): a phase II black-market rush lowers the allowance.
  const excess = arrivedArms - state.roundState.demand.arms - inspectionAllowance(state.rules, publicEvents(state), state.roundState.voyageEvent);
  if (inspection.enabled !== 1 || excess <= 0) return { ships, events: [] };
  // v08.hidden.privateSafeFromInspectionL2: a level-2 hidden ship's private crates are out of reach.
  const privateSafe = (ship: Ship): boolean =>
    state.rules.v08.hidden.privateSafeFromInspectionL2 === 1 && ship.type === 'hidden' && skillLevel(state.rules, playerOf(state, ship.owner), 'hidden') >= 2;
  const armsOf = (ship: Ship): number => arrivedCrates(ship).arms + (privateSafe(ship) ? 0 : (ship.privateCargo?.arms ?? 0));
  const left = new Map(ships.map((ship) => [ship.id, armsOf(ship)]));
  const open = ships.filter((ship) => !covered(state, ship, 'arms'));
  const taken = new Map<string, number>();
  for (let remaining = excess; remaining > 0; remaining -= 1) {
    const pick = open
      .filter((ship) => (left.get(ship.id) ?? 0) > 0)
      .sort((a, b) => (left.get(b.id) ?? 0) - (left.get(a.id) ?? 0) || playerOf(state, b.owner).cash - playerOf(state, a.owner).cash)[0];
    if (pick === undefined) break;
    left.set(pick.id, (left.get(pick.id) ?? 0) - 1);
    taken.set(pick.id, (taken.get(pick.id) ?? 0) + 1);
  }
  const price = priceAt(state.rules, 'arms', prices.after.arms);
  const events = ships.flatMap((ship) => {
    const n = taken.get(ship.id) ?? 0;
    return n === 0 ? [] : [v08Effect(state, ship.owner, ship.id, 'inspected', n, n * price)];
  });
  const seized = ships.map((ship): Ship => {
    const n = taken.get(ship.id) ?? 0;
    if (n === 0) return ship;
    const regular = Math.min(n, arrivedCrates(ship).arms);
    const lost = addGoods(ship.lost ?? mapGoods(() => 0), { ...mapGoods(() => 0), arms: regular });
    const privateCargo = ship.privateCargo === undefined ? undefined : { ...ship.privateCargo, arms: ship.privateCargo.arms - (n - regular) };
    return { ...ship, lost, ...(privateCargo === undefined ? {} : { privateCargo }) };
  });
  return { ships: seized, events };
}

/** V0.8 prototype: the crates that reached the market (all of them unless the crate rules lost some). */
function arrivedCrates(ship: Ship): Goods {
  return ship.lost === undefined ? ship.cargo : subtractGoods(ship.cargo, ship.lost);
}

const v08Effect = (state: MatchState, playerId: PlayerId, shipId: string | null, effect: V08Effect, crates: number, value: number): MatchEvent => ({
  type: 'v08-effect',
  round: state.round,
  playerId,
  shipId,
  effect,
  crates,
  value,
});

interface SalvageClaim {
  readonly playerId: PlayerId;
  readonly shipId: string;
  readonly goods: Goods;
}

/**
 * V0.8 prototype, freighter 「拾荒」: each arriving freighter whose owner opened the skill takes, from every other player's
 * ship that sank this round, its highest-price crates (price before the market change), paid by the bank.
 */
function salvageClaims(state: MatchState, arrivedShips: readonly Ship[], sunkShips: readonly Ship[]): SalvageClaim[] {
  if (!skillsOn(state.rules)) return [];
  if (state.rules.v08.freighter.salvageShared === 1) return sharedSalvage(state, arrivedShips, sunkShips);
  return arrivedShips
    .filter((f) => f.type === 'freighter')
    .flatMap((f) => {
      const count = salvageCount(state.rules, skillLevel(state.rules, playerOf(state, f.owner), 'freighter'));
      return count === 0
        ? []
        : sunkShips
            .filter((s) => s.owner !== f.owner)
            .map((s) => ({ playerId: f.owner, shipId: f.id, goods: takeHighest(state.rules, s.cargo, count, state.prices) }))
            .filter((c) => units(c.goods) > 0);
    });
}

/**
 * V0.8 prototype (v08.freighter.salvageShared): each sunk ship's crates are one pool. The arriving freighters take from it
 * in turn, one crate at a time (highest price first, freighters in ship order), each up to its skill's count, until the
 * pool runs out.
 */
function sharedSalvage(state: MatchState, arrivedShips: readonly Ship[], sunkShips: readonly Ship[]): SalvageClaim[] {
  const salvagers = arrivedShips
    .filter((f) => f.type === 'freighter')
    .map((f) => ({ ship: f, count: salvageCount(state.rules, skillLevel(state.rules, playerOf(state, f.owner), 'freighter')) }))
    .filter((f) => f.count > 0);
  return sunkShips.flatMap((sunk) => {
    const takers = salvagers.filter((f) => f.ship.owner !== sunk.owner);
    const taken = takers.map(() => mapGoods(() => 0));
    let pool = sunk.cargo;
    const rounds = Math.max(0, ...takers.map((f) => f.count));
    for (let turn = 0; turn < rounds; turn += 1) {
      takers.forEach((f, i) => {
        if (turn >= f.count || units(pool) === 0) return;
        const crate = takeHighest(state.rules, pool, 1, state.prices);
        pool = subtractGoods(pool, crate);
        taken[i] = addGoods(taken[i]!, crate);
      });
    }
    return takers.map((f, i) => ({ playerId: f.ship.owner, shipId: f.ship.id, goods: taken[i]! })).filter((c) => units(c.goods) > 0);
  });
}

/** V0.8 prototype: salvaged crates sell at the new price, in full, untouched by roles. */
function paySalvage(claim: SalvageClaim, prices: Prices): StepFn {
  return (state) => {
    const value = GOODS.reduce((sum, g) => sum + claim.goods[g] * salePrice(state, claim.playerId, g, prices), 0);
    const paid = chain(state, payAll([{ playerId: claim.playerId, amount: value }], 'salvage-sale', claim.shipId));
    return { state: paid.state, events: [v08Effect(state, claim.playerId, claim.shipId, 'salvage', units(claim.goods), value), ...paid.events] };
  };
}

/**
 * V0.8 prototype, tradehouse: a protected good that drops sells the owner's own crates at the pre-change price; with
 * v08.tradehouse.immuneCrashTide (and `shield`) every other good sells at the step the drop reaches without 崩盤潮.
 */
function ownSalePrice(state: MatchState, playerId: PlayerId, good: GoodId, prices: Prices, shield = true): number {
  const owner = playerOf(state, playerId);
  const facility = facilityOf(state.rules, owner);
  const kept = protectedGoods(state.rules, owner.island, facility, state.roundState.protect?.[playerId]);
  if (kept.includes(good) && prices.after[good] < prices.before[good]) {
    return salePrice(state, playerId, good, { before: prices.before, after: prices.before });
  }
  const untided = prices.untided?.[good];
  if (shield && facility === 'tradehouse' && untided !== undefined && untided > prices.after[good]) {
    return salePrice(state, playerId, good, { before: prices.before, after: { ...prices.after, [good]: untided } });
  }
  return salePrice(state, playerId, good, prices);
}

/** V0.8 prototype, smuggler port + armory: customs takes only half of the named good's value from this owner's ships. */
function customsHalved(state: MatchState, ship: Ship): boolean {
  const owner = playerOf(state, ship.owner);
  const facility = facilityOf(state.rules, owner);
  return hasVariant(state.rules, owner.island, facility, 'smuggler-port', 'armory') || (state.rules.v08.armory.halveCustoms === 1 && facility === 'armory');
}

function deployed(state: MatchState, ship: Ship, role: RoleId): PlayerId[] {
  return effectiveDeployments(state).filter((d) => d.role === role && d.targetShipId === ship.id).map((d) => d.playerId);
}

/** §9.5: smuggled goods value, raised by the black-market rush (§12). */
function goodsValue(state: MatchState): number {
  // V0.8 prototype (v08.events): only the phase I rush raises it.
  return rushValue(state.rules, publicEvents(state), state.roundState.voyageEvent);
}

/** §7.3, §11.2: sale price at the new step; the old spice isles got half (rounded down) of a rise, the ship-bay ones sell cells higher. */
export function salePrice(state: MatchState, playerId: PlayerId, good: GoodId, prices: Prices): number {
  const before = prices.before[good];
  const rise = prices.after[good] - before;
  const trait = traitOf(state.rules, playerOf(state, playerId).island);
  const halved = rise > 0 && trait.halfRise[good] === 1;
  // The track's top limits the market price; the island's own bonus cells go on top of it.
  return priceAt(state.rules, good, (halved ? before + Math.floor(rise / 2) : prices.after[good]) + trait.sellStepBonus[good]);
}

/** Smugglers taking goods from someone else's ship. */
function takers(state: MatchState, ship: Ship): PlayerId[] {
  return deployed(state, ship, 'smuggler').filter((id) => id !== ship.owner);
}

interface Seizure {
  readonly good: GoodId;
  readonly customs: readonly PlayerId[];
}

/** §9.5: the owner's own smuggler aboard covers the ship's goods from customs, except arms at the smuggler port. */
const covered = (state: MatchState, ship: Ship, good: GoodId): boolean =>
  ((deployed(state, ship, 'smuggler').includes(ship.owner) && !darkNight(publicEvents(state), state.roundState.voyageEvent)) || selfCovered(state, ship)) &&
  !(good === 'arms' && traitOf(state.rules, playerOf(state, ship.owner).island).armsUncoverable === 1);

/** V0.8 prototype (v08.hidden.selfCoverL1): an opened hidden-ship skill covers the ship without a smuggler. */
const selfCovered = (state: MatchState, ship: Ship): boolean =>
  state.rules.v08.hidden.selfCoverL1 === 1 && ship.type === 'hidden' && skillLevel(state.rules, playerOf(state, ship.owner), 'hidden') >= 1;

/** §9.4: each customs officer on this ship takes the good it names, if that good is aboard and not covered. */
function seizures(state: MatchState, ship: Ship): Seizure[] {
  // Experiment (rules.ships): customs cannot confiscate from a secret ship.
  const officers =
    state.rules.ships.enabled === 1 && state.rules.ships.types[ship.type].secret === 1
      ? []
      : effectiveDeployments(state).filter((d) => d.role === 'customs' && d.targetShipId === ship.id && d.playerId !== ship.owner);
  return GOODS.flatMap((good) => {
    if (covered(state, ship, good)) {
      return [];
    }
    const named = officers.filter((d) => d.namedGood === good).map((d) => d.playerId);
    return named.length > 0 && arrivedCrates(ship)[good] > 0 ? [{ good, customs: named }] : [];
  });
}

/** §9.4, §9.5: the owner's sale income is the cargo value left after customs, scaled by the final value; pirates then take a share of it. */
function settleArrival(ship: Ship, prices: Prices): StepFn {
  return (state) => {
    const found = seizures(state, ship);
    const sold = found.reduce<Goods>((left, s) => ({ ...left, [s.good]: 0 }), arrivedCrates(ship));
    const full = GOODS.reduce((sum, g) => sum + sold[g] * ownSalePrice(state, ship.owner, g, prices), 0);
    const final = voyageModifier(state, ship).final;
    const { percent } = termsOf(state, ship);
    // V0.8 prototype: private crates sell in full; the smuggler port's armory keeps half of what customs would take.
    const privateIncome = ship.privateCargo === undefined ? 0 : GOODS.reduce((sum, g) => sum + ship.privateCargo![g] * salePrice(state, ship.owner, g, prices), 0);
    const halved = customsHalved(state, ship);
    const kept = halved ? found.reduce((sum, s) => sum + keptHalf(seizedValue(state, ship, s.good, prices)), 0) : 0;
    const gross = Math.floor((full * percent) / 100) + privateIncome + kept;
    const customs = deployed(state, ship, 'customs');
    const pirates = deployed(state, ship, 'pirate').filter((id) => id !== ship.owner);
    // V0.8 prototype: 海盜潮 loots arrivals where pirates normally take nothing; the armory may halve the take (v08.armory.halveAllLoot).
    const loot = arrivalLoot(state.rules, activeTide(publicEvents(state)), state.rules.roles.pirate.lootPercentByFinal[final] ?? 0, ownerArmory(state, ship));
    const fullShare = pirates.length === 0 ? 0 : Math.min(gross, Math.floor((gross * loot.percent) / 100));
    const lootShare = pirates.length === 0 ? 0 : loot.halved ? Math.min(gross, Math.floor((gross * loot.percent) / 200)) : fullShare;
    const lootEffects = pirates.length === 0 || (loot.percent === 0 && !loot.shielded) ? [] : arrivalLootEffects(state, ship, loot, fullShare, lootShare, gross);
    const bonus = pirates.length > 0 && lootShare > 0 ? wantedBonus(state, ship) : 0;
    const lootEach = pirates.length === 0 ? 0 : Math.floor((lootShare + bonus) / pirates.length);
    const proceeds = gross - lootShare;
    const smugglers = takers(state, ship);
    return chain(state, [
      (s) => ({ state: s, events: [...arrivalEffects(s, ship, prices, { sold, percent, privateIncome, kept }), ...lootEffects] }),
      ...confiscateGoods(ship, found, prices, halved),
      ...(smugglers.length === 0
        ? payAll([{ playerId: ship.owner, amount: proceeds }], 'sale', ship.id)
        : customs.length > 0
          ? [...catchSmugglers(ship, smugglers, customs), ...payAll([{ playerId: ship.owner, amount: proceeds }], 'sale', ship.id)]
          : [smuggle(ship, smugglers, proceeds)]),
      ...payAll(pirates.map((playerId) => ({ playerId, amount: lootEach })), 'pirate-loot', ship.id),
    ]);
  };
}

/** V0.8 prototype: the owner of this ship holds the armory. */
const ownerArmory = (state: MatchState, ship: Ship): boolean => facilityOf(state.rules, playerOf(state, ship.owner)) === 'armory';

/**
 * V0.8 prototype, report only: 海盜潮's arrival loot (value = the pirates' share before the wanted bonus) and the armory's
 * halving of an arrival take (value = what the pirates did not get).
 */
function arrivalLootEffects(state: MatchState, ship: Ship, loot: { readonly fromTide: boolean; readonly halved: boolean; readonly shielded: boolean }, full: number, share: number, gross: number): MatchEvent[] {
  // v08.armory.immunePirateTide: what the tide's arrival loot would have taken (halved by the armory), kept by the shield.
  const kept = loot.shielded ? Math.min(gross, Math.floor((gross * state.rules.v08.events.tidePirateArrivalLoot) / (loot.halved ? 200 : 100))) : 0;
  return [
    ...(kept > 0 ? [v08Effect(state, ship.owner, ship.id, 'pirate-shield', 0, kept)] : []),
    ...(loot.fromTide && share > 0 ? [v08Effect(state, ship.owner, ship.id, 'pirate-tide', 0, share)] : []),
    ...(loot.halved && full > 0 ? [v08Effect(state, ship.owner, ship.id, 'armory', 0, full - share)] : []),
  ];
}

/** V0.8 prototype: what is left to the owner when customs takes only half (rounded down) of a good's value. */
const keptHalf = (value: number): number => value - Math.floor(value / 2);

/** V0.8 prototype: report events for what a skill, building or variant did on an arriving ship. */
function arrivalEffects(
  state: MatchState,
  ship: Ship,
  prices: Prices,
  sale: { readonly sold: Goods; readonly percent: number; readonly privateIncome: number; readonly kept: number },
): MatchEvent[] {
  const events: MatchEvent[] = [];
  if (sale.privateIncome > 0) {
    events.push(v08Effect(state, ship.owner, ship.id, 'private-sold', units(ship.privateCargo!), sale.privateIncome));
  }
  if (sale.kept > 0) {
    events.push(v08Effect(state, ship.owner, ship.id, 'customs-halved', 0, sale.kept));
  }
  const plain = GOODS.reduce((sum, g) => sum + sale.sold[g] * salePrice(state, ship.owner, g, prices), 0);
  const own = GOODS.reduce((sum, g) => sum + sale.sold[g] * ownSalePrice(state, ship.owner, g, prices), 0);
  // v08.tradehouse.immuneCrashTide: the named good's keep and the crash-tide shield are reported apart.
  const named = prices.untided === undefined ? own : GOODS.reduce((sum, g) => sum + sale.sold[g] * ownSalePrice(state, ship.owner, g, prices, false), 0);
  if (named > plain) {
    events.push(v08Effect(state, ship.owner, ship.id, 'tradehouse', 0, Math.floor((named * sale.percent) / 100) - Math.floor((plain * sale.percent) / 100)));
  }
  if (own > named) {
    const crates = GOODS.reduce((sum, g) => sum + (ownSalePrice(state, ship.owner, g, prices) > ownSalePrice(state, ship.owner, g, prices, false) ? sale.sold[g] : 0), 0);
    events.push(v08Effect(state, ship.owner, ship.id, 'crash-shield', crates, Math.floor((own * sale.percent) / 100) - Math.floor((named * sale.percent) / 100)));
  }
  if (ship.raised === true) {
    const unraised = crateTerms(state.rules, ship.type, voyageModifier(state, ship).final, { ...crateContext(state, ship), raised: false });
    const plainIncome = unraised.sinks ? 0 : Math.floor((own * unraised.percent) / 100);
    events.push(v08Effect(state, ship.owner, ship.id, 'raise-won', units(ship.cargo), Math.floor((own * sale.percent) / 100) - plainIncome));
  }
  return events;
}

/** §9.6: pirates hitting a wanted owner's ship get the bank's bonus on top. */
const wantedBonus = (state: MatchState, ship: Ship): number => (state.roundState.wanted.includes(ship.owner) ? state.rules.wanted.lootBonus : 0);

/**
 * The value customs takes of `good` on this ship: all of it, scaled by the same arrival ratio as the owner's own
 * income (rules.sailing.arrivalIncomePercent), so customs and the owner split the ship's value between them.
 */
function seizedValue(state: MatchState, ship: Ship, good: GoodId, prices: Prices): number {
  return Math.floor((arrivedCrates(ship)[good] * priceAt(state.rules, good, prices.after[good]) * termsOf(state, ship).percent) / 100);
}

function confiscateGoods(ship: Ship, found: readonly Seizure[], prices: Prices, halved = false): StepFn[] {
  return found.map(({ good, customs }): StepFn => (state) => {
    const value = seizedValue(state, ship, good, prices);
    const each = Math.floor((halved ? Math.floor(value / 2) : value) / customs.length);
    const paid = chain(state, payAll(customs.map((playerId) => ({ playerId, amount: each })), 'goods-confiscated', ship.id));
    return { state: paid.state, events: [{ type: 'goods-confiscated', round: state.round, shipId: ship.id, good, units: arrivedCrates(ship)[good], customs }, ...paid.events] };
  });
}

/** §9.5 caught: each smuggler is fined (capped at their cash); customs splits the goods value. */
function catchSmugglers(ship: Ship, smugglers: readonly PlayerId[], customs: readonly PlayerId[]): StepFn[] {
  const announce: StepFn = (state) => ({
    state,
    events: [{ type: 'smuggling-settled', round: state.round, shipId: ship.id, smugglers, result: 'caught' }],
  });
  const fines = smugglers.map((playerId): StepFn => (state) => {
    const amount = Math.min(playerOf(state, playerId).cash, state.rules.roles.smuggler.fine);
    return amount > 0 ? changeCash(state, playerId, -amount, 'smuggling-fine', ship.id) : { state, events: [] };
  });
  const reward: StepFn = (state) => {
    const each = Math.floor(goodsValue(state) / customs.length) * smugglers.length;
    return chain(state, payAll(customs.map((playerId) => ({ playerId, amount: each })), 'smuggling-confiscated', ship.id));
  };
  return [announce, ...fines, reward];
}

/** §9.5 taken: the smugglers take up to all of the owner's sales and split it, rounded down. */
function smuggle(ship: Ship, smugglers: readonly PlayerId[], proceeds: number): StepFn {
  return (state) => {
    const taken = Math.min(goodsValue(state) * smugglers.length, proceeds);
    const each = Math.floor(taken / smugglers.length);
    return chain(state, [
      (s) => ({ state: s, events: [{ type: 'smuggling-settled', round: s.round, shipId: ship.id, smugglers, result: 'taken' }] }),
      ...payAll([{ playerId: ship.owner, amount: proceeds - taken }], 'sale', ship.id),
      ...payAll(smugglers.map((playerId) => ({ playerId, amount: each })), 'smuggling', ship.id),
    ]);
  };
}

/** §9.4, §9.5, §9.6: pirates split a share of the lost cargo's value (set by the ship's final value; wanted bonus included) and any smuggled goods aboard. */
function settleSinking(ship: Ship, prices: Prices): StepFn {
  return (state) => {
    const pirates = deployed(state, ship, 'pirate');
    const smugglers = takers(state, ship);
    const raised: MatchEvent[] = ship.raised === true ? [raiseLost(state, ship, prices)] : [];
    const lost: MatchEvent[] = [
      ...raised,
      ...(smugglers.length > 0 ? [{ type: 'smuggling-settled' as const, round: state.round, shipId: ship.id, smugglers, result: pirates.length > 0 ? ('seized' as const) : ('lost' as const) }] : []),
    ];
    if (pirates.length === 0) {
      return { state, events: lost };
    }
    const final = voyageModifier(state, ship).final;
    // V0.8 prototype: a hidden ship's private crates sink with it and count toward the loot.
    const aboard = ship.privateCargo === undefined ? ship.cargo : addGoods(ship.cargo, ship.privateCargo);
    const cargoValue = GOODS.reduce((sum, g) => sum + aboard[g] * priceAt(state.rules, g, prices.after[g]), 0);
    // Experiment (rules.ships): any sunk ship pays pirates what a final value of 1 does.
    const sunkAs = state.rules.ships.enabled === 1 ? 1 : final;
    const normal = state.rules.roles.pirate.lootPercentByFinal[sunkAs] ?? 0;
    // V0.8 prototype, armory: the owner's sunk ship gives pirates a smaller share.
    const armory = ownerArmory(state, ship);
    // v08.armory.halveAllLoot: the armory halves the share instead of capping it at lootPercent.
    const halves = armory && state.rules.v08.armory.halveAllLoot === 1;
    const share = halves ? Math.floor((cargoValue * normal) / 200) : Math.floor((cargoValue * (armory ? Math.min(normal, state.rules.v08.armory.lootPercent) : normal)) / 100);
    const kept = Math.floor((cargoValue * normal) / 100) - share;
    if (armory) lost.push(v08Effect(state, ship.owner, ship.id, 'armory', 0, kept));
    // v08.armory.refundSunkLoot: what the halving kept from the pirates goes to the owner.
    const refund = halves && state.rules.v08.armory.refundSunkLoot === 1 ? kept : 0;
    const loot = Math.floor((share + wantedBonus(state, ship)) / pirates.length);
    const seized = Math.floor(goodsValue(state) / pirates.length) * smugglers.length;
    const paid = chain(state, [
      ...payAll(pirates.map((playerId) => ({ playerId, amount: loot })), 'pirate-loot', ship.id),
      ...payAll(pirates.map((playerId) => ({ playerId, amount: seized })), 'smuggling-seized', ship.id),
      ...payAll([{ playerId: ship.owner, amount: refund }], 'armory-refund', ship.id),
    ]);
    return { state: paid.state, events: [...lost, ...paid.events] };
  };
}

/** V0.8 prototype: a raised gambler sank; its value is minus what the unraised gambler would have paid. */
function raiseLost(state: MatchState, ship: Ship, prices: Prices): MatchEvent {
  const unraised = crateTerms(state.rules, ship.type, voyageModifier(state, ship).final, { ...crateContext(state, ship), raised: false });
  const value = GOODS.reduce((sum, g) => sum + ship.cargo[g] * ownSalePrice(state, ship.owner, g, prices), 0);
  return v08Effect(state, ship.owner, ship.id, 'raise-lost', units(ship.cargo), unraised.sinks ? 0 : -Math.floor((value * unraised.percent) / 100));
}

/** §10.2: the exchange earns a commission per unit of other players' goods that arrived, capped. */
const payCommission: StepFn = (state) => {
  const { commissionPerUnit, maxUnitsPerRound } = state.rules.buildings.exchange;
  const arrived = state.roundState.ships.filter((s) => s.outcome === 'arrived');
  return chain(
    state,
    state.players
      .filter((p) => p.buildings.includes('exchange'))
      .flatMap((p) => {
        const others = arrived.filter((s) => s.owner !== p.id).reduce((sum, s) => sum + units(s.cargo), 0);
        return payAll([{ playerId: p.id, amount: Math.min(others, maxUnitsPerRound) * commissionPerUnit }], 'exchange-commission', null);
      }),
  );
};

/** §10.2: an insured owner is paid by the bank for each of their ships that sank. */
const payInsurance: StepFn = (state) =>
  chain(
    state,
    state.roundState.ships
      .filter((s) => s.outcome === 'sank' && holds(state, s.owner, 'insurance'))
      .flatMap((ship) => payAll([{ playerId: ship.owner, amount: state.rules.buildings.insurance.payout }], 'insurance', ship.id)),
  );

/**
 * §10.2: from a sunk ship a holder takes up to `unitsPerShip` units, always from the good with the
 * most units left aboard (ties in good order). Holders take turns in seat order; each salvages up
 * to `maxPerRound` other players' ships, the ones whose units are worth the most at this round's
 * new price first (ties by ship order). Any number of holders can salvage the same ship.
 */
function salvage(sunk: readonly Ship[], after: Goods): StepFn {
  return (state) => {
    const { unitsPerShip, maxPerRound } = state.rules.buildings.salvage;
    const offers = sunk.map((ship, order) => {
      const left = { ...ship.cargo };
      const picked: GoodId[] = [];
      while (picked.length < unitsPerShip) {
        const good = GOODS.reduce<GoodId>((best, g) => (left[g] > left[best] ? g : best), 'wood');
        if (left[good] === 0) break;
        left[good] -= 1;
        picked.push(good);
      }
      return { ship, picked, order, value: picked.reduce((sum, g) => sum + priceAt(state.rules, g, after[g]), 0) };
    });
    const claims = state.players
      .filter((p) => p.buildings.includes('salvage'))
      .flatMap((holder) =>
        offers
          .filter((o) => o.ship.owner !== holder.id && o.picked.length > 0)
          .sort((x, y) => y.value - x.value || x.order - y.order)
          .slice(0, maxPerRound)
          .flatMap((o) => o.picked.map((good) => ({ playerId: holder.id, ship: o.ship, good }))),
      );
    return claims.reduce<Step>(
      (acc, { playerId, ship, good }) => ({
        state: updatePlayer(acc.state, playerId, (p) => ({ ...p, stock: addGoods(p.stock, only(good, 1)) })),
        events: [...acc.events, { type: 'goods-salvaged', round: acc.state.round, playerId, good, shipId: ship.id }],
      }),
      { state, events: [] },
    );
  };
}

/** §6.3: spice left in a warehouse spoils at the end of the round, except on the spice isles. */
const spoilSpice: StepFn = (state) => {
  const spoiled: Record<PlayerId, number> = {};
  const players = state.players.map((p) => {
    if (p.stock.spice === 0 || traitOf(state.rules, p.island).keepsSpice === 1) {
      return p;
    }
    spoiled[p.id] = p.stock.spice;
    return { ...p, stock: { ...p.stock, spice: 0 } };
  });
  return {
    state: { ...state, players },
    events: Object.keys(spoiled).length > 0 ? [{ type: 'spice-spoiled', round: state.round, spoiled }] : [],
  };
};

/**
 * V0.8 prototype (「暗潮將至」, v08.events): at the end of that round (after the spice spoils) every player loses
 * `warehouseLossPercent` percent, rounded down, of each good still in the warehouse.
 */
const darkTideLoss: StepFn = (state) => {
  if (publicEvents(state)?.darkTide !== true) return { state, events: [] };
  const percent = state.rules.v08.events.warehouseLossPercent;
  const lost: Record<PlayerId, Goods> = {};
  const players = state.players.map((p) => {
    const gone = mapGoods((g) => Math.floor((p.stock[g] * percent) / 100));
    if (units(gone) === 0) return p;
    lost[p.id] = gone;
    return { ...p, stock: subtractGoods(p.stock, gone) };
  });
  return { state: { ...state, players }, events: [{ type: 'dark-tide-loss', round: state.round, lost }] };
};
