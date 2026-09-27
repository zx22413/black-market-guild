# `src/match`｜Match Runner

對局主持人：反覆向引擎查詢待決定事項，把各座位的 `PlayerView` 交給該座位的 Controller（真人 UI、Bot 或遠端玩家），收到行動後交給引擎驗證並套用。設計見 [`docs/architecture.md`](../../docs/architecture.md) 第 5 節。

與 `src/game` 一樣必須保持環境無關（由 `tsconfig.engine.json` 強制），讓瀏覽器、Node 模擬與日後的伺服器共用。

## 預定內容（M7）

| 項目 | 說明 |
| --- | --- |
| `SeatConfig`、`MatchConfig` | 座位設定：真人、Bot（含策略名稱）或遠端。 |
| `Controller` 介面 | `decide(view, decision) → Promise<Action>`。 |
| Match Runner | 驅動整局對局；另提供同步執行路徑，供全 Bot 批量模擬使用。 |

## 目前進度

尚未實作（M7）。
