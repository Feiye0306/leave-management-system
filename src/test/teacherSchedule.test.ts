import { describe, it, expect } from 'vitest';
import {
  getMondaysInMonth,
  getMonthDays,
  calculateTeacherAttendance,
  generateGroupNoteText,
  formatDaysList,
  INITIAL_SCHEDULE_DATA
} from '../utils/teacherScheduleEngine';

describe('全職老師日曆排休與算式引擎 (Teacher Schedule Engine Tests)', () => {
  it('應準確計算 2026 年 8 月有 5 個週一，9 月有 4 個週一', () => {
    expect(getMondaysInMonth(2026, 8)).toBe(5);
    expect(getMondaysInMonth(2026, 9)).toBe(4);
  });

  it('應依「週一數 × 週休天數」算出法定應休假期 (核心公式)', () => {
    const s9 = INITIAL_SCHEDULE_DATA['2026-09'];
    // 9 月有 4 個週一
    expect(s9.mondaysCount).toBe(4);

    // 王暉宇: 週休 1 -> 4 * 1 = 4 天
    const why = s9.teachers.find(t => t.id === 'wang_hy')!;
    const whyCalc = calculateTeacherAttendance(why, s9.attendance['wang_hy'], s9.mondaysCount);
    expect(whyCalc.baseQuota).toBe(4);
    // 實休: 9/5, 9/12, 9/19, 9/26 (4天排休) + 9/3 (1天病假) = 5天
    expect(whyCalc.leaveCount + whyCalc.sickCount).toBe(5);
    // 餘假: 4 - 5 = -1 天
    expect(whyCalc.monthlyBalance).toBe(-1);
    // 未休累積: 上月 2.25 + (-1) = 1.25 天
    expect(whyCalc.accumulatedBalance).toBe(1.25);

    // 徐子翔: 週休 2 -> 4 * 2 = 8 天
    const xzx = s9.teachers.find(t => t.id === 'xu_zx')!;
    const xzxCalc = calculateTeacherAttendance(xzx, s9.attendance['xu_zx'], s9.mondaysCount);
    expect(xzxCalc.baseQuota).toBe(8);
    // 實休: 9/3, 9/10, 9/15, 9/16, 9/17 = 5天
    expect(xzxCalc.leaveCount).toBe(5);
    // 餘假: 8 - 5 = +3 天
    expect(xzxCalc.monthlyBalance).toBe(3);
    // 未休累積: 上月 10.5 + 3 = 13.5 天
    expect(xzxCalc.accumulatedBalance).toBe(13.5);

    // 孫郁淇: 週休 1 -> 4 * 1 = 4 天
    const syq = s9.teachers.find(t => t.id === 'sun_yq')!;
    const syqCalc = calculateTeacherAttendance(syq, s9.attendance['sun_yq'], s9.mondaysCount);
    expect(syqCalc.baseQuota).toBe(4);
    // 實休: 9/10 (1天) + 9/27 (1天病假) = 2天
    expect(syqCalc.leaveCount + syqCalc.sickCount).toBe(2);
    // 英檢班扣假: 5次 * 0.25 = 1.25天
    expect(syqCalc.geptDeduction).toBe(1.25);
    // 餘假: 4 - 2 - 1.25 = +0.75 天
    expect(syqCalc.monthlyBalance).toBe(0.75);
    // 未休累積: 上月 -11.0 + 0.75 = -10.25 天
    expect(syqCalc.accumulatedBalance).toBe(-10.25);
  });

  it('formatDaysList 應正確格式化連續日期 (如 9/15~17)', () => {
    expect(formatDaysList(9, [5, 12, 19, 26])).toBe('9/5、9/12、9/19、9/26');
    expect(formatDaysList(9, [3, 10, 15, 16, 17])).toBe('9/3、9/10、9/15~17');
  });

  it('generateGroupNoteText 應生成符合截圖格式的標準記事本', () => {
    const s9 = INITIAL_SCHEDULE_DATA['2026-09'];
    const note = generateGroupNoteText(s9);

    expect(note).toContain('2026 9月 🕤本月4️⃣個週一');
    expect(note).toContain('【王暉宇】入職日2016/01/01');
    expect(note).toContain('▶️ ➖ 排休\n9/5、9/12、9/19、9/26');
    expect(note).toContain('9/3(病假)');
    expect(note).toContain('9/26(中秋節)；9/28(教師節)');
    expect(note).toContain('⭕本月餘假 -1');
    expect(note).toContain('┗🌞每月排休未休小計 共 1.25 天');

    expect(note).toContain('【徐子翔】入職日2026/7/15 週休 2');
    expect(note).toContain('9/3、9/10、9/15~17');
    expect(note).toContain('⭕本月餘假 +3');
    expect(note).toContain('┗🌞每月排休未休小計 共 13.5 天');
  });
});
