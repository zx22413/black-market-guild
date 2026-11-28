import { describe, expect, it } from 'vitest';
import { GOODS, ISLAND_IDS, ROLE_IDS, RULES_CURRENT, SHIP_TYPE_IDS, TIDE_KINDS, V08_BUILDING_IDS } from '../../src/v07/game';
import { TUTORIALS, type CoachStep } from '../../src/v07/tutorial';
import { MARKET_ISLAND_TEXT, ROLE_TEXT, SHIP_TYPE_TEXT, VOYAGE_EVENT_TEXT, WEALTH_RULE_TEXT, islandText, wantedText } from '../../src/ui-v07/labels';
import { roleDetail } from '../../src/ui-v07/table/roleText';
import { shipDetail, shipRuleIntro } from '../../src/ui-v07/table/shipText';
import { goodDetail, marketRule } from '../../src/ui-v07/table/goodText';
import { facilityText, skillText } from '../../src/ui-v07/table/v08Text';
import { tideShield, tideText } from '../../src/ui-v07/table3d/tideModel';
import { TIMEOUT_DEFAULT, onlineRules } from '../../src/ui-v07/online/clockText';
import { DEV_LOG } from '../../src/ui-v07/devlog/entries';

// The mechanical half of docs/ui/copy-style.md: what a test can check on the player-facing text of the current rules
// (length, words that belong to old versions or to the team, colon lists). Whether a text reads like a person wrote
// it is the other half, reviewed by hand before a release (copy-style.md §8).

/** Words that must not reach a player: old rules (V0.7 and before), in-house words, a term we replaced. */
const BANNED: readonly { readonly word: string; readonly why: string }[] = [
  { word: '基準', why: 'in-house word for the plain ship' },
  { word: '縮放', why: 'V0.7 customs wording; customs takes the arriving crates (§9.4)' },
  { word: '護航費', why: 'the guard has had no escort fee since V0.7.1' },
  { word: '林場島', why: 'renamed 船塢島' },
  { word: '不建造', why: 'V0.7 timeout default; a timed-out investment stays in port (§15)' },
  { word: '不重擲', why: 'the reroll phase was removed in V0.7.1' },
  { word: '獲利率', why: 'V0.7 share-of-value wording; V0.8 loses crates' },
  { word: '通緝犯', why: 'the term is 通緝者' },
  { word: '查緝額度', why: '「額度再少 1」reads as a cap players never see; say 需求以內的軍火也查扣 (2026-11-29)' },
  { word: '4 倍', why: '貨滿為患 no longer multiplies 崩盤潮’s drops; it lowers demand (2026-11-28)' },
];

/** Tutorial steps (copy-style.md §4): a step is read in a glance beside the table. */
const STEP_MAX_CHARS = 80;
const STEP_MAX_PARAGRAPHS = 3;
const TODO_MAX_CHARS = 60;
/** A semicolon chain is one of the AI tells (§3); one in a sentence is fine. */
const MAX_SEMICOLONS = 1;
/** Hints shown on hover (§4): a sentence or two. */
const HINT_MAX_CHARS = 60;
const SHORT_MAX_CHARS = 30;

const R = RULES_CURRENT;

/** Every text of the rules book and the hints, under the current rules, with where it comes from. */
function referenceTexts(): readonly (readonly [string, string])[] {
  return [
    ...ROLE_IDS.map((r) => [`roleDetail(${r})`, roleDetail(r, R)] as const),
    ['shipRuleIntro', shipRuleIntro(R)],
    ...SHIP_TYPE_IDS.map((s) => [`shipDetail(${s})`, shipDetail(s, R)] as const),
    ...SHIP_TYPE_IDS.map((s) => [`skillText(${s})`, skillText(R, s)] as const),
    ['marketRule', marketRule(R)],
    ...GOODS.map((g) => [`goodDetail(${g})`, goodDetail(g, R)] as const),
    ...V08_BUILDING_IDS.map((b) => [`facilityText(${b})`, facilityText(R, b)] as const),
    ...TIDE_KINDS.map((t) => [`tideText(${t})`, `${tideText(R, t)} ${tideShield(R, t)}`] as const),
    ...ISLAND_IDS.map((i) => [`islandText(${i})`, `${islandText(R, i).pro} ${islandText(R, i).con}`] as const),
    ...Object.entries(VOYAGE_EVENT_TEXT).map(([e, t]) => [`VOYAGE_EVENT_TEXT.${e}`, t] as const),
    ['WEALTH_RULE_TEXT', WEALTH_RULE_TEXT],
    ...onlineRules().map((r) => [`onlineRules(${r.title})`, r.text] as const),
    ...hintTexts(),
    ...shortTexts(),
  ];
}

/** Hover hints: a sentence or two each. */
function hintTexts(): readonly (readonly [string, string])[] {
  return [
    ...ROLE_IDS.map((r) => [`ROLE_TEXT.${r}`, ROLE_TEXT[r]] as const),
    ['MARKET_ISLAND_TEXT', MARKET_ISLAND_TEXT],
    ['wantedText', wantedText(R.wanted.lootBonus)],
  ];
}

