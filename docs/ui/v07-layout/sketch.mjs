// 產生 V0.7 桌面版位草圖（docs/ui/v07-layout/option-*.svg）
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2];
const W = 640, H = 360;
const C = {
  sea: '#bfe0e6', island: '#e9dcb0', own: '#f3e3a2', board: '#5b4636', boardTxt: '#f6ead0',
  cell: '#8a6d55', marker: '#f2b53a', hud: '#2f3e4e', hudTxt: '#eef2f5', ship: '#7a5230',
  wanted: '#c0392b', dim: '#9aa5ae', line: '#6b7c8a', demand: '#fff7e0',
};
const GOODS = [['木', '#b07a3c'], ['鐵', '#7d8a96'], ['香', '#d9822b'], ['軍', '#b5476b']];
const PRICE = [3, 3, 3, 3];

const t = (x, y, s, size = 10, fill = '#222', anchor = 'start', w = 'normal') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${w}">${s}</text>`;
const r = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

/** 價格軌：4 行 × 7 格，行尾「需 n」；cw 為格寬 */
function tracks(x, y, cw, rh, demand = [2, 2, 1, 0]) {
  let s = '';
  GOODS.forEach(([g, col], i) => {
    const yy = y + i * rh;
    s += r(x, yy + 1, 12, rh - 2, col, 'rx="2"') + t(x + 6, yy + rh - 4, g, 8, '#fff', 'middle');
    for (let k = 0; k < 7; k++) {
      s += r(x + 14 + k * cw, yy + 1, cw - 2, rh - 2, k === PRICE[i] ? C.marker : C.cell, 'rx="1"');
    }
    s += t(x + 14 + 7 * cw + 2, yy + rh - 4, `需${demand[i]}`, 8, C.boardTxt);
  });
  return s;
}

function island(cx, cy, rx, ry, label, { own = false, wanted = false, stock = '木2 鐵1 香1', bld = 1 } = {}) {
  let s = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${own ? C.own : C.island}" stroke="#a89060"/>`;
  // 兩個建築地基（最多 2 棟）
  for (let k = 0; k < 2; k++) {
    const bx = cx - 18 + k * 22;
    s += k < bld ? r(bx, cy - 14, 14, 12, '#8e5a3a', 'rx="2"') : r(bx, cy - 14, 14, 12, 'none', 'stroke="#8e5a3a" stroke-dasharray="2 2"');
  }
  // 倉庫木箱
  s += r(cx + 12, cy - 4, 18, 10, '#c79a5b', 'stroke="#7a5230"') + t(cx + 21, cy + 4, '倉', 7, '#3b2a1a', 'middle');
  // 名牌
  const pw = own ? 92 : 78;
  s += r(cx - pw / 2, cy + ry + 2, pw, own ? 0 : 22, C.hud, 'rx="3"');
  if (!own) {
    s += t(cx - pw / 2 + 4, cy + ry + 11, label, 8, C.hudTxt, 'start', 'bold');
    s += t(cx + pw / 2 - 4, cy + ry + 11, '1000G', 8, C.hudTxt, 'end');
    s += t(cx - pw / 2 + 4, cy + ry + 21, stock, 7, '#cfd8df');
    s += t(cx + pw / 2 - 4, cy + ry + 21, '⊘護', 7, C.dim, 'end');
  } else {
    s += t(cx, cy + ry + 11, label, 9, '#3b2a1a', 'middle', 'bold');
  }
  if (wanted) s += r(cx - rx + 2, cy - ry + 2, 16, 12, C.wanted, 'rx="2"') + t(cx - rx + 10, cy - ry + 11, '緝', 8, '#fff', 'middle', 'bold');
  return s;
}

const ship = (x, y) => `<path d="M${x - 9},${y} L${x + 9},${y} L${x + 6},${y + 6} L${x - 6},${y + 6} Z" fill="${C.ship}"/>` +
  r(x - 5, y - 6, 10, 6, '#5a6b4a', 'rx="1"');

function dock(x, y, w, label) {
  let s = r(x, y, w, 46, C.hud, 'rx="4" opacity="0.92"') + t(x + w / 2, y + 13, label, 9, C.hudTxt, 'middle', 'bold');
  const roles = ['情報', '護衛', '海盜', '走私', '莊家'];
  roles.forEach((n, i) => {
    const cool = i === 2;
    s += r(x + 10 + i * 34, y + 19, 30, 22, cool ? '#55606a' : '#e8d9b0', 'rx="2"') +
      t(x + 25 + i * 34, y + 33, cool ? '冷2' : n, 8, cool ? '#aab' : '#3b2a1a', 'middle');
  });
  s += r(x + w - 58, y + 22, 48, 16, C.marker, 'rx="3"') + t(x + w - 34, y + 33, '確認', 8, '#3b2a1a', 'middle', 'bold');
  return s;
}

const ledger = (x, y) => r(x, y, 104, 46, C.hud, 'rx="4"') +
  t(x + 6, y + 13, '你 1000 G', 9, C.hudTxt, 'start', 'bold') +
  t(x + 6, y + 26, '倉：木2 鐵2 香2 軍1', 7, '#cfd8df') +
  t(x + 6, y + 38, '只有你知道 ▸', 7, '#d6b4ff');

const topbar = (extra = '') => r(0, 0, W, 20, C.hud) +
  t(8, 14, '第 2／6 回合 · 部署角色', 9, C.hudTxt, 'start', 'bold') + extra +
  t(W - 8, 14, '等待：黑潮會 ⏳  日誌  離開', 8, '#cfd8df', 'end');

