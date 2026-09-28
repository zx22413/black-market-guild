# `src/ui`｜瀏覽器 UI

React 19 + Vite 網頁前端，入口為根目錄的 `index.html` → `main.tsx`。UI 只透過 `src/game`、`src/match` 的公開 API 取得資料：桌面由**公開事件**重建，玩家的私有資訊只來自該座位的 `DecisionContext`（`PlayerView`）與私有事件，絕不讀取 `MatchState`。

## 資料流

```
SetupScreen ──SessionOptions──▶ startGameSession ──runMatch──▶ Match Runner
                                    │  Bot 座位：botController
                                    │  真人座位：decide() 回傳 Promise，排入 requests
                                    ▼
                           SessionSnapshot（不可變）──useSession──▶ GameScreen
                                                                    │ 播放游標逐筆演出 events
                                                                    │ buildBoard(events[0..cursor]) → 桌面
                                                                    └ 追上後才顯示 requests[0] 的決定面板
```

## 檔案

| 檔案 | 職責 |
| --- | --- |
| `main.tsx`、`App.tsx` | 掛載 React；在設定畫面與對局畫面間切換。 |
| `session/gameSession.ts` | 以 `runMatch` 執行對局，真人座位的決定排成 `requests` 等待 UI `submit`（只接受 `legalActions` 內的行動）。 |
| `session/board.ts` | `buildBoard`：只用公開事件重建桌面（現金、資產、招募、船、已揭露角色、結果），觀戰者也能安全使用。 |
| `session/useSession.ts` | `useSyncExternalStore` 包裝。 |
| `screens/` | `SetupScreen`（模式與座位）、`GameScreen`（事件演出、決定、換人）、`HandoffScreen`（hot-seat 遮蔽）、`ResultScreen`。 |
| `components/` | `RoundHeader`（回合與事件卡）、`PlayerBoard`、`Harbor`（招募與船隻）、`DecisionPanel`（七種決定）、`PrivateNotes`（只給本人的情報與黑錢）、`EventLog`、`Icon`。 |
| `labels.ts` | 事件、角色、資產與現金異動原因的繁體中文名稱。 |
| `rulesText.ts` | 資產、角色、事件的簡短說明；數值一律取自 `Rules`，不寫死。 |
| `eventText.ts` | `formatLog`：公開事件轉為中文紀錄，對局紀錄腳本與遊戲內日誌共用。 |
| `art.ts` | 佔位美術索引（圖示、背景畫作），每個圖示都有文字符號備援。 |
| `styles.css` | 全部樣式（CSS 變數定義配色）。 |

## 呈現規則

- **事件演出：** 公開事件逐筆播放（`eventDelay`），每回合開始前暫停，等玩家按「進入下一回合」；「略過演出」直接跳到下一個暫停點。播放追上最新事件後才顯示待決定事項。
- **hot-seat：** 每當要做決定的座位換人（公開決定也一樣），先顯示「請將裝置交給 ○○」；兩次決定之間不顯示任何座位的私有資訊。
- **角色揭露：** 引擎依情報商人 → 護衛 → 海盜 → 走私商人送出揭露事件，UI 逐組播放。

## 美術素材

佔位素材放在 `public/art/`（圖示 `icons/<key>.svg`、畫作 `paintings/<key>.jpg`），來源與授權見 [`public/art/SOURCES.md`](../../public/art/SOURCES.md)。圖示為 CC BY 3.0，**必須保留作者標示**（設定畫面底部）。

## 待辦

- 場景層：保留日後以 PixiJS 或 three.js（`@react-three/fiber`）繪製海面與船隻動畫的 `<canvas>`。
- 手機版排版：決定面板目前在長頁面下方，需改為固定底部的操作區。
- 角色揭露與航程結算的逐步動畫（骰值修正、沉船、戰利品）。
- 元件測試（目前只測 `session/` 的邏輯）。
