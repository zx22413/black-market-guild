import type { DecisionContext } from '../../v07/bots';
import type { Action, PlayerId } from '../../v07/game';
import { BeatDie } from '../beats/ShipBeatStage';
import { legalOf } from '../table/forms';
import type { Board } from '../session/board';
import { shipName } from './stage';

// The intel merchant's private moment (§9.4, docs/ui/v07-event-presentation.md §1.4): a full-screen
// card with the raw die of each ship looked at, and the choice to reroll one or none. Only this
// player ever sees it; everyone else just sees that someone is still deciding.

export interface RerollCardProps {
  readonly context: DecisionContext;
  readonly board: Board;
  readonly viewer: PlayerId;
  readonly nameOf: (id: PlayerId) => string;
  readonly onSubmit: (action: Action) => void;
}

export function RerollCard({ context, board, viewer, nameOf, onSubmit }: RerollCardProps) {
  const options = legalOf(context, 'intel-reroll');
  const name = (id: string) => shipName(board, id, viewer, nameOf);
  return (
    <div className="beat-backdrop reroll-backdrop" role="dialog" aria-modal="true" aria-label="情報重擲">
      <div className="beat-card reroll">
        <header className="beat-head">
          <span>只有你看得到</span>
          <strong>情報商人：要重擲嗎？</strong>
        </header>
        <div className="reroll-dice">
          {context.view.intel.map((k) => (
            <div key={k.shipId} className="reroll-ship">
              <small>{name(k.shipId)}的原始骰值</small>
              <BeatDie value={k.rawRoll} step={null} stepsShown={0} />
            </div>
          ))}
        </div>
        <p className="reroll-hint">1～3 沉沒、4～6 抵達，之後還會加上護衛、海盜、航海事件與島嶼的修正。重擲後必須接受新結果；現在還不知道航海事件和別人的角色。</p>
        <footer className="beat-foot">
          {options.map((a) => (
            // Same look for every choice: the card should not suggest an answer.
            <button key={a.rerollShipId ?? 'none'} type="button" onClick={() => onSubmit(a)}>
              {a.rerollShipId === null ? '不重擲' : `重擲${name(a.rerollShipId)}`}
            </button>
          ))}
        </footer>
      </div>
    </div>
  );
}
