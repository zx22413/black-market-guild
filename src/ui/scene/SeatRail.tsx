import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerId } from '../../game';
import { SeatTag } from './SceneLabels';
import type { SceneSeat } from './tableModel';

const SLIDE_MS = 1300;

/** Guild ids from richest (cash plus assets) to poorest; ties keep seat order. */
function rankIds(seats: readonly SceneSeat[]): readonly PlayerId[] {
  return [...seats].sort((a, b) => b.cash + b.assetValue - (a.cash + a.assetValue)).map((s) => s.id);
}

interface SeatRailProps {
  readonly seats: readonly SceneSeat[];
  readonly nameOf: (id: PlayerId) => string;
  readonly submitted: readonly PlayerId[];
  /** Seats everyone is waiting on. */
  readonly waiting: readonly PlayerId[];
  /** Bumps when a round ends; the ranking is only re-sorted then, not as cash moves. */
  readonly rankStep: number;
  /** The viewer's own black money, for their tag (only the phone layouts show it there). */
  readonly blackMoney?: number | null;
}

/**
 * Right-hand list of every guild, richest first. The order is re-evaluated only when `rankStep`
 * changes, and tags that change place slide to their new spot (rising ones glow), so the
 * standings visibly shift at the end of a round.
 */
export function SeatRail({ seats, nameOf, submitted, waiting, rankStep, blackMoney = null }: SeatRailProps) {
  const [order, setOrder] = useState<readonly PlayerId[]>(() => rankIds(seats));
  const lastStep = useRef(rankStep);
  useEffect(() => {
    if (lastStep.current === rankStep) return;
    lastStep.current = rankStep;
    setOrder(rankIds(seats));
  }, [rankStep, seats]);

  const nodes = useRef(new Map<PlayerId, HTMLDivElement>());
  const tops = useRef(new Map<PlayerId, number>());
  useLayoutEffect(() => {
    nodes.current.forEach((element, id) => {
      const before = tops.current.get(id);
      if (before === undefined || before === element.offsetTop) return;
      const rising = before > element.offsetTop;
      element.animate(
        [
          { transform: `translateY(${before - element.offsetTop}px) scale(1.07)`, filter: rising ? 'drop-shadow(0 0 12px #ffd96a)' : 'none', zIndex: 2 },
          { transform: 'none', filter: 'none', zIndex: 2 },
        ],
        { duration: SLIDE_MS, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)' },
      );
    });
  }, [order]);
  // Remember where every tag sits after each render, so only a reorder (not a growing tag) slides.
  useLayoutEffect(() => {
    tops.current = new Map([...nodes.current].map(([id, element]) => [id, element.offsetTop]));
  });

  const place = (id: PlayerId) => {
    const index = order.indexOf(id);
    return index === -1 ? order.length : index;
  };
  return (
    <div className="seat-rail">
      {[...seats]
        .sort((a, b) => place(a.id) - place(b.id))
        .map((seat) => (
          <div
            key={seat.id}
            ref={(element) => {
              if (element) nodes.current.set(seat.id, element);
              else nodes.current.delete(seat.id);
            }}
          >
            <SeatTag seat={seat} nameOf={nameOf} ready={submitted.includes(seat.id)} waiting={waiting.includes(seat.id)} blackMoney={seat.isViewer ? blackMoney : null} />
          </div>
        ))}
    </div>
  );
}
