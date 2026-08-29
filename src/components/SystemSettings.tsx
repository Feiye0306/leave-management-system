import { Settings, Trash2, Sparkles, AlertTriangle, DollarSign } from 'lucide-react';
import { useLeaveSystem } from '../context/LeaveContext';
import { calculateAvailable } from '../utils/leaveUtils';
import { createAuditLog } from '../utils/auditLogger';

function SystemSettings() {
    const { employees, branches, addBranch, removeBranch, generateSampleData, resetData, updateEmployee, addAuditLog } = useLeaveSystem();

    const handleGenerateSampleData = async () => {
        if (confirm('確定要生成範例資料嗎？這將清除現有資料。')) {
            await generateSampleData();

            // Log system operation
            const log = createAuditLog({
                category: 'system',
                action: 'system_generate_sample',
                details: { employeeCount: 7 }
            });
            await addAuditLog(log);

            alert('範例資料已成功生成！');
        }
    };

    const handleResetData = async () => {
        if (confirm('警告：此操作將清除所有資料且無法復原！確定要繼續嗎？')) {
            // Log before reset
            const log = createAuditLog({
                category: 'system',
                action: 'system_reset',
                details: {
                    employeeCount: employees.length,
                    timestamp: new Date().toISOString()
                }
            });
            await addAuditLog(log);

            await resetData();
            alert('所有資料已清除！');
        }
    };

    const handleAddBranch = async () => {
        const input = document.getElementById('newBranchInput') as HTMLInputElement;
        if (input && input.value.trim()) {
            await addBranch(input.value.trim());
            input.value = '';
        }
    };

    const handleCashOut = async (empId: string, type: 'annual' | 'personal') => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        const leaveData = type === 'annual' ? emp.annualLeave : emp.personalLeave;
        const remaining = calculateAvailable(leaveData);

        if (remaining <= 0) {
            alert(`${emp.name} 的${type === 'annual' ? '特休' : '排休'}餘額為 0，無需結算。`);
            return;
        }

        const cashOutReason = prompt(`${emp.name} 的${type === 'annual' ? '特休' : '排休'}餘額：${remaining} 天\n\n請輸入 Cash Out 理由（選填）：`);
        if (cashOutReason === null) return; // User cancelled

        const confirmMsg = `確認執行 Cash Out？\n\n員工：${emp.name}\n假別：${type === 'annual' ? '特休' : '排休'}\n結算天數：${remaining} 天${cashOutReason ? `\n理由：${cashOutReason}` : ''}`;

        if (!confirm(confirmMsg)) return;

        // Zero out the quota
        const updated = { ...emp };
        if (type === 'annual') {
            updated.annualLeave = {
                ...updated.annualLeave,
                used: updated.annualLeave.initial + updated.annualLeave.earned
            };
        } else {
            updated.personalLeave = {
                ...updated.personalLeave,
                used: updated.personalLeave.initial + updated.personalLeave.earned
            };
        }

        await updateEmployee(updated);

        // Log the cash out
        const log = createAuditLog({
            category: 'employee',
            action: type === 'annual' ? 'cashout_annual' : 'cashout_personal',
            employeeId: emp.id,
            employeeName: emp.name,
            before: remaining,
            after: 0,
            amount: -remaining,
            reason: cashOutReason || undefined
        });
        await addAuditLog(log);

        alert(`Cash Out 完成！\n${emp.name} 的${type === 'annual' ? '特休' : '排休'}已結算 ${remaining} 天並歸零。`);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-black text-midnight-blue">系統設定</h2>

            {/* Sample Data Generation */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="text-purple-600" size={32} />
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">範例資料產生器</h3>
                        <p className="text-slate-600 font-medium">一鍵生成 7 位範例員工資料</p>
                    </div>
                </div>

                <div className="bg-purple-50 p-6 rounded-2xl border-2 border-purple-200 mb-6">
                    <p className="font-bold text-purple-900 mb-3">
                        範例資料包含：
                    </p>
                    <ul className="space-y-2 text-purple-800 font-medium">
                        <li>• 不同分校的員工（信義校、南港校）</li>
                        <li>• 不同狀態（在職、離職）</li>
                        <li>• 不同假別餘額情況（正常、透支、新進）</li>
                        <li>• 不同到期日設定</li>
                    </ul>
                </div>

                <button
                    onClick={handleGenerateSampleData}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                >
                    <Sparkles size={24} />
                    生成範例資料
                </button>
            </div>

            {/* Cash Out */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-emerald-100">
                <div className="flex items-center gap-3 mb-6">
                    <DollarSign className="text-emerald-600" size={32} />
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">年度結算 (Cash Out)</h3>
                        <p className="text-slate-600 font-medium">結算員工未使用假別並歸零</p>
                    </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {employees.filter(e => e.status === '在職').map(emp => {
                        const annualRemaining = calculateAvailable(emp.annualLeave);
                        const personalRemaining = calculateAvailable(emp.personalLeave);
                        const hasRemaining = annualRemaining > 0 || personalRemaining > 0;

                        return (
                            <div
                                key={emp.id}
                                className={`p-4 rounded-2xl border-2 transition-all ${hasRemaining
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : 'bg-slate-50 border-slate-100'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-black text-midnight-blue">{emp.name}</p>
                                        <p className="text-sm font-medium text-slate-500">{emp.branch}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {annualRemaining > 0 && (
                                            <button
                                                onClick={() => handleCashOut(emp.id, 'annual')}
                                                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition-all"
                                            >
                                                特休 {annualRemaining}天
                                            </button>
                                        )}
                                        {personalRemaining > 0 && (
                                            <button
                                                onClick={() => handleCashOut(emp.id, 'personal')}
                                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition-all"
                                            >
                                                排休 {personalRemaining}天
                                            </button>
                                        )}
                                        {!hasRemaining && (
                                            <span className="text-slate-400 font-medium text-sm px-4 py-2">
                                                無剩餘額度
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CSV Export */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <Settings className="text-emerald-600" size={32} />
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">資料匯出工具</h3>
                        <p className="text-slate-600 font-medium">匯出員工清單與假別資料</p>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-slate-800">匯出員工清單 (CSV)</h4>
                        <p className="text-sm text-slate-500">包含現有特休、排休餘額</p>
                    </div>
                    <button
                        onClick={() => {
                            const headers = ['員工編號', '姓名', '分校', '狀態', '入職日', '特休餘額', '排休餘額'];
                            const csvContent = [
                                headers.join(','),
                                ...employees.map(e => [
                                    e.id,
                                    e.name,
                                    e.branch,
                                    e.status,
                                    e.hireDate,
                                    calculateAvailable(e.annualLeave),
                                    calculateAvailable(e.personalLeave)
                                ].join(','))
                            ].join('\n');

                            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `employee_export_${new Date().toISOString().split('T')[0]}.csv`;
                            link.click();
                        }}
                        className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-md transition-all"
                    >
                        匯出 CSV
                    </button>
                </div>
            </div>

            {/* Branch Management */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <Settings className="text-purple-600" size={32} />
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">分校管理</h3>
                        <p className="text-slate-600 font-medium">新增或移除分校（分支）</p>
                    </div>
                </div>
                <div className="mb-4">
                    <ul className="list-disc pl-5 space-y-1">
                        {branches.map((b) => (
                            <li key={b} className="flex justify-between items-center">
                                <span>{b}</span>
                                <button
                                    onClick={() => removeBranch(b)}
                                    className="text-red-600 hover:text-red-800"
                                >
                                    刪除
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="新增分校名稱"
                        className="flex-1 px-4 py-2 border rounded-xl focus:outline-none"
                        id="newBranchInput"
                    />
                    <button
                        onClick={handleAddBranch}
                        className="bg-midnight-blue text-white px-4 py-2 rounded-xl"
                    >
                        新增
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-red-200">
                <div className="flex items-center gap-3 mb-6">
                    <AlertTriangle className="text-red-600" size={32} />
                    <div>
                        <h3 className="text-2xl font-black text-red-900">危險區域</h3>
                        <p className="text-red-700 font-medium">資料重置與系統清理</p>
                    </div>
                </div>

                <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200 mb-6">
                    <p className="font-bold text-red-900 mb-2">
                        ⚠️ 警告
                    </p>
                    <p className="text-red-800 font-medium">
                        此操作將永久刪除所有員工資料、排休紀錄與系統設定。此操作無法復原，請務必先進行資料備份！
                    </p>
                </div>

                <button
                    onClick={handleResetData}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                >
                    <Trash2 size={24} />
                    清除所有資料
                </button>
            </div>

            {/* System Info */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <Settings className="text-slate-600" size={32} />
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">系統資訊</h3>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold text-slate-700">系統名稱</span>
                        <span className="font-black text-midnight-blue">補習班排休管理系統</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold text-slate-700">版本</span>
                        <span className="font-black text-midnight-blue">Professional v2.2 (Audit Ready)</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold text-slate-700">資料來源</span>
                        <span className="font-black text-midnight-blue">LocalStorage (Repo Pattern)</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold text-slate-700">語系</span>
                        <span className="font-black text-midnight-blue">繁體中文</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SystemSettings;
