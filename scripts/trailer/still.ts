import { launch } from './cdp';
import { args, bytes, fs } from './node';

// Saves one trailer overlay page (captions, the end card) as a PNG with a transparent background,
// for the edit to lay over the footage (scripts/trailer/edit.ts):
//
//   node --experimental-websocket --import tsx scripts/trailer/still.ts --page "dev=trailer&part=card&card=end" --out end.png

const opts = args();
const pageQuery = opts.get('page')?.[0];
const out = opts.get('out')?.[0];
if (!pageQuery || !out) throw new Error('--page and --out are required');
const [width, height] = (opts.get('size')?.[0] ?? '1280x720').split('x').map(Number) as [number, number];
const scale = Number(opts.get('scale')?.[0] ?? '1.5');
const base = opts.get('base')?.[0] ?? 'http://localhost:5173/v07.html';

const page = await launch(width, height);
await page.send('Page.enable');
await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
const loaded = page.once('Page.loadEventFired');
await page.send('Page.navigate', { url: `${base}?${pageQuery}` });
await loaded;
const ready = async (): Promise<boolean> =>
  (await page.send<{ result: { value: boolean } }>('Runtime.evaluate', { expression: "document.fonts.status === 'loaded' && document.documentElement.dataset.cardReady === '1'", returnByValue: true })).result.value;
const started = Date.now();
while (!(await ready())) {
  if (Date.now() - started > 30_000) throw new Error('the card never said it was ready');
  await new Promise((r) => setTimeout(r, 100));
}
const shot = await page.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, bytes(shot.data));
console.log(`saved ${out}`);
page.close();
