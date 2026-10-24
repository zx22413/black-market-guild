import { useSyncExternalStore } from 'react';
import { soundEngine } from './soundEngine';
import { isMuted, setMuted, subscribeMuted } from './soundSettings';

// Drawn here rather than in table3d/icons so the menu does not load the table's icon set.
const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** A speaker with sound waves (sound on), or with a cross (sound off). */
function SpeakerIcon({ off }: { readonly off: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" {...LINE} />
      <path d={off ? 'M11 6l3.5 4M14.5 6L11 10' : 'M11 5.5c1.3 1.4 1.3 3.6 0 5M13 3.8c2.2 2.3 2.2 6.1 0 8.4'} {...LINE} />
    </svg>
  );
}

/** The sound on/off button: in the menu corner and in the match's top-right menu. */
export function SoundToggle({ className }: { readonly className?: string }) {
  const muted = useSyncExternalStore(subscribeMuted, isMuted);
  const label = muted ? '開啟聲音' : '關閉聲音';
  return (
    <button
      type="button"
      className={className}
      title={label}
      aria-label={label}
      aria-pressed={muted}
      onClick={() => {
        setMuted(!muted);
        soundEngine.unlock();
      }}
    >
      <SpeakerIcon off={muted} />
    </button>
  );
}
