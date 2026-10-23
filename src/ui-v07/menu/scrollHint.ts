/**
 * Marks a panel that has more below the fold (`data-more="true"`, drawn by menu.css as a fade
 * and a chevron), so a panel that has to scroll on a short phone screen says so. Returns the cleanup.
 */
export function watchScrollHint(panel: HTMLElement): () => void {
  const update = () => {
    const more = panel.scrollHeight - panel.clientHeight > 4 && panel.scrollTop + panel.clientHeight < panel.scrollHeight - 4;
    if (more) panel.dataset.more = 'true';
    else delete panel.dataset.more;
  };
  update();
  panel.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  const mutations = new MutationObserver(update);
  mutations.observe(panel, { childList: true, subtree: true, characterData: true });
  const sizes = new ResizeObserver(update);
  sizes.observe(panel);
  return () => {
    sizes.disconnect();
    panel.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    mutations.disconnect();
    delete panel.dataset.more;
  };
}

/** Panels that may scroll on a small screen: the menu pages, the rules book's spread and the tutorial host's card. */
const PANELS = '.menu-panel, .rules-spread, .coach';

/** Watches every such panel that appears on the page (pages, the lobby and the book come and go); returns the cleanup. */
export function watchMenuPanels(): () => void {
  const watching = new Map<HTMLElement, () => void>();
  const scan = () => {
    const live = new Set(document.querySelectorAll<HTMLElement>(PANELS));
    for (const panel of live) if (!watching.has(panel)) watching.set(panel, watchScrollHint(panel));
    for (const [panel, stop] of watching) {
      if (live.has(panel)) continue;
      stop();
      watching.delete(panel);
    }
  };
  scan();
  const pages = new MutationObserver(scan);
  pages.observe(document.body, { childList: true, subtree: true });
  return () => {
    pages.disconnect();
    for (const stop of watching.values()) stop();
    watching.clear();
  };
}
