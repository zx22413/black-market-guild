import { useCallback, useRef, type CSSProperties } from 'react';
import type { PlayerId } from '../../game';
import { SeatFx } from '../table/RecruitFx';
import type { CueKind, RecruitCue } from '../table/recruitShow';
import type { SceneSeat } from '../scene/tableModel';
import '../table/table.css';

const SPOTS: readonly { id: string; label: string; left: number; top: number; color: string }[] = [
  { id: 'a', label: '發起方（羊皮紙）', left: 140, top: 190, color: '#e0b43c' },
  { id: 'b', label: '應徵方（飛鴿 → 發起方）', left: 460, top: 190, color: '#d0553f' },
  { id: 'c', label: '合作成立', left: 140, top: 430, color: '#4f8fd6' },
  { id: 'd', label: '合作成立', left: 340, top: 430, color: '#6db36a' },
  { id: 'e', label: '信封撕裂', left: 540, top: 430, color: '#e0b43c' },
  { id: 'f', label: '羊皮紙撕裂', left: 740, top: 430, color: '#d0553f' },
];

function seatOf(spot: (typeof SPOTS)[number], recruiting: SceneSeat['recruiting']): SceneSeat {
  return { id: spot.id, name: spot.label, color: spot.color, cash: 0, assets: [], assetValue: 0, isViewer: false, recruiting, appliedTo: [], stayedInPort: false };
}

/**
 * Dev-only still frames of the recruitment show at /?dev=fx&t=900: every animation is held at t
 * milliseconds into its run (default 700), so each picture can be checked on its own.
 */
export function FxPreview() {
  const params = new URLSearchParams(window.location.search);
  const t = Number(params.get('t') ?? 700);
  const anchors = useRef(new Map<string, HTMLElement>());
  const rectOf = useCallback((id: PlayerId) => anchors.current.get(id)?.getBoundingClientRect(), []);
  const cue = (kind: CueKind, player: string, extra: Partial<RecruitCue> = {}): RecruitCue => ({ key: `${kind}-${player}`, kind, player, at: -t, duration: kind === 'pigeon' ? 1400 : 2000, ...extra });
  const cues: RecruitCue[] = [
    cue('pigeon', 'b', { to: 'a' }),
    cue('handshake', 'c'),
    cue('handshake', 'd'),
    cue('envelope-tear', 'e'),
    cue('parchment-tear', 'f', { duration: 1200 }),
  ];
  return (
    <div className="fx-frozen" style={{ position: 'fixed', inset: 0, background: '#4fa9ad', overflow: 'hidden' }}>
      {SPOTS.map((spot) => (
        <div key={spot.id}>
          <div style={{ position: 'absolute', left: spot.left - 60, top: spot.top, width: 120, height: 60, borderRadius: '50%', background: '#e7d29a', border: '3px solid #b89a5a' }} />
          <div
            ref={(el) => {
              if (el) anchors.current.set(spot.id, el);
            }}
            className="fx-anchor"
            style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${spot.left}px, ${spot.top + 10}px)` } as CSSProperties}
          >
            <SeatFx seat={seatOf(spot, spot.id === 'a' ? 'open' : null)} cues={cues} standing rectOf={rectOf} />
          </div>
          <div style={{ position: 'absolute', left: spot.left - 70, top: spot.top + 66, width: 140, textAlign: 'center', fontSize: 12, color: '#fff' }}>{spot.label}</div>
        </div>
      ))}
    </div>
  );
}
