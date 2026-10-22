import type {
  MonthlyCalendarState,
  TeacherRosterProfile,
  TeacherMonthAttendance
} from '../types/teacherSchedule';
import {
  DAY_STATUS_CONFIGS
} from '../types/teacherSchedule';

/**
 * 台灣常用法定國定假日與補習班關注節日對照表 (2025~2027)
 */
export const TAIWAN_HOLIDAYS_MAP: Record<string, Record<number, string>> = {
  '2025-01': { 1: '元旦', 27: '小年夜', 28: '除夕', 29: '春節' },
  '2025-02': { 28: '和平紀念日' },
  '2025-04': { 4: '兒童節', 5: '清明節' },
  '2025-05': { 1: '勞動節', 31: '端午節' },
  '2025-09': { 28: '教師節' },
  '2025-10': { 6: '中秋節', 10: '國慶日' },
  '2026-01': { 1: '元旦' },
  '2026-02': { 16: '除夕', 17: '春節', 28: '和平紀念日' },
  '2026-04': { 4: '兒童節', 5: '清明節' },
  '2026-05': { 1: '勞動節' },
  '2026-06': { 19: '端午節' },
  '2026-09': { 26: '中秋節', 28: '教師節' },
  '2026-10': { 10: '國慶日' },
  '2027-01': { 1: '元旦' },
  '2027-02': { 5: '除夕', 6: '春節', 28: '和平紀念日' },
  '2027-04': { 4: '兒童節', 5: '清明節' },
  '2027-05': { 1: '勞動節' },
  '2027-06': { 9: '端午節' },
  '2027-09': { 15: '中秋節', 28: '教師節' },
  '2027-10': { 10: '國慶日' },
};

/**
 * 自動取得指定年月份的官方預設國定假日
 */
export function getDefaultHolidays(year: number, month: number): Record<number, string> {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return { ...(TAIWAN_HOLIDAYS_MAP[key] || {}) };
}

/**
 * 計算指定年月中有幾個週一
 */
export function getMondaysInMonth(year: number, month: number): number {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === 1) { // 1 = 週一
      count++;
    }
  }
  return count;
}

/**
 * 取得指定月份所有日期基本資訊
 */
export interface MonthDayInfo {
  day: number;
  dayOfWeek: number; // 0=日, 1=一, ..., 6=六
  isMonday: boolean;
  isWeekend: boolean;
  holidayName?: string;
}

export function getMonthDays(year: number, month: number, holidays: Record<number, string> = {}): MonthDayInfo[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: MonthDayInfo[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay();
    result.push({
      day: d,
      dayOfWeek,
      isMonday: dayOfWeek === 1,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      holidayName: holidays[d]
    });
  }

  return result;
}

/**
 * 根據日曆排休標記，精算老師當月所有休假指標
 */
export interface TeacherCalculationResult {
  baseQuota: number;          // 當月應休天數 = 週一數 × 週休天數
  leaveDays: number[];        // 排休日期陣列 (如 [5, 12, 19, 26])
  sickDays: number[];         // 病假日期陣列 (如 [3])
  makeUpDays: number[];       // 上課補假日期陣列 (如 [5, 12, 19])
  geptDays: number[];         // 英檢班日期陣列 (如 [1, 8, 15, 22, 29])
  
  leaveCount: number;         // 排休天數
  sickCount: number;          // 病假天數
  makeUpCount: number;        // 補假天數 (+項)
  geptDeduction: number;      // 英檢班扣除天數 (-項，每次0.25)
  
  monthlyBalance: number;     // 本月餘假 = 應休 + 補假 - 排休 - 病假 - 英檢班扣假
  accumulatedBalance: number; // 本月排休未休小計 = 上月未休累計 + 本月餘假
}

export function calculateTeacherAttendance(
  teacher: TeacherRosterProfile,
  attendance: TeacherMonthAttendance | undefined,
  mondaysCount: number
): TeacherCalculationResult {
  // 核心公式：應休天數 = 週一數 × 週休天數
  const baseQuota = mondaysCount * teacher.weeklyDaysOff;

  const dayMarks = attendance?.dayMarks || {};
  const leaveDays: number[] = [];
  const sickDays: number[] = [];
  const makeUpDays: number[] = [];
  const geptDays: number[] = [];

  Object.entries(dayMarks).forEach(([dStr, status]) => {
    const day = parseInt(dStr, 10);
    if (status === 'leave') leaveDays.push(day);
    else if (status === 'sick') sickDays.push(day);
    else if (status === 'make_up') makeUpDays.push(day);
    else if (status === 'gept') geptDays.push(day);
  });

  leaveDays.sort((a, b) => a - b);
  sickDays.sort((a, b) => a - b);
  makeUpDays.sort((a, b) => a - b);
  geptDays.sort((a, b) => a - b);

  const leaveCount = leaveDays.length;
  const sickCount = sickDays.length;
  const makeUpCount = makeUpDays.length;
  const geptDeduction = Number((geptDays.length * DAY_STATUS_CONFIGS.gept.weight).toFixed(2));

  // 本月餘假 = 應休 + 補假 - 實排 - 病假 - 英檢扣除
  const monthlyBalance = Number((baseQuota + makeUpCount - leaveCount - sickCount - geptDeduction).toFixed(2));

  // 跨月累積未休小計 = 上月未休累計 + 本月餘假
  const accumulatedBalance = Number((teacher.previousBalance + monthlyBalance).toFixed(2));

  return {
    baseQuota,
    leaveDays,
    sickDays,
    makeUpDays,
    geptDays,
    leaveCount,
    sickCount,
    makeUpCount,
    geptDeduction,
    monthlyBalance,
    accumulatedBalance
  };
}

