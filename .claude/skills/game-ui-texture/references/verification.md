# 驗證

每個階段改完都在遊戲裡實際走到那個畫面。只看 skin lab 會漏掉：鏡頭取景、動畫中的狀態、別處樣式滲進來、只在特定流程出現的狀態。

## 瀏覽器

- 開發伺服器用 `preview_start {name: "web"}`（`.claude/launch.json`）。
- **瀏覽器面板隱藏時 3D 桌面不會載入**（停在「整理港口中…」）。先用 `mcp__ccd_view__show_pane {pane: "preview"}` 叫出面板。
- 模擬視窗比面板大時，截圖會縮放，座標容易對不上；需要點 3D 物件時用 `resize_window {preset: "desktop"}`。
- 要看細節時，對 HUD 元素設 `style.zoom = '2'` 再截圖，看完記得還原。
- 截圖遇到半透明、偏色的面板，多半是進場動畫還沒播完，等一兩秒再截。

## 各畫面怎麼走到

| 畫面 | 怎麼走 |
| --- | --- |
| 選島、島嶼公開、投資底欄、提醒、部署底欄 | `/v07.html?dev=round3d`。點第一張島卡要用座標點（JS 的 `click()` 不一定選得到），之後的按鈕可以用 JS 找文字點 |
| 押漲跌（黑市列或船上） | 部署時選莊家；有船可指定時漲跌出現在船上，沒有時在黑市列的吊牌裡 |
| 結算列、市場卡、帳單 | 部署提交後一直按結算列的主要鍵；市場卡只停留幾秒，要用迴圈每 0.1 秒檢查 `.market-card` 一出現就量。沒有船靠港的回合沒有市場結算 |
| 結果畫面 | `/v07.html?dev=round3d&autoplay` |
| 規則手冊 | 主選單左下「規則書」（不需要 3D），或遊戲頂部書本鈕 |
| 教學與點亮效果 | 主選單 →「新手教學」→ 一課；教學卡的「下一步」可以用 JS 連點，要實際操作的步驟照提示做 |
| 換人畫面、同機輪流 | 主選單 →「單機對局」→「同機輪流」→「開始對局」 |
| 只在線上出現的狀態（例如提交後等其他人） | 本機 Bot 都是立刻決定，看不到等待。見下方「線上房間」 |
| 不需要 3D 的元件 | skin lab 用 Bot 自動跑一局，放出真正的市場卡、帳單、結果畫面（`dev/SkinLabPanels.tsx`）；彈出式元件在 `.lab-overlay` 裡會改成放在格子內 |

## 每階段都要檢查

- 桌面寬度與手機寬度（`resize_window {preset: "mobile"}`，375px）：沒有橫向捲動（`document.documentElement.scrollWidth === innerWidth`），底欄沒有多換一行，可點的東西中央點得到（`document.elementFromPoint` 對元素中心測試）。
- `?skin=classic` 仍是舊外觀（改了元件結構的除外）。
- 狀態：一般、滑過、按下、停用、選中；停用的要看起來是停用的，可按的要看起來可按。
- 用 `read_console_messages` 看有沒有錯誤；注意它會留著先前頁面的訊息。
- `npm run typecheck`、`npm test`。

## 線上房間（等待其他玩家的狀態）

1. `preview_start {name: "online"}` 開本機的 Worker（port 8787），開發伺服器會把 `/api` 轉過去。
2. 開房要房主密碼：本機測試用的在 `.dev.vars` 的 `HOST_KEY`。只在本機的預覽瀏覽器用 `localStorage.setItem('bmg7.hostKey', …)` 設定，不要在回覆裡寫出它的值。主選單 →「線上房間」→「建立房間」→ 填商會名稱、入座。
3. 第二位玩家用腳本，入座後每個決定都延遲回應：

   ```bash
   node --experimental-websocket --import tsx .claude/skills/game-ui-texture/scripts/slow-guest.ts <房號> 25000
   ```

   （同一個網址的分頁共用 localStorage，會變成同一個人；改用 127.0.0.1 會被瀏覽器權限擋下，所以用腳本。）
4. 回到房主分頁「開始對局」，走到要看的狀態。
5. 收尾：`preview_stop` 關掉 Worker、停掉腳本；在預覽瀏覽器刪掉 `bmg7.hostKey`、`bmg7.lastRoom`、`bmg7.name`、`bmg7.token`、`bmg7.joined.<房號>`；刪掉暫存的密碼檔。
