---
name: lowpoly-model
description: Design and build hand-made low-poly 3D models for the Black Market Guild table (asset buildings, harbor props, island decorations) with the part-data system in src/ui/scene/buildings — references, design direction, SVG blueprint, modeling, in-game verification and tests. Use this whenever the user asks to make, redesign, restyle, enlarge or add detail to a building, prop or other 3D object on the table (e.g. 「做一棟燈塔」「造船廠改好看一點」「島上加個市集攤位」「建築看不清楚」), or asks about materials, colors or the modeling style of the scene — even if they do not mention this skill or the part system.
---

# 低面數模型製作

這個 repo 的自製模型不是外部 3D 檔，而是 TypeScript 裡的**零件資料**：凸多面體零件 → `polyhedra.ts` 轉成多邊形 → `Building.tsx` 以頂點色合併成一個網格；同一份資料也用來產生 SVG 設計圖。所以做模型就是寫資料、看設計圖、在遊戲裡驗證。

開始前先讀 [`docs/art/lowpoly-style.md`](../../../docs/art/lowpoly-style.md)：材質、幾何、比例的規則都在那裡，本 skill 只講流程。

## 相關檔案

| 檔案 | 作用 |
|---|---|
| `src/ui/scene/buildings/materials.ts` | `SWATCHES`：Kenney 色表取樣的漸層材質 |
| `src/ui/scene/buildings/kit.ts` | 零件庫：`post`、`perimeterBeams`、`framedWindow`、`barrel`、`gabledRoof`、`SQUARE` |
| `src/ui/scene/buildings/polyhedra.ts` | 零件種類（box／gable／roof／loft／prism／beam）與幾何 |
| `src/ui/scene/buildings/designs.ts` | 各建築的零件清單、`ROOF_MATS`、旗桿位置 |
| `src/ui/scene/buildings/Building.tsx` | 3D 元件 |
| `src/ui/scene/layout.ts` | `ASSET_LOTS`、`ASSET_BUILDING_SCALE`、島的半徑 |
| `scripts/draw-buildings.ts`、`scripts/iso-painter.ts` | 設計圖產生器（`npm run art:buildings`） |
| `src/ui/dev/ModelPreview.tsx`、`src/ui/dev/capture.ts` | 開發用預覽頁與高解析度擷取 |
| `tests/ui/buildings.test.ts` | 幾何、擺放、比例的測試 |

## 規則來源先確認

模型只是呈現，但**要做什麼東西**受 `docs/game-design.md` 約束（見 `AGENTS.md`）：資產、角色、事件都以設計文件為準，不要因為想做模型就發明新的資產或遊戲元素。純裝飾（攤位、木箱、燈塔造景）可以做；會讓玩家誤以為有規則意義的東西（新資產建築、新圖示）先問使用者。

## 流程

依序做，每一步都讓使用者看得到成果，方向錯了能早點修正。

### 1. 參考與設計方向

- 找參考：Kenney 系列（`kenney.nl` 的 Pirate Kit、Fantasy Town Kit、Castle Kit，CC0），加上真實的歷史建築（17 世紀港口、Wikimedia Commons）。參考圖存到 scratchpad 給使用者看，**不要把外部圖片加進 repo**（見 `references/visual/README.md`）。
- 提出設計方向：這個模型的**主剪影特徵**是什麼（高塔、階梯山牆、吊架……要跟既有建築不同）、用哪個屋頂材質、大約多高多寬。遇到使用者明確說「直接做」才跳過確認。

### 2. 寫零件資料

- 在 `designs.ts` 加新的設計，優先用 `kit.ts` 的零件；如果發現某個部件會在兩棟以上重複出現，就把它抽進 `kit.ts`。
- 需要新顏色時，依風格指南從色表取樣，加進 `SWATCHES`，不要在零件上直接寫色碼。
- 座標慣例：設計座標約 2.2 單位寬，+z 朝碼頭，y=0 是地面，要設定 `flag`。
- 目前 `BUILDING_DESIGNS` 以 `AssetId` 為鍵。如果要做不是資產的模型（裝飾、造景），另外建一個以自己名稱為鍵的設計表，並讓 `Building` 改成接收設計本身，而不是塞進資產的表裡。

