# `src/v07`｜正式規則引擎（V0.8）

依 [`docs/game-design.md`](../../docs/game-design.md)（V0.8）實作的正式引擎，搬遷計畫見 [`docs/v07-migration-plan.md`](../../docs/v07-migration-plan.md)。V0.6 的 `src/game` 與 UI 仍在使用中；全部改接完成後，這裡的程式會移回 `src/game`、`src/bots`。

純度限制與 `src/game` 相同（`tsconfig.engine.json`）：不得使用 DOM 或 Node API；所有隨機性透過 `game/rng.ts`；狀態可 JSON 往返，且不修改傳入物件。

## `game/`

公開 API 與 V0.6 相同：`createMatch`、`applyAction`、`getPendingDecisions`、`getLegalActions`、`getPlayerView`，從 `index.ts` 匯入。

| 檔案 | 說明 |
| --- | --- |
| `types.ts` | 狀態、行動、公開事件、私有事件。 |
| `rules.ts` | 所有規則數值，各註明設計文件章節；島嶼特色也在這裡。`RULES_CURRENT`＝`RULES_V08`（版本字串 V0.8，2026-11-23 起的正式規則，`createMatch` 的預設）；`RULES_V07`（V0.7.1 船艙版）與 `RULES_BUILDINGS`（舊建築版）只給比較用的模擬與舊測試。 |
| `engine.ts` | 建立對局（洗牌、發選島選項）、驗證並套用行動。 |
| `flow.ts` | 回合狀態機：選島 → 每回合開始（生產、需求卡、通緝、公開航海事件）→ 投資 → 部署 → 自動結算。 |
| `decisions.ts` | 決策者與合法行動列舉；行動合法性一律以此判定。 |
| `phases/` | 選島、投資（建造、裝貨、出航、擲骰）、角色（鎖定、揭露、外交官判定）。 |
| `resolution.ts` | 航海事件與航行修正順序（§9.1）。 |
| `market.ts` | 黑市交易（§5 步驟 8、§7.3、§9.5、§10.2）。 |
| `islands.ts` | 島嶼特色的生產、費用、容量、冷卻與選島發牌。 |
| `view.ts` | 玩家視角：別人的貨在結算前隱藏、選島選項只給本人。 |
| `decks.ts`、`goods.ts`、`cash.ts`、`scoring.ts`、`rng.ts` | 牌庫、商品運算、現金與事件串接、終局計分、亂數。 |

私有事件：選島選項（`island-offers`）、自己船上的貨（`cargo-loaded`）。

測試在 `tests/v07/game/`，依設計文件章節分檔。

## V0.8（`game/v08-rules.ts`、`game/v08.ts`、`bots/v08.ts`）

**2026-11-23 起是正式規則**（`docs/game-design.md` V0.8；下面的說明是原型時期寫的沿革，「原型」「測試值」指的是數字來自 Bot 模擬、還沒經過真人試玩）。依 `docs/proposals/2026-11-v08-decision-index.md` §3.1 的討論做成。規則物件多了 `rules.v08`，開關 `crates`、`skills`、`buildings`、`islandVariants` 在 `RULES_V07`、`RULES_BUILDINGS` 都是 0（線上對局行為不變）；`RULES_V08` 全開（2026-11-15 簡化後島嶼變體 `islandVariants` 與單面牌 `events.lateCards` 改回 0，程式碼保留；風暴潮、海盜潮改用下表的 `tideStormExtraLoss`、`tidePirateArrivalLoot`，`tideStorm`、`tidePirate` 為 0；只有暗潮對應的牌會翻；軍械庫減半所有搶奪），並帶 2026-11-14～15 調整後的基準（孤注號船費 50 G、巨鯨號船費 75 G、海嘯號 7／8／9+ 倍率 150／200／250% 且巨浪加骰為 1d3、私貨算進到港量且照掉貨表、軍火超量查緝 `v08.inspection`、開啟技能 2 鐵、技能出航 2 次後自動升二級 `v08.levelUp`（不再有材料強化）、幽靈號一級自帶掩護且二級才有 1 件私貨、沉船的貨只能撈一次、修船廠 2 木 1 鐵；見 `docs/proposals/2026-11-playtest-feedback-and-direction.md` §10.9）。`npm run simulate` 預設就用它跑（`--v07` 改跑 V0.7.1），`--set v08.…=數字` 可調任何值（例：`--set v08.raise.multiplier=350`、`--set v08.tables.standard.lose.2=1`）。

