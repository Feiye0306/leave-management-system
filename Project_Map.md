# 專案地圖：補習班休假管理系統 (Leave Management System)

## 📌 專案概覽
- **專案名稱**：補習班休假管理系統
- **對話建議標題**：`[補習班管理] 功能開發與優化`
- **主要路徑**：`C:\Users\Darry\Desktop\CodeHere\leave-management-system`

## 🎯 開發目標 (Development Goals)
1. **數位化轉型**：將繁瑣的補習班紙本排休流程完全無紙化。
2. **數據正確性**：透過系統邏輯防止員工超休、重複排休，並自動計算特休/補休餘額。
3. **責任追溯**：建立不可篡改的稽核日誌 (Audit Log)，確保任何刪改假單或導出資料的行為皆有紀錄。
4. **報表自動化**：一鍵生成符合行政需求的月度 PDF 報表，解決字體亂碼問題。

## 🚀 深度開發歷程 (Deep Iteration History)
1. **[核心] 基礎架構與 Context 遷移**：
    - 從零建立 Dashboard 並將數據管理從單一 component 遷移至 `LeaveContext`。
    - 解決了導航標籤在「空資料」狀態下依然顯示高亮的問題，確保 UI 動態感。
2. **[安全性] 稽核日誌 (Audit Log) 系統**：
    - **核心需求**：追蹤所有敏感操作以防止資料誤刪或濫用。
    - **技術實現**：建立 `auditLogger.ts`，記錄：
        - `DELETE_LEAVE`, `MODIFY_LEAVE`: 避免爭議的核心記錄。
        - `EXPORT_DATA`, `CASHOUT`: 涉及個資導出與金錢結算的操作。
    - **UI 展示**：開發 `AuditLogViewer.tsx`，支援各種類別的篩選與搜尋。
3. **[技術突破] PDF 報表繁體中文支援**：
    - **挑戰**：解決 PDFMake 在瀏覽器端生成中文 PDF 時的亂碼與字體缺失。
    - **解決**：成功導入可嵌入的繁體中文字體，並實現「直接下載」而非彈窗預覽。
4. **[優化] 視覺指示器系統**：
    - 行事曆不只是顯示「有假」，而是透過自定義邏輯區分「早、午、晚」三個時段 (TimeSlot)，並使用統一色系（HSL 調整）。

## ✅ 功能詳盡列表 (Comprehensive Feature Matrix)

### 1. 👥 員工管理 (Employee Management)
- **資料欄位**：
    - 基礎：姓名、分校 (Branch)、狀態 (在職/離職)、入職/離職日。
    - **特休 (Annual Leave)**：初始/已得/已用/到期日 (Expiry)。
    - **排休 (Personal Leave)**：
        - 概念：**每月固定額度**（例如月休 4 天），而非傳統的請假扣打。
        - 累積性：當月未休完的天數**可遞延**至下個月使用（e.g. 這個月沒休，下個月變成 4+4=8 天）。
        - 負數允許：系統僅需清楚顯示餘額（如 `-1` 天），**不需**強制阻擋或跳出警告，給予行政彈性。
    - **額度限制**：`monthlyPersonalQuota` (預設每月給予的天數，如 4 天)。
- **操作邏輯**：
    - **手動額度調整 (Manual Adjustment)**：
        - 介面：卡片式設計，直觀操作。
        - 粒度：支援 **1天、0.5天、0.25天** 的微調。
        - 記錄：所有調整皆會寫入 Audit Log，並可註記理由。
    - 支援「結算 (Cash Out)」功能。

### 2. 📅 請假排程 (Leave Scheduling)
- **假別支援**：特休 (Annual)、補休/事假 (Personal)。
- **時段粒度**：
    - 支援 **全天 (Full Day)**。
    - 支援 **時段 (Slots)**：早 (Morning)、午 (Afternoon)、晚 (Evening)。
- **檢核邏輯**：
    - **衝突偵測**：同一人同一時段不可重複請假。
    - **額度檢查**：餘額不足時禁止送出。

### 3. 🛡️ 稽核與安全 (Audit & Security)
- **與 `src/types/index.ts` 對應的追蹤行為**：
    - `employee_create/update/delete`
    - `adjust_annual/personal` (手動調整額度)
    - `leave_create/update/delete`
    - `system_export` (資料外洩風險監控)
- **介面**：AuditLogViewer 必須能清楚顯示「操作時間」、「操作人(目前預設 System)」、「變動前/變動後數值」。

### 4. 📄 報表中心 (Report Center)
- **格式**：PDF (PDFMake)。
- **內容**：
    - 包含：員工姓名、假別統計、詳細請假清單。
    - 樣式：支援繁體中文標題與表格。
- **互動**：按鈕支援「下載全部」或「下載個人」。

## ⚙️ 技術規格 (Technical Specs)
- **Frontend**: React 18 (Vite) + TypeScript.
- **State Management**: React Context API (`LeaveContext`).
- **Validation**: Zod (嚴格校驗日期格式與數值).
- **Storage**: LocalStorageRepo (目前), Firebase Firestore (計畫中).
- **Styles**: Tailwind CSS (響應式設計).

## 📊 目前狀態與下階段計畫
- [x] **已完成**: 請假功能核心、PDF 中文報表、稽核日誌全功能、UI 美化、0.25天手動調整、全校餘額結算表。
- [x] **已完成**: 員工生日提醒 (Dashboard 壽星通知)、排休衝突防呆。
- [x] **已完成**: 雲端同步 (Firebase 整合與資料遷移工具)。
- [x] **已完成**: Vitest 單元測試套件 100% 覆蓋通過。
- [ ] **[未來擴充] LINE Notify / Email 通知**: 支援假單提交自動通知主管。
- [ ] **[未來擴充] PWA 離線支援**: 支援手機端安裝與離線快取。

---
*最後更新於：2026-08-29*
