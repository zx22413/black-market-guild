# `src/proto`｜規則原型

用來以 Bot 模擬比較改版方案。`economy/` 的 `--preset round14` 與 [`docs/game-design.md`](../../docs/game-design.md) 的 V0.7 規則一致，可作為搬遷到正式引擎時的參考實作；其他預設組合只是比較用的歷史版本。這裡的程式碼與數值**不是規則**，也不接 UI 或連線；方案定案後，才依 [`docs/game-design.md`](../../docs/game-design.md) 的更新搬進 `src/game`。

純度限制與 `src/game` 相同：只用 `ES2022`，不得使用 DOM 或 Node API（`tsconfig.engine.json`）；所有隨機性透過 `src/game/rng.ts`；狀態可 JSON 往返，且不修改傳入物件。

## `economy/`｜經濟改版原型

依 [`docs/proposals/2026-10-economy-rework.md`](../../docs/proposals/2026-10-economy-rework.md) 第 12～18 節：移除合資，自家島生產材料，蓋建築或裝船運去黑市港，依需求卡決定價格。商品有木材、鐵礦（可蓋可賣）、香料（放不住）與軍火（會被別人的護衛沒收）；預設規則只啟用木材與鐵礦，`--preset round5` 啟用全部商品與新建築牙行（調整需求）。規則物件的 `mode` 切換兩個方案：

- **A｜各自的船：** 每人最多一艘自己的船，秘密裝貨；護衛守別人的船抵達時有護航費。
- **B｜共乘中立船：** 每回合一艘木材船、一艘鐵礦船，玩家付運費把貨放上去，裝貨公開。

每回合：生產與需求卡 → 投資（建造＋裝貨，一次同時提交）→ 部署角色 → 情報重擲 → 航海事件、揭露、航程結算 → 黑市交易（價格當回合生效）。

| 檔案 | 說明 |
| --- | --- |
| `index.ts` | 公開 API。 |
| `types.ts` | 狀態、行動、事件型別。 |
| `rules.ts` | 暫定數值 `ECONOMY_RULES`、`economyRules(mode)`。 |
| `engine.ts` | `createEconomyMatch`、`applyEconomyAction`、需求卡與航海事件牌庫。 |
| `flow.ts` | 回合狀態機與終局。 |
| `decisions.ts` | 決策者與合法行動列舉（裝貨容量、運費、走私限制）。 |
| `invest.ts` | 建造、裝貨、出航與擲骰；方案 A 的貨只有船東看得到。 |
| `voyage.ts` | 角色部署、情報重擲、航海事件、骰值修正。 |
| `settlement.ts` | 黑市交易：價格、賣貨、走私、海盜、護航費、保險、打撈。 |
| `scoring.ts` | 終局財富：現金＋建築（現金成本一半），剩餘材料歸零。 |
| `view.ts` | 玩家視角，Bot 只能用它決策。 |
| `runner.ts` | `runEconomyMatch`：同步跑完一局全 Bot 對局。 |
| `bots/` | 隨機 Bot 與四種期望值個性（`balanced`、`cautious`、`aggressive`、`builder`）。 |

模擬：`npm run simulate:economy -- --mode A|B [--matches 2000] [--players 4] [--set capacity.base=3] [--summary]`，報表存於 `docs/simulations/`。測試在 `tests/proto/economy/`。