| 開關 | 內容 |
| --- | --- |
| `crates` | 每單位貨是一箱：最終值查表決定沉沒或丟幾箱（先丟本回合變價前最貴的，同價依 `GOODS` 順序）與倍率；只有抵達的箱算到港量。表在 `v08.tables`（最終值超出表的範圍用最近的一格；-1 = 沉沒）。 |
| `skills` | 投資時可做一個材料行動（開船技能 1 木 1 鐵、升級 2 木 1 鐵，最多開 2 種船）；信天翁號重擲、孤注號加注（`raise`）、巨鯨號拾荒、幽靈號私貨艙（`privateLoad`）、海嘯號加骰。 |
| `buildings` | 每局最多一棟：修船廠（2 木）、軍械庫（2 軍火）、商行（2 香料，每次投資指名保價的貨 `protect`）。 |
| `islandVariants` | 船塢島＋修船廠、要塞島＋軍械庫、香料群島＋商行、走私港＋軍械庫。 |
| `events.enabled` | 事件牌庫決定局長（`game/v08-events.ts`）：開局把 12 張航海事件洗勻，另有 2 張推進牌，第 1 張「暗潮將至」在第 `firstAdvanceFrom`～`firstAdvanceTo` 回合（3～5）、第 2 張在 `secondAdvanceFrom`～`secondAdvanceTo` 回合（6～10）均勻隨機，其他回合翻一般事件（牌庫存在 `MatchState.v08Events`，不公開）。暗潮將至那回合沒有一般事件，回合結束（香料腐壞後）每人倉庫每種貨失去 `warehouseLossPercent`%（無條件捨去），下一回合起進入第二階段：暴風雨 −2、順風 +2、海霧變「海盜伏擊」（每個海盜 −2、沒有 +1）、黑市熱絡變「嚴查」（查緝額度 −1、走私價值照常 100）、風平浪靜變「貨滿為患」（跌價格數 ×2）、月黑風高變成護衛無效且自家走私商人不再掩護（幽靈號自帶掩護仍有效）。第 2 張推進牌那回合是最後一回合、沒有一般事件，用比賽亂數抽「黑市大開」（每種貨需求 +1、不跌價）或「最後一搏」（每艘船的原始骰取兩顆 d6 較高者）。`maxRounds`（10）是保險上限。最後一回合不能出巨鯨號；所有「最後一回合」判斷改用 `isFinalRound`／`arrivesInTime`。公開狀態在 `PlayerView.events`，事件 `dark-tide-rising`、`phase-two-started`、`boss-event`、`final-round`、`dark-tide-loss`。關掉時行為與之前完全相同。 |
| `events.tides` | 暗潮種類：開局（建立對局時，選島之前）用比賽亂數從「風暴潮」（每艘船 `tideStorm` = −1）、「海盜潮」（每個海盜修正再 `tidePirate` = −1）、「查緝潮」（查緝額度再 `tideInspection` = −1）、「崩盤潮」（跌價格數再 ×`tideDropMultiplier` = 2）抽 2 種不同的候選並公開（事件 `tide-candidates`），翻到暗潮將至時再從這 2 種隨機選 1 種公開（`tide-revealed`），從下一回合起（第二階段各回合與最後一回合）持續生效，與首領事件疊加（貨滿為患 × 崩盤潮 = 跌 4 倍格數，照常停在價格軌底）。`PlayerView.events` 多了 `tideCandidates`、`tide`；生效判斷用 `activeTide`（第二階段且已選出）。 |
| `events.lateCards` | 「黑市大開」（每種貨需求 +`openMarketDemand`、本回合不跌價）與「最後一搏」（原始骰取 `lastGambleDice` 顆 d6 較高者）各 1 張單面牌：建牌庫時，第一階段的位置先發完一般事件，剩下的一般事件與這 2 張洗勻後供第 1 張推進牌之後的位置使用，所以只會在第二階段（最後一回合之前）翻到；第二階段回合太少時可能不出現。翻到的那回合沒有一般事件（不是首領事件），事件 `late-card`，`PlayerView.events.lateCard`。 |
| `events.flipOnlyTideCard` | 第二階段只有與已揭曉暗潮對應的那張事件牌翻成首領版（風暴潮↔暴風雨、海盜潮↔海霧（海盜伏擊）、查緝潮↔黑市熱絡（嚴查）、崩盤潮↔風平浪靜（貨滿為患）），其他牌維持第一階段效果；月黑風高、順風永遠不翻。暗潮揭曉後 `PlayerView.events.flipCard` 公開會翻的那張（揭曉前 null；開關為 0 時沒有這個欄位，六張照舊全翻）。所有首領判斷走 `bossSide(pe, event)`，`boss-event` 只在會翻的牌發出。 |
| `events.tideStormExtraLoss` | 風暴潮改對應修船廠：風暴潮生效時，每艘抵達且最終值在 `tideStormLossFrom`～`tideStormLossTo`（2～3）的船在掉貨表之外再多丟這麼多箱（照常先丟最貴的、不會超過船上的貨；不會沉的巨鯨號最終值 1 視為 2）。修船廠規則不變（2～3 少丟 1 箱），所以有修船廠的船在風暴潮下丟的正好等於沒有暗潮時沒有修船廠的船。`CrateContext.stormTide` 帶這個狀態（只在生效時加上），報表事件 `v08-effect` 的 `storm-tide`（貨箱＝多丟的箱、G＝少賺）。`tideStorm`（每船修正）可同時設定。 |
| `events.tidePirateArrivalLoot` | 海盜潮改對應軍械庫：海盜潮生效時，海盜所在的船若抵達且最終值的一般搶奪比例為 0（今天是最終值 3 以上），改搶船東剩餘收入的這個百分比（30），分法與通緝加成照舊（`arrivalLoot`），報表事件 `pirate-tide`。`tidePirate`（每個海盜修正）可同時設定。 |
| `armory.halveAllLoot` | 軍械庫把海盜從船東船上拿走的每一筆都減半（沉船搶奪、抵港搶奪，包括最終值 1／2 的一般比例與海盜潮的 30%；通緝加成照舊），取代原本只把沉船搶奪壓到 `lootPercent`。抵港減半也記成 `armory` 效果。要塞島、走私港的變體程式碼不動（`islandVariants` 關閉時不會觸發）。 |
| `events.finalBoth` | 最後一回合改為「最後的大市集」（`finalEffect` = `final-market`）：需求 +1、不跌價、原始骰取兩顆較高者同時生效，不再抽亂數；暗潮照常生效，但「不跌價」蓋過崩盤潮。 |
| `repairyard.immuneStormTide` | 修船廠擋風暴潮：船東的船（含巨鯨號）不受風暴潮多丟的箱（判斷在 `crateTerms`，`stormShielded`），修船廠本身終值 2～3 少丟 1 箱照舊。報表效果 `storm-shield`（貨箱＝少丟的箱、G＝多賺），`repairyard` 只記一般的那 1 箱。 |
| `armory.immunePirateTide` | 軍械庫擋海盜潮：船東抵港的船不受海盜潮 30% 的抵港搶奪（`arrivalLoot` 的 `shielded`）；一般搶奪照舊、照樣減半。報表效果 `pirate-shield`（G＝海盜潮本來會拿走的，已減半）。 |
| `tradehouse.immuneCrashTide` | 商行擋崩盤潮：崩盤潮讓跌價格數加倍時，船東自己抵港的貨（每種，不含私貨）用「拿掉崩盤潮倍數」的跌價賣（`eventPriceStep(…, withoutTide)`；貨滿為患等其他倍數照算），指名保價的貨仍用變價前的價格；市場價格與其他玩家不變。報表效果 `crash-shield`（貨箱＝受保的箱、G＝多賺），`tradehouse` 只記指名的貨。 |
| `botPirateCrates` | 只影響 Bot（不是規則）：海盜部署改用 `bots/v08.ts` 的 `pirateLootCrates` 估分：目標船的船型、公開的技能等級、加注、建築與島、本回合事件與已生效暗潮（巨鯨號看下一回合）、我的海盜修正算出最終值分布，沉沒拿全部貨值的沉沒比例、抵港拿丟箱後收入的比例（海盜潮 30% 除非船東軍械庫擋下），船東有軍械庫時減半；貨量照 `guessedCargoValue` 從公開倉庫猜（上限為船的箱數）；只算我一個海盜、不算護衛與海關。軍械庫的海盜威脅（`armoryDenied`）改為依 `TYPE_USE` 平均各船型，並以 1/6 機率算海霧（翻成海盜伏擊時用首領修正）；有 `armory.immunePirateTide` 時海盜潮那部分全算（沒有時算一半）。 |

