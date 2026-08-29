import { leaveService } from './serviceInstance';
import type { AuditLog, Employee } from '../types';

export class MonthlyAccrualService {
    /**
     * Checks if we need to run monthly accrual for Personal Leave.
     * Should be run on the 1st of every month.
     */
    static async checkAndRunMonthlyAccrual(): Promise<void> {
        console.log('Checking Monthly Accrual...');
        const today = new Date();
        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        // We only run this if today is the 1st of the month (or close to it, if we want robust recovery)
        // But for simplicity, let's say we check if it has been run for this month.

        const logs = await leaveService.getAuditLogs();
        const hasRun = logs.some(log =>
            log.action === 'system_monthly_accrual' &&
            log.details?.monthKey === currentMonthKey
        );

        if (hasRun) {
            // Already run for this month
            return;
        }

        // It hasn't run. But we should only run it if it is actually a new month.
        // If the app is opened on 15th, and hasn't run, we should run it?
        // Yes, ensuring employees get their quota. 
        // But we must be careful not to double run if we already ran it on the 1st.
        // The check 'hasRun' handles that.

        console.log(`Performing Monthly Accrual for ${currentMonthKey}...`);

        const employees = await leaveService.getEmployees();

        for (const emp of employees) {
            if (emp.status !== '在職') continue;

            // Add monthly quota to 'earned'
            const updatedEmp: Employee = {
                ...emp,
                personalLeave: {
                    ...emp.personalLeave,
                    earned: emp.personalLeave.earned + emp.monthlyPersonalQuota
                }
            };

            await leaveService.saveEmployee(updatedEmp);
        }

        // Log the system action
        const log: AuditLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            category: 'system',
            action: 'system_monthly_accrual',
            details: { monthKey: currentMonthKey },
            operator: 'System'
        };
        await leaveService.addAuditLog(log);
        console.log('Monthly Accrual Complete');
    }
}
