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

    let entitlement = 0;

    // 計算下一個週年日 (Next Anniversary)
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

// 計算可用餘額
export function calculateAvailable(leaveData: { initial: number; earned: number; adjustment?: number; used: number }): number {
    return leaveData.initial + leaveData.earned + (leaveData.adjustment || 0) - leaveData.used;
}
