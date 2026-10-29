import { childProcess, fs, os, proc, type Child } from './node';

// A tiny Chrome DevTools Protocol client for the trailer capture (scripts/trailer/capture.ts):
// launches headless Chrome with remote debugging and talks to one page over its WebSocket.
// Needs Node's WebSocket (run with --experimental-websocket on Node 20).

const CHROME = proc.env['CHROME'] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/** A port of its own each launch, so a Chrome left over from a crashed run is never picked up. */
const port = (): number => 9300 + Math.floor(Math.random() * 600);

type Listener = (params: Record<string, unknown>) => void;

export interface Page {
  send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>): Promise<T>;
  once(event: string): Promise<Record<string, unknown>>;
  on(event: string, listener: Listener): void;
  close(): void;
}

export async function launch(width: number, height: number): Promise<Page> {
  const PORT = port();
  const profile = fs.mkdtempSync(`${os.tmpdir()}/trailer-chrome-`);
  const chrome: Child = childProcess.spawn(
    CHROME,
    [
      '--headless=new',
      // The Mac's GPU through Metal: SwiftShader (software WebGL) takes about half a second a frame.
      ...(proc.env['TRAILER_SOFTWARE_GL'] ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']),
      '--hide-scrollbars',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      `--window-size=${width},${height}`,
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  // Chrome goes with this script, however it ends.
  proc.on('exit', () => chrome.kill());
  const target = await pageTarget(PORT);
  const socket = new WebSocket(target);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 1;
  const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const listeners = new Map<string, Set<Listener>>();
  socket.addEventListener('message', (message) => {
    const data = JSON.parse(String(message.data)) as { id?: number; result?: unknown; error?: { message: string }; method?: string; params?: Record<string, unknown> };
    if (data.id !== undefined) {
      const w = waiting.get(data.id);
      waiting.delete(data.id);
      if (data.error) w?.reject(new Error(data.error.message));
      else w?.resolve(data.result);
    } else if (data.method) {
      listeners.get(data.method)?.forEach((l) => l(data.params ?? {}));
    }
  });
  const on = (event: string, listener: Listener): void => {
    const set = listeners.get(event) ?? new Set();
    set.add(listener);
    listeners.set(event, set);
  };
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
        socket.send(JSON.stringify({ id, method, params }));
      }),
    once: (event) =>
      new Promise((resolve) => {
        const listener: Listener = (params) => {
          listeners.get(event)?.delete(listener);
          resolve(params);
        };
        on(event, listener);
      }),
    on,
    close: () => {
      socket.close();
      chrome.kill();
    },
  };
}

/** The WebSocket URL of Chrome's first page, once its debugging port answers. */
async function pageTarget(PORT: number): Promise<string> {
  for (let i = 0; i < 100; i++) {
    try {
      const list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome did not open its debugging port');
}
