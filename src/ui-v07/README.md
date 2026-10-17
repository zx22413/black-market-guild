# `src/ui-v07`｜V0.7 介面（搬遷中）

V0.7 的瀏覽器介面，與 V0.6 的 `src/ui` 並存，入口是 `v07.html`（開發伺服器網址 `/v07.html`；正式 `vite build` 尚未收錄，切換時才加入）。只透過 `src/v07/{game,bots,match,online}` 的公開 API 取得資料。計畫見 [`docs/v07-migration-plan.md`](../../docs/v07-migration-plan.md) 第 4 節階段 5。

對局畫面是 3D 桌面（`table3d/Table3DScreen.tsx`，由 `table/MatchView.tsx` 依需要載入），單機、同機輪流（換人遮蔽）與連線都用它；網址加 `?ui=panel` 會改用第一版的純面板（`table/TableScreen.tsx`），作為手機版面完成前的備用。

| 位置 | 說明 |
| --- | --- |
| `session/gameSession.ts` | 單機對局：Bot 座位自行決定，真人座位等 UI 提交。 |
| `session/board.ts` | 只用公開事件重建桌面（現金、倉庫、建築、船、角色、價格）；與引擎最終狀態一致有測試（`tests/ui-v07/`）。3D 場景之後也讀這裡。 |
| `session/usePlayback.ts` | 逐筆播放公開事件、回合間暫停、同機輪流的換人遮蔽（換人前不顯示任何私有資訊）。 |
| `table/` | `MatchView`（選 3D 或純面板）；純面板版：商會、市場、船隻面板，與選島／投資／部署／情報重擲四個決策表單（合法行動以 `legalActions` 為準）；兩版共用的選擇邏輯 `investChoice`、`deployChoice`。 |
| `beats/` | 焦點層試驗：`shipBeat.ts` 從公開事件組出一艘船的結算拍（骰值修正、結果、貨、金流）與本回合帳單，`beatTimeline.ts` 決定每件事出現的時間（一次一件），`ShipBeatStage`、`ReceiptCard` 是滿版卡片。說明見 [`docs/ui/v07-layout-research.md`](../../docs/ui/v07-layout-research.md) 第 6 節。 |
| `scene/` | 3D 桌面播放結算拍（試驗）：借用 V0.6 `src/ui/scene` 的海、天氣、島、船；`FocusCamera`／`focusMath` 是能左右平移的對焦鏡頭，`beatStage.ts` 是純函式（角色何時進場、船怎麼反應、哪些島相關），`TableCanvas` 是共用的 3D 桌面（海、天氣、島、船、鏡頭、DOM 標籤），`BeatScene` 與 `InvestIsland`（倉庫貨箱、船上的貨、建築預覽）在它上面加東西；說明全部在船上方的 `beats/BeatTag`（同一刻只有一個地方要看）。見研究文件第 6.4 節。 |
| `table/investChoice.ts` | 投資決定的純資料模型（建築卡與不能蓋的原因、裝卸貨、可裝貨量、提醒、摘要、還沒做完的項目），只用合法行動判斷；3D 島與之後的表單共用。 |
| `table/ReminderDialog.tsx`、`table/reminderSettings.ts` | 提交前「還有沒做完的地方」提醒，與「不再提醒」設定（存在瀏覽器的 localStorage，無法使用時就每次提醒）。 |
| `table/deployChoice.ts` | 部署角色的純資料模型（角色卡與不能派的原因、目標船、燈塔島多看的一艘、莊家押注、還沒做完的項目、提交按鈕文字），只用合法行動判斷。 |
| `table/roleText.ts` | 角色的完整說明（目標、效果、數字），由規則數值產生；`useDeployStep` 把它放在手牌上方的說明條裡（只在滑過或選中角色時出現，費用與冷卻是圖示晶片），卡面只留圖示、名稱、部署費。 |
| `table3d/` | 3D 桌面上的各個決定（試驗）：每一步是一個 hook（`useInvestStep`、`useDeployStep`），回傳要加在同一張桌面上的標籤、3D 道具、底部列、彈出層與鏡頭位置（`stage.ts`），桌面本身只掛載一次。`MarketStrip`（黑市列，莊家在這裡押漲跌）、`IslandDraft`／`IslandReveal`（滿版選島與島嶼公開）、`RerollCard`（情報商人的私密重擲卡）、`revealModel`／`RoleArrows`（角色揭露的箭頭）、`seatPlates`（商會名牌）、`IslandBadge`（島名牌，滑過或點擊看能力）、`RankRail`／`standings`（右上角長駐的玩家排行：總財富（現金＋建築半價）、已蓋的建築圖示與倉庫存貨，回合結束才重排並滑動換位，窄視窗預設收合）、`RoleBadges`（掛在目標身上的角色圖示章）、`DeployChips`（部署底欄的「角色 ▸ 目標」兩個晶片）、`ResolveBar`（結算時底欄的進度點、揭露圓章、只有圖示的跳過鈕）、`IslandGlance`（島嶼效果的加減圖示列）、`RulesPanel`（頂部書本鈕開的規則查詢面板）、`LockHint`（提交鈕旁的鎖或 ⓘ，點或滑過看說明）、`icons.tsx`（畫出來的箭頭、鎖、時鐘、圓盤等小圖示）、`useHudSafe`（依畫面上實際的 HUD 高度算鏡頭安全區）；部署之後的整段由 `useRoundResolution` 接手：揭露 → 航程（每艘船一拍，用 `scene/BeatScene` 的 `beatLayer`）→ 市場（`MarketCard`）→ 結帳（`settlementModel` 把每筆錢或貨變成「起點 → 終點」，`Flights` 在桌上飛）→ 帳單；整局結束後是 `ResultCard`（資料在 `resultModel.ts`）。 |
| 畫面文字原則 | 一個畫面只留一個大字重點；字級只用 `v07.css` 的三個 token（`--fs-note`／`--fs-body`／`--fs-title`）；按鈕只寫動詞（「提交」「繼續」），狀態放在旁邊的圖示晶片；箭頭、鎖、加減號不用文字字元，用 `table3d/icons.tsx`；操作教學只顯示一次（`table/reminderSettings.ts` 的 `isHintSeen`／`markHintSeen`）；規則整句放 hover 或點擊，不可只靠 hover（手機點擊也要看得到）。島嶼效果的圖示摘要 `table/islandGlance.ts` 是依 `ISLAND_TEXT` 手動維護的，改島嶼規則時兩邊一起改（`tests/ui-v07/islandGlance.test.ts` 只檢查對應是否齊全）。 |
| `dev/` | 只在開發模式：`/v07.html?dev=beat` 滿版卡版本、`/v07.html?dev=beat3d` 3D 桌面的結算拍、`/v07.html?dev=round3d`（或 `invest3d`，直接開一局你對三個 Bot，和正式畫面同一個 `Table3DScreen`）在 3D 桌面上連續玩整局：選島 → 投資 → 部署 → 情報重擲 → 角色揭露 → 航程 → 市場 → 結帳 → 帳單 → 下一回合，最後是結果畫面；加 `&autoplay` 會自動代打並跳過演出，直接看結局。 |
| `online/` | 連線房間，協定版本 2；開發時 `/api-v07` 由 Vite 轉到 `npm run server:dev:v07`（8788）。 |
| `labels.ts`、`log.ts` | 中文名稱與規則說明（只是重述 `game-design.md`，不新增規則）、航海日誌文字。 |

本機試玩連線：先 `npm run server:dev:v07`，再用房主密碼（`.dev.vars` 的 `HOST_KEY`）開房。
