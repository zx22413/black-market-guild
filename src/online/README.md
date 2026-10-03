# `src/online`｜連線房間

房主開房、朋友用連結加入、空位由 Bot 補上的線上對局。設計與限制見 [`docs/architecture.md`](../../docs/architecture.md) 第 8 節。

環境無關（由 `tsconfig.engine.json` 與 `tsconfig.server.json` 強制），同時給 Cloudflare 伺服器（`server/worker.ts`）與瀏覽器（`src/ui/online/`）使用。

## 檔案

| 檔案 | 職責 |
| --- | --- |
| `protocol.ts` | 客戶端／伺服器訊息型別、`parseClientMessage` 輸入驗證、名稱清理、房號格式、協定版本。 |
| `room.ts` | `Room`：大廳（加入、改名、房主開局）、以 `runMatch` 執行對局、把決定送給對應座位並只接受伺服器提供過的合法行動、重連時送出完整快照。 |

## 行為細節

- 每個人以瀏覽器保存的隨機 token 辨識；重新整理或手機斷線重連會回到同一個座位。
- 對局開始後無法加入；沒有超時與代打（`docs/architecture.md` 7.2 尚未決定）。
- 測試在 `tests/online/`。
