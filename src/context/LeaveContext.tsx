import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
// import type { ILeaveService } from '../services/LeaveService';
// Switch implementations here easily
// import { LocalStorageRepo } from '../services/LocalStorageRepo';
// import { FirebaseService } from '../services/FirebaseService';
import type { Employee, LeaveRecord, AuditLog } from '../types';

interface LeaveContextType {
    employees: Employee[];
    leaves: LeaveRecord[];
    branches: string[];
    loading: boolean;
    error: string | null;

    // Actions
    refreshData: () => Promise<void>;
    addEmployee: (emp: Employee) => Promise<void>;
    updateEmployee: (emp: Employee) => Promise<void>;
    deleteEmployee: (id: string) => Promise<void>;
    addLeave: (leave: LeaveRecord) => Promise<void>;
    addLeaves: (leaves: LeaveRecord[]) => Promise<void>; // New
    updateLeave: (updatedLeave: LeaveRecord, oldLeave?: LeaveRecord) => Promise<void>;
    deleteLeave: (id: string) => Promise<void>;
    addBranch: (branch: string) => Promise<void>;
    removeBranch: (branch: string) => Promise<void>;
    generateSampleData: () => Promise<void>;
    resetData: () => Promise<void>;
    addAuditLog: (log: AuditLog) => Promise<void>;
    getAuditLogs: (employeeId?: string) => Promise<AuditLog[]>;
}

const LeaveContext = createContext<LeaveContextType | undefined>(undefined);

// ---------------------------------------------
// CONFIGURATION: Choose your backend here
// ---------------------------------------------
import { leaveService } from '../services/serviceInstance';
import { createAuditLog } from '../utils/auditLogger';
// ---------------------------------------------

