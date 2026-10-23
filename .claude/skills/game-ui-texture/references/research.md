# 從 Game UI Database 找參考

網站：<https://www.gameuidatabase.com/>。頁面 HTML 有 Cloudflare 檢查，`curl` 拿不到；圖片（`/uploads/*_thumb.jpg`，500×281）可以直接下載。所以：用內建瀏覽器取清單，用 shell 下載圖片，拼成對照圖再看。

## 1. 用瀏覽器找遊戲

在 `https://www.gameuidatabase.com/index.php` 頁面執行（`javascript_tool`）：

```js
const names = ['Anno', 'Hades', 'Hearthstone', 'Wildfrost', 'Monkey Island', 'Civilization', 'Armello', 'Sea of Thieves', 'Balatro'];
const res = await Promise.all(names.map((n) =>
  fetch('search.php?t=' + encodeURIComponent(n)).then((r) => r.text()).then((t) => {
    const d = new DOMParser().parseFromString(t, 'text/html');
    return [n, [...d.querySelectorAll('.search_result a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim().slice(0, 50) + '|' + a.getAttribute('href')).slice(0, 4)];
  })));
JSON.stringify(res);
```

一次查 30 個以內，太多會超過 45 秒的執行上限。結果裡的 `gameData.php?id=…` 就是遊戲頁。

## 2. 取每款遊戲的縮圖清單

```js
const ids = { anno: 1118, hades: 534 };
const out = {};
await Promise.all(Object.entries(ids).map(async ([k, id]) => {
  const t = await fetch('gameData.php?id=' + id).then((r) => r.text());
  out[k] = [...new Set(t.match(/uploads\/[^"' )]+_thumb\.(?:jpg|png)/g) || [])].filter((x) => !x.includes('/video/'));
}));
Object.entries(out).map(([k, v]) => k + ' ' + v.slice(0, 12).map((x) => x.replace('uploads/', '').replace('_thumb.jpg', '')).join(',')).join('\n');
```

前 12 張多半是標題與設定頁；第 13～24 張才常出現遊戲中的 HUD。兩段都看。

## 3. 下載並拼對照圖

把上一步的輸出存成 scratchpad 裡的 `lists.txt`（每行 `名稱 id1,id2,…`），然後：

```bash
bash .claude/skills/game-ui-texture/scripts/fetch-thumbs.sh <scratchpad>/gui
python3 -I .claude/skills/game-ui-texture/scripts/contact-sheet.py <scratchpad>/gui/dl <scratchpad>/gui/sheets
```

`fetch-thumbs.sh` 要用 `bash` 執行（zsh 不會把逗號分隔的字串拆開）。每款遊戲得到一張 3×4 的對照圖，用 Read 看。

## 4. 整理

每款遊戲一列：「可以借什麼做法」。這次用過的：

| 遊戲 | 借的做法 |
| --- | --- |
| Hearthstone | 三段斜面外框、四角雕花；標題牌壓在面板上緣；主要按鈕有發光環 |
| Hades | 裝飾只放角落與上下中央，邊線保持乾淨；選中列用雙金線加內光 |
| Anno 1800 | 羊皮紙面板四周暗角；標題牌橫跨上緣；梯形切角的按鈕；面板後面是模糊場景 |
| Monkey Island 2 SE | 羊皮紙上淡淡的羅盤與航線當底圖；緞帶標題；書本形狀的說明頁 |
| Civilization VI | 整片低對比的海圖與羅盤浮水印，說明面板疊在上面 |
| Wildfrost | 切角按鈕、菱形頁籤、書本設定頁 |
| Armello | 金色花飾標題列、提示框兩端的菱形、羊皮紙加封蠟 |
| Sea of Thieves | 半透明深色面板、筆刷感的邊、小型大寫的小標題 |
| Balatro（反例） | 雙色加粗底邊撐出份量，幾乎全平面 |

連結附遊戲頁（`gameData.php?id=…`），不要把截圖放進 repo 或發布出去。
