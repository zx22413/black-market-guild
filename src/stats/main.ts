import './stats.css';

// The /stats dashboard (docs/online/public-launch-plan.md §4.4): asks for the admin key once,
// keeps it in this browser, and draws the numbers from /api/stats with plain DOM and SVG.

type Row = Record<string, unknown>;

interface LiveMatch {
  readonly startedMinutesAgo: number;
  readonly lastMinutesAgo: number;
  readonly round: number | null;
}

interface Stats {
  readonly since: string;
  readonly live: { readonly active: readonly LiveMatch[]; readonly quiet: readonly LiveMatch[] };
  readonly funnel: Readonly<Record<'visitors' | 'started' | 'finished' | 'again' | 'invited' | 'guestsFinished', number>>;
  readonly daily: readonly Row[];
  readonly quits: readonly Row[];
  readonly tutorials: readonly Row[];
  readonly chapters: readonly Row[];
  readonly likes: readonly Row[];
  readonly comments: readonly Row[];
  readonly errors: readonly Row[];
  readonly ready: readonly Row[];
  readonly modes: readonly Row[];
  readonly sources: readonly Row[];
  readonly welcome: readonly Row[];
}

const KEY = 'bmg7.admin.key';
const root = document.getElementById('stats')!;

const LESSONS: Readonly<Record<string, string>> = {
  basics: '基礎',
  guard: '護衛',
  pirate: '海盜',
  intel: '情報商人',
  smuggler: '走私商人',
  'arms-cover': '軍火掩護',
  broker: '莊家',
  islands: '開局選島',
};
const CHAPTERS: Readonly<Record<string, string>> = { roles: '角色', islands: '島嶼', buildings: '建築', goods: '貨品', events: '事件', score: '計分', online: '連線' };
const MODES: Readonly<Record<string, string>> = { local: '單機', hotseat: '同機輪流', online: '線上' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Readonly<Record<string, string>> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  node.append(...children);
  return node;
}

const num = (value: unknown): number => Number(value ?? 0) || 0;
const pct = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

function card(title: string, body: Node, wide = false): HTMLElement {
  return el('section', { class: wide ? 'card wide' : 'card' }, el('h2', {}, title), body);
}

/** Horizontal bars: one per item, scaled to the largest. */
function bars(items: readonly { readonly label: string; readonly value: number; readonly note?: string }[]): Node {
  if (items.length === 0) return el('p', { class: 'empty' }, '還沒有資料');
  const max = Math.max(...items.map((i) => i.value), 1);
  return el(
    'div',
    { class: 'bars' },
    ...items.map((item) => {
      const fill = el('div', { class: 'fill' });
      fill.style.width = `${(item.value / max) * 100}%`;
      return el('div', { class: 'bar' }, el('span', { class: 'label', title: item.label }, item.label), el('div', { class: 'track' }, fill), el('span', { class: 'num' }, item.note ?? String(item.value)));
    }),
  );
}

/** Daily visitors as stacked columns, phones and computers. */
function dailyChart(rows: readonly Row[], since: string): Node {
  const days: string[] = [];
  for (let d = new Date(`${since}T00:00:00Z`); days.length < 31; d = new Date(d.getTime() + 86_400_000)) days.push(d.toISOString().slice(0, 10));
  const of = (day: string, device: string) => num(rows.find((r) => r.day === day && r.device === device)?.n);
  const totals = days.map((d) => of(d, 'phone') + of(d, 'desktop'));
  if (totals.every((t) => t === 0)) return el('p', { class: 'empty' }, '還沒有資料');
  const max = Math.max(...totals, 1);
  const w = 640;
  const h = 160;
  const col = w / days.length;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h + 18}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '每日進站人數');
  days.forEach((day, i) => {
    let y = h;
    (['desktop', 'phone'] as const).forEach((device) => {
      const n = of(day, device);
      if (n === 0) return;
      const bh = (n / max) * (h - 14);
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(i * col + 2));
      rect.setAttribute('y', String(y - bh));
      rect.setAttribute('width', String(col - 4));
      rect.setAttribute('height', String(bh));
      rect.setAttribute('fill', device === 'phone' ? 'var(--b)' : 'var(--a)');
      const tip = document.createElementNS(ns, 'title');
      tip.textContent = `${day} ${device === 'phone' ? '手機' : '電腦'} ${n} 人`;
      rect.append(tip);
      svg.append(rect);
      y -= bh;
    });
    if (i % 5 === 0 && i < days.length - 3) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', String(i * col + 2));
      label.setAttribute('y', String(h + 14));
      label.textContent = day.slice(5);
      svg.append(label);
    }
  });
  const legend = el('div', { class: 'legend' }, el('span', {}, el('i', { style: 'background:var(--a)' }), '電腦'), el('span', {}, el('i', { style: 'background:var(--b)' }), '手機'));
  return el('div', {}, svg, legend);
}

