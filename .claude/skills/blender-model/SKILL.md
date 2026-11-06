---
name: blender-model
description: Build game-styled 3D models for the Black Market Guild table in Blender from a script (curved ship hulls and anything the convex code-part system cannot shape well), bake ambient occlusion into vertex colours, export a GLB and load it in the scene — the pipeline that made 巨鯨號 (the fluyt). Use this whenever the user wants a ship (or another curved, organic model) remade, refined or made "more like a game" / 更精緻 / 像 For the King, asks to use Blender, Blender MCP or GLB models, or wants the other ships brought up to the freighter's standard — even if they do not mention this skill. Not for flat UI (game-ui-texture) and not for boxy buildings and props (lowpoly-model).
---

# Blender 建模（腳本產生 GLB）

巨鯨號（荷蘭 fluyt）就是用這個流程做的：船身、艙房、甲板佈置在 Blender 裡用腳本建；帆、尾旗、燈火、會動的部件仍由程式碼畫。腳本可以重跑，產出的 GLB 進版本控制，所以這不是在 Blender 裡手捏一次就丟的模型。

先讀：
- [`docs/art/lowpoly-style.md`](../../../docs/art/lowpoly-style.md)：第 2 節材質、**第 6 節遊戲化**、第 7 節什麼時候用 Blender。
- [`docs/art/ship-silhouettes.md`](../../../docs/art/ship-silhouettes.md)：船的剪影規則，以及試過但不採用的方向。

## 0. 設計先行（不能跳過）

照 `lowpoly-model` skill 第 1 步做完：參考板（真實的加上風格化的）→ `docs/art/<name>-concept.svg` 設計稿 → 使用者確認。沒有確認過的設計稿就不要開 Blender。設計稿要寫清楚：
- 主特徵與剪影（跟其他船不撞特徵）；
- 色帶怎麼分、強調色是什麼；
- 要保留的尺寸：佔地（船長約 7、寬 3.5）、甲板高度 `DECK = 1.25`（裝貨的箱子站在上面）、吃水 `DRAFT = 0.5`；
- 循環動態是什麼，以及哪些部件會動。

## 1. 相關檔案

| 檔案 | 作用 |
|---|---|
| `src/ui-v07/scene/ships/designs.ts` | 每艘船的**帆裝**：桅、帆桁、繩索、燈籠、帆（`SailSpec`）、尾旗、循環動態；也留一個程式碼拼的備用船身 |
| `scripts/blender/dump-ship.ts` | 把一艘船的零件和 `SWATCHES` 匯出成 JSON，給 Blender 腳本讀 |
| `scripts/blender/build-<type>.py` | 建船身與甲板佈置、照 JSON 重建帆裝、上色、烘焙 AO、匯出 GLB；巨鯨號是 `build-freighter.py`，新船從它複製 |
| `public/models/ships/<type>.glb` | 產出，進版本控制 |
| `src/ui-v07/scene/ships/BlenderHull.tsx` | `BLENDER_HULLS` 登記哪些船用 GLB；`?codeships` 改看程式碼備用船身 |
| `src/ui-v07/scene/ships/ShipModel.tsx`、`shipMotions.tsx` | 組船、帆的著色器、各船的循環動態 |
| `tests/ui-v07/shipDesigns.test.ts` | 帆裝的測試：不壓到隔壁泊位、鼓起的帆不碰繩索與桅、尾旗高過甲板 |

## 2. 先改帆裝（`designs.ts`）

帆和繩索是程式碼畫的，而且 Blender 會照它們重建桅杆和繩索，所以先把帆裝定好、測試通過，再建船身。

- 方帆用 `squareSail()`（帆掛在桅前 0.18、往前鼓），三角帆或縱帆照孤注號的寫法（帆面偏離中線、往一側鼓，那一側不要放支索）。
- 支索落在桅杆後方，避開帆鼓起的範圍；`npx vitest run tests/ui-v07/shipDesigns.test.ts` 會逐條檢查。
- 高度先對選船鏡頭：`ShipSideCamera.tsx` 的 `SHIP_BOX` 高 5.6 是五艘船共用的。主桅加尾旗明顯超過就會被上方 HUD 切掉，要降低桅杆，而不是改取景框。
- 循環動態改了的話，`ShipDesign.motion` 加新的 `kind`，在 `shipMotions.tsx` 寫元件，`ShipModel.tsx` 接上。會動的東西不要放進 GLB。

## 3. 寫 Blender 腳本

從 `build-freighter.py` 複製，保留它的骨架：

- `V(x, y, z)`：船空間（three.js，y 朝上、船頭 +z）轉成 Blender 的 z 朝上座標，glTF 匯出時會轉回來。所有座標一律用船空間寫。
- 零件函式：`box`（有倒角）、`beam`（桅、繩、帆桁）、`slab`（貼在面上的板，例如尾板彩繪）、`barrel`、`torus`、`mesh_from`（自己給頂點與面）。
- 船身：`PROFILE`（龍骨到舷頂的半斷面）＋ `half_beam(z)`＋ `sheer(z)`，沿 `STATIONS` 鋪成殼；每一段斷面分屬一條色帶（`SEG_MATS`），深淺交錯（`SEG_SHADES`）讓船板看得出來。
- `build_rig()` 照 JSON 重建：垂直、寬 ≥ 0.12 的是桅（八角、收細、加鐵箍），其他 beam 照原樣，`metal` 的 box／prism 是燈籠框；程式碼備用船身的低欄杆會跳過。
- 上色：每個零件依自己的高度從 `SWATCHES` 的 top 漸層到 bottom（轉成線性色），`shade` 做深淺變化。
- AO：全部合併成一個網格，用 Cycles 烘焙 AO 到頂點色，再乘回底色（`AO_STRENGTH`）。大面積的面要在 `AO_WEIGHTS` 裡減弱，例如貨箱、甲板。
- 會動的部件（例：吊桿與它吊的貨箱）另外合併成有名字的網格，在原位烘焙 AO（船身烘焙時先把它們藏起來，免得把它們的影子畫在甲板上），再把頂點移成以轉軸為原點；`BlenderHull` 依名字取用。
- 換色：船的主漆色寫在 `designs.ts`（例：`FREIGHTER_PAINT`），`dump-ship.ts` 匯出給腳本，帆上紋章也用它。要比較幾個顏色時，逐一改值、重建，再用 headless Chrome 截預覽頁（下方指令），拼成一張對照圖。
- 匯出：`export_vertex_color="ACTIVE"`，平面著色。
- 建模時會跑 `check_normals()`：凸零件有朝內的面就印出 `INWARD FACES` 並中止，不會匯出。新增不是凸形的零件（環、凹輪廓）時，把它的名字前綴加進 `OPEN_PARTS`。朝內的面在遊戲裡會被剔除，貨箱就會變透明。

