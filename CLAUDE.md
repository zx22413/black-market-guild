# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案現況

《黑市商會》（Black Market Guild）是 3～4 人（2 人模式規劃中）的商業、航運與心理博弈策略遊戲。技術棧為 **TypeScript + Vite（web）**，測試用 **Vitest**；目前只有專案骨架與 seeded RNG，尚未實作任何遊戲規則。日後桌面／Steam 以 Electron 或 Tauri 打包、手機以 Capacitor 打包（尚未設定）。

## 指令

```bash
npm run dev                              # Vite 開發伺服器
npm test                                 # 執行全部測試（vitest run）
npx vitest run tests/game/rng.test.ts    # 執行單一測試檔
npx vitest run -t "same seed"            # 依測試名稱篩選
npm run typecheck                        # 兩套 tsconfig 的型別檢查
npm run build                            # typecheck + vite build
```

- 需要 Node.js 20.19 以上。TypeScript 為 7.x（原生編譯器）。
- 尚未設定 lint／formatter。
- 新增任何執行期依賴前先向使用者確認。

## 規則來源（最重要）

[`docs/game-design.md`](docs/game-design.md)（V0.6「市場風向」）是 gameplay 的**唯一 source of truth**，詳細協作規則見 [`AGENTS.md`](AGENTS.md)。重點：

- 不得自行發明、推定或補完未定案的規則、數值、卡牌、角色能力或結算順序。[`docs/open-questions.md`](docs/open-questions.md) 是待確認清單，不是規則來源；其中的提案與範例數字絕對不可自行採用。
- 實作遇到未定案規則時：停止具體化該規則，在程式碼中以 `TODO` 記錄問題、影響範圍與待確認決策；必要時設計成可注入的參數／設定，而不是寫死猜測值。
- 規則變更流程：先更新 `docs/game-design.md` → 再改實作 → 再改測試。
- 目前已定案、可直接依據的內容與數值，以 `docs/game-design.md` 的 V0.6 快照為準；不要以本段摘要、舊 commit 或沿革文件補完規則。
- 設計文件第 10 節列出的擴充方向（秘密交易、市場操縱、不同比例合資等）**不屬於 V0.6 / MVP 範圍**，不要實作。

## 架構

完整設計（座位／Controller、Match Runner、`PlayerView` 過濾、連線模式與待確認事項）見 [`docs/architecture.md`](docs/architecture.md)；實作 `src/match` 或引擎的公開介面前先讀它。規則引擎與呈現層分離，讓整局對局可由測試與 Bot 直接驅動：

- `src/game/`：純規則引擎，公開介面集中在 `src/game/index.ts`。所有隨機性（航行骰、事件抽取）必須透過注入的 `Rng`（`src/game/rng.ts`，mulberry32）以確保可重現，不得直接呼叫 `Math.random()`。
- `src/bots/`：Bot 策略，用於 MVP（1 名真人 + 2–3 名 Bot）與大量模擬以驗證平衡（見設計文件第 10 節的四個驗證問題）。
- `src/match/`（尚未建立）：Match Runner 與 Controller 介面，座位上是真人、Bot 或遠端玩家由此層決定，引擎只認識 `PlayerId`。
- `src/ui/`：呈現層（`index.html` → `src/ui/main.ts`），只透過 `src/game/index.ts` 使用規則引擎。
- `tests/`：鏡像 `src/` 的結構（如 `tests/game/*.test.ts`），測試需以固定 seed 保持可重現。

**純度限制**：`tsconfig.engine.json` 只以 `lib: ES2022`、`types: []` 編譯 `src/game` 與 `src/bots`，因此這兩層使用 DOM 或 Node API 會在 `npm run typecheck` 時失敗；`tsconfig.json` 則涵蓋全部程式碼（含 DOM）。兩者共用 `tsconfig.base.json`（strict、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`verbatimModuleSyntax`）。

尚待驗證的平衡數值不要當成定案規則寫死。

## 素材與授權

`references/visual/` 目前刻意不含圖片。未確認來源與授權的外部圖片不得加入版本控制；若新增素材，需依 [`references/visual/README.md`](references/visual/README.md) 記錄來源、權利資訊、授權、取得日期與用途，AI 生成 placeholder 也要註明生成方式與限制。
