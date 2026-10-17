import { GOODS, type PlayerId } from '../../v07/game';
import { CASH_REASON_LABELS } from '../labels';
import { GoodIcon } from '../table3d/GoodIcon';
import type { BeatView } from './beatTimeline';
import type { ShipBeat } from './shipBeat';
import { BeatDie, currentStep, signed, stepTitle } from './ShipBeatStage';
import './beat.css';

// Everything the beat says at this moment, in one tag pinned above the ship on the 3D table: the
// die, the step and its value, the running sum, then the outcome, the cargo and the money. One
// place to look (the docked side panel split the eye between the ship and the text).

export interface BeatTagProps {
  readonly beat: ShipBeat;
  readonly view: BeatView;
  readonly names: Readonly<Record<PlayerId, string>>;
  readonly viewer: PlayerId | null;
}

export function BeatTag({ beat, view, names, viewer }: BeatTagProps) {
  const step = currentStep(beat, view);
  const lastStep = view.stepsShown > 0 ? beat.steps[view.stepsShown - 1]! : null;
  const sank = beat.outcome === 'sank';
  const owner = beat.owner === viewer ? '你的船' : `${names[beat.owner] ?? beat.owner}的船`;
  const cargo = GOODS.flatMap((g) => Array.from({ length: beat.cargo[g] }, () => g));
  const who = (id: PlayerId) => (id === viewer ? '你' : (names[id] ?? id));

  return (
    <div className="beat-tag">
      <div className="beat-tag-top">
        <BeatDie value={view.die} step={lastStep} stepsShown={view.stepsShown} />
        <div className="beat-tag-say" aria-live="polite">
          <small>{owner}</small>
          {!view.showOutcome && !step && <b>起始 {beat.start}</b>}
          {step && (
            <b key={view.stepsShown} className="beat-pop">
              {stepTitle(step, names).name} <span className={step.delta > 0 ? 'up' : 'down'}>{signed(step.delta)}</span>
            </b>
          )}
          {step && <small>{step.actors.length > 0 ? step.actors.map(who).join('、') : stepTitle(step, names).who}</small>}
          {view.showOutcome && <span className={`beat-stamp small ${sank ? 'down' : 'up'}`}>{sank ? '沉沒' : '抵達'}</span>}
        </div>
      </div>
      <p className="beat-tag-trail">
        {beat.rerolled && <em>重擲後 </em>}
        {beat.start}
        {beat.steps.slice(0, view.stepsShown).map((s, i) => (
          <span key={i}> {signed(s.delta)}</span>
        ))}
        {view.showOutcome && <> ＝ {beat.final}</>}
      </p>
      {view.showCargo && (
        <div className="beat-tag-cargo">
          {cargo.map((g, i) => (
            <span key={i} className={`beat-crate good-${g}`} style={{ animationDelay: `${i * 90}ms` }}>
              <GoodIcon good={g} />
            </span>
          ))}
          {beat.armsConfiscated > 0 && (
            <small className="down">
              <GoodIcon good="arms" size="sm" /> {beat.armsConfiscated} 被沒收
            </small>
          )}
        </div>
      )}
      {view.cashShown + view.goodsShown > 0 && (
        <ul className="beat-tag-cash">
          {beat.cash.slice(0, view.cashShown).map((c, i) => (
            <li key={i} className={c.playerId === viewer ? 'mine' : ''}>
              <b className={c.amount >= 0 ? 'up' : 'down'}>
                {c.amount >= 0 ? '+' : '−'}
                {Math.abs(c.amount)}
              </b>
              <span>{who(c.playerId)}</span>
              <small>{CASH_REASON_LABELS[c.reason]}</small>
            </li>
          ))}
          {beat.goods.slice(0, view.goodsShown).map((g, i) => (
            <li key={`g${i}`} className={g.playerId === viewer ? 'mine' : ''}>
              <b className="up">
                +{g.units}
                <GoodIcon good={g.good} size="sm" />
              </b>
              <span>{who(g.playerId)}</span>
              <small>{g.via === 'insurance' ? '保險保住' : '打撈'}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
