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