材料行動與加注、私貨、保價都在 `invest` 行動的可選欄位裡，合法性照樣由 `getLegalActions` 列舉。最後的大市集擲兩顆骰時，`voyage-modifiers` 的每艘船多一個 `dice`（擲出的每一顆，結算時才公開；`Ship.gambleDice` 和 `rawRoll` 一樣不進任何視角）。公開事件多了 `materials-used`、`trade-protected` 與只給報表用的 `v08-effect`（技能、建築、島嶼變體的觸發與估計金額）；`ship-resolved` 多了 `lost`、`privateCargo`。Bot 的估分在 `bots/v08.ts`（以每次決定的快取估算貨箱期望值、材料行動在剩餘航程的價值、加注、保價貨）。事件牌庫開啟時，Bot 用 `bots/estimates.ts` 的 `isFinal`、`expectedRoundsLeft`（第 2 張推進牌還沒出現時，視為在其窗口內本回合之後的各回合機率相同，取平均）、`survivingUnits`（暗潮將至回合留在倉庫的貨只算剩下的量），並用第二階段的有效修正估骰值、價格與查緝。暗潮種類開啟時，這些修正（`eventShift` 以外另加 `tideShift`、`pirateModifier`、`inspectionAllowance`、`dropMultiplier`）都含已生效的暗潮；單面牌與最後的大市集經 `diceToRoll`、`noPriceDrop` 比照最終效果處理。建築與開技能的價值（`materialWorth`）改為分段加總：剩餘回合 R = `expectedRoundsLeft`；暗潮已選出後全部 R 回合都用該暗潮的視角估；還沒選出時，第 1 張推進牌視為在其窗口內本回合之後各回合機率相同、平均回合 A，前 min(R, A − 本回合) 回合不算暗潮，其餘回合兩種候選各半；每回合 0.85 次出航。暗潮只透過既有的估法發揮：風暴潮讓每次航程的修正 −1、海盜潮讓軍械庫估的被海盜擊沉機率提高、查緝潮讓查緝比例提高（幽靈號技能的自帶掩護更值錢）、崩盤潮讓商行保價的價值乘 2。簡化後 Bot 也看得到新效果：貨箱展望的 `Plan.stormTide`（風暴潮多丟的箱，所以有修船廠的船在風暴潮下的展望等於沒有暗潮時；修船廠本身每次仍只省 1 箱，價值不會因風暴潮變高）、海盜部署估分的 `expectedLoot` 多了 `LootTerms`（海盜潮的抵港搶奪、目標船東有軍械庫時減半；`botPirateCrates` 開啟時改用 `pirateLootCrates`）、軍械庫在 `halveAllLoot` 下估「海盜拿走的一半」（沉船與抵港都算，含海盜潮的 30%），以及 `laterView` 依各段的暗潮換算 `flipCard`。測試在 `tests/v07/game/v08-proto.test.ts`（固定 6 回合，事件牌庫關閉）、`tests/v07/game/v08-events.test.ts`、`tests/v07/game/v08-tides.test.ts`（這三個固定為簡化前的設定 `RULES_V08_PRE_SIMPLIFY`，在 `tests/v07/game/helpers.ts`）、`tests/v07/game/v08-simplify.test.ts`（簡化後、建築擋暗潮之前的設定 `RULES_V08_PRE_SHIELDS`）、`tests/v07/game/v08-shields.test.ts`（建築擋暗潮與 `botPirateCrates`）與 `tests/v07/bots/v08.test.ts`。建築擋暗潮開啟後，Bot 估建築價值時擋下的部分照分段自然計入：暗潮揭曉前，第二階段的回合兩種候選各半（所以擋的那種暗潮是候選時約算 50%，不是候選時 0），揭曉後對上的暗潮全部回合 100%；修船廠經 `crateTerms` 的展望、軍械庫經 `armoryDenied`、商行在 `buildingExtras` 加上「其他抵港貨在崩盤潮下少跌的格數」並在本回合的貨箱展望用 `expectedPrice(…, withoutTide)`。報表在任一擋暗潮開關開啟（或加 `--bets`）時多印「押注」表：每種解法只看它對應的暗潮是候選的對局，分成揭曉前就有且對上（押對）、揭曉前就有但沒對上（押錯）、揭曉後才拿（對上／沒對上）、從沒拿，各自的座位數與勝率，以及押對任一暗潮的座位與其他座位的勝率；`--summary` 多三欄擋暗潮次數與押對／其他勝率。

