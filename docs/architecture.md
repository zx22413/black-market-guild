# 黑市商會｜程式架構

本文件描述程式的分層與對局驅動方式，**不定義任何 gameplay 規則**。規則以 [`game-design.md`](game-design.md) 為準；本文件中的介面名稱與型別皆為提案，實作時可依規則定案情況調整。

## 1. 目標

同一套規則引擎需支援下列對局形式，且新增形式時不需修改引擎：

- 單機對電腦：1v2、1v3。
- 自訂座位：玩家數 3～4 人（核心規則），每個座位可自由指定為真人或 Bot，Bot 可選不同策略。
- 2 人模式（1v1）：規則需要中立船，尚未定案（見 `open-questions.md` Q-05）；座位設定需保留擴充空間，但在規則定案前不實作。
- 全 Bot 模擬：不含 UI，大量執行以驗證平衡（對應 `game-design.md` 第 11 節）。
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
- 角色部署階段包含一個情報商人的子步驟：所有座位鎖定角色與目標後，部署情報商人的座位會收到「是否重擲」的待決定事項，其 `PlayerView` 此時才包含目標船的原始骰值；收齊後才公開航海事件。
- 投資與合資階段同樣由多個「所有座位同時決定」的子步驟組成，詳見第 7.1 節。

### 4.3 玩家視角過濾

引擎提供 `getPlayerView(state, playerId)`，遮蔽該玩家不應得知的資訊（例如尚未揭露的他人角色部署）。

- UI 只以 `PlayerView` 繪製畫面。
- Bot 也只能取得 `PlayerView`，不得讀取完整 `MatchState`，以確保 Bot 不作弊，且模擬結果能反映真實的資訊條件。
- 連線時伺服器只傳送各玩家的 `PlayerView`，避免透過封包取得隱藏資訊。
- `applyAction` 的回傳值分成公開事件（`events`）與私有事件（`privateEvents`，每筆帶 `playerId`）。私有事件用於同一回合內稍縱即逝的私有資訊，例如情報商人重擲後的新骰值；Match Runner 與伺服器只能把它轉交給對應玩家。
- 公開事件是**依演出順序排列的事件流**，UI 應逐筆（或逐組）播放，避免一次湧入太多資訊。規則上同時發生的事（例如角色一次揭露）仍拆成依行動順序排列的多筆事件：情報商人 → 護衛 → 海盜 → 走私商人，每組後面緊接該組的部署費；四組一律送出，沒有人選的角色送空組，由 UI 決定是否略過。播放節奏（自動播放或「下一步」）由 UI 決定。

### 4.4 可重現

- 所有隨機性皆透過注入的 `Rng`（`src/game/rng.ts`），不得直接呼叫 `Math.random()`。
- 以「初始 seed + 行動紀錄」即可完整重現一局，用於斷線重連、重播、bug 回報與平衡模擬。
- RNG 狀態為單一 uint32，保存於 `MatchState.rng`；狀態序列化後可從中斷處延續相同的亂數序列（見 `src/game/rng.ts`）。

## 5. 對局驅動

### 5.1 座位設定

```ts
type SeatConfig =
  | { kind: 'local-human'; name: string }
  | { kind: 'bot'; name: string; strategy: string }
  | { kind: 'remote'; name: string };

interface MatchConfig {
  seed: number;
  seats: SeatConfig[]; // 目前長度 3～4，由引擎驗證；2 人模式待 Q-05 定案
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
| `LocalHumanController` | 將決定交給 UI，等待玩家操作後 resolve。hot-seat 時會有多個。 |
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
3. 瀏覽器 UI ＋ `LocalHumanController`，完成單機 1v2～1v3、自訂座位與 hot-seat。
4. MVP 驗證通過後，才建立 `server/` 與 `RemoteController`。

## 7. 已決定與待確認事項

### 7.1 合資邀請流程（已定案）

規則見 `game-design.md` 第 6 節「合資邀請流程」：發起招募 → 應徵 → 發起人挑選 → 未配對者選擇獨資或不出航。對架構的影響：

- 投資階段在資產購買之後，拆為四個「所有座位同時決定」的子步驟（發起招募、應徵、挑選、未配對者選擇），每個子步驟都由 `getPendingDecisions` 列出需決定的座位，收齊後才前進。
- 不需要決定的座位（例如發起人不參與應徵、無人應徵的發起人不參與挑選）不會出現在待決定事項中。
- 招募、應徵與挑選結果為公開資訊，會出現在所有玩家的 `PlayerView`。
- Bot 需實作的決定：是否買資產及買哪種、是否發起招募、應徵哪個招募、挑選哪位應徵者、獨資或不出航。

### 7.2 連線時的超時與斷線處理（延後）

`TODO`：多人連線延後到 MVP 驗證之後，屆時再決定。可選方向為超時採用預設行動、改由 Bot 代打，或暫停等待並設上限；若採用預設行動，需先在 `game-design.md` 定義。

### 7.3 同一台裝置輪流遊玩（hot-seat，MVP 支援）

- 以多個 `LocalHumanController` 實現，引擎與 Match Runner 不需特別處理。
- UI 需提供「換人」遮蔽畫面：輪到下一位真人做秘密決定（角色部署）前，先顯示「請將裝置交給 ○○」並隱藏上一位的資訊，確認後才顯示該玩家的 `PlayerView`。
- `TODO`：公開決定（合資招募、應徵、挑選等）是否也需要遮蔽畫面，待 UI 設計時決定；此為呈現問題，不影響規則。
