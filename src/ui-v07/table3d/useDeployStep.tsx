import { useEffect, useMemo, useState } from 'react';
import type { ShipId } from '../../v07/game';
import { ROLE_LABELS } from '../labels';
import { besideShip, type TablePin, type TableShip } from '../scene/TableCanvas';
import {
  betLabel,
  betsFor,
  blockedReason,
  brokerAims,
  deployActionFor,
  deployOptions,
  deployTodo,
  EMPTY_DEPLOY,
  needsTarget,
  peeksFor,
  pickRole,
  roleCards,
  targetsFor,
  type DeployChoice,
  type RolePick,
} from '../table/deployChoice';
import { ReminderDialog } from '../table/ReminderDialog';
import { isReminderSkipped, setReminderSkipped } from '../table/reminderSettings';
import { roleDetail } from '../table/roleText';
import { DeployChips } from './DeployChips';
import { ClockIcon, IconDisc, tokenIconUrl, ForbidIcon } from './icons';
import { InfoTip } from './InfoTip';
import { LockHint } from './LockHint';
import { roleIconUrl } from './RoleBadges';
import { DashedArrows } from './RoleArrows';
import { pickArrows } from './revealModel';
import { shipName, type StageEnv, type StageParts } from './stage';
import { cardArtUrl } from './cardArt';

// Role deployment on the whole table (docs/ui/v07-event-presentation.md §1.4): pick a role card
// from the hand, then click the ship it goes to (or, for the broker, 漲／跌 on the market strip).
// What is still needed breathes gold; the submit button says what is being submitted.

const TAG_HEIGHT = 3;

