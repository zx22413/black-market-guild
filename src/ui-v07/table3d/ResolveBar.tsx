import { useEffect, useRef } from 'react';
import type { RoleId } from '../../v07/game';
import { revealSound } from '../audio/revealSounds';
import { soundEngine } from '../audio/soundEngine';
import { ROLE_LABELS, ROLE_TEXT } from '../labels';
import { InfoTip } from './InfoTip';
import { FastForwardIcon, FlagIcon, IconDisc } from './icons';
import { roleIconUrl } from './RoleBadges';

// Pieces of the bottom bar while a round plays out: where in the round we are (dots), what has
// been revealed so far (role discs), and a skip button that is only an icon.

const STAGES: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'wanted', label: '通緝' },
  { id: 'event', label: '航海事件' },
  { id: 'reveal', label: '角色揭露' },
  { id: 'voyage', label: '航程' },
  { id: 'market', label: '黑市' },
  { id: 'settle', label: '結帳' },
  { id: 'receipt', label: '帳單' },
];

/** One dot per phase of the round; the current one is filled, the finished ones are solid. */
export function StageSteps({ stage }: { readonly stage: string }) {
  const at = STAGES.findIndex((s) => s.id === stage);
  return (
    <span className="stage-steps" role="img" aria-label={`第 ${at + 1} 步，共 ${STAGES.length} 步：${STAGES[at]?.label ?? ''}`}>
      {STAGES.map((s, i) => (
        <i key={s.id} className={i < at ? 'done' : i === at ? 'now' : ''} title={s.label} />
      ))}
    </span>
  );
}

export interface RevealGroupLike {
  readonly role: RoleId;
  readonly deployments: readonly unknown[];
}

/** The roles of the round as discs, in reveal order; the ones still hidden are dashed blanks. */
export function RevealChips({ groups, shown }: { readonly groups: readonly RevealGroupLike[]; readonly shown: number }) {
  // Each group turned over sounds its role (only the last one when "reveal all" skips ahead).
  const before = useRef(0);
  useEffect(() => {
    const sound = revealSound(groups, before.current, shown);
    before.current = shown;
    if (sound) soundEngine.playSfx(sound);
  }, [groups, shown]);
  return (
    <span className="bar-chips">
      {groups.map((g, i) =>
        i < shown ? (
          <InfoTip key={g.role} title={`${ROLE_LABELS[g.role]}${g.deployments.length > 1 ? ` ×${g.deployments.length}` : ''}`} text={ROLE_TEXT[g.role]}>
            <span className="chip">
              <IconDisc src={roleIconUrl(g.role)} badge />
              {g.deployments.length > 1 && <b>×{g.deployments.length}</b>}
            </span>
          </InfoTip>
        ) : (
          <span key={g.role} className="chip empty" title="還沒揭露">
            ？
          </span>
        ),
      )}
    </span>
  );
}

export function SkipButton({ label, onClick, disabled = false }: { readonly label: string; readonly onClick: () => void; readonly disabled?: boolean }) {
  return (
    <button type="button" className="skip" title={disabled ? '教學中不能跳過' : label} aria-label={label} disabled={disabled} onClick={onClick}>
      <FastForwardIcon />
    </button>
  );
}

export interface WantedSeat {
  readonly name: string;
  readonly color: string;
}

/** The notice that goes up before the voyage event: a red flag and who is wanted this round (§9.6). */
export function WantedBanner({ seats }: { readonly seats: readonly WantedSeat[] }) {
  return (
    <div className="wanted-banner" role="status" aria-label={`通緝：${seats.map((s) => s.name).join('、')}`}>
      <span className="wanted-flag">
        <FlagIcon />
      </span>
      <b>通緝</b>
      <span className="bar-chips">
        {seats.map((s) => (
          <span key={s.name} className="chip">
            <i className="seat-dot" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </span>
    </div>
  );
}

/** The chips for the bar while the notice is up. */
export function WantedChips({ seats }: { readonly seats: readonly WantedSeat[] }) {
  return (
    <span className="bar-chips">
      {seats.map((s) => (
        <span key={s.name} className="chip">
          <i className="seat-dot" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </span>
  );
}
