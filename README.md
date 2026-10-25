# 暗潮商戰（Contrabay）

《暗潮商戰》（Contrabay，舊名《黑市商會》／Black Market Guild）是一款供 3～4 人遊玩（2 人模式規劃中）的商業、航運與心理博弈策略遊戲。玩家在每回合面對公開的市場條件，決定獨資或合資出航，並以秘密角色部署影響商船的命運與彼此的收益。

目前專案以 [V0.7 遊戲設計文件](docs/game-design.md) 為唯一的 gameplay 規則基準。V0.7 的規則引擎（`src/v07`）、3D 桌面介面（`src/ui-v07`）與線上房間（Cloudflare Worker）都已可遊玩；V0.6 的 `src/game`／`src/ui` 保留作對照（[封存的 V0.6 規則](docs/archive/game-design-v0.6.md)），不再部署。

## 線上遊玩

- 正式網址：<https://black-market-guild.zx2241384.workers.dev>（Cloudflare Worker，含線上房間）。
- 開房需要房主密碼，朋友用房間連結加入；單人對 Bot 不需要密碼。

## 專案狀態

- 規則引擎、Bot（含策略個性）、批量模擬與平衡報表已完成；進度與里程碑記錄在 [`docs/implementation-plan.md`](docs/implementation-plan.md)。
- 介面是 React + three.js 的 3D 桌面（島嶼、航程結算演出、角色揭露），搭配全套音樂與音效；音檔來源與授權記錄在 [`public/audio/SOURCES.md`](public/audio/SOURCES.md)。
- 可與 Bot 單人遊玩，也可在線上建立房間與朋友連線（斷線可重連）。
- 目前處於 V0.7 功能凍結：只修 bug、調整演出與美術，不再增減玩法。

## 開發

需求：Node.js 20.19 以上。

```bash
npm install
npm run dev        # 啟動開發伺服器
npm test           # 執行測試
npm run test:coverage  # 執行測試並檢查覆蓋率（門檻 80%）
npm run typecheck  # 型別檢查（含規則引擎的純度檢查）
npm run build      # 型別檢查並建置
npm run match:log -- 42 4  # 以 seed 42、4 人隨機跑一局並印出對局紀錄
npm run simulate -- --matches 2000 --players 4  # V0.7 策略 Bot 批量模擬並印出平衡報表（Markdown）
npm run simulate -- --summary --set roles.pirate.loot=200  # 覆寫規則數值試算平衡方案
npm run server:dev     # 本機模擬線上房間（先 npm run build；port 8787）
npm run online:smoke   # 對本機房間跑一局無頭連線測試
```

開發時 `npm run dev` 後開啟 `http://localhost:5173/` 即正式介面；`/v07.html?dev=beat3d`、`?dev=skin-lab` 等是開發用預覽頁。部署（`npm run deploy`）會中斷進行中的線上對局，且需要本機的 `public/audio/licensed/`（不進版本控制）。

遊戲設計要驗證的重點：

- 1 名真人玩家與 2–3 名 Bot 的 6 回合對局；
- 獨資與合資的風險／報酬取捨；
- 市場事件是否改變投資與角色部署選擇；
- 角色、資產與雙階段事件系統的結算可靠性。

## 文件

- [`docs/game-design.md`](docs/game-design.md)：V0.7 當前完整規則，唯一 gameplay source of truth。
- [`docs/open-questions.md`](docs/open-questions.md)：待驗證／待確認清單；不是可供實作的規則來源。
- [`docs/changelog.md`](docs/changelog.md)：V0.1～V0.7 的設計沿革與已否決／暫緩項目。
- [`docs/architecture.md`](docs/architecture.md)：程式分層、座位與 Controller 設計、多種對局模式的驅動方式。
- [`docs/implementation-plan.md`](docs/implementation-plan.md)：規則引擎的實作計畫、里程碑與進度。
- 各模組說明：[`src/game`](src/game/README.md)（規則引擎）、[`src/match`](src/match/README.md)（Match Runner）、[`src/bots`](src/bots/README.md)（Bot）、[`src/ui-v07`](src/ui-v07/README.md)（V0.7 瀏覽器介面）、[`src/ui`](src/ui/README.md)（V0.6 介面與共用的 3D 場景元件）。
- [`AGENTS.md`](AGENTS.md)：供 AI Agent／Codex 遵循的開發規則。

## 開發原則

實作時應先建立可獨立測試與模擬的純規則引擎，再加入任何介面或呈現層。這能讓遊戲設計透過 Bot 模擬驗證平衡性，而不受 UI 實作影響。
