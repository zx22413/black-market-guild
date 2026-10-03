import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../components/Icon';
import type { SceneSeat } from '../scene/tableModel';
import type { RecruitCue } from './recruitShow';
import './recruitFx.css';

const timing = (cue: RecruitCue): CSSProperties => ({ '--at': `${cue.at}ms`, '--dur': `${cue.duration}ms` }) as CSSProperties;

/** A recruiter's open call: a parchment scroll with a handshake on it. */
function Parchment() {
  return (
    <div className="fx-parchment">
      <Icon name="handshake" size={34} />
    </div>
  );
}

/** Two jagged halves of the same picture drifting apart, as if ripped in two. */
function Torn({ children }: { readonly children: ReactNode }) {
  return (
    <div className="fx-torn">
      <div className="half a">{children}</div>
      <div className="half b">{children}</div>
    </div>
  );
}

function Envelope() {
  return (
    <div className="fx-envelope">
      <i className="flap" />
      <i className="seal" />
    </div>
  );
}

function Handshake({ cue }: { readonly cue: RecruitCue }) {
  return (
    <div className="fx-handshake" style={timing(cue)}>
      <i className="ring" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <i key={i} className="spark" style={{ '--a': `${i * 60 + 20}deg` } as CSSProperties} />
      ))}
      <div className="badge">
        <Icon name="handshake" size={54} />
      </div>
      <b className="verdict ok">合作成立</b>
    </div>
  );
}

function EnvelopeTear({ cue }: { readonly cue: RecruitCue }) {
  return (
    <div className="fx-fail" style={timing(cue)}>
      <Torn>
        <Envelope />
      </Torn>
      <b className="verdict fail">合作破裂</b>
    </div>
  );
}

interface SeatFxProps {
  readonly seat: SceneSeat;
  readonly cues: readonly RecruitCue[];
  /** The open recruitment is still on the table (the results are not out yet). */
  readonly standing: boolean;
}

/** Everything the recruitment show draws over one guild's island. */
export function SeatFx({ seat, cues, standing }: SeatFxProps) {
  const mine = cues.filter((c) => c.player === seat.id);
  return (
    <>
      {standing && seat.recruiting === 'open' && (
        <div className="fx-item fx-pop">
          <Parchment />
        </div>
      )}
      {mine.map((cue) => {
        switch (cue.kind) {
          case 'parchment-hold':
            return cue.duration > 0 ? (
              <div key={cue.key} className="fx-item fx-hold" style={timing(cue)}>
                <Parchment />
              </div>
            ) : null;
          case 'parchment-tear':
            return (
              <div key={cue.key} className="fx-item fx-fail" style={timing(cue)}>
                <Torn>
                  <Parchment />
                </Torn>
              </div>
            );
          case 'pigeon':
            // The pigeon is a 3D model flying over the table (scene/PigeonFlight), not drawn here.
            return null;
          case 'handshake':
            return <Handshake key={cue.key} cue={cue} />;
          case 'envelope-tear':
            return <EnvelopeTear key={cue.key} cue={cue} />;
        }
      })}
    </>
  );
}
