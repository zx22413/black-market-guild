import { TIDE_CARD, type FinalRoundEffect, type MatchEvent, type Rules, type TideKind, type VoyageEventId } from '../../v07/game';
import { VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT } from '../labels';
import { TIDE_LABELS, TIDE_SHIELD, tideText } from './tideModel';

// V0.8 prototype (rules.v08.events, an experiment, not rules): the card a round turns up, as the table shows it at the
// start of the resolution. Built from public events only; every number in a line is read from `rules`.

export type RoundCard =
  /**
   * A voyage event; `boss` when it shows its dark-tide side. `flipFrom` on the first boss side of a match: the event's
   * plain side, which the card shows first and is then turned over from.
   */
  | { readonly kind: 'voyage'; readonly event: VoyageEventId; readonly boss: boolean; readonly title: string; readonly lines: readonly string[]; readonly flipFrom?: { readonly title: string; readonly lines: readonly string[] } }
  /** 暗潮將至: the tide picked from the two candidates (null in a match without tide kinds). */
  | { readonly kind: 'rising'; readonly candidates: readonly TideKind[]; readonly tide: TideKind | null; readonly title: string; readonly lines: readonly string[] }
  /** The last round, with its effect (null: the round cap or an empty deck ended the match). */
  | { readonly kind: 'final'; readonly effect: FinalRoundEffect | null; readonly title: string; readonly lines: readonly string[] };

const signed = (n: number): string => (n < 0 ? `−${-n}` : `+${n}`);

/** The names of the boss sides that have one (docs/proposals/2026-11-v08-one-page.md); the others keep the event's name. */
const BOSS_TITLES: Partial<Readonly<Record<VoyageEventId, string>>> = { 'sea-fog': '海盜伏擊', 'black-market-rush': '嚴查', 'calm-seas': '貨滿為患' };

export function bossTitle(event: VoyageEventId): string {
  return BOSS_TITLES[event] ?? VOYAGE_EVENT_LABELS[event];
}

/** A boss side's line, with the numbers of `rules`. */
export function bossText(rules: Rules, event: VoyageEventId): string {
  const e = rules.v08.events;
  switch (event) {
    case 'storm':
      return `所有船 ${signed(e.bossStorm)}。`;
    case 'tailwind':
      return `所有船 ${signed(e.bossTailwind)}。`;
    case 'sea-fog':
      return `每名海盜 ${signed(e.bossPirate)}。`;
    case 'moonless-night':
      return '護衛失效。';
    case 'black-market-rush':
      return `軍火的查緝額度再少 ${-e.bossInspectionAllowance}。`;
    case 'calm-seas':
      return `跌價的格數 ×${e.bossDropMultiplier}。`;
  }
}

/** What the tide's own event card turns into once the season has begun (a boss side without a name of its own is 「暗潮面」). */
function flipLine(rules: Rules, event: VoyageEventId): string {
  const [plain, dark] = [VOYAGE_EVENT_LABELS[event], bossTitle(event)];
  return `之後抽到「${plain}」會變成${dark === plain ? '暗潮面' : `「${dark}」`}：${bossText(rules, event)}`;
}

function finalLines(rules: Rules, effect: FinalRoundEffect | null): string[] {
  const e = rules.v08.events;
  const open = `黑市大開：每種貨的需求 +${e.openMarketDemand}，這回合不跌價。`;
  const gamble = `最後一搏：每艘船擲 ${e.lastGambleDice} 顆骰，取高的。`;
  const last = '這回合結束後對局結束，倉庫剩下的貨不計分。';
  if (effect === 'final-market') return [open, gamble, last];
  if (effect === 'open-market') return [open, last];
  if (effect === 'last-gamble') return [gamble, last];
  return [last];
}

const FINAL_TITLES: Readonly<Record<FinalRoundEffect, string>> = { 'final-market': '最後的大市集', 'open-market': '黑市大開', 'last-gamble': '最後一搏' };

/** The cards `round` turned up, in the order they are shown (a round at the cap shows its event, then the ending). */
export function roundCards(events: readonly MatchEvent[], round: number, rules: Rules): RoundCard[] {
  const e = rules.v08.events;
  const cards: RoundCard[] = [];
  const candidates = events.flatMap((ev) => (ev.type === 'tide-candidates' ? ev.candidates : []));
  const boss = events.some((ev) => ev.type === 'boss-event' && ev.round === round);
  const firstBoss = boss && !events.some((ev) => ev.type === 'boss-event' && ev.round < round);
  for (const ev of events) {
    if (!('round' in ev) || ev.round !== round) continue;
    if (ev.type === 'voyage-event-revealed') {
      cards.push(
        boss
          ? { kind: 'voyage', event: ev.event, boss: true, title: bossTitle(ev.event), lines: [bossText(rules, ev.event)], ...(firstBoss ? { flipFrom: { title: VOYAGE_EVENT_LABELS[ev.event], lines: [VOYAGE_EVENT_TEXT[ev.event]] } } : {}) }
          : { kind: 'voyage', event: ev.event, boss: false, title: VOYAGE_EVENT_LABELS[ev.event], lines: [VOYAGE_EVENT_TEXT[ev.event]] },
      );
    } else if (ev.type === 'dark-tide-rising') {
      const picked = events.find((t) => t.type === 'tide-revealed' && t.round === round);
      const tide = picked?.type === 'tide-revealed' ? picked.tide : null;
      cards.push({
        kind: 'rising',
        candidates,
        tide,
        title: '暗潮將至',
        lines: [
          `這回合結束時，每座倉庫的每種貨損失 ${e.warehouseLossPercent}%（無條件捨去）。`,
          ...(tide === null
            ? ['下回合起進入暗潮季。']
            : [
                `下回合起每回合：${tideText(rules, tide)}。`,
                `擋得住的：${TIDE_SHIELD[tide]}。`,
                ...(e.flipOnlyTideCard === 1 ? [flipLine(rules, TIDE_CARD[tide])] : []),
              ]),
        ],
      });
    } else if (ev.type === 'final-round') {
      cards.push({ kind: 'final', effect: ev.effect, title: ev.effect === null ? '最後一回合' : FINAL_TITLES[ev.effect], lines: finalLines(rules, ev.effect) });
    }
  }
  return cards;
}

/** The tide's name for a card's heading. */
export const tideTitle = (tide: TideKind): string => TIDE_LABELS[tide];
