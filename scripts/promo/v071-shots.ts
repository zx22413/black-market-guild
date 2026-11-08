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
await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

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

// The five ships, one close-up each, and the whole fleet on the table.
for (const ship of SHIPS) {
  await open(`/v07.html?dev=ships&view=close&ship=${ship}`, 6000);
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
