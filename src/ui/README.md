# `src/ui`｜瀏覽器 UI

Vite 網頁前端，入口為根目錄的 `index.html` → `main.ts`。UI 只透過 `src/game` 的公開 API 與 `PlayerView` 呈現畫面，不直接讀取 `MatchState`。

## 預定內容

- `LocalHumanController`：把引擎的待決定事項交給玩家操作。
- 單機 1v2、1v3、自訂座位，以及同一台裝置輪流遊玩（hot-seat）的換人遮蔽畫面（[`docs/architecture.md`](../../docs/architecture.md) 第 7.3 節）。
- 依行動順序逐一演出角色揭露（規則上為同時公開）。

## 目前進度

僅有顯示「MVP 開發中」的佔位頁面；規則引擎與 Bot 完成後才開始實作。
