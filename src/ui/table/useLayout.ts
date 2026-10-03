import { useEffect, useState } from 'react';

/**
 * Which screen layout the table uses: the full desktop layout, a phone held upright, or a phone
 * on its side (short). The HUD's CSS keys off it (`data-layout` on the scene root), and so do the
 * camera's safe area and how far floating cards keep from the edges.
 */
export type Layout = 'desktop' | 'portrait' | 'landscape';

export function layoutFor(width: number, height: number): Layout {
  if (height < 500 && width > height) return 'landscape';
  if (width < 700) return 'portrait';
  return 'desktop';
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(() => layoutFor(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const update = () => setLayout(layoutFor(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return layout;
}
