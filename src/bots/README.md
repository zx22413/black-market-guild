# `src/bots`｜Bot 策略

Bot 用於兩個目的：MVP 中與真人對戰，以及全 Bot 批量模擬以驗證平衡（[`docs/game-design.md`](../../docs/game-design.md) 第 11 節、[`docs/open-questions.md`](../../docs/open-questions.md) Q-06）。

Bot 只能使用 Match Runner 交給它的 `DecisionContext`（自己的 `PlayerView`、待決定事項、合法行動），不得讀取完整 `MatchState`，以確保不作弊，且模擬結果反映真實的資訊條件。Bot 的隨機性必須使用 seeded `Rng`，以確保可重現。

## 公開 API

| 名稱 | 說明 |
| --- | --- |
| `Bot` | `decide(context: DecisionContext) → Action`，同步決定。 |
| `createBot(strategy, seed)` | 依策略名稱建立 Bot；`BOT_STRATEGIES` 列出所有策略。 |
| `createRandomBot(seed)` | 從合法行動中均勻隨機選擇。 |

## 策略

| 策略 | 里程碑 | 說明 |
| --- | --- | --- |
| `random` | M7 | 從合法行動中隨機選擇，用於不變量測試與壓力測試，也是模擬的基準對手。 |
| 策略 Bot | M8 | 以期望值判斷資產、合資與角色選擇，可調整參數產生不同風格。 |

## 目前進度

M7 完成隨機 Bot；策略 Bot 於 M8 實作。
