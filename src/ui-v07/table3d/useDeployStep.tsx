import { useEffect, useMemo, useState } from 'react';
import type { ShipId } from '../../v07/game';
import { shipPose } from '../../ui/scene/Ships';
import { ROLE_LABELS, ROLE_TEXT } from '../labels';
import type { TablePin, TableShip } from '../scene/TableCanvas';
import {
  EMPTY_DEPLOY,
  betsFor,
  deployActionFor,
  deployLabel,
  deployOptions,
  deployTodo,
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
import { shipName, type StageEnv, type StageParts } from './stage';

// Role deployment on the whole table (docs/ui/v07-event-presentation.md §1.4): pick a role card
// from the hand, then click the ship it goes to (or, for the broker, 漲／跌 on the market strip).
// What is still needed breathes gold; the submit button says what is being submitted.

const TAG_HEIGHT = 7;

export function useDeployStep(env: StageEnv | null): StageParts | null {
  const active = env?.request.context.decision.phase === 'role-deployment' ? env : null;
  const requestId = active?.request.id ?? null;
  const context = active?.request.context ?? null;
  const options = useMemo(() => (context ? deployOptions(context) : []), [context]);
  const [choice, setChoice] = useState<DeployChoice>(EMPTY_DEPLOY);
  const [reminding, setReminding] = useState<readonly string[] | null>(null);

  useEffect(() => {
    setChoice(EMPTY_DEPLOY);
    setReminding(null);
  }, [requestId]);

  if (!active || !context) return null;
  const { board, angles, laneOf, viewer, nameOf, submit: submitAction } = active;
  const cards = roleCards(context, options);
  const todo = deployTodo(choice);
  const targets = new Set(targetsFor(options, choice.role));
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
    const pose = shipPose(angles[laneOf(ship.owner)]!, 'docked');
    const peekable = choice.target !== null && peeks.has(ship.id);
    const pickable = targets.has(ship.id) && !peekable;
    const chosen = choice.target === ship.id;
    const label = shipName(board, ship.id, viewer, nameOf);
    return {
      id: `ship-${ship.id}`,
      position: [pose.position.x, TAG_HEIGHT, pose.position.z],
      node:
        pickable || peekable ? (
          <button
            type="button"
            className={`dep-ship ${chosen || choice.peek === ship.id ? 'on' : ''} ${(todo.target && pickable) ? 'todo' : ''} ${peekable ? 'peek' : ''}`}
            onClick={() => clickShip(ship.id)}
          >
            {peekable ? `多看這艘（燈塔島，可不選）：${label}` : chosen ? `${ROLE_LABELS[choice.role as keyof typeof ROLE_LABELS]} → ${label}` : `派到${label}`}
          </button>
        ) : (
          <span className="dep-ship-name">{label}</span>
        ),
    };
  });

  const hand = (
    <div className={`dep-hand ${todo.role ? 'todo' : ''}`}>
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`dep-card ${choice.role === c.id ? 'on' : ''} ${c.legal ? '' : 'off'}`}
          disabled={!c.legal}
          onClick={() => pick(c.id)}
        >
          <b>{ROLE_LABELS[c.id]}</b>
          <span className="dep-fee">{c.fee === 0 ? '免費' : `${c.fee} G`}</span>
          <small>{c.reason ?? ROLE_TEXT[c.id]}</small>
        </button>
      ))}
      <button type="button" className={`dep-card none ${choice.role === 'none' ? 'on' : ''}`} onClick={() => pick('none')}>
        <b>不部署</b>
        <small>這回合不派角色。</small>
      </button>
    </div>
  );

  const fee = choice.role && choice.role !== 'none' ? (cards.find((c) => c.id === choice.role)?.fee ?? 0) : 0;
  const incomplete = choice.role !== null && !action;
  return {
    pins,
    camera: null,
    ship: (ship: TableShip): TableShip => ({ ...ship, selectable: targets.has(ship.id) || peeks.has(ship.id), chosen: choice.target === ship.id || choice.peek === ship.id }),
    onSelectShip: clickShip,
    ...(choice.role === 'broker' ? { bets: { offered: betsFor(options), chosen: choice.bet, todo: todo.bet, onBet: (bet) => setChoice({ ...choice, bet }) } } : {}),
    scene: null,
    dock: hand,
    bar: (
      <>
        <span>
          {choice.role === null
            ? '秘密選一個角色（所有人同時選，情報重擲後一起公開）'
            : choice.role === 'none'
              ? '這回合不部署。'
              : `${ROLE_LABELS[choice.role]}：部署費 ${fee} G，角色揭露時才扣。${needsTarget(choice.role) ? '點海上的船選目標。' : '在上方黑市選商品與漲跌。'}`}
        </span>
        <button type="button" className="primary" disabled={incomplete} onClick={submit}>
          {deployLabel(choice, ownerOf, nameOf, viewer)}
        </button>
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
