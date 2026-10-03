import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { PlayerId } from '../../game';
import { Icon } from '../components/Icon';
import type { SceneSeat } from '../scene/tableModel';
import type { RecruitCue } from './recruitShow';
import './recruitFx.css';

type RectOf = (id: PlayerId) => DOMRect | undefined;

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

function Pigeon() {
  return (
    <svg className="fx-pigeon-art" viewBox="0 0 80 52" aria-hidden>
      <path d="M8 24 L0 14 L16 20 Z" fill="#9aa3ad" />
      <ellipse cx="34" cy="28" rx="24" ry="13" fill="#e9edf2" stroke="#6b7480" strokeWidth="2" />
      <circle cx="56" cy="20" r="8" fill="#e9edf2" stroke="#6b7480" strokeWidth="2" />
      <circle cx="58.5" cy="18.5" r="1.6" fill="#2b2f36" />
      <path d="M63 21 L72 23.5 L63 25.5 Z" fill="#e8943a" />
      <g className="wing">
        <path d="M30 24 C22 6 8 4 2 8 C12 10 18 18 22 28 Z" fill="#c4ccd6" stroke="#6b7480" strokeWidth="2" strokeLinejoin="round" />
      </g>
      <rect x="64" y="22" width="12" height="9" rx="1.5" fill="#fff6dc" stroke="#7a5a36" strokeWidth="1.5" />
      <path d="M64 22 L70 27 L76 22" fill="none" stroke="#7a5a36" strokeWidth="1.5" />
    </svg>
  );
}

/** A pigeon flying from its own island to the recruiter's, an arc over the sea. */
function PigeonFlight({ cue, rectOf }: { readonly cue: RecruitCue; readonly rectOf: RectOf }) {
  const [shift, setShift] = useState<{ dx: number; dy: number } | null>(null);
  useLayoutEffect(() => {
    const from = rectOf(cue.player);
    const to = cue.to ? rectOf(cue.to) : undefined;
    if (from && to) setShift({ dx: to.left - from.left, dy: to.top - from.top });
  }, [cue, rectOf]);
  if (!shift) return null;
  const style = { ...timing(cue), '--dx': `${shift.dx}px`, '--dy': `${shift.dy}px` } as CSSProperties;
  return (
    <div className="fx-pigeon" style={style}>
      <div className={shift.dx < 0 ? 'flip' : ''}>
        <Pigeon />
      </div>
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
  readonly rectOf: RectOf;
}

/** Everything the recruitment show draws over one guild's island. */
export function SeatFx({ seat, cues, standing, rectOf }: SeatFxProps) {
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
            return <PigeonFlight key={cue.key} cue={cue} rectOf={rectOf} />;
          case 'handshake':
            return <Handshake key={cue.key} cue={cue} />;
          case 'envelope-tear':
            return <EnvelopeTear key={cue.key} cue={cue} />;
        }
      })}
    </>
  );
}
