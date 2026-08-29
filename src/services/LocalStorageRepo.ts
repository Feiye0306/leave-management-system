import type { ILeaveService } from './LeaveService';
import type { Employee, LeaveRecord, AuditLog } from '../types';
import { calculateAnnualLeave } from '../utils/leaveUtils';

const EMPLOYEES_KEY = 'leave_system_employees';
const ROSTER_KEY = 'leave_system_roster';
const BRANCHES_KEY = 'leave_system_branches';
const AUDIT_LOGS_KEY = 'leave_system_audit_logs';

export class LocalStorageRepo implements ILeaveService {

    // Helpers
    private load<T>(key: string): T[] {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error(`Error loading key ${key}:`, e);
            return [];
        }
    }

    private save<T>(key: string, data: T[]): void {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`Error saving key ${key}:`, e);
        }
    }

    // --- Employee ---
    async getEmployees(): Promise<Employee[]> {
        return this.load<Employee>(EMPLOYEES_KEY);
    }

    async getEmployee(id: string): Promise<Employee | undefined> {
        const employees = this.load<Employee>(EMPLOYEES_KEY);
        return employees.find(e => e.id === id);
    }

    async saveEmployee(employee: Employee): Promise<void> {
        const employees = this.load<Employee>(EMPLOYEES_KEY);
        const index = employees.findIndex(e => e.id === employee.id);
        if (index >= 0) {
            employees[index] = employee;
        } else {
            employees.push(employee);
        }
        this.save(EMPLOYEES_KEY, employees);

        // Auto-add branch if it's new
        if (employee.branch) {
            await this.addBranch(employee.branch);
        }
    }

    async deleteEmployee(id: string): Promise<void> {
        let employees = this.load<Employee>(EMPLOYEES_KEY);
        employees = employees.filter(e => e.id !== id);
        this.save(EMPLOYEES_KEY, employees);
    }

    // --- Leaves ---
    async getLeaves(filters?: { branch?: string; employeeId?: string; startDate?: string; endDate?: string }): Promise<LeaveRecord[]> {
        let leaves = this.load<LeaveRecord>(ROSTER_KEY);
        if (filters) {
            if (filters.branch) {
                // If branch is '全部分校', don't filter by branch (or handle in UI, but safe here)
                if (filters.branch !== '全部分校') {
                    leaves = leaves.filter(l => l.branch === filters.branch);
                }
            }
            if (filters.employeeId) leaves = leaves.filter(l => l.employeeId === filters.employeeId);
            // Date filtering can be complex, skipping strict implementation for now as UI filters mostly by month in memory
        }
        return leaves;
    }

    async addLeave(leave: LeaveRecord): Promise<void> {
        const leaves = this.load<LeaveRecord>(ROSTER_KEY);
        leaves.push(leave);
        this.save(ROSTER_KEY, leaves);
    }

    async updateLeave(leave: LeaveRecord): Promise<void> {
        const leaves = this.load<LeaveRecord>(ROSTER_KEY);
        const index = leaves.findIndex(l => l.id === leave.id);
        if (index >= 0) {
            leaves[index] = leave;
            this.save(ROSTER_KEY, leaves);
        }
    }

    async deleteLeave(id: string): Promise<void> {
        let leaves = this.load<LeaveRecord>(ROSTER_KEY);
        leaves = leaves.filter(l => l.id !== id);
        this.save(ROSTER_KEY, leaves);
    }

    // --- Branches ---
    async getBranches(): Promise<string[]> {
        return this.load<string>(BRANCHES_KEY);
    }

    async addBranch(branch: string): Promise<void> {
        const branches = this.load<string>(BRANCHES_KEY);
        if (!branches.includes(branch)) {
            branches.push(branch);
            this.save(BRANCHES_KEY, branches);
        }
    }

    async removeBranch(branch: string): Promise<void> {
        let branches = this.load<string>(BRANCHES_KEY);
        branches = branches.filter(b => b !== branch);
        this.save(BRANCHES_KEY, branches);
    }

    // --- Audit Logs ---
    async getAuditLogs(filters?: { employeeId?: string }): Promise<AuditLog[]> {
        let logs = this.load<AuditLog>(AUDIT_LOGS_KEY);
        if (filters?.employeeId) {
            logs = logs.filter(log => log.employeeId === filters.employeeId);
        }
        return logs;
    }

    async addAuditLog(log: AuditLog): Promise<void> {
        const logs = this.load<AuditLog>(AUDIT_LOGS_KEY);
        logs.push(log);
        this.save(AUDIT_LOGS_KEY, logs);
    }

    // --- Utils ---
    async resetData(): Promise<void> {
        localStorage.removeItem(EMPLOYEES_KEY);
        localStorage.removeItem(ROSTER_KEY);
        localStorage.removeItem(BRANCHES_KEY);
        localStorage.removeItem(AUDIT_LOGS_KEY);
    }

    // This mimics the logic from mockData.ts
    async generateSampleData(): Promise<void> {
        const mkEmployee = (id: string, name: string, branch: string, status: '在職' | '離職', hireDate: string, usedLeave: number, personalUsed: number, quota: number): Employee => {
            const { entitlement, expiry } = calculateAnnualLeave(hireDate);
            return {
                id, name, branch, status, hireDate,
                annualLeave: { initial: entitlement, earned: 0, adjustment: 0, used: usedLeave, expiry },
                personalLeave: { initial: 7, earned: 0, adjustment: 0, used: personalUsed },
                monthlyPersonalQuota: quota,
            };
        };

        const sampleEmployees: Employee[] = [
            mkEmployee('emp001', '王小明', '信義校', '在職', '2023-01-15', 3, 2, 4),
            mkEmployee('emp002', '李美華', '信義校', '在職', '2022-06-01', 5, 3, 6),
            mkEmployee('emp003', '張志強', '南港校', '在職', '2024-09-01', 0, 0, 4),
            mkEmployee('emp004', '陳雅婷', '南港校', '在職', '2021-03-10', 8, 5, 8),
            mkEmployee('emp005', '林建宏', '信義校', '離職', '2020-01-01', 0, 0, 4),
            mkEmployee('emp006', '黃淑芬', '南港校', '在職', '2023-11-20', 1, 0, 5),
            mkEmployee('emp007', '吳俊傑', '信義校', '在職', '2019-05-01', 5, 4, 6),
        ];

        this.save(EMPLOYEES_KEY, sampleEmployees);
        this.save(ROSTER_KEY, []);

        const branchSet = new Set<string>();
        sampleEmployees.forEach(emp => branchSet.add(emp.branch));
        this.save(BRANCHES_KEY, Array.from(branchSet));
    }
}
