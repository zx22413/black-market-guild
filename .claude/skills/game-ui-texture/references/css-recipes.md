# 質感配方與踩過的坑

實際程式碼在 `src/ui-v07/skin/layers.css`（搜尋下列名稱）、`table3d/rulesBook.css`、`table3d/sealSubmit.css`。這裡記配方的構成與為什麼這樣做。

## 配方

| 做法 | 構成 | 用在 |
| --- | --- | --- |
| 斜面木條 | 木紋＋紙紋雜訊＋上亮下暗的漸層；`inset 0 1px 0` 頂部亮邊、`inset 0 -2px 0` 底部暗邊、淡金細線；1px 深色邊；`0 4px 0` 的厚度實影；落在海上的柔影 | 黑市列、排行、底欄、島名牌、回合牌 |
| 凹槽 | `::before`，離邊約 4px 的一圈暗線，下方 1px 淡亮唇邊 | 兩條長木條（黑市列、底欄） |
| 黃銅端蓋 | `::after` 往外 `inset: -4px -8px`，兩張 data URI SVG 當背景放在兩端，`drop-shadow` 做厚度 | 只有底欄（做決定的地方） |
| 切角按鍵 | 按鈕本身不畫；`::before` 是邊框與較厚的底邊（唇），`::after` 是嵌進去的鍵面與上半反光；按下時改 `padding` 與 `::after` 的 `inset`，讓鍵面落到唇上 | 底欄、面板底部、教學卡、換人 |
| 紙吊牌 | `::before` 用 `clip-path` 畫尖角，`radial-gradient` 打孔（孔圈顏色可變，黑市列用貨品色）；晶片本身不裁切，`filter: drop-shadow` 做陰影 | 黑市列價格、底欄的選擇 |
| 9-slice 面板外框 | 一張 SVG（木框、凹槽、紙面下沉的邊、四角黃銅護角）用 `border-image: … 40 / 28px / 4px stretch`；`background-clip: padding-box` | 帳單、結果、提醒、市場卡、換人 |
| 標題牌 | 黃銅漸層當邊、`::before` 深木面，`clip-path` 兩端尖角，掛在上框下方 | 有標題的面板 |
| 美術層（底圖） | 9% 墨色的羅盤玫瑰與航線 SVG，當背景的一層，捲動時不動 | 大面板的紙面 |
| 物件外框 | 書封用 CSS（皮革漸層、虛線縫線、黃銅護角元件），書頁用羊皮紙 CSS，內容區可以伸縮與捲動 | 規則手冊 |

## 踩過的坑

- **`clip-path` 會連陰影一起裁掉**。要跟著形狀的陰影或光暈：把形狀畫在偽元素上、元素本身不裁切，或把 `drop-shadow` 放在外層。`box-shadow` 永遠是長方形。動畫裡用 `box-shadow` 的光暈（例如教學「下一步」的呼吸、提醒用的金光）要改成 `filter: drop-shadow` 的 keyframes。
- **動畫會蓋掉 `box-shadow`**：`gold-breath` 之類的動畫改的是 `box-shadow`，按鈕靠 `box-shadow` 畫的邊在動畫時會消失，結果可按的看起來比不可按的還不像按鈕。邊框改用 `outline`（`outline-offset: -1px`）。
- **捲動的面板會裁切**：`overflow: auto` 的容器會裁掉跨出邊緣的東西，絕對定位的子元素也會跟著內容捲走。要跨邊的裝飾（護角）用 `border-image`，它畫在捲動區外；要跨出上緣的東西（標題牌）改成掛在內側。
- **`border-image` 的 SVG 要有 `width`、`height`**。沒有的話瀏覽器先把圖拉成元素大小再切，`slice` 的數字就失去意義，護角變長條。
- **data URI 的 SVG**：`#` 要寫成 `%23`、引號用 `%27`；用 Python 的 `urllib.parse.quote` 產生最不容易錯。
- **別處的通用按鈕規則會滲進來**：主選單 `.menu-panel button { color }` 讓放進主選單的元件按鈕字色變深。元件的按鈕樣式要限定在元件範圍內（`.rules-book .rules-tab`）。
- **皮膚的按鍵規則會套到特殊按鈕**：`:is(.inv-bar, …) button` 這類選擇器會連封蠟章也改掉；特殊形狀的按鈕要在選擇器裡排除（`:not(.bar-lock, .seal-submit)`）。
- **裝飾讓元件變寬**：端蓋、吊牌尖角、標題牌都會吃寬度。手機寬度要另外縮小留白，量一下底欄是不是多換了一行（投資底欄應維持兩行約 94px）。
- **鏡頭安全區**：`table3d/useHudSafe.ts` 量的是元件本身的邊界，偽元素超出的部分不算；超出量要在 12px 間距內。
- **`useId` 產生的 id**（React 19 是 `_r_0_` 之類）放進 `url(#…)` 前先去掉非英數字元，見 `skin/ornaments.tsx` 的 `useSvgId`。
- **SVG 裝飾的畫法**：平塗、無描邊、頂部受光（亮邊、主色、暗底三段），和卡面插圖同一套（風格文件〈插畫與圖示〉）。
