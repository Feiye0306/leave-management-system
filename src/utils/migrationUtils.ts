import { LocalStorageRepo } from '../services/LocalStorageRepo';
import { FirebaseService } from '../services/FirebaseService';

/**
 * 將 LocalStorage 資料遷移至 Firestore
 * 注意：此函式應僅執行一次
 */
export async function migrateLocalToCloud(): Promise<void> {
    console.log('🚀 開始資料遷移：LocalStorage -> Firestore');

    // 1. 實例化 LocalStorageRepo 以讀取舊資料
    const localRepo = new LocalStorageRepo();

    // 2. 讀取資料
    const employees = await localRepo.getEmployees();
    const leaves = await localRepo.getLeaves();
    const branches = await localRepo.getBranches();
    const auditLogs = await localRepo.getAuditLogs();

    console.log(`📊 讀取到：${employees.length} 位員工, ${leaves.length} 張假單, ${branches.length} 間分校, ${auditLogs.length} 筆日誌`);

    if (employees.length === 0 && leaves.length === 0) {
        console.warn('⚠️ LocalStorage 無資料，略過遷移。');
        return;
    }

    // 3. 檢查目前的 Service 是否為 FirebaseService
    // 簡單檢查：利用 instanceof 或直接假設 serviceInstance 已切換
    // 但為了保險，我們直接在此處 new 一個 FirebaseService 來寫入
    const cloudService = new FirebaseService();

    // 4. 寫入資料 (使用 Promise.all 加速，但要注意 Firestore 寫入限制，量大時建議分批)
    // 員工
    console.log('⏳ 正在寫入員工資料...');
    for (const emp of employees) {
        await cloudService.saveEmployee(emp);
    }

    // 假單
    console.log('⏳ 正在寫入假單資料...');
    for (const leave of leaves) {
        await cloudService.addLeave(leave);
    }

    // 分校
    console.log('⏳ 正在寫入分校資料...');
    for (const branch of branches) {
        await cloudService.addBranch(branch);
    }

    // 日誌
    console.log('⏳ 正在寫入操作日誌...');
    for (const log of auditLogs) {
        await cloudService.addAuditLog(log);
    }

    console.log('✅ 資料遷移完成！');
    alert('資料遷移成功！請重新整理頁面。');
}
