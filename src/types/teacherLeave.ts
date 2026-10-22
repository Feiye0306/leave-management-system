export interface SpecialItem {
  id: string;
  type: 'addition' | 'deduction';
  title: string;       // 如 "上課補假 (待補)", "英檢班 (待紀錄)"
  datesText: string;   // 如 "9/1、9/8、9/15" 或 "待補"
  days: number;        // 天數數值，如 1, 0.5, 0.75
}

export interface TeacherMonthlyRecord {
  id: string;
  name: string;
  hireDate: string;                    // 如 "2016/01/01"
  scheduleType: 'mon_only' | 'weekend2' | 'custom'; // 週休一日(週一) / 週休二日 / 自訂
  customBaseDays?: number;

  // 排休明細
  leaveDaysText: string;               // 如 "9/5、9/12、9/19、9/26\n9/3(病假)"
  actualLeaveCount: number;            // 實休天數

  // 加項與扣項
  additions: SpecialItem[];            // 上課補假等
  deductions: SpecialItem[];           // 英檢班等

  // 備註節日 (如 9/26(中秋節)；9/28(教師節))
  holidayNotes?: string;

  // 特休
  annualRange: string;                 // 如 "20260101~20261231"
  annualRemaining: number;             // 如 15

  // 跨月排休未休累計
  previousBalance: number;             // 上月排休未休累計 (如 2.25)
  monthlyBalanceManual?: number;       // 手動覆蓋本月餘假 (可選)
  accumulatedBalanceManual?: number;   // 手動覆蓋未休小計 (可選)

  note?: string;
}

export interface HolidayItem {
  id: string;
  name: string;       // 如 "中秋節", "教師節"
  dateText: string;   // 如 "9/26", "9/28"
  days: number;       // 加假天數 (通常為 0 或 1)
}

export interface MonthlyLeaveData {
  year: number;
  month: number;
  mondaysCount: number;
  holidays: HolidayItem[];
  teachers: TeacherMonthlyRecord[];
}
