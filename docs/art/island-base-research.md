# 島嶼地基與樣貌：現況診斷與參考（2026-11-07）

> 狀態：**討論稿，尚未定案**。下一步是使用者選方向 → 在 Blender 做 blockout 設計稿 → 確認後才建模（[`lowpoly-style.md`](lowpoly-style.md) 第 6 節、`.claude/skills/blender-model`）。

## 1. 現況（截圖在 `island-research/`）

| 檔案 | 看到什麼 |
|---|---|
| `now-market-front.jpg` | 巴扎港：米色懸崖是一整圈垂直的大三角面，上面放一塊綠色圓餅，疊市放在圓餅上 |
| `now-shipyard-side.jpg` | 船塢島側面：棕色懸崖＋綠色薄片，像一塊切開的蛋糕 |
| `now-table.jpg` | 桌面全景：每座島都是同一個輪廓，只換了懸崖色和地面色 |

程式：`src/ui/scene/islandShape.ts` 的 `craggyCylinder`——11 邊圓柱，頂點半徑隨機 ×0.82～1.12，上面再疊一個同樣做法的草地圓柱（`grassSlab`）。所有島共用，只靠 `IslandGround` 換兩個顏色；礦山島等大標的物用 `annex` 讓圓往一側鼓出去。

## 2. 為什麼看起來像 AI 直接生成的島

社群上 AI（含 Claude）用 three.js 做的島幾乎都有這幾個特徵，我們目前全中：

1. **「圓柱＋隨機抖動」的地形**：一個基本幾何體加 noise，所有面一樣大、一樣隨機，沒有「大塊－中塊－小塊」的層次。真正手做的低面數岩石是幾個大平面配幾道刻意的折線。
2. **蛋糕切片結構**：垂直側壁＋平頂＋一層綠色蓋子，草地邊緣是硬切的，不會垂下、不會磨圓、不會有土層露出。
3. **跟海沒有接縫**：沒有沙灘、礁石、淺水色帶、退潮線；懸崖直接插進海裡，像浮在水面上的道具。
4. **每座島同一個形**：只換顏色。地形沒有在說「這座島是做什麼的」。
5. **東西擺在地上，而不是長在地上**：造景（標的物、建築）都是放在圓餅上的道具，地面不會因為它們而改變（沒有小路、擋土牆、梯田、碼頭石岸）。
6. **全部置中、全部對稱高度**：碼頭那側跟背面一樣高。真實港口島是碼頭側低（海灣、沙灘），背風側高（懸崖）。

## 3. 參考（只放連結，不存外部圖片）

**遊戲**
- *Bad North*（Oskar Stålberg）：島是 2～4 層階梯狀台地，懸崖邊緣圓潤、頂部草皮會包過邊緣，水線有一圈沙地／淺灘，顏色刻意降飽和讓單位跳出來。最接近我們「桌面上一座座島、上面有小東西」的需求。圖：<https://duckduckgo.com/?q=Bad+North+island+screenshot&iax=images&ia=images>；地形影響玩法的說法見 <https://gamesbeat.com/bad-north-shows-that-even-bloody-viking-battles-can-be-artsy-and-cute/>。
- *Islanders*（GrizzlyGames）：輪廓很簡單，但每座島都有一圈寬沙灘、大塊石柱當標的物，平滑而不是碎三角。圖：<https://duckduckgo.com/?q=Islanders+game+island+screenshot+cliffs&iax=images&ia=images>。
- *Townscaper*：同作者，地面跟建築是一起生成的（建築底下就是石岸與階梯），可以參考「建築長在地上」。<https://en.wikipedia.org/wiki/Townscaper>

**歷史（我們的時代與題材）**
- 17 世紀荷蘭 VOC 航海圖的「海岸側影」（kustprofiel／verkenning）：水手從海上辨認島嶼用的剪影圖，每座島一條獨特的天際線。很適合拿來定每座島的剪影，也跟遊戲的荷蘭市民、商船題材一致。圖：<https://duckduckgo.com/?q=17th+century+coastal+profile+view+island+drawing+VOC+chart&iax=images&ia=images>

**技法**
- 層狀懸崖：先拉幾條水平岩層，再刻意讓層與層錯開、彎曲，模仿不均勻沉積。<https://gamesartist.co.uk/layered-cliff>
- 先定剪影（主崖面、幾個明顯的突出平台、整體斜度），再降低雜訊、放大大塊形狀。<https://www.tripo3d.ai/blog/explore/how-to-make-a-cliff-3d-model>、<https://polycount.com/discussion/comment/2807887>
- Blender 做風格化海灘與岩石（沙灘、浪、岩石擺法）：<https://classcentral.com/course/youtube-create-a-stylized-beach-in-blender-2-8-eevee-island-environment-beginner-tutorial-pt-3-154410>

