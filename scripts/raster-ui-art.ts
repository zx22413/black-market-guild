/**
 * Renders the UI parts from `npm run art:ui` (public/art/ui/*.svg) to PNGs next to them
 * (npm run art:ui:png): `<name>.png` at 2× and `<name>@3x.png` at 3×, for high-density phones. The page uses the PNGs: the SVGs draw their grain with SVG filters
 * (feTurbulence), which the browser re-runs every time a part is painted at a new size, a
 * visible stall when a hand of cards or a panel first appears. The SVGs stay as the sources.
 *
 * Rendered by headless Chrome, so the PNGs look exactly like the SVGs did in the browser. Set
 * CHROME to the browser's executable if it is not in the default macOS location.
 */

/** Node's fs and child_process, loaded untyped: the project compiles scripts without Node type definitions. */
interface Fs {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
}
interface ChildProcess {
  execFileSync(file: string, args: readonly string[], options: { stdio: 'ignore' }): void;
}
interface Process {
  readonly env: Readonly<Record<string, string | undefined>>;
}
const NODE_FS = 'node:fs';
const NODE_CHILD_PROCESS = 'node:child_process';

const DIR = new URL('../public/art/ui/', import.meta.url);
/** Pixels per SVG unit, and the file suffix for each; `uiArtVars` declares the same densities. */
const SCALES = [
  { scale: 2, suffix: '' },
  { scale: 3, suffix: '@3x' },
] as const;
const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function sizeOf(svg: string, name: string): { readonly width: number; readonly height: number } {
  const width = Number(/<svg[^>]*\swidth="([\d.]+)"/.exec(svg)?.[1]);
  const height = Number(/<svg[^>]*\sheight="([\d.]+)"/.exec(svg)?.[1]);
  if (!(width > 0 && height > 0)) throw new Error(`${name}: the <svg> needs numeric width and height`);
  return { width, height };
}

const fs = (await import(NODE_FS)) as Fs;
const { execFileSync } = (await import(NODE_CHILD_PROCESS)) as ChildProcess;
const { env } = (globalThis as unknown as { process: Process }).process;
const chrome = env['CHROME'] ?? DEFAULT_CHROME;

const names = fs.readdirSync(DIR.pathname).filter((name) => name.endsWith('.svg'));
for (const name of names) {
  const source = new URL(name, DIR);
  const { width, height } = sizeOf(fs.readFileSync(source.pathname, 'utf8'), name);
  for (const { scale, suffix } of SCALES) {
    execFileSync(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        `--force-device-scale-factor=${scale}`,
        '--default-background-color=00000000',
        `--window-size=${width},${height}`,
        `--screenshot=${new URL(name.replace(/\.svg$/, `${suffix}.png`), DIR).pathname}`,
        source.href,
      ],
      { stdio: 'ignore' },
    );
  }
}
console.log(`rendered ${names.length} parts at ${SCALES.map((s) => `${s.scale}x`).join(' and ')} into ${DIR.pathname}`);
