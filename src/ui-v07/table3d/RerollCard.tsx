import { useEffect, useState } from 'react';
import type { DecisionContext } from '../../v07/bots';
import type { Action, PlayerId, ShipId } from '../../v07/game';
import { SINK_MAX } from '../beats/ShipBeatStage';
import { legalOf } from '../table/forms';
import type { Board } from '../session/board';
import { IconDisc, InfoIcon, tokenIconUrl } from './icons';
import { LockHint } from './LockHint';
import { roleIconUrl } from './RoleBadges';
import { shipName } from './stage';

// The intel merchant's private moment (§9.4, docs/ui/v07-event-presentation.md §1.4): a full-screen
// card with the raw die of each ship looked at and the choice to reroll one or none. A reroll plays
// in the card itself: the die tumbles through faces with the 1–6 meter following it, then lands on
// the new value (which must be accepted). Only this player ever sees it.

/** How long the die tumbles before landing, and how often its face changes meanwhile. */
const TUMBLE_MS = 1400;
const FACE_MS = 90;

export interface RerollCardProps {
  readonly context: DecisionContext;
  readonly board: Board;
  readonly viewer: PlayerId;
  readonly nameOf: (id: PlayerId) => string;
  readonly onSubmit: (action: Action) => void;
  /** After choosing to reroll: the ship rerolled, and its new value once known. */
  readonly rerolled: { readonly shipId: ShipId; readonly value: number | null } | null;
  readonly onClose: () => void;
}

/** Faces shown while tumbling: a fixed jumble (display only), never the same face twice in a row. */
const JUMBLE = [3, 5, 1, 4, 2, 5] as const;
const nextFace = (current: number, tick: number): number => ((current - 1 + JUMBLE[tick % JUMBLE.length]!) % 6) + 1;

function Meter({ value }: { readonly value: number }) {
  return (
    <ol className="beat-meter" aria-label="1～3 沉沒，4～6 抵達">
      {[6, 5, 4, 3, 2, 1].map((v) => (
        <li key={v} className={`${v <= SINK_MAX ? 'sink' : 'safe'} ${value === v ? 'on' : ''}`}>
          {v}
        </li>
      ))}
    </ol>
  );
}

function RollingDie({ raw, result }: { readonly raw: number; readonly result: number | null }) {
  const [face, setFace] = useState(raw);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (result === null) return;
    const started = performance.now();
    let tick = 0;
    const timer = setInterval(() => {
      if (performance.now() - started >= TUMBLE_MS) {
        clearInterval(timer);
        setFace(result);
        setLanded(true);
      } else setFace((f) => nextFace(f, tick++));
    }, FACE_MS);
    return () => clearInterval(timer);
  }, [result]);
  return (
    <div className="beat-dice">
      <div key={landed ? 'landed' : 'rolling'} className={`beat-die ${landed ? (result !== null && result > SINK_MAX ? 'up' : 'down') : 'tumbling'}`}>
        {face}
      </div>
      <Meter value={face} />
    </div>
  );
}

export function RerollCard({ context, board, viewer, nameOf, onSubmit, rerolled, onClose }: RerollCardProps) {
  const options = legalOf(context, 'intel-reroll');
  const name = (id: string) => shipName(board, id, viewer, nameOf).replace(/的船$/, '');
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (rerolled?.value == null) return;
    const timer = setTimeout(() => setLanded(true), TUMBLE_MS + 150);
    return () => clearTimeout(timer);
  }, [rerolled?.value]);

  return (
    <div className="beat-backdrop reroll-backdrop" role="dialog" aria-modal="true" aria-label="情報重擲">
      <div data-focus="reroll" className="beat-card reroll">
        <header className="beat-head">
          <span>只有你看得到</span>
          <strong className="reroll-title">
            <IconDisc src={roleIconUrl('intel')} badge />
            {rerolled ? '重擲' : '重擲？'}
          </strong>
        </header>
        <div className="reroll-dice">
          {context.view.intel
            .filter((k) => !rerolled || k.shipId === rerolled.shipId)
            .map((k) => (
              <div key={k.shipId} className="reroll-ship">
                <span className="chip">
                  <IconDisc src={tokenIconUrl('ship')} />
                  {name(k.shipId)}
                  {rerolled && (
                    <span className="chip-raw" title="原始骰值">
                      <IconDisc src={tokenIconUrl('dice')} />
                      {k.rawRoll}
                    </span>
                  )}
                </span>
                {rerolled ? (
                  <RollingDie raw={k.rawRoll} result={rerolled.value} />
                ) : (
                  <div className="beat-dice">
                    <div className="beat-die">{k.rawRoll}</div>
                    <Meter value={k.rawRoll} />
                  </div>
                )}
              </div>
            ))}
        </div>
        <footer className="beat-foot">
          <LockHint
            icon={<InfoIcon />}
            text={
              rerolled
                ? '重擲後必須接受新結果。之後還會加上護衛、海盜、航海事件與島嶼的修正。'
                : '1～3 沉沒、4～6 抵達，之後還會加上護衛、海盜、航海事件與島嶼的修正。重擲後必須接受新結果；現在還不知道航海事件和別人的角色。'
            }
          />
          {!rerolled &&
            options.map((a) => (
              // Same look for every choice: the card should not suggest an answer.
              <button key={a.rerollShipId ?? 'none'} type="button" onClick={() => onSubmit(a)}>
                {a.rerollShipId === null ? (
                  '不重擲'
                ) : (
                  <span className="reroll-pick">
                    <IconDisc src={tokenIconUrl('reroll')} />
                    {name(a.rerollShipId)}
                  </span>
                )}
              </button>
            ))}
          {rerolled && (
            <button type="button" className="primary" disabled={!landed} onClick={onClose}>
              繼續
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