### 3. 設計圖

```bash
npm run art:buildings
```

產生 `docs/art/buildings-blueprint.svg`（每棟一張卡片：等角圖、材質色票、桌面距離剪影）。用瀏覽器開 `http://localhost:5173/docs/art/buildings-blueprint.svg` 檢查。前後順序錯亂通常代表有零件穿進別的實心零件，改零件而不是改繪圖程式。

### 4. 3D 預覽

開發伺服器執行時開：

```
/?dev=models                                  所有資產建築放在一座島上，碼頭側
/?dev=models&view=back                        背面（另有 far、top）
/?dev=models&mode=solo&assets=exchange        單棟、放在草地方塊上
/?dev=models&assets=shipyard,salvage&color=%234a7fd4   指定建築與旗幟顏色
```

至少看碼頭側、背面、遠景三個角度，找：屋頂閃爍（兩個面在同一平面）、零件懸空或穿出屋頂、窗貼在牆上看不見、在遠景下是否還認得出來。

### 5. 在實際遊戲畫面驗證

建築在桌面鏡頭下很小，只看預覽頁不夠。開一局「觀戰 Bot 對局」推進到後面的回合（島上建築多），在回合開頭（航海事件尚未揭曉，天氣是白天）截圖。

瀏覽器面板的截圖會被縮到 800 寬。要原始解析度時：

```bash
npm run capture -- /path/to/scratchpad/out.jpg   # 背景執行，收到一張圖就結束
```

然後在頁面執行 `await window.bmgCapture()`（只有開發模式有），會把 WebGL 畫面以原始解析度存成檔案；可以先用 `resize_window` 把畫面設成 1920×1200。只會截到 3D 畫面，名牌與按鈕不在裡面。

注意：
- 瀏覽器面板隱藏時畫面不會重新繪製，`bmgCapture` 會回報錯誤；用 `preview_start` 把面板叫出來再試。
- 第一次載入 3D 場景要 10～20 秒，截圖前要等它載完（畫面不再顯示「整理港口中」）。
- 自動推進對局時，停在想要的回合就好，不要一路推到對局結束，否則結算視窗會蓋住畫面。

把截圖拼成對比圖（改前／改後、多個角度）給使用者看，比單張有用。

### 6. 測試與收尾

- `tests/ui/buildings.test.ts` 已經對所有設計檢查：零件是封閉凸體、每種資產有專屬屋頂色、全部落在草地內不重疊、最高建築高過船。新增設計會自動被涵蓋；新增零件種類或 kit 部件時，補上對應的幾何測試。
- 執行 `npm run typecheck`、`npm test`、`npm run art:buildings`，並把更新後的設計圖一起 commit。
- 更新 `src/ui/README.md` 裡 `buildings/` 的說明；若規則有變，更新風格指南。

## 常見問題

| 症狀 | 原因與解法 |
|---|---|
| 屋頂出現色塊閃爍 | 屋頂板跟山牆在同一平面；用 `kit.gabledRoof`，不要自己疊 `gable`＋`roof` 又改 thickness 的方向 |
| 設計圖前後順序錯亂 | 零件穿進另一個實心零件內部；改成沿牆面的樑或拆成多段 |
| 看起來像方塊堆疊 | 方塊沒倒角、屋頂沒出簷、圓形零件邊數太少；照風格指南第 3 節 |
| 遊戲裡看不清楚 | 先加強剪影與屋頂色；真的太小再調 `ASSET_BUILDING_SCALE` 與島的半徑，並跑擺放測試 |
| 天氣一變整個桌面不見 | 霧距由 `WeatherFog` 依鏡頭距離縮放；若改了鏡頭或桌面大小後又出現，檢查那裡 |
