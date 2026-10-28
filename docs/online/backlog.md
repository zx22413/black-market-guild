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
| 開房 | 任何人都能開（2026-10-28 起）。Turnstile secret 是 Worker secret `TURNSTILE_SECRET`（本機 `.dev.vars` 用 Cloudflare 的測試 secret），site key 在 `src/ui-v07/online/turnstile.ts`（2026-10-28 建立，Managed 模式）。舊的 `HOST_KEY` 已不用 |
| 本機測試 | `npm run build` 後 `npm run server:dev`（port 8787，`.claude/launch.json` 的 `online` 設定）；`npm run dev` 會把 `/api` 轉到 8787 |
| 協定版本 | `PROTOCOL_VERSION`（`src/online/protocol.ts`），訊息格式變動時要加 1，舊分頁會被要求重新整理 |

部署注意：`npm run deploy` 是從**工作目錄**建置，會把其他 session 還沒 commit 的修改一起帶上去。部署前先確認 `git status` 是乾淨的。

## 1. 連線功能還沒做完（依建議優先順序）

1. **對局撐過部署與回收**（2026-10-29 決定：先記下來，等流量起來再做；暫時用 `/stats` 最上面的「目前線上對局」在部署前檢查，那是由統計推算的估計，關閉匿名統計的人看不到）。要一起處理的：
   - **對局本身**：見下面原本的做法（存 seed＋行動紀錄，喚醒時 `replayMatch` 重建，Bot 記憶也要重播）。
   - **第 15 節的狀態**：託管名單、連續逾時次數、暫停、每個決定的截止時間與「畫面已出現」標記；計時器要改用 Durable Object alarm（記憶體裡的 `setTimeout` 撐不過回收）。
   - **大廳狀態**：被移出的名單、鎖房（`public-launch-plan.md` 第 5 節的已知限制）。
   - **改用 Hibernation API**：持久化做完才能換；換了之後沒人說話的連線不再持續計費（`server/rooms.ts` 開頭的說明）。
   - **測試**：同一個 seed＋行動紀錄，重建前後的 `MatchLog` 相同；模擬回收後託管、逾時、截止時間都正確。
   原本的做法：對局只存在 Durable Object 的記憶體，重新部署或物件被回收（沒人連線一段時間）就會中斷，大廳成員也會消失（客戶端會自動重新加入）。做法：開局時把座位設定、seed 存進 Durable Object storage，每個被接受的行動也追加存入；喚醒時用 `replayMatch` 重建狀態、事件與私有事件，再接回 `runMatch`。注意 Bot 有記憶（`onEvents`），重建時也要依序重播事件給 Bot，確認結果和原本一致（寫測試：同一 seed＋行動紀錄，重建前後的 `MatchLog` 相同）。相關：`server/rooms.ts`、`src/v07/online/room.ts`、`src/v07/match/runner.ts`。
2. ~~**斷線與超時規則**~~：2026-10-28 完成，規則在 `game-design.md` 第 15 節（限時、託管、暫停），伺服器在 `src/v07/online/room.ts`、`timeout.ts`，介面在 `src/ui-v07/online/MatchClock.tsx`，規則書有「連線」章。
3. **自動部署**：等第 1 項完成、部署不會中斷對局之後再考慮。選項：Cloudflare Workers Builds 連 GitHub（使用者要在 Cloudflare 後台授權），或只在 push 到 `release` 分支時部署。直接「push main 就部署」不建議，因為使用者與其他 session 常常推 main。
4. **換裝置回到座位**：座位以瀏覽器 `localStorage` 的隨機 token 辨識，換手機、換瀏覽器或用無痕模式就回不去。可考慮「房主把座位重新指派給新連線」或座位專屬的重連連結。
5. **房間管理**：沒有離開座位、踢人、房主轉移、觀戰、中途加入。（「再來一局」回同一個大廳已完成，2026-10-23。）
6. ~~**房間清理**~~：2026-10-28 完成。房間沒人連線滿 1 小時、或建立滿 24 小時，由 Durable Object alarm 刪除（`game-design.md` 第 15.3 節；判斷在 `src/v07/online/expiry.ts`，alarm 在 `server/rooms.ts`）。之前建立的舊房間，下次有人連線時才開始計時。
7. ~~**速率限制**~~：2026-10-28 完成：開放建房，加上 Turnstile、每 IP 建房與連線頻率、每間房連線數、每條連線訊息頻率上限、來源檢查（`server/limits.ts`，說明見 `public-launch-plan.md` 第 5 節）。
8. **對局結束後把完整紀錄存到 R2**（接在第 1 項之後做）：每局結束時把座位設定、seed、規則版本、行動紀錄與結果存成一個 JSON 檔，放進 R2（Cloudflare 物件儲存，下載流量不收費，帳號已開通；現有的 `lbdog-os-blueprint-content` 是別的專案的，要另開一個 bucket）。用途：以 `replayMatch` 重播或分享對局、賽後覆盤、收集真人對局數據，和 `docs/simulations/` 的 Bot 模擬對照平衡。注意：
   - 進行中的對局狀態要存在 Durable Object storage（第 1 項），不要用 R2；R2 只放結束後不再變動的整份紀錄。
   - 紀錄裡有玩家名稱，公開分享或拿去分析前要決定保存多久、是否匿名化，**要先問使用者**。
   - 之後若加入背景音樂、大型美術（Worker 靜態檔單一檔案上限 25 MB）或桌面版安裝檔，也可以放 R2；目前遊戲約 6 MB，還不需要。

