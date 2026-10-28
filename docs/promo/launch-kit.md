# 暗潮商戰｜推廣素材包（2026-10-29 草稿）

**狀態：** 推廣用的草稿，**不是規則來源**。文案裡提到的玩法都是 `game-design.md`（V0.7）已定案的內容；改規則時要回頭檢查這裡的說法。方向見 [`../online/public-launch-plan.md`](../online/public-launch-plan.md) 第 9 節。

網址：<https://black-market-guild.zx2241384.workers.dev/>

## 1. 對外的事實與賣點

**一句話：** 誰在護航？誰在打劫？你能平安到港嗎？各懷鬼胎，讓骰子決定命運。

**三十秒說明：** 3～4 名商會島主，6 回合比誰最有錢。島上生產木材、鐵礦、香料、軍火，你決定拿來蓋建築，還是裝船運去巴扎港的黑市賣。每艘船的航行骰都是秘密的，所有人同時、秘密地派出角色：護衛押船平安、海盜押船沉、走私商人在別人船上夾帶私貨、情報商人偷看骰子、莊家押市場漲跌。大家搶同一種貨，價格就崩。

**三個賣點：**

1. **同時秘密下注，一起揭曉。** 沒有「後手看了再決定」，揭曉那一刻全桌一起倒抽一口氣。
2. **別人的選擇決定你的收入。** 你的船沉不沉、貨賣多少，看的是其他人押了什麼、運了什麼。
3. **打開就能玩。** 瀏覽器、手機都能玩，免費、免註冊；單人對電腦一局約 10 分鐘，也能開房間找朋友，空位由電腦補上。

**可以引用的數字：** 3～4 人、6 回合、5 種角色、8 座各有特色的島、4 種貨品、4 種建築；單人一局約 10 分鐘（正式環境統計）；線上每個決定預設限時 2 分鐘，斷線或掛機由電腦託管。

**避免的說法：** 「平衡完美」「上市」「正式版」（現在是 V0.7 試玩版）；不要承諾還沒做的功能（帳號、排行榜、手機 App）。

## 2. 連結要帶來源標記

每個平台用不同的 `?src=`，`/stats` 的「從哪裡來」就分得出各平台帶來多少人（很多 App 的內建瀏覽器不會傳來源網址）：

| 平台 | 連結 |
| --- | --- |
| itch.io | `https://black-market-guild.zx2241384.workers.dev/?src=itch` |
| PTT | `…/?src=ptt` |
| 巴哈姆特 | `…/?src=bahamut` |
| Dcard | `…/?src=dcard` |
| Threads | `…/?src=threads` |
| Reddit | `…/?src=reddit` |
| Discord | `…/?src=discord` |

標記只能用英文字母、數字、`.`、`-`、`_`，最長 40 字。

## 3. itch.io 頁面

**建議的做法：** 先建一個「外部連結」頁，按鈕連到上面的 `?src=itch` 網址，不要把遊戲上傳到 itch.io。原因：線上房間、統計與 Turnstile 都綁在我們自己的網址；上傳到 itch.io 的網頁版會在別的網域執行，線上房間會壞。缺點是 itch.io 對「可以直接在網頁裡玩」的遊戲曝光比較好；之後若要上傳，需要把 `/api` 改成指向正式網址，並處理跨網域與 Turnstile 的主機名稱。

> itch.io 建立頁面時的實際欄位名稱，以你操作時看到的為準；下面是要填的內容。

- **標題：** 暗潮商戰 Contrabay
- **簡短說明（一行）：** 誰在護航？誰在打劫？秘密下注的航海商戰，瀏覽器免費玩。
- **類型：** 策略（Strategy）
- **標籤：** `strategy`、`board-game`、`multiplayer`、`bluffing`、`trading`、`pirates`、`low-poly`、`browser`、`chinese`、`singleplayer`
- **封面：** `public/og-card.jpg` 可以直接用（itch.io 的封面比例不同，若被裁切再另截一張，見第 5 節）。
- **截圖：** 第 5 節的清單。

**介紹（中文）：**

