# `src/bots`｜Bot 策略

Bot 用於兩個目的：MVP 中與真人對戰，以及全 Bot 批量模擬以驗證平衡（[`docs/game-design.md`](../../docs/game-design.md) 第 11 節、[`docs/open-questions.md`](../../docs/open-questions.md) Q-06）。

Bot 只能使用 `getPlayerView` 與 `getLegalActions` 取得的資訊，不得讀取完整 `MatchState`，以確保不作弊，且模擬結果反映真實的資訊條件。Bot 的隨機性必須使用注入的 `Rng`。

## 預定內容

| Bot | 里程碑 | 說明 |
| --- | --- | --- |
| 隨機 Bot | M7 | 從合法行動中隨機選擇，用於不變量測試與壓力測試。 |
| 策略 Bot | M8 | 以期望值判斷資產、合資與角色選擇，可調整參數產生不同風格。 |

## 目前進度

尚未實作。
