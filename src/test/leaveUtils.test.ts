import { describe, it, expect } from 'vitest';
import { calculateAnnualLeave, calculateAvailable } from '../utils/leaveUtils';

describe('leaveUtils.ts - 假別計算與餘額公式測試', () => {
    describe('calculateAnnualLeave - 台灣勞基法特休計算規則', () => {
        it('年資未滿半年應給予 0 天', () => {
            const today = new Date();
            const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
            const hireDateStr = threeMonthsAgo.toISOString().split('T')[0];

            const result = calculateAnnualLeave(hireDateStr);
            expect(result.entitlement).toBe(0);
            expect(result.expiry).toBeDefined();
        });

        it('年資滿半年、未滿 1 年應給予 3 天', () => {
            const today = new Date();
            const eightMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 8, today.getDate());
            const hireDateStr = eightMonthsAgo.toISOString().split('T')[0];

            const result = calculateAnnualLeave(hireDateStr);
            expect(result.entitlement).toBe(3);
        });

        it('年資滿 1 年、未滿 2 年應給予 7 天', () => {
            const today = new Date();
            const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
            const hireDateStr = oneYearAgo.toISOString().split('T')[0];

            const result = calculateAnnualLeave(hireDateStr);
            expect(result.entitlement).toBe(7);
        });

        it('年資滿 2 年、未滿 3 年應給予 10 天', () => {
            const today = new Date();
            const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
            const hireDateStr = twoYearsAgo.toISOString().split('T')[0];

            const result = calculateAnnualLeave(hireDateStr);
            expect(result.entitlement).toBe(10);
        });

        it('年資滿 3 年、未滿 5 年應給予 14 天', () => {
            const today = new Date();
            const threeYearsAgo = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
            const hireDateStr = threeYearsAgo.toISOString().split('T')[0];

            const result = calculateAnnualLeave(hireDateStr);
            expect(result.entitlement).toBe(14);
        });

        it('年資滿 5 年、未滿 10 年應給予 15 天', () => {
            const today = new Date();
            const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
            const hireDateStr = fiveYearsAgo.toISOString().split('T')[0];

            const result = calculateAnnualLeave(hireDateStr);
            expect(result.entitlement).toBe(15);
        });

        it('年資滿 12 年應給予 17 天 (15 + 2)', () => {
            const today = new Date();
            const twelveYearsAgo = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());
            const hireDateStr = twelveYearsAgo.toISOString().split('T')[0];

            const result = calculateAnnualLeave(hireDateStr);
            expect(result.entitlement).toBe(17);
        });

        it('年資超過 30 年特休上限應為 30 天', () => {
            const today = new Date();
            const thirtyFiveYearsAgo = new Date(today.getFullYear() - 35, today.getMonth(), today.getDate());
            const hireDateStr = thirtyFiveYearsAgo.toISOString().split('T')[0];

            const result = calculateAnnualLeave(hireDateStr);
            expect(result.entitlement).toBe(30);
        });
    });

    describe('calculateAvailable - 假別可用餘額計算', () => {
        it('正確計算可用餘額 (初始 + 獲得 + 手動調整 - 已用)', () => {
            const leave = {
                initial: 7,
                earned: 4,
                adjustment: 1.5,
                used: 3.5
            };
            expect(calculateAvailable(leave)).toBe(9.0);
        });

        it('無手動調整時 adjustment 預設為 0', () => {
            const leave = {
                initial: 10,
                earned: 0,
                used: 4
            };
            expect(calculateAvailable(leave)).toBe(6);
        });

        it('支援負數餘額 (超休/透支情況)', () => {
            const leave = {
                initial: 3,
                earned: 0,
                adjustment: 0,
                used: 5
            };
            expect(calculateAvailable(leave)).toBe(-2);
        });
    });
});
