# `src/bots`｜Bot 策略

Bot 用於兩個目的：MVP 中與真人對戰，以及全 Bot 批量模擬以驗證平衡（[`docs/game-design.md`](../../docs/game-design.md) 第 11 節、[`docs/open-questions.md`](../../docs/open-questions.md) Q-06）。

Bot 只能使用 Match Runner 交給它的 `DecisionContext`（自己的 `PlayerView`、待決定事項、合法行動），不得讀取完整 `MatchState`，以確保不作弊，且模擬結果反映真實的資訊條件。Bot 的隨機性必須使用 seeded `Rng`，以確保可重現。

## 公開 API

| 名稱 | 說明 |
| --- | --- |
| `Bot` | `decide(context: DecisionContext) → Action`，同步決定。 |
| `createBot(strategy, seed)` | 依策略名稱建立 Bot；`BOT_STRATEGIES` 列出所有策略。 |
| `createRandomBot(seed)` | 從合法行動中均勻隨機選擇。 |
| `createHeuristicBot(personality, seed)` | 期望值策略 Bot；`personality` 可為 `PERSONALITIES` 的名稱或自訂參數。 |

## 策略

| 策略 | 里程碑 | 說明 |
| --- | --- | --- |
| `random` | M7 | 從合法行動中隨機選擇，用於不變量測試與壓力測試，也是模擬的基準對手。 |
| `balanced`、`cautious`、`aggressive`、`opportunist` | M8 | 期望值策略 Bot 的四種個性，差別在攻擊性、信任與記仇、走私與背叛傾向、資產熱衷度、現金底線與隨機程度（`personality.ts`）。 |

## 策略 Bot 的運作

- **評分：** 對每個合法行動估算期望收益（G），例如資產的「每回合價值 × 剩餘回合 − 購買價 ＋ 最終估值」、合資與獨資的期望值差、各角色在各艘船上的期望值。只使用玩家視角中的公開資訊與規則數值（`estimates.ts`）。
- **選擇：** 依分數做 softmax 抽樣（`choose.ts`），溫度越高越隨機；溫度 0 永遠選最高分，供測試使用。
- **記憶：** 透過 `onEvents` 觀察公開事件（`memory.ts`），估計每名對手當海盜、護衛自己的船與走私的頻率；對打過自己船或在自己合資船上走私的人降低信任，影響之後的應徵與挑選。
- **限制：** 估算刻意簡化（例如只以平均海盜數估計威脅），模擬結果反映的是這套決策方式，不等於真人行為。

## 檔案

| 檔案 | 職責 |
| --- | --- |
| `types.ts` | `Bot`、`DecisionContext`。 |
| `random.ts` | 隨機 Bot。 |
| `personality.ts` | 個性參數與四種預設。 |
| `estimates.ts` | 抵達機率、成本、收入與期望值估算。 |
| `memory.ts` | 對手行為與信任的記憶。 |
| `choose.ts` | 依分數抽樣。 |
| `heuristic.ts` | 各決策階段的評分與策略 Bot 組裝。 |

## 目前進度

M7 完成隨機 Bot，M8 完成策略 Bot。
