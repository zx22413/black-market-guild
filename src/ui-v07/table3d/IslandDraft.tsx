import { useState, type CSSProperties } from 'react';
import type { DecisionContext } from '../../v07/bots';
import type { Action, IslandId, PlayerId } from '../../v07/game';
import { ISLAND_LABELS, ISLAND_TEXT } from '../labels';
import { legalOf } from '../table/forms';
import { IslandCard, useDealt } from './IslandCard';
import { IslandIcon } from './IslandIcon';

// The island draft (§11.1, docs/ui/v07-event-presentation.md §1.1): two island cards (`IslandCard`)
// dealt face down over the dimmed table, only for you, then turned up. The pick lifts and glows,
// the button names it, and on confirm the card shrinks away toward your seat. Then everyone's
// islands are dealt and turned up one after another (`IslandReveal`).

/** How long the chosen card takes to fly to your seat before the choice is submitted. */
const FLY_MS = 650;
/** When the first card turns up, and the gap before each next one. */
const DEAL_MS = 350;
const DEAL_GAP_MS = 220;

export interface IslandDraftProps {
  readonly context: DecisionContext;
  readonly onSubmit: (action: Action) => void;
}

export function IslandDraft({ context, onSubmit }: IslandDraftProps) {
  const options = legalOf(context, 'choose-island');
  const [picked, setPicked] = useState<IslandId | null>(null);
  const [flying, setFlying] = useState(false);
  const confirm = () => {
    const action = options.find((a) => a.island === picked);
    if (!action) return;
    setFlying(true);
    setTimeout(() => onSubmit(action), FLY_MS);
  };
  return (
    <div className="beat-backdrop draft-backdrop" role="dialog" aria-modal="true" aria-label="選島">
      <div className={`draft ${flying ? 'flying' : ''}`}>
        <header className="draft-head">
          <span>只有你看得到</span>
          <strong>選一座島，整局都用它</strong>
          <small>兩座選一座，所有人同時公開</small>
        </header>
        <div className="isle-deal">
          {options.map((a, i) => (
            <DraftSlot
              key={a.island}
              island={a.island}
              order={i}
              picked={picked}
              flying={flying}
              onPick={() => !flying && setPicked(a.island)}
            />
          ))}
        </div>
        <footer className="beat-foot">
          <button type="button" className="primary" disabled={picked === null || flying} onClick={confirm}>
            {picked ? '選定' : '選一座島'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export interface IslandRevealProps {
  readonly islands: Readonly<Record<PlayerId, IslandId>>;
  /** Seats in table order (you first). */
  readonly seats: readonly { readonly id: PlayerId; readonly name: string; readonly color: string; readonly isViewer: boolean }[];
  readonly onClose: () => void;
}

/** Everyone's island, dealt and turned up one by one (§11.1), with what each one does. */
export function IslandReveal({ islands, seats, onClose }: IslandRevealProps) {
  // Tap a guild's island to read its full rule text.
  const [open, setOpen] = useState<PlayerId | null>(null);
  return (
    <div className="beat-backdrop draft-backdrop" role="dialog" aria-modal="true" aria-label="島嶼公開">
      <div className="isle-reveal">
        <header className="draft-head">
          <strong>各商會的島</strong>
          <small>點一張卡看完整說明</small>
        </header>
        <div className="isle-deal">
          {seats.map((s, i) => {
            const island = islands[s.id];
            if (!island) return null;
            return (
              <RevealSlot
                key={s.id}
                island={island}
                order={i}
                owner={s.isViewer ? '你' : s.name}
                color={s.color}
                open={open === s.id}
                onToggle={() => setOpen(open === s.id ? null : s.id)}
              />
            );
          })}
        </div>
        <footer className="beat-foot">
          <button type="button" className="primary" onClick={onClose}>
            開始
          </button>
        </footer>
      </div>
    </div>
  );
}

interface DraftSlotProps {
  readonly island: IslandId;
  readonly order: number;
  readonly picked: IslandId | null;
  readonly flying: boolean;
  readonly onPick: () => void;
}

function DraftSlot({ island, order, picked, flying, onPick }: DraftSlotProps) {
  const up = useDealt(DEAL_MS + order * DEAL_GAP_MS);
  const on = picked === island;
  const text = ISLAND_TEXT[island];
  return (
    <button
      type="button"
      className={`isle-slot ${on ? 'on' : ''} ${flying && !on ? 'gone' : ''} ${flying && on ? 'fly' : ''}`}
      title={`${text.pro}。${text.con}`}
      aria-label={ISLAND_LABELS[island]}
      aria-pressed={on}
      disabled={!up}
      onClick={onPick}
    >
      <IslandCard island={island} faceUp={up} selected={on} showFull={on} />
    </button>
  );
}

interface RevealSlotProps {
  readonly island: IslandId;
  readonly order: number;
  readonly owner: string;
  readonly color: string;
  readonly open: boolean;
  readonly onToggle: () => void;
}

function RevealSlot({ island, order, owner, color, open, onToggle }: RevealSlotProps) {
  const up = useDealt(DEAL_MS + order * DEAL_GAP_MS * 2);
  const text = ISLAND_TEXT[island];
  return (
    <span className="isle-owner">
      <span className="isle-owner-tag" style={{ '--seat': color } as CSSProperties}>
        <IslandIcon island={island} />
        {owner}
      </span>
      <button type="button" className="isle-slot" aria-expanded={open} aria-label={`${owner}：${ISLAND_LABELS[island]}`} title={`${text.pro}。${text.con}`} onClick={onToggle}>
        <IslandCard island={island} faceUp={up} showFull={open} size="small" />
      </button>
    </span>
  );
}