/** One-line labels and toasts. */
function shortTexts(): readonly (readonly [string, string])[] {
  return [
    ...SHIP_TYPE_IDS.flatMap((s) => (SHIP_TYPE_TEXT[s] ? [[`SHIP_TYPE_TEXT.${s}`, SHIP_TYPE_TEXT[s]] as const] : [])),
    ...Object.entries(TIMEOUT_DEFAULT).map(([p, t]) => [`TIMEOUT_DEFAULT.${p}`, t] as const),
  ];
}

/** The newest dev log entry describes the current rules; older entries keep the words of their own versions. */
function latestDevLog(): readonly (readonly [string, string])[] {
  const entry = DEV_LOG[0]!;
  return [[`DEV_LOG ${entry.version} summary`, entry.summary], ...entry.sections.flatMap((s) => s.items.map((item) => [`DEV_LOG ${entry.version} ${s.title}`, item] as const))];
}

function tutorialSteps(): readonly (readonly [string, CoachStep])[] {
  return TUTORIALS.flatMap((t) => t.coach.map((step) => [`${t.id}「${step.title}」`, step] as const));
}

const banned = (text: string): readonly string[] => BANNED.filter((b) => text.includes(b.word)).map((b) => `「${b.word}」(${b.why})`);

/** A step that lists three or more things as 「label：…」 paragraphs reads like a table, not like someone talking (§3). */
const colonList = (lines: readonly string[]): boolean => lines.filter((l) => /^[^，。；：]{1,6}：/.test(l)).length >= 3;

const semicolons = (text: string): number => (text.match(/；/g) ?? []).length;

/** What is wrong with one tutorial step, in words; empty when nothing is. */
function stepProblems(step: Pick<CoachStep, 'lines' | 'todo'>): readonly string[] {
  const chars = step.lines.join('').length;
  return [
    chars > STEP_MAX_CHARS ? `${chars} characters (at most ${STEP_MAX_CHARS})` : '',
    step.lines.length > STEP_MAX_PARAGRAPHS ? `${step.lines.length} paragraphs (at most ${STEP_MAX_PARAGRAPHS})` : '',
    step.todo !== undefined && step.todo.length > TODO_MAX_CHARS ? `todo is ${step.todo.length} characters (at most ${TODO_MAX_CHARS})` : '',
    colonList(step.lines) ? 'a colon list of three or more paragraphs' : '',
    ...step.lines.filter((l) => semicolons(l) > MAX_SEMICOLONS).map((l) => `${semicolons(l)} semicolons in 「${l.slice(0, 12)}…」`),
    ...banned([...step.lines, step.todo ?? ''].join('')),
  ].filter(Boolean);
}

describe('player-facing copy (docs/ui/copy-style.md)', () => {
  it('keeps every tutorial step short and plain', () => {
    const problems = tutorialSteps().flatMap(([where, step]) => stepProblems(step).map((p) => `${where}: ${p}`));
    expect(problems).toEqual([]);
  });

  it('catches the kind of step the guide was written against', () => {
    // The old 「五種船」 step (2026-11-24): five ships in a colon list, over 200 characters.
    const fiveShips = {
      lines: [
        '選船就是決定這回合怎麼賺：求穩、賭一把、多載一點，或躲過海關。前兩回合你開的信天翁號掉貨少、最穩。另外四艘：',
        '孤注號：擲得好，貨物 ×1.5～×2.5；擲不好整船沉。用過要休息 1 回合。',
        '巨鯨號：不會沉、多裝 2 箱，但下一回合才到港，路上至少掉 1 箱。',
        '幽靈號：被海關指名也扣不走它的貨。',
        '海嘯號：最終值越高賺越多，加成疊得夠可到 ×2.5；但比信天翁號容易掉貨。',
        '點船卡可以看它的掉貨表。',
      ],
    };
    const found = stepProblems(fiveShips);
    expect(found.some((p) => p.includes('characters'))).toBe(true);
    expect(found.some((p) => p.includes('paragraphs'))).toBe(true);
    expect(found.some((p) => p.includes('colon list'))).toBe(true);
    expect(stepProblems({ lines: ['信天翁號是基準。'] })).toEqual([expect.stringContaining('基準')]);
  });

  it('uses no old or in-house words in the rules book, the hints or the latest dev log', () => {
    const problems = [...referenceTexts(), ...latestDevLog()].flatMap(([where, text]) => banned(text).map((b) => `${where}: ${b}`));
    expect(problems).toEqual([]);
  });

  it('keeps hover hints to a sentence or two and labels to a line', () => {
    const long = [
      ...hintTexts().filter(([, t]) => t.length > HINT_MAX_CHARS).map(([where, t]) => `${where}: ${t.length} characters (at most ${HINT_MAX_CHARS})`),
      ...shortTexts().filter(([, t]) => t.length > SHORT_MAX_CHARS).map(([where, t]) => `${where}: ${t.length} characters (at most ${SHORT_MAX_CHARS})`),
    ];
    expect(long).toEqual([]);
  });
});
