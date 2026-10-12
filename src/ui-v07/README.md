# `src/ui-v07`｜V0.7 介面（搬遷中）

V0.7 的瀏覽器介面，與 V0.6 的 `src/ui` 並存，入口是 `v07.html`（開發伺服器網址 `/v07.html`；正式 `vite build` 尚未收錄，切換時才加入）。只透過 `src/v07/{game,bots,match,online}` 的公開 API 取得資料。計畫見 [`docs/v07-migration-plan.md`](../../docs/v07-migration-plan.md) 第 4 節階段 5。

目前是第一版：用簡單面板玩完整局（階段 5a／5b），之後才做成桌遊場景（5c 起）。

| 位置 | 說明 |
| --- | --- |
| `session/gameSession.ts` | 單機對局：Bot 座位自行決定，真人座位等 UI 提交。 |
| `session/board.ts` | 只用公開事件重建桌面（現金、倉庫、建築、船、角色、價格）；與引擎最終狀態一致有測試（`tests/ui-v07/`）。3D 場景之後也讀這裡。 |
| `session/usePlayback.ts` | 逐筆播放公開事件、回合間暫停、同機輪流的換人遮蔽（換人前不顯示任何私有資訊）。 |
| `table/` | 牌桌：商會、市場、船隻面板，與選島／投資／部署／情報重擲四個決策表單（合法行動以 `legalActions` 為準）。 |
| `beats/` | 焦點層試驗：`shipBeat.ts` 從公開事件組出一艘船的結算拍（骰值修正、結果、貨、金流）與本回合帳單，`beatTimeline.ts` 決定每件事出現的時間（一次一件），`ShipBeatStage`、`ReceiptCard` 是滿版卡片。說明見 [`docs/ui/v07-layout-research.md`](../../docs/ui/v07-layout-research.md) 第 6 節。 |
| `scene/` | 3D 桌面播放結算拍（試驗）：借用 V0.6 `src/ui/scene` 的海、天氣、島、船；`FocusCamera`／`focusMath` 是能左右平移的對焦鏡頭，`beatStage.ts` 是純函式（角色何時進場、船怎麼反應、哪些島相關），`TableCanvas` 是共用的 3D 桌面（海、天氣、島、船、鏡頭、DOM 標籤），`BeatScene` 與 `InvestIsland`（倉庫貨箱、船上的貨、建築預覽）在它上面加東西；說明全部在船上方的 `beats/BeatTag`（同一刻只有一個地方要看）。見研究文件第 6.4 節。 |
| `table/investChoice.ts` | 投資決定的純資料模型（建築卡與不能蓋的原因、裝卸貨、可裝貨量、提醒、摘要），只用合法行動判斷；3D 島與之後的表單共用。 |
| `dev/` | 只在開發模式：`/v07.html?dev=beat` 滿版卡版本、`/v07.html?dev=beat3d` 3D 桌面版本、`/v07.html?dev=invest3d` 在自己的島上做投資。 |
| `online/` | 連線房間，協定版本 2；開發時 `/api-v07` 由 Vite 轉到 `npm run server:dev:v07`（8788）。 |
| `labels.ts`、`log.ts` | 中文名稱與規則說明（只是重述 `game-design.md`，不新增規則）、航海日誌文字。 |

本機試玩連線：先 `npm run server:dev:v07`，再用房主密碼（`.dev.vars` 的 `HOST_KEY`）開房。
