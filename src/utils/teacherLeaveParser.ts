import type { MonthlyLeaveData, TeacherMonthlyRecord, SpecialItem, HolidayItem } from '../types/teacherLeave';

/**
 * 計算指定年月中有幾個週一
 */
export function countMondays(year: number, month: number): number {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getDay() === 1) { // 1 代表週一
      count++;
    }
  }
  return count;
}

/**
 * 格式化單一老師的本月餘假與未休小計
 */
export function calculateTeacherBalances(
  record: TeacherMonthlyRecord,
  mondaysCount: number,
  holidays: HolidayItem[]
): {
  baseQuota: number;
  totalAdditions: number;
  totalDeductions: number;
  monthlyBalance: number;
  accumulatedBalance: number;
} {
  // 基準額度
  let baseQuota = mondaysCount;
  if (record.customBaseDays !== undefined) {
    baseQuota = record.customBaseDays;
  } else if (record.scheduleType === 'weekend2') {
    baseQuota = mondaysCount * 2;
  }

  // 加項總和 (如補假)
  const totalAdditions = record.additions.reduce((sum, item) => sum + (Number(item.days) || 0), 0);

  // 扣項總和 (如英檢班)
  const totalDeductions = record.deductions.reduce((sum, item) => sum + (Number(item.days) || 0), 0);

  // 國定假日補償加假 (如有設定)
  const totalHolidayBonus = holidays.reduce((sum, h) => sum + (Number(h.days) || 0), 0);

  // 本月餘假：若有手動覆蓋值則優先使用，否則依公式計算
  let monthlyBalance = record.monthlyBalanceManual !== undefined
    ? record.monthlyBalanceManual
    : Number((baseQuota + totalHolidayBonus + totalAdditions - record.actualLeaveCount - totalDeductions).toFixed(2));

  // 本月累積未休小計：上月累計 + 本月餘假
  let accumulatedBalance = record.accumulatedBalanceManual !== undefined
    ? record.accumulatedBalanceManual
    : Number((record.previousBalance + monthlyBalance).toFixed(2));

  return {
    baseQuota,
    totalAdditions,
    totalDeductions,
    monthlyBalance,
    accumulatedBalance,
  };
}

/**
 * 將月度資料格式化為標準 LINE 群組記事本文字
 */
export function formatToNoteText(data: MonthlyLeaveData): string {
  const lines: string[] = [];

  // 表頭例如: 2026 9月 🕤本月4️⃣個週一
  const numEmojiMap: Record<number, string> = {
    1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣', 6: '6️⃣'
  };
  const countEmoji = numEmojiMap[data.mondaysCount] || `${data.mondaysCount}`;
  lines.push(`${data.year} ${data.month}月 🕤本月${countEmoji}個週一\n`);

  // 各老師區塊
  data.teachers.forEach((teacher) => {
    // 週休標記
    const scheduleLabel = teacher.scheduleType === 'weekend2' ? ' 週休 2' : '';
    lines.push(`【${teacher.name}】入職日${teacher.hireDate}${scheduleLabel}`);

    // ▶️ ➖ 排休
    lines.push('▶️ ➖ 排休');
    if (teacher.leaveDaysText) {
      lines.push(teacher.leaveDaysText.trim());
    } else {
      lines.push('無');
    }

    // 國定假日備註
    if (teacher.holidayNotes) {
      lines.push('');
      lines.push(teacher.holidayNotes.trim());
    }

    // 加項 (如上課補假)
    if (teacher.additions && teacher.additions.length > 0) {
      teacher.additions.forEach((add) => {
        lines.push('');
        lines.push(`▶️ ➕ ${add.title}`);
        if (add.datesText) {
          lines.push(add.datesText.trim());
        }
      });
    }

    // 扣項 (如英檢班)
    if (teacher.deductions && teacher.deductions.length > 0) {
      teacher.deductions.forEach((ded) => {
        lines.push('');
        lines.push(`▶️ ➖ ${ded.title}`);
        if (ded.datesText) {
          lines.push(ded.datesText.trim());
        }
      });
    }

    // 本月餘假試算
    const { monthlyBalance, accumulatedBalance } = calculateTeacherBalances(
      teacher,
      data.mondaysCount,
      data.holidays
    );

    const sign = monthlyBalance > 0 ? '+' : '';
    lines.push('----');
    lines.push(`⭕本月餘假 ${sign}${monthlyBalance}`);
    lines.push('----');
    lines.push('');

    // 假期累積紀錄
    lines.push('✅假期累積紀錄 (已含本月)');
    lines.push('丨');

    // 特休
    if (teacher.annualRemaining > 0 || teacher.annualRange) {
      const rangeStr = teacher.annualRange ? `${teacher.annualRange} ` : '';
      lines.push(`┣🥳${rangeStr}特休剩 ${teacher.annualRemaining} 天`);
    } else {
      lines.push('┣🥳');
    }
    lines.push('丨');

    // 未休小計
    lines.push(`┗🌞每月排休未休小計 共 ${accumulatedBalance} 天`);
    lines.push('\n');
  });

  return lines.join('\n').trim();
}

