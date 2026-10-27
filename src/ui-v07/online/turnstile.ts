// Cloudflare Turnstile for opening a room (open-questions Q-09): a bot check that is invisible
// for most people. The script loads only when someone opens a room, never on the rest of the game.

/** Cloudflare's always-pass invisible test key; works on localhost only with the test secret in .dev.vars. */
const TEST_SITE_KEY = '1x00000000000000000000BB';
/**
 * The production site key from the Cloudflare dashboard (public, safe to commit): the managed
 * widget for black-market-guild.zx2241384.workers.dev. Its secret is the Worker secret TURNSTILE_SECRET.
 */
const SITE_KEY = '0x4AAAAAAFobuEIvPNME8gE2';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Long enough for someone Cloudflare asks to tick the box (managed mode), not only for the silent check. */
const TIMEOUT_MS = 120_000;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      readonly sitekey: string;
      readonly callback: (token: string) => void;
      readonly 'error-callback': () => void;
      readonly 'expired-callback': () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** The key for this page: the test key on a local development host, the real one elsewhere. */
export function turnstileSiteKey(): string {
  return ['localhost', '127.0.0.1'].includes(location.hostname) ? TEST_SITE_KEY : SITE_KEY;
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile 沒有載入')));
    script.onerror = () => reject(new Error('無法載入驗證，請檢查網路'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/**
 * Runs the check inside `container` (empty unless Cloudflare wants a click) and resolves with the
 * token for the server; null when no site key is configured.
 */
export async function turnstileToken(container: HTMLElement): Promise<string | null> {
  const sitekey = turnstileSiteKey();
  if (sitekey === '') return null;
  const api = await loadTurnstile();
  return new Promise<string>((resolve, reject) => {
    let widget: string | null = null;
    const done = () => {
      clearTimeout(timer);
      if (widget !== null) api.remove(widget);
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('驗證逾時，請再試一次'));
    }, TIMEOUT_MS);
    widget = api.render(container, {
      sitekey,
      callback: (token) => {
        done();
        resolve(token);
      },
      'error-callback': () => {
        done();
        reject(new Error('驗證沒有通過，請再試一次'));
      },
      'expired-callback': () => {
        done();
        reject(new Error('驗證過期，請再試一次'));
      },
    });
  });
}
