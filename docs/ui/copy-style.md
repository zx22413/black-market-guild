# 說明文案寫法

> 狀態：採用（2026-11-24 起；教學、規則書、介面說明、選單與連線、開發日誌都已照這份改寫）。
> 起因：教學「五種船」一步讀起來像規格書，用詞和語氣「有 AI 味」；新手也看不懂其中一半。

## 1. 先分清楚是哪一種文案

同一條規則，在不同地方要用不同寫法。先判斷手上這段文字屬於哪一種：

| 種類 | 在哪裡 | 讀的人在做什麼 | 寫法 |
| --- | --- | --- | --- |
| **教學主持人** | `src/v07/tutorial/*.ts` 的步驟 | 第一次玩，手上正要做一件事 | 像坐在旁邊的人講話：只講這一刻用得到的，用玩家剛經歷的事當例子 |
| **規則書／說明** | 規則手冊（`RulesPanel`、`table/*Text.ts`）、卡片與圖示的說明 | 玩到一半想查一件事 | 精確、好掃讀：先講結論，例外另起一行；可以長，但要有結構 |
| **介面短句** | 按鈕、提示條、`labels.ts`、選單 | 匆匆一瞥 | 一句話、動詞開頭或名詞片語，約 15 字內 |

教學可以不完整（之後再教），規則書不可以不完整（它是查詢用的）。很多「怪」來自把規則書的寫法放進教學。

## 2. 業界常見的原則

整理自遊戲 UX 寫作與桌遊規則書的文章（來源見文末），各家說法大同小異：

1. **用到才教，一次一件事。** 一開始把所有東西倒給玩家，是教學最常見的失敗；拆成小塊，在玩家需要時才出現。
2. **短。** 一般介面說明建議 1～2 句；提示框約 10～15 個詞（中文約 20～30 字）。唸出來超過 3 秒、或唸起來不自然，就太長。
3. **從玩家的目標寫，不從系統寫。** 先說「你可以做什麼／為什麼要做」，再說機制。
4. **名詞先定義再使用。** 規則書尤其如此：一個詞第一次出現時要已經懂，或當場說明。
5. **例外寫清楚、和核心規則分開。**
6. **同一件事永遠用同一個詞**，格式（粗體、引號）也一致。
7. **讓玩家做，邊做邊教**；做過一次的事再提起時，說明可以更短。
8. **反覆改。** 先寫初稿，找人實際玩，在卡住的地方改。

## 3. 本遊戲文案的「AI 味」清單

這些寫法單看都不算錯，但疊在一起就像機器寫的。檢查時逐條找：

- **冒號清單**：「孤注號：……。巨鯨號：……。」一行一項、格式整齊，像在讀表格。
- **先總結再列點**：「每種船差在三件事」「選船就是決定這回合怎麼賺：求穩、賭一把、多載一點，或躲過海關」。
- **工整的對比句**：「同樣擲 4，A……，B……」「X 的優點是……，缺點是……」。
- **空泛收尾**：「各有用途」「高風險換高報酬」「沒有最好的船」，沒有帶來新資訊。
- **內部用語**：「基準」「縮放後」「整塊價值」「最終值」（還沒教之前）。
- **括號補充太多**：一句話裡塞兩三個括號，讀的人要一直跳出去再回來。
- **分號串長句**：用「；」把三件事接成一句。
- **書面詞**：「各有」「另外」「照樣」「依序」「之後會一一介紹」。

## 4. 長度上限

| 種類 | 上限 |
| --- | --- |
| 教學一步 | 最多 2 段，合計約 50 字；一步只講一件事 |
| 介面說明（卡片、圖示提示） | 1～2 句，約 30 字 |
| 按鈕、提示條 | 約 15 字 |
| 規則書一條 | 不限長度，但第一句要能單獨成立，例外換行寫 |

超過上限時，先問「這一步玩家真的需要知道這個嗎」，答案多半是「之後再說」。

## 5. 寫完的檢查

1. **唸出來。** 不像在跟人講話，就改。
2. **刪掉一句還看得懂嗎？** 看得懂就刪。
3. **每個名詞，玩家此刻都學過了嗎？** 沒學過就換說法，或移到學過之後。
4. **這一步玩家眼前看得到我講的東西嗎？** 講按不了的卡、看不到的島，都會讓人困惑。
5. **數字從規則帶入**（`R.`、`rules.`），不寫死。
6. **不補完規則。** 改寫只改說法，不新增、不推定規則（`CLAUDE.md`「規則來源」）。

## 6. 本遊戲的前後對照

### 教學「五種船」（`basics.ts`，第 3 回合）

改前：

> 選船就是決定這回合怎麼賺：求穩、賭一把、多載一點，或躲過海關。前兩回合你開的信天翁號掉貨少、最穩。另外四艘：
>
> 孤注號：擲得好，貨物 ×1.5～×2.5；擲不好整船沉。用過要休息 1 回合。
>
> 巨鯨號：不會沉、多裝 2 箱，但下一回合才到港，路上至少掉 1 箱。
>
> 幽靈號：被海關指名也扣不走它的貨。
>
> 海嘯號：最終值越高賺越多，加成疊得夠可到 ×2.5；但比信天翁號容易掉貨。
>
> 點船卡可以看它的掉貨表。

問題：一次講五艘船；巨鯨號這回合是最後一回合、根本選不了；幽靈號要懂海關、海嘯號要懂加成，基礎課都還沒教；「最穩」不正確（巨鯨號不會沉）；冒號清單、先總結再列點。

改後（標題「換艘船試試」）：