/**
 * 自動將日曆排休結果轉換為 LINE 群組標準記事本格式
 */
export function generateGroupNoteText(state: MonthlyCalendarState): string {
  const numEmojiMap: Record<number, string> = {
    1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣', 6: '6️⃣'
  };
  const countEmoji = numEmojiMap[state.mondaysCount] || `${state.mondaysCount}️⃣`;

  const lines: string[] = [];
  lines.push(`${state.year} ${state.month}月 🕤本月${countEmoji}個週一\n`);

  state.teachers.forEach((teacher) => {
    const att = state.attendance[teacher.id];
    const calc = calculateTeacherAttendance(teacher, att, state.mondaysCount);

    const scheduleLabel = teacher.scheduleNote ? ` ${teacher.scheduleNote}` : (teacher.weeklyDaysOff > 1 ? ` 週休 ${teacher.weeklyDaysOff}` : '');
    lines.push(`【${teacher.name}】入職日${teacher.hireDate}${scheduleLabel}`);

    // ▶️ ➖ 排休
    lines.push('▶️ ➖ 排休');
    if (calc.leaveDays.length > 0) {
      // 支援連續區間格式化 (如 15,16,17 轉為 9/15~17)
      const formattedLeave = formatDaysList(state.month, calc.leaveDays);
      lines.push(formattedLeave);
    } else {
      lines.push('無');
    }

    // 病假
    if (calc.sickDays.length > 0) {
      lines.push(`${state.month}/${calc.sickDays.join(`、${state.month}/`)}(病假)`);
    }

    // 國定假日備註 (若當月有紅字且有排假)
    const holidaysList = Object.entries(state.holidays).map(([d, name]) => `${state.month}/${d}(${name})`);
    if (holidaysList.length > 0) {
      lines.push('');
      lines.push(holidaysList.join('；'));
    }

    // 英檢班扣假 (▶️ ➖ 英檢班)
    if (calc.geptDays.length > 0) {
      lines.push('');
      lines.push('▶️ ➖ 英檢班 (待紀錄)');
      lines.push(formatDaysList(state.month, calc.geptDays));
    }

    // 上課補假 (▶️ ➕ 上課補假)
    lines.push('');
    if (calc.makeUpDays.length > 0) {
      lines.push('▶️ ➕ 上課補假');
      lines.push(formatDaysList(state.month, calc.makeUpDays));
    } else {
      lines.push('▶️ ➕ 上課補假 (待補)');
    }

    // 本月餘假
    const sign = calc.monthlyBalance > 0 ? '+' : '';
    lines.push('');
    lines.push('----');
    lines.push(`⭕本月餘假 ${sign}${calc.monthlyBalance}`);
    lines.push('----');
    lines.push('');

    // 假期累積紀錄
    lines.push('✅假期累積紀錄 (已含本月)');
    lines.push('丨');

    if (teacher.annualRemaining > 0 || teacher.annualRange) {
      const rangeStr = teacher.annualRange ? `${teacher.annualRange} ` : '';
      lines.push(`┣🥳${rangeStr}特休剩 ${teacher.annualRemaining} 天`);
    } else {
      lines.push('┣🥳');
    }
    lines.push('丨');

    lines.push(`┗🌞每月排休未休小計 共 ${calc.accumulatedBalance} 天`);
    lines.push('\n');
  });

  return lines.join('\n').trim();
}

/**
 * 輔助函式：將日期陣列格式化為「9/5、9/12」或連續區間「9/15~17」
 */
export function formatDaysList(month: number, days: number[]): string {
  if (days.length === 0) return '';
  const sorted = [...days].sort((a, b) => a - b);
  const parts: string[] = [];

  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) {
      end = sorted[i + 1];
      i++;
    }

    if (end > start + 1) {
      // 3天或以上連續天數，如 9/15~17
      parts.push(`${month}/${start}~${end}`);
    } else if (end === start + 1) {
      // 2天連續
      parts.push(`${month}/${start}`);
      parts.push(`${month}/${end}`);
    } else {
      parts.push(`${month}/${start}`);
    }
    i++;
  }

  return parts.join('、');
}

