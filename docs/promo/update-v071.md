# 暗潮商戰｜V0.7.1 改版公告貼文（2026-11-08 草稿）

**狀態：** 推廣用的草稿，**不是規則來源**。玩法描述以 [`../game-design.md`](../game-design.md)（V0.7.1）為準；V0.7 與 V0.7.1 的差異整理在 [`../changelog.md`](../changelog.md)，遊戲內的版本公告是大廳的「開發日誌」（`src/ui-v07/devlog/entries.ts`）。尚未發過文的平台請用 [`launch-kit.md`](launch-kit.md) 與 [`fb-posts.md`](fb-posts.md) 的介紹貼文。

## 發文前（務必先做）

- **線上版還是舊的。** 2026-11-08 的線上版仍是 V0.7（建築規則）；V0.7.1 的規則書還沒改成船艙版，所以暫不部署（見 `CLAUDE.md`）。**公告要等部署後才發**，否則連結點進去看到的和文案對不上。部署前先看 `/stats` 最上面的「目前線上對局」，不要中斷進行中的對局。
- 規則書還是建築版時發公告，會有人在規則書查到「建築」。先改完規則書再部署再發文。
- 連結沿用各平台原本的 `?src=`（巴哈獨立板 `bahamut-indie`、巴哈桌遊板 `bahamut-bg`、itch `itch`、YouTube `yt`、限動 `ig`），公告要另外看成效就加後綴，例如 `bahamut-indie-v071`。
- 舊玩家最在意的是：**建築沒了、情報商人與莊家沒了、島的玩法變了**。公告第一段就要講，不要讓人點進去才發現。
- 數值（船費、曲線）都標註「之後依試玩再調」，不要寫成定案平衡。
- 巴哈桌遊板第 12 條：同一內容不得重複發文，所以桌遊板與獨立板的公告要寫成不同版本；第 18 條同串每天只能自推一次。

## 素材（`promo-out/v071/`，不進版本控制，可重做）

| 檔案 | 用在哪裡 |
| --- | --- |
| `cover-v071-1920x1080.jpg` | 公告封面：五艘船並排。巴哈列表縮圖取第一張靜態圖，放這張；YouTube 社群貼文、itch 開發日誌、FB／Threads 配圖 |
| `ship-standard.jpg`、`ship-gambler.jpg`、`ship-freighter.jpg`、`ship-hidden.jpg`、`ship-breaker.jpg` | 五艘船的近照（信天翁、孤注、巨鯨、幽靈、海嘯），拆開講一艘一則或當留言補圖 |
| `devlog-popup.jpg` | 大廳的「開發日誌」彈窗，說明「遊戲裡也看得到完整更新內容」 |
| `menu-table.jpg` | 新版大廳與桌面（八座新島基與巴扎港小鎮），限動、橫幅 |

重做：先 `npm run dev`，再執行

```bash
node --experimental-websocket --import tsx scripts/promo/v071-shots.ts --out promo-out/v071 --base http://localhost:5173
```

**還沒有的：** 宣傳片 `trailer-v6.mp4` 是 V0.7（建築與舊角色）拍的，**V0.7.1 的影片尚未重拍**。公告先用圖片；影片要重拍需要新的 `TRAILER` 劇本（`src/v07/tutorial/trailer.ts` 與 `scripts/trailer/plan.ts` 還是舊角色），見下方「待辦」。

## 一、巴哈姆特・獨立遊戲板（公告）

沿用原文章（snA=584）的做法：在原串回文更新，或另開新文章都可以，標題框用「情報」。**建議在原文下回覆一則，讓追蹤的人收到通知**；另開新文章的話，標題寫版本號。

**標題：** `【自製遊戲】《暗潮商戰》V0.7.1 改版：建築退場，五艘船登場`

```
上次發文之後收到不少試玩回饋，最常聽到的兩句是「建築蓋了就一直有用」「船沉不沉全看運氣」。
所以這一版把規則大改了一輪，先講最大的變化：

【建築沒了，換成五艘船】
每回合投資時，先選一艘船、再裝貨。船費付出去，沉了不退。
・信天翁號：基準款，船費 0
・孤注號：船費 150 G，骰到 5、6 才賺，6 賺 250%；用過要休息一回合
・巨鯨號：不會沉、多載 2 單位，但要隔一回合才靠岸
・幽靈號：海關指名它的貨無效
・海嘯號：骰值不封頂，加成越疊越賺，最高 300%
風險不再是天上掉下來的，是你自己挑的。

【航海事件提早公開、角色重做】
・每回合一開始就公開航海事件（順風？暴風雨？），你在投資、派角色前就知道天氣
・重擲階段拿掉，每回合只剩兩個決定：投資、部署角色
・情報商人、莊家退場，換成「海關」（指名對手船上的一種貨優先沒收）與「外交官」（猜誰會針對你的船，猜中就讓對方白派）
・護衛只守自己的船；走私商人可以派在自己的船上掩護貨物

【島與畫面】
・燈塔島、林場島（改名船塢島）等八座島的特色全部重調
・八座島的島基與地標用 Blender 重做，巴扎港黑市變成一座有大階梯的小鎮
・五艘船各有自己的模型與帆
・新手教學已依新規則重寫、固定 4 人（空位電腦補上）、線上房間新增觀戰席
・大廳新增「開發日誌」，每個版本改了什麼都記在那裡

數值（船費、收益曲線）都還是第一輪，等更多人玩過再調。
想請大家玩一兩局告訴我：選船會不會有「這回合該賭一把」的掙扎？海關和外交官猜得起來嗎？

試玩：https://contrabay.lbdog.uk/?src=bahamut-indie
```