> 誰在護航？誰在打劫？你能平安到港嗎？
>
> 《暗潮商戰》是 3～4 人的航海商戰。每人經營一座島，島上生產木材、鐵礦、香料和軍火。每回合你要決定：材料留下來蓋建築，還是裝船運去巴扎港的黑市賣錢？
>
> 船的航行骰是秘密的。所有人同時、秘密地派出角色——護衛押它平安、海盜押它沉沒、走私商人在別人船上夾帶私貨、情報商人偷看骰子、莊家押市場漲跌——然後一起揭曉。大家搶同一種貨，價格就崩。6 回合後，總財富最高的商會獲勝。
>
> - 單人對電腦，一局約 10 分鐘
> - 開房間傳連結給朋友，空位由電腦補上
> - 瀏覽器、手機都能玩，免費、免註冊
> - 有新手教學，一課一課帶你玩
>
> 這是一個人開發中的試玩版（V0.7），結算畫面可以一鍵回饋，很想知道你卡在哪裡、哪裡好玩。

**介紹（英文）：**

> Who's escorting? Who's raiding? Will your ship make it to port?
>
> Contrabay is a trading-and-bluffing game for 3–4 players. Each of you runs an island that produces wood, iron, spice and arms. Every round: build with your goods, or ship them to the black market?
>
> Every ship's sailing die is secret. Everyone secretly sends out one role at the same time — a guard betting the ship arrives, a pirate betting it sinks, a smuggler hiding cargo on someone else's ship, an informant peeking at the die, a broker betting on prices — then all are revealed at once. Ship what everyone else ships and the price crashes. After 6 rounds, the richest guild wins.
>
> - Solo vs. bots, about 10 minutes a match
> - Open a room and send friends the link; bots fill empty seats
> - Plays in the browser, on phones too — free, no sign-up
> - Interface in Traditional Chinese for now (an English version is not ready yet)
>
> A one-person work in progress (V0.7). I'd love to hear where you got stuck.

> 介面目前只有中文，英文說明一定要寫清楚，避免英文玩家點進來才發現看不懂。

## 4. 各平台的發文草稿

所有平台的共同原則：**用個人口吻、請大家幫忙試玩、問具體的問題**，不要寫成廣告。發文前先讀該版版規，確認可不可以發自己的作品、要用哪個分類。

### PTT（BoardGame 版）

**標題：** 依版規選分類，例如：`[自製] 暗潮商戰：秘密下注的線上航海商戰，求試玩`

**內文：**

```
大家好，我自己做了一款線上桌遊，想請版上的大家幫忙試玩、給意見。

《暗潮商戰》是 3～4 人的航海商戰，6 回合比誰最有錢。
每人經營一座島，決定材料要蓋建築，還是裝船運去黑市賣。

最核心的機制是「同時秘密下注」：
船的航行骰是秘密的，所有人同時派出角色——
護衛押船平安、海盜押船沉、走私商人在別人船上夾帶私貨、
情報商人偷看骰子、莊家押市場漲跌——然後一起揭曉。
大家搶同一種貨，價格就崩。

‧ 單人對電腦一局約 10 分鐘
‧ 可以開房間找朋友，空位由電腦補上
‧ 瀏覽器、手機都能玩，免費、免註冊

網址：https://black-market-guild.zx2241384.workers.dev/?src=ptt

特別想知道：
1. 第一局有沒有看不懂、卡住的地方？
2. 同時揭曉那一刻，有沒有「心理戰」的感覺？
3. 打完會想再玩一局嗎？為什麼？

結算畫面有一鍵回饋，也很歡迎直接推文或站內信。謝謝！
```

### 巴哈姆特

發在「創作大廳」的遊戲創作，或相關哈啦板（先確認板規）。內文可沿用 PTT 版，開頭加一張封面圖或 GIF；巴哈讀者習慣看圖，第一張圖很重要。連結改成 `?src=bahamut`。

### Dcard（桌遊版）

```
【自製】做了一款秘密下注的線上航海商戰，求大家試玩🙏

誰在護航？誰在打劫？你能平安到港嗎？

一個人做了一個多月，終於可以給大家玩了。
3～4 人的商戰，每回合所有人同時秘密派出角色，
護衛、海盜、走私商人、情報商人、莊家，揭曉那一刻才知道誰在搞你。

單人對電腦 10 分鐘一局，也能開房間揪朋友。
瀏覽器、手機都能玩，免費免註冊👇
https://black-market-guild.zx2241384.workers.dev/?src=dcard

很想知道大家第一局卡在哪裡，留言或在遊戲結算畫面回饋都可以！
```

### Threads

短、搭配影片（第 5 節）。三個版本輪流用：