執行（不用開 Blender 畫面）：

```bash
npx tsx scripts/blender/dump-ship.ts <type> > /path/to/scratchpad/<type>.json
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python scripts/blender/build-<type>.py -- /path/to/scratchpad/<type>.json public/models/ships/<type>.glb
```

腳本最後會印出面數，一艘船控制在 7,000 個三角形以內：倒角很吃面數，小零件的倒角不要太細。

要在 Blender 畫面裡互動調整時，可以開 Blender MCP：Preferences → Add-ons 啟用「Blender MCP」，3D 視窗按 N → BlenderMCP 分頁 → Connect to Claude（埠 9876，沒有認證，只在本機用、用完就停）。互動調好的結果最後一定要寫回腳本，GLB 只能由腳本產生。

## 4. 接進遊戲

- 在 `BlenderHull.tsx` 的 `BLENDER_HULLS` 加 `<type>: models/ships/<type>.glb`。GLB 會預先載入，取代程式碼的船身；帆、尾旗、燈火、動態照舊。
- 程式碼備用船身不用刪：`?codeships` 可以對照，測試也還用得到。

## 5. 驗證：三個鏡頭都要看

場景第一次載入要 30～50 秒，截圖前要等。瀏覽器面板是直的時，先 `resize_window` 1200×900。

1. **近看**：`/v07.html?dev=ships&view=close&ship=<type>`（鏡頭會繞船轉，連拍幾張）。
2. **選船畫面**：`/v07.html?dev=invest3d` → 點一座島 → 確定 → 開始 → 點這艘船的卡。確認桅頂和尾旗沒有被上方 HUD 切到。
3. **桌面全景**：`/v07.html?dev=ships`。跟另外四艘放在一起，確認剪影和配色分得開。

不想被瀏覽器面板的大小影響時，用 headless Chrome 截固定大小的圖（預覽頁不用點擊）：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=metal --enable-gpu --hide-scrollbars \
  --window-size=1200,900 --virtual-time-budget=40000 --screenshot=/path/to/scratchpad/out.png \
  "http://localhost:5174/v07.html?dev=ships&view=side&ship=<type>"
```

先用風格指南第 6.7 節找顯示錯誤（透明缺面、閃爍、接縫、懸空、被鏡頭切掉），再用第 6.6 節的遊戲化清單逐項檢查，把新舊對照拼成一張圖給使用者看。要問的是「好不好看」，不只是「有沒有壞」。

## 6. 收尾

- `npm run typecheck`、`npm test`、`npm run build`（確認 `dist/models/ships/` 裡有 GLB）。
- 更新 `docs/art/ship-silhouettes.md`（船型、動態、試過但不採用）與 `src/ui-v07/README.md`。

## 常見問題

| 症狀 | 原因與解法 |
|---|---|
| 加了收邊卻「看起來沒改」 | 收邊跟相鄰的面同色、凸出太少；換成有明暗對比的色票（例：深色船舷配淺木色壓頂板）、凸出約 0.08～0.1（風格指南第 6.2 節第 4 點），再用同一個鏡頭截改前改後確認 |
| 方塊透明、只剩框（貨箱像空心的），或頂面閃爍 | 方塊被鏡射成面朝內（把 y、z 對調就是鏡射），倒角後 `recalc_face_normals` 也只修好一半；`box()` 用旋轉而不是鏡射的對應（cube x, y, z → ship x, z, −y），`check_normals()` 會抓出來 |
| 兩個面上下貼齊時閃爍 | 例如屋頂板底面貼著艙房頂；讓其中一個稍微插進另一個，不要正好落在同一高度 |
| 帆上的圖案外圍出現一圈虛線 | 著色器裡用 `if` 硬切範圍；改成貼圖邊緣留透明、`ClampToEdgeWrapping` |
| 開放的殼（船身、單面板）有些面看不到 | 開放網格不能靠 `recalc_face_normals`；`mesh_from(..., facing=...)` 給每塊面「該朝哪邊」 |
| 貨箱、甲板整面發黑 | 頂點 AO：大面只有角落有取樣，四角都被擋到就整面變暗；調低 `AO_WEIGHTS` |
| 整艘船糊成一片咖啡色 | 色帶不夠：船底、水線、船身、上舷要分色，加一個強調色（第 6.2 節） |
| 甲板上有淺藍細線 | 是航線虛線畫在船上面，不是模型破洞 |
| 選船畫面切到桅頂 | 超過 `SHIP_BOX` 的高度，降低桅杆與帆 |
| `math domain error` | `deck_half`／`half_beam` 在船頭船尾趨近 0，取範圍時先判斷寬度夠不夠 |