**反面參考（要避開的樣子）**
- three.js／AI 低面數島的圖片搜尋：<https://duckduckgo.com/?q=threejs+low+poly+island+claude&iax=images&ia=images>
- 「風格化島嶼 diorama」搜尋結果裡混了大量 AI 圖：方塊或圓盤土台、飽和青綠海水、正中央一棵棕櫚＋小屋、到處都是小細節卻沒有主次。<https://duckduckgo.com/?q=stylized+island+diorama+artstation+hand+painted+cliff+harbor&iax=images&ia=images>

### 2.1 碼頭直接插進島裡（使用者放大看到，2026-11-07）

商會島的碼頭（`src/ui/scene/Islands.tsx` 的 `structure-platform-dock`）固定放在 z = 13.4，前後各伸約 2 單位；但懸崖是隨機抖動的，碼頭方向（+z）的崖面半徑依座位 seed 落在約 12～16 之間。所以：

- 碼頭靠島的那 1～3 單位**直接埋進崖壁**，每個座位埋的深度還不一樣。
- 碼頭面板高約 0.45，崖頂高 2.4：**碼頭頂著一面將近 2 單位高的垂直崖壁**，沒有階梯、坡道或岸邊平台，人和貨上不了島。
- 巴扎港的碼頭（`marketDocks.ts`）有照懸崖輪廓算木梯，商會島沒有。

**使用者決定（2026-11-07）：不先暫時修，等新地基一起做。**

這是同一個病：地基是隨機形，其他東西只能硬塞上去。新地基要在碼頭側**做出一個低處的海灣或石砌碼頭岸**，碼頭靠在岸邊、有階梯或坡道接上台地，而不是插在崖壁上。

## 4. AI 建議的方向（待使用者選）

三個方向可以疊用，建議 **A＋C 為主、B 拿來驗剪影**：

- **A. 階梯台地（Bad North 式體塊）**：地基改成 2～3 層不規則台地，大面少、轉折明確；草皮包過邊緣成圓角唇邊，下面露一條土層；懸崖有 1～2 道岩層線。
- **B. 海岸側影定剪影（VOC 航海圖）**：每座島先畫一條側影（從桌面鏡頭方向看），八座島並排比較，互相分得出來才建模。
- **C. 地形跟功能走**：碼頭側（面向巴扎港）做低處的海灣／沙灘＋石砌碼頭岸；四個資產地基是人工整平的台地（擋土牆、階梯、小路連接）；背面升高接標的物（現有 `annex` 的概念延伸）。每座島的地質跟主題一致，例如走私港黑色玄武岩＋海蝕洞、香料群島紅土梯田、礦山島赭色岩層、燈塔島白堊崖、要塞島灰岩＋石砌牆、海盜灣珊瑚沙環礁潟湖、船塢島緩坡滑道沙灘、自由港磚砌岸＋運河。
- **海與岸的接縫（三個方向都要）**：水線一圈沙或礁石、淺水色帶、浪花沿岸線走，而不是一個圓。

## 5. 實作上要守的限制（給 Blender 建模參考）

- 桌面鏡頭幾乎是往下看：**俯視的輪廓、沙灘圈、台地邊緣**比懸崖側面重要；側面在選船鏡頭與自己島的近景才看得到。
- 資產地基（`ASSET_LOTS`）、倉庫貨箱、旗桿、造景的位置不能動，台地要涵蓋 `PLAYER_ISLAND_RADIUS × PLATEAU_SAFE_RATIO`。
- 水線半徑約 14.5（含外擴與岩角），裝飾小船路線（`tests/ui/seaLoop.test.ts`）、巴扎港碼頭木梯（`marketDocks.ts`，依懸崖輪廓算坡度）都依賴這個輪廓，換地基要一起檢查。
- 大浪時懸崖底部不能露出（`CLIFF_DEPTH`）。
- 每次都要查 [`lowpoly-style.md`](lowpoly-style.md) 6.7 的顯示錯誤（穿透面、閃爍、接縫、浮空、鏡頭穿模）。

## 6. 走私港 blockout 第 1 版（2026-11-07，方向 A＋C）

使用者選 A＋C、先做走私港，並提醒建模也要遊戲化（特徵明顯、要封邊）。

- 腳本：`scripts/blender/dump-island.ts`（把現在的懸崖、草地、碼頭、四棟資產建築、造景與倉庫匯出成 JSON）＋ `scripts/blender/blockout-island-smuggler.py`（新地基，與舊地基用同一組鏡頭渲染）。
- 對照圖：`island-research/smuggler-blockout-r1.png`（左舊右新），俯視：`island-research/smuggler-blockout-r1-top.png`。
- 主特徵：整圈崖壁改成放大的六角玄武岩柱，柱頂高低錯落並有淺色柱帽；水線外散一些矮柱當作天然步道（都在半徑 13.6 內）。
- 封邊：淺紫石楠唇邊 → 深色泥炭土帶 → 深色玄武岩；碼頭石岸有淺色壓頂；石階有淺色踏面；棧橋有深色木框與繫纜樁。
- 跟著功能走：碼頭側挖一個海灣，裡面是石砌碼頭＋棧橋＋一道階梯上台地（碼頭不再插進崖壁）；右前方有一個礫石海灘，小划艇移到這裡，用三根玄武岩柱當階梯下去；台地上有步道連接階梯、倉庫、商會旗與海灘。
- 新地基約 3,900 個三角形。

