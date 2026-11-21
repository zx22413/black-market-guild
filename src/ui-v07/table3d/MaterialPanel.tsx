import { useState } from 'react';
import { GOODS, type GoodId, type MaterialAction, type V08BuildingId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import type { MaterialCard } from '../table/investChoice';
import { FACILITY_LABELS, facilityShield, facilityText } from '../table/v08Text';
import { GoodCount, GoodIcon } from './GoodIcon';
import { CloseIcon } from './icons';
import { useRules } from './rulesContext';
import './materialPanel.css';

// V0.8 prototype (an experiment, not rules): the building of the match, beside the ship while loading. Folded to one
// button until asked for, so the cargo cards are the only thing calling for a click; a card shows the picture, the
// name, what it costs in crates and what it does. Picking one again takes it back. Once a building stands the button
// is gone and the building that stands takes its place (what it is and does), so it can always be looked up; a
// tradehouse owner names the protected good here. (Ship skills are opened on the ship's own card, in the ship pick:
// ShipPicker's SkillRow.)
// While the ship is picked the panel is there to read only (`readOnly`): the building that stands, or the three that
// can be raised and what they cost; building is done while loading.

const facilityArt = (id: string): string => `${import.meta.env.BASE_URL}art/v08/facility-${id}.png`;
const same = (a: MaterialAction | null, b: MaterialAction): boolean =>
  a !== null && a.kind === b.kind && (a.kind === 'build' ? b.kind === 'build' && a.building === b.building : b.kind !== 'build' && a.ship === b.ship);

export interface MaterialPanelProps {
  readonly cards: readonly MaterialCard[];
  readonly chosen: MaterialAction | null;
  readonly onPick: (material: MaterialAction | null) => void;
  /** The player's building, once it stands: no building is offered any more, this one is shown. */
  readonly owned: V08BuildingId | null;
  /** The ship pick: the buildings can be read, not picked (they are raised while loading). */
  readonly readOnly?: boolean;
  /** The camera is at the island's building lot (the close-up), and the switch that sends it there or back to the ship. */
  readonly looking?: boolean;
  readonly onLook?: (on: boolean) => void;
  /** Goods a tradehouse owner may protect (empty: no tradehouse), the one named, and the setter. */
  readonly protects: readonly GoodId[];
  readonly protect: GoodId | null;
  readonly onProtect: (good: GoodId) => void;
}

export function MaterialPanel({ cards, chosen, onPick, owned, protects, protect, onProtect, readOnly = false, looking = false, onLook }: MaterialPanelProps) {
  const rules = useRules();
  const [open, setOpen] = useState(false);
  const builds = cards.filter((c) => c.material.kind === 'build');
  // A building stands already (one per match): nothing left to offer.
  const offer = owned === null;
  const picked = chosen?.kind === 'build' ? chosen.building : null;
  const card = (c: MaterialCard) => {
    const m = c.material;
    if (m.kind !== 'build') return null;
    const name = FACILITY_LABELS[m.building];
    const text = facilityText(rules, m.building);
    const shield = facilityShield(rules, m.building);
    const on = same(chosen, m);
    const body = (
      <>
        <span className="mat-art">
          <img src={facilityArt(m.building)} alt="" />
        </span>
        <span className="mat-body">
          <b>{name}</b>
          <span className="mat-text">{text}</span>
          {shield && <span className="mat-shield">{shield}</span>}
          <span className="mat-cost">
            {GOODS.filter((g) => c.cost[g] > 0).map((g) => (
              <GoodCount key={g} good={g} count={c.cost[g]} size="sm" />
            ))}
            {!readOnly && c.reason && <small className="mat-why">{c.reason}</small>}
          </span>
        </span>
      </>
    );
    if (readOnly) {
      return (
        <div key={m.building} className={`mat-card build info ${on ? 'sel' : ''}`} aria-label={`${name}：${text}${shield ? `；${shield}` : ''}`}>
          {body}
        </div>
      );
    }
    return (
      <button
        type="button"
        key={m.building}
        className={`mat-card build ${c.legal ? '' : 'no'} ${on ? 'sel' : ''}`}
        data-focus={`material-${m.building}`}
        disabled={!c.legal && !on}
        aria-pressed={on}
        aria-label={`${name}：${text}${shield ? `；${shield}` : ''}`}
        onClick={() => onPick(on ? null : m)}
      >
        {body}
      </button>
    );
  };
  // The switch between the ship and the close-up of the building (the one that stands, or the one picked to be raised).
  const look = onLook && (
    <button type="button" className={`mat-look ${looking ? 'on' : ''}`} aria-pressed={looking} onClick={() => onLook(!looking)}>
      {looking ? '回到船' : '看建築'}
    </button>
  );
  const ownBody = owned && (
    <>
      <span className="mat-art">
        <img src={facilityArt(owned)} alt="" />
      </span>
      <span className="mat-body">
        <span className="mat-name">
          <b>{FACILITY_LABELS[owned]}</b>
          {facilityShield(rules, owned) && <span className="mat-shield">{facilityShield(rules, owned)}</span>}
        </span>
        <span className="mat-text">{facilityText(rules, owned)}</span>
      </span>
    </>
  );
  const standing = owned && (
    <div className="mat-own">
      <span className="mat-cap-row">
        <small className="mat-cap">你的建築</small>
        {look}
      </span>
      {/* The card itself goes to the close-up too. */}
      {onLook ? (
        <button type="button" className={`mat-card own ${looking ? 'sel' : ''}`} aria-label={`${FACILITY_LABELS[owned]}：看建築特寫`} onClick={() => onLook(true)}>
          {ownBody}
        </button>
      ) : (
        <div className="mat-card own">{ownBody}</div>
      )}
    </div>
  );
  // Nothing built yet and one can be raised now: the folded button breathes, so the building is not missed.
  const nudge = !readOnly && offer && !picked && !open && builds.some((c) => c.legal);
  if (!standing && builds.length === 0 && protects.length === 0) return null;
  const title = picked ? `蓋 ${FACILITY_LABELS[picked]}` : readOnly ? '可蓋的建築' : '蓋建築';
  return (
    <aside className={`mat-panel ${open || standing ? '' : 'shut'} ${open && offer ? 'listing' : ''} ${nudge ? 'nudge' : ''}`} data-focus="materials">
      {standing}
      {offer && builds.length > 0 && (
        <button type="button" className={`mat-head ${picked ? 'sel' : ''}`} aria-expanded={open} aria-label={open ? '收起建築' : '展開建築'} onClick={() => setOpen((v) => !v)}>
          <b>{title}</b>
          <small>{readOnly ? '裝貨時蓋' : `一局 ${rules.v08.maxBuildings} 棟`}</small>
          <span className="mat-fold">{open ? <CloseIcon /> : '＋'}</span>
        </button>
      )}
      {!readOnly && offer && picked && look && <span className="mat-cap-row pick">{look}</span>}
      {!readOnly && protects.length > 0 && (
        <div className="mat-protect">
          <small>商行這回合保護的貨</small>
          <span>
            {protects.map((g) => (
              <button type="button" key={g} className={protect === g ? 'sel' : ''} aria-pressed={protect === g} aria-label={`保護${GOOD_LABELS[g]}`} onClick={() => onProtect(g)}>
                <GoodIcon good={g} size="sm" tip={false} />
              </button>
            ))}
          </span>
        </div>
      )}
      {open && offer && <div className="mat-row">{builds.map(card)}</div>}
    </aside>
  );
}
