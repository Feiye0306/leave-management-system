# 📅 補習班員工排休與特休管理系統 (Leave Management System)

> 專為企業與補習班多校區設計的現代化差勤、排休與特休管理系統。全面符合台灣《勞動基準法》規範，支援年資週年自動計算、排休每月自動累計、自訂名目彈性增減（±0.25/0.5/1天）與不可篡改的操作稽核日誌。

---

## 🌐 相關連結 (Official Links)

- 🚀 **線上正式版 (GitHub Pages)**: [https://feiye0306.github.io/leave-management-system/](https://feiye0306.github.io/leave-management-system/)
- 🐙 **GitHub 原始碼倉庫**: [https://github.com/Feiye0306/leave-management-system](https://github.com/Feiye0306/leave-management-system)
- 📖 **Agent 接手手冊**: [AGENT_ONBOARDING.md](./AGENT_ONBOARDING.md)
- 🧠 **專案架構記憶**: [PROJECT_MEMORY.md](./PROJECT_MEMORY.md)
- 📐 **業務核心邏輯說明**: [Project_Logic.md](./Project_Logic.md)
- 🗺️ **功能地圖**: [Project_Map.md](./Project_Map.md)

---

## ✨ 核心特色與功能矩陣 (Feature Matrix)

### 1. 🏖️ 特休假管理 (Annual Leave)
- **《勞基法》年資自動計算**：
  - 滿半年：3 天
  - 滿 1 年：7 天
  - 滿 2 年：10 天
  - 滿 3 年：14 天
  - 滿 5 年：15 天
  - 滿 10 年以上：每年加 1 天（上限 30 天）
- **到職週年自動重置 (`AnnualResetService`)**：系統每次啟動比對員工到職日，到職週年當天自動將已休天數歸零並產生重置審計日誌，杜絕人工遺漏。

### 2. 🗓️ 排休申請與管理 (Personal Leave)
- **預設假期為「排休」**：進入排休介面預設為排休（藍色），點擊切換為特休（橙色）。
- **每月固定額度自動累計 (`MonthlyAccrualService`)**：每月 1 號自動累計每月排休額度，支援跨月遞延。
- **負數餘額彈性支援**：允許行政預支或超休，餘額以負數清楚呈現，不暴力阻擋正常營運。
- **時段互斥鎖定**：單日提供「上午、下午、晚上」三時段（每時段 0.5 天），同一天選滿 2 個時段自動鎖定第 3 個時段。
- **單日微調與排休更正**：支援 `1.0`、`0.75`、`0.5`、`0.25` 天，已排休格子可隨時更正日期、名目、時段或刪除退回額度。

### 3. ⚡ 自訂名目假期調整與特殊排假 (`CustomLeaveModal`)
- **自由輸入名目 / 快捷標籤**：內建「颱風假補償、加班補休、值班津貼折抵、專案獎勵、事假扣除、生理假折抵、特殊排休」等快捷事由。
- **彈性調整天數**：提供 `+1`、`+0.5`、`+0.25`、`-0.25`、`-0.5`、`-1` 快捷按鈕及任意數值輸入。
- **雙模式自由切換**：
  - **不指定日期（純額度增減）**：直接增減該員工餘額，寫入操作日誌，不佔用日曆格子。
  - **指定日期（登記排假）**：在日曆指定日期建立帶有名目標籤的排休卡片（例如【颱風假補償 0.5天】），並自動扣除額度。

### 4. 📊 報表中心與營運儀表板 (Reports & Dashboard)
- **分校月度排休總表 (PDF)**：支援橫向 (Landscape) 列印、繁體中文內嵌字型，直接下載不亂碼。
- **個人年度差勤明細 (PDF)**：查詢個別員工詳細排休紀錄與剩餘天數。
- **60 天到期警示報表**：自動篩選特休即將到期人員。
- **全校餘額結算表 (Balance Sheet)**：一覽所有員工之初始、已用、調整與剩餘額度。
- **當月壽星通知與排休衝突預警**：即時預警同一校區同一天 2 人以上排休。

### 5. 🛡️ 稽核日誌與資料備份 (Audit Log & Backup)
- **不可篡改的操作日誌 (`AuditLogViewer`)**：完整追蹤請假、刪單、手動調整、系統重置與資料匯出，記錄變動前後數值。
- **JSON 資料備份與還原**：一鍵匯出全系統資料備份檔，支援離線還原。

---

## 💻 技術堆疊 (Tech Stack)

| 領域 | 技術選型 | 說明 |
| :--- | :--- | :--- |
| **前端框架** | React 19 + TypeScript + Vite 7 | 極速 HMR、強型別約束、零運行時開銷 |
| **樣式與圖標** | Tailwind CSS 3 + Lucide React | 現代深色/淺色高質感介面、高資訊密度卡片 |
| **雲端資料庫** | Google Cloud Firebase Firestore | NoSQL 即時同步 (Real-time Snapshot) |
| **本機離線降級** | LocalStorage (`LocalStorageRepo`) | 無外網環境下自動離線降級運作，資料不遺失 |
| **報表生成** | jsPDF + html2canvas | 瀏覽器端純前端高精度 PDF 匯出 |
| **自動化測試** | Vitest 4 + Testing Library + Playwright | 19 項核心邏輯測試 100% 覆蓋 + E2E 瀏覽器驗證 |
| **持續整合部署** | GitHub Actions ➔ GitHub Pages | Git Push 自動打包上線 |

---

## 📂 專案目錄結構地圖 (Project Structure)

```text
leave-management-system/
├── .github/workflows/          # GitHub Actions 自動部署至 GitHub Pages
├── .backups/legacy_assets/     # 歷史除錯日誌與資產歸檔庫
├── public/                     # 靜態資源 (Favicon、字體)
├── scripts/                    # 自動化維護與 Playwright E2E 測試腳本
│   ├── README.md               # 腳本庫詳細使用說明
│   ├── clean-data.mjs          # 重設與清空測試資料腳本
│   ├── full-online-browser-test.mjs # 線上版完整 E2E 測試
│   └── online-browser-test.mjs # 線上版快速冒煙測試
├── src/
│   ├── components/             # 核心業務視圖元件
│   │   ├── AuditLogViewer.tsx  # 操作日誌審查器
│   │   ├── DashboardV2.tsx     # 營運總覽儀表板 (壽星、衝突提醒)
│   │   ├── DataManagement.tsx  # JSON 資料備份與還原
│   │   ├── EmployeeList.tsx    # 員工名單管理與額度手動微調
│   │   ├── LeaveInputV2.tsx    # 排休申請、日曆檢視、自訂名目增減彈窗
│   │   ├── ReportCenterV2.tsx  # PDF 報表生成與餘額結算表
│   │   └── SystemSettings.tsx  # 分校設定與系統偏好
│   ├── context/
│   │   └── LeaveContext.tsx    # 全域資料狀態中樞 (React Context)
│   ├── data/
│   │   └── mockData.ts         # 初始示範資料庫
│   ├── services/               # 核心業務邏輯與資料存取服務
│   │   ├── AnnualResetService.ts  # 特休年資週年重置服務
│   │   ├── MonthlyAccrualService.ts # 排休每月自動累計服務
│   │   ├── AutoBackupService.ts   # 定時自動備份提醒服務
│   │   ├── FirebaseService.ts     # Firestore 雲端即時讀寫介面
│   │   └── LocalStorageRepo.ts    # 本機 LocalStorage 備援儲存庫
│   ├── types/
│   │   └── index.ts            # 全域 TypeScript 介面定義
│   ├── utils/
│   │   ├── auditLogger.ts      # 稽核日誌產生工具
│   │   └── leaveUtils.ts       # 特休天數計算與時間工具
│   ├── test/                   # Vitest 單元測試套件
│   ├── App.tsx                 # 應用程式骨架與導航側邊欄
│   └── main.tsx                # React 應用程式掛載入口
├── AGENT_ONBOARDING.md         # 🤖 新接手 Agent 3 分鐘開工指引
├── PROJECT_MEMORY.md           # 🧠 單一真相大腦 (ADR、反模式、里程碑)
├── Project_Logic.md            # 📐 核心業務規則詳細手冊
├── Project_Map.md              # 🗺️ 專案架構演進地圖
├── package.json                # 相依套件與腳本定義
└── vite.config.ts              # Vite 打包配置 (Base path: /leave-management-system/)
```

---

## 🚀 快速上手 (Quick Start)

### 1. 環境需求
- Node.js 18.0 或更高版本
- npm 或 pnpm

### 2. 安裝依賴
```bash
npm install
```

### 3. 本地啟動開發伺服器
```bash
npm run dev
```
瀏覽器開啟 `http://localhost:5173/` 即可進入系統。

### 4. 執行單元測試
```bash
npm test -- --run
```
全套 19 項測試將自動運行，驗證特休年資、到職週年重置、排休累計與報表功能。

### 5. 建置生產版本
```bash
npm run build
```
產出靜態檔案至 `dist/` 目錄。

---

## 🔐 安全規範 (Security Policy)
1. **嚴禁 Hardcode 金鑰**：任何 Firebase API Key 或敏感設定一律透過 `.env` 注入，嚴禁直接寫死在程式碼中。
2. **Git 防護**：`.env`, `.env.local` 等敏感檔案已被 `.gitignore` 嚴格排除。每次 Commit 前請二次確認無敏感檔案被暫存。
