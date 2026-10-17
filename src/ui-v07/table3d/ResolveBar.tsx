import type { RoleId } from '../../v07/game';
import { ROLE_LABELS } from '../labels';
import { FastForwardIcon, IconDisc } from './icons';
import { roleIconUrl } from './RoleBadges';

// Pieces of the bottom bar while a round plays out: where in the round we are (dots), what has
// been revealed so far (role discs), and a skip button that is only an icon.

const STAGES: readonly { readonly id: string; readonly label: string }[] = [
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
  return (
    <span className="bar-chips">
      {groups.map((g, i) =>
        i < shown ? (
          <span key={g.role} className="chip" title={`${ROLE_LABELS[g.role]}${g.deployments.length > 1 ? ` ×${g.deployments.length}` : ''}`}>
            <IconDisc src={roleIconUrl(g.role)} />
            {g.deployments.length > 1 && <b>×{g.deployments.length}</b>}
          </span>
        ) : (
          <span key={g.role} className="chip empty" title="還沒揭露">
            ？
          </span>
        ),
      )}
    </span>
  );
}

export function SkipButton({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <button type="button" className="skip" title={label} aria-label={label} onClick={onClick}>
      <FastForwardIcon />
    </button>
  );
}
