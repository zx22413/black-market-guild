# `src/game`｜規則引擎

黑市商會的純規則引擎。只依規則與玩家行動推進對局，不依賴瀏覽器、Node 或任何執行期套件（由 `tsconfig.engine.json` 強制）。規則來源為 [`docs/game-design.md`](../../docs/game-design.md)，設計背景見 [`docs/architecture.md`](../../docs/architecture.md)，開發進度見 [`docs/implementation-plan.md`](../../docs/implementation-plan.md)。

外部程式（UI、Bot、Match Runner）只能從 `index.ts` 匯入。

## 公開 API

| 函式 | 說明 |
| --- | --- |
| `createMatch(config)` | 驗證設定（3～4 人、玩家 id 不重複、seed 為整數），建立對局並進入第 1 回合。回傳 `Result<Transition>`。 |
| `applyAction(state, action)` | 驗證並套用一名玩家的行動。收齊該階段所有決定後自動推進。回傳新狀態與公開事件，或錯誤代碼。 |
| `getPendingDecisions(state)` | 目前還沒提交決定的玩家與階段。 |
| `getLegalActions(state, playerId)` | 該玩家此刻所有合法行動；驗證、Bot 與 UI 共用。 |
| `getPlayerView(state, playerId)` | 該玩家可見的資訊；UI 與 Bot 只能使用這份資料。 |

## 檔案

| 檔案 | 職責 |
| --- | --- |
| `index.ts` | 公開 API 的唯一出口。 |
| `types.ts` | 玩家、角色、資產、事件、階段、行動、狀態、事件紀錄與錯誤的型別。 |
| `rules.ts` | 所有規則數值（`RULES_V06`），每個數值註明設計文件章節。規則邏輯不得寫死數字。 |
| `rng.ts` | seeded RNG（mulberry32）。狀態是一個 uint32，存在 `MatchState.rng`，可 JSON 序列化。 |
| `decks.ts` | 市場事件（12 張）與航海事件（14 張）的建立與抽牌。 |
| `flow.ts` | 回合狀態機：依序開啟決定階段、跳過無人需決定的階段、執行自動步驟、結束回合與對局。 |
| `decisions.ts` | 每個階段的決定者、待決定事項、合法行動列舉與行動比對鍵。 |
| `engine.ts` | `createMatch` 與 `applyAction` 的驗證與入口。 |
| `view.ts` | `PlayerView` 與資訊過濾。 |
| `scoring.ts` | 最終財富（現金＋資產半價）與平手判定。 |
| `cash.ts` | 現金增減的唯一入口，同時產生公開的 `cash-changed` 事件；另有依序串接多個步驟的 `chain`。 |
| `economics.ts` | 成本與收入的計算：獨資成本、合資每人出資、均分（除不盡時拋出錯誤，代表規則數值需要設計決定）。 |
| `phases/recruitment.ts` | 合資招募前三步：公開發起人、公開應徵、發起人挑選後建立合資船。 |
| `phases/sailing.ts` | 未配對者選擇的結算（建立獨資船），以及出航：扣成本、公開出航船隻、擲隱藏的原始骰。 |
| `resolution.ts` | 依修正順序計算最終骰值並判定沉沒或抵達；只公開結果，不公開骰值。 |
| `payouts.ts` | 依設計文件第 5 節步驟 6 的順序發放收益。 |

## 運作方式

```
市場事件（自動）→ 資產購買 → 發起招募 → 應徵 → 挑選 → 未配對者選擇
→（自動：扣成本、公開出航船隻、擲骰）→ 角色部署 → 情報商人重擲
→（自動：航海事件、判定、收益）→ 回合結束；6 回合後計分
```

- **同時決定：** 每個決定階段先收集所有決定者的提交（`roundState.submissions`，對其他玩家保密），收齊才推進。
- **跳過階段：** 沒有任何玩家需要決定的階段不會開啟，例如沒有人發起招募時跳過應徵與挑選。
- **不修改輸入：** 所有函式回傳新物件，不修改傳入的狀態。
- **可重現：** 同一個 seed 與同樣的行動順序必得相同結果；狀態可轉成 JSON 後繼續推進。
- **公開事件：** `applyAction` 回傳的 `MatchEvent` 只含公開資訊；私有資訊只經由 `PlayerView` 取得。

## 目前進度

- M1 完成：對局骨架、牌庫、玩家視角、計分。
- M2 完成：獨資與不出航、扣成本、擲骰、判定、航運收入。
- M3 完成：合資招募四步驟（發起、應徵、挑選、未配對者選擇）、合資出資與收入均分、資金限制。
- 尚未實作的規則在程式中以 `TODO(M4)`～`TODO(M6)` 標出。

可用 `npm run match:log -- [seed] [人數]` 在終端機印出一局隨機選擇的對局紀錄。
