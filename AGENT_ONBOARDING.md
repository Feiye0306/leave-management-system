# 🤖 Agent 交接與開工指南 (Agent Onboarding Guide)

> **核心使命**：本指南專為所有接手維護與擴充「排休管理系統 (`leave-management-system`)」的 AI Agent 與工程師編寫。  
> 閱讀本文件後，你可以在 **3 分鐘內進入狀況**，掌握所有核心業務邏輯、架構地圖、歷史踩坑教訓，並直接開工處理任何需求！

---

## ⚡ 1. 三分鐘快速開機清單 (3-Minute Boot Protocol)

### 1.1 專案基本資訊
- **專案路徑**：`C:\Users\Darry\Desktop\CodeHere\leave-management-system`
- **線上正式版**：[https://feiye0306.github.io/leave-management-system/](https://feiye0306.github.io/leave-management-system/)
- **GitHub 倉庫**：[https://github.com/Feiye0306/leave-management-system](https://github.com/Feiye0306/leave-management-system)
- **技術棧**：React 19 + TypeScript + Vite 7 + Tailwind CSS 3 + Firebase Firestore + Vitest

### 1.2 本機開機檢測指令
接手任何任務時，**請第一時間執行以下指令確認系統健康度**：
```bash
# 1. 執行單元測試 (確認 19 項測試全部綠燈通過)
npm test -- --run

# 2. 執行 TypeScript 與 Vite 打包 (確認 0 語法/型別錯誤)
npm run build
```

---

## 📐 2. 五大核心業務鐵律 (Non-Negotiable Business Rules)

任何 Agent 在修改或新增邏輯時，**絕對禁止違反以下五大鐵律**：

### 鐵律 1：特休假依《勞動基準法》年資週年自動計算與重置
- **計算公式**（定義於 `src/utils/leaveUtils.ts`）：
  - 滿半年：3 天
  - 滿 1 年：7 天
  - 滿 2 年：10 天
  - 滿 3 年：14 天
  - 滿 5 年：15 天
  - 滿 10 年以上：每年加 1 天（上限 30 天）
- **到職週年重置服務 (`src/services/AnnualResetService.ts`)**：
  - 系統每次載入自動比對「今日」是否為員工的「到職日週年 (Hire Date Anniversary)」。
  - 當天自動執行重置：已用天數 (`used`) 歸零，並產生 `system_reset_annual` 稽核日誌。
  - 嚴禁同一年度重複重置！

### 鐵律 2：排休累計制 (Personal Leave Accrual) 與負數餘額
- **每月自動累計 (`src/services/MonthlyAccrualService.ts`)**：
  - 每月 1 號自動將員工設定的 `monthlyPersonalQuota`（如每月 4 天）加入其 `earned` 額度中。
  - 當月未休完的額度自動遞延至下個月累計。
- **支援負數餘額 (Debit)**：
  - 系統允許員工預支或緊急超休（餘額為負數，如 `-1.5` 天），不強制阻擋正常營運，行政彈性最大化。

### 鐵律 3：預設排休、點擊切換特休與時段互斥鎖定
- **預設狀態**：進入排休介面初始假別一律預設為 **「排休 (Personal Leave)」**，點擊切換為 **「特休 (Annual Leave)」**。
- **時段互斥鎖定**：
  - 單日分「上午、下午、晚上」三時段（每時段 0.5 天）。
  - 選滿 2 個時段時，第 3 個時段自動鎖定 (Disabled)，防止超過 1.0 天。

### 鐵律 4：自訂名目假期調整與彈性微調 (±0.25/0.5/1天)
- **元件位置**：`src/components/LeaveInputV2.tsx` 中的 `CustomLeaveModal`。
- **幅度微調**：支援 `+1`、`+0.5`、`+0.25`、`-0.25`、`-0.5`、`-1` 及任意自訂小數。
- **兩種模式**：
  1. **不指定日期（純額度增減）**：直接調整員工的 `annualLeave.adjustment` 或 `personalLeave.adjustment`，不佔用日曆格子。
  2. **指定日期（登記排假）**：在日曆指定日期建立包含 `customTitle`（如「颱風假補償」）的排休卡片，並同步扣除額度。

### 鐵律 5：不可篡改的操作稽核日誌 (Audit Log)
- 任何請假、批次申請、刪除、手動額度調整、系統週年重置或資料匯出，**必須呼叫 `addAuditLog()` 寫入紀錄**。
- 嚴格記錄變動前後數值 (`before` / `after`) 與操作原因，保證責任可追溯。

---

## 🗺️ 3. 系統架構地圖與檔案職責 (Architecture Map)

```text
src/
├── context/
│   └── LeaveContext.tsx         # [核心大腦] 全域狀態機、Firestore 訂閱、提供所有 CRUD Hook
├── components/
│   ├── LeaveInputV2.tsx         # [最重要] 排休申請主介面、月曆渲染、自訂名目彈窗、已排假管理更正彈窗
│   ├── EmployeeList.tsx         # 員工名冊、新增/編輯員工、0.25天手動額度微調彈窗
│   ├── DashboardV2.tsx          # 營運總覽儀表板、當月壽星卡片、排休衝突預警通知
│   ├── ReportCenterV2.tsx       # 報表中心、PDF 匯出引擎、全校餘額結算表 (Balance Sheet)
│   ├── AuditLogViewer.tsx       # 稽核日誌檢視器、分類篩選、操作軌跡查詢
│   ├── DataManagement.tsx       # JSON 備份檔匯出、還原與清空
│   └── SystemSettings.tsx       # 分校管理與系統設定
├── services/
│   ├── AnnualResetService.ts    # 特休年資到職週年自動重置守護引擎
│   ├── MonthlyAccrualService.ts  # 每月 1 號排休額度自動累計守護引擎
│   ├── FirebaseService.ts       # Firestore 雲端即時連線與查詢介面
│   └── LocalStorageRepo.ts      # 本機離線備援資料庫
├── types/
│   └── index.ts                 # 全域型別介面 (Employee, LeaveRecord, AuditLog, DateConfig 等)
└── utils/
    ├── leaveUtils.ts            # 特休年資天數計算核心純函式
    └── auditLogger.ts           # 稽核日誌建構工具函式
```

---

## ☠️ 4. 歷史重大踩坑與失敗教訓 (Failure Post-mortems & Anti-patterns)

**在修改代碼前，務必逐條檢查，切勿重蹈覆轍！**

| 慘痛教訓 (Failure Post-mortem) | 根本原因 (Root Cause) | 防禦性最佳實踐 (Best Practice) |
| :--- | :--- | :--- |
| **💥 JSX 標籤未閉合導致編譯失敗** | `LeaveInputV2.tsx` 含有 4 個複雜 Modal，多次局部分段 replace 導致結尾 `div` 或閉合標籤錯位。 | 大幅修改 Modal 時，先在暫存檔寫入完整組件，再一次性複製替換；完成後**強制執行 `npm run build`** 驗證 0 error！ |
| **💥 0.25 天小數累加時的浮點誤差** | JavaScript 浮點數運算（如 `0.1 + 0.2`）可能產生 `0.30000000000000004`。 | 運算後使用 `Math.round(val * 100) / 100` 或 `Number(val.toFixed(2))` 保證兩位小數精確度。 |
| **💥 Firestore 監聽器記憶體洩漏** | 多個元件內部各自調用 `onSnapshot` 未取消訂閱，導致元件卸載後持續收到回呼並引發重複渲染。 | 一律集中在 `LeaveContext.tsx` 統一管理監聽器生命週期，在 `useEffect` 的 cleanup return 中嚴格調用 `unsubscribe()`。 |
| **💥 PDF 報表繁體中文在瀏覽器端亂碼** | 瀏覽器原生 PDFMake 未打包繁體中文字體。 | 已全面採用 `html2canvas` 擷取 DOM 渲染畫面 + `jspdf` 輸出，保證所見即所得，100% 繁體中文無亂碼。 |
| **💥 清空資料後選單找不到選項 Crash** | 使用者執行「清空資料」後，員工選單為空，自動化測試或選單選取時觸發 Timeout。 | 元件內部必須具備防禦性條件渲染（Defensive Rendering），對空陣列友善提示「目前無在職員工，請先新增」。 |

---

## 🛠️ 5. 常見任務標準作業程序 (Task Playbooks)

### 任務 A：如何調整特休年資天數計算規則？
1. 打開 `src/utils/leaveUtils.ts` 中的 `calculateAnnualLeave()`。
2. 調整對應的年資區間與給假天數。
3. 同步修改 `src/test/leaveUtils.test.ts` 中的單元測試用例。
4. 執行 `npm test -- --run` 確認全部 PASS。

### 任務 B：如何新增自訂名目快捷標籤？
1. 打開 `src/components/LeaveInputV2.tsx`。
2. 找到 `CustomLeaveModal` 內部的 `quickTitles` 陣列：
   ```ts
   const quickTitles = ['颱風假補償', '加班補休', '值班津貼折抵', '專案獎勵', '事假扣除', '生理假折抵', '特殊排休', '你的新名目'];
   ```
3. 儲存後執行 `npm run build` 確認編譯成功。

### 任務 C：如何手動部署至 GitHub Pages？
1. 確保所有改動已通過 `npm run build` 與 `npm test -- --run`。
2. 執行 Git Commit（使用繁體中文 Commit 訊息）：
   ```bash
   git add .
   git commit -m "feat: 你的更新功能說明"
   git push origin master
   ```
3. GitHub Actions 會自動執行測試並部署至 GitHub Pages（約 40 秒完成）。

---

## 🏁 6. 完成工作驗收準則 (Definition of Done)

任何 Agent 在向使用者回報任務完成前，**必須達成以下 4 項指標**：
- [ ] 執行 `npm run build` 0 error，TypeScript 型別與 Vite 構建完全通過。
- [ ] 執行 `npm test -- --run`，19 項單元測試全數 PASS。
- [ ] 遵守繁體中文規範：所有回覆、思考、程式碼註解、Commit Message 皆使用繁體中文。
- [ ] 安全合規：確認無任何 API Key 或敏感資訊被 hardcode 或提交至 Git。
