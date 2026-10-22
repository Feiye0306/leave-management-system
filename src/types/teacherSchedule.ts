// 假別標記類型
export type DayStatus = 'none' | 'leave' | 'sick' | 'make_up' | 'gept';

export interface DayStatusConfig {
  type: DayStatus;
  label: string;
  color: string;
  badgeClass: string;
  weight: number; // 扣除/增加天數權重
}

export const DAY_STATUS_CONFIGS: Record<DayStatus, DayStatusConfig> = {
  none: { type: 'none', label: '上班/無休', color: '#f1f5f9', badgeClass: 'bg-slate-100 text-slate-500', weight: 0 },
  leave: { type: 'leave', label: '排休', color: '#3b82f6', badgeClass: 'bg-blue-500 text-white', weight: 1.0 },
  sick: { type: 'sick', label: '病假', color: '#f97316', badgeClass: 'bg-orange-500 text-white', weight: 1.0 },
  make_up: { type: 'make_up', label: '上課補假 ➕', color: '#10b981', badgeClass: 'bg-emerald-500 text-white', weight: 1.0 },
  gept: { type: 'gept', label: '英檢班 ➖ (0.25天)', color: '#8b5cf6', badgeClass: 'bg-purple-500 text-white', weight: 0.25 },
};

export interface TeacherRosterProfile {
  id: string;
  name: string;
  hireDate: string;                  // 如 "2016/01/01"
  weeklyDaysOff: number;             // 週休幾天 (如 1 或 2)
  scheduleNote?: string;             // 如 "週休 2"
  annualRange: string;               // 特休年度 "20260101~20261231"
  annualRemaining: number;           // 特休剩餘天數 (如 15)
  previousBalance: number;           // 上月未休累計 (如 2.25)
}

export interface TeacherMonthAttendance {
  teacherId: string;
  // 每日狀態記錄，鍵值為日期字串 (例如 "2026-09-05" 或 "5"): DayStatus
  dayMarks: Record<number, DayStatus>;
  // 特殊手動備註 (如待補、待紀錄)
  customNotes?: string;
}

export interface MonthlyCalendarState {
  year: number;
  month: number;
  mondaysCount: number;              // 本月有幾個週一
  holidays: Record<number, string>;  // 國定假日 (例如 { 26: '中秋節', 28: '教師節' })
  teachers: TeacherRosterProfile[];
  attendance: Record<string, TeacherMonthAttendance>; // teacherId -> attendance
}
