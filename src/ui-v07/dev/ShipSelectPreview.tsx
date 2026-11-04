import { useMemo, useState } from 'react';
import { GOODS, type Goods, type PlayerId } from '../../v07/game';
import { seatAngles } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import type { BeatSeat } from '../scene/beatStage';
import { CrateModel, CRATE_SIZE } from '../scene/CrateModel';
import { Warehouse } from '../scene/InvestIsland';
import { ShipSideCamera, warehouseCentre, type ShipShot } from '../scene/ShipSideCamera';
import { TableCanvas, type TableShip } from '../scene/TableCanvas';

// Dev-only: the ship-select and cargo-loading cameras at /v07.html?dev=ship-select (&step=cargo to start on the second one).
// Picking the ship is a close-up of the ship; loading cargo pulls back to show the warehouse and the ship together, and the
// camera glides between the two. The real docked ship (one model for every type for now) and the real warehouse, with a
// sketch of the cards over the bottom. No game state.

type Step = ShipShot;
const CRATE_SCALE = 0.6;
const DECK_Y = 1.25;

const SHIPS = [
  { id: 'standard', name: '白板船', sink: 17, ability: '無特殊能力', fee: '0', cooldown: '無冷卻', curve: [0, 30, 45, 60, 75, 100] },
  { id: 'gambler', name: '賭徒船', sink: 67, ability: '無特殊能力', fee: '150 G', cooldown: '冷卻 1', curve: [0, 0, 0, 0, 125, 250] },
  { id: 'freighter', name: '貨櫃船', sink: 0, ability: '載量 +2，下回合才抵達', fee: '0', cooldown: '無冷卻', curve: [25, 35, 45, 55, 65, 75] },
  { id: 'hidden', name: '密艙船', sink: 17, ability: '海關指名無效', fee: '40 G', cooldown: '無冷卻', curve: [0, 30, 45, 60, 75, 100] },
  { id: 'breaker', name: '破浪船', sink: 17, ability: '最終值不封頂', fee: '0', cooldown: '無冷卻', curve: [0, 20, 35, 50, 70, 100] },
] as const;

/** The crates on deck at a smaller scale, so they read as cargo on a ship and not as the ship itself. */
function DeckCargo({ angle, load }: { readonly angle: number; readonly load: Goods }) {
  const dock = shipPose(angle, 'docked');
  const crates = GOODS.flatMap((g) => Array.from({ length: load[g] }, () => g));
  const gap = CRATE_SIZE * CRATE_SCALE * 1.08;
  return (
    <>
      {crates.map((good, i) => {
        const offset = (i - (crates.length - 1) / 2) * gap;
        const at: [number, number, number] = [dock.position.x + Math.sin(dock.heading) * offset, DECK_Y + (CRATE_SIZE * CRATE_SCALE) / 2, dock.position.z + Math.cos(dock.heading) * offset];
        return (
          <group key={i} position={at} scale={CRATE_SCALE}>
            <CrateModel good={good} />
          </group>
        );
      })}
    </>
  );
}

const panel = { background: '#f4ead2', color: '#3a2a18', borderRadius: 8 } as const;
const button = { background: '#3a2a18', color: '#f4ead2', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer' } as const;

export function ShipSelectPreview() {
  const initial: Step = new URLSearchParams(window.location.search).get('step') === 'cargo' ? 'cargo' : 'ship';
  const [step, setStep] = useState<Step>(initial);
  const [selected, setSelected] = useState<string>('standard');
  const angles = useMemo(() => seatAngles(4), []);
  const seats: BeatSeat[] = angles.map((_, i) => ({ id: `p${i}` as PlayerId, name: '', color: PLAYER_COLORS[i]!, buildings: [], island: i === 0 ? 'spice-isles' : null, isViewer: i === 0 }));
  const ships: TableShip[] = [{ id: 's0' as never, owner: seats[0]!.id, state: 'docked' }];
  const ship = SHIPS.find((s) => s.id === selected) ?? SHIPS[0];
  const load: Goods = { wood: 1, iron: 0, spice: 1, arms: 1 };
  const house = warehouseCentre(angles[0]!);
  return (
    <div style={{ position: 'fixed', inset: 0, fontFamily: 'system-ui, sans-serif' }}>
      <TableCanvas seats={seats} weather={null} ships={ships} camera={<ShipSideCamera angle={angles[0]!} shot={step} />} cameraPoints={[]} safe={{ top: 0, bottom: 0, left: 0, right: 0 }} pins={[]} onReady={() => undefined}>
        {/* Scaled about its own centre to the deck crates' size, so a crate looks the same on land and on the ship. */}
        <group position={[house.x, 0, house.z]} scale={CRATE_SCALE}>
          <group position={[-house.x, 0, -house.z]}>
            <Warehouse angle={angles[0]!} stock={{ wood: 3, iron: 2, spice: 3, arms: 2 }} forBuild={{ wood: 0, iron: 0, spice: 0, arms: 0 }} onShip={load} canLoad={() => false} onLoad={() => undefined} />
          </group>
        </group>
        {step === 'cargo' && <DeckCargo angle={angles[0]!} load={load} />}
      </TableCanvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {step === 'ship' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, maxWidth: 520, margin: '0 auto', width: '100%' }}>
              {ship?.curve.map((p, i) => (
                <div key={i} style={{ background: p === 0 ? '#f7d9d4' : p > 100 ? '#d9ecd0' : '#f4ead2', borderRadius: 6, textAlign: 'center', padding: '4px 0', fontSize: 13, color: '#3a2a18' }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>擲 {i + 1}</div>
                  <b>{p === 0 ? '沉' : `${p}%`}</b>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, maxWidth: 760, margin: '0 auto', width: '100%' }}>
              {SHIPS.map((s) => (
                <button key={s.id} type="button" onClick={() => setSelected(s.id)} style={{ ...panel, textAlign: 'left', border: selected === s.id ? '2px solid #d99a2b' : '2px solid #6b4a2a', padding: '8px 10px', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{s.sink}%</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>沉船機率</div>
                  <div style={{ fontSize: 12, minHeight: 30, marginTop: 4 }}>{s.ability}</div>
                  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.fee}</span>
                    <span>{s.cooldown}</span>
                  </div>
                </button>
              ))}
            </div>
            <button type="button" style={{ ...button, alignSelf: 'flex-end' }} onClick={() => setStep('cargo')}>
              選這艘，去裝貨
            </button>
          </>
        ) : (
          <div style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', maxWidth: 760, margin: '0 auto', width: '100%' }}>
            <span>
              <b>{ship?.name}</b>　裝貨 3 / 3　船費 {ship?.fee}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={{ ...button, background: 'transparent', color: '#3a2a18', border: '1px solid #6b4a2a' }} onClick={() => setStep('ship')}>
                換船
              </button>
              <button type="button" style={button}>
                鎖定並出航
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
