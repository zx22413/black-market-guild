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

測試在 `tests/v07/bots/`。

## `match/`

V0.7 的 Match Runner，程式與 `src/match` 相同（說明見 [`src/match/README.md`](../match/README.md)），只改接 `src/v07/game` 與 `src/v07/bots`，預設規則是 `RULES_V07`：`setupFromSeats`、`runMatchSync`、`runMatch`、`replayMatch`、`botController`。V0.6 的 UI 與連線層仍使用 `src/match`，搬遷到第 4、5 階段時改接這裡。測試在 `tests/v07/match/`。

Runner 的可選參數 `RunOptions.stage`：每個轉換（含開局）交給各座位之前先改寫一次，只給新手教學固定還沒公開的隨機結果用；不傳時行為不變。

## `tutorial/`

新手教學（[`docs/tutorial-outline.md`](../../docs/tutorial-outline.md)）：腳本化的對局，純邏輯、不接 UI。只改還沒公開的隨機結果（需求卡與航海事件的牌序、航行骰、情報重擲的新骰值、選島發牌），其他都由真的行動經過引擎產生，所以由公開事件重建的桌面一定和引擎一致。

| 檔案 | 說明 |
| --- | --- |
| `types.ts` | 腳本型別：每回合的需求卡、事件、骰值、Bot 的計畫、你的決定（`choose` 由你在桌上選，否則照 `demo` 代打）、講解步驟（`CoachStep`，觸發點是你的某個決定之前、某回合結算中、或結束後；`focus` 是這一步要亮起的地方，只寫意義，畫面位置由 UI 決定）。 |
| `stage.ts` | `tutorialStage(script)`：Runner 的 `stage` 掛勾。 |
| `play.ts` | 把計畫變成合法行動（找不到就丟錯，規則變了腳本會先壞）；`allowedFor` 過濾你這一步能選的行動；`playTutorial` 無頭跑完整個腳本（測試用）。 |
| `allow.ts` | 過濾條件：裝貨上限（保留所有較小的裝法，桌上才能一箱一箱加）、先選建築、指定角色與目標船、重擲與否。 |
| `coach.ts` | `coachView`：目前該顯示哪個講解步驟、是否擋住你的決定、做決定時要顯示的待辦。 |
| `seats.ts` | 共用座位（你在林場島）、只減少回合數的規則、講解文字引用的規則數字。 |
| `basics.ts` | 完整教學：6 回合引導對局，五個角色依序在局內教。 |
| `roleScenarios.ts` | 單課重玩（各 1 回合）：護衛、海盜、情報商人、走私商人、軍火掩護、莊家。 |
| `islandsLesson.ts` | 開局選島：你自己 2 選 1，看完同時公開就結束。 |

測試在 `tests/v07/tutorial/`（每一課照腳本演出、你所有能選的裝貨組合都不會破壞後面的劇情）與 `tests/ui-v07/tutorialChoices.test.ts`（桌上的選擇邏輯點得出每個示範動作）。

## `online/`

V0.7 的連線房間，程式與 `src/online` 相同（說明見 [`src/online/README.md`](../online/README.md)），改接 V0.7 的 Runner 與 Bot：`PROTOCOL_VERSION` 為 2、座位數與起始現金取自 `RULES_V07`、空位由 V0.7 個性的 Bot 補上。伺服器入口是 `server/worker-v07.ts`（共用的 Worker／Durable Object 程式在 `server/rooms.ts`），只在本機以 `npm run server:dev:v07`（`wrangler.v07.jsonc`，port 8788）執行，不部署；`npm run online:smoke` 對它跑一局無頭連線測試。測試在 `tests/v07/online/`。

批量模擬：`npm run simulate`（`scripts/simulate.ts`、`scripts/sim-stats.ts`）已改為 V0.7，統計只取自對局紀錄的公開事件與最終狀態。
