# 🧠 Project Memory: leave-management-system (補習班員工排休與特休管理系統)

> **核心準則**：此文件是本請假管理系統的單一真相庫 (Single Source of Truth)。在修改特休計算、排休累計、自訂名目增減與 Firestore 交易邏輯前，必須先閱讀本文件。

---

## 1. 🎯 專案定位與核心架構 (Overview & Tech Stack)

本專案是專為企業與補習班校區打造的現代化員工請假、排休與特休管理系統，全面符合台灣《勞動基準法》規範。

- **🌐 線上公開正式網址**: [https://feiye0306.github.io/leave-management-system/](https://feiye0306.github.io/leave-management-system/)
- **🐙 GitHub 原始碼倉庫**: [https://github.com/Feiye0306/leave-management-system](https://github.com/Feiye0306/leave-management-system)
- **📖 接手 Agent 開工指南**: [AGENT_ONBOARDING.md](./AGENT_ONBOARDING.md)

### 💻 技術堆疊 (Tech Stack)
- **前端框架 (Frontend)**: React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 3。
- **圖標與 UI 元件庫 (UI Ecosystem)**: Lucide React (向量圖標)。
- **後端與雲端資料庫 (Backend & DB)**: Google Cloud Firebase Firestore (NoSQL 即時同步)。
- **本機離線備援 (Local Fallback)**: LocalStorage (`LocalStorageRepo`)，斷網環境下無縫降級儲存。
- **報表匯出 (Report Export)**: jsPDF + html2canvas，繁體中文 100% 嵌入無亂碼。
- **測試框架 (Testing)**: Vitest 4 + Testing Library + Playwright 瀏覽器自動化驗證。

---

## 2. 📐 關鍵架構決策 (ADR - Architecture Decision Records)

### ADR-01：特休假依《勞基法》年資週年自動計算與重置
- **決策**：在 `AnnualResetService` 中，每次系統啟動比對員工「到職日 (Hire Date)」。
- **規則**：滿半年 3 天、1 年 7 天、2 年 10 天、3 年 14 天、5 年 15 天，10 年以上每年加 1 天 (上限 30 天)。
- **重置機制**：到職日週年當天自動執行重置，已休天數 (`used`) 歸零並產生 `system_reset_annual` 稽核日誌。嚴禁同一年度重複重置。

### ADR-02：排休每月固定額度累計制 (Personal Leave Accrual) 與負數餘額支援
- **決策**：每月 1 號由 `MonthlyAccrualService` 自動將員工設定的「每月排休限額」計入「已獲得 (`earned`)」天數。
- **特性**：
  1. 排休支援跨月累計遞延。
  2. 支援負數餘額 (Debit)，允許員工預支或緊急超休，保留行政彈性而不直接阻擋營運。

### ADR-03：預設排休、點擊切換特休與時段三選二鎖定
- **決策**：
  1. 排休申請介面預設為排休（藍色），點擊切換為特休（橙色）。
  2. 一日分為「上午、下午、晚上」三個時段（每時段 0.5 天）。同一天選滿 2 個時段時，第 3 個時段自動鎖定 (Disabled)，杜絕超過 1.0 天。

### ADR-04：自訂名目假期調整與彈性排假 (Custom Title & Quota Adjustment)
- **決策**：
  1. 支援自由輸入名目或一鍵選用快捷標籤（如颱風假補償、加班補休、值班折抵、專案獎勵、事假扣除等）。
  2. 支援一鍵增減 `+1`、`+0.5`、`+0.25`、`-0.25`、`-0.5`、`-1` 天及任意小數。
  3. 雙模式支援：
     - **不指定日期（純額度增減）**：直接增減排休/特休餘額，寫入審計日誌，不佔用日曆。
     - **指定日期（登記排假）**：在日曆指定日期建立帶有名目標籤的排休卡片（例如【颱風假補償 0.5天】），並自動扣除額度。

### ADR-05：已排休假單更正、移動日期與刪除退額度
- **決策**：日曆上已排休的格子可隨時點擊開啟管理彈窗，支援更改日期（移動排休）、更換假別、微調天數與時段，或一鍵刪除並自動退回該天數額度。

---

## 3. ⚠️ 歷史踩坑記錄與反模式庫 (Anti-patterns & Traps To Avoid)

1. **JSX 巢狀 Modal 標籤閉合錯位**：
   - 早期在 `LeaveInputV2.tsx` 結尾手動 replace 時，容易因多個 Modal 巢狀結構漏閉合 `</div>` 導致 Vite 編譯崩潰。
   - **最佳實踐**：任何對複雜元件的結構性修改，先寫入暫存檔完整複製，並強制透過 `npm run build` 確認 0 error。
2. **Firestore 監聽器洩漏**：
   - 早期多個元件獨立呼叫 `onSnapshot` 未及時退訂，造成記憶體浪費與重複渲染。
   - **最佳實踐**：集中於 `LeaveContext.tsx` 中管理監聽器生命週期，在 `useEffect` cleanup 嚴格退訂。
3. **0.25 天浮點數小數精度**：
   - JavaScript 原生加減法容易出現 `0.1 + 0.2 = 0.30000000000000004`。
   - **最佳實踐**：計算後統一四捨五入至小數點後兩位。
4. **清空資料後選單空狀態崩潰**：
   - 清空員工資料後，排休選單若未做空陣列防護，會造成使用者無法操作或測試 Timeout。
   - **最佳實踐**：全域元件加入防禦性渲染（Defensive Rendering）與「請先新增員工」的友善提示。

---

## 4. 📋 業務需求與功能藍圖 (Features & Roadmap Backlog)

### 🟢 已完成成品 (Production Ready)
- [x] 特休《勞基法》年資週年自動計算與自動重置 (`AnnualResetService`)
- [x] 排休每月固定額度自動累計與負數餘額預支支援 (`MonthlyAccrualService`)
- [x] 預設假別為排休（藍色），點擊切換為特休（橙色）
- [x] 時段三選二鎖定機制 (0.5 天/時段，選滿 2 個鎖定第 3 個)
- [x] 自訂名目假期調整與特殊排假 (±0.25/0.5/1天微調、可選指定/不指定日期)
- [x] 排休假單更正、移動日期、更改時段與刪除退額度
- [x] 分校月度排休總表 PDF 下載 (橫向列印、繁體中文內嵌)
- [x] 個人年度差勤明細、60天到期警示與全校餘額結算表 (Balance Sheet)
- [x] 完整不可篡改操作日誌 (Audit Log Viewer)
- [x] JSON 資料備份與還原
- [x] 當月壽星提醒通知 (Dashboard Birthday Alerts)
- [x] 同校同日 2 人以上排休衝突預警機制
- [x] 完整 Vitest 單元測試套件覆蓋 (19/19 通過)
- [x] GitHub Actions 自動化 CI/CD 與 GitHub Pages 線上版

### 🟡 半成品與未來規劃 (Roadmap)
- [ ] 支援 LINE Notify / Email 假單自動審核通知
- [ ] 支援手機端 PWA 響應式離線安裝與快取

---

## 5. ⏳ 歷史對話決策里程碑 (Milestones & Decision Log)

* **2025-05**：系統立項，完成 React + Vite + Firebase 基礎建設與員工名冊。
* **2025-09**：上線特休年資自動計算與月度排休公告報表。
* **2026-01**：重構儀表板為三欄式高效佈局，導入 0.25 天微調與全校餘額結算表 (Balance Sheet)。
* **2026-08**：全面修復 `LeaveInputV2` 樣式與空狀態，補齊生日提醒、單元測試閉環 (19/19 綠燈) 與 `.gitignore` 安全防護。
* **2026-09**：
  - 升級排休預設為「排休」，點擊切換為「特休」。
  - 實作「自訂名目增減與特殊排假（±0.25/0.5/1天、可選是否指定日期）」。
  - 建立全套 Agent 接手開工手冊 (`AGENT_ONBOARDING.md`)，徹底標準化專案結構與文件。
