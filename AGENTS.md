# 開發協作規則

## 規則依據

[`docs/game-design.md`](docs/game-design.md) 是本專案 gameplay 的唯一 source of truth。

- 不得自行發明、推定或補完未定案的遊戲規則、數值、卡牌、角色能力或結算順序。
- 當實作需求與設計文件矛盾時，以設計文件為準，並在程式碼或相關文件中標記 `TODO` 說明差異。
- 當設計文件存在矛盾、模糊處或缺漏時，停止該規則的具體化；以 `TODO` 記錄問題、影響範圍與需要確認的決策。
- 任何確認後的規則變更，都必須先更新 `docs/game-design.md`，再更新實作與測試。

## MVP 實作方向

- 技術棧：TypeScript + Vite（web），測試使用 Vitest。日後桌面／Steam 以 Electron 或 Tauri 打包，手機以 Capacitor 打包。
- 新增執行期依賴前須先確認；`src/game/`、`src/bots/` 不得依賴任何執行期套件或瀏覽器 API（由 `tsconfig.engine.json` 強制）。
- 優先將規則引擎與 UI 分離，讓對局可由自動化測試與 Bot 模擬直接執行。
- 規則引擎內所有隨機性都必須透過注入的 `Rng`（`src/game/rng.ts`），以確保對局可重現。
- 對角色、資產、事件、投資與結算流程建立可重現的測試案例。
- 不要把尚待驗證的平衡數值當成已定案規則。
