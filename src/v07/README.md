# `src/v07`｜V0.7 規則引擎（搬遷中）

依 [`docs/game-design.md`](../../docs/game-design.md)（V0.7）實作的正式引擎，搬遷計畫見 [`docs/v07-migration-plan.md`](../../docs/v07-migration-plan.md)。V0.6 的 `src/game` 與 UI 仍在使用中；全部改接完成後，這裡的程式會移回 `src/game`、`src/bots`。

純度限制與 `src/game` 相同（`tsconfig.engine.json`）：不得使用 DOM 或 Node API；所有隨機性透過 `game/rng.ts`；狀態可 JSON 往返，且不修改傳入物件。

## `game/`

公開 API 與 V0.6 相同：`createMatch`、`applyAction`、`getPendingDecisions`、`getLegalActions`、`getPlayerView`，從 `index.ts` 匯入。

| 檔案 | 說明 |
| --- | --- |
| `types.ts` | 狀態、行動、公開事件、私有事件。 |
| `rules.ts` | `RULES_V07`：所有規則數值，各註明設計文件章節；島嶼特色也在這裡。 |
| `engine.ts` | 建立對局（洗牌、發選島選項）、驗證並套用行動。 |
| `flow.ts` | 回合狀態機：選島 → 每回合開始（生產、需求卡、通緝）→ 投資 → 部署 → 情報重擲 → 自動結算。 |
| `decisions.ts` | 決策者與合法行動列舉；行動合法性一律以此判定。 |
| `phases/` | 選島、投資（建造、裝貨、出航、擲骰）、角色（鎖定、重擲、揭露）。 |
| `resolution.ts` | 航海事件與航行修正順序（§9.1）。 |
| `market.ts` | 黑市交易（§5 步驟 8、§7.3、§9.5、§10.2）。 |
| `islands.ts` | 島嶼特色的生產、費用、容量、冷卻與選島發牌。 |
| `view.ts` | 玩家視角：別人的貨在結算前隱藏、選島選項只給本人。 |
| `decks.ts`、`goods.ts`、`cash.ts`、`scoring.ts`、`rng.ts` | 牌庫、商品運算、現金與事件串接、終局計分、亂數。 |

私有事件：選島選項（`island-offers`）、自己船上的貨（`cargo-loaded`）、情報商人看到的骰值（`intel-report`、`intel-reroll-result`）。

測試在 `tests/v07/game/`，依設計文件章節分檔。

## `bots/`

V0.7 的 Bot，由原型 `src/proto/economy/bots` 移植。介面與 V0.6 相同：`decide(DecisionContext) → Action`，`DecisionContext` 只有自己的 `PlayerView`、待決定事項與合法行動；自己船上的貨（`view.ships[].cargo`）與情報商人看到的骰值（`view.intel`）都已在視角裡，不需要讀 `MatchState`。

| 檔案 | 說明 |
| --- | --- |
| `index.ts` | `createBot(strategy, seed)`、`BOT_STRATEGIES`。 |
| `random.ts` | 從合法行動中均勻隨機選擇。 |
| `heuristic.ts` | 期望值 Bot：為每個合法行動估分（G），softmax 抽樣；情報重擲固定照經驗法則（自己有貨的船、骰值會沉就重擲）。 |
| `personality.ts` | 四種個性 `balanced`、`cautious`、`aggressive`、`builder`：風險、攻擊性、建築偏好、留貨耐心、隨機程度。 |
| `estimates.ts` | 只用公開資訊的估算：抵達機率、依對手公開倉庫猜到港量與新價格、建築價值、各角色在各艘船上的價值。 |
| `islands.ts` | 選島：依島嶼特色估算整局價值（生產、出航修正與成本、可裝貨量、角色修正、部署費與冷卻、香料、掩護），再乘上個性權重。原型只依個性偏好選島。 |
| `choose.ts` | softmax 抽樣；溫度 0 永遠選最高分。 |

測試在 `tests/v07/bots/`；`helpers.ts` 的 `playBots` 是階段 3 Match Runner 完成前的最小對局迴圈。