**自評的問題（下一版要改）：**
1. 柱子排得太整齊，像一圈六角形籬笆；要改成一叢一叢的，高低差更大，偶爾斷開或塌落。
2. 背面的海崖拱門（造景）仍然是另一塊方形岩體貼在島上，沒有長在一起；建議把海崖也改成玄武岩柱堆出來的第二層高台（等於把造景一起改，要另外確認）。
3. 台地中間仍然是一大片平的紫色。
4. 海灘上的石頭像小金字塔。
5. 渲染圖裡水面下有幾條穿出來的線，是 Blender 線稿的問題，不是模型。

## 7. 走私港 blockout 第 2 版（2026-11-07）

使用者同意把海崖拱門一起改，並要求第 1 版自評的問題都改掉。對照圖：`island-research/smuggler-blockout-r2.png`，俯視：`island-research/smuggler-blockout-r2-top.png`。

- **海崖併進地基**：原本的 `smuggler-cave` 造景（方形岩體）改成玄武岩柱堆出的第二層高台（頂約 5.4，比台地高 2.5）。崖洞軍火庫開在高台面向庭院那一面，門楣是一根橫躺的玄武岩柱，裡面有木撐和火藥桶。看守小屋和信號燈絞架在高台頂上。海蝕拱門兩隻腳各是一叢柱子，拱頂是三根橫躺的柱子，位置照舊，划艇穿過拱門的航線不用改。最高點約 9.5，低於 12 的上限。
- **柱子分叢**：沿海岸用緩慢起伏的波決定每一段的高度，相鄰的柱子高度接近，崖邊會一段一段升降；最低的幾段是塌掉的碎柱。大小柱混用，高柱前面偶爾多一根矮柱，看起來是台階而不是籬笆。
- **台地不再一大片平**：加了幾塊隆起的石楠草丘（深色底＋淺色頂），還有從草皮裡冒出來的矮柱。
- **海灘石頭**改成矮胖、頂部圓鈍的圓石。
- 線稿的問題：海面加厚以後，大部分水下的線不見了，棧橋柱還剩幾條。
- 新地基（含高台與拱門）約 7,400 個三角形。

**接進遊戲前要處理的事：**
1. 高台會跟著造景轉向（`backdropTurn`：後方、左或右），所以地基要拆成「固定的碼頭側本體」＋「可轉向的高台模組」，海灣、碼頭與海灘不轉。
2. 高台改了以後，`smuggler-cave` 造景要拿掉山體，只留會動的部分（信號燈、煙、夜燈、划艇），並重新檢查 `seaLoop` 與擺放測試。
3. 換掉 `craggyCylinder` 之後，要一起檢查水線半徑、裝飾小船航線、碼頭與船的相對位置。

## 8. 接進遊戲（2026-11-07）

使用者定案第 2 版。實作：

- `scripts/blender/island_smuggler.py`：地形零件（blockout 與正式建模共用）。`blockout-island-smuggler.py` 照舊出設計稿；`build-island-smuggler.py` 烘焙 AO、匯出 `public/models/islands/smuggler-port-body.glb`（不動的本體，約 5,500 三角形）與 `smuggler-port-headland.glb`（高台＋拱門，約 1,800 三角形），並產生 `src/ui/scene/islandBaseShapes.ts`（本體水線、高台水線扇形、拱門腳）。
- `islandScenery.ts`：走私港加 `base`、拿掉 `annex`；`smuggler-cave` 造景改成高台上的程式零件（崖洞木撐與火藥桶、看守小屋、信號燈絞架、煙、夜燈、穿過拱門的划艇），以 `HEADLAND_AT` 為原點、倍率 1；划艇移到海灘（`SceneryPiece.ashore`）。
- `IslandLook.tsx`／`Islands.tsx`：有 `base` 的島畫 GLB 本體，不畫岩壁、草地、Kenney 碼頭與沙岩；高台 GLB 跟標的物一起轉向。`islandShorelines` 新增第三個參數讓浪花沿新岸線走。
- 測試：`seaLoop.test.ts` 改用新地基的水線並檢查划艇不撞拱門腳；`islandScenery.test.ts` 允許 `ashore` 的造景離開台地（只限有 `base` 的島、高度低於台地）。划艇的航線縮成 0.7×1.9，才在高台轉到右側時離海灘夠遠。
- 預覽：`/v07.html?dev=ships&islands=smuggler-port,mine,lighthouse,smuggler-port&assets=1`（新增 `islands`、`assets` 參數）；單島：`/v06.html?dev=models&island=smuggler-port&view=dock|back`。

已知、還沒處理：
- 高台轉到左右兩側時，本體後方是一般的柱子崖邊（正常）；高台轉到後方時，本體後緣的柱子藏在高台裡。
- 水線只有 11 點，浪花在海灣、碼頭附近是粗略的。
- 島卡插畫（`cardArt`）還是舊的走私港圖。
