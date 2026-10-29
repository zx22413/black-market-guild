import { launch } from './cdp';
import { args, bytes, fs } from './node';

// Films a trailer page (src/ui-v07/dev/trailer) frame by frame: the page's clock is virtual
// (virtualTime.js), so each frame is drawn at an exact time and saved however long it takes to
// draw. Needs the dev server (npm run dev) and Node's WebSocket:
//
//   node --experimental-websocket --import tsx scripts/trailer/capture.ts \
//     --page "dev=trailer&part=game" --out <dir> --clip invest:1100-3500 --clip strike:79900-80700:2 \
//     [--fps 60] [--size 1280x720] [--scale 1.5] [--every 1]
//
// Each --clip name:a-b[:slow] saves the page's ms a..b (counted from when the page says it is
// ready, window.__trailer.ready) to <out>/<name>/frame-00000.jpg…, filmed `slow` times slower (2:
// slow motion at half speed, 0.5: twice as fast). Between clips the page plays on unsaved. Without
// clips, --from/--to (default 0–20000) is one clip named "all". --every N keeps every Nth frame
// (a quick contact sheet). Writes <out>/marks.json: the moments and sounds the page noted.

const opts = args();
const opt = (name: string, fallback: string): string => opts.get(name)?.[0] ?? fallback;
const pageQuery = opts.get('page')?.[0];
const out = opts.get('out')?.[0];
if (!pageQuery || !out) throw new Error('--page and --out are required');

const [width, height] = opt('size', '1280x720').split('x').map(Number) as [number, number];
const scale = Number(opt('scale', '1.5'));
const fps = Number(opt('fps', '60'));
const every = Math.max(1, Number(opt('every', '1')));
const quality = Number(opt('quality', '92'));
const base = opt('base', 'http://localhost:5173/v07.html');

interface Clip {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly slow: number;
}
const clips: readonly Clip[] = (opts.get('clip') ?? [`all:${opt('from', '0')}-${opt('to', '20000')}`])
  .map((spec) => {
    const [name = '', range = '', slow = '1'] = spec.split(':');
    const [from = 0, to = 0] = range.split('-').map(Number);
    return { name, from, to, slow: Number(slow) };
  })
  .sort((a, b) => a.from - b.from);
clips.forEach((c, i) => {
  if (!c.name || !(c.to > c.from) || !(c.slow > 0)) throw new Error(`bad --clip ${c.name}`);
  if (i > 0 && c.from < clips[i - 1]!.to) throw new Error(`--clip ${c.name} overlaps ${clips[i - 1]!.name}`);
});
const frameMs = 1000 / fps;

fs.mkdirSync(out, { recursive: true });
const page = await launch(width, height);
const evaluate = async <T>(expression: string): Promise<T> =>
  (await page.send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true })).result.value;

await page.send('Page.enable');
await page.send('Runtime.enable');
page.on('Runtime.exceptionThrown', (p) => console.error('page error:', JSON.stringify(p).slice(0, 400)));
await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(new URL('./virtualTime.js', import.meta.url).pathname, 'utf8') });
const loaded = page.once('Page.loadEventFired');
await page.send('Page.navigate', { url: `${base}?${pageQuery}` });
await loaded;

// Warm up: keep the clock moving (timers and frames) while models load in real time.
const started = Date.now();
while (!(await evaluate<boolean>('window.__trailer?.ready === true'))) {
  if (Date.now() - started > 180_000) throw new Error('the page never said it was ready');
  await evaluate('__vt.step(1000 / 60)');
  await new Promise((r) => setTimeout(r, 20));
}
const zero = await evaluate<number>('window.__trailer.start');
console.log(`ready after ${((Date.now() - started) / 1000).toFixed(1)} s`);

// Page time since ready: a warm-up step may have run past the moment it said so.
let t = (await evaluate<number>('__vt.now')) - zero;
const filmStart = Date.now();
let total = 0;
for (const clip of clips) {
  const dir = `${out}/${clip.name}`;
  fs.mkdirSync(dir, { recursive: true });
  // Play on, unsaved, up to the clip.
  while (t + frameMs <= clip.from) {
    await evaluate(`__vt.step(${frameMs})`);
    t += frameMs;
  }
  if (t < clip.from) {
    await evaluate(`__vt.step(${clip.from - t})`);
    t = clip.from;
  }
  let frame = 0;
  let saved = 0;
  while (t < clip.to) {
    if (frame % every === 0) {
      const shot = await page.send<{ data: string }>('Page.captureScreenshot', { format: 'jpeg', quality });
      fs.writeFileSync(`${dir}/frame-${String(saved).padStart(5, '0')}.jpg`, bytes(shot.data));
      saved += 1;
      total += 1;
      if (total % 120 === 0) console.log(`${total} frames, page time ${(t / 1000).toFixed(2)} s, ${((Date.now() - filmStart) / total).toFixed(0)} ms each`);
    }
    frame += 1;
    const step = frameMs / clip.slow;
    await evaluate(`__vt.step(${step})`);
    t += step;
  }
  console.log(`${clip.name}: ${saved} frames`);
}

const marks = await evaluate<unknown>('window.__trailer.marks');
const cues = await evaluate<unknown>('window.__trailer.cues');
fs.writeFileSync(`${out}/marks.json`, JSON.stringify({ fps, every, clips, marks, cues }, null, 2));
console.log(`saved ${total} frames to ${out}`);
page.close();
