// 員工資料結構
export interface LeaveBalance {
    initial: number; // 初始/結轉
    earned: number;  // 累計 (每月發放)
    adjustment: number; // 手動調整
    used: number;    // 已用
    expiry?: string;
}

export interface Employee {
    id: string;
    name: string;
    branch: string;
    status: '在職' | '離職';
    hireDate: string;
    birthDate?: string; // YYYY-MM-DD
    resignDate?: string;
    annualLeave: LeaveBalance;
    personalLeave: LeaveBalance;
    monthlyPersonalQuota: number; // 每月自動發放的排休天數
}

// 排休紀錄結構
export type LeaveRecord = {
    id: string;
    employeeId: string;
    employeeName: string;
    branch: string;
    leaveType: 'annual' | 'personal';
    startDate: string;
    endDate: string;
    isFullDay: boolean;
    timeSlot?: string;
    slots?: ('morning' | 'afternoon' | 'evening')[];
    note?: string;
    days: number;
    createdAt: string;
};

export type TimeSlot = 'morning' | 'afternoon' | 'evening';

// 操作動作類型
export type AuditAction =
    // 員工管理
    | 'employee_create'
    | 'employee_delete'
    | 'employee_update'
    | 'adjust_annual'
    | 'adjust_personal'
    | 'cashout_annual'
    | 'cashout_personal'
    // 請假管理
    | 'leave_create'
    | 'leave_delete'
    | 'leave_update'
    | 'leave_batch_create'
    // 系統操作
    | 'system_generate_sample'
    | 'system_reset'
    | 'backup_create'
    | 'backup_restore'
    | 'system_reset_annual'
    | 'manual_adjustment'
    | 'system_monthly_accrual'
    | 'system_export';

// 操作記錄結構（擴充版）
export type AuditLog = {
    id: string;
    timestamp: string;
    category: 'employee' | 'leave' | 'system';  // 操作類別
    action: AuditAction;

    // 員工相關（可選）
    employeeId?: string;
    employeeName?: string;

    // 數值變動（可選）
    before?: number | string;
    after?: number | string;
    amount?: number;

    // 詳細資訊（彈性儲存）
    details?: Record<string, any>;
    reason?: string;
    operator?: string; // 未來擴充為登入系統
};