9. ~~**行為分析**~~：2026-10-28 完成，匿名事件寫進 D1（`contrabay-analytics`），`/stats` 儀表板用 Worker secret `ADMIN_KEY` 保護；說明見 `public-launch-plan.md` 第 4 節。

## 2. 還沒實際驗證

| 項目 | 怎麼驗證 |
|---|---|
| **真手機透過網路連線對戰**（目前只用 Node 腳本和桌機瀏覽器測過） | 兩支手機各開一個連結玩一整局，包含螢幕關掉再打開（應自動重連）、切到別的 App 再回來 |
| **聚會實戰回饋**（2026-10-04 聚會） | 問使用者朋友的意見與遇到的問題 |
| **很多人同時玩單機版** | 單機版只在瀏覽器跑，理論上不吃伺服器資源，沒有實測 |

## 3. 待使用者決定

- ~~「線上房間」按鈕對所有人都看得到~~：2026-10-28 起任何人都能建房，房主密碼已拿掉（Q-09）。
- **自訂網域**：使用者有 `lbdog.uk`，可接成子網域（例如 `bmg.lbdog.uk`）。目前選擇先用免費網址。
- **舊的 Pages 備案**（`black-market-guild.pages.dev`）要保留還是刪掉。

## 4. 其他

- **煙霧測試腳本沒有進版本控制**：這次用的 Node WebSocket 腳本放在 session 的暫存目錄。可整理成 `scripts/online-smoke.ts`（開房 → 兩個客戶端加入 → 隨機行動打完一局 → 檢查沒有收到別人的私有事件），部署後跑一次。注意 Node 20 要加 `--experimental-websocket` 才有 `WebSocket`。
- **前端主程式偏大**：`TableScreen` chunk 約 1.1 MB（gzip 後 310 KB），Vite 會警告。手機網路慢時首次載入較久。

## 5. 後端藍圖（未排程，供之後評估）

現在的後端就是 Worker＋Durable Object：單機對 Bot 與同機輪流完全在瀏覽器跑、不需要後端；線上房間由伺服器權威結算。之後的功能大多是在這套架構上**加東西，不用換架構**。

| 之後的功能 | 需要的後端 | Cloudflare 對應 |
|---|---|---|
| 對局撐過部署 | 房間把進度寫進儲存空間 | Durable Object storage（第 1 節第 1 項） |
| 對局紀錄、重播 | 存放結束後的整份紀錄 | R2（第 1 節第 8 項） |
| 帳號與登入（換裝置回座位、保留戰績） | 使用者資料、登入驗證 | D1（SQL 資料庫）＋登入服務 |
| 戰績、排行榜 | 可查詢、排序的資料 | D1 |
| 自動配對（不用房主開房） | 等候佇列 | Durable Object |
| AI 對手 | 在伺服器呼叫 AI，金鑰不進瀏覽器 | Worker＋AI Gateway（或 Workers AI） |
| Steam 成就、內購 | 與 Steam 伺服器溝通 | Worker |

- **分水嶺是「帳號」**：一旦要登入、戰績、排行榜，就要有資料庫（D1），也要開始處理個人資料與隱私。目前沒有需求，想做時再評估。
- **AI 對手的做法**：做成另一種 Bot／Controller，放在房間的 Durable Object 裡。AI 只看得到該座位的 `PlayerView`、只能從 `legalActions` 選；回傳不合法時退回現有 Bot 策略。AI 的台詞或說明不得自己編規則（以 `game-design.md`、`rulesText.ts` 為準）。要先想清楚：
  - 費用：一局幾十個決定，要設用量上限。
  - 速度：回應要 1～數秒，可搭配「決定中」標記演出。
  - 連網：AI 對手需要連伺服器，單機 Bot 版維持離線可玩。
  - 試做時先縮小範圍，例如「單一 AI 對手、只負責角色部署」，評估效果與費用。

## 已完成（2026-10-03～04）

- 部署到 Cloudflare：Worker 同時提供遊戲與 `/api`，房間用 Durable Object。
- 線上房間：房主用密碼開房、朋友點連結加入、空位由 Bot 補上；伺服器權威結算，只接受伺服器提供過的合法行動；每個人只收到自己的私有事件；重新整理或斷線會自動重連回原座位；協定版本不符時要求重新整理。
- 牌桌在等待時點名「等待 某某 決定…」，還沒決定的商會名牌上標「決定中」（單機、同機輪流、線上都適用）。
- 測試：`tests/online/room.test.ts`（大廳、開局、補位、私有事件不外洩、不合法行動、重連、等待廣播、協定解析）；正式環境用兩個腳本客戶端各打完一局。
