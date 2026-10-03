import type { CSSProperties } from 'react';
import type { SceneSeat } from '../scene/tableModel';
import type { RecruitCue } from './recruitShow';
import './recruitFx.css';

const timing = (cue: RecruitCue): CSSProperties => ({ '--at': `${cue.at}ms`, '--dur': `${cue.duration}ms` }) as CSSProperties;

/** The words that go with a cue; the pictures themselves are 3D props (scene/RecruitProps). */
const VERDICTS: Partial<Record<RecruitCue['kind'], { readonly text: string; readonly tone: 'ok' | 'fail' | 'note' }>> = {
  handshake: { text: '合作成立', tone: 'ok' },
  'envelope-tear': { text: '合作破裂', tone: 'fail' },
  'parchment-withdraw': { text: '撤回招募', tone: 'note' },
};

interface SeatFxProps {
  readonly seat: SceneSeat;
  readonly cues: readonly RecruitCue[];
}

/** The recruitment show's labels over one guild's island, timed with its 3D props. */
export function SeatFx({ seat, cues }: SeatFxProps) {
  return (
    <>
      {cues
        .filter((cue) => cue.player === seat.id)
        .map((cue) => {
          const verdict = VERDICTS[cue.kind];
          return verdict ? (
            <div key={cue.key} className="fx-item" style={timing(cue)}>
              <b className={`verdict ${verdict.tone}`}>{verdict.text}</b>
            </div>
          ) : null;
        })}
    </>
  );
}
