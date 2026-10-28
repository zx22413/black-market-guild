import { useState } from 'react';
import { analyticsOff, browserOptedOut, setAnalyticsOff } from './track';

// The main menu's quiet footnote about the anonymous statistics (docs/online/public-launch-plan.md
// §4.3): one small line; pressed, it says what is kept and offers 「不要記錄」.

export function PrivacyNote() {
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState(analyticsOff);
  const askedByBrowser = browserOptedOut();
  return (
    <div className="menu-privacy">
      <button type="button" className="menu-privacy-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        匿名統計
      </button>
      {open && (
        <div className="menu-privacy-card" role="dialog" aria-label="匿名統計">
          <p>
            為了改進遊戲，我們會記錄匿名的遊玩統計：玩到第幾回合、有沒有玩完、載入多久、在哪裡出錯。不記商會名稱，也不記 IP 位址。
          </p>
          {askedByBrowser ? (
            <p>你的瀏覽器已要求網站不要追蹤，所以不會記錄。</p>
          ) : (
            <label className="menu-privacy-toggle">
              <input
                type="checkbox"
                checked={off}
                onChange={(e) => {
                  setAnalyticsOff(e.target.checked);
                  setOff(e.target.checked);
                }}
              />
              不要記錄
            </label>
          )}
          <button type="button" className="menu-small" onClick={() => setOpen(false)}>
            關閉
          </button>
        </div>
      )}
    </div>
  );
}
