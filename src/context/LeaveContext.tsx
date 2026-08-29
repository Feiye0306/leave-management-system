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

    // Wrappers
    const addEmployee = async (emp: Employee) => {
        await leaveService.saveEmployee(emp);
        await refreshData(false);
    };

    const updateEmployee = async (emp: Employee) => {
        await leaveService.saveEmployee(emp);
        await refreshData(false);
    };

    const deleteEmployee = async (id: string) => {
        await leaveService.deleteEmployee(id);
        await refreshData(false);
    };

    const addLeave = async (leave: LeaveRecord) => {
        await leaveService.addLeave(leave);
        await refreshData(false); // Silent refresh
    };

    const addLeaves = async (newLeaves: LeaveRecord[]) => {
        for (const leave of newLeaves) {
            await leaveService.addLeave(leave);
        }
        await refreshData(false); // Silent refresh once
    };

    const deleteLeave = async (id: string) => {
        await leaveService.deleteLeave(id);
        await refreshData(false);
    };

    const addBranch = async (branch: string) => {
        await leaveService.addBranch(branch);
        await refreshData();
    };

    const removeBranch = async (branch: string) => {
        await leaveService.removeBranch(branch);
        await refreshData();
    };

    const generateSampleData = async () => {
        await leaveService.generateSampleData();
        await refreshData();
    };

    const resetData = async () => {
        await leaveService.resetData();
        await refreshData();
    };

    const addAuditLog = async (log: AuditLog) => {
        await leaveService.addAuditLog(log);
    };

    const getAuditLogs = async (employeeId?: string) => {
        return await leaveService.getAuditLogs({ employeeId });
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
