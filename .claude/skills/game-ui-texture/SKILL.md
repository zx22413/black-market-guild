---
name: game-ui-texture
description: Give the Black Market Guild's 2D interface (HUD strips, buttons, panels, cards, chips, menus) more texture and craft — diagnose why a UI reads flat, gather game UI references (Game UI Database), decide the decoration by layer, design illustrated UI and props that do a job, try it on the skin lab, apply it in stages and verify it in the game. Use this whenever the user says the UI looks flat, plain, cheap or "just geometric shapes", asks for 質感、美術層、底圖、外框、裝飾、漸層、內陰影、按鈕質感、插畫外框、道具 on a panel, wants a panel turned into an object (a book, a ledger, a notice), wants game UI references, or wants a new UI element styled to match — even if they do not mention this skill. Not for 3D models on the table (use lowpoly-model) or for gameplay and layout changes.
---

# 介面質感設計

這個 skill 是一套**設計思維**，不是一包樣式：先弄清楚「為什麼扁平」，再決定「加什麼、加在哪、為什麼」，最後才寫 CSS。2026-10 的質感改版就是照這個流程做的，結果寫在 [`docs/ui/v07-style-layers.md`](../../../docs/ui/v07-style-layers.md)，那份文件是目前外觀規則的來源；這裡講怎麼想、怎麼做。

開始前先讀那份文件，以及 `src/ui-v07/skin/layers.css` 開頭的註解。

## 範圍

只改外觀，不改功能、玩法與流程（V0.7 是軟性封邊：限制的是功能，不是外觀）。要動到元件結構時（例如把面板做成一本書、提交鈕換成封蠟章），行為必須和原本一樣：同樣的按鈕、同樣的關閉方式、同樣的教學標記（`data-focus`）、同樣的文字來源。規則文字一律沿用既有的文字來源，不在美術裡重寫。

## 1. 先診斷：扁平來自哪裡

使用者說「太扁平」「只是幾何形狀」時，材質通常不是問題（這個專案早就有木紋、紙紋、金線）。先逐項檢查：

- **形狀**：是不是全部都是膠囊或圓角矩形？
- **光影**：外框是不是只有一條細線？有沒有亮邊、暗邊、厚度？
- **按鈕**：是不是單一平色？按下時有沒有變化？
- **底**：說明文字是不是直接放在純色上？
- **輪廓**：有沒有任何東西打破矩形？

把結論用一兩句話講給使用者，例如「材質都有了，扁平是因為形狀和光影」。這句話決定後面所有的做法。

## 2. 找參考