## `bots/`

V0.7 的 Bot，由原型 `src/proto/economy/bots` 移植。介面與 V0.6 相同：`decide(DecisionContext) → Action`，`DecisionContext` 只有自己的 `PlayerView`、待決定事項與合法行動；自己船上的貨（`view.ships[].cargo`）已在視角裡，不需要讀 `MatchState`。

| 檔案 | 說明 |
| --- | --- |
| `index.ts` | `createBot(strategy, seed)`、`BOT_STRATEGIES`。 |
| `random.ts` | 從合法行動中均勻隨機選擇。 |
| `heuristic.ts` | 期望值 Bot：為每個合法行動估分（G），softmax 抽樣；海關以公開倉庫估計目標船載了什麼，用期望沒收價值選指名的貨；外交官以假設的猜中機率估算猜法。 |
| `personality.ts` | 四種個性 `balanced`、`cautious`、`aggressive`、`builder`：風險、攻擊性、建築偏好、留貨耐心、隨機程度。 |
| `estimates.ts` | 只用公開資訊的估算：抵達機率、依對手公開倉庫猜到港量與新價格、建築價值、各角色在各艘船上的價值。 |
| `islands.ts` | 選島：依島嶼特色估算整局價值（生產、出航修正與成本、可裝貨量、角色修正、部署費與冷卻、香料、掩護），再乘上個性權重。原型只依個性偏好選島。 |
| `choose.ts` | softmax 抽樣；溫度 0 永遠選最高分。 |

