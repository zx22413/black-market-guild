import { useEffect, useMemo, useState } from 'react';
import { ScrollText } from './ScrollText';
import { type GoodId, type Goods, type RoleId, type ShipId } from '../../v07/game';
import { soundEngine } from '../audio/soundEngine';
import { ROLE_LABELS } from '../labels';
import { besideShip, type TablePin, type TableShip } from '../scene/TableCanvas';
import {
  blockedReason,
  deployActionFor,
  deployOptions,
  deployTodo,
  EMPTY_DEPLOY,
  goodsAtShip,
  guessesAtShip,
  needsNaming,
  needsTarget,
  pickRole,
  roleCards,
  targetsFor,
  type DeployChoice,
  type RolePick,
} from '../table/deployChoice';
import { ReminderDialog } from '../table/ReminderDialog';
import { isReminderSkipped, setReminderSkipped } from '../table/reminderSettings';
import { roleDetail } from '../table/roleText';
import { CargoChip, DeployChips } from './DeployChips';
import { ClockIcon, IconDisc, InfoIcon, tokenIconUrl, ForbidIcon } from './icons';
import { InfoTip } from './InfoTip';
import { LockHint } from './LockHint';
import { SealSubmit } from './SealSubmit';
import { roleIconUrl } from './RoleBadges';
import { ShipBets } from './ShipBets';
import { DashedArrows } from './RoleArrows';
import { pickArrows } from './revealModel';
import { shipName, type StageEnv, type StageParts } from './stage';
import { cardArtUrl } from './cardArt';

// Role deployment on the whole table (docs/ui/v07-event-presentation.md §1.4): pick a role card
// from the hand, then click the ship it goes to (customs then names a good, a diplomat guesses a role, in a list at the ship).
// What is still needed breathes gold; the submit button says what is being submitted.

const TAG_HEIGHT = 3;
const NO_CARGO: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };

