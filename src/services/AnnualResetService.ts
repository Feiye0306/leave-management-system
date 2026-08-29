import { leaveService } from './serviceInstance';
import type { AuditLog, Employee } from '../types';
import { calculateAnnualLeave } from '../utils/leaveUtils';

export class AnnualResetService {
    /**
     * Checks all employees and resets their annual leave if today is their hire date anniversary.
     * Use a flag in local storage or last reset timestamp to prevent multiple resets on the same day.
     */
    static async checkAndRunAnnualReset(): Promise<void> {
        console.log('Checking Annual Leave Reset...');
        const today = new Date();
        const employees = await leaveService.getEmployees();

        for (const emp of employees) {
            if (emp.status !== '在職') continue;

            const hireDate = new Date(emp.hireDate);
            // Check if today is the anniversary (Month and Day match)
            if (today.getMonth() === hireDate.getMonth() && today.getDate() === hireDate.getDate()) {
                await this.performEmployeeReset(emp, today.getFullYear());
            }
        }
    }

    private static async performEmployeeReset(emp: Employee, currentYear: number): Promise<void> {
        // Double check audit logs to see if we already reset this employee for this year
        const logs = await leaveService.getAuditLogs();
        const hasReset = logs.some(log =>
            log.action === 'system_reset_annual' &&
            log.employeeId === emp.id &&
            log.details?.year === currentYear
        );

        if (hasReset) {
            console.log(`Employee ${emp.name} already reset for year ${currentYear}`);
            return;
        }

        console.log(`Resetting Annual Leave for ${emp.name} (Anniversary)`);

        // Recalculate entitlement for the NEW cycle
        const { entitlement, expiry } = calculateAnnualLeave(emp.hireDate);

        const updatedEmp: Employee = {
            ...emp,
            annualLeave: {
                initial: entitlement,
                earned: 0, // Optionally carry over or special rules
                adjustment: 0,
                used: 0,
                expiry: expiry
            }
        };

        await leaveService.saveEmployee(updatedEmp);

        // Audit Log
        const log: AuditLog = {
            id: Date.now().toString() + Math.random(),
            timestamp: new Date().toISOString(),
            category: 'system',
            action: 'system_reset_annual',
            employeeId: emp.id,
            employeeName: emp.name,
            details: {
                year: currentYear,
                newEntitlement: entitlement,
                newExpiry: expiry
            },
            operator: 'System'
        };
        await leaveService.addAuditLog(log);
    }
}