[Game UI Database](https://www.gameuidatabase.com/) 有大量遊戲截圖，適合拿來找「同類型遊戲怎麼做外框和按鈕」。做法見 [`references/research.md`](references/research.md)（網站 HTML 有 Cloudflare 檢查，要用瀏覽器取清單，圖片可以直接下載、拼成對照圖）。

挑參考的原則：同類型（桌遊、卡牌、航海、交易）、同氣氛（手作、木頭、羊皮紙、黃銅），再加一兩個反例（例如 Balatro：幾乎全平面，看平面能走多遠）。每款遊戲只記「可以借什麼做法」，不記「它長怎樣」；參考圖不進版本控制（`references/visual/README.md`）。

## 3. 定原則

這幾條是這次學到、使用者也認同的：

- **材質固定少數幾種**：木、羊皮紙、黃銅，加一個點綴色封蠟紅。新東西用這幾種組出來，不加新材質。
- **質感靠形狀與光影**：斜面（頂亮、底暗、厚度）、凹槽、切角、標題牌、護角、低對比底圖。具體配方在 [`references/css-recipes.md`](references/css-recipes.md)。
- **一層只加一個招牌裝飾**：第 1 層（常駐 HUD）、第 2 層（卡牌與面板）、第 3 層（秘密時刻）各有一個，不在每個元件上都加。V0.6 失敗就是因為四周都是木板、圖釘、繩子。
- **常駐的東西最克制**：HUD 一直在畫面上，裝飾越多越吵；越少出現、越重要的時刻，可以越華麗。

## 4. 插畫要有功能

使用者的原話：「插畫也不是不行，但要想他是幹用的。」每個插畫、道具、把面板做成物件的提案，都先回答：**有了它，玩家能更快知道什麼、或更容易做什麼？**

插畫在介面上能做的事：辨識（不讀字就知道是誰的時刻）、顯示狀態（跟著狀態變）、本身就是操作（插畫就是按鈕）、分類場合（一看就知道是查資料、做決定還是公開資訊）、氣氛（只留給少數關鍵時刻）。拿掉它什麼都沒少的，就是裝飾：不放，或退成低對比的底圖。

**一個物件只代表一件事**，全遊戲一致。現有的對照表在風格文件的〈插畫要有功能〉；提新物件前先查表：意思已經有別的東西表示的（例如「只有你看得到」已經是封蠟），就不要再加第二個符號。新物件定案後補進表裡。

提案時用表格，每個提案寫「功能」與「結論（保留／拿掉／改成負責操作才保留）」，讓使用者一眼看出你在取捨，而不是在堆東西。

**大面積插畫**：3D 桌面大部分時間就是背景，大圖只放在桌面退到後面的時刻（結果畫面、事件揭曉、載入畫面）。要點陣圖時用 `codex` 生成，附現有插圖當畫風參考，圖裡不放文字，記錄到 `public/art/SOURCES.md`。簡單的裝飾（護角、端蓋、羅盤、封蠟）自己畫成 SVG 就好。

## 5. 先試做，再套用

1. **在 skin lab 試做**：`/v07.html?dev=skin-lab`（`src/ui-v07/dev/SkinLabPreview.tsx`）每一列是「現在」對「新做法」。「現在」一定用遊戲真正的 class 和元件，不要另外仿一份，這樣比較才誠實。試做的 class 用 `nb-` 前綴，只放在 `dev/skinLab.css`。
2. **給使用者看、讓他選**：截圖或請他開頁面，改哪裡、留哪裡由他決定。
3. **分階段套用**：照風險由低到高排（按鈕 → 常駐 HUD → 面板 → 改元件結構的物件 → 牽涉狀態的物件 → 文件），每個階段一個 commit，做完就驗證，壞了可以單獨退回。開始前把階段計劃講給使用者，包括每一階段的風險。
4. **套用後清掉試做複本**：那一列改成只顯示遊戲本身（標「已套用」），試做 CSS 刪掉；元件要的裝飾 SVG 放 `src/ui-v07/skin/ornaments.tsx`，能單靠 CSS 放的（端蓋、外框、羅盤）以 data URI 放在 `layers.css`。

樣式一律在 `:root:not(.skin-classic)` 底下，讓 `?skin=classic` 還能切回舊外觀比較；改了元件結構的（島嶼卡、規則手冊、封蠟章）例外，它們自帶顏色變數，兩種外觀下都一樣。

## 6. 驗證

只看試做頁不夠。每個階段都要在遊戲裡實際走到那個畫面，並檢查手機寬度、`?skin=classic`、減少動態效果。完整清單與各畫面怎麼走到，見 [`references/verification.md`](references/verification.md)，包括：瀏覽器面板隱藏時 3D 不會載入、只在線上才出現的狀態要用慢速第二玩家腳本、本機 Bot 都是立刻決定。

回報時分清楚「看過的」和「沒看到的」，沒親眼看到的畫面要明說。

## 7. 收尾

- 執行 `npm run typecheck`、`npm test`。
- 更新 `src/ui-v07/README.md`（`skin/`、`dev/`、受影響元件的說明）與 `docs/ui/v07-style-layers.md`（三層表、物件對照表、尚未套用清單）。改文件前先看 `git diff`，使用者可能同時在改。
- 只 commit 這次的檔案；工作區裡使用者自己的改動不要一起加進去。
