import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GOODS, RULES_CURRENT, SHIP_TYPE_IDS, TIDE_CARD, TIDE_KINDS, V08_BUILDING_IDS, eventsOn, type Goods, type IslandId, type RoleId, type Rules, type VoyageEventId } from '../../v07/game';
import { GOOD_LABELS, ISLAND_LABELS, ROLE_LABELS, SHIP_TYPE_LABELS, VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT, WEALTH_RULE_TEXT, islandText } from '../labels';
import { soundEngine } from '../audio/soundEngine';
import { useSoundOnce } from '../audio/useUiSounds';
import { BrassCorner } from '../skin/ornaments';
import { goodDetail, marketRule } from '../table/goodText';
import { roleDetail } from '../table/roleText';
import { shipDetail, shipRuleIntro } from '../table/shipText';
import { FACILITY_LABELS, SKILL_LABELS, facilityShield, facilityText, skillText } from '../table/v08Text';
import { bossText, bossTitle } from './roundCard';
import { TIDE_LABELS, tideShield, tideText } from './tideModel';
import { GoodIcon } from './GoodIcon';
import { CloseIcon, IconDisc } from './icons';
import { IslandGlance } from './IslandGlance';
import { roleIconUrl } from './RoleBadges';
import { RulesPageTurn, type PageTurn } from './RulesPageTurn';
import { onlineRules } from '../online/clockText';
import { track } from '../analytics/track';
import './rulesBook.css';

// The rules, for looking things up, as a ship's handbook: one chapter per kind of thing, and the
// book's thumb-index tabs are the chapter tabs (rulesBook.css). Every sentence comes from the texts
// the table already uses (labels.ts, roleText.ts, goodText.ts), so the book can never say something else.

export type RulesTab = 'roles' | 'islands' | 'ships' | 'buildings' | 'goods' | 'events' | 'score' | 'online';

export const RULES_TABS: readonly { readonly id: RulesTab; readonly label: string }[] = [
  { id: 'roles', label: '角色' },
  { id: 'islands', label: '島嶼' },
  { id: 'ships', label: '船' },
  { id: 'buildings', label: '建築' },
  { id: 'goods', label: '貨品' },
  { id: 'events', label: '事件' },
  { id: 'score', label: '計分' },
  { id: 'online', label: '連線' },
];

const keysOf = <K extends string>(record: Readonly<Record<K, unknown>>): K[] => Object.keys(record) as K[];

/** A material cost in words: 「2 木材、1 鐵礦」. */
const costText = (cost: Goods): string =>
  GOODS.filter((g) => cost[g] > 0)
    .map((g) => `${cost[g]} ${GOOD_LABELS[g]}`)
    .join('、');

/** §8.2, §10: the one material action a round, with the rules' numbers. */
function materialRule(rules: Rules): string {
  const v = rules.v08;
  return `每回合投資時，可以用倉庫裡的貨做一個材料行動：\n開啟一種船的技能：${costText(v.costs.open)}，最多開 ${v.maxSkills} 種船。\n蓋一棟建築：${costText(v.costs.build.repairyard)}，一局只能蓋 ${v.maxBuildings} 棟。\n做了什麼在提交後公開，這回合就生效。`;
}

