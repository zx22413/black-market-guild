// The sound of each settlement flight as it lands, by what moves it: money for a sale, a fee or a
// bet, the smuggler's skim and the whistle when he is caught, loot, seized arms, insured and
// salvaged cargo, spoiled spice. Pure, so the mapping is tested without audio.

import type { Flight } from '../table3d/settlementModel';
import type { SfxId } from './soundPlan';

const FLIGHT_SOUND: Readonly<Record<Flight['kind'], SfxId | null>> = {
  sale: 'settle-sale',
  'diplomat-take': 'settle-coins',
  'diplomat-refund': 'settle-coins',
  'exchange-commission': 'settle-tick',
  smuggling: 'settle-smuggle',
  'smuggling-confiscated': 'settle-caught',
  'smuggling-fine': 'settle-fine',
  'smuggling-seized': 'settle-loot',
  'pirate-loot': 'settle-loot',
  insurance: 'settle-insurance',
  'goods-confiscated': 'settle-arms',
  salvage: 'settle-salvage',
  spoil: 'settle-spoil',
  // Paid before the settlement, never a flight.
  build: null,
  'ship-cost': null,
  'role-fee': null,
  // V0.8 simulation prototype only (never in the live rules).
  'salvage-sale': 'settle-salvage',
  'pirate-toll': null,
  'armory-refund': 'settle-armory',
  'armory-fine': 'settle-armory',
  // The trade house takes its crate: set down on the counter, paid out, a small till bell.
  'tradehouse-buyout': 'settle-tradehouse',
  // A building's own show (scene/FacilityWorks.tsx) sounds for itself.
  facility: null,
  // 軍火查緝: the arms over demand shut away in an iron box and locked.
  inspection: 'settle-inspection',
  // The cover held: the smuggler's quiet coin.
  'inspection-cover': 'settle-smuggle',
};

export function flightSound(flight: Flight): SfxId | null {
  return FLIGHT_SOUND[flight.kind];
}
