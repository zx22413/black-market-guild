// Dumps one ship design's parts and the palette (src/ui-v07/scene/ships/designs.ts) as JSON, for the Blender build scripts in this folder
// to take the masts, spars, ropes and lantern positions from, so a Blender-built ship keeps the rig its sails hang on.
// Usage: npx tsx scripts/blender/dump-ship.ts freighter > out.json
import { SWATCHES } from '../../src/ui/scene/buildings/materials';
import { SHIP_DESIGNS } from '../../src/ui-v07/scene/ships/designs';
import type { ShipTypeId } from '../../src/v07/game';

const proc = (globalThis as { process?: { argv?: string[]; stdout?: { write(s: string): void } } }).process;
const type = (proc?.argv?.[2] ?? 'freighter') as ShipTypeId;
const design = SHIP_DESIGNS[type];
if (!design) throw new Error(`unknown ship type: ${type}`);
proc?.stdout?.write(JSON.stringify({ type, parts: design.parts, pennant: design.pennant, lantern: design.lantern ?? null, swatches: SWATCHES }, null, 1));
