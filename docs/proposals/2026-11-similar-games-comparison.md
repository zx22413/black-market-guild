# 暗潮商戰｜類似遊戲比較表：機制與試玩方式（2026-11-16）

**狀態：** 研究筆記，**不是規則**，也不是決定。用途是替 V0.8 原型的真人試玩找參考：別的遊戲怎麼處理同樣的設計問題、設計者怎麼試玩。表中其他遊戲的數字只用來說明機制，不得拿來補 V0.8 的數值。V0.8 原型的現況見 [`2026-11-v08-one-page.md`](2026-11-v08-one-page.md)，決策見 [`2026-11-v08-decision-index.md`](2026-11-v08-decision-index.md) 第 3.2 節。

**查證方式與限制：**

- 由 AI 以網路搜尋查證（2026-11-16），每一列附來源。規則數字多數來自規則書的轉錄網站（rulespal 等），Pandemic 讀的是官方規則 PDF。
- **BoardGameGeek 本站擋自動讀取**，所以難度（weight）取自第三方轉述或舊快照，只當約略值；BGG 論壇上的玩家意見都沒查到，褒貶改引評論網站與其他論壇。
- 標「未查證」的是沒找到來源的內容，不要當成事實引用。
- 「對 V0.8 的意義」各欄是 AI 的觀察，不是使用者的決定。

## 1. 總表：V0.8 的問題對應到哪些遊戲

| V0.8 的問題 | 最接近的遊戲 | 他們的做法 | 玩家的反應 |
| --- | --- | --- | --- |
| 開局公開兩個候選暗潮，先蓋建築押注 | Kingsburg、In the Year of the Dragon、Dune: Imperium | 公開威脅的「範圍」或「全部」，只隱藏是哪一個或順序 | 威脅越公開，抱怨越從「不公平」變成「打法固定」「懲罰新手」 |
| 回合數隨機（暗潮將至 3～5、結束 6～10） | Pandemic、Ra、Dune: Imperium | 隨機時點有上下限，桌面上有看得見的倒數 | 抱怨集中在邊界情況（連抽、提前結束讓準備作廢） |
| 秘密同時派角色、依序結算 | Libertalia、Race for the Galaxy、Citadels | 固定且看得見的結算順序，平手用一條公開的軌解決 | 人多時「太混亂、難規劃」；但同時出牌不拖時間 |
| 出海有風險（掉箱、沉船、被搶） | Black Fleet、Merchants & Marauders、Manila、Port Royal | 限制一次最多輸多少；或讓玩家事前選下注位置 | 一次輸越多，評價越兩極；自己選的風險較被接受 |
| 需求有限（軍火超量查緝、價格下跌） | Puerto Rico、Merchants & Marauders、Maracaibo | 格位不收重複貨、賣出後需求換位、市場滿了不收 | 逼玩家搶時機；Puerto Rico 有「坐在弱者左手邊的人贏」的批評 |
| 船技能要讓船有明顯變化（使用者要求） | Scythe、Black Flag、FTL、Merchants & Marauders | 每個升級一個獨立的外掛零件；面板與場上同時改變 | 船身換材質被形容「變化很輕微」，外掛零件才看得出來 |
| 怎麼試玩一個只有引擎的新版本 | Stonemaier、Leder Games、Slay the Spire | 自己 → 本地桌 → 挑過的少數人 → 陌生人；規則由程式執行，介面醜沒關係 | 見第 5 節 |

## 2. 事先知道的威脅，與隨機的時點