/** §12.1: the event deck, the two advance cards and the season, with the rules' numbers. */
function deckRules(rules: Rules): readonly { readonly title: string; readonly text: string }[] {
  const e = rules.v08.events;
  return [
    {
      title: '事件牌庫與局長',
      text: `每回合開始時翻一張事件。「暗潮將至」在第 ${e.firstAdvanceFrom}～${e.firstAdvanceTo} 回合之間翻出，「最後的大市集」在第 ${e.secondAdvanceFrom}～${e.secondAdvanceTo} 回合之間翻出，翻到它的那回合就是最後一回合。\n確切是哪一回合是隨機的，不公開。`,
    },
    {
      title: '暗潮將至',
      text: `這回合沒有一般事件，改公開這局的暗潮是兩種候選裡的哪一種。\n這回合結束時，倉庫裡每種貨少 ${e.warehouseLossPercent}%（無條件捨去）。\n下一回合起是暗潮季，暗潮每回合生效到最後。`,
    },
    {
      title: '最後的大市集',
      text: `最後一回合，沒有一般事件。每種貨需求 +${e.openMarketDemand}、價格不會下跌、每艘船擲 ${e.lastGambleDice} 顆骰取高的。\n暗潮照常生效，但崩盤潮被「不會下跌」蓋過。這回合不能選巨鯨號。`,
    },
  ];
}

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
              <p className="role-detail">{roleDetail(role, RULES_CURRENT)}</p>
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
                {islandText(RULES_CURRENT, island).pro}。{islandText(RULES_CURRENT, island).con}。
              </p>
            </li>
          ))}
        </>
      );
    case 'ships':
      return (
        <>
          <li>
            <b>選船與出航</b>
            <p>{shipRuleIntro(RULES_CURRENT)}</p>
          </li>
          {SHIP_TYPE_IDS.map((ship) => (
            <li key={ship}>
              <b>{SHIP_TYPE_LABELS[ship]}</b>
              <p>{shipDetail(ship, RULES_CURRENT)}</p>
              {RULES_CURRENT.v08.skills === 1 && (
                <p>
                  技能「{SKILL_LABELS[ship]}」：{skillText(RULES_CURRENT, ship)}。
                </p>
              )}
            </li>
          ))}
        </>
      );
    case 'buildings':
      return (
        <>
          <li>
            <b>材料行動</b>
            <p>{materialRule(RULES_CURRENT)}</p>
          </li>
          {V08_BUILDING_IDS.map((building) => {
            const shield = facilityShield(RULES_CURRENT, building);
            return (
              <li key={building}>
                <b>{FACILITY_LABELS[building]}</b>
                <p>
                  {facilityText(RULES_CURRENT, building)}。{shield ? `\n暗潮季：${shield}。` : ''}
                </p>
              </li>
            );
          })}
        </>
      );
    case 'goods':
      return (
        <>
          <li>
            <b>黑市價格</b>
            <p>{marketRule(RULES_CURRENT)}</p>
          </li>
          {GOODS.map((good) => (
            <li key={good}>
              <b>
                <GoodIcon good={good} size="lg" tip={false} />
                {GOOD_LABELS[good]}
              </b>
              <p>{goodDetail(good, RULES_CURRENT)}</p>
            </li>
          ))}
        </>
      );
    case 'events':
      return (
        <>
          {eventsOn(RULES_CURRENT) &&
            deckRules(RULES_CURRENT).map((rule) => (
              <li key={rule.title}>
                <b>{rule.title}</b>
                <p>{rule.text}</p>
              </li>
            ))}
          {keysOf<VoyageEventId>(VOYAGE_EVENT_LABELS).map((event) => (
            <li key={event}>
              <b>{VOYAGE_EVENT_LABELS[event]}</b>
              <p>{VOYAGE_EVENT_TEXT[event]}</p>
            </li>
          ))}
          {eventsOn(RULES_CURRENT) &&
            TIDE_KINDS.map((tide) => {
              const card = TIDE_CARD[tide];
              return (
                <li key={tide}>
                  <b>{TIDE_LABELS[tide]}</b>
                  <p>
                    暗潮季每回合：{tideText(RULES_CURRENT, tide)}。{'\n'}擋得住：{tideShield(RULES_CURRENT, tide)}。{'\n'}這局是{TIDE_LABELS[tide]}時，抽到「{VOYAGE_EVENT_LABELS[card]}」會翻成
                    {bossTitle(card) === VOYAGE_EVENT_LABELS[card] ? '暗潮面' : `「${bossTitle(card)}」`}：{bossText(RULES_CURRENT, card)}
                  </p>
                </li>
              );
            })}
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

interface RulesPanelProps {
  readonly onClose: () => void;
  /** Where the book was opened, for the statistics: the main menu or a match table. */
  readonly where?: 'menu' | 'table';
}

export function RulesPanel({ onClose: close, where = 'table' }: RulesPanelProps) {
  const [tab, setTab] = useState<RulesTab>('roles');
  // Which chapters people look up: a hint at what confuses them. The book opens on the roles page by
  // itself, so that first view is logged as 'open' and only a chapter picked after it counts as a read.
  const opened = useRef(false);
  useEffect(() => {
    track('rules_open', { chapter: opened.current ? tab : 'open', where });
    opened.current = true;
  }, [tab, where]);
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