export function LeaveProvider({ children }: { children: ReactNode }) {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
    const [branches, setBranches] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [emps, lvs, brs] = await Promise.all([
                leaveService.getEmployees(),
                leaveService.getLeaves(),
                leaveService.getBranches()
            ]);
            setEmployees(emps);
            setLeaves(lvs);
            setBranches(brs);
        } catch (err) {
            console.error('Refresh data error:', err);
            setError('資料讀取失敗，請重新整理頁面');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        refreshData();
    }, []);

    // Optimistic UI Wrappers
    const addEmployee = async (emp: Employee) => {
        setEmployees(prev => [...prev.filter(e => e.id !== emp.id), emp]);
        try {
            await leaveService.saveEmployee(emp);
        } catch (err) {
            console.warn('addEmployee storage error:', err);
        }
        await refreshData(false);
    };

    const updateEmployee = async (emp: Employee) => {
        setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
        try {
            await leaveService.saveEmployee(emp);
        } catch (err) {
            console.warn('updateEmployee storage error:', err);
        }
        await refreshData(false);
    };

    const deleteEmployee = async (id: string) => {
        setEmployees(prev => prev.filter(e => e.id !== id));
        try {
            await leaveService.deleteEmployee(id);
        } catch (err) {
            console.warn('deleteEmployee storage error:', err);
        }
        await refreshData(false);
    };

    const addLeave = async (leave: LeaveRecord) => {
        setLeaves(prev => [...prev.filter(l => l.id !== leave.id), leave]);
        try {
            await leaveService.addLeave(leave);
        } catch (err) {
            console.warn('addLeave storage error:', err);
        }
        await refreshData(false);
    };

    const addLeaves = async (newLeaves: LeaveRecord[]) => {
        setLeaves(prev => [...prev, ...newLeaves]);
        try {
            for (const leave of newLeaves) {
                await leaveService.addLeave(leave);
            }
        } catch (err) {
            console.warn('addLeaves storage error:', err);
        }
        await refreshData(false);
    };

    const updateLeave = async (updatedLeave: LeaveRecord, oldLeave?: LeaveRecord) => {
        const original = oldLeave || leaves.find(l => l.id === updatedLeave.id);
        
        // Optimistic UI update
        setLeaves(prev => prev.map(l => l.id === updatedLeave.id ? updatedLeave : l));

        if (original) {
            const emp = employees.find(e => e.id === updatedLeave.employeeId);
            if (emp) {
                const updatedEmp = { ...emp };
                // 1. 退回原假單額度
                if (original.leaveType === 'annual') {
                    updatedEmp.annualLeave = {
                        ...updatedEmp.annualLeave,
                        used: Math.max(0, updatedEmp.annualLeave.used - original.days)
                    };
                } else {
                    updatedEmp.personalLeave = {
                        ...updatedEmp.personalLeave,
                        used: Math.max(0, updatedEmp.personalLeave.used - original.days)
                    };
                }

                // 2. 扣除新假單額度
                if (updatedLeave.leaveType === 'annual') {
                    updatedEmp.annualLeave = {
                        ...updatedEmp.annualLeave,
                        used: updatedEmp.annualLeave.used + updatedLeave.days
                    };
                } else {
                    updatedEmp.personalLeave = {
                        ...updatedEmp.personalLeave,
                        used: updatedEmp.personalLeave.used + updatedLeave.days
                    };
                }

                await updateEmployee(updatedEmp);
            }
        }

        try {
            await leaveService.updateLeave(updatedLeave);
        } catch (err) {
            console.warn('updateLeave storage error:', err);
        }

        // Log audit
        try {
            const log = createAuditLog({
                category: 'leave',
                action: 'leave_update',
                employeeId: updatedLeave.employeeId,
                employeeName: updatedLeave.employeeName,
                details: {
                    leaveId: updatedLeave.id,
                    newDate: updatedLeave.startDate,
                    oldDate: original?.startDate,
                    leaveType: updatedLeave.leaveType,
                    days: updatedLeave.days
                }
            });
            await leaveService.addAuditLog(log);
        } catch (e) {
            console.warn('Audit log error:', e);
        }

        await refreshData(false);
    };

    const deleteLeave = async (id: string) => {
        const targetLeave = leaves.find(l => l.id === id);
        
        // Optimistic UI update
        setLeaves(prev => prev.filter(l => l.id !== id));

        // 自動回補員工額度
        if (targetLeave) {
            const emp = employees.find(e => e.id === targetLeave.employeeId);
            if (emp) {
                const updatedEmp = { ...emp };
                if (targetLeave.leaveType === 'annual') {
                    updatedEmp.annualLeave = {
                        ...updatedEmp.annualLeave,
                        used: Math.max(0, updatedEmp.annualLeave.used - targetLeave.days)
                    };
                } else {
                    updatedEmp.personalLeave = {
                        ...updatedEmp.personalLeave,
                        used: Math.max(0, updatedEmp.personalLeave.used - targetLeave.days)
                    };
                }
                await updateEmployee(updatedEmp);
            }

            // Log audit
            try {
                const log = createAuditLog({
                    category: 'leave',
                    action: 'leave_delete',
                    employeeId: targetLeave.employeeId,
                    employeeName: targetLeave.employeeName,
                    details: {
                        date: targetLeave.startDate,
                        leaveType: targetLeave.leaveType,
                        refundedDays: targetLeave.days
                    }
                });
                await leaveService.addAuditLog(log);
            } catch (e) {
                console.warn('Audit log error:', e);
            }
        }

        try {
            await leaveService.deleteLeave(id);
        } catch (err) {
            console.warn('deleteLeave storage error:', err);
        }
        await refreshData(false);
    };

    const addBranch = async (branch: string) => {
        setBranches(prev => prev.includes(branch) ? prev : [...prev, branch]);
        try {
            await leaveService.addBranch(branch);
        } catch (err) {
            console.warn('addBranch storage error:', err);
        }
        await refreshData(false);
    };

    const removeBranch = async (branch: string) => {
        setBranches(prev => prev.filter(b => b !== branch));
        try {
            await leaveService.removeBranch(branch);
        } catch (err) {
            console.warn('removeBranch storage error:', err);
        }
        await refreshData(false);
    };

    const generateSampleData = async () => {
        try {
            await leaveService.generateSampleData();
        } catch (err) {
            console.warn('generateSampleData error:', err);
        }
        await refreshData(true);
    };

    const resetData = async () => {
        setEmployees([]);
        setLeaves([]);
        setBranches([]);
        try {
            await leaveService.resetData();
        } catch (err) {
            console.warn('resetData error:', err);
        }
        await refreshData(true);
    };

    const addAuditLog = async (log: AuditLog) => {
        try {
            await leaveService.addAuditLog(log);
        } catch (err) {
            console.warn('addAuditLog error:', err);
        }
    };

    const getAuditLogs = async (employeeId?: string) => {
        try {
            return await leaveService.getAuditLogs({ employeeId });
        } catch (err) {
            console.warn('getAuditLogs error:', err);
            return [];
        }
    };

    return (
        <LeaveContext.Provider value={{
            employees,
            leaves,
            branches,
            loading,
            error,
            refreshData,
            addEmployee,
            updateEmployee,
            deleteEmployee,
            addLeave,
            addLeaves,
            updateLeave,
            deleteLeave,
            addBranch,
            removeBranch,
            generateSampleData,
            resetData,
            addAuditLog,
            getAuditLogs
        }}>
            {children}
        </LeaveContext.Provider>
    );
}

export function useLeaveSystem() {
    const context = useContext(LeaveContext);
    if (context === undefined) {
        throw new Error('useLeaveSystem must be used within a LeaveProvider');
    }
    return context;
}
