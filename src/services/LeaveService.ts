import type { Employee, LeaveRecord, AuditLog } from '../types';

export interface ILeaveService {
    // Employee Management
    getEmployees(): Promise<Employee[]>;
    getEmployee(id: string): Promise<Employee | undefined>;
    saveEmployee(employee: Employee): Promise<void>;
    deleteEmployee(id: string): Promise<void>;

    // Leave Management
    getLeaves(filters?: { branch?: string; employeeId?: string; startDate?: string; endDate?: string }): Promise<LeaveRecord[]>;
    addLeave(leave: LeaveRecord): Promise<void>;
    updateLeave(leave: LeaveRecord): Promise<void>;
    deleteLeave(id: string): Promise<void>;

    // Branch Management
    getBranches(): Promise<string[]>;
    addBranch(branch: string): Promise<void>;
    removeBranch(branch: string): Promise<void>;

    // Utilities / Bulk Actions
    resetData(): Promise<void>; // For "Clear All"
    generateSampleData(): Promise<void>; // For "Generate Sample"

    // Audit Log Management
    getAuditLogs(filters?: { employeeId?: string }): Promise<AuditLog[]>;
    addAuditLog(log: AuditLog): Promise<void>;
}
