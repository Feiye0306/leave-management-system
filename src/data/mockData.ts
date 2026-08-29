// 員工資料結構
export type Employee = {
    id: string;
    name: string;
    branch: string;
    status: '在職' | '離職';
    hireDate: string;
    resignDate?: string;
    annualLeave: {
        initial: number;
        earned: number;
        used: number;
        expiry?: string;
    };
    personalLeave: {
        initial: number;
        earned: number;
        used: number;
    };
    monthlyPersonalQuota: number; // New: Fixed monthly personal leave quota
};

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
    note?: string; // New field for user notes
    days: number;
    createdAt: string;
};

// localStorage 鍵值
const EMPLOYEES_KEY = 'leave_system_employees';
const ROSTER_KEY = 'leave_system_roster';

// 獲取員工資料
export function getEmployees(): Employee[] {
    const data = localStorage.getItem(EMPLOYEES_KEY);
    return data ? JSON.parse(data) : [];
}

// 儲存員工資料
export function saveEmployees(employees: Employee[]): void {
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
    // Dispatch event to notify listeners
    window.dispatchEvent(new Event('employees-updated'));
}

// 新增員工
export function addEmployee(newEmployee: Employee): void {
    const employees = getEmployees();
    employees.push(newEmployee);
    saveEmployees(employees);
}

// 刪除員工
export function deleteEmployee(id: string): void {
    const employees = getEmployees().filter(emp => emp.id !== id);
    saveEmployees(employees);
}

// 獲取排休紀錄
export function getRoster(): LeaveRecord[] {
    const data = localStorage.getItem(ROSTER_KEY);
    return data ? JSON.parse(data) : [];
}

// 儲存排休紀錄
export function saveRoster(roster: LeaveRecord[]): void {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
}

// 計算可用餘額
export function calculateAvailable(leaveData: { initial: number; earned: number; used: number }): number {
    return leaveData.initial + leaveData.earned - leaveData.used;
}

// 計算特休天數 (依據台灣勞基法)
export function calculateAnnualLeave(hireDateStr: string): { entitlement: number; expiry: string } {
    const hireDate = new Date(hireDateStr);
    const today = new Date();

    // 計算年資 (Tenure)
    let years = today.getFullYear() - hireDate.getFullYear();
    let months = today.getMonth() - hireDate.getMonth();
    let days = today.getDate() - hireDate.getDate();

    if (days < 0) {
        months--;
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    const totalMonths = years * 12 + months;

    // 判斷目前的特休週期
    // 週期: 到職日 ~ 下一年到職日前一天
    // 我們需要找到 "目前的" 週期是第幾年
    // 邏輯: 
    // - 0.5 ~ 1 年: 3天
    // - 1 ~ 2 年: 7天
    // - ...

    let entitlement = 0;

    // 計算下一個週年日 (Next Anniversary)
    // 如果今天還沒過今年的週年日，那下一個週年日就是今年的週年日
    // 如果今天已經過了今年的週年日，那下一個週年日就是明年的週年日
    const thisYearAnniversary = new Date(today.getFullYear(), hireDate.getMonth(), hireDate.getDate());
    let nextAnniversary = new Date(thisYearAnniversary);

    if (today >= thisYearAnniversary) {
        nextAnniversary.setFullYear(today.getFullYear() + 1);
    }

    // 期限是下一個週年日的前一天
    const expiryDate = new Date(nextAnniversary);
    expiryDate.setDate(expiryDate.getDate() - 1);
    const expiryStr = expiryDate.toISOString().split('T')[0];

    // 計算當前週期應得天數
    // 依據 "目前正在進行的這一年" 滿多久來算
    // 也就是 (nextAnniversary 的年份 - hireDate 的年份) - 1 ? 
    // 不太對，應該看 "最近一次週年日" 當下的滿年資

    // let currentTenureYears = years;
    // 如果現在是剛滿 0.5 年但未滿 1 年的特殊區間
    if (years === 0 && totalMonths >= 6) {
        entitlement = 3;
    } else if (years >= 1) {
        if (years < 2) entitlement = 7;
        else if (years < 3) entitlement = 10;
        else if (years < 5) entitlement = 14;
        else if (years < 10) entitlement = 15;
        else {
            entitlement = 15 + (years - 10);
            if (entitlement > 30) entitlement = 30;
        }
    } else {
        // 未滿 6 個月
        entitlement = 0;
    }

    return { entitlement, expiry: expiryStr };
}

// 生成範例資料
export function generateSampleData(): void {
    const mkEmployee = (id: string, name: string, branch: string, status: '在職' | '離職', hireDate: string, usedLeave: number, personalUsed: number, quota: number): Employee => {
        const { entitlement, expiry } = calculateAnnualLeave(hireDate);
        return {
            id, name, branch, status, hireDate,
            annualLeave: { initial: entitlement, earned: 0, used: usedLeave, expiry },
            personalLeave: { initial: 7, earned: 0, used: personalUsed },
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

    saveEmployees(sampleEmployees);
    saveRoster([]);
    // Initialize branches based on sample employees
    const branchSet = new Set<string>();
    sampleEmployees.forEach(emp => branchSet.add(emp.branch));
    const branches = Array.from(branchSet);
    localStorage.setItem('leave_system_branches', JSON.stringify(branches));
}

// Branch management utilities
export function getBranches(): string[] {
    const data = localStorage.getItem('leave_system_branches');
    return data ? JSON.parse(data) : [];
}

export function addBranch(name: string): void {
    const branches = getBranches();
    if (!branches.includes(name)) {
        branches.push(name);
        localStorage.setItem('leave_system_branches', JSON.stringify(branches));
    }
}

export function removeBranch(name: string): void {
    let branches = getBranches();
    branches = branches.filter(b => b !== name);
    localStorage.setItem('leave_system_branches', JSON.stringify(branches));
}

// duplicate sample data block removed

