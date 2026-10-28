import type { EventName, EventValue } from '../../analytics/events';

// The browser half of the anonymous play statistics (docs/online/public-launch-plan.md §4.3):
// events wait in a queue and go to /api/events every 30 seconds and when the page is left. Nothing
// is sent when the person turned it off, when the browser asks for privacy (Global Privacy
// Control), or on a local development host (unless the page was opened with ?analytics).

const ID_KEY = 'bmg7.analytics.id';
const OFF_KEY = 'bmg7.analytics.off';
const FIRST_KEY = 'bmg7.analytics.first';
const MATCHES_KEY = 'bmg7.analytics.matches';
const ENDPOINT = '/api/events';
const FLUSH_MS = 30_000;
const MAX_QUEUE = 200;

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Blocked storage: the setting lasts for this page only.
  }
}

const devHost = (): boolean => ['localhost', '127.0.0.1'].includes(location.hostname);
const devOptIn = (): boolean => new URLSearchParams(location.search).has('analytics');

/** The browser itself asks sites not to track (Global Privacy Control). */
export const browserOptedOut = (): boolean => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

export const analyticsOff = (): boolean => storageGet(OFF_KEY) === '1';

export function setAnalyticsOff(off: boolean): void {
  storageSet(OFF_KEY, off ? '1' : null);
  if (off) queue = [];
}

function enabled(): boolean {
  if (analyticsOff() || browserOptedOut()) return false;
  return !devHost() || devOptIn();
}

let memoryId: string | null = null;

/** The random analytics id of this browser; separate from the seat token on purpose. */
function clientId(): string {
  const stored = storageGet(ID_KEY);
  if (stored) return stored;
  memoryId ??= crypto.randomUUID();
  storageSet(ID_KEY, memoryId);
  return memoryId;
}

let queue: { readonly name: EventName; readonly at: number; readonly data: Readonly<Record<string, EventValue>> }[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function flush(leaving = false): void {
  if (queue.length === 0) return;
  const body = JSON.stringify({ client: clientId(), events: queue });
  queue = [];
  try {
    if (leaving && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    void fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch {
    // Statistics never get in the way of the game.
  }
}

function start(): void {
  if (timer !== null) return;
  timer = setInterval(() => flush(), FLUSH_MS);
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
}

/** Records one event (src/analytics/events.ts lists the names and fields the server keeps). */
export function track(name: EventName, data: Readonly<Record<string, EventValue>> = {}): void {
  if (!enabled()) return;
  start();
  queue = [...queue.slice(-(MAX_QUEUE - 1)), { name, at: Date.now(), data }];
}

/** Sends what is queued now, for events that come right before the page may go away. */
export const flushNow = (): void => flush(true);

/** One visit per tab: device, first time or not, days since the first, and where the person came from. */
export function trackVisit(): void {
  if (!enabled()) return;
  try {
    if (sessionStorage.getItem('bmg7.analytics.visited')) return;
    sessionStorage.setItem('bmg7.analytics.visited', '1');
  } catch {
    // Without session storage every page load counts.
  }
  const now = Date.now();
  const first = storageGet(FIRST_KEY);
  if (first === null) storageSet(FIRST_KEY, String(now));
  // Where the person came from: a `?src=ptt` tag on the shared link (in-app browsers often send
  // no referrer), else the referring site's domain.
  let from = (new URLSearchParams(location.search).get('src') ?? '').replace(/[^\w.-]/g, '').slice(0, 40);
  if (from === '') {
    try {
      const referrer = document.referrer ? new URL(document.referrer).hostname : '';
      from = referrer === location.hostname ? '' : referrer;
    } catch {
      from = '';
    }
  }
  const phone = window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768;
  track('visit', {
    device: phone ? 'phone' : 'desktop',
    first: first === null,
    days: first === null ? 0 : Math.max(0, Math.floor((now - Number(first)) / 86_400_000)),
    from,
  });
}

/** Counts this browser's matches; the new count (1 for the first match). */
export function nextMatchNumber(): number {
  const n = (Number(storageGet(MATCHES_KEY)) || 0) + 1;
  storageSet(MATCHES_KEY, String(n));
  return n;
}

/** Uncaught errors and rejections, with where they happened. */
export function trackErrors(screen: () => string): void {
  const report = (message: string) => track('client_error', { message: message.slice(0, 200), screen: screen() });
  window.addEventListener('error', (e) => report(String(e.message || e.error || 'error')));
  window.addEventListener('unhandledrejection', (e) => report(String((e.reason as { message?: string } | undefined)?.message ?? e.reason ?? 'rejection')));
}
