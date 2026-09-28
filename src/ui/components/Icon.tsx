import { useState } from 'react';
import { ICON_FALLBACKS, iconUrl, type IconKey } from '../art';

interface IconProps {
  readonly name: IconKey;
  readonly size?: number;
  readonly label?: string;
}

/** Placeholder icon: the SVG from public/art when present, otherwise a text glyph. */
export function Icon({ name, size = 24, label }: IconProps) {
  const [missing, setMissing] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.8 };
  if (missing) {
    return (
      <span className="icon icon-glyph" style={style} role="img" aria-label={label ?? name}>
        {ICON_FALLBACKS[name]}
      </span>
    );
  }
  return <img className="icon" style={style} src={iconUrl(name)} alt={label ?? ''} onError={() => setMissing(true)} />;
}
