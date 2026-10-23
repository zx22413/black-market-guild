import { useState } from 'react';
import { CloseIcon } from '../table3d/icons';
import { RULES_TABS, RulesEntries, type RulesTab } from '../table3d/RulesPanel';
import { BrassCorner } from './skinLabArt';
import './skinLabBook.css';

// The rules panel for the skin lab (dev/SkinLabPreview.tsx): as it is now, and as a ship's handbook.
// Both use the real tabs and entries from table3d/RulesPanel.tsx. The book's thumb-index tabs are
// the chapter tabs (the open chapter's tab sticks out furthest, in page colour); the text runs over
// two pages on wide screens and one page on phones, where the tabs move to the top edge.

/** The rules panel as it is now (its real classes, sitting in the lab cell). */
export function RulesNow() {
  const [tab, setTab] = useState<RulesTab>('roles');
  return (
    <div className="beat-card rules-panel lab-static">
      <nav className="rules-tabs" role="tablist">
        {RULES_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <button type="button" className="rules-close" aria-label="關閉" title="關閉">
          <CloseIcon />
        </button>
      </nav>
      <ul className="rules-list lab-rules-scroll">
        <RulesEntries tab={tab} />
      </ul>
    </div>
  );
}

/** The rules as a handbook: leather cover, a two-page spread, thumb-index tabs for the chapters. */
export function RulesBook() {
  const [tab, setTab] = useState<RulesTab>('roles');
  const label = RULES_TABS.find((t) => t.id === tab)?.label ?? '';
  return (
    <div className="bk">
      <nav className="bk-index" role="tablist" aria-label="規則章節">
        {RULES_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`bk-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="bk-cover">
        <div className="bk-spread" role="tabpanel" aria-label={label}>
          <header className="bk-run">
            <span>規則</span>
            <span>{label}</span>
          </header>
          <ul className="rules-list bk-list">
            <RulesEntries tab={tab} />
          </ul>
        </div>
        <button type="button" className="bk-close" aria-label="闔上" title="闔上">
          <CloseIcon />
        </button>
        <BrassCorner at="tl" />
        <BrassCorner at="bl" />
      </div>
    </div>
  );
}
