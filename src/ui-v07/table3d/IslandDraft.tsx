import { useState } from 'react';
import type { DecisionContext } from '../../v07/bots';
import type { Action, IslandId, PlayerId } from '../../v07/game';
import { ISLAND_LABELS, ISLAND_TEXT } from '../labels';
import { legalOf } from '../table/forms';
import { IslandGlance } from './IslandGlance';

// The island draft (§11.1, docs/ui/v07-event-presentation.md §1.1): two big island cards over the
// dimmed table, only for you. They glow until you pick one; the pick lifts, the button names it,
// and on confirm the card shrinks away toward your seat. Then everyone's islands are revealed at
// once (`IslandReveal`).

/** How long the chosen card takes to fly to your seat before the choice is submitted. */
const FLY_MS = 650;

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
        <div className="draft-cards">
          {options.map((a) => {
            const text = ISLAND_TEXT[a.island];
            const on = picked === a.island;
            return (
              <button
                key={a.island}
                type="button"
                className={`draft-card ${on ? 'on' : ''} ${picked === null ? 'todo' : ''} ${flying && !on ? 'gone' : ''} ${flying && on ? 'fly' : ''}`}
                title={`${text.pro}。${text.con}`}
                onClick={() => !flying && setPicked(a.island)}
              >
                <b>{ISLAND_LABELS[a.island]}</b>
                <IslandGlance island={a.island} />
                {on && (
                  <span className="draft-full">
                    <span>{text.pro}</span>
                    <span>{text.con}</span>
                  </span>
                )}
              </button>
            );
          })}
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

/** Everyone's island, revealed at once (§11.1), with what each one does. */
export function IslandReveal({ islands, seats, onClose }: IslandRevealProps) {
  // Tap a guild's island to read its full rule text.
  const [open, setOpen] = useState<PlayerId | null>(null);
  return (
    <div className="beat-backdrop draft-backdrop" role="dialog" aria-modal="true" aria-label="島嶼公開">
      <div className="beat-card island-reveal">
        <header className="beat-head">
          <strong>各商會的島</strong>
        </header>
        <ul className="island-list">
          {seats.map((s, i) => {
            const island = islands[s.id];
            if (!island) return null;
            return (
              <li key={s.id} style={{ borderColor: s.color, animationDelay: `${i * 160}ms` }}>
                <button type="button" className="island-item" aria-expanded={open === s.id} title={`${ISLAND_TEXT[island].pro}。${ISLAND_TEXT[island].con}`} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <b>
                    {s.isViewer ? '你' : s.name}：{ISLAND_LABELS[island]}
                  </b>
                  <IslandGlance island={island} />
                </button>
                {open === s.id && (
                  <span className="draft-full">
                    <span>{ISLAND_TEXT[island].pro}</span>
                    <span>{ISLAND_TEXT[island].con}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <footer className="beat-foot">
          <button type="button" className="primary" onClick={onClose}>
            開始
          </button>
        </footer>
      </div>
    </div>
  );
}