> 孤注號比信天翁號刺激：最終值 5 賣 ×1.5、6 賣 ×2.5，4 以下整艘沉。
>
> 其他船點船卡就看得到。

### 教學「選一艘船」（`basics.ts`，第 1 回合）

改前：

> 每回合最多派一艘船：先選船型，再從倉庫選貨裝上去，每單位貨是一箱。五種船各有船費、載量與掉貨表，之後會一一介紹；先用最基本的信天翁號。
>
> 信天翁號沒有船費（你的島另收 25 G 港口稅）。最終值 1 會沉；2～3 掉 2 箱、4～5 掉 1 箱、6 全部到港。掉的是船上最貴的貨。
>
> 所有人同時、秘密決定：別人只看得到誰出航、開什麼船，看不到船上裝了什麼。

問題：第一段在預告之後的內容；「最終值」還沒教（下一步「航行骰」才教）；括號、分號、冒號各出現好幾次。

改後：

> 每回合派一艘船：先挑船，再裝貨。
>
> 信天翁號擲 6 全部送到，擲 1 會沉，中間掉 1～2 箱。
>
> 大家同時決定，別人看不到你裝了什麼。

第一版改寫比這長一倍，讀起來順了，但還是太長。教學裡能省的就省：前面講過的（港口稅）不重講，畫面上看得到的（船費）不講，細節（先掉最貴的）留給規則書。

## 7. 要檢查的地方

依玩家接觸的先後排序：

| 順序 | 檔案 | 長句數（約） | 種類 |
| --- | --- | --- | --- |
| 1 | `src/v07/tutorial/basics.ts` | 29 | 教學 |
| 2 | `src/v07/tutorial/growth.ts`、`tideLesson.ts`、`roleScenarios.ts`、`islandsLesson.ts` | 44 | 教學 |
| 3 | `src/ui-v07/labels.ts`、`table3d/ShipPicker.tsx`、`table/investChoice.ts`、`useInvestStep.tsx` | 16 | 介面說明 |
| 4 | `src/ui-v07/table3d/RulesPanel.tsx`、`table/roleText.ts`、`shipText.ts`、`goodText.ts`、`v08Text.ts` | 17 | 規則書 |
| 5 | 選單與其他：`menu/WelcomePrompt.tsx`、`tutorial/TutorialMenu.tsx`、`online/*`、`analytics/PrivacyNote.tsx`、`table/InvestForm.tsx`、`DeployForm.tsx` | 10 | 介面短句 |
| 6 | `src/ui-v07/devlog/entries.ts`（開發日誌） | — | 公告 |

「長句」指 25 個漢字以上的字串；JSX 裡的文字另外統計。

## 8. 自動檢查與審查時機

兩層，各在不同時間點：

| 層 | 檢查什麼 | 什麼時候 | 怎麼做 |
| --- | --- | --- | --- |
| 機械檢查 | 教學每步長度（測試上限 80 字、3 段，目標仍是 §4 的約 50 字）、待辦長度、冒號清單、分號串句、提示與標籤長度、禁用詞（舊版規則用語、內部用語、換掉的術語） | 每次跑 `npm test`（含 commit 前） | [`tests/ui-v07/copyLint.test.ts`](../../tests/ui-v07/copyLint.test.ts)；用目前規則（`RULES_CURRENT`）產生的文字檢查，開發日誌只看最新一版 |
| 語氣審查 | 有沒有 AI 腔、唸起來順不順、玩家此刻看不看得懂 | 規則變更之後（`CLAUDE.md`「規則變更流程」最後一步），以及新增開發日誌版本或 `npm run deploy` 之前 | 只看上次發版後改過的文案（`git diff`）；用 anti-ai-writing 等 skill 或人工對照本指南 §3、§5 |

改掉一個舊說法時，把它加進測試的 `BANNED`，之後就不會再回來。數字是否從規則帶入，由各文案檔自己的測試檢查（例如 `roleText.test.ts` 換掉規則數值後看文字有沒有跟著變）。

## 來源

- [Game UX: Best practices for game tutorial design](https://inworld.ai/blog/game-ux-best-practices-for-video-game-tutorial-design)（Inworld）
- [Tutorial UX design tips](https://www.wayline.io/blog/tutorial-ux-design-tips)、[UX writing for indie games](https://www.wayline.io/blog/ux-writing-indie-games)（Wayline）
- [6 Tips for Designing a Game Tutorial](https://www.gamedeveloper.com/game-platforms/6-tips-for-designing-a-game-tutorial)、[The 4 Required Parts of any Game Tutorial](https://www.gamedeveloper.com/game-platforms/the-4-required-parts-of-any-game-tutorial)（Game Developer）
- [How to Write Great Tooltip Copy](https://produktly.com/guides/how-to-write-great-tooltip-copy)（Produktly）
- [Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help)（Apple Human Interface Guidelines）
- [16 Rules of Effective UX Writing](https://builtin.com/articles/effective-ux-writing)（Built In）
- [Writing Effective Rules](https://crabfragmentlabs.com/s/Writing-Effective-Rules.pdf)（James Ernest）
- [How to Write a Rulebook for Your Board Game](https://entrogames.substack.com/p/how-to-write-a-rulebook-for-your-board-game)、[Stop Doing These 12 Things in Your Rulebook](https://entrogames.substack.com/p/stop-doing-these-12-things-in-your)（Entro Games）
- [How to Write a Rulebook That Doesn't Make Players Cry](https://herotime1.com/academy/design/how-to-write-a-rulebook-that-doesnt-make-players-cry/)（Hero Time）
