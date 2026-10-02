# `src/ui`｜瀏覽器 UI

React 19 + Vite 網頁前端，入口為根目錄的 `index.html` → `main.tsx`。對局畫面是 3D 桌面（React Three Fiber）。UI 只透過 `src/game`、`src/match` 的公開 API 取得資料：桌面由**公開事件**重建，玩家的私有資訊只來自該座位的 `DecisionContext`（`PlayerView`）與私有事件，絕不讀取 `MatchState`。

## 資料流

```
SetupScreen ──SessionOptions──▶ startGameSession ──runMatch──▶ Match Runner
                                    │  Bot 座位：botController
                                    │  真人座位：decide() 回傳 Promise，排入 requests
                                    ▼
                           SessionSnapshot（不可變）──usePlayback──▶ TableScreen
                                                  │ 播放游標逐筆演出 events
                                                  │ buildBoard(events[0..cursor]) → Board
                                                  │ buildSceneTable(Board, viewer) → 3D 桌面
                                                  └ 追上後才顯示 requests[0] 的決定
```

## 檔案

| 檔案 | 職責 |
| --- | --- |
| `main.tsx`、`App.tsx` | 掛載 React；在設定畫面與 3D 桌面間切換（3D 部分延遲載入）。 |
| `session/gameSession.ts` | 以 `runMatch` 執行對局，真人座位的決定排成 `requests` 等待 UI `submit`（只接受 `legalActions` 內的行動）。 |
| `session/board.ts` | `buildBoard`：只用公開事件重建桌面（現金、資產、招募、船、已揭露角色、結果），觀戰者也能安全使用。 |
| `session/usePlayback.ts` | 事件逐筆播放、回合間暫停、略過演出、hot-seat 換人確認與可見的私有資訊。 |
| `session/useSession.ts` | `useSyncExternalStore` 包裝。 |
| `table/TableScreen.tsx` | 對局畫面：3D 桌面加上角落介面、決定列、日誌抽屜、結算與換人遮蔽（疊在場景上，不重建場景）。 |
| `table/DecisionDock.tsx` | 七種決定的操作：資產與角色牌以右下角手牌呈現，部署角色時可直接點海上的船當目標，其餘決定在底部選項列。 |
| `table/PartnerPicker.tsx`、`table/partnerChoice.ts` | 應徵與挑選夥伴階段的「選取 → 看資訊 → 確認」：點島（或底部名單）選取，島嶼出現金色外框，上方資訊卡顯示該商會的公開資金、資產與建築；建築晶片要點開才顯示能力說明（未看過的有呼吸光點提示）；「不應徵／都不選」也要先選取再按確認。黑錢不會出現。`partnerChoice` 從合法行動算出候選與可確認的行動。 |
| `scene/IslandRing.tsx` | 候選島的淡色呼吸環與已選島的金色粗框。 |
| `table/TableHud.tsx` | 左上回合與事件；左下自己的帳本：資金、資產價值與已蓋的建築、只給本人看的黑錢。 |
| `table/useCashFloats.ts`、`table/CashFloats.tsx` | 把新播放的現金異動變成短暫浮起的「+350 G 航運收入」。 |
| `screens/` | `SetupScreen`（模式與座位；手繪木框風格，樣式在 `setup.css`）、`HandoffScreen`（hot-seat 遮蔽）、`ResultScreen`。 |
| `components/` | `PrivateNotes`（只給本人的情報與黑錢）、`EventLog`、`Icon`。 |
| `labels.ts` | 事件、角色、資產與現金異動原因的繁體中文名稱。 |
| `rulesText.ts` | 資產、角色、事件的簡短說明；數值一律取自 `Rules`，不寫死。 |
| `eventText.ts` | `formatLog`：公開事件轉為中文紀錄，對局紀錄腳本與遊戲內日誌共用。 |
| `art.ts` | 佔位美術索引（圖示、背景畫作），每個圖示都有文字符號備援。 |
| `styles.css` | 設定畫面與共用樣式（CSS 變數定義配色）；桌面樣式在 `scene/scene.css`、`table/table.css`。 |

## 3D 桌面（`scene/`）

玩家小島排在橫向較寬的橢圓上（3 人為三角形），圍繞中央目標島「黑市港」（暫名），每座島到中央有一條玩家顏色的虛線航道。可見私有資訊的座位（你）排在最靠近鏡頭的位置；觀戰時從第一個座位看，所有商會都掛名牌。對手只顯示船塢、資產建築與上方名牌（資金、資產價值、資產圖示、招募與應徵狀態、本階段是否已決定）。

船在出航後停在自家碼頭；航海事件揭曉後開往航道中段的危險海域，揭露的海盜與護衛會出現在船邊。引擎公布結算摘要（`voyage-modifiers`）時，船名牌上的大骰子從起始值開始，逐項套用修正即時變化（例：5 →「海盜 −1」→ 4），最後依結果變綠（抵達）或變紅（沉沒）；被重擲的船起始標示「重擲後」，若你是鎖定該船的情報商人，骰子會先顯示只有你看得到的原始值再變成重擲值（`dieSteps.ts`）。接著沉船（濺起水花、留下殘骸）或開往黑市港；每筆現金異動以浮字飄在該商會名牌上（自己的在左下資金圈）。航海事件以天氣改變海面與天空。

