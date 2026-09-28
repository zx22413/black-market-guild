# `src/match`｜Match Runner

對局主持人：反覆向引擎查詢待決定事項，把該座位的 `PlayerView` 與合法行動交給該座位的 Controller（真人 UI、Bot 或遠端玩家），收到行動後交給引擎驗證並套用；公開事件廣播給所有座位，私有事件只轉交給對應座位。設計見 [`docs/architecture.md`](../../docs/architecture.md) 第 5 節。

與 `src/game` 一樣必須保持環境無關（由 `tsconfig.engine.json` 強制），讓瀏覽器、Node 模擬與日後的伺服器共用。

## 公開 API

| 名稱 | 說明 |
| --- | --- |
| `setupFromSeats({ seed, seats, rules? })` | 依座位設定指派玩家 id（p1～pN），為 Bot 座位建立 Bot（每個座位的 seed 由對局 seed 衍生，可重現），列出需由呼叫端接上的真人與遠端座位。 |
| `runMatch(setup, controllers)` | 非同步執行整局，等待每個座位的 `Controller`（UI、Bot 或網路）。 |
| `runMatchSync(setup, controllers)` | 同步執行整局，供全 Bot 批量模擬使用。 |
| `replayMatch(setup, actions)` | 只用座位設定與行動紀錄重建整局，用於重播、除錯與斷線重連。 |
| `botController(bot)` | 把同步 Bot 包成非同步 `Controller`。 |

`runMatch`／`runMatchSync` 回傳 `MatchLog`：所有被接受的行動、公開事件、私有事件、最終狀態與結果。

## 檔案

| 檔案 | 職責 |
| --- | --- |
| `types.ts` | `SeatConfig`、`MatchSetup`、`Controller`、`SyncController`、`MatchLog`。 |
| `seats.ts` | `setupFromSeats`。 |
| `runner.ts` | 執行、重播與事件轉送。Controller 替其他座位出手、回傳不合法行動或座位缺少 Controller 時會拋出錯誤。 |

## 行為細節

- **同時決定：** `runMatch` 會一次詢問同一階段所有待決定的座位，全部回答後依座位順序套用，因此結果與回答快慢無關，且與 `runMatchSync` 產生完全相同的紀錄。同一台裝置輪流遊玩（hot-seat）時，由 UI 的 Controller 自行排隊並顯示換人遮蔽畫面。
- **事件不可修改：** 廣播給 Controller 的公開與私有事件都會先凍結，任何 Controller 都無法修改其他座位收到的內容。

## 目前進度

M7 完成。真人（`LocalHumanController`）與遠端（`RemoteController`）的 Controller 分別於 UI 與連線階段實作。
