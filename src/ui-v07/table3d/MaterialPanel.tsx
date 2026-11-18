import { useState } from 'react';
import { GOODS, type GoodId, type MaterialAction } from '../../v07/game';
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
// is gone; a tradehouse owner names the protected good here. (Ship skills are opened on the ship's own card, in the
// ship pick: ShipPicker's SkillRow.)

const facilityArt = (id: string): string => `${import.meta.env.BASE_URL}art/v08/facility-${id}.png`;
const same = (a: MaterialAction | null, b: MaterialAction): boolean =>
  a !== null && a.kind === b.kind && (a.kind === 'build' ? b.kind === 'build' && a.building === b.building : b.kind !== 'build' && a.ship === b.ship);

export interface MaterialPanelProps {
  readonly cards: readonly MaterialCard[];
  readonly chosen: MaterialAction | null;
  readonly onPick: (material: MaterialAction | null) => void;
  /** The player's building stands already: no building is offered any more. */
  readonly built: boolean;
  /** Goods a tradehouse owner may protect (empty: no tradehouse), the one named, and the setter. */
  readonly protects: readonly GoodId[];
  readonly protect: GoodId | null;
  readonly onProtect: (good: GoodId) => void;
}

export function MaterialPanel({ cards, chosen, onPick, built, protects, protect, onProtect }: MaterialPanelProps) {
  const rules = useRules();
  const [open, setOpen] = useState(false);
  const builds = cards.filter((c) => c.material.kind === 'build');
  // A building stands already (one per match): nothing left to offer.
  const offer = !built;
  const picked = chosen?.kind === 'build' ? chosen.building : null;
  const card = (c: MaterialCard) => {
    const m = c.material;
    if (m.kind !== 'build') return null;
    const name = FACILITY_LABELS[m.building];
    const text = facilityText(rules, m.building);
    const shield = facilityShield(rules, m.building);
    const on = same(chosen, m);
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
            {c.reason && <small className="mat-why">{c.reason}</small>}
          </span>
        </span>
      </button>
    );
  };
  if ((!offer || builds.length === 0) && protects.length === 0) return null;
  return (
    <aside className={`mat-panel ${open ? '' : 'shut'}`} data-focus="materials">
      {offer && builds.length > 0 && (
        <button type="button" className={`mat-head ${picked ? 'sel' : ''}`} aria-expanded={open} aria-label={open ? '收起建築' : '展開建築'} onClick={() => setOpen((v) => !v)}>
          <b>{picked ? `蓋 ${FACILITY_LABELS[picked]}` : '蓋建築'}</b>
          <small>一局 {rules.v08.maxBuildings} 棟</small>
          <span className="mat-fold">{open ? <CloseIcon /> : '＋'}</span>
        </button>
      )}
      {protects.length > 0 && (
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
