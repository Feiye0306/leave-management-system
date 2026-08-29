# 🧠 Project Memory: leave-management-system (員工請假管理系統)

> **核心準則**：此文件是請假管理系統的單一真相庫。涉及特休計算、排休累計與 Firestore 交易邏輯前，必須先閱讀本文件。

---

## 1. 🎯 專案定位與核心架構 (Overview & Tech Stack)

本專案是專為企業/補習班校區打造的現代化員工請假、排休與特休管理系統，符合台灣《勞動基準法》規範。

* **🌐 線上公開正式網址**: [https://feiye0306.github.io/leave-management-system/](https://feiye0306.github.io/leave-management-system/)
* **🐙 GitHub 原始碼倉庫**: [https://github.com/Feiye0306/leave-management-system](https://github.com/Feiye0306/leave-management-system)

### 💻 技術堆疊 (Tech Stack)
* **前端框架 (Frontend)**: React 18+ + TypeScript + Vite + Tailwind CSS。
* **狀態管理與 UI (UI Ecosystem)**: Lucide React + Headless UI / Tailwind UI 元件庫。
* **後端與資料庫 (Backend & DB)**: Google Cloud Firebase / Firestore (NoSQL 即時同步)。
* **驗證與測試 (Testing)**: Jest + TypeScript 測試套件。

---

## 2. 📐 關鍵架構決策 (ADR - Architecture Decision Records)

### ADR-01：特休假依《勞基法》年資週年自動計算與重置
* **決策**：在 `AnnualResetService` 中，每次系統啟動比對員工「到職日 (Hire Date)」。
* **規則**：滿半年 3 天、1 年 7 天、2 年 10 天、3 年 14 天、5 年 15 天，10 年以上每年加 1 天 (上限 30 天)。
* **重置**：到職日週年當天自動執行重置，已休天數歸零並產生 `system_reset_annual` 稽核日誌。

### ADR-02：排休累計制 (Personal Leave Accrual) 與負數餘額支援
* **決策**：每月 1 號由 `MonthlyAccrualService` 自動將「每月排休限額」計入「已獲得」天數。
* **特性**：排休支援負數餘額 (Debit)，允許員工預支或緊急超休，保留足夠彈性。

### ADR-03：時段互斥鎖定與 0.25 天微調單位
* **決策**：
  1. 一日分為「上午、下午、晚上」三個時段（每時段 0.5 天）。同一天選滿 2 個時段時，第 3 個時段自動鎖定 (Disabled)。
  2. 管理員手動調整額度支援以 **0.25 天** 為增減單位，並強制填寫調整原因寫入 Audit Log。

---

## 3. ⚠️ 踩坑記錄與反模式 (Anti-patterns & Traps To Avoid)

1. **Firestore 監聽器洩漏**：
   - 早期多個元件獨立呼叫 `onSnapshot` 未及時退訂，造成記憶體浪費與報表重覆渲染。
   - **最佳實踐**：集中於專屬 Context/Hook 中管理監聽器生命週期，在 `useEffect` cleanup 嚴格退訂。
2. **排休衝突提示防呆**：
   - 同一分校同一天已有 2 人以上排休時，彈出衝突警告對話框，但不可完全鎖死，需保留主管覆核強制提交權限。

---

## 4. 📋 業務需求與功能藍圖 (Features & Roadmap Backlog)

- [x] 特休《勞基法》自動計算法與週年自動重置
- [x] 排休每月自動累計與負數餘額支援
- [x] 時段三選二鎖定機制與 0.25 天手動微調
- [x] 分校月度排休總表、個人年度明細、60天到期警示
- [x] 完整操作日誌 (Audit Log) 與 JSON 資料備份還原
- [x] 當月壽星提醒通知 (Dashboard Birthday Alerts)
- [x] 排休衝突防呆與限額提示機制 (Conflict & Quota Warning)
- [x] 完整 Vitest 單元測試套件覆蓋 (19/19 通過)
- [ ] 支援 LINE Notify / Email 假單自動審核通知
- [ ] 支援手機端 PWA 響應式離線快取

---

## 5. ⏳ 歷史對話決策里程碑 (Milestones & Decision Log)

* **2025-05**：系統立項，完成 React + Vite + Firebase 基礎建設與員工名冊。
* **2025-09**：上線特休年資自動計算與月度排休公告報表。
* **2026-01**：重構儀表板為三欄式高效佈局，導入 0.25 天微調與全校餘額結算表 (Balance Sheet)。
* **2026-08**：全面修復 `LeaveInputV2` 字串與 Tailwind 樣式空白 Bug，補齊生日提醒、靜態導入優化與 Vitest 單元測試閉環 (100% 綠燈)，強化 `.gitignore` 安全防護。
