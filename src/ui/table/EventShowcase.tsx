import type { Rules } from '../../game';
import { marketIcon, voyageIcon } from '../art';
import { Icon } from '../components/Icon';
import { MARKET_EVENT_LABELS, VOYAGE_EVENT_LABELS } from '../labels';
import { marketEventText, voyageEventText } from '../rulesText';
import { SHOWCASE_MS, type Showcase } from './eventReveal';
import './eventShowcase.css';

interface EventShowcaseProps {
  readonly showcase: Showcase;
  readonly rules: Rules;
  readonly onDismiss: () => void;
}

/**
 * A revealed market or voyage event as a card in the middle of a darkened screen: it flips in,
 * holds for its description to be read, then shrinks off toward the event notes in the top-left
 * corner. Tapping anywhere puts it away early.
 */
export function EventShowcase({ showcase, rules, onDismiss }: EventShowcaseProps) {
  const market = showcase.kind === 'market';
  const icon = market ? marketIcon(showcase.event) : voyageIcon(showcase.event);
  const title = market ? MARKET_EVENT_LABELS[showcase.event] : VOYAGE_EVENT_LABELS[showcase.event];
  const text = market ? marketEventText(showcase.event, rules) : voyageEventText(showcase.event, rules);
  return (
    <div
      // Remounted per reveal, so the animation restarts for back-to-back cards.
      key={`${showcase.kind}-${showcase.round}`}
      className={`event-showcase ${showcase.kind}`}
      style={{ animationDuration: `${SHOWCASE_MS}ms` }}
      role="dialog"
      aria-label={`${market ? '市場事件' : '航海事件'}：${title}`}
      onClick={onDismiss}
    >
      <div className="showcase-card" style={{ animationDuration: `${SHOWCASE_MS}ms` }}>
        <small className="showcase-kind">
          第 {showcase.round} 回合・{market ? '市場事件' : '航海事件'}
        </small>
        <div className="showcase-emblem">
          <Icon name={icon} size={72} />
        </div>
        <strong className="showcase-title">{title}</strong>
        <p className="showcase-text">{text}</p>
        <small className="showcase-hint">點一下繼續</small>
      </div>
    </div>
  );
}
