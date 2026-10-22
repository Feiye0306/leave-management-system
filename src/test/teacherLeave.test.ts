import { describe, it, expect } from 'vitest';
import {
  countMondays,
  calculateTeacherBalances,
  formatToNoteText,
  parseNoteText,
  SEED_DATA
} from '../utils/teacherLeaveParser';
import type { TeacherMonthlyRecord, HolidayItem } from '../types/teacherLeave';

describe('全職老師月假算式與記事本 (Teacher Monthly Leave Tests)', () => {
  it('countMondays 應準確計算指定年月的週一數量', () => {
    // 2026 年 8 月有 5 個週一 (8/3, 8/10, 8/17, 8/24, 8/31)
    expect(countMondays(2026, 8)).toBe(5);
    // 2026 年 9 月有 4 個週一 (9/7, 9/14, 9/21, 9/28)
    expect(countMondays(2026, 9)).toBe(4);
    // 2026 年 10 月有 4 個週一
    expect(countMondays(2026, 10)).toBe(4);
  });

  it('calculateTeacherBalances 應準確計算單人本月餘假與未休累計', () => {
    const teacher: TeacherMonthlyRecord = {
      id: 'test_1',
      name: '王暉宇',
      hireDate: '2016/01/01',
      scheduleType: 'mon_only',
      leaveDaysText: '9/5、9/12、9/19、9/26\n9/3(病假)',
      actualLeaveCount: 5,
      additions: [],
      deductions: [],
      annualRange: '20260101~20261231',
      annualRemaining: 15,
      previousBalance: 2.25
    };

    const holidays: HolidayItem[] = [];
    const balances = calculateTeacherBalances(teacher, 4, holidays);

    // 應休 4 - 實休 5 = -1
    expect(balances.monthlyBalance).toBe(-1);
    // 累計: 上月 2.25 + (-1) = 1.25
    expect(balances.accumulatedBalance).toBe(1.25);
  });

  it('calculateTeacherBalances 應支援特殊補假與扣假', () => {
    const teacher: TeacherMonthlyRecord = {
      id: 'test_2',
      name: '徐子翔',
      hireDate: '2026/07/15',
      scheduleType: 'weekend2',
      customBaseDays: 8.5,
      leaveDaysText: '8/6、8/20、8/26',
      actualLeaveCount: 3,
      additions: [
        { id: 'a1', type: 'addition', title: '上課補假', datesText: '8/5, 8/12, 8/19', days: 3 }
      ],
      deductions: [],
      annualRange: '',
      annualRemaining: 0,
      previousBalance: 2.0
    };

    const balances = calculateTeacherBalances(teacher, 5, []);
    // 應休 8.5 + 補假 3 - 實休 3 = 8.5
    expect(balances.monthlyBalance).toBe(8.5);
    // 累計: 2.0 + 8.5 = 10.5
    expect(balances.accumulatedBalance).toBe(10.5);
  });

  it('formatToNoteText 應生成符合截圖格式的群組貼文', () => {
    const monthData = SEED_DATA['2026-09'];
    const formatted = formatToNoteText(monthData);

    expect(formatted).toContain('2026 9月 🕤本月4️⃣個週一');
    expect(formatted).toContain('【王暉宇】入職日2016/01/01');
    expect(formatted).toContain('▶️ ➖ 排休');
    expect(formatted).toContain('⭕本月餘假 -1');
    expect(formatted).toContain('┣🥳20260101~20261231 特休剩 15 天');
    expect(formatted).toContain('┗🌞每月排休未休小計 共 1.25 天');
    expect(formatted).toContain('【徐子翔】入職日2026/07/15 週休 2');
    expect(formatted).toContain('⭕本月餘假 +3');
    expect(formatted).toContain('┗🌞每月排休未休小計 共 13.5 天');
  });

  it('parseNoteText 應能反向解析截圖文字並還原結構化資料', () => {
    const rawNote = `2026 9月 🕤本月4️⃣個週一

【王暉宇】入職日2016/01/01
▶️ ➖ 排休
9/5、9/12、9/19、9/26
9/3(病假)

9/26(中秋節)；9/28(教師節)

▶️ ➕ 上課補假 (待補)

----
⭕本月餘假 -1
----

✅假期累積紀錄 (已含本月)
丨
┣🥳20260101~20261231 特休剩 15 天
丨
┗🌞每月排休未休小計 共 1.25 天`;

    const parsed = parseNoteText(rawNote);
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(9);
    expect(parsed.mondaysCount).toBe(4);
    expect(parsed.teachers.length).toBe(1);

    const teacher = parsed.teachers[0];
    expect(teacher.name).toBe('王暉宇');
    expect(teacher.hireDate).toBe('2016/01/01');
    expect(teacher.annualRemaining).toBe(15);
    expect(teacher.monthlyBalanceManual).toBe(-1);
    expect(teacher.accumulatedBalanceManual).toBe(1.25);
  });
});