/**
 * 預設系統歷史狀態（8 月與 9 月真實點擊日曆資料）
 */
export const INITIAL_SCHEDULE_DATA: Record<string, MonthlyCalendarState> = {
  '2026-08': {
    year: 2026,
    month: 8,
    mondaysCount: 5,
    holidays: {},
    teachers: [
      {
        id: 'wang_hy',
        name: '王暉宇',
        hireDate: '2016/01/01',
        weeklyDaysOff: 1, // 週休1天 = 5*1 = 5天
        annualRange: '20260101~20261231',
        annualRemaining: 15,
        previousBalance: 2.25
      },
      {
        id: 'sun_yq',
        name: '孫郁淇',
        hireDate: '2024/03/01',
        weeklyDaysOff: 1, // 週休1天 = 5*1 = 5天
        annualRange: '20260301~20270228',
        annualRemaining: 10,
        previousBalance: -11.5
      },
      {
        id: 'lin_yl',
        name: '林詠倫',
        hireDate: '2024/10/23',
        weeklyDaysOff: 1, // 週休1天 = 5*1 = 5天
        annualRange: '20251023~20261022',
        annualRemaining: 7,
        previousBalance: 6.25
      },
      {
        id: 'xu_zx',
        name: '徐子翔',
        hireDate: '2026/7/15',
        weeklyDaysOff: 1.7, // 5*1.7 = 8.5天
        scheduleNote: '週休 2',
        annualRange: '',
        annualRemaining: 0,
        previousBalance: 2.0
      }
    ],
    attendance: {
      wang_hy: {
        teacherId: 'wang_hy',
        dayMarks: { 1: 'leave', 8: 'leave', 15: 'leave', 22: 'leave', 29: 'leave' } // 5天排休
      },
      sun_yq: {
        teacherId: 'sun_yq',
        dayMarks: { 2: 'leave', 17: 'leave', 23: 'leave', 25: 'leave', 4: 'gept', 11: 'gept' } // 4天排休+2次英檢(0.5)
      },
      lin_yl: {
        teacherId: 'lin_yl',
        dayMarks: { 1: 'leave', 23: 'leave', 30: 'leave' } // 3天排休
      },
      xu_zx: {
        teacherId: 'xu_zx',
        dayMarks: { 6: 'leave', 20: 'leave', 26: 'leave', 5: 'make_up', 12: 'make_up', 19: 'make_up' } // 3天排休+3天補假
      }
    }
  },
  '2026-09': {
    year: 2026,
    month: 9,
    mondaysCount: 4,
    holidays: { 26: '中秋節', 28: '教師節' },
    teachers: [
      {
        id: 'wang_hy',
        name: '王暉宇',
        hireDate: '2016/01/01',
        weeklyDaysOff: 1, // 4*1 = 4天
        annualRange: '20260101~20261231',
        annualRemaining: 15,
        previousBalance: 2.25 // 8月未休累積 2.25
      },
      {
        id: 'sun_yq',
        name: '孫郁淇',
        hireDate: '2024/03/01',
        weeklyDaysOff: 1, // 4*1 = 4天
        annualRange: '20260301~20270228',
        annualRemaining: 10,
        previousBalance: -11.0 // 8月未休累積 -11.0
      },
      {
        id: 'lin_yl',
        name: '林詠倫',
        hireDate: '2024/10/23',
        weeklyDaysOff: 1, // 4*1 = 4天
        annualRange: '20251023~20261022',
        annualRemaining: 7,
        previousBalance: 8.25 // 8月未休累積 8.25
      },
      {
        id: 'xu_zx',
        name: '徐子翔',
        hireDate: '2026/7/15',
        weeklyDaysOff: 2, // 4*2 = 8天
        scheduleNote: '週休 2',
        annualRange: '',
        annualRemaining: 0,
        previousBalance: 10.5 // 8月未休累積 10.5
      }
    ],
    attendance: {
      wang_hy: {
        teacherId: 'wang_hy',
        dayMarks: { 5: 'leave', 12: 'leave', 19: 'leave', 26: 'leave', 3: 'sick' } // 4天排休+1天病假=5天實休 -> 4-5 = -1
      },
      sun_yq: {
        teacherId: 'sun_yq',
        dayMarks: { 10: 'leave', 27: 'sick', 1: 'gept', 8: 'gept', 15: 'gept', 22: 'gept', 29: 'gept' } // 1排休+1病假+5英檢(1.25) -> 4-1-1-1.25 = +0.75
      },
      lin_yl: {
        teacherId: 'lin_yl',
        dayMarks: { 6: 'leave', 13: 'leave', 20: 'leave', 27: 'leave' } // 4天排休 -> 4-4 = 0
      },
      xu_zx: {
        teacherId: 'xu_zx',
        dayMarks: { 3: 'leave', 10: 'leave', 15: 'leave', 16: 'leave', 17: 'leave' } // 5天排休 (9/15~17連休) -> 8-5 = +3
      }
    }
  }
};
