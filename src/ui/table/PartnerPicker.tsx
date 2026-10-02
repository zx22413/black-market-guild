import type { Action } from '../../game';
import type { SceneSeat } from '../scene/tableModel';
import type { PartnerChoice, PartnerPick } from './partnerChoice';
import './partner.css';

interface PartnerPickerProps {
  readonly choice: PartnerChoice;
  /** Extra rule reminder shown beside the prompt. */
  readonly note: string | null;
  readonly seats: readonly SceneSeat[];
  readonly pick: PartnerPick | null;
  readonly onPick: (pick: PartnerPick | null) => void;
  readonly onSubmit: (action: Action) => void;
}

const COPY = {
  apply: { prompt: '點選一座島查看對方，確認後才會送出應徵', decline: '不應徵', confirm: '確認應徵', confirmNone: '確認不應徵' },
  pick: { prompt: '點選一座島查看應徵者，確認後才會成立合資', decline: '都不選', confirm: '確認選擇', confirmNone: '確認都不選' },
} as const;

/** Select-then-confirm strip for the apply / pick phases; the info card floats on the picked island. */
export function PartnerPicker({ choice, note, seats, pick, onPick, onSubmit }: PartnerPickerProps) {
  const copy = COPY[choice.phase];
  const seat = pick?.kind === 'player' ? seats.find((s) => s.id === pick.id) : undefined;
  const action = pick ? choice.actionFor(pick) : null;
  return (
    <div className="action-pill">
      <span>
        {copy.prompt}
        {note && <small>（{note}）</small>}
      </span>
      {choice.candidates.map((id) => {
        const target = seats.find((s) => s.id === id);
        const picked = pick?.kind === 'player' && pick.id === id;
        return (
          <button key={id} type="button" className={`partner-option ${picked ? 'selected' : ''}`} aria-pressed={picked} onClick={() => onPick({ kind: 'player', id })}>
            <i style={{ background: target?.color ?? '#7a5a36' }} aria-hidden />
            {target?.name ?? id}
          </button>
        );
      })}
      {choice.decline && (
        <button type="button" className={`partner-option ${pick?.kind === 'decline' ? 'selected' : ''}`} aria-pressed={pick?.kind === 'decline'} onClick={() => onPick({ kind: 'decline' })}>
          {copy.decline}
        </button>
      )}
      <button type="button" className="primary" disabled={action === null} onClick={() => action && onSubmit(action)}>
        {pick?.kind === 'decline' ? copy.confirmNone : seat ? `${copy.confirm} ${seat.name}` : copy.confirm}
      </button>
    </div>
  );
}
