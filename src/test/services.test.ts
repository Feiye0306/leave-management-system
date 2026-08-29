import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnualResetService } from '../services/AnnualResetService';
import { MonthlyAccrualService } from '../services/MonthlyAccrualService';
import { AutoBackupService } from '../services/AutoBackupService';
import { leaveService } from '../services/serviceInstance';
import type { Employee, AuditLog } from '../types';

describe('服務邏輯測試 (Background Services)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('AnnualResetService - 到職日週年重置', () => {
        it('當員工非今日到職週年時，不觸發重置', async () => {
            const today = new Date();
            const differentMonth = (today.getMonth() + 6) % 12;
            const notAnniversaryDate = `${today.getFullYear() - 1}-${String(differentMonth + 1).padStart(2, '0')}-15`;

            const mockEmp: Employee = {
                id: 'emp_test_1',
                name: '測試員1',
                branch: '信義校',
                status: '在職',
                hireDate: notAnniversaryDate,
                annualLeave: { initial: 7, earned: 0, adjustment: 0, used: 3 },
                personalLeave: { initial: 0, earned: 8, adjustment: 0, used: 2 },
                monthlyPersonalQuota: 4
            };

            const getEmployeesSpy = vi.spyOn(leaveService, 'getEmployees').mockResolvedValue([mockEmp]);
            const saveEmployeeSpy = vi.spyOn(leaveService, 'saveEmployee').mockResolvedValue();

            await AnnualResetService.checkAndRunAnnualReset();

            expect(getEmployeesSpy).toHaveBeenCalled();
            expect(saveEmployeeSpy).not.toHaveBeenCalled();
        });

        it('當員工已重置過該年度時，不重複執行', async () => {
            const today = new Date();
            const hireDateStr = `${today.getFullYear() - 2}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            const mockEmp: Employee = {
                id: 'emp_test_2',
                name: '測試員2',
                branch: '信義校',
                status: '在職',
                hireDate: hireDateStr,
                annualLeave: { initial: 7, earned: 0, adjustment: 0, used: 3 },
                personalLeave: { initial: 0, earned: 8, adjustment: 0, used: 2 },
                monthlyPersonalQuota: 4
            };

            const existingLog: AuditLog = {
                id: 'log_1',
                timestamp: new Date().toISOString(),
                category: 'system',
                action: 'system_reset_annual',
                employeeId: 'emp_test_2',
                employeeName: '測試員2',
                details: { year: today.getFullYear() }
            };

            vi.spyOn(leaveService, 'getEmployees').mockResolvedValue([mockEmp]);
            vi.spyOn(leaveService, 'getAuditLogs').mockResolvedValue([existingLog]);
            const saveEmployeeSpy = vi.spyOn(leaveService, 'saveEmployee').mockResolvedValue();

            await AnnualResetService.checkAndRunAnnualReset();

            expect(saveEmployeeSpy).not.toHaveBeenCalled();
        });
    });

    describe('MonthlyAccrualService - 每月排休額度自動累計', () => {
        it('已發放過當月額度時，不重複發放', async () => {
            const today = new Date();
            const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

            const existingLog: AuditLog = {
                id: 'accrual_log_1',
                timestamp: new Date().toISOString(),
                category: 'system',
                action: 'system_monthly_accrual',
                details: { monthKey: currentMonthKey }
            };

            vi.spyOn(leaveService, 'getAuditLogs').mockResolvedValue([existingLog]);
            const saveEmployeeSpy = vi.spyOn(leaveService, 'saveEmployee').mockResolvedValue();

            await MonthlyAccrualService.checkAndRunMonthlyAccrual();

            expect(saveEmployeeSpy).not.toHaveBeenCalled();
        });
    });

    describe('AutoBackupService - 自動備份提醒', () => {
        it('未記錄過備份時提醒使用者', () => {
            localStorage.clear();
            const callback = vi.fn();
            AutoBackupService.checkAndRemind(callback);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('記錄備份後更新 localStorage 時間戳', () => {
            AutoBackupService.recordBackup();
            const stored = localStorage.getItem('leave_system_last_backup');
            expect(stored).toBeDefined();
            expect(stored).not.toBeNull();
            expect(new Date(stored!).getTime()).toBeGreaterThan(0);
        });
    });
});