/** Before a deploy: online matches that are probably running (a deploy would end them). */
function liveCard(live: Stats['live']): HTMLElement {
  const count = live.active.length;
  const row = (m: LiveMatch) =>
    el('tr', {}, el('td', {}, `${m.startedMinutesAgo} 分鐘前開局`), el('td', {}, m.round === null ? '第 1 回合前' : `打完第 ${m.round} 回合`), el('td', {}, `最後動作 ${m.lastMinutesAgo} 分鐘前`));
  const verdict = el('p', { class: `live-verdict ${count > 0 ? 'busy' : 'clear'}` }, count > 0 ? `大概有 ${count} 局正在進行，部署會中斷它們` : '目前看起來沒有人在線上對局，可以部署');
  return card(
    '目前線上對局（部署前看這裡）',
    el(
      'div',
      {},
      verdict,
      ...(count > 0 ? [el('table', {}, ...live.active.map(row))] : []),
      ...(live.quiet.length > 0 ? [el('p', { class: 'sub' }, `另有 ${live.quiet.length} 局開了沒結束、但已超過 15 分鐘沒動作（多半已離開）`)] : []),
      el('p', { class: 'sub' }, '由統計推算：關閉「匿名統計」的人看不到，只能當參考。單機對局在瀏覽器裡跑，部署通常不影響。'),
    ),
    true,
  );
}

function render(stats: Stats): void {
  const f = stats.funnel;
  const funnel = bars([
    { label: '進站', value: f.visitors },
    { label: '開始對局', value: f.started, note: `${f.started}（${pct(f.started, f.visitors)}）` },
    { label: '打完一局', value: f.finished, note: `${f.finished}（${pct(f.finished, f.started)}）` },
    { label: '再玩一局', value: f.again, note: `${f.again}（${pct(f.again, f.finished)}）` },
    { label: '邀請朋友', value: f.invited, note: `${f.invited}（${pct(f.invited, f.finished)}）` },
    { label: '朋友玩完', value: f.guestsFinished },
  ]);
  const likes = num(stats.likes.find((r) => num(r.like) === 1)?.n);
  const dislikes = num(stats.likes.find((r) => num(r.like) === 0)?.n);
  const comments = stats.comments.length
    ? el(
        'table',
        {},
        ...stats.comments.map((c) =>
          el('tr', {}, el('td', {}, String(c.day ?? '')), el('td', { class: num(c.like) === 1 ? 'like' : 'dislike' }, num(c.like) === 1 ? '👍' : '👎'), el('td', {}, String(c.text ?? ''))),
        ),
      )
    : el('p', { class: 'empty' }, '還沒有留言');
  const errors = stats.errors.length
    ? el('table', {}, ...stats.errors.map((e) => el('tr', {}, el('td', {}, String(e.n)), el('td', {}, String(e.screen ?? '')), el('td', {}, String(e.message ?? '')))))
    : el('p', { class: 'empty' }, '最近 30 天沒有錯誤');

  root.replaceChildren(
    el(
      'div',
      { class: 'head' },
      el('div', {}, el('h1', {}, '遊玩統計'), el('p', { class: 'sub' }, `每日圖表從 ${stats.since} 起；漏斗與其他數字是全部期間（人數以瀏覽器計）`)),
      el('div', {}, refreshButton(), logoutButton()),
    ),
    el(
      'div',
      { class: 'grid' },
      liveCard(stats.live),
      card('漏斗', funnel),
      card('一鍵評分', el('div', {}, bars([{ label: '👍 好玩', value: likes }, { label: '👎 不太行', value: dislikes }]), el('p', { class: 'sub' }, `好評 ${pct(likes, likes + dislikes)}`))),
      card('每日進站人數', dailyChart(stats.daily, stats.since), true),
      card('從哪裡來（人數）', bars(stats.sources.map((s) => ({ label: String(s.source ?? '') || '直接開網址', value: num(s.n) })))),
      card('中途離開時的回合', bars(stats.quits.map((q) => ({ label: num(q.round) === 0 ? '開局前' : `第 ${num(q.round)} 回合`, value: num(q.n) })))),
      card(
        '各模式完成率',
        bars(stats.modes.map((m) => ({ label: MODES[String(m.mode)] ?? String(m.mode), value: num(m.finished), note: `${num(m.finished)}/${num(m.started)}（${pct(num(m.finished), num(m.started))}）` }))),
      ),
      card(
        '教學完成率',
        bars(stats.tutorials.map((t) => ({ label: LESSONS[String(t.lesson)] ?? String(t.lesson), value: num(t.done), note: `${num(t.done)}/${num(t.started)}` }))),
      ),
      card('第一次遊玩提示', welcomeBars(stats.welcome)),
      card('規則書最常翻的章節', bars(stats.chapters.map((c) => ({ label: CHAPTERS[String(c.chapter)] ?? String(c.chapter), value: num(c.n) })))),
      card(
        '3D 桌面載入時間（平均）',
        bars(stats.ready.map((r) => ({ label: MODES[String(r.mode)] ?? String(r.mode), value: num(r.avg), note: `${(num(r.avg) / 1000).toFixed(1)} 秒` }))),
      ),
      card('最新留言', comments, true),
      card('錯誤（最近 30 天）', errors, true),
    ),
  );
}

