# 🛠️ 排休管理系統 - 自動化維護與測試腳本庫 (Scripts Directory)

本目錄存放用於本系統本機與線上 (GitHub Pages) 自動化端到端 (E2E) 測試、資料庫清理及驗證的輔助腳本。

---

## 📂 腳本清單與功能說明

| 腳本名稱 | 適用環境 | 主要功能 | 執行指令 |
| :--- | :--- | :--- | :--- |
| **`clean-data.mjs`** | 本機 / 雲端 | **快速清空測試資料**：重設 Firebase Firestore 或本地測試假單與員工資料，恢復初始乾淨狀態。 | `node scripts/clean-data.mjs` |
| **`full-online-browser-test.mjs`** | 線上 (GH Pages) | **線上版全功能端到端測試**：透過 Playwright 模擬真實用戶測試排休申請、自訂名目增減、額度更正與報表匯出，自動截圖存證。 | `node scripts/full-online-browser-test.mjs` |
| **`online-browser-test.mjs`** | 線上 (GH Pages) | **線上版快速冒煙測試 (Smoke Test)**：快速驗證 GitHub Pages 是否正常渲染、各分頁是否正常切換無報錯。 | `node scripts/online-browser-test.mjs` |
| **`browser-test.mjs`** | 本機 (Localhost) | **本機 Vite 伺服器 UI 驗證**：測試本地開發環境 (Port: 5173) 的日曆點擊、假別切換與 Modal 互動。 | `node scripts/browser-test.mjs` |
| **`test-leave-management.mjs`** | 本機 / CI | **核心排休商務邏輯 E2E 驗證**：測試年資特休計算、排休累計與衝突防呆機制。 | `node scripts/test-leave-management.mjs` |

---

## 📸 測試產出存證

執行自動化瀏覽器測試時，將自動生成以下畫面截圖供品質驗收：
- `online-test-result.png`：線上版快速冒煙測試截圖。
- `deep-online-test-result.png`：線上版深度功能操作截圖。
- `test-result.png`：本機功能驗證截圖。

---

## ⚠️ 注意事項 (For Developers & Agents)
1. 執行 Playwright 測試前，請確認本機已安裝瀏覽器驅動（若使用本機 Edge 可加上 `channel: 'msedge'`）。
2. 本機測試前請確保 Vite Dev Server 已在背景運行 (`npm run dev` 或 `npx vite preview`)。