| 檔案 | 職責 |
| --- | --- |
| `TableScene.tsx` | 場景組裝：燈光、天氣、島、航道、船、名牌定位與自動取景。 |
| `tableModel.ts` | `buildSceneTable`：把 `Board` 轉成座位順序（你在最前）、玩家顏色（跟座位走，不隨視角改變）與船的航道和狀態。 |
| `Islands.tsx`、`IslandBase.tsx` | 玩家小島（固定地基蓋資產建築）與目標島；島體為程序產生的低面數岩壁。 |
| `Ships.tsx`、`Routes.tsx` | 航道（曲線虛線）；船、護衛小艇與海盜船沿航道滑行，可當部署目標點選。 |
| `Effects.tsx` | 沉船場面（衝起後落回的水冠、兩圈有高度的低面數浪圈往外擴散、水花、殘骸旁冒出的氣泡、浮出後漂開再沉下的木桶與木箱，只在畫面上發生沉沒時播放一次）；殘骸本身的傾斜在 `Ships.tsx`。 |
| `Storm.tsx`、`stormMath.ts` | 暴風雨事件：往左下斜打的低面數雨絲，以及每 3～9 秒一次打在桌面遠側島嶼空隙海面上的閃電（鋸齒光束、落點閃光，整個桌面跟著閃兩下）。閃電時間跟著真實時鐘走。 |
| `Wind.tsx`、`windMath.ts` | 順風事件：Wind Waker 風格的風線，在島的台地上方往左下（與雨同向）掃過桌面；每條線從頭畫出、往前滑、再從尾巴收掉，兩端收細，帶一點 S 形擺動（不繞圈：直立的圈從桌面鏡頭看會變成 Ω 形）。 |
| `SeaFog.tsx`、`fogMath.ts` | 海霧事件：貼著海面、平躺的柔和霧帶（霧團圖片由 canvas 即時畫出，不用外部素材），順著風向往左下慢慢漂、濃淡緩緩起伏；島的懸崖、碼頭和船會從霧裡冒出來。漂出桌面的霧帶從另一側回來，邊緣先淡出所以不會突然跳出。 |
| `Night.tsx`、`nightMath.ts` | 無月之夜事件：參考 Dorfromantik 的夜晚模式做成月夜而非全黑——深藍天空、比島亮的藍灰海面、偏灰藍的月光與補光（`WeatherLook.fill`），開放海面鋪滿細長的白色浪痕（`seaLines`），浪痕與岸邊浪花都帶一點白色微光（`seaGlow`），在暗處也看得到；海面以島嶼群為中心往畫面四角壓暗（`WeatherLook.vignette`，在海面著色器裡做，只影響海）；每座島靠碼頭的台地上立一根燈柱（木柱、暖橘燈箱與小屋頂，光暈與照在草地上的微弱閃爍點光源）；航行中的船在桅杆上掛燈籠（`VoyageShip` 的 `lantern`）。暖光只當點綴。 |
| `GoldRush.tsx`、`goldMath.ts` | 黑市熱潮事件：金色的星星與光點（Kenney Particle Pack 的三張閃光貼圖，放在 `public/art/particles/`，當透明度遮罩用，任何海色上都保持金色），多數從黑市港一帶、少數從整個桌面冒出，邊旋轉閃爍邊往上飄，再淡出。 |
| `Clouds.tsx`、`cloudMath.ts` | 晴天、風平浪靜（與沿用晴天設定的順風）的浮雲：每朵是一整塊低面數雲團（單一多面體拉長壓扁、頂部隆起、底部壓平，不是多顆圓球拼成），略帶自發光保持白色、微透明，只出現在桌面遠側、畫面上大約與遠側島嶼同高的一帶（最多 4 朵），水平往畫面左側慢慢飄，漂出桌面後從另一側回來；海面上依陽光方向落下柔和的淡雲影（不用即時陰影，以免切出像礁石的深色硬邊）。雲量由 `WeatherLook.clouds` 決定。晴天與風平浪靜的海面也有零星白色浪痕（`seaLines`，不發光）。 |
| `Spray.tsx`、`sprayBursts.ts` | 低面數水珠（共用的粒子池）：`ShoreSpray` 是浪打上島岸時激起的水花，隨機落在各島岸線上，天氣越差越頻繁、噴得越高；`CrestSpray` 是浪高明顯高於晴天時（巨浪、暴風雨），開放海面浪頂碎開、順風飛散的水花。 |
| `dieSteps.ts` | 骰子動畫的每一步數值與說明；播放節奏依最長的骰子決定。 |
| `SceneLabels.tsx`、`ScreenLabels.tsx` | 島與船上方的 DOM 名牌；把 3D 位置投影成畫面座標（drei `<Html>` 在實測中會遺失內容）。 |
| `CameraRig.tsx` | 固定俯角、依畫面大小自動取景：島嶼與名牌必須落在上方事件列與下方操作列之間的安全區。 |
| `Sea.tsx`、`seaWave.ts`、`seaFoam.ts`、`islandShape.ts`、`weather.ts`、`SwellContext.tsx`、`WeatherFog.tsx` | 起伏的低面數海面，以及各航海事件的天空、海色、霧、光線與浪況（`Swell`：浪高、浪速、船隻搖晃、浪花量；海面用平滑著色，大浪時不會碎成馬賽克）。浪花由 `seaFoam.ts` 的著色器畫在每座島的實際岸線外（岸線由 `islandShape.ts` 從島嶼懸崖的幾何算出，與 `IslandBase` 共用），風平浪靜時只有細細一條，天氣越差越寬越翻騰；只有暴風雨、巨浪時開放海面才加淡淡的細紋，不改海色；浪況切換時數秒內平滑過渡；浪高公式在 `seaWave.ts`，浪況與浪的相位由 `SwellProvider` 推進，海面、船隻與浪頂水花共用同一份。霧距依鏡頭實際距離縮放，桌面放大或換畫面尺寸時不會把島吞掉。開發模式可用 `?weather=storm` 等網址參數直接預覽各事件的海面。 |
| `Model.tsx`、`layout.ts` | Kenney 模型載入與座位、航道、資產建築地基位置。 |
| `buildings/` | 四種資產建築（造船廠、航運保險、打撈公司、貿易交易所）的原創低面數模型：`designs.ts` 以零件資料描述造型，`kit.ts` 是共用零件庫（柱、窗、木桶、屋頂等），`materials.ts` 是取自 Kenney Pirate Kit 色表的漸層材質；`polyhedra.ts` 把零件轉成多邊形，`Building.tsx` 以頂點色把整棟合併成一個網格。設計圖 [`docs/art/buildings-blueprint.svg`](../../docs/art/buildings-blueprint.svg) 由同一份資料以 `npm run art:buildings` 產生（`scripts/iso-painter.ts` 逐面判斷前後順序）。風格規則見 [`docs/art/lowpoly-style.md`](../../docs/art/lowpoly-style.md)，製作流程見 `.claude/skills/lowpoly-model`。 |