/**
 * 智能解析群組記事本貼文文字 (Parser)
 */
export function parseNoteText(rawText: string): MonthlyLeaveData {
  // 1. 預設年月與週一數
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  let mondaysCount = 4;

  const headerMatch = rawText.match(/(\d{4})\s*年?\s*(\d{1,2})\s*月.*?(?:本月\s*(\d+|[1-9]️⃣)\s*個週一)?/);
  if (headerMatch) {
    if (headerMatch[1]) year = parseInt(headerMatch[1], 10);
    if (headerMatch[2]) month = parseInt(headerMatch[2], 10);
    if (headerMatch[3]) {
      const rawNum = headerMatch[3].replace(/[^\d]/g, '');
      mondaysCount = parseInt(rawNum, 10) || countMondays(year, month);
    } else {
      mondaysCount = countMondays(year, month);
    }
  }

  // 2. 切割各老師區塊（依據【姓名】切割）
  const teachers: TeacherMonthlyRecord[] = [];
  const teacherBlocks = rawText.split(/【(?=[^】]+】)/g).filter(b => b.trim());

  teacherBlocks.forEach((block, idx) => {
    // 檢查區塊開頭是否有姓名
    const titleMatch = block.match(/^([^】]+)】\s*入職日\s*([0-9\/\-]+)(\s*週休\s*(\d+))?/);
    if (!titleMatch) return;

    const name = titleMatch[1].trim();
    const hireDate = titleMatch[2].trim();
    const isWeekend2 = titleMatch[3] ? titleMatch[3].includes('2') : false;

    // 排休區塊
    let leaveDaysText = '';
    const leaveMatch = block.match(/▶️\s*➖\s*排休\s*([\s\S]*?)(?=(?:▶️|----|9\/\d+|中秋|教師))/);
    if (leaveMatch) {
      leaveDaysText = leaveMatch[1].trim();
    }

    // 國定假日或病假備註
    let holidayNotes = '';
    const holidayMatch = block.match(/(\d{1,2}\/\d{1,2}\([^)]+\)[^▶️\n\-]*)/);
    if (holidayMatch) {
      holidayNotes = holidayMatch[1].trim();
    }

    // 補假加項 (▶️ ➕)
    const additions: SpecialItem[] = [];
    const addMatches = [...block.matchAll(/▶️\s*➕\s*([^\n]+)\n?([\s\S]*?)(?=(?:▶️|----|✅|$))/g)];
    addMatches.forEach((m, aIdx) => {
      const addTitle = m[1].trim();
      const addDates = (m[2] || '').trim();
      // 試探日期個數計算天數
      const dateItems = addDates.split(/[、,，\n]+/).filter(Boolean);
      const days = dateItems.length > 0 ? dateItems.length : 0;
      additions.push({
        id: `add_${idx}_${aIdx}`,
        type: 'addition',
        title: addTitle,
        datesText: addDates,
        days: days || 0
      });
    });

    // 扣假減項 (除排休外的 ▶️ ➖)
    const deductions: SpecialItem[] = [];
    const dedMatches = [...block.matchAll(/▶️\s*➖\s*(?!排休)([^\n]+)\n?([\s\S]*?)(?=(?:▶️|----|✅|$))/g)];
    dedMatches.forEach((m, dIdx) => {
      const dedTitle = m[1].trim();
      const dedDates = (m[2] || '').trim();
      // 試探扣假天數
      deductions.push({
        id: `ded_${idx}_${dIdx}`,
        type: 'deduction',
        title: dedTitle,
        datesText: dedDates,
        days: 0 // 可在 UI 中精準編輯
      });
    });

    // 本月餘假
    let monthlyBalanceManual: number | undefined;
    const balanceMatch = block.match(/⭕本月餘假\s*([+\-]?[0-9.]+)/);
    if (balanceMatch) {
      monthlyBalanceManual = parseFloat(balanceMatch[1]);
    }

    // 特休
    let annualRange = '';
    let annualRemaining = 0;
    const annualMatch = block.match(/┣🥳\s*(\d{8}~\d{8})?\s*特休剩\s*(\d+)\s*天/);
    if (annualMatch) {
      annualRange = annualMatch[1] || '';
      annualRemaining = parseInt(annualMatch[2], 10) || 0;
    }

    // 每月排休未休小計
    let accumulatedBalanceManual: number | undefined;
    const accMatch = block.match(/┗🌞每月排休未休小計\s*共\s*([+\-]?[0-9.]+)\s*天/);
    if (accMatch) {
      accumulatedBalanceManual = parseFloat(accMatch[1]);
    }

    // 計算粗略實休天數
    const leaveItems = leaveDaysText.split(/[、,，\n]+/).filter(Boolean);
    let estimatedLeaveCount = leaveItems.length;
    // 檢查波浪號區間例如 9/15~17 算 3 天
    leaveItems.forEach(item => {
      const rangeM = item.match(/(\d+)\/(\d+)~(\d+)/);
      if (rangeM) {
        const start = parseInt(rangeM[2], 10);
        const end = parseInt(rangeM[3], 10);
        if (end > start) {
          estimatedLeaveCount += (end - start);
        }
      }
    });

    teachers.push({
      id: `teacher_${Date.now()}_${idx}`,
      name,
      hireDate,
      scheduleType: isWeekend2 ? 'weekend2' : 'mon_only',
      leaveDaysText,
      actualLeaveCount: estimatedLeaveCount,
      additions,
      deductions,
      holidayNotes,
      annualRange,
      annualRemaining,
      previousBalance: (accumulatedBalanceManual !== undefined && monthlyBalanceManual !== undefined)
        ? Number((accumulatedBalanceManual - monthlyBalanceManual).toFixed(2))
        : 0,
      monthlyBalanceManual,
      accumulatedBalanceManual
    });
  });

  return {
    year,
    month,
    mondaysCount,
    holidays: [
      { id: 'h1', name: '中秋節', dateText: '9/26', days: 0 },
      { id: 'h2', name: '教師節', dateText: '9/28', days: 0 }
    ],
    teachers
  };
}

