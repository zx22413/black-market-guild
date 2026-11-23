import type { PlayerId } from '../../v07/game';
import { CASH_REASON_LABELS, SHIP_TYPE_LABELS } from '../labels';
import { GoodIcon } from '../table3d/GoodIcon';
import { dieTop, type BeatView } from './beatTimeline';
import { gambleText } from './gambleShow';
import { crateStates, type ShipBeat } from './shipBeat';
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
  // 最後的大市集: the dice thrown and the pick take the tag's die and its line while they play.
  const gamble = beat.gamble && view.gamble ? { dice: beat.gamble, picked: view.gamble === 'picked' } : null;
  const gambleSay = gamble ? gambleText(gamble.dice, gamble.picked) : null;
  const owner = `${beat.owner === viewer ? '你' : (names[beat.owner] ?? beat.owner)}的${SHIP_TYPE_LABELS[beat.type]}`;
  // V0.8 prototype: a crate the show has dropped into the sea is crossed out where it sat.
  const cargo = crateStates(beat, view.dropsShown);
  // V0.8 prototype: the ship's skill going off, said in the tag as it happens (with the die, or with the outcome).
  const dieSkills = beat.skills.filter((m) => m.at === 'die').slice(0, view.skillsShown);
  const said = [...dieSkills, ...(view.showOutcome ? beat.skills.filter((m) => m.at === 'outcome') : [])];
  const who = (id: PlayerId) => (id === viewer ? '你' : (names[id] ?? id));

  return (
    <div className="beat-tag" data-focus="beat">
      <div className="beat-tag-top">
        <BeatDie value={view.die} step={lastStep} stepsShown={view.stepsShown} type={beat.type} top={dieTop(beat)} gamble={gamble} />
        <div className="beat-tag-say" aria-live="polite">
          <small>{owner}</small>
          {gambleSay && (
            <b key={view.gamble} className={`beat-pop gamble-say ${gamble?.picked ? 'picked' : ''}`}>
              {gambleSay.title}
            </b>
          )}
          {gambleSay && <small>{gambleSay.note}</small>}
          {!gambleSay && !view.showOutcome && !step && <b>起始 {view.die ?? beat.start}</b>}
          {step && (
            <b key={view.stepsShown} className="beat-pop">
              {stepTitle(step, names, dieTop(beat)).name} <span className={step.delta > 0 ? 'up' : 'down'}>{signed(step.delta)}</span>
            </b>
          )}
          {step && <small>{step.actors.length > 0 ? step.actors.map(who).join('、') : stepTitle(step, names, dieTop(beat)).who}</small>}
          {view.showOutcome && <span className={`beat-stamp small ${sank ? 'down' : 'up'}`}>{sank ? '沉沒' : '抵達'}</span>}
        </div>
      </div>
      {said.length > 0 && (
        <p className="beat-tag-skill">
          {said.map((m) => (
            <b key={m.effect} className={`beat-pop ${m.tone === 'gain' ? 'up' : 'down'}`}>
              {m.name}：{m.text}
            </b>
          ))}
        </p>
      )}
      <p className="beat-tag-trail">
        {view.gamble === 'thrown' ? '？' : view.gamble === 'picked' ? view.die : beat.start}
        {beat.steps.slice(0, view.stepsShown).map((s, i) => (
          <span key={i}> {signed(s.delta)}</span>
        ))}
        {view.showOutcome && <> ＝ {beat.final}</>}
      </p>
      {view.showCargo && (
        <div className="beat-tag-cargo">
          {cargo.map((c, i) => (
            <span key={i} className={`beat-crate good-${c.good} ${c.lost ? 'lost' : ''}`} style={{ animationDelay: `${i * 90}ms` }} {...(c.lost ? { title: '掉進海裡' } : {})}>
              <GoodIcon good={c.good} />
            </span>
          ))}
          {view.dropsShown > 0 && <small className="down beat-pop" key={view.dropsShown}>掉 {view.dropsShown} 箱</small>}
          {beat.confiscated.map((c) => (
            <small key={c.good} className="down">
              <GoodIcon good={c.good} size="sm" /> {c.units} 被沒收
            </small>
          ))}
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
              <small>打撈</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
