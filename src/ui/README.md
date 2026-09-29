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
| `table/TableHud.tsx` | 左上回合與事件、左下自己的資金（含只給本人看的黑錢）。 |
| `table/useCashFloats.ts`、`table/CashFloats.tsx` | 把新播放的現金異動變成短暫浮起的「+350 G 航運收入」。 |
| `screens/` | `SetupScreen`（模式與座位）、`HandoffScreen`（hot-seat 遮蔽）、`ResultScreen`。 |
| `components/` | `PrivateNotes`（只給本人的情報與黑錢）、`EventLog`、`Icon`。 |
| `labels.ts` | 事件、角色、資產與現金異動原因的繁體中文名稱。 |
| `rulesText.ts` | 資產、角色、事件的簡短說明；數值一律取自 `Rules`，不寫死。 |
| `eventText.ts` | `formatLog`：公開事件轉為中文紀錄，對局紀錄腳本與遊戲內日誌共用。 |
| `art.ts` | 佔位美術索引（圖示、背景畫作），每個圖示都有文字符號備援。 |
| `styles.css` | 設定畫面與共用樣式（CSS 變數定義配色）；桌面樣式在 `scene/scene.css`、`table/table.css`。 |

## 3D 桌面（`scene/`）

玩家小島排在橫向較寬的橢圓上（3 人為三角形），圍繞中央目標島「黑市港」（暫名），每座島到中央有一條玩家顏色的虛線航道。可見私有資訊的座位（你）排在最靠近鏡頭的位置；觀戰時從第一個座位看，所有商會都掛名牌。對手只顯示船塢、資產建築與上方名牌（資金、資產圖示、招募與應徵狀態、本階段是否已決定）。

船在出航後停在自家碼頭；航海事件揭曉後開往航道中段的危險海域，揭露的海盜與護衛會出現在船邊。引擎公布修正值（`voyage-modifiers`）時，船名牌逐項跳出「護衛 +1、海盜 −1、事件 −2」，接著沉船（濺起水花、留下殘骸）或開往黑市港；每筆現金異動以浮字飄在該商會名牌上（自己的在左下資金圈）。航海事件以天氣改變海面與天空。

| 檔案 | 職責 |
| --- | --- |
| `TableScene.tsx` | 場景組裝：燈光、天氣、島、航道、船、名牌定位與自動取景。 |
| `tableModel.ts` | `buildSceneTable`：把 `Board` 轉成座位順序（你在最前）、玩家顏色（跟座位走，不隨視角改變）與船的航道和狀態。 |
| `Islands.tsx`、`IslandBase.tsx` | 玩家小島（固定地基蓋資產建築）與目標島；島體為程序產生的低面數岩壁。 |
| `Ships.tsx`、`Routes.tsx` | 航道（曲線虛線）；船、護衛小艇與海盜船沿航道滑行，可當部署目標點選。 |
| `Effects.tsx` | 沉船水花（擴散泡沫環與水滴，只在畫面上發生沉沒時播放一次）。 |
| `SceneLabels.tsx`、`ScreenLabels.tsx` | 島與船上方的 DOM 名牌；把 3D 位置投影成畫面座標（drei `<Html>` 在實測中會遺失內容）。 |
| `CameraRig.tsx` | 固定俯角、依畫面大小自動取景：島嶼與名牌必須落在上方事件列與下方操作列之間的安全區。 |
| `Sea.tsx`、`weather.ts` | 起伏的低面數海面，以及各航海事件的天空、海色、霧與光線。 |
| `Model.tsx`、`layout.ts` | Kenney 模型載入與座位、航道、地基位置。 |

## 呈現規則

- **事件演出：** 公開事件逐筆播放（`eventDelay`），每回合開始前暫停，等玩家按「進入下一回合」；「略過演出」直接跳到下一個暫停點。播放追上最新事件後才顯示待決定事項。
- **hot-seat：** 每當要做決定的座位換人（公開決定也一樣），先顯示「請將裝置交給 ○○」；兩次決定之間不顯示任何座位的私有資訊，視角也回到第一個座位。
- **角色揭露：** 引擎依情報商人 → 護衛 → 海盜 → 走私商人送出揭露事件，UI 逐組播放；自己已鎖定的角色在揭露前只以虛線標記顯示給自己。

## 美術素材

佔位素材放在 `public/art/`（圖示 `icons/<key>.svg`、畫作 `paintings/<key>.jpg`）與 `public/models/pirate-kit/`（Kenney Pirate Kit，CC0），來源與授權見 [`public/art/SOURCES.md`](../../public/art/SOURCES.md)。圖示為 CC BY 3.0，**必須保留作者標示**（設定畫面底部）。

## 待辦

- 結算演出進階：金幣以 3D 物件從黑市港飛回島上、抵達時的靠港動作。
- 資產建築換成辨識度更高的造型；中央島正式命名。
- 手機直式版面。
- 元件測試（目前只測 `session/` 與 `scene/tableModel.ts` 的邏輯）。
