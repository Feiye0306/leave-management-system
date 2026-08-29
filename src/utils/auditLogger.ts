import type { AuditLog, AuditAction } from '../types';

/**
 * 生成唯一的 Audit Log ID
 */
export function generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 創建 Audit Log 記錄
 */
export function createAuditLog(params: {
    category: 'employee' | 'leave' | 'system';
    action: AuditAction;
    employeeId?: string;
    employeeName?: string;
    before?: number | string;
    after?: number | string;
    amount?: number;
    details?: Record<string, any>;
    reason?: string;
    operator?: string;
}): AuditLog {
    return {
        id: generateAuditId(),
        timestamp: new Date().toISOString(),
        ...params
    };
}

/**
 * 格式化 Audit Log 為人類可讀的描述
 */
export function formatAuditLog(log: AuditLog): string {
    const time = new Date(log.timestamp).toLocaleString('zh-TW');
    const employee = log.employeeName ? ` - ${log.employeeName}` : '';

    switch (log.action) {
        // 員工管理
        case 'employee_create':
            return `${time} | 新增員工${employee}`;
        case 'employee_delete':
            return `${time} | 刪除員工${employee}`;
        case 'employee_update':
            return `${time} | 更新員工資訊${employee}`;
        case 'adjust_annual':
            return `${time} | 調整特休額度${employee}：${log.before}天 → ${log.after}天 (${log.amount! > 0 ? '+' : ''}${log.amount}天)`;
        case 'adjust_personal':
            return `${time} | 調整排休額度${employee}：${log.before}天 → ${log.after}天 (${log.amount! > 0 ? '+' : ''}${log.amount}天)`;
        case 'cashout_annual':
            return `${time} | 特休 Cash Out${employee}：結算 ${Math.abs(log.amount!)} 天`;
        case 'cashout_personal':
            return `${time} | 排休 Cash Out${employee}：結算 ${Math.abs(log.amount!)} 天`;

        // 請假管理
        case 'leave_create':
            return `${time} | 新增請假${employee}：${log.details?.leaveType === 'annual' ? '特休' : '排休'} ${log.details?.days}天`;
        case 'leave_batch_create':
            return `${time} | 批次新增請假${employee}：${log.details?.count}筆記錄`;
        case 'leave_delete':
            return `${time} | 刪除請假記錄${employee}`;
        case 'leave_update':
            return `${time} | 更新請假記錄${employee}`;

        // 系統操作
        case 'system_generate_sample':
            return `${time} | 生成範例資料`;
        case 'system_reset':
            return `${time} | 重置系統資料`;
        case 'system_export':
            return `${time} | 匯出資料：${log.details?.exportType || 'CSV'}`;

        default:
            return `${time} | 未知操作：${log.action}`;
    }
}

/**
 * 取得操作類別的圖示
 */
export function getAuditCategoryIcon(category: 'employee' | 'leave' | 'system'): string {
    switch (category) {
        case 'employee':
            return '👤';
        case 'leave':
            return '📅';
        case 'system':
            return '⚙️';
        default:
            return '📝';
    }
}

/**
 * 取得操作類別的顏色類別（Tailwind）
 */
export function getAuditCategoryColor(category: 'employee' | 'leave' | 'system'): string {
    switch (category) {
        case 'employee':
            return 'blue';
        case 'leave':
            return 'green';
        case 'system':
            return 'purple';
        default:
            return 'gray';
    }
}