const demandCard = (x, y, w = 44, h = 58) => r(x, y, w, h, C.demand, 'rx="3" stroke="#a89060"') +
  t(x + w / 2, y + 12, '需求卡', 8, '#5b4636', 'middle', 'bold') +
  GOODS.map(([g], i) => t(x + w / 2, y + 24 + i * 9, `${g} ${[2, 2, 1, 0][i]}`, 7, '#5b4636', 'middle')).join('');

const routes = (cx, cy, pts) => pts.map(([x, y]) =>
  `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${C.line}" stroke-dasharray="4 3"/>`).join('');

function svg(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 24}" width="${W}" height="${H + 24}" font-family="'PingFang TC','Noto Sans TC',sans-serif">
<rect width="${W}" height="${H + 24}" fill="#fff"/>
${t(4, 16, title, 12, '#222', 'start', 'bold')}
<g transform="translate(0,24)">${r(0, 0, W, H, C.sea, 'stroke="#555"')}${body}</g>
</svg>\n`;
}

// ── 方案 A：中央港口看板 ──
{
  const cx = 320, cy = 150;
  let b = topbar();
  b += routes(cx, cy, [[320, 58], [120, 150], [520, 150], [320, 250]]);
  b += island(320, 58, 46, 24, '金錨公會', { bld: 2 });
  b += island(110, 150, 50, 26, '黑潮會', { wanted: true });
  b += island(530, 150, 50, 26, '霧港商團', { bld: 0 });
  b += island(320, 262, 70, 30, '你（香料群島）', { own: true });
  // 港口看板
  b += r(cx - 108, cy - 40, 216, 80, C.board, 'rx="5" stroke="#3b2a1a" stroke-width="2"');
  b += t(cx - 100, cy - 28, '黑市港 · 價格軌', 9, C.boardTxt, 'start', 'bold');
  b += tracks(cx - 100, cy - 22, 17, 14);
  b += demandCard(cx + 58, cy - 34, 44, 66);
  b += ship(180, 150) + ship(462, 150) + ship(320, 212);
  b += ledger(8, 306) + dock(200, 306, 250, '秘密部署角色：選一張角色牌，再點船');
  writeFileSync(`${OUT}/option-a-harbor-board.svg`, svg('方案 A：中央港口看板（四島環繞）', b));
}

// ── 方案 B：頂部市場列 ──
{
  let b = topbar();
  b += r(0, 20, W, 66, C.board);
  b += t(8, 33, '黑市', 9, C.boardTxt, 'start', 'bold');
  b += tracks(40, 24, 50, 15);
  b += demandCard(470, 23, 70, 60);
  b += t(552, 40, '通緝：黑潮會', 8, '#ffb4a8');
  b += t(552, 54, '事件：未揭曉', 8, C.boardTxt);
  const cx = 320, cy = 190;
  b += routes(cx, cy, [[320, 118], [120, 190], [520, 190], [320, 262]]);
  b += `<circle cx="${cx}" cy="${cy}" r="22" fill="#d9c9a0" stroke="#a89060"/>` + t(cx, cy + 4, '黑市港', 8, '#5b4636', 'middle');
  b += island(320, 118, 46, 22, '金錨公會', { bld: 2 });
  b += island(110, 190, 50, 24, '黑潮會', { wanted: true });
  b += island(530, 190, 50, 24, '霧港商團', { bld: 0 });
  b += island(320, 270, 64, 26, '你（香料群島）', { own: true });
  b += ship(215, 190) + ship(425, 190) + ship(320, 236);
  b += ledger(8, 306) + dock(200, 306, 250, '秘密部署角色：選一張角色牌，再點船');
  writeFileSync(`${OUT}/option-b-top-strip.svg`, svg('方案 B：頂部黑市列＋桌面場景', b));
}

// ── 方案 C：左側黑市帳本 ──
{
  let b = topbar();
  b += r(0, 20, 168, 284, C.board);
  b += t(8, 34, '黑市', 10, C.boardTxt, 'start', 'bold');
  b += demandCard(112, 26, 50, 66);
  b += tracks(8, 100, 15, 22);
  b += t(8, 200, '通緝：黑潮會', 8, '#ffb4a8');
  b += t(8, 214, '本回合到港：結算時顯示', 7, C.boardTxt);
  const cx = 405, cy = 160;
  b += routes(cx, cy, [[405, 64], [245, 160], [565, 160], [405, 262]]);
  b += `<circle cx="${cx}" cy="${cy}" r="20" fill="#d9c9a0" stroke="#a89060"/>` + t(cx, cy + 4, '黑市港', 8, '#5b4636', 'middle');
  b += island(405, 62, 42, 22, '金錨公會', { bld: 2 });
  b += island(240, 160, 42, 24, '黑潮會', { wanted: true });
  b += island(570, 160, 42, 24, '霧港商團', { bld: 0 });
  b += island(405, 262, 64, 26, '你（香料群島）', { own: true });
  b += ship(310, 160) + ship(500, 160) + ship(405, 220);
  b += ledger(176, 306) + dock(300, 306, 250, '秘密部署角色：選一張角色牌，再點船');
  writeFileSync(`${OUT}/option-c-side-ledger.svg`, svg('方案 C：左側黑市帳本欄', b));
}
