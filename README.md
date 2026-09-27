# 黑市商會（Black Market Guild）

《黑市商會》是一款供 3～4 人遊玩（2 人模式規劃中）的商業、航運與心理博弈策略遊戲。玩家在每回合面對公開的市場條件，決定獨資或合資出航，並以秘密角色部署影響商船的命運與彼此的收益。

目前專案以 [V0.6 遊戲設計文件](docs/game-design.md) 為唯一的 gameplay 規則基準。

## 專案狀態

已建立 TypeScript + Vite 專案骨架，尚未實作遊戲規則。

## 開發

需求：Node.js 20.19 以上。

```bash
npm install
npm run dev        # 啟動開發伺服器
npm test           # 執行測試
npm run typecheck  # 型別檢查（含規則引擎的純度檢查）
npm run build      # 型別檢查並建置
```

預計 MVP 會先驗證：

- 1 名真人玩家與 2–3 名 Bot 的 6 回合對局；
- 獨資與合資的風險／報酬取捨；
- 市場事件是否改變投資與角色部署選擇；
- 角色、資產與雙階段事件系統的結算可靠性。

## 文件

- [`docs/game-design.md`](docs/game-design.md)：V0.6 當前完整規則，唯一 gameplay source of truth。
- [`docs/open-questions.md`](docs/open-questions.md)：待驗證／待確認清單；不是可供實作的規則來源。
- [`docs/changelog.md`](docs/changelog.md)：V0.1～V0.6 的設計沿革與已否決／暫緩項目。
- [`docs/architecture.md`](docs/architecture.md)：程式分層、座位與 Controller 設計、多種對局模式的驅動方式。
- [`AGENTS.md`](AGENTS.md)：供 AI Agent／Codex 遵循的開發規則。

## 開發原則

實作時應先建立可獨立測試與模擬的純規則引擎，再加入任何介面或呈現層。這能讓遊戲設計透過 Bot 模擬驗證平衡性，而不受 UI 實作影響。
