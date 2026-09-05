# 專案地圖：補習班員工排休與特休管理系統 (Project Map)

## 📌 專案概覽
- **專案名稱**：補習班員工排休與特休管理系統 (Leave Management System)
- **建議對話標題**：`[補習班管理] 功能開發與優化`
- **主要路徑**：`C:\Users\Darry\Desktop\CodeHere\leave-management-system`
- **線上網址**：[https://feiye0306.github.io/leave-management-system/](https://feiye0306.github.io/leave-management-system/)
- **接手指南**：[AGENT_ONBOARDING.md](./AGENT_ONBOARDING.md)

---

## 🎯 開發目標 (Development Goals)
1. **補習班差勤全面數位化**：徹底告別傳統紙本排休與白板登記，跨校區統一管理。
2. **法規與年資嚴格校驗**：依據台灣《勞基法》精準計算特休天數，週年日自動重置歸零。
3. **極致排休彈性**：預設排休、點擊切換特休，支援 ±0.25/0.5/1 自訂名目排假（可選指定或不指定日期）。
4. **責任追溯與審計**：不可篡改的 Audit Log，所有假單更正、刪除退額與手動調整無所遁形。
5. **報表一鍵匯出**：月度總表 (Landscape) 與個人年度明細 PDF 直接下載，繁體中文 100% 正常顯示。

---

## 🚀 深度開發歷程與演進 (Deep Iteration History)

1. **[基礎建設] React 19 + Context 架構**：
   - 數據狀態集中於 `LeaveContext` 統一管理，支援即時雙向更新。
   - 建立 `LocalStorageRepo` 與 `FirebaseService` 雙存儲切換架構，具備離線降級能力。
2. **[法規自動化] 特休週年重置與排休累計服務**：
   - 實作 `AnnualResetService`：啟動自動巡檢到職日，週年自動重置已休天數。
   - 實作 `MonthlyAccrualService`：每月 1 號將月休額度自動計入已獲得天數，支援負數預支。
3. **[安全性與審計] 不可篡改 Audit Log**：
   - 記錄 `employee_create/update/delete`、`adjust_annual/personal`、`leave_create/update/delete`、`system_reset_annual` 等全方位行為。
4. **[報表升級] 繁體中文 PDF 匯出無亂碼**：
   - 採用純前端 DOM 渲染 + jsPDF 向量匯出，徹底解決瀏覽器端字型缺失問題。
5. **[排假深度強化] 預設排休與自訂名目增減 (Latest!)**：
   - 排休頁面預設假別改為「排休」，點擊切換為「特休」。
   - 開發 `CustomLeaveModal`，支援自由名目輸入（或快捷標籤）與 ±0.25/0.5/1 天調整。
   - 支援「指定日期登記排假」與「不指定日期純額度增減」雙模式。
   - 日曆已排假支援隨時更正日期、名目、時段或一鍵刪除退還額度。

---

## ✅ 核心功能清單 (Feature Matrix)

| 模組名稱 | 關鍵檔案 | 核心能力 | 狀態 |
| :--- | :--- | :--- | :--- |
| **排休申請台** | `LeaveInputV2.tsx` | 預設排休、自訂名目增減、±0.25天微調、三選二時段鎖定、日曆即時排假更正 | 🟢 成熟上線 |
| **員工名單管理** | `EmployeeList.tsx` | 員工增刪改、離職人員過濾、0.25天手動額度微調彈窗 | 🟢 成熟上線 |
| **營運儀表板** | `DashboardV2.tsx` | 今日請假名單、當月壽星通知卡片、同一分校同日排休衝突預警 | 🟢 成熟上線 |
| **報表中心** | `ReportCenterV2.tsx` | 分校月度總表 PDF、個人年度明細 PDF、60天到期警示、全校餘額結算表 | 🟢 成熟上線 |
| **操作日誌** | `AuditLogViewer.tsx` | 全方位審計記錄、分類篩選、異動前後數值核對 | 🟢 成熟上線 |
| **資料備份** | `DataManagement.tsx` | 系統完整 JSON 備份匯出、離線還原、安全清空 | 🟢 成熟上線 |
| **法規守護服務** | `AnnualResetService.ts` / `MonthlyAccrualService.ts` | 到職週年自動重置、每月排休自動累計遞延 | 🟢 成熟上線 |

---

## 📊 驗收與質量指標
- [x] TypeScript 編譯：0 error (`npm run build`)
- [x] Vitest 單元測試：19 / 19 PASS (`npm test -- --run`)
- [x] Playwright 端到端驗證：本機與線上全功能跑通
- [x] GitHub Actions 自動 CI/CD 部署至 GitHub Pages

---
*最後更新於：2026-09-05*
