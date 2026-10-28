import { useState } from 'react';
import { flushNow, track } from './track';
import type { MatchMode } from './matchStats';

// The result screen's one-tap question (docs/online/public-launch-plan.md §4.4): 👍／👎, an
// optional line, and the outside survey once its link exists. Asked until answered once.

/** The outside survey (a Google form); empty until there is one, and then the link stays hidden. */
export const SURVEY_URL = '';

const ANSWERED_KEY = 'bmg7.feedback.answered';
const TEXT_MAX = 200;

function answeredBefore(): boolean {
  try {
    return localStorage.getItem(ANSWERED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberAnswered(): void {
  try {
    localStorage.setItem(ANSWERED_KEY, '1');
  } catch {
    // Blocked storage: the question comes back next match.
  }
}

export function FeedbackBox({ mode }: { readonly mode: MatchMode }) {
  const [hidden] = useState(answeredBefore);
  const [like, setLike] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  if (hidden) return null;

  const send = (withText: boolean) => {
    if (like === null) return;
    track('feedback', { like, text: withText ? text.trim().slice(0, TEXT_MAX) : '', mode });
    flushNow();
    rememberAnswered();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="feedback-box">
        <p>謝謝你的回饋！</p>
        {SURVEY_URL && (
          <a href={SURVEY_URL} target="_blank" rel="noreferrer">
            想多說一點？填 1 分鐘的問卷
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="feedback-box">
      <p>這局好玩嗎？</p>
      <div className="feedback-choices" role="radiogroup" aria-label="這局好玩嗎">
        <button type="button" role="radio" aria-checked={like === true} className={like === true ? 'on' : ''} onClick={() => setLike(true)}>
          👍 好玩
        </button>
        <button type="button" role="radio" aria-checked={like === false} className={like === false ? 'on' : ''} onClick={() => setLike(false)}>
          👎 不太行
        </button>
      </div>
      {like !== null && (
        <>
          <textarea
            value={text}
            maxLength={TEXT_MAX}
            rows={2}
            placeholder={like ? '哪裡最好玩？（選填）' : '哪裡卡住或看不懂？（選填）'}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="feedback-send">
            <button type="button" onClick={() => send(false)}>
              不用了
            </button>
            <button type="button" className="primary" onClick={() => send(true)}>
              送出
            </button>
          </div>
        </>
      )}
    </div>
  );
}
