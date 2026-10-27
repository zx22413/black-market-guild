import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GOODS, RULES_V07, type BuildingId, type IslandId, type RoleId, type VoyageEventId } from '../../v07/game';
import { BUILDING_LABELS, BUILDING_TEXT, GOOD_LABELS, ISLAND_LABELS, ISLAND_TEXT, ROLE_LABELS, VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT, WEALTH_RULE_TEXT } from '../labels';
import { soundEngine } from '../audio/soundEngine';
import { useSoundOnce } from '../audio/useUiSounds';
import { BrassCorner } from '../skin/ornaments';
import { goodDetail, marketRule } from '../table/goodText';
import { roleDetail } from '../table/roleText';
import { GoodIcon } from './GoodIcon';
import { CloseIcon, IconDisc } from './icons';
import { IslandGlance } from './IslandGlance';
import { roleIconUrl } from './RoleBadges';
import { RulesPageTurn, type PageTurn } from './RulesPageTurn';
import { onlineRules } from '../online/clockText';
import './rulesBook.css';

// The rules, for looking things up, as a ship's handbook: one chapter per kind of thing, and the
// book's thumb-index tabs are the chapter tabs (rulesBook.css). Every sentence comes from the texts
// the table already uses (labels.ts, roleText.ts, goodText.ts), so the book can never say something else.

export type RulesTab = 'roles' | 'islands' | 'buildings' | 'goods' | 'events' | 'score' | 'online';

export const RULES_TABS: readonly { readonly id: RulesTab; readonly label: string }[] = [
  { id: 'roles', label: '角色' },
  { id: 'islands', label: '島嶼' },
  { id: 'buildings', label: '建築' },
  { id: 'goods', label: '貨品' },
  { id: 'events', label: '事件' },
  { id: 'score', label: '計分' },
  { id: 'online', label: '連線' },
];

const keysOf = <K extends string>(record: Readonly<Record<K, unknown>>): K[] => Object.keys(record) as K[];

/** The entries of one chapter, as `<li>`s. */
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
    case 'online':
      return (
        <>
          {onlineRules().map((rule) => (
            <li key={rule.title}>
              <b>{rule.title}</b>
              <p>{rule.text}</p>
            </li>
          ))}
        </>
      );
  }
}

export function RulesPanel({ onClose: close }: { readonly onClose: () => void }) {
  const [tab, setTab] = useState<RulesTab>('roles');
  // The book opens, turns to a chapter and shuts with the sounds of a real one.
  const onClose = useCallback(() => {
    soundEngine.playSfx('book-close');
    close();
  }, [close]);
  // A chapter change turns a real page (RulesPageTurn), unless motion is turned down.
  const spread = useRef<HTMLDivElement>(null);
  const [turn, setTurn] = useState<(PageTurn<RulesTab> & { readonly key: number }) | null>(null);
  const turnTo = (next: RulesTab) => {
    if (next === tab) return;
    soundEngine.playSfx('book-flip');
    const el = spread.current;
    if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollTop = 0;
      const order = (t: RulesTab) => RULES_TABS.findIndex((r) => r.id === t);
      setTurn({
        key: performance.now(),
        from: tab,
        to: next,
        forward: order(next) > order(tab),
        single: matchMedia('(max-width: 640px)').matches,
        box: { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight },
      });
    }
    setTab(next);
  };
  useSoundOnce('book-open');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const labelOf = (t: RulesTab) => RULES_TABS.find((r) => r.id === t)?.label ?? '';
  const label = labelOf(tab);
  const page = (t: RulesTab): ReactNode => (
    <>
      <header className="rules-run">
        <span>規則</span>
        <span>{labelOf(t)}</span>
      </header>
      <ul className="rules-list rules-pages">
        <RulesEntries tab={t} />
      </ul>
    </>
  );
  return (
    <div className="beat-backdrop rules-backdrop" role="dialog" aria-modal="true" aria-label="規則" onClick={onClose}>
      <div className="rules-book" onClick={(e) => e.stopPropagation()}>
        <nav className="rules-index" role="tablist" aria-label="規則章節">
          {RULES_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`rules-tab ${tab === t.id ? 'on' : ''}`} onClick={() => turnTo(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="rules-cover">
          <div ref={spread} className="rules-spread" role="tabpanel" aria-label={label}>
            {page(tab)}
          </div>
          {turn && <RulesPageTurn key={turn.key} turn={turn} page={page} onDone={() => setTurn(null)} />}
          <button type="button" className="rules-close" aria-label="闔上" title="闔上" onClick={onClose}>
            <CloseIcon />
          </button>
          <BrassCorner at="tl" />
          <BrassCorner at="bl" />
        </div>
      </div>
    </div>
  );
}