```
誰在護航？誰在打劫？
你能平安到港嗎？

一個人做的線上航海商戰，所有人同時秘密下注，揭曉那一刻才知道誰在搞你。
瀏覽器免費玩，一局 10 分鐘 ⚓
https://black-market-guild.zx2241384.workers.dev/?src=threads
```

```
做了一個月的遊戲終於能玩了。
大家運同一種貨，價格就崩；你押它沉，他押它平安到港。
想找人來試玩，留言告訴我你第一局卡在哪 🙏
（連結）
```

```
開發日誌 #1：上週 N 個人玩，最多人在第 X 回合離開。
我改了 ___，再請大家玩一次看看。
（連結）
```

### Reddit（英文）

先確認各版規：多數版要求自己作品要標註、限制發文頻率，`r/WebGames` 對標題格式有規定。

**r/WebGames：**

- 標題：`Contrabay — a secret-bidding trading game: who's escorting, who's raiding? (browser, free, Traditional Chinese UI)`
- 內文：用第 3 節英文介紹，連結 `?src=reddit`。

**r/playmygame：**

- 標題：`I made a browser game where everyone secretly bets on the same dice — looking for first-time players' feedback`
- 內文：英文介紹＋具體的三個問題（同 PTT），註明介面是中文。

**r/IndieDev：** 適合用開發過程的角度發，例如「用遊戲自己的 3D 場景做分享封面」「同時揭露的動畫」，附短影片。

### Discord

短訊息＋封面圖：

```
做了一款線上航海商戰：誰在護航？誰在打劫？所有人同時秘密下注，揭曉才知道誰在搞你。
單人 10 分鐘一局，也能開房揪朋友，瀏覽器免費玩 → https://black-market-guild.zx2241384.workers.dev/?src=discord
```

## 5. 短影片與截圖

**最重要的一支（10～15 秒）：同時揭曉 → 船的結果。** 這是遊戲最獨特的瞬間。

| 秒數 | 畫面 | 字幕 |
| --- | --- | --- |
| 0～2 | 部署角色，手牌選海盜、點對手的船 | 你押它沉…… |
| 2～4 | 封蠟章蓋下，等其他人 | 所有人同時秘密下注 |
| 4～8 | 角色揭曉，箭頭飛向各艘船 | 揭曉！ |
| 8～13 | 航程：骰值、修正、船抵達或沉沒 | 誰在護航？誰在打劫？ |
| 13～15 | 結尾放標題字樣 | 暗潮商戰・瀏覽器免費玩 |

**另外兩支（各 5～8 秒，可做成循環）：**

- **揚帆出港：** 主選單按「開始對局」時，船隊同時出港、鏡頭跟著你的船。
- **黑市崩價：** 市場卡上價格一格一格往下掉，字幕「大家都運木材，價格就崩了」。

**錄影方式：**

- Mac：`Cmd + Shift + 5` 選「錄製選取部分」。
- 直式（Threads、IG）用手機錄，或把瀏覽器視窗縮成直式；橫式（Reddit、itch.io、Discord）用電腦錄。
- 用 `/v07.html?dev=round3d`（開發模式）可以直接開一局，不用從主選單一路點進去。

**itch.io 截圖清單（橫式，至少 3 張）：**

1. 角色揭曉，箭頭指向船。
2. 部署角色：手牌與目標船。
3. 市場結算卡：價格漲跌。
4. 選島：兩張島嶼卡。
5. 結果畫面：排名與總財富。

## 6. 發文節奏與追蹤

1. **第一週：** itch.io 頁＋一個台灣社群（PTT 或巴哈）。發文後隔天看 `/stats`：從哪裡來、第一局在第幾回合離開、評分與留言。
2. **依資料修一輪：** 只修最明顯的卡點。
3. **第二週：** 第二波（Dcard、Threads、Reddit），並把「上週多少人玩、卡在哪、改了什麼」寫成開發日誌，這篇本身就是好內容。
4. **留言要回：** 早期每一個回覆你的人，都比新的曝光更值錢。

## 7. 還沒準備好的

- 截圖與短影片還沒錄（第 5 節）。
- itch.io 帳號與頁面要你建立。
- 外部問卷連結（`FeedbackBox.tsx` 的 `SURVEY_URL`）還是空的。
- 英文介面沒有；英文平台的轉換率會受影響，先觀察 `?src=reddit` 帶來的人有沒有玩完。