圖：第一張放 `cover-v071-1920x1080.jpg`，之後依序放 `ship-gambler.jpg`、`ship-freighter.jpg`、`devlog-popup.jpg`（單張上限 600KB，需先壓縮）。

## 二、巴哈姆特・桌遊板（機制討論版）

不能和獨立板重複（第 12 條），這篇改用機制討論的口吻，不放遊戲名，只留連結。

**標題：** `[討論] 把「選船」當成風險選擇：同樣一箱貨，你敢不敢上孤注號？`

```
最近在改自己做的線上桌遊，想聽聽桌遊玩家對一個機制的看法。

原本的設計：每回合運貨到黑市，船沉不沉看一顆秘密骰子，建築則是長期的強化。試玩下來的問題是，建築蓋完就「一直有用」，沒有每回合的取捨；骰子結果又完全看運氣，玩家覺得沒得選。

現在的做法：拿掉建築，每回合先選船型，風險由玩家自己決定。
・基準船：骰越大賺越多，骰 1 才沉
・賭徒船：船費貴，骰 5、6 才賺，但 6 賺 250%，用過要休息一回合
・貨船：不會沉、多載，但隔一回合才靠岸
・密艙船：對手的海關指名它的貨無效
・破浪船：骰值不封頂，被護衛加成後最高賺 300%
再加上「航海事件在回合開始就公開」，你知道今天是順風還是暴風雨，才決定要賭還是穩。

我想請教：
1. 這種「每回合一次選風險曲線」的設計，你覺得會不會變成固定選某一艘最划算？
2. 事件先公開、角色再秘密部署，這個順序有沒有讓心理戰變淡？
3. 「用過要冷卻」是不是比「買斷」更能避免一路用到底？

遊戲本體在這裡，4 人、6 回合、瀏覽器免費玩，有教學：
https://contrabay.lbdog.uk/?src=bahamut-bg
```

## 三、YouTube（社群貼文 / 置頂留言）

宣傳片是 V0.7，**說明欄與置頂留言要補一句版本**，避免有人看完影片發現遊戲不一樣。

置頂留言：

```
【改版公告】影片拍的是 V0.7。V0.7.1 已經把建築換成五艘各有脾氣的船（信天翁、孤注、巨鯨、幽靈、海嘯），航海事件改成回合一開始就公開，情報商人與莊家換成海關與外交官。完整更新內容在遊戲大廳的「開發日誌」。
試玩：https://contrabay.lbdog.uk/?src=yt
```

社群貼文（配 `cover-v071-1920x1080.jpg`）：

```
《暗潮商戰》V0.7.1 改版
建築退場，五艘船登場：每回合先選船，風險自己挑。
孤注號賭一把賺 250%，巨鯨號穩穩隔回合靠岸，幽靈號讓海關撲空。
瀏覽器免費玩，有新手教學 → https://contrabay.lbdog.uk/?src=yt
```

## 四、IG／FB 限動

兩邊用同一個連結（`?src=ig`）。配 `cover-v071-1920x1080.jpg`（橫圖在限動上下留白，若要滿版可改用 `menu-table.jpg` 裁成直式）。

```
V0.7.1 改版上線 ⚓
建築沒了，換五艘船！
你的船你來選：賭一把還是穩穩賺？
```

連結貼紙：`https://contrabay.lbdog.uk/?src=ig`。

## 五、itch.io 開發日誌（Devlog）

itch.io 專案頁左邊有「Devlog」，發一篇，追蹤者會收到通知。標題：`V0.7.1：建築退場，五艘船登場`。內文可直接用第一節的內容，英文版如下，中文在前、英文在後（頁面介紹也是這個順序）。

```
V0.7.1 is out: buildings are gone, five ships are in.

Feedback from the first players: "buildings are just a permanent buff" and "whether my ship sinks is pure luck". So:

SHIPS INSTEAD OF BUILDINGS
Each round you pick a ship, then load it. The fee is paid up front and not refunded if she sinks.
- Albatross: the baseline, free.
- Gambler (150 G): only pays on a 5 or 6, up to 250%; needs a round off after use.
- Whale: can't sink, carries 2 more, arrives a round late.
- Ghost: customs can't touch her cargo.
- Breaker: dice are uncapped, up to 300%.

EVENTS FIRST, ROLES REWORKED
The voyage event is revealed at the start of the round, so you know the weather before you invest and deploy. The reroll step is gone: two decisions a round. The informant and broker are replaced by Customs (names a good to seize) and the Diplomat (guesses who will target their ship).

ALSO
Eight rebuilt island bases, a new bazaar-town market, five new ship models, a rewritten tutorial, fixed at 4 players (bots fill empty seats), a spectator stand in online rooms, and a Dev Log in the main menu.

Numbers (fees, payout curves) are a first pass and will move as more people play. The interface is Traditional Chinese for now.

Play: https://contrabay.lbdog.uk/?src=itch
```

## 待辦

- 部署 V0.7.1 前：規則書改成船艙版（建築章節換成五艘船）。
- 重拍宣傳片（直式與橫式）：`TRAILER` 劇本與分鏡改成新角色與選船畫面，片中的「情報商人」「莊家」「建築」要全換掉。
- 角色卡插圖目前海關、外交官仍暫用舊情報商人、莊家的圖；截圖時避開角色卡特寫，或先換圖。
- 發完看 `/stats` 的「從哪裡來」，以及玩家第一局在選船那一步有沒有離開。
