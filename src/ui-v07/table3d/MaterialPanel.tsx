import { useState } from 'react';
import { GOODS, type GoodId, type MaterialAction } from '../../v07/game';
import { GOOD_LABELS, SHIP_TYPE_LABELS } from '../labels';
import type { MaterialCard } from '../table/investChoice';
import { FACILITY_LABELS, SKILL_LABELS, facilityShield, facilityText, skillText } from '../table/v08Text';
import { GoodCount, GoodIcon } from './GoodIcon';
import { CloseIcon } from './icons';
import { useRules } from './rulesContext';
import './materialPanel.css';

// V0.8 prototype (an experiment, not rules): the one material action of the round, beside the island while loading.
// Two shelves, buildings (one per match) and ship skills (two at most); a card shows the picture, the name, what it
// costs in crates and what it does. Picking one again takes it back. A tradehouse owner names the protected good here.

const facilityArt = (id: string): string => `${import.meta.env.BASE_URL}art/v08/facility-${id}.png`;
const shipArt = (id: string): string => `${import.meta.env.BASE_URL}art/cards/ship-${id}.svg`;
const same = (a: MaterialAction | null, b: MaterialAction): boolean =>
  a !== null && a.kind === b.kind && (a.kind === 'build' ? b.kind === 'build' && a.building === b.building : b.kind !== 'build' && a.ship === b.ship);

export interface MaterialPanelProps {
  readonly cards: readonly MaterialCard[];
  readonly chosen: MaterialAction | null;
  readonly onPick: (material: MaterialAction | null) => void;
  /** Goods a tradehouse owner may protect (empty: no tradehouse), the one named, and the setter. */
  readonly protects: readonly GoodId[];
  readonly protect: GoodId | null;
  readonly onProtect: (good: GoodId) => void;
}

export function MaterialPanel({ cards, chosen, onPick, protects, protect, onProtect }: MaterialPanelProps) {
  const rules = useRules();
  const [open, setOpen] = useState(true);
  const builds = cards.filter((c) => c.material.kind === 'build');
  const skills = cards.filter((c) => c.material.kind !== 'build');
  const card = (c: MaterialCard) => {
    const m = c.material;
    const build = m.kind === 'build';
    const name = build ? FACILITY_LABELS[m.building] : `${SHIP_TYPE_LABELS[m.ship]}・${SKILL_LABELS[m.ship]}`;
    const text = build ? facilityText(rules, m.building) : skillText(rules, m.ship);
    const shield = build ? facilityShield(rules, m.building) : null;
    const on = same(chosen, m);
    return (
      <button
        type="button"
        key={build ? m.building : m.ship}
        className={`mat-card ${build ? 'build' : 'skill'} ${c.legal ? '' : 'no'} ${on ? 'sel' : ''}`}
        data-focus={`material-${build ? m.building : m.ship}`}
        disabled={!c.legal && !on}
        aria-pressed={on}
        aria-label={`${name}：${text}${shield ? `；${shield}` : ''}`}
        onClick={() => onPick(on ? null : m)}
      >
        <span className="mat-art">
          <img src={build ? facilityArt(m.building) : shipArt(m.ship)} alt="" />
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
  if (cards.length === 0 && protects.length === 0) return null;
  return (
    <aside className={`mat-panel ${open ? '' : 'shut'}`} data-focus="materials">
      <header>
        <b>材料動作</b>
        <small>每回合最多 1 個</small>
        <button type="button" className="mat-fold" aria-label={open ? '收起材料動作' : '展開材料動作'} onClick={() => setOpen((v) => !v)}>
          {open ? <CloseIcon /> : '＋'}
        </button>
      </header>
      {open && (
        <>
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
          <small className="mat-shelf">建築（一局 {rules.v08.maxBuildings} 棟）</small>
          <div className="mat-row">{builds.map(card)}</div>
          <small className="mat-shelf">船技能（最多 {rules.v08.maxSkills} 艘）</small>
          <div className="mat-row skills">{skills.map(card)}</div>
        </>
      )}
    </aside>
  );
}