測試在 `tests/v07/bots/`。

## `match/`

V0.7 的 Match Runner，程式與 `src/match` 相同（說明見 [`src/match/README.md`](../match/README.md)），只改接 `src/v07/game` 與 `src/v07/bots`，預設規則是引擎的 `RULES_CURRENT`（V0.8）：`setupFromSeats`、`runMatchSync`、`runMatch`、`replayMatch`、`botController`。V0.6 的 UI 與連線層仍使用 `src/match`，搬遷到第 4、5 階段時改接這裡。測試在 `tests/v07/match/`。

Runner 的可選參數 `RunOptions.stage`：每個轉換（含開局）交給各座位之前先改寫一次，只給新手教學固定還沒公開的隨機結果用；不傳時行為不變。

## `tutorial/`

新手教學（[`docs/tutorial-outline.md`](../../docs/tutorial-outline.md)）：腳本化的對局，純邏輯、不接 UI。只改還沒公開的隨機結果（需求卡與航海事件的牌序、航行骰、選島發牌），其他都由真的行動經過引擎產生，所以由公開事件重建的桌面一定和引擎一致。

| 檔案 | 說明 |
| --- | --- |
| `types.ts` | 腳本型別：每回合的需求卡、事件、骰值、Bot 的計畫、你的決定（`choose` 由你在桌上選，否則照 `demo` 代打）、講解步驟（`CoachStep`，觸發點是你的某個決定之前、某回合結算中、或結束後；`focus` 是這一步要亮起的地方，只寫意義，畫面位置由 UI 決定）。 |
| `stage.ts` | `tutorialStage(script)`：Runner 的 `stage` 掛勾。 |
| `play.ts` | 把計畫變成合法行動（找不到就丟錯，規則變了腳本會先壞）；`allowedFor` 過濾你這一步能選的行動；`isReady` 判斷桌上的選擇是否已經完成（亮起提交）；`playTutorial` 無頭跑完整個腳本（測試用）。 |
| `allow.ts` | 過濾條件：裝貨上限（保留所有較小的裝法，桌上才能一箱一箱加）、先選船型、指定角色與目標船、重擲與否。 |
| `coach.ts` | `coachView`：目前該顯示哪個講解步驟、是否擋住你的決定、做決定時要顯示的待辦。 |
| `seats.ts` | 共用座位（你在船塢島）、`shortRules`（正式規則 V0.8，關掉決定局長的事件牌庫、固定回合數）、宣傳片用的 `trailerRules`（V0.7.1）、講解文字引用的規則數字、聚焦目標 `F`。 |
| `basics.ts` | 基礎引導對局（3 回合，件數制）：選船出航、掉貨、黑市價格、貨物、五種船與孤注號的賭局；角色在單課教。 |
| `growth.ts` | 成長（2 回合）：材料行動、蓋修船廠（骰 3 少掉 1 箱）、開啟孤注號並加注（骰 6 ×4）。 |
| `tideLesson.ts` | 暗潮（3 回合，事件牌庫打開、窗口縮成第 2、3 回合）：暗潮候選與押注、暗潮將至（倉庫減半）、最後的大市集下風暴潮與修船廠的差別。`stage.ts` 依腳本把牌庫與候選暗潮排好（`RoundScript.event` 可以是 `'advance'`、`TutorialScript.tideCandidates`）。 |
| `roleScenarios.ts` | 角色單課（各 1 回合）：護衛、海盜、海關、走私商人、掩護（走私商人派在自己船上，擋軍火查緝）、外交官。 |
| `islandsLesson.ts` | 開局選島：你自己 2 選 1，看完同時公開就結束。 |

測試在 `tests/v07/tutorial/`（每一課照腳本演出、你所有能選的裝貨組合都不會破壞後面的劇情）與 `tests/ui-v07/tutorialChoices.test.ts`（桌上的選擇邏輯點得出每個示範動作）。

## `online/`

V0.7 的連線房間，程式與 `src/online` 相同（說明見 [`src/online/README.md`](../online/README.md)），改接 V0.7 的 Runner 與 Bot：`PROTOCOL_VERSION` 為 9（V0.8）、座位數與起始現金取自 `RULES_CURRENT`、空位由 V0.7 個性的 Bot 補上。伺服器入口是 `server/worker-v07.ts`（共用的 Worker／Durable Object 程式在 `server/rooms.ts`），只在本機以 `npm run server:dev:v07`（`wrangler.v07.jsonc`，port 8788）執行，不部署；`npm run online:smoke` 對它跑一局無頭連線測試。測試在 `tests/v07/online/`。

批量模擬：`npm run simulate`（`scripts/simulate.ts`、`scripts/sim-stats.ts`）已改為 V0.7，統計只取自對局紀錄的公開事件與最終狀態。
