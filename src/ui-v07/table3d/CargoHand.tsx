import type { GoodId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import type { CargoCard } from '../table/cargoCards';
import { goodIconUrl } from './GoodIcon';
import { AlertIcon, ClockIcon, CrateIcon } from './icons';
import './cargoHand.css';

// The loading step of the ship bays: one card per good along the bottom, in the role hand's layout (.dep-hand,
// .dep-card), so the cargo is loaded by pressing a card and not by hunting for a crate on the island. A click loads
// one crate (it drops onto the deck); the gold number in the corner is how many are aboard, and a click on it takes
// one off again. Small text is kept off the card: the name, the units left, and an icon only when there is something to
// warn about (spice that would spoil, a good the island makes late or never again), the sentence in its tooltip.

interface CargoHandProps {
  readonly cards: readonly CargoCard[];
  /** Nothing loaded yet: the hand breathes gold. */
  readonly todo: boolean;
  readonly onLoad: (good: GoodId) => void;
  readonly onUnload: (good: GoodId) => void;
}

const restockTitle = (restock: number): string => (restock === 0 ? '之後不再生產' : `再過 ${restock} 回合才會生產`);

export function CargoHand({ cards, todo, onLoad, onUnload }: CargoHandProps) {
  return (
    <div className={`dep-hand cargo-hand ${todo ? 'todo' : ''}`}>
      {cards.map((c) => (
        <button
          key={c.good}
          type="button"
          className={`dep-card cargo-card good-${c.good} ${c.loadable ? '' : 'off'} ${c.loaded > 0 ? 'has' : ''}`}
          data-cargo-card={c.good}
          aria-disabled={!c.loadable}
          title={c.reason ?? `裝一箱${GOOD_LABELS[c.good]}上船`}
          onClick={() => c.loadable && onLoad(c.good)}
        >
          {c.spoils ? (
            <span className="cargo-flag warn" title="沒裝上船，回合結束會壞掉" role="img" aria-label="沒裝會壞掉">
              <AlertIcon />
            </span>
          ) : c.restock !== null ? (
            <span className="cargo-flag" title={restockTitle(c.restock)} role="img" aria-label={restockTitle(c.restock)}>
              <ClockIcon />
              {c.restock === 0 ? '–' : c.restock}
            </span>
          ) : null}
          {c.loaded > 0 && (
            <span
              className="cargo-aboard"
              role="button"
              tabIndex={0}
              title={`船上有 ${c.loaded} 箱，點一下卸下一箱`}
              aria-label={`卸下一箱${GOOD_LABELS[c.good]}`}
              onClick={(e) => {
                e.stopPropagation();
                onUnload(c.good);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onUnload(c.good);
                }
              }}
            >
              {c.loaded}
            </span>
          )}
          <span className="dep-ic">
            <img src={goodIconUrl(c.good)} alt="" />
          </span>
          <b>{GOOD_LABELS[c.good]}</b>
          <span className="dep-fee cargo-left" title={`倉庫還有 ${c.left} 箱`}>
            <CrateIcon />
            {c.left}
            {c.made > 0 && <em className="cargo-new">+{c.made}</em>}
          </span>
        </button>
      ))}
    </div>
  );
}