export function useDeployStep(env: StageEnv | null): StageParts | null {
  const active = env?.request.context.decision.phase === 'role-deployment' ? env : null;
  const requestId = active?.request.id ?? null;
  const context = active?.request.context ?? null;
  const options = useMemo(() => (context ? deployOptions(context) : []), [context]);
  const [choice, setChoice] = useState<DeployChoice>(EMPTY_DEPLOY);
  const [reminding, setReminding] = useState<readonly string[] | null>(null);
  // The role card the pointer is on: the strip above the hand describes it (else the picked one). Only a mouse peeks by
  // hovering: on iOS a touch first counts as a hover, and a hover that adds to the page (the strip appearing) swallows the
  // click, so the first tap on a card would pick nothing. A tap peeks through focus instead.
  const [peek, setPeek] = useState<RolePick | null>(null);
  // On a short phone the description is only its header line until tapped (hudPhone.css), then a sheet over the table.
  const [stripOpen, setStripOpen] = useState(false);

  useEffect(() => {
    setChoice(EMPTY_DEPLOY);
    setReminding(null);
    setPeek(null);
    // Your turn to deploy: a soft call (a timer the cleanup cancels, so once).
    if (requestId === null) return undefined;
    const timer = setTimeout(() => soundEngine.playSfx('ui-turn'), 0);
    return () => clearTimeout(timer);
  }, [requestId]);

  // What the choice would submit, for whoever follows along (the tutorial lights 「提交」 when it fits).
  const draft = active ? (deployActionFor(options, choice) ?? null) : null;
  const onDraft = active?.onDraft;
  useEffect(() => onDraft?.(draft), [onDraft, draft]);

  if (!active || !context) return null;
  const { board, seats, angles, laneOf, viewer, nameOf, submit: submitAction } = active;
  const cargo = active.cargo ?? NO_CARGO;
  const cards = roleCards(context, options);
  const todo = deployTodo(choice);
  const naming = needsNaming(choice.role);
  const targets = new Set(targetsFor(options, choice.role));
  const action = deployActionFor(options, choice);
  const noDeploy = options.find((a) => a.role === null);
  const ownerOf = (id: ShipId) => board.ships.find((s) => s.id === id)?.owner;

  // A role card snaps into place with a bright click, like a ball dropping into a roulette pocket.
  const pick = (role: RolePick) => {
    if (role !== choice.role) soundEngine.playSfx('role-pick');
    setChoice(pickRole(role));
  };
  // Click a ship to send the role there; click it again to take the role back.
  const clickShip = (id: ShipId) => {
    if (id === choice.target) setChoice({ ...choice, target: null, good: null, guess: null });
    else if (targets.has(id)) setChoice({ ...choice, target: id, good: null, guess: null });
  };
  const nameGood = (good: GoodId) => setChoice({ ...choice, good: choice.good === good ? null : good });
  const guessRole = (role: RoleId) => setChoice({ ...choice, guess: choice.guess === role ? null : role });

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
  // the role's badge on the one picked (click it to take the role back), and a "no entry" sign on the ones the role cannot go to, saying why on
  // hover or tap. The ship's name shows on hover and is read out for screen readers. Each counts as
  // part of its owner's island for a highlight (the tutorial's focus).
  const pins: TablePin[] = board.ships.map((ship) => {
    const blocked = blockedReason(context, options, choice, ship.id);
    const pickable = targets.has(ship.id);
    const chosen = choice.target === ship.id;
    const label = shipName(board, ship.id, viewer, nameOf);
    const rim = seats[laneOf(ship.owner)]?.color ?? '#e0a63c';
    return {
      id: `ship-${ship.id}`,
      position: besideShip(angles[laneOf(ship.owner)]!, 'docked', 7, TAG_HEIGHT),
      node:
        chosen && naming === 'good' ? (
          <ShipBets
            kind="good"
            label={label}
            owner={ship.owner}
            rim={rim}
            badge={roleIconUrl('customs')}
            offered={goodsAtShip(options, ship.id)}
            chosen={choice.good}
            todo={todo.naming}
            onPick={nameGood}
            onBack={() => clickShip(ship.id)}
          />
        ) : chosen && naming === 'guess' ? (
          <ShipBets
            kind="guess"
            label={label}
            owner={ship.owner}
            rim={rim}
            badge={roleIconUrl('diplomat')}
            offered={guessesAtShip(options, ship.id)}
            chosen={choice.guess}
            todo={todo.naming}
            onPick={guessRole}
            onBack={() => clickShip(ship.id)}
          />
        ) : pickable ? (
          <button
            type="button"
            className={`dep-ship ${chosen ? 'on' : ''} ${todo.target ? 'todo' : ''}`}
            style={{ borderColor: rim }}
            data-label={chosen ? `${label}・點一下取消` : `派到${label}`}
            aria-label={`派到${label}`}
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

  // The reason behind a hand with nothing to pick: the first greyed card that is not about cooldown or cash.
  const noRoleReason = cards.every((c) => !c.legal) ? (cards.map((c) => c.reason).find((r) => r !== null && !r.startsWith('冷卻') && !r.startsWith('現金不足')) ?? null) : null;
  const shown = peek ?? choice.role;
  const shownCard = shown !== null && shown !== 'none' ? cards.find((c) => c.id === shown) : undefined;
  // The description strip sits above the hand, so the hand itself never moves: it describes the role pointed at or
  // picked, else it shows the cargo alone.
  const strip =
    shown === null ? (
      // Nothing pointed at yet: the strip still says what your ship carries, so a smuggler is chosen knowing it.
      <div className="dep-strip idle">
        <header>
          <b>你的船上</b>
          <CargoChip cargo={cargo} />
        </header>
        {/* Every role greyed (nobody's ship is in the voyage, say): the one reason, so the empty hand does not look like a fault. */}
        {noRoleReason && <p className="why">沒有角色可以選：{noRoleReason}，只能「不部署」。</p>}
      </div>
    ) : (
      <div className={`dep-strip ${stripOpen ? 'open' : ''}`} aria-live="polite" onClick={() => setStripOpen((v) => !v)}>
        {shown === 'none' && (
          <>
            <header>
              <b>不部署</b>
              <CargoChip cargo={cargo} />
            </header>
            <p>這回合不派角色，也不付部署費。</p>
          </>
        )}
        {shown !== 'none' && shownCard && (
          <>
            <header>
              <b>{ROLE_LABELS[shown]}</b>
              <span className="chip" title={`部署費 ${shownCard.fee} G`}>
                <IconDisc src={tokenIconUrl('coin')} />
                {shownCard.fee}
              </span>
              <span className="chip" title={`用過後冷卻 ${shownCard.cooldown} 回合`}>
                <ClockIcon />
                {shownCard.cooldown}
              </span>
              <CargoChip cargo={cargo} />
            </header>
            <ScrollText key={shown}>
              {shownCard.reason && <p className="why">{shownCard.reason}</p>}
              <p>{roleDetail(shown, context.view.rules)}</p>
            </ScrollText>
          </>
        )}
      </div>
    );

  const hand = (
    <div className={`dep-hand ${todo.role ? 'todo' : ''} ${choice.role !== null ? 'picked' : ''}`} onPointerLeave={(e) => e.pointerType === 'mouse' && setPeek(null)}>
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`dep-card ${choice.role === c.id ? 'on' : ''} ${c.legal ? '' : 'off'}`}
          data-role-card={c.id}
          data-done={choice.role === c.id}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setPeek(c.id)}
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
          <span className="dep-fee" title={`部署費 ${c.fee} G`}>
            <IconDisc src={tokenIconUrl('coin')} />
            {c.fee}
          </span>
        </button>
      ))}
      <button
        type="button"
        className={`dep-card none ${choice.role === 'none' ? 'on' : ''}`}
        data-role-card="none"
        data-done={choice.role === 'none'}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setPeek('none')}
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
  // What a submit seals: kept on the bar under the seal while the others decide.
  const chips = (
    <span className="bar-chips">
      <DeployChips
        role={choice.role}
        good={choice.good}
        guess={choice.guess}
        needsShip={needsTarget(choice.role)}
        target={targetOwner === undefined ? null : { name: nameOf(targetOwner), color: seats[laneOf(targetOwner)]?.color ?? '#999' }}
      />
    </span>
  );
  return {
    pins,
    camera: null,
    ship: (ship: TableShip): TableShip => ({ ...ship, selectable: targets.has(ship.id), chosen: choice.target === ship.id }),
    onSelectShip: clickShip,
    dim: true,
    scene:
      choice.role !== null && choice.role !== 'none' ? (
        <DashedArrows
          arrows={pickArrows(viewer, { role: choice.role, target: choice.target }, angles, laneOf, ownerOf)}
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
        {chips}
        <SealSubmit disabled={incomplete} glow={choice.role !== null} onClick={submit} />
        <LockHint icon={<InfoIcon />} text="提交後不能更改；所有人都提交後，角色一起公開。" />
      </>
    ),
    sealedChips: chips,
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
