// The sound of each settlement flight as it lands, by what moves it: money for a sale, a fee or a
// bet, the smuggler's skim and the whistle when he is caught, loot, seized arms, insured and
// salvaged cargo, spoiled spice. Pure, so the mapping is tested without audio.

import type { Flight } from '../table3d/settlementModel';
import type { SfxId } from './soundPlan';

const FLIGHT_SOUND: Readonly<Record<Flight['kind'], SfxId | null>> = {
  sale: 'settle-sale',
  'escort-fee': 'settle-coins',
  'broker-bet': 'settle-coins',
  'broker-lift': 'settle-coins',
  'broker-control': 'settle-coins',
  'exchange-commission': 'settle-tick',
  smuggling: 'settle-smuggle',
  'smuggling-confiscated': 'settle-caught',
  'smuggling-fine': 'settle-fine',
  'smuggling-seized': 'settle-loot',
  'pirate-loot': 'settle-loot',
  insurance: 'settle-insurance',
  'arms-confiscated': 'settle-arms',
  salvage: 'settle-salvage',
  spoil: 'settle-spoil',
  // Paid before the settlement, never a flight.
  build: null,
  'ship-cost': null,
  'role-fee': null,
};

export function flightSound(flight: Flight): SfxId | null {
  return FLIGHT_SOUND[flight.kind];
}
