import { launch } from '../trailer/cdp';
import { args, bytes, fs, proc } from '../trailer/node';

// Stills for the V0.7.1 announcement posts (docs/promo/update-v071.md), taken from the dev previews
// and the real main menu; no game state is faked. Needs the dev server (npm run dev):
//
//   node --experimental-websocket --import tsx scripts/promo/v071-shots.ts --out promo-out/v071 [--base http://localhost:5173]

const opts = args();
const out = opts.get('out')?.[0];
if (!out) throw new Error('--out is required');
const base = opts.get('base')?.[0] ?? 'http://localhost:5173';
const SHIPS = ['standard', 'gambler', 'freighter', 'hidden', 'breaker'] as const;

fs.mkdirSync(out, { recursive: true });
const page = await launch(1920, 1080);
await page.send('Page.enable');
await page.send('Runtime.enable');
const viewport = (width: number, height: number, scale: number): Promise<unknown> =>
  page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
await viewport(1920, 1080, 1);

const evaluate = async <T>(expression: string): Promise<T> =>
  (await page.send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const open = async (path: string, settle: number): Promise<void> => {
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url: `${base}${path}` });
  await loaded;
  await sleep(settle);
};
const save = async (name: string): Promise<void> => {
  const shot = await page.send<{ data: string }>('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  fs.writeFileSync(`${out}/${name}.jpg`, bytes(shot.data));
  console.log(`saved ${out}/${name}.jpg`);
};
const clickText = (text: string) =>
  evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(text)}))?.click() ?? false`);

// The five ships, one close-up each, over the real island bases (seat order: standard and breaker
// sit at seat 0, then gambler, freighter, hidden at seats 1 to 3).
const ISLANDS = 'lighthouse,spice-isles,fortress,pirate-cove';
for (const ship of SHIPS) {
  await open(`/v07.html?dev=ships&view=close&ship=${ship}&islands=${ISLANDS}`, 6000);
  await save(`ship-${ship}`);
}

// The real main menu over the live table, then the dev log over it.
await open('/', 1500);
await evaluate(`document.querySelector('.start-gate')?.click()`);
await sleep(6000);
await save('menu-table');
await clickText('開發日誌');
await sleep(2500);
await save('devlog-popup');

// The store covers: the lobby's title card over the islands (the same page at three sizes), and the
// share-link card (public/og-card.jpg is this one).
await viewport(1280, 720, 1.5);
await open('/v07.html?dev=trailer&part=cover', 7000);
await save('cover-wide-1920x1080');
await viewport(630, 500, 2);
await open('/v07.html?dev=trailer&part=cover', 7000);
await save('cover-itch-1260x1000');
await viewport(540, 960, 2);
await open('/v07.html?dev=trailer&part=cover&format=tall', 7000);
await save('cover-tall-1080x1920');
await viewport(1200, 630, 1);
await open('/v07.html?dev=og-card', 9000);
await save('og-card');
await viewport(1920, 1080, 1);

// A real match (you against three bots, seed 3) played up to the voyage, for the screenshots that
// show the ship choice: the islands revealed, the ship hand, a ship's dice table, loading cargo, and
// frames of the voyage (the role hand is left out: its customs and diplomat art is still the old one).
const waitFor = async (expression: string, timeout = 40_000): Promise<void> => {
  const started = Date.now();
  while (!(await evaluate<boolean>(expression))) {
    if (Date.now() - started > timeout) {
      await save('debug-timeout');
      const buttons = await evaluate<string>(`[...document.querySelectorAll('button')].map((b) => b.className + '|' + b.textContent.trim().slice(0, 20)).join(' ; ')`);
      throw new Error(`never saw: ${expression}\nbuttons: ${buttons}`);
    }
    await sleep(250);
  }
};
const byText = (text: string, exact = false) =>
  `[...document.querySelectorAll('button')].find((b) => ${exact ? `b.textContent.trim() === ${JSON.stringify(text)}` : `b.textContent.includes(${JSON.stringify(text)})`})`;
const press = (expression: string) => evaluate(`${expression}?.click()`);

await open('/v07.html?dev=round3d&seed=3', 2000);
await waitFor(`document.querySelectorAll('.isle-slot').length === 2`);
await press(`document.querySelectorAll('.isle-slot')[1]`);
await sleep(800);
await waitFor(`!!${byText('選定', true)}`);
await press(byText('選定', true));
await waitFor(`!!${byText('開始', true)}`);
await sleep(3500);
await save('game-islands');
await press(byText('開始', true));
await waitFor(`document.querySelectorAll('.ship-card').length >= 5`);
await sleep(4000);
await save('game-ship-pick');
await press(`document.querySelectorAll('.ship-card')[1]`);
await sleep(3500);
await save('game-ship-gambler');
await press(`document.querySelectorAll('.ship-card')[2]`);
await sleep(3500);
await save('game-ship-freighter');
await press(`document.querySelectorAll('.ship-card')[1]`);
await sleep(1500);
await press(byText('裝貨', true));
await waitFor(`!!document.querySelector('.cargo-card.good-arms')`);
await sleep(3000);
for (const good of ['arms', 'spice', 'wood']) {
  await press(`document.querySelector('.cargo-card.good-${good}')`);
  await sleep(1300);
}
await sleep(1500);
await save('game-cargo');
await press(`document.querySelector('.seal-submit')`);
await waitFor(`!!document.querySelector('.dep-card.none')`);
await sleep(2500);
await press(`document.querySelector('.dep-card.none')`);
await sleep(800);
await press(`document.querySelector('.seal-submit')`);
await waitFor(`!!${byText('開始航程')}`, 60_000);
await sleep(1500);
await save('game-fleet-sailing');
await press(byText('開始航程'));
for (let i = 0; i < 8; i++) {
  await sleep(2200);
  await save(`game-voyage-${i}`);
}

// The cover: the five ships side by side under the version title, laid out as a page of its own.
const CARDS = [
  ['standard', '信天翁號', '基準款・船費 0'],
  ['gambler', '孤注號', '5、6 才賺・250%'],
  ['freighter', '巨鯨號', '不會沉・隔回合靠岸'],
  ['hidden', '幽靈號', '海關查不到它的貨'],
  ['breaker', '海嘯號', '不封頂・最高 300%'],
] as const;
const cards = CARDS.map(
  ([id, name, note]) =>
    `<figure><img src="file://${proc.cwd()}/${out}/ship-${id}.jpg"><figcaption><b>${name}</b><span>${note}</span></figcaption></figure>`,
).join('');
const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1920px;height:1080px;background:#10262c;color:#f4ead2;font-family:'PingFang TC','Noto Sans TC',sans-serif;overflow:hidden}
header{padding:50px 90px 24px}h1{margin:0;font-size:110px;letter-spacing:6px}h1 small{font-size:48px;color:#d9b25a;margin-left:24px;letter-spacing:2px}
p{margin:14px 0 0;font-size:44px;color:#e8dab8}
main{display:flex;gap:22px;padding:0 90px}figure{margin:0;flex:1;border:4px solid #4a2f1b;border-radius:14px;overflow:hidden;background:#2a190d}
img{display:block;width:100%;height:460px;object-fit:cover;object-position:50% 70%}
figcaption{padding:16px 18px;display:flex;flex-direction:column;gap:6px}figcaption b{font-size:40px;color:#d9b25a}figcaption span{font-size:27px}
footer{position:absolute;left:90px;bottom:22px;font-size:34px;color:#d9b25a}
</style><header><h1>暗潮商戰<small>V0.7.1 船艙改版</small></h1><p>建築退場，五艘船登場：每回合先選船，風險自己挑</p></header><main>${cards}</main><footer>contrabay.lbdog.uk</footer>`;
fs.writeFileSync(`${out}/cover.html`, html);
await open(`/`, 0).catch(() => undefined);
const loaded = page.once('Page.loadEventFired');
await page.send('Page.navigate', { url: `file://${proc.cwd()}/${out}/cover.html` });
await loaded;
await sleep(1500);
await save('cover-v071-1920x1080');
fs.rmSync(`${out}/cover.html`, { recursive: false, force: true });
page.close();
