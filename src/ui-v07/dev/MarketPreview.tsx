import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import type { PlayerId, VoyageEventId } from '../../v07/game';
import { GOODS } from '../../v07/game';
import { seatAngles } from '../../ui/scene/layout';
import type { AwningState, MarketShow } from '../../ui/scene/MarketIsland';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import { GOOD_COLORS } from '../scene/CrateModel';
import { cargoCrates } from '../scene/marketShow';
import type { BeatSeat } from '../scene/beatStage';
import { TableCanvas, type TableShip } from '../scene/TableCanvas';
import { menuPrices } from '../menu/menuMotion';

// Dev-only: the market island up close, at /v07.html?dev=market. Query: `view` front | back | top | far
// (or `spin=1` to circle it), `weather` (storm, moonless-night, black-market-rush, …), `awnings` open | reefed | shut,
// `players` 3 or 4. Every ship lies at its berth and its porters set off again every 20 seconds.

const VIEWS: Readonly<Record<'front' | 'back' | 'top' | 'far', { readonly position: readonly [number, number, number]; readonly target: readonly [number, number, number] }>> = {
  front: { position: [0, 22, 34], target: [0, 6, 0] },
  back: { position: [0, 22, -34], target: [0, 6, 0] },
  top: { position: [0, 70, 6], target: [0, 0, 0] },
  far: { position: [0, 82, 60], target: [0, 0, 0] },
};

const LOADS = [
  { wood: 2, iron: 1, spice: 0, arms: 0 },
  { wood: 0, iron: 0, spice: 2, arms: 1 },
  { wood: 1, iron: 0, spice: 3, arms: 0 },
  { wood: 0, iron: 2, spice: 0, arms: 2 },
] as const;
const PORTER_LOOP = 20;

function Camera({ view, spin }: { readonly view: keyof typeof VIEWS; readonly spin: boolean }) {
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    const { position, target } = VIEWS[view];
    if (spin) {
      const a = clock.elapsedTime * 0.15;
      const r = Math.hypot(position[0], position[2]);
      camera.position.set(Math.sin(a) * r, position[1], Math.cos(a) * r);
    } else camera.position.set(...position);
    camera.lookAt(...target);
  });
  return null;
}

export function MarketPreview() {
  const q = new URLSearchParams(window.location.search);
  const view = (q.get('view') ?? 'front') as keyof typeof VIEWS;
  const weather = (q.get('weather') ?? null) as VoyageEventId | null;
  const awnings = (q.get('awnings') ?? (weather === 'storm' ? 'reefed' : 'open')) as AwningState;
  const count = q.get('players') === '3' ? 3 : 4;
  const angles = useMemo(() => seatAngles(count), [count]);
  const seats: BeatSeat[] = angles.map((_, i) => ({ id: `p${i}` as PlayerId, name: '', color: PLAYER_COLORS[i]!, buildings: [], island: null, isViewer: i === 0 }));
  const ships: TableShip[] = seats.map((s, i) => ({ id: `s${i}` as never, owner: s.id, state: 'arrived' }));
  const [time, setTime] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setTime((performance.now() - start) / 1000), 500);
    return () => clearInterval(id);
  }, []);
  const loop = Math.floor(time / PORTER_LOOP);
  const market: MarketShow = {
    prices: menuPrices(time),
    rowColors: GOODS.map((g) => GOOD_COLORS[g]),
    awnings,
    lanterns: weather === 'moonless-night' ? 'night' : weather === 'black-market-rush' ? 'festive' : 'off',
    rush: weather === 'black-market-rush',
    deliveries: angles.map((angle, i) => ({ key: `${loop}-${i}`, angle, crates: cargoCrates(LOADS[i % LOADS.length]!) })),
    bellKey: menuPrices(time).join(','),
  };
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <TableCanvas
        seats={seats}
        weather={weather}
        ships={ships}
        camera={<Camera view={view} spin={q.get('spin') === '1'} />}
        cameraPoints={[]}
        safe={{ top: 0, bottom: 0, left: 0, right: 0 }}
        pins={[]}
        onReady={() => undefined}
        market={market}
      />
    </div>
  );
}
