import { useState } from 'react';
import type { Action, AssetId, PlayerId, Rules } from '../../game';
import { assetIcon } from '../art';
import { Icon } from '../components/Icon';
import { ASSET_LABELS } from '../labels';
import type { SceneSeat } from '../scene/tableModel';
import { assetText } from '../rulesText';
import type { PartnerChoice, PartnerPick } from './partnerChoice';
import './partner.css';

interface PartnerPickerProps {
  readonly choice: PartnerChoice;
  /** Extra rule reminder shown beside the prompt. */
  readonly note: string | null;
  readonly seats: readonly SceneSeat[];
  readonly rules: Rules;
  readonly pick: PartnerPick | null;
  readonly onPick: (pick: PartnerPick | null) => void;
  readonly onSubmit: (action: Action) => void;
}

const COPY = {
  apply: { prompt: '選一座島查看對方，確認後才會送出應徵', decline: '不應徵', confirm: '確認應徵', confirmNone: '確認不應徵' },
  pick: { prompt: '選一位應徵者查看對方，確認後才會成立合資', decline: '都不選', confirm: '確認選擇', confirmNone: '確認都不選' },
} as const;

/** Select-then-confirm picker for the apply / pick phases; shows only public ledger data. */
export function PartnerPicker({ choice, note, seats, rules, pick, onPick, onSubmit }: PartnerPickerProps) {
  const copy = COPY[choice.phase];
  const [inspected, setInspected] = useState<AssetId | null>(null);
  // Assets whose ability text was opened, keyed by guild so switching back keeps the progress.
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const seat = pick?.kind === 'player' ? seats.find((s) => s.id === pick.id) : undefined;
  const action = pick ? choice.actionFor(pick) : null;

  const choose = (next: PartnerPick | null) => {
    setInspected(null);
    onPick(next);
  };
  const inspect = (guild: PlayerId, asset: AssetId) => {
    setInspected(inspected === asset ? null : asset);
    setSeen(new Set([...seen, `${guild}:${asset}`]));
  };

  return (
    <>
      {seat && (
        <div className="partner-card" style={{ borderColor: seat.color }}>
          <strong className="partner-name">
            <i style={{ background: seat.color }} aria-hidden />
            {seat.name}
          </strong>
          <div className="ledger-row">
            <span>資金</span>
            <b>{seat.cash} G</b>
          </div>
          <div className="ledger-row">
            <span>資產</span>
            <b>{seat.assetValue} G</b>
          </div>
          {seat.assets.length > 0 ? (
            <>
              <div className="partner-assets">
                {seat.assets.map((asset) => {
                  const unseen = !seen.has(`${seat.id}:${asset}`);
                  return (
                    <button
                      key={asset}
                      type="button"
                      className={`asset-chip ${unseen ? 'unseen' : ''} ${inspected === asset ? 'open' : ''}`}
                      aria-pressed={inspected === asset}
                      onClick={() => inspect(seat.id, asset)}
                    >
                      <Icon name={assetIcon(asset)} size={20} />
                      {ASSET_LABELS[asset]}
                    </button>
                  );
                })}
              </div>
              <p className="partner-detail">
                {inspected ? assetText(inspected, rules) : `點建築查看能力（已看 ${seat.assets.filter((a) => seen.has(`${seat.id}:${a}`)).length}/${seat.assets.length}）`}
              </p>
            </>
          ) : (
            <p className="partner-detail">尚未擁有任何資產</p>
          )}
        </div>
      )}
      <div className="action-pill">
        <span>
          {copy.prompt}
          {note && <small>（{note}）</small>}
        </span>
        {choice.candidates.map((id) => {
          const target = seats.find((s) => s.id === id);
          return (
            <button key={id} type="button" className={`partner-option ${pick?.kind === 'player' && pick.id === id ? 'selected' : ''}`} aria-pressed={pick?.kind === 'player' && pick.id === id} onClick={() => choose({ kind: 'player', id })}>
              <i style={{ background: target?.color ?? '#7a5a36' }} aria-hidden />
              {target?.name ?? id}
            </button>
          );
        })}
        {choice.decline && (
          <button type="button" className={`partner-option ${pick?.kind === 'decline' ? 'selected' : ''}`} aria-pressed={pick?.kind === 'decline'} onClick={() => choose({ kind: 'decline' })}>
            {copy.decline}
          </button>
        )}
        <button type="button" className="primary" disabled={action === null} onClick={() => action && onSubmit(action)}>
          {pick?.kind === 'decline' ? copy.confirmNone : seat ? `${copy.confirm} ${seat.name}` : copy.confirm}
        </button>
      </div>
    </>
  );
}
