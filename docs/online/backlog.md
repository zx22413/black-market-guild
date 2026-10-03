# 連線與部署待辦清單

> 更新：2026-10-04。線上房間（`src/online/`、`server/`、`src/ui/online/`）與正式部署還沒做完、還沒驗證或已知有問題的地方，供下一個 session 接手。做完一項就從這裡刪掉或移到文末「已完成」。
>
> 這份只是工作清單，**不是規則來源**。設計與限制見 [`docs/architecture.md`](../architecture.md) 第 8 節；牽涉規則的項目以 [`docs/game-design.md`](../game-design.md) 為準。畫面相關的待辦在 [`docs/ui/backlog.md`](../ui/backlog.md)。

## 現況速查

| 項目 | 內容 |
|---|---|
| 正式網址 | https://black-market-guild.zx2241384.workers.dev（Cloudflare Worker：`dist/` 靜態檔＋`/api` 房間，每個房間一個 Durable Object） |
| 舊備案 | https://black-market-guild.pages.dev（Cloudflare Pages，2026-10-03 的純單機版，**沒有線上房間**，不會自動更新） |
| 部署 | 手動 `npm run deploy`（build＋`wrangler deploy`）。**push 到 main 不會自動部署**，這是刻意的，原因見第 1 節第 1 項 |
| 房主密碼 | Worker secret `HOST_KEY`；正式的存在專案根目錄 `.host-key`，本機 `wrangler dev` 用 `.dev.vars`，兩者都不進版本控制。換密碼：`npx wrangler secret put HOST_KEY` |
| 本機測試 | `npm run build` 後 `npm run server:dev`（port 8787，`.claude/launch.json` 的 `online` 設定）；`npm run dev` 會把 `/api` 轉到 8787 |
| 協定版本 | `PROTOCOL_VERSION`（`src/online/protocol.ts`），訊息格式變動時要加 1，舊分頁會被要求重新整理 |

部署注意：`npm run deploy` 是從**工作目錄**建置，會把其他 session 還沒 commit 的修改一起帶上去。部署前先確認 `git status` 是乾淨的。

## 1. 連線功能還沒做完（依建議優先順序）

1. **對局撐過部署與回收**：對局只存在 Durable Object 的記憶體，重新部署或物件被回收（沒人連線一段時間）就會中斷，大廳成員也會消失（客戶端會自動重新加入）。做法：開局時把座位設定、seed 存進 Durable Object storage，每個被接受的行動也追加存入；喚醒時用 `replayMatch` 重建狀態、事件與私有事件，再接回 `runMatch`。注意 Bot 有記憶（`onEvents`），重建時也要依序重播事件給 Bot，確認結果和原本一致（寫測試：同一 seed＋行動紀錄，重建前後的 `MatchLog` 相同）。相關：`server/worker.ts`、`src/online/room.ts`、`src/match/runner.ts`。
2. **斷線與超時規則**：**要使用者先決定**，並寫進 `game-design.md`，不可自行發明（`architecture.md` 7.2）。現在的行為是無限等待：有人斷線，整局停在他的決定上。可選方向：超時採預設行動、改由 Bot 代打、暫停並設上限。
3. **自動部署**：等第 1 項完成、部署不會中斷對局之後再考慮。選項：Cloudflare Workers Builds 連 GitHub（使用者要在 Cloudflare 後台授權），或只在 push 到 `release` 分支時部署。直接「push main 就部署」不建議，因為使用者與其他 session 常常推 main。
4. **換裝置回到座位**：座位以瀏覽器 `localStorage` 的隨機 token 辨識，換手機、換瀏覽器或用無痕模式就回不去。可考慮「房主把座位重新指派給新連線」或座位專屬的重連連結。
5. **房間管理**：沒有離開座位、踢人、房主轉移、觀戰、中途加入。對局結束後按「再來一局」會離開房間，回到首頁，不是回到大廳重開。
6. **房間清理**：Durable Object storage 的 `host` 紀錄永遠不會刪，房號理論上會越用越少（31^6 個，實際上不用擔心）。之後可用 alarm 在一段時間沒人後清掉。
7. **速率限制**：開房需要房主密碼；WebSocket 訊息有大小上限（16 KB），但沒有頻率限制。
8. **對局結束後把完整紀錄存到 R2**（接在第 1 項之後做）：每局結束時把座位設定、seed、規則版本、行動紀錄與結果存成一個 JSON 檔，放進 R2（Cloudflare 物件儲存，下載流量不收費，帳號已開通；現有的 `lbdog-os-blueprint-content` 是別的專案的，要另開一個 bucket）。用途：以 `replayMatch` 重播或分享對局、賽後覆盤、收集真人對局數據，和 `docs/simulations/` 的 Bot 模擬對照平衡。注意：
   - 進行中的對局狀態要存在 Durable Object storage（第 1 項），不要用 R2；R2 只放結束後不再變動的整份紀錄。
   - 紀錄裡有玩家名稱，公開分享或拿去分析前要決定保存多久、是否匿名化，**要先問使用者**。
   - 之後若加入背景音樂、大型美術（Worker 靜態檔單一檔案上限 25 MB）或桌面版安裝檔，也可以放 R2；目前遊戲約 6 MB，還不需要。

## 2. 還沒實際驗證

| 項目 | 怎麼驗證 |
|---|---|
| **真手機透過網路連線對戰**（目前只用 Node 腳本和桌機瀏覽器測過） | 兩支手機各開一個連結玩一整局，包含螢幕關掉再打開（應自動重連）、切到別的 App 再回來 |
| **聚會實戰回饋**（2026-10-04 聚會） | 問使用者朋友的意見與遇到的問題 |
| **很多人同時玩單機版** | 單機版只在瀏覽器跑，理論上不吃伺服器資源，沒有實測 |

## 3. 待使用者決定

- **「線上房間」按鈕對所有人都看得到**，但只有房主能開房，朋友點進去只會看到要輸入密碼。提議：只在曾輸入過房主密碼的瀏覽器顯示這顆按鈕，其他人只會看到單機模式和房主傳來的連結。
- **自訂網域**：使用者有 `lbdog.uk`，可接成子網域（例如 `bmg.lbdog.uk`）。目前選擇先用免費網址。
- **舊的 Pages 備案**（`black-market-guild.pages.dev`）要保留還是刪掉。

## 4. 其他

- **煙霧測試腳本沒有進版本控制**：這次用的 Node WebSocket 腳本放在 session 的暫存目錄。可整理成 `scripts/online-smoke.ts`（開房 → 兩個客戶端加入 → 隨機行動打完一局 → 檢查沒有收到別人的私有事件），部署後跑一次。注意 Node 20 要加 `--experimental-websocket` 才有 `WebSocket`。
- **前端主程式偏大**：`TableScreen` chunk 約 1.1 MB（gzip 後 310 KB），Vite 會警告。手機網路慢時首次載入較久。

## 已完成（2026-10-03～04）

- 部署到 Cloudflare：Worker 同時提供遊戲與 `/api`，房間用 Durable Object。
- 線上房間：房主用密碼開房、朋友點連結加入、空位由 Bot 補上；伺服器權威結算，只接受伺服器提供過的合法行動；每個人只收到自己的私有事件；重新整理或斷線會自動重連回原座位；協定版本不符時要求重新整理。
- 牌桌在等待時點名「等待 某某 決定…」，還沒決定的商會名牌上標「決定中」（單機、同機輪流、線上都適用）。
- 測試：`tests/online/room.test.ts`（大廳、開局、補位、私有事件不外洩、不合法行動、重連、等待廣播、協定解析）；正式環境用兩個腳本客戶端各打完一局。
