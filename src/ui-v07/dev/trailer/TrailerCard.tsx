import { useEffect } from 'react';
import { CinnabarChop, GameTitle } from '../../skin/titleMark';
import qrUrl from './qr-video.svg';

// The trailer's overlays (/v07.html?dev=trailer&part=card&card=…), saved as transparent PNGs by
// scripts/trailer/still.ts and laid over the footage by the edit:
//   card=caption&text=…   one line at the foot of the frame (&place=top: at the top); [brackets] mark the gold words
//   card=genre            what kind of game this is, over the opening's crane
//   card=end              the title, how to play and the QR code (to ?src=video)

/** The lines and QR code, as the edit lays them (scripts/trailer/edit.ts asks for the same ones). */
export const END_LINES = { hook: '誰在護航？誰在打劫？', facts: '單人對電腦約 10 分鐘・免註冊・瀏覽器免費玩', scan: '掃描立即玩' } as const;

/** "a[b]c" → text with the bracketed part in gold. */
function gold(text: string) {
  return text.split(/(\[[^\]]*\])/).map((part, i) => (part.startsWith('[') ? <em key={i}>{part.slice(1, -1)}</em> : <span key={i}>{part}</span>));
}

function useReady() {
  useEffect(() => {
    void document.fonts.ready.then(() => {
      document.documentElement.dataset.cardReady = '1';
    });
  }, []);
}

function Caption({ text, top }: { readonly text: string; readonly top: boolean }) {
  useReady();
  return (
    <div className={`trailer-card caption ${top ? 'top' : ''}`}>
      <p>{gold(text)}</p>
    </div>
  );
}

function Genre() {
  useReady();
  return (
    <div className="trailer-card genre">
      <p className="genre-kind">
        <span>3～4 人的</span>
        <span>
          <em>航運貿易</em> × <em>心理博弈</em>
        </span>
      </p>
    </div>
  );
}

function End() {
  useReady();
  return (
    <div className="trailer-card end">
      <div className="end-copy">
        <div className="end-title">
          <GameTitle />
          <CinnabarChop className="end-chop" />
        </div>
        <p className="end-hook">{END_LINES.hook}</p>
        <p className="end-facts">
          {/* One line on a wide screen; on a portrait one it breaks after the first fact. */}
          <span>{END_LINES.facts.slice(0, END_LINES.facts.indexOf('・'))}</span>
          <span className="end-sep">・</span>
          <span>{END_LINES.facts.slice(END_LINES.facts.indexOf('・') + 1)}</span>
        </p>
        <figure className="end-qr">
          <img src={qrUrl} alt="" />
          <figcaption>{END_LINES.scan}</figcaption>
        </figure>
      </div>
    </div>
  );
}

export function TrailerCard() {
  const q = new URLSearchParams(location.search);
  const card = q.get('card');
  if (card === 'end') return <End />;
  if (card === 'genre') return <Genre />;
  return <Caption text={q.get('text') ?? ''} top={q.get('place') === 'top'} />;
}
