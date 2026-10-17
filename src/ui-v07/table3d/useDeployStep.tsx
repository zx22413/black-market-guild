import { useEffect, useMemo, useState } from 'react';
import type { ShipId } from '../../v07/game';
import { ROLE_LABELS } from '../labels';
import { besideShip, type TablePin, type TableShip } from '../scene/TableCanvas';
import {
  EMPTY_DEPLOY,
  betsFor,
  brokerAims,
  deployActionFor,
  deployLabel,
  deployOptions,
  deployTodo,
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
import { LockHint } from './LockHint';
import { roleIconUrl } from './RoleBadges';
import { shipName, type StageEnv, type StageParts } from './stage';

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

  if (!active || !context) return null;
  const { board, angles, laneOf, viewer, nameOf, submit: submitAction } = active;
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
      else setReminding(['你還沒選角色：這回合不部署。']);
    } else send();
  };

  // A tag over every ship at sea: whose it is; while choosing a target, the ones you may pick.
  const pins: TablePin[] = board.ships.map((ship) => {
    const peekable = choice.target !== null && peeks.has(ship.id);
    const pickable = targets.has(ship.id) && !peekable;
    const chosen = choice.target === ship.id;
    const label = shipName(board, ship.id, viewer, nameOf);
    return {
      id: `ship-${ship.id}`,
      position: besideShip(angles[laneOf(ship.owner)]!, 'docked', 7, TAG_HEIGHT),
      node:
        pickable || peekable ? (
          <button
            type="button"
            title={peekable ? '燈塔島：可多看一艘船，可不選' : undefined}
            className={`dep-ship ${chosen || choice.peek === ship.id ? 'on' : ''} ${(todo.target && pickable) ? 'todo' : ''} ${peekable ? 'peek' : ''}`}
            onClick={() => clickShip(ship.id)}
          >
            {peekable ? `多看 ${label}` : chosen ? `${ROLE_LABELS[choice.role as keyof typeof ROLE_LABELS]} → ${label}` : `派到${label}`}
          </button>
        ) : (
          <span className="dep-ship-name">{label}</span>
        ),
    };
  });

  const shown = peek ?? choice.role;
  const shownCard = shown !== null && shown !== 'none' ? cards.find((c) => c.id === shown) : undefined;
  // The description strip keeps its height whatever it says, so the hand never jumps.
  const strip = (
    <div className={`dep-strip ${shown === null ? 'idle' : ''}`} aria-live="polite">
      {shown === null && <p>點選角色看說明</p>}
      {shown === 'none' && (
        <>
          <header>
            <b>不部署</b>
          </header>
          <p>這回合不派角色，也不付部署費。</p>
        </>
      )}
      {shown !== null && shown !== 'none' && shownCard && (
        <>
          <header>
            <b>{ROLE_LABELS[shown]}</b>
            <span>{shownCard.fee === 0 ? '免費' : `部署費 ${shownCard.fee} G`}</span>
            <span>冷卻 {shownCard.cooldown} 回合</span>
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
          onMouseEnter={() => setPeek(c.id)}
          onFocus={() => setPeek(c.id)}
          onBlur={() => setPeek(null)}
          aria-disabled={!c.legal}
          onClick={() => c.legal && pick(c.id)}
        >
          <span className="dep-ic">
            <img src={roleIconUrl(c.id)} alt="" />
          </span>
          <b>{ROLE_LABELS[c.id]}</b>
          <span className="dep-fee">{c.fee === 0 ? '免費' : `${c.fee} G`}</span>
        </button>
      ))}
      <button
        type="button"
        className={`dep-card none ${choice.role === 'none' ? 'on' : ''}`}
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
  const barText =
    choice.role === null ? '選一個角色' : choice.role === 'none' ? '不部署' : deployLabel(choice, ownerOf, nameOf, viewer, aims).replace(/^部署：/, '');
  return {
    pins,
    camera: null,
    ship: (ship: TableShip): TableShip => ({ ...ship, selectable: targets.has(ship.id) || peeks.has(ship.id), chosen: choice.target === ship.id || choice.peek === ship.id }),
    onSelectShip: clickShip,
    dim: true,
    ...(choice.role === 'broker' ? { bets: { offered: betsFor(options), chosen: choice.bet, todo: todo.bet, onBet: (bet) => setChoice({ ...choice, bet, target: choice.target !== null && targetsFor(options, 'broker', bet).includes(choice.target) ? choice.target : null }) } } : {}),
    scene: null,
    dock: (
      <>
        {strip}
        {hand}
      </>
    ),
    bar: (
      <>
        <span className="bar-chips">
          <span className="chip">{barText}</span>
        </span>
        <button type="button" className="primary" disabled={incomplete} onClick={submit}>
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
