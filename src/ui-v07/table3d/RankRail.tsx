import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GOODS, type BuildingId, type PlayerId, type Rules } from '../../v07/game';
import { BUILDING_LABELS, BUILDING_TEXT, ISLAND_LABELS, ISLAND_TEXT, WEALTH_RULE_TEXT } from '../labels';
import type { BeatSeat } from '../scene/beatStage';
import type { Board } from '../session/board';
import { GoodCount } from './GoodIcon';
import { CloseIcon, InfoIcon, StatusMark, WantedMark } from './icons';
import { InfoTip } from './InfoTip';
import { IslandIcon } from './IslandIcon';
import { cardIconUrl } from './cardArt';
import { LockHint } from './LockHint';
import { standingsOf, type Standing } from './standings';

// The standings that stay on screen (V0.6's guild rail): richest first, in the top-right corner
// under the menu. Each guild shows its rank, total wealth, the buildings it has built and the
// goods in its warehouse (public, §4); hover the wealth for the cash and buildings it adds up
// from. The order is only redone when a round ends, and guilds that change place slide to their
// new spot (rising ones glow); the figures themselves keep up. On a narrow window it starts
// folded to a single 「排行」 button.

const SLIDE_MS = 1300;
/** Wide enough for the rail not to crowd the islands beside it. */
const WIDE = 1100;

export interface RankRailProps {
  readonly seats: readonly BeatSeat[];
  readonly board: Board;
  readonly rules: Rules;
  /** Cash shown (it ticks up as payments land during the settlement). */
  readonly cashOf: (id: PlayerId) => number;
  /** 思考中／已決定, or empty. */
  readonly status: (id: PlayerId) => string;
  /** Bumps when a round ends: the ranking is only re-sorted then. */
  readonly rankStep: number;
  /** Opens the rail whenever this turns true (a close shot that leaves no room for the plates); the player can still fold it. */
  readonly forceOpen?: boolean;
}

/** The order shown and the rank each guild had when it was set (the figures move on, these wait for the round's end). */
interface Shown {
  readonly order: readonly PlayerId[];
  readonly ranks: Readonly<Record<PlayerId, number>>;
}

const shownOf = (standings: readonly Standing[]): Shown => ({ order: standings.map((s) => s.id), ranks: Object.fromEntries(standings.map((s) => [s.id, s.rank])) });

/**
 * A built building: its icon on a dark disc. Hover (desktop) or tap it to see what the building
 * is, what it does and what it cost; tap elsewhere to close.
 */
function BuildingMark({ building, rules }: { readonly building: BuildingId; readonly rules: Rules }) {
  const { cash, wood, iron } = rules.buildings.costs[building];
  return (
    <InfoTip
      title={BUILDING_LABELS[building]}
      text={
        <>
          {BUILDING_TEXT[building]}
          <br />
          建造費：現金 {cash} G
          {wood > 0 && ` ＋ ${wood} 木材`}
          {iron > 0 && ` ＋ ${iron} 鐵礦`}；終局算 {Math.floor(cash * rules.buildings.valueRatio)} G
        </>
      }
    >
      <span className="rank-building">
        <button type="button" aria-label={BUILDING_LABELS[building]}>
          <img src={cardIconUrl({ kind: 'building', id: building })} alt="" />
        </button>
      </span>
    </InfoTip>
  );
}

export function RankRail({ seats, board, rules, cashOf, status, rankStep, forceOpen = false }: RankRailProps) {
  const standings = standingsOf(
    seats.map((s) => ({ id: s.id, cash: cashOf(s.id), buildings: board.players[s.id]?.buildings ?? [] })),
    rules,
  );
  const [open, setOpen] = useState(() => window.innerWidth >= WIDE);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  const [shown, setShown] = useState<Shown>(() => shownOf(standings));
  const { order, ranks } = shown;
  const lastStep = useRef(rankStep);
  useEffect(() => {
    if (lastStep.current === rankStep) return;
    lastStep.current = rankStep;
    setShown(shownOf(standings));
  }); // reads the latest standings when the step changes

  const nodes = useRef(new Map<PlayerId, HTMLLIElement>());
  const tops = useRef(new Map<PlayerId, number>());
  useLayoutEffect(() => {
    nodes.current.forEach((element, id) => {
      const before = tops.current.get(id);
      if (before === undefined || before === element.offsetTop) return;
      const rising = before > element.offsetTop;
      element.animate(
        [
          { transform: `translateY(${before - element.offsetTop}px) scale(1.04)`, filter: rising ? 'drop-shadow(0 0 10px #ffd96a)' : 'none' },
          { transform: 'none', filter: 'none' },
        ],
        { duration: SLIDE_MS, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)' },
      );
    });
  }, [order]);
  // Remember where every row sits, so only a reorder (not a row growing open) slides.
  useLayoutEffect(() => {
    tops.current = new Map([...nodes.current].map(([id, element]) => [id, element.offsetTop]));
  });

  if (!open) {
    return (
      <button type="button" data-focus="rank" className="rank-fold" onClick={() => setOpen(true)} aria-expanded={false}>
        排行
      </button>
    );
  }
  const place = (id: PlayerId) => {
    const at = order.indexOf(id);
    return at === -1 ? order.length : at;
  };
  const byId = new Map(standings.map((s) => [s.id, s]));
  const rows = [...seats].sort((a, b) => place(a.id) - place(b.id));
  return (
    <aside data-focus="rank" className="rank-rail" aria-label="玩家排行">
      <header>
        <b>排行</b>
        <LockHint icon={<InfoIcon />} text={WEALTH_RULE_TEXT} placement="down" />
        <button type="button" onClick={() => setOpen(false)} aria-label="收起排行">
          <CloseIcon />
        </button>
      </header>
      <ol>
        {rows.map((seat) => {
          const s = byId.get(seat.id)!;
          const player = board.players[seat.id];
          const note = status(seat.id);
          return (
            <li
              key={seat.id}
              ref={(element) => {
                if (element) nodes.current.set(seat.id, element);
                else nodes.current.delete(seat.id);
              }}
              className={seat.isViewer ? 'me' : ''}
              style={{ borderColor: seat.color }}
            >
              <div className="rank-top">
                <span className="rank-no">{ranks[seat.id] ?? s.rank}</span>
                <span className="rank-who">
                  {player?.island && (
                    <InfoTip title={ISLAND_LABELS[player.island]} text={`${ISLAND_TEXT[player.island].pro}。${ISLAND_TEXT[player.island].con}。`}>
                      <IslandIcon island={player.island} />
                    </InfoTip>
                  )}
                  <span className="rank-name">{seat.isViewer ? '你' : seat.name}</span>
                  {board.wanted.includes(seat.id) && <WantedMark />}
                  <StatusMark label={note} />
                </span>
                <b className="rank-wealth" title={`現金 ${s.cash.toLocaleString()} G ＋ 建築 ${s.buildingValue} G（半價）`}>
                  {s.wealth.toLocaleString()} G
                </b>
              </div>
              <div className="rank-have">
                <span className="rank-buildings">
                  {(player?.buildings ?? []).length === 0 ? <small title="無建築">—</small> : (player?.buildings ?? []).map((b) => <BuildingMark key={b} building={b} rules={rules} />)}
                </span>
                <span className="rank-stock" title="倉庫">
                  {GOODS.filter((g) => (player?.stock[g] ?? 0) > 0).map((g) => (
                    <GoodCount key={g} good={g} count={player?.stock[g] ?? 0} size="sm" />
                  ))}
                  {GOODS.every((g) => (player?.stock[g] ?? 0) === 0) && <small title="倉庫空">—</small>}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