/**
 * 系統種子資料（使用者截圖中真實的 8 月與 9 月紀錄）
 */
export const SEED_DATA: Record<string, MonthlyLeaveData> = {
  '2026-08': {
    year: 2026,
    month: 8,
    mondaysCount: 5,
    holidays: [],
    teachers: [
      {
        id: 'wang_hy',
        name: '王暉宇',
        hireDate: '2016/01/01',
        scheduleType: 'mon_only',
        leaveDaysText: '8/1、8/8、8/15、8/22、8/29',
        actualLeaveCount: 5,
        additions: [
          { id: 'add_why_8', type: 'addition', title: '上課補假 (待補)', datesText: '', days: 0 }
        ],
        deductions: [],
        annualRange: '20260101~20261231',
        annualRemaining: 15,
        previousBalance: 2.25,
        monthlyBalanceManual: 0,
        accumulatedBalanceManual: 2.25
      },
      {
        id: 'sun_yq',
        name: '孫郁淇',
        hireDate: '2024/03/01',
        scheduleType: 'mon_only',
        leaveDaysText: '8/2、8/17、8/23、8/25',
        actualLeaveCount: 4,
        additions: [],
        deductions: [
          { id: 'ded_syq_8', type: 'deduction', title: '英檢班 (待紀錄)', datesText: '8/4、8/11', days: 0.5 }
        ],
        annualRange: '20260301~20270228',
        annualRemaining: 10,
        previousBalance: -11.5,
        monthlyBalanceManual: 0.5,
        accumulatedBalanceManual: -11.0
      },
      {
        id: 'lin_yl',
        name: '林詠倫',
        hireDate: '2024/10/23',
        scheduleType: 'mon_only',
        leaveDaysText: '8/1、8/23、8/30',
        actualLeaveCount: 3,
        additions: [
          { id: 'add_lyl_8', type: 'addition', title: '上課補假 (待補)', datesText: '', days: 0 }
        ],
        deductions: [],
        annualRange: '20251023~20261022',
        annualRemaining: 7,
        previousBalance: 6.25,
        monthlyBalanceManual: 2,
        accumulatedBalanceManual: 8.25
      },
      {
        id: 'xu_zx',
        name: '徐子翔',
        hireDate: '2026/07/15',
        scheduleType: 'weekend2',
        customBaseDays: 8.5,
        leaveDaysText: '8/6、8/20、8/26',
        actualLeaveCount: 3,
        additions: [
          { id: 'add_xzx_8', type: 'addition', title: '上課補假 (待補)', datesText: '8/5，8/12，8/19', days: 3 }
        ],
        deductions: [],
        annualRange: '',
        annualRemaining: 0,
        previousBalance: 2.0,
        monthlyBalanceManual: 8.5,
        accumulatedBalanceManual: 10.5
      }
    ]
  },
  '2026-09': {
    year: 2026,
    month: 9,
    mondaysCount: 4,
    holidays: [
      { id: 'h_midautumn', name: '中秋節', dateText: '9/26', days: 0 },
      { id: 'h_teachers', name: '教師節', dateText: '9/28', days: 0 }
    ],
    teachers: [
      {
        id: 'wang_hy',
        name: '王暉宇',
        hireDate: '2016/01/01',
        scheduleType: 'mon_only',
        leaveDaysText: '9/5、9/12、9/19、9/26\n9/3(病假)',
        actualLeaveCount: 5,
        holidayNotes: '9/26(中秋節)；9/28(教師節)',
        additions: [
          { id: 'add_why_9', type: 'addition', title: '上課補假 (待補)', datesText: '', days: 0 }
        ],
        deductions: [],
        annualRange: '20260101~20261231',
        annualRemaining: 15,
        previousBalance: 2.25,
        monthlyBalanceManual: -1,
        accumulatedBalanceManual: 1.25
      },
      {
        id: 'sun_yq',
        name: '孫郁淇',
        hireDate: '2024/03/01',
        scheduleType: 'mon_only',
        leaveDaysText: '9/10、\n9/27(病假)',
        actualLeaveCount: 2,
        holidayNotes: '9/26(中秋節)；9/28(教師節)',
        additions: [],
        deductions: [
          { id: 'ded_syq_9', type: 'deduction', title: '英檢班 (待紀錄)', datesText: '9/1、9/8、9/15、9/22、9/29', days: 1.25 }
        ],
        annualRange: '20260301~20270228',
        annualRemaining: 10,
        previousBalance: -11.0,
        monthlyBalanceManual: 0.75,
        accumulatedBalanceManual: -10.25
      },
      {
        id: 'lin_yl',
        name: '林詠倫',
        hireDate: '2024/10/23',
        scheduleType: 'mon_only',
        leaveDaysText: '9/6、9/13、9/20、9/27',
        actualLeaveCount: 4,
        holidayNotes: '9/26(中秋節)；9/28(教師節)',
        additions: [
          { id: 'add_lyl_9', type: 'addition', title: '上課補假 (待補)', datesText: '', days: 0 }
        ],
        deductions: [],
        annualRange: '20251023~20261022',
        annualRemaining: 7,
        previousBalance: 8.25,
        monthlyBalanceManual: 0,
        accumulatedBalanceManual: 8.25
      },
      {
        id: 'xu_zx',
        name: '徐子翔',
        hireDate: '2026/07/15',
        scheduleType: 'weekend2',
        leaveDaysText: '9/3、9/10、9/15~17',
        actualLeaveCount: 5,
        holidayNotes: '9/26(中秋節)；9/28(教師節)',
        additions: [
          { id: 'add_xzx_9', type: 'addition', title: '上課補假 (待補)', datesText: '', days: 0 }
        ],
        deductions: [],
        annualRange: '',
        annualRemaining: 0,
        previousBalance: 10.5,
        monthlyBalanceManual: 3,
        accumulatedBalanceManual: 13.5
      }
    ]
  }
};