| 遊戲 | 機制（查到的） | 怎麼讓隨機不顯得不公平 | 玩家的褒貶 | 難度／數位版 | 來源 |
| --- | --- | --- | --- | --- | --- |
| **Kingsburg** | 5 年、每年冬天翻 1 張敵人卡（25 張裡每年抽 1 張，其餘不看）。卡背印著該年可能的強度範圍。戰力＝士兵＋建築＋先手玩家擲的 1 顆「國王援軍」骰（全員共用） | 範圍公開、可付費偷看頂牌、強度逐年上升、建築是永久防禦 | 抱怨：援軍骰擲出 1 就輸掉整局；熟手局打法固定。擴充以玩家可控的指示物取代援軍骰，被評為修掉了基本版最大的抱怨 | 難度未查證；有 iOS 版，BGA 未查證 | [規則](https://rulespal.com/kingsburg/rulebook)、[論壇](https://ffg-forum-archive.entropicdreams.com/topic/881-too-much-luck-what-do-yout-think)、[評論](https://islaythedragon.com/game-reviews/once-upon-the-burg-a-review-of-kingsburg/) |
| **In the Year of the Dragon** | 12 輪、12 片事件（六種各 2 片）。前 2 輪固定和平，其餘 10 片洗勻後**全部面朝上**排成一列，同類不相鄰 | 整局威脅的時間表開局就全公開，隨機只在順序；頭兩輪是緩衝 | 稱讚：近乎完全資訊、耐玩。抱怨：對前期失誤非常嚴苛，新手第一局常被打爆。「大家蓋同一套防禦」未查證 | 約 3.08；BGA 可玩 | [規則](https://rulespal.com/in-the-year-of-the-dragon/rulebook)、[評論](https://drakesflames.blogspot.com/2008/03/board-game-review-in-year-of-dragon.html) |
| **Dune: Imperium** | 衝突牌庫 10 張，由上到下 1 張 I、5 張 II、4 張 III。每輪開始翻 1 張、獎勵公開，同一輪結算。有人 10 分或牌庫空了就結束（最多 10 輪） | 獎勵先公開再派兵；牌庫分層保證賭注逐步升高；不確定性放在對手的暗牌，不在威脅本身 | 稱讚：知道獎勵後再決定投入多少。抱怨：領先者會被最後一波出牌翻盤 | 約 3.0；Steam、主機、手機都有 | [規則](https://rulespal.com/dune-imperium/rulebook)、[設計日誌](https://news.direwolfdigital.com/dune-imperium-designer-diary-3-conflicts/) |
| **Pandemic** | 玩家牌分成 4／5／6 堆，每堆洗入 1 張 Epidemic 再疊起來；每回合抽 2 張。Epidemic 會把已出現過的城市洗回牌庫頂 | 每段牌庫恰好 1 張，間隔有上下限，可以數牌；棄牌堆隨時可查；牌庫本身是倒數 | 稱讚：壓力曲線。抱怨：兩張 Epidemic 連抽（前一堆的底接後一堆的頂）很難受 | 約 2.4；BGA 可玩（Steam、手機版 2022 年下架） | [官方規則](https://aadl.org/files/catalog_guides/Pandemic_Rules.pdf)、[評論](https://jboger.substack.com/p/pandemic) |
| **Ra** | 袋中 180 片，其中 30 片是 Ra。抽到 Ra 放上 Ra 軌並拍賣；軌放滿時該紀元立刻結束，檯面的板塊全部棄掉。共 3 個紀元（各人數的確切格數未查證） | Ra 軌是公開的倒數；玩家可以主動喊 Ra 提前收手 | 稱讚：越接近結尾越緊張。抱怨：紀元可能在你出手前結束，手上的資源白白浪費 | 約 2.3（未確認是 BGG 數字）；有 iOS 版 | [規則](https://rulespal.com/ra/rulebook)、[評論](https://rolltoreview.com/ra-board-game-review/) |

**共通的模式：**

1. 隨機放在「哪一個／什麼順序」，同時公開「範圍與上限」。
2. 隨機的時點都有結構上的上下限，加上桌面上看得見的倒數。
3. 最招怨的是「準備完成後，再擲一顆全員共用的骰」（Kingsburg 的援軍骰）。
4. 威脅完全已知時，抱怨會轉成「懲罰新手」與「打法固定」。
5. 讓玩家自己決定承擔多少風險（付費偷看、主動提前收手），隨機較容易被接受。

## 3. 秘密同時選擇，與出海的風險

| 遊戲 | 機制（查到的） | 怎麼讓結果讀得懂 | 玩家的褒貶 | 難度／時間／數位版 | 來源 |
| --- | --- | --- | --- | --- | --- |
| **Libertalia**（含 Winds of Galecrest） | 每趟航程所有人拿**相同的 6 張角色**；每天同時蓋 1 張，翻開後依 1～40 的數字排成一列。日間能力由左到右、黃昏由右到左各拿 1 個戰利品 | 排成一列加固定方向；平手一律查名聲軌 | 稱讚：同時出牌、人多也不拖。抱怨：5～6 人太混亂、難追蹤別人用過哪些牌 | 2.2；45～60 分；原版在 BGA | [規則](https://rulespal.com/libertalia-winds-of-galecrest/rulebook)、[評論](https://opinionatedgamers.com/2012/08/06/dale-yu-review-of-libertalia/) |
| **Race for the Galaxy** | 每人秘密選 1 張行動卡，同時翻開；**只有被選到的階段會發生**，依 I～V 順序，所有人都做，選的人另有加成。不指定對手 | 固定階段順序加圖示；App 放大卡片顯示完整說明 | 稱讚：學習曲線值得。抱怨：圖示門檻高、互動少 | 約 3.0；30～60 分；Steam、手機、BGA | [BGA 說明](https://en.doc.boardgamearena.com/Gamehelpraceforthegalaxy)、[評論](https://www.boardgamequest.com/race-for-the-galaxy-ios-review/) |
| **Citadels** | 輪流秘密選角色，依角色編號 1→8 唱名行動。刺客、小偷**指定的是角色，不是玩家**：被刺者整回合不行動，被偷者交出全部金幣 | 唱名順序就是結算順序；明棄的角色牌讓人可以推理 | 6～7 人等待時間長。「被刺很掃興」的具體抱怨未查證 | 2.0；官方數位版未查證 | [Wikipedia](https://en.wikipedia.org/wiki/Citadels_(card_game)) |
| **Puerto Rico** | 船長階段：3 艘共用的船，每船只載 1 種貨；能裝就必須裝到最多；每桶 1 分。結束後每人只留 1 桶，其餘腐壞。交易所 4 格、不收重複的貨（船容量與售價未查證） | 全公開、無隨機 | 批評：贏家常是坐在最弱玩家左手邊的人（造王） | 約 3.3；BGA、iPad | [規則](https://www.ultraboardgames.com/puerto-rico/game-rules.php)、[評論](https://miniaturemarket.com/reviewcorner/puertorico-review) |
| **Black Fleet** | 商船載 3 塊貨，到港每塊賣 2～3；海盜貼近對手商船**一次偷 1 塊**；海軍擊沉海盜，沉船從角落重新入場 | 損失上限小，沉船立刻重生 | 稱讚：輕、快。抱怨：自己回合外很被動、4 人偏混亂 | 1.9；數位版未查證 | [評論](https://opinionatedgamers.com/2014/09/22/dale-yu-review-of-black-fleet-space-cowboys/) |
| **Merchants & Marauders** | 一般貨賣 3、需求貨賣 6，賣出後需求隨機換位。玩家對戰輸家的船長死亡，贏家可拿金、貨、船；只有藏起來的金子保得住 | 藏金是秘密分數 | 稱讚：有東西可輸才刺激。抱怨：一次擲骰可能失去一切、時間長 | 約 3.25（評論轉述）；120～180 分 | [規則全文](https://lehi-innovation.github.io/boardgame-rules/extracted/merchants-marauders-rules.txt)、[評論](https://www.shutupandsitdown.com/review-merchants-marauders) |
| **Manila** | 競標港務長，由他選貨、擺船、擲骰；3 輪擲骰，超過 13 格才到港。玩家**先把幫手下注**在船位、港口、海盜、保險，再看骰子 | 褒貶未查證 | 未查證 | 2.0；約 60 分 | [規則](https://ultraboardgames.com/manila/game-rules.php) |
| **Port Royal** | 逐張翻牌，翻到同色的第二艘船且打不退，整排作廢；玩家自己決定何時停手 | — | 稱讚：押運氣出色。抱怨：運氣成分有時失控 | 約 1.6；約 50 分 | [規則](https://yucata.de/en/Rules/PortRoyal) |
| **Maracaibo**（低風險對照） | 沿航道前進，到城市交貨，市場滿了不收；沒找到玩家互搶或失貨的規則 | 資訊都在桌面上 | 稱讚：直覺。抱怨：佔桌、偏重、互動少 | 3.9；BGA | [評論](https://punchboard.co.uk/review-maracaibo/) |

**共通的模式：**

1. 秘密選擇的可讀性都靠**固定且看得見的結算順序**。
2. 指定「角色」而非「玩家」，或全員同一套牌，讓猜測有依據。
3. 被搶的挫折感與**一次最多輸多少**成正比。
4. 骰子風險較被接受的設計，是讓玩家**事前選下注位置**（Manila）或**自己決定何時停手**（Port Royal）。

## 4. 看得見的升級（對應「船的升級要有明顯的變化」）

使用者要求（2026-11-16）：船的升級一定要讓船本身有明顯的變化。

| 遊戲 | 升級怎麼取得 | 怎麼讓人看見 | 有沒有固定的升級順序 | 來源 |
| --- | --- | --- | --- | --- |
| **Scythe** | 付金屬部署機甲（4 台）、付油移動科技方塊（6 顆） | 機甲原本蓋住能力格，拿走就露出能力，同時地圖上多一台模型；方塊從一格移到另一格。對手能否一眼讀懂未查證 | 有：官方禁用兩組陣營與面板的搭配；社群會背前幾回合 | [規則](https://lehi-innovation.github.io/boardgame-rules/rules/scythe/) |
| **Spirit Island** | 每次成長從兩條軌道之一拿走 1 顆 | 拿走就露出底下的數值 | 社群有逐精靈的開局指南，表示開局已被整理成定式 | [說明](https://bfowle.github.io/spirit-island/fundamentals/presence-economy.html) |
| **Merchants & Marauders** | 改裝每個 3 金，**每個港只賣翻開的那一種**；換船型另買 | 換船型時模型（剪影）會變；改裝只是個人面板上的指示物。有第三方把改裝做成立體件，可見玩家想在船上看到它 | 「每港只賣一種」把購買順序綁在航線上 | [規則](https://rulespal.com/merchants-and-marauders/rulebook) |
| **Dead Reckoning** | 船員升級後付貨換升級板塊；船身 4 格，開局 2 格空，滿了要蓋掉舊的 | 板塊放在個人船板的船身格；地圖上的船模是否改變未查證 | 未查證 | [規則](https://rulespal.com/dead-reckoning/rulebook) |
| **Maracaibo** | 交付卡片時從船板移走圓片，每項升級要移走 2 顆才解鎖 | 移走圓片露出圖示，全在個人版上 | 未查證 | [BGA](https://en.boardgamearena.com/gamepanel?game=maracaibo) |
| **Xia** | 買裝備板塊，像拼圖一樣塞進船板，與貨艙搶空間 | 形狀不同的板塊佔格；模型是否改變未查證 | 未查證 | [評論](https://boardgamequest.com/xia-legends-of-the-drift-system-review) |
| **Assassin's Creed IV: Black Flag** | 功能升級與外觀分成兩套系統 | 衝角、舷砲、迴旋砲、迫擊砲會出現在船上；船身升級玩家回報「變化很輕微」 | — | [玩家討論](https://gamefaqs.gamespot.com/boards/706181-assassins-creed-iv-black-flag/70444535) |
| **FTL** | 買武器 | 武器畫在船體外的掛點上，充能時有滑出動畫（來源是模組論壇） | — | [論壇](https://mail.subsetgames.com/forum/viewtopic.php?p=40175) |
| **Sea of Thieves**（反例） | 進度只解鎖外觀，不給戰力 | 外觀完全不傳達功能 | — | [報導](https://www.pcgamer.com/sea-of-thieves-explores-its-character-customisation-suite-that-respects-your-time) |

Root、Sid Meier's Pirates!、Sunless Sea 的做法都未查證，不列入。

**可用的做法（依 AI 判斷的有效程度排序）：**

1. **每個升級對應一個獨立的外掛零件**（Black Flag、FTL）：比換材質明顯得多。
2. **一個動作同時改面板與場上**（Scythe 的機甲）：面板露出能力，場上多一個東西。
3. **面板上用實體佔格鏡射**（Dead Reckoning、Xia）：一眼看得出開了幾個、哪幾個。
4. **換材質或顏色只當輔助**，不當主要的辨識手段。
5. **外觀與功能不要脫鉤**：如果另外做純外觀的造型，會稀釋「看外觀就知道功能」。

## 5. 設計者怎麼試玩

| 來源 | 做法 | 連結 |
| --- | --- | --- |
| **Stonemaier（Jamey Stegmaier）** | 順序：自己試 → 本地桌（設計者下場，觀察開心、挫折、困惑的時刻）→ 遊戲「好玩且能運作」後才盲測。至少 3 波盲測，每波約 3 週、3 場、每場後填問卷。預計 100 張牌的遊戲先做 10～20 張就開始試。測試者的每一個規則問題都算資料。必答題：描述這一場最挫折或最困惑的事 | [流程](https://stonemaiergames.com/?p=25290)、[回饋](https://stonemaiergames.com/?p=11002) |
| **Leder Games（Cole Wehrle）** | 內部版自由改；給測試者的版本 2～3 週才更新一次。遠端測試組是挑過的少數人，不公開徵求。他不在意測試者喜不喜歡，測試者不是來評分的。早期版本整個丟棄是常態（Oath 到第 9～10 版才成形） | [日誌 15](https://ledergames.com/blogs/news/oath-designer-diary-15-vision-control)、[日誌 10](https://ledergames.com/blogs/news/oath-designer-diary-10-the-political-economies-of-oath) |
| **Slay the Spire（Mega Crit）** | 早期找同類遊戲的玩家試玩，並記錄每一個決定（選取率、放棄了什麼、出現在獲勝牌組的比例）。改一次、看資料、再調。數字不代表感受，另外收文字回饋 | [訪談](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder) |
| **Jesse Schell／Schell Games** | 每場都帶著一組要回答的問題進場。開場白照稿念：「我在測遊戲，不是測你」「我不會幫忙」。看臉多於看螢幕。事後問體驗、不問設計、不為遊戲辯護。避免問「好玩嗎」「平衡嗎」 | [投影片](https://stewart.sdsu.edu/cs583_spr2013/LearningXNA4_lects/JesseSchell_playtesting101.pdf)、[題目](https://schellgames.com/blog/the-definitive-guide-to-playtest-questions-for-video-game-playtesters) |
| **紀錄方式** | 一次只改一件事；影響玩法的改動就算新版本，要記變更紀錄。每場記一列：誰玩、人數、勝者、時長、各人策略、缺陷、規則歧義。介面抱怨與規則抱怨分開記 | [文章](https://brandonthegamedev.com/the-art-of-the-play-test-designing-tests-and-keeping-records/) |

**原型平台：**

| 平台 | 會不會替你執行規則 | 代價 |
| --- | --- | --- |
| Tabletop Simulator | 預設不會，可寫腳本 | 每人要買一份；有設計者回報腳本花了一週 |
| Tabletopia | 不會 | 瀏覽器、有免費方案 |
| playingcards.io | 不會 | 免費、最快上手，只有牌與籌碼 |
| Screentop.gg | 不會 | 免費；建置繁瑣 |
| Board Game Arena Studio | 會 | 要用 PHP 重寫伺服器邏輯與介面，等於重寫引擎 |

來源：[五種工具的比較](https://entrogames.substack.com/p/making-board-games-virtually-a-review-of-5-tools)、[BGA Studio 文件](https://be.doc.boardgamearena.com/Studio_file_reference)。

**常用的賽後問題（Schell Games）：** 最挫折的時刻、最喜歡的時刻、想做卻做不到的事、如果有魔杖你會改什麼、你剛剛在做什麼、你會怎麼向朋友描述這個遊戲。

## 6. 對 V0.8 試玩的意義（AI 的觀察，不是決定）

| V0.8 的設計 | 對照 | 試玩時要看什麼 |
| --- | --- | --- |
| 兩個候選暗潮、揭曉前先蓋建築 | 與 Kingsburg「公開範圍、隱藏是哪一個」同類；Manila 也是先下注再看結果 | 玩家有沒有真的在兩個候選之間選。Bot 幾乎都在第 1 回合蓋修船廠，這正是 Kingsburg 與 In the Year of the Dragon 被抱怨的「打法固定」 |
| 暗潮將至在第 3～5 回合、結束在第 6～10 回合 | 已有上下限（同 Pandemic 的分堆）；其他遊戲另有看得見的倒數 | 玩家知不知道這兩個範圍；結束時有沒有「準備作廢」的感覺（Ra 的抱怨） |
| 暗潮將至當回合倉庫每種貨損失一半；海盜潮到港也被搶 30% | Black Fleet 一次只輸 1 塊，評價輕鬆；Merchants & Marauders 可能全失，評價兩極 | 這兩個損失發生的當下，玩家的反應是緊張還是被罰 |
| 最後的大市集：每艘船擲兩顆骰取高 | Kingsburg 最招怨的是準備完成後由一顆骰決定 | 最後一回合結束後，玩家覺得勝負是自己決定的，還是骰子決定的 |
| 暗潮季同時有事件、暗潮、自己的技能與建築 | Libertalia、Citadels 靠固定且看得見的結算順序 | 結算時玩家說不說得出「為什麼掉了這幾箱」 |
| 船技能 | 外掛零件最看得出來（Black Flag、FTL） | 對手開了什麼技能，其他人不看面板說不說得出來 |
| 試玩的形式 | 通用平台都不執行規則，BGA Studio 等於重寫引擎 | 既有引擎加簡陋介面是最省的路 |
| 試玩的對象 | Stonemaier、Leder Games 都是自己 → 本地桌 → 挑過的少數人 | 巴哈回饋者排在熟人桌之後，挑會寫原因的人 |

## 7. 還沒查到的

- BGG 的難度數字與論壇意見（本站擋自動讀取），需要人工開網頁確認。
- Root、Sid Meier's Pirates!、Sunless Sea 的升級呈現。
- 上手程度的量化指標（第一個決定花多久等）、改規則前要玩幾場：沒找到權威來源，目前只是 AI 的建議。
- 規則重的遊戲在沒有自動化的平台上試玩的記帳負擔：沒找到設計者的親述。
- 呈現層（各遊戲線上版的介面做法）這次沒查，先前討論的 6 種做法是 AI 憑記憶列的。