## 開發工具（`dev/`，只在 `npm run dev` 啟用）

| 檔案 | 職責 |
|---|---|
| `SinkPreview.tsx` | 沉船與岸邊水花預覽頁 `/?dev=sink`：一艘船每輪沉一次，可加 `&weather=storm` 等切換海況、`&sail` 讓船不沉，可用滑鼠轉動視角。 |
| `ModelPreview.tsx` | 模型預覽頁 `/?dev=models`：參數 `assets`（逗號分隔）、`mode=solo`（單棟）、`view=dock\|back\|far\|top`、`color`（旗幟色）。 |
| `capture.ts` | `window.bmgCapture()`：以原始解析度讀取 3D 畫面，送給 `npm run capture -- <輸出檔>`（`scripts/capture-receiver.py`）存檔。 |
| `uiMock/` | UI 風格樣張 `/?dev=ui-mock`：固定的第 1 回合部署畫面，參數 `v=flat\|props\|mix`（無底板／3D 道具／淺木＋羊皮紙混合）、`font=wenkai\|iansui\|song`、`tone=now\|ftk`。字體以 Google Fonts 載入（僅樣張），紙與木紋貼圖在 `docs/ui/mockups/tex/`。說明見 [`docs/ui/style-guide.md`](../../docs/ui/style-guide.md)。 |

## 呈現規則

- **事件演出：** 公開事件逐筆播放（`eventDelay`），每回合開始前暫停，等玩家按「進入下一回合」；「略過演出」直接跳到下一個暫停點。播放追上最新事件後才顯示待決定事項。
- **hot-seat：** 每當要做決定的座位換人（公開決定也一樣），先顯示「請將裝置交給 ○○」；兩次決定之間不顯示任何座位的私有資訊；桌子維持面向上一位玩家，下一位確認後才轉向他，取景範圍固定不縮放。
- **角色揭露：** 引擎依情報商人 → 護衛 → 海盜 → 走私商人送出揭露事件，UI 逐組播放；自己已鎖定的角色在揭露前只以虛線標記顯示給自己。

## 美術素材

佔位素材放在 `public/art/`（圖示 `icons/<key>.svg`、畫作 `paintings/<key>.jpg`、自製 UI 零件 `ui/*.svg`，由 `npm run art:ui` 產生；對局 HUD 的手繪外觀在 `table/hudSkin.css`（試用中），取用方式見 `art.ts` 的 `uiArtUrl`／`uiArtVars`）與 `public/models/pirate-kit/`（Kenney Pirate Kit，CC0），來源與授權見 [`public/art/SOURCES.md`](../../public/art/SOURCES.md)。圖示為 CC BY 3.0，**必須保留作者標示**（設定畫面底部）。

## 待辦

- 結算演出進階：金幣以 3D 物件從黑市港飛回島上、抵達時的靠港動作。
- 中央島正式命名。
- 手機直式版面。
- 元件測試（目前只測 `session/`、`scene/tableModel.ts` 與 `scene/buildings/` 的邏輯）。
