import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import { RULES_V06, VOYAGE_EVENT_IDS, type VoyageEventId } from '../../game';
import { assetIcon, iconUrl, marketIcon, roleIcon, voyageIcon } from '../art';
import { Icon } from '../components/Icon';
import { ASSET_LABELS, MARKET_EVENT_LABELS, ROLE_LABELS, VOYAGE_EVENT_LABELS } from '../labels';
import { marketEventText, voyageEventText } from '../rulesText';
import { PlayerIsland, TargetIsland, type SeatInfo } from './Islands';
import { PLAYER_COLORS, seatAngles, seatPosition } from './layout';
import { LabelTracker, type LabelAnchor } from './ScreenLabels';
import { Sea } from './Sea';
import { PirateRaider, VoyageShip, type ShipState } from './Ships';
import { WEATHER } from './weather';
import './scene.css';

// Static sample table for judging the composition; not wired to the engine yet.
const SEATS: readonly SeatInfo[] = [
  { name: '你', cash: 1050, assets: ['shipyard', 'insurance'], color: PLAYER_COLORS[0], isViewer: true },
  { name: '黑潮會', cash: 820, assets: ['salvage', 'exchange'], color: PLAYER_COLORS[1], isViewer: false },
  { name: '金錨公會', cash: 640, assets: ['shipyard'], color: PLAYER_COLORS[2], isViewer: false },
  { name: '霧港商團', cash: 1100, assets: [], color: PLAYER_COLORS[3], isViewer: false },
];
const SHIPS: readonly { readonly state: ShipState; readonly progress: number; readonly joint?: boolean }[] = [
  { state: 'sailing', progress: 0.45 },
  { state: 'sailing', progress: 0.55, joint: true },
  { state: 'sunk', progress: 0.5 },
  { state: 'docked', progress: 0 },
];
const MARKET_EVENT = 'black-market-bounty' as const;
const ANGLES = seatAngles(SEATS.length);
const ANCHORS: readonly LabelAnchor[] = [
  { id: 'target', position: [0, 15, 0] },
  ...SEATS.map((_, i): LabelAnchor => {
    const [x, , z] = seatPosition(ANGLES[i]!);
    return { id: `seat-${i}`, position: [x, 9, z] };
  }),
];

interface TableProps {
  readonly weather: VoyageEventId | 'clear';
  /** Called once every model has loaded and the table is on screen. */
  readonly onReady: () => void;
}

function Table({ weather, onReady }: TableProps) {
  const look = WEATHER[weather];
  useEffect(onReady, [onReady]);
  const angles = ANGLES;
  return (
    <>
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.sky, look.fogNear, look.fogFar]} />
      <ambientLight intensity={look.ambient} />
      <hemisphereLight args={[look.sky, '#3a6b4a', 0.6]} />
      <directionalLight
        position={[-40, 60, 30]}
        intensity={look.sun}
        color={look.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <Sea color={look.sea} />
      <TargetIsland />
      {SEATS.map((seat, i) => (
        <PlayerIsland key={seat.name} seat={seat} angle={angles[i]!} seed={i + 1} />
      ))}
      {SHIPS.map((ship, i) => (
        <VoyageShip key={i} angle={angles[i]!} {...ship} />
      ))}
      <PirateRaider angle={angles[1]!} progress={0.5} />
    </>
  );
}


/** Static 3D mock-up of the table: four guild islands around the target island. */
export function ScenePrototype() {
  const [weather, setWeather] = useState<VoyageEventId | 'clear'>('clear');
  const voyage = weather === 'clear' ? null : weather;
  const [ready, setReady] = useState(false);
  const markReady = useRef(() => setReady(true)).current;
  const labels = useRef(new Map<string, HTMLElement>());
  const pin = (id: string) => (element: HTMLElement | null) => {
    if (element) labels.current.set(id, element);
    else labels.current.delete(id);
  };
  return (
    <div className="scene-root">
      <Canvas shadows camera={{ position: [0, 64, 78], fov: 38 }} onCreated={({ camera }) => camera.lookAt(0, 0, 8)}>
        <Suspense fallback={null}>
          <Table weather={weather} onReady={markReady} />
        </Suspense>
        <LabelTracker anchors={ANCHORS} elements={labels} />
      </Canvas>
      <div className="scene-labels">
        <div ref={pin('target')} className="island-sign">
          <strong>黑市港</strong>
          <span>公告：{MARKET_EVENT_LABELS[MARKET_EVENT]}</span>
        </div>
        {SEATS.map((seat, i) =>
          seat.isViewer ? null : (
            <div key={seat.name} ref={pin(`seat-${i}`)} className="seat-tag" style={{ borderColor: seat.color }}>
              <strong>{seat.name}</strong>
              <span className="seat-cash">{seat.cash} G</span>
              <span className="seat-assets">
                {seat.assets.map((a) => (
                  <img key={a} src={iconUrl(assetIcon(a))} alt={ASSET_LABELS[a]} title={ASSET_LABELS[a]} />
                ))}
              </span>
            </div>
          ),
        )}
      </div>
      {!ready && <div className="scene-loading">整理港口中…</div>}

      <div className="hud hud-top-left">
        <div className="hud-round">
          回合 <strong>3</strong> / {RULES_V06.rounds}
        </div>
        <div className="hud-event">
          <Icon name={marketIcon(MARKET_EVENT)} size={28} />
          <div>
            <small>市場事件</small>
            <strong>{MARKET_EVENT_LABELS[MARKET_EVENT]}</strong>
            <p>{marketEventText(MARKET_EVENT, RULES_V06)}</p>
          </div>
        </div>
        <div className="hud-event">
          {voyage ? <Icon name={voyageIcon(voyage)} size={28} /> : <Icon name="dice" size={28} />}
          <div>
            <small>航海事件</small>
            <strong>{voyage ? VOYAGE_EVENT_LABELS[voyage] : '尚未揭曉'}</strong>
            {voyage && <p>{voyageEventText(voyage, RULES_V06)}</p>}
          </div>
        </div>
      </div>

      <div className="hud hud-top-right">
        <button className="hud-icon-button" aria-label="航海日誌" title="航海日誌">
          <Icon name="asset-insurance" size={24} />
        </button>
        <label className="hud-weather">
          天氣預覽
          <select value={weather} onChange={(e) => setWeather(e.target.value as VoyageEventId | 'clear')}>
            <option value="clear">揭曉前（晴）</option>
            {VOYAGE_EVENT_IDS.map((id) => (
              <option key={id} value={id}>
                {VOYAGE_EVENT_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hud hud-bottom-left">
        <div className="hud-cash">
          <small>你的資金</small>
          <strong>{SEATS[0]!.cash}</strong>
          <small>G</small>
        </div>
      </div>

      <div className="hud hud-bottom-center">
        <div className="action-pill">
          <span>秘密部署角色</span>
          <button>不部署</button>
          <button className="primary">確認</button>
        </div>
      </div>

      <div className="hud hud-bottom-right">
        {(['intel', 'guard', 'pirate', 'smuggler'] as const).map((role, i) => (
          <div key={role} className="role-card" style={{ transform: `rotate(${(i - 1.5) * 7}deg) translateY(${Math.abs(i - 1.5) * 6}px)` }}>
            <Icon name={roleIcon(role)} size={34} />
            <span>{ROLE_LABELS[role]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