export function useDeployStep(env: StageEnv | null): StageParts | null {
  const active = env?.request.context.decision.phase === 'role-deployment' ? env : null;
  const requestId = active?.request.id ?? null;
  const context = active?.request.context ?? null;
  const options = useMemo(() => (context ? deployOptions(context) : []), [context]);
  const [choice, setChoice] = useState<DeployChoice>(EMPTY_DEPLOY);
  const [reminding, setReminding] = useState<readonly string[] | null>(null);
  // The role card the pointer is on: the strip above the hand describes it (else the picked one).
  const [peek, setPeek] = useState<RolePick | null>(null);

  useEffect(() => {
    setChoice(EMPTY_DEPLOY);
    setReminding(null);
    setPeek(null);
  }, [requestId]);

  // What the choice would submit, for whoever follows along (the tutorial lights 「提交」 when it fits).
  const draft = active ? (deployActionFor(options, choice) ?? null) : null;
  const onDraft = active?.onDraft;
  useEffect(() => onDraft?.(draft), [onDraft, draft]);

  if (!active || !context) return null;
  const { board, seats, angles, laneOf, viewer, nameOf, submit: submitAction } = active;
  const cards = roleCards(context, options);
  const aims = brokerAims(options, choice.bet);
  const todo = deployTodo(choice, aims);
  const targets = new Set(targetsFor(options, choice.role, choice.bet));
  const peeks = new Set(choice.role === 'intel' && choice.target ? peeksFor(options, choice) : []);
  const action = deployActionFor(options, choice);
  const noDeploy = options.find((a) => a.role === null);
  const ownerOf = (id: ShipId) => board.ships.find((s) => s.id === id)?.owner;

  const pick = (role: RolePick) => setChoice(pickRole(role));
  // Click a ship to send the role there; click it again to take the role back. A lighthouse intel
  // merchant's next click on another ship is the optional second look (§11.2).
  const clickShip = (id: ShipId) => {
    if (id === choice.target) setChoice({ ...choice, target: null, peek: null });
    else if (choice.target !== null && peeks.has(id)) setChoice({ ...choice, peek: choice.peek === id ? null : id });
    else if (targets.has(id)) setChoice({ ...choice, target: id, peek: null });
  };

  const send = (a = action) => {
    if (!a) return;
    setReminding(null);
    submitAction(a);
  };
  // Nothing picked: "不部署" is a real choice, so make sure it is meant.
  const submit = () => {
    if (choice.role === null) {
      if (isReminderSkipped('deploy-unfinished')) send(noDeploy);
      else setReminding(['還沒選角色：會不部署']);
    } else send();
  };

  // A round button over every ship: a "+" on the ones you may pick (the owner's color on its rim),
  // the role's badge on the one picked (click it to take the role back), a faint "+" for the
  // lighthouse's extra look, and a "no entry" sign on the ones the role cannot go to, saying why on
  // hover or tap. The ship's name shows on hover and is read out for screen readers. Each counts as
  // part of its owner's island for a highlight (the tutorial's focus).
  const pins: TablePin[] = board.ships.map((ship) => {
    const blocked = blockedReason(context, options, choice, ship.id);
    const peekable = choice.target !== null && peeks.has(ship.id);
    const pickable = targets.has(ship.id) && !peekable;
    const chosen = choice.target === ship.id;
    const label = shipName(board, ship.id, viewer, nameOf);
    const rim = seats[laneOf(ship.owner)]?.color ?? '#e0a63c';
    return {
      id: `ship-${ship.id}`,
      position: besideShip(angles[laneOf(ship.owner)]!, 'docked', 7, TAG_HEIGHT),
      node:
        pickable || peekable ? (
          <button
            type="button"
            className={`dep-ship ${chosen || choice.peek === ship.id ? 'on' : ''} ${(todo.target && pickable) ? 'todo' : ''} ${peekable ? 'peek' : ''}`}
            style={{ borderColor: peekable ? undefined : rim }}
            data-label={peekable ? `多看 ${label}（可不選）` : chosen ? `${label}・點一下取消` : `派到${label}`}
            aria-label={peekable ? `多看 ${label}` : `派到${label}`}
            data-focus={`island-${ship.owner}`}
            data-target={ship.owner}
            data-done={chosen}
            onClick={() => clickShip(ship.id)}
          >
            {chosen && choice.role !== null && choice.role !== 'none' ? <img src={roleIconUrl(choice.role)} alt="" /> : '＋'}
          </button>
        ) : blocked ? (
          <InfoTip title={`不能派到${label}`} text={blocked}>
            <span className="dep-ship off" role="img" aria-label={`不能派到${label}：${blocked}`} data-focus={`island-${ship.owner}`}>
              <ForbidIcon />
            </span>
          </InfoTip>
        ) : (
          <span className="dep-ship-name" data-focus={`island-${ship.owner}`}>
            {label}
          </span>
        ),
    };
  });

  const shown = peek ?? choice.role;
  const shownCard = shown !== null && shown !== 'none' ? cards.find((c) => c.id === shown) : undefined;
  // The description strip is only there while a role is pointed at or picked; it sits above the
  // hand, so the hand itself never moves.
  const strip =
    shown === null ? null : (
      <div className="dep-strip" aria-live="polite">
        {shown === 'none' && (
          <>
            <header>
              <b>不部署</b>
            </header>
            <p>這回合不派角色，也不付部署費。</p>
          </>
        )}
        {shown !== 'none' && shownCard && (
          <>
            <header>
              <b>{ROLE_LABELS[shown]}</b>
              <span className="chip" title={shownCard.fee === 0 ? '免費' : `部署費 ${shownCard.fee} G`}>
                <IconDisc src={tokenIconUrl('coin')} />
                {shownCard.fee === 0 ? '免費' : shownCard.fee}
              </span>
              <span className="chip" title={`用過後冷卻 ${shownCard.cooldown} 回合`}>
                <ClockIcon />
                {shownCard.cooldown}
              </span>
            </header>
            {shownCard.reason && <p className="why">{shownCard.reason}</p>}
            <p>{roleDetail(shown, context.view.rules)}</p>
          </>
        )}
      </div>
    );

  const hand = (
    <div className={`dep-hand ${todo.role ? 'todo' : ''} ${choice.role !== null ? 'picked' : ''}`} onMouseLeave={() => setPeek(null)}>
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`dep-card ${choice.role === c.id ? 'on' : ''} ${c.legal ? '' : 'off'}`}
          data-role-card={c.id}
          data-done={choice.role === c.id}
          onMouseEnter={() => setPeek(c.id)}
          onFocus={() => setPeek(c.id)}
          onBlur={() => setPeek(null)}
          aria-disabled={!c.legal}
          // A greyed card says why on a tap too (touch browsers do not always focus a tapped button).
          onClick={() => (c.legal ? pick(c.id) : setPeek(c.id))}
        >
          {!c.legal && (
            <span className="dep-card-off" aria-hidden="true">
              <ForbidIcon />
            </span>
          )}
          <span className="dep-ic">
            <img src={cardArtUrl({ kind: 'role', id: c.id })} alt="" />
          </span>
          <b>{ROLE_LABELS[c.id]}</b>
          <span className="dep-fee" title={c.fee === 0 ? '免費' : `部署費 ${c.fee} G`}>
            {c.fee === 0 ? (
              '免費'
            ) : (
              <>
                <IconDisc src={tokenIconUrl('coin')} />
                {c.fee}
              </>
            )}
          </span>
        </button>
      ))}
      <button
        type="button"
        className={`dep-card none ${choice.role === 'none' ? 'on' : ''}`}
        data-role-card="none"
        data-done={choice.role === 'none'}
        onMouseEnter={() => setPeek('none')}
        onFocus={() => setPeek('none')}
        onBlur={() => setPeek(null)}
        onClick={() => pick('none')}
      >
        <span className="dep-ic none">✕</span>
        <b>不部署</b>
        <span className="dep-fee">&nbsp;</span>
      </button>
    </div>
  );

  const incomplete = choice.role !== null && !action;
  const targetOwner = choice.target === null ? undefined : ownerOf(choice.target);
  return {
    pins,
    camera: null,
    ship: (ship: TableShip): TableShip => ({ ...ship, selectable: targets.has(ship.id) || peeks.has(ship.id), chosen: choice.target === ship.id || choice.peek === ship.id }),
    onSelectShip: clickShip,
    dim: true,
    ...(choice.role === 'broker' ? { bets: { offered: betsFor(options), chosen: choice.bet, todo: todo.bet, onBet: (bet) => setChoice({ ...choice, bet, target: choice.target !== null && targetsFor(options, 'broker', bet).includes(choice.target) ? choice.target : null }) } } : {}),
    scene:
      choice.role !== null && choice.role !== 'none' ? (
        <DashedArrows
          arrows={pickArrows(viewer, { role: choice.role, target: choice.target, peek: choice.peek, bet: choice.bet }, angles, laneOf, ownerOf)}
          color={seats[laneOf(viewer)]?.color ?? '#e0a63c'}
        />
      ) : null,
    dock: (
      <>
        {strip}
        {hand}
      </>
    ),
    bar: (
      <>
        <span className="bar-chips">
          <DeployChips
            role={choice.role}
            bet={choice.bet}
            needsShip={needsTarget(choice.role, aims)}
            target={targetOwner === undefined ? null : { name: nameOf(targetOwner), color: seats[laneOf(targetOwner)]?.color ?? '#999' }}
          />
        </span>
        <button type="button" className="primary" data-focus="submit" disabled={incomplete} onClick={submit}>
          提交
        </button>
        <LockHint text="提交後不能更改；所有人都提交後，角色一起公開（情報商人重擲後再公開）。" />
      </>
    ),
    overlay: reminding && (
      <ReminderDialog
        title="還沒選角色"
        lines={reminding}
        onBack={() => setReminding(null)}
        onConfirm={(skipNext) => {
          if (skipNext) setReminderSkipped('deploy-unfinished', true);
          send(noDeploy);
        }}
      />
    ),
  };
}