/** The first-visit prompt: who saw it, what they chose, and how many tutorial takers finished the basics lesson. */
function welcomeBars(rows: readonly Row[]): Node {
  const row = (pick: string): Row | undefined => rows.find((r) => r.pick === pick);
  const shown = num(row('welcome-shown')?.n);
  const tutorial = row('welcome-tutorial');
  return el(
    'div',
    {},
    bars([
      { label: '看到提示', value: shown },
      { label: '進入新手教學', value: num(tutorial?.n), note: `${num(tutorial?.n)}（${pct(num(tutorial?.n), shown)}）` },
      { label: '我已經熟練', value: num(row('welcome-skip')?.n), note: `${num(row('welcome-skip')?.n)}（${pct(num(row('welcome-skip')?.n), shown)}）` },
      { label: '選教學後完成基礎課', value: num(tutorial?.basics), note: `${num(tutorial?.basics)}/${num(tutorial?.n)}` },
    ]),
    el('p', { class: 'sub' }, '人數以瀏覽器計；看到提示但沒回答就離開的人，是「看到」減去兩個答案。'),
  );
}

function refreshButton(): HTMLButtonElement {
  const b = el('button', { type: 'button' }, '重新整理');
  b.addEventListener('click', () => void load());
  return b;
}

function logoutButton(): HTMLButtonElement {
  const b = el('button', { type: 'button' }, '登出');
  b.addEventListener('click', () => {
    localStorage.removeItem(KEY);
    login();
  });
  return b;
}

function login(message = ''): void {
  const input = el('input', { type: 'password', placeholder: '管理密碼', autocomplete: 'current-password', 'aria-label': '管理密碼' });
  const form = el('form', { class: 'login' }, input, el('button', { type: 'submit' }, '查看'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    localStorage.setItem(KEY, input.value);
    void load();
  });
  root.replaceChildren(el('h1', {}, '遊玩統計'), el('p', { class: 'sub' }, '輸入管理密碼（Worker secret ADMIN_KEY）'), form, ...(message ? [el('p', { class: 'error' }, message)] : []));
  input.focus();
}

async function load(): Promise<void> {
  const key = localStorage.getItem(KEY);
  if (!key) {
    login();
    return;
  }
  try {
    const response = await fetch('/api/stats', { headers: { Authorization: `Bearer ${key}` } });
    const body = (await response.json()) as Stats & { error?: string };
    if (!response.ok) {
      if (response.status === 403) localStorage.removeItem(KEY);
      login(body.error ?? `讀取失敗（${response.status}）`);
      return;
    }
    render(body);
  } catch {
    login('連不上伺服器');
  }
}

void load();
