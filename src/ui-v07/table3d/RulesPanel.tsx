import { useEffect, useState } from 'react';
import { GOODS, RULES_V07, type BuildingId, type IslandId, type RoleId, type VoyageEventId } from '../../v07/game';
import { BUILDING_LABELS, BUILDING_TEXT, GOOD_LABELS, ISLAND_LABELS, ISLAND_TEXT, ROLE_LABELS, VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT, WEALTH_RULE_TEXT } from '../labels';
import { goodDetail, marketRule } from '../table/goodText';
import { roleDetail } from '../table/roleText';
import { GoodIcon } from './GoodIcon';
import { CloseIcon, IconDisc } from './icons';
import { IslandGlance } from './IslandGlance';
import { roleIconUrl } from './RoleBadges';

// The rules, for looking things up: one tab per kind of thing. Every sentence comes from the texts
// the table already uses (labels.ts, roleText.ts, goodText.ts), so the panel can never say something else.

export type RulesTab = 'roles' | 'islands' | 'buildings' | 'goods' | 'events' | 'score';

export const RULES_TABS: readonly { readonly id: RulesTab; readonly label: string }[] = [
  { id: 'roles', label: '角色' },
  { id: 'islands', label: '島嶼' },
  { id: 'buildings', label: '建築' },
  { id: 'goods', label: '貨品' },
  { id: 'events', label: '事件' },
  { id: 'score', label: '計分' },
];

const keysOf = <K extends string>(record: Readonly<Record<K, unknown>>): K[] => Object.keys(record) as K[];

/** The entries of one tab, as `<li>`s (also used by the skin lab's rule book, dev/SkinLabBook.tsx). */
export function RulesEntries({ tab }: { readonly tab: RulesTab }) {
  switch (tab) {
    case 'roles':
      return (
        <>
          {keysOf<RoleId>(ROLE_LABELS).map((role) => (
            <li key={role}>
              <b>
                <IconDisc src={roleIconUrl(role)} badge />
                {ROLE_LABELS[role]}
              </b>
              <p>{roleDetail(role, RULES_V07)}</p>
            </li>
          ))}
        </>
      );
    case 'islands':
      return (
        <>
          {keysOf<IslandId>(ISLAND_LABELS).map((island) => (
            <li key={island}>
              <b>{ISLAND_LABELS[island]}</b>
              <IslandGlance island={island} />
              <p>
                {ISLAND_TEXT[island].pro}。{ISLAND_TEXT[island].con}。
              </p>
            </li>
          ))}
        </>
      );
    case 'buildings':
      return (
        <>
          {keysOf<BuildingId>(BUILDING_LABELS).map((building) => (
            <li key={building}>
              <b>{BUILDING_LABELS[building]}</b>
              <p>{BUILDING_TEXT[building]}</p>
            </li>
          ))}
        </>
      );
    case 'goods':
      return (
        <>
          <li>
            <b>黑市價格</b>
            <p>{marketRule(RULES_V07)}</p>
          </li>
          {GOODS.map((good) => (
            <li key={good}>
              <b>
                <GoodIcon good={good} size="lg" tip={false} />
                {GOOD_LABELS[good]}
              </b>
              <p>{goodDetail(good, RULES_V07)}</p>
            </li>
          ))}
        </>
      );
    case 'events':
      return (
        <>
          {keysOf<VoyageEventId>(VOYAGE_EVENT_LABELS).map((event) => (
            <li key={event}>
              <b>{VOYAGE_EVENT_LABELS[event]}</b>
              <p>{VOYAGE_EVENT_TEXT[event]}</p>
            </li>
          ))}
        </>
      );
    case 'score':
      return (
        <li>
          <b>總財富</b>
          <p>{WEALTH_RULE_TEXT}</p>
        </li>
      );
  }
}

export function RulesPanel({ onClose }: { readonly onClose: () => void }) {
  const [tab, setTab] = useState<RulesTab>('roles');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="beat-backdrop rules-backdrop" role="dialog" aria-modal="true" aria-label="規則" onClick={onClose}>
      <div className="beat-card rules-panel" onClick={(e) => e.stopPropagation()}>
        <nav className="rules-tabs" role="tablist">
          {RULES_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          <button type="button" className="rules-close" aria-label="關閉" title="關閉" onClick={onClose}>
            <CloseIcon />
          </button>
        </nav>
        <ul className="rules-list">
          <RulesEntries tab={tab} />
        </ul>
      </div>
    </div>
  );
}
