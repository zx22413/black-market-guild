# 黑市商會｜程式架構

本文件描述程式的分層與對局驅動方式，**不定義任何 gameplay 規則**。規則以 [`game-design.md`](game-design.md) 為準；本文件中的介面名稱與型別皆為提案，實作時可依規則定案情況調整。

## 1. 目標

同一套規則引擎需支援下列對局形式，且新增形式時不需修改引擎：

- 單機對電腦：1v1、1v2、1v3。
- 自訂座位：玩家數 2–4 人，每個座位可自由指定為真人或 Bot，Bot 可選不同策略。
- 全 Bot 模擬：不含 UI，大量執行以驗證平衡（對應 `game-design.md` 第 10 節）。
- 多人連線：MVP 驗證後才實作，但架構現在就要預留。

## 2. 核心原則：引擎只認識座位

規則引擎只處理 `PlayerId`，不知道座位上是真人、Bot 或遠端玩家。「由誰做決定」屬於引擎之外的控制器（Controller）。

```
             ┌──────────────── Match Runner（對局主持人）────────────────┐
             │ 1. 向引擎查詢目前待決定事項                                 │
             │ 2. 將各座位的 PlayerView 交給該座位的 Controller             │
             │ 3. 收到行動後交由引擎驗證並套用                              │
             └──────────────────────────┬───────────────────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
  LocalHumanController            BotController               RemoteController
  （等待 UI 輸入）                （呼叫 Bot 策略）             （等待網路訊息）
```

## 3. 分層與相依方向

| 目錄 | 職責 | 可相依 |
| --- | --- | --- |
| `src/game/` | 規則引擎：狀態、行動驗證、結算、玩家視角 | 無 |
| `src/bots/` | Bot 策略 | `src/game` |
| `src/match/` | Match Runner、Controller 介面、座位設定 | `src/game`、`src/bots` |
| `src/ui/` | 瀏覽器 UI、`LocalHumanController` | `src/game`、`src/match` |
| `server/`（未建立） | 連線伺服器、`RemoteController` | `src/game`、`src/bots`、`src/match` |

- `src/game`、`src/bots` 不得使用 DOM 或 Node API，由 `tsconfig.engine.json` 強制。
- `src/match` 同樣應保持環境無關，使其能在瀏覽器、Node 模擬與伺服器中共用。`TODO`：建立 `src/match` 時將其納入 `tsconfig.engine.json`。
- 外部只能透過各層的 `index.ts` 使用其公開介面。

## 4. 規則引擎的四項要求

### 4.1 純函式且可序列化

- 以 `applyAction(state, action) → 新 state` 的形式推進對局，不修改傳入的狀態。
- `MatchState` 必須能完整轉為 JSON，以支援存檔、網路傳輸與重播。
- 非法行動應回傳明確的錯誤結果，而非靜默忽略。

### 4.2 明確列出待決定事項

引擎提供類似 `getPendingDecisions(state)` 的查詢，回傳「目前哪些座位需要做什麼決定」。

- 引擎不能假設所有決定都是輪流進行。依 `game-design.md`，角色部署為所有玩家秘密進行、於該階段鎖定；主持人需收齊全部座位的決定後，引擎才進入下一階段。
- 投資與合資階段是否同時進行、是否公開、如何處理邀請，取決於第 7.1 節尚未定案的合資流程。

### 4.3 玩家視角過濾

引擎提供 `getPlayerView(state, playerId)`，遮蔽該玩家不應得知的資訊（例如尚未揭露的他人角色部署）。

- UI 只以 `PlayerView` 繪製畫面。
- Bot 也只能取得 `PlayerView`，不得讀取完整 `MatchState`，以確保 Bot 不作弊，且模擬結果能反映真實的資訊條件。
- 連線時伺服器只傳送各玩家的 `PlayerView`，避免透過封包取得隱藏資訊。

### 4.4 可重現

- 所有隨機性皆透過注入的 `Rng`（`src/game/rng.ts`），不得直接呼叫 `Math.random()`。
- 以「初始 seed + 行動紀錄」即可完整重現一局，用於斷線重連、重播、bug 回報與平衡模擬。
- `TODO`：決定 RNG 狀態如何保存於 `MatchState`，使狀態序列化後仍能從中斷處延續相同的亂數序列。

## 5. 對局驅動

### 5.1 座位設定

```ts
type SeatConfig =
  | { kind: 'local-human'; name: string }
  | { kind: 'bot'; name: string; strategy: string }
  | { kind: 'remote'; name: string };

interface MatchConfig {
  seed: number;
  seats: SeatConfig[]; // 長度 2–4，由引擎驗證
}
```

### 5.2 Controller 介面

```ts
interface Controller {
  decide(view: PlayerView, decision: PendingDecision): Promise<Action>;
}
```

| Controller | 行為 |
| --- | --- |
| `LocalHumanController` | 將決定交給 UI，等待玩家操作後 resolve。 |
| `BotController` | 呼叫 Bot 策略 `(view, decision, rng) → Action`。 |
| `RemoteController` | 將決定送往客戶端，等待網路回應。 |

介面採用 `Promise`，讓三種 Controller 可以互換。全 Bot 模擬若因非同步而影響效能，可另提供同步執行路徑。

### 5.3 三種執行環境

| 模式 | 引擎與主持人的執行位置 | Controller 組合 |
| --- | --- | --- |
| 單機對電腦 | 瀏覽器 | 1 個 `LocalHuman`，其餘為 `Bot` |
| 全 Bot 模擬 | Node（無 UI） | 全部為 `Bot` |
| 多人連線 | Node 伺服器（權威結算） | `Remote`，並以伺服器端 `Bot` 補位 |

連線模式下，客戶端只送出行動意圖，由伺服器以同一套引擎驗證並結算。

## 6. 開發順序

1. 規則引擎（依 `game-design.md` 已定案的部分）＋ Match Runner ＋ `BotController`。
2. 全 Bot 模擬腳本，用於平衡驗證。
3. 瀏覽器 UI ＋ `LocalHumanController`，完成單機 1v1～1v3 與自訂座位。
4. MVP 驗證通過後，才建立 `server/` 與 `RemoteController`。

## 7. 待確認事項

以下事項會影響規則或產品方向，尚未定案；在確認前不實作相關細節。

### 7.1 合資邀請流程

`TODO`：`game-design.md` 第 5 節尚未定義合資邀請的處理流程。

- **影響範圍**：投資階段的待決定事項形式、`PlayerView` 的公開資訊、Bot 的合資判斷、連線時的訊息往返次數。
- **待確認**：
  - 採「提議 → 接受／拒絕」，或同時提交意願後由規則配對？
  - 一名玩家可否同時邀請多人？邀請被拒後可否再邀？
  - 邀請內容與結果是否對其他玩家公開？
  - 邀請階段是否有回合數或時間上限？

### 7.2 連線時的超時與斷線處理

`TODO`：僅影響多人連線，MVP 單機不需處理。

- **影響範圍**：`RemoteController`、伺服器的計時機制、斷線重連流程。
- **可選方向**：超時自動採用預設行動；改由 Bot 代打；暫停等待，並設上限。
- **待確認**：預設行動的定義屬於 gameplay 規則，若採用此方向，需先在 `game-design.md` 定義。

### 7.3 同一台裝置輪流遊玩（hot-seat）

`TODO`：尚未決定是否支援。

- **影響範圍**：UI 流程；引擎與 Match Runner 不受影響（多個 `LocalHumanController` 即可）。
- **待確認**：若支援，每位玩家做秘密決定前後都需要遮蔽畫面（「請將裝置交給下一位玩家」），以免看到他人的角色部署。
