import { useEffect } from 'react';
import { track } from '../analytics/track';
import { CloseIcon } from '../table3d/icons';
import { DEV_LOG, LATEST_VERSION } from './entries';
import { markDevLogSeen } from './seen';
import './devlog.css';

// The 開發日誌 popup over the main menu: every version's notes, newest first.

interface DevLogPanelProps {
  readonly onClose: () => void;
}

export function DevLogPanel({ onClose }: DevLogPanelProps) {
  useEffect(() => {
    markDevLogSeen(LATEST_VERSION);
    track('devlog_open', { version: LATEST_VERSION });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="devlog-backdrop" role="dialog" aria-modal="true" aria-labelledby="devlog-title" onClick={onClose}>
      <div className="menu-panel devlog-card" onClick={(e) => e.stopPropagation()}>
        <header className="devlog-head">
          <h2 id="devlog-title">開發日誌</h2>
          <button type="button" className="devlog-close" aria-label="關閉" title="關閉" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="devlog-scroll">
          {DEV_LOG.map((entry, index) => (
            <article key={entry.version} className="devlog-entry">
              <h3>
                <span className="devlog-version">{entry.version}</span>
                {index === 0 && <span className="menu-tag">最新</span>}
                <time>{entry.date}</time>
              </h3>
              <p className="devlog-title">{entry.title}</p>
              <p className="devlog-summary">{entry.summary}</p>
              {entry.sections.map((section) => (
                <section key={section.title}>
                  <h4>{section.title}</h4>
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
