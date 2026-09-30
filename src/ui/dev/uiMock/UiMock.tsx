import { useEffect, useRef, type CSSProperties } from 'react';
import { MixHud } from './MixHud';
import { MockHud } from './MockHud';
import { MockScene, type Tone, type Variant } from './MockScene';
import './uiMock.css';

/**
 * Dev-only UI style mock-up (`/?dev=ui-mock`), see docs/ui/style-guide.md. Query parameters:
 * - `v`: `flat` (default) — no plates, text straight on the scene; `props` — guild info on 3D props;
 *   `mix` — pale wood boards, parchment and small accents
 * - `font`: `wenkai` (default), `iansui` or `song` (system serif)
 * - `tone`: `now` (default, the game's turquoise sea) or `ftk` (navy sea, rejected)
 */
const FONTS = {
  wenkai: { family: "'LXGW WenKai TC'", css: 'LXGW+WenKai+TC:wght@400;700' },
  iansui: { family: "'Iansui'", css: 'Iansui' },
  song: { family: "'Songti TC', 'Noto Serif TC'", css: null },
} as const;
type FontKey = keyof typeof FONTS;

function parse(search: string): { variant: Variant; font: FontKey; tone: Tone } {
  const q = new URLSearchParams(search);
  const font = q.get('font');
  return {
    variant: q.get('v') === 'props' ? 'props' : q.get('v') === 'mix' ? 'mix' : 'flat',
    font: font === 'iansui' || font === 'song' ? font : 'wenkai',
    tone: q.get('tone') === 'ftk' ? 'ftk' : 'now',
  };
}

/** Loads a Google Fonts family for the mock-up only; the game itself ships no web font yet. */
function useWebFont(css: string | null) {
  useEffect(() => {
    if (!css) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${css}&display=swap`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [css]);
}

export function UiMock() {
  const { variant, font, tone } = parse(window.location.search);
  const { family, css } = FONTS[font];
  useWebFont(css);
  const labels = useRef(new Map<string, HTMLElement>());
  const pin = (id: string) => (element: HTMLElement | null) => {
    if (element) labels.current.set(id, element);
    else labels.current.delete(id);
  };
  return (
    <div className={`mk-root tone-${tone}`} style={{ '--mk-font': family } as CSSProperties}>
      <MockScene variant={variant} tone={tone} font={family} labels={labels} />
      {variant === 'mix' ? <MixHud pin={pin} /> : <MockHud variant={variant} pin={pin} />}
    </div>
  );
}
