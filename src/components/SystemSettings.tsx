import { useState } from 'react';
import { Settings, Trash2, Sparkles, AlertTriangle, DollarSign, Building2, Plus, Users } from 'lucide-react';
import { useLeaveSystem } from '../context/LeaveContext';
import { calculateAvailable } from '../utils/leaveUtils';
import { createAuditLog } from '../utils/auditLogger';

function SystemSettings() {
    const { employees, branches, addBranch, removeBranch, generateSampleData, resetData, updateEmployee, addAuditLog } = useLeaveSystem();
    const [newBranchInput, setNewBranchInput] = useState('');

    const handleGenerateSampleData = async () => {
        if (confirm('確定要生成範例資料嗎？這將覆蓋現有資料。')) {
            await generateSampleData();

            const log = createAuditLog({
                category: 'system',
                action: 'system_generate_sample',
                details: { employeeCount: 8 }
            });
            await addAuditLog(log);

            alert('範例資料已成功生成！');
        }
    };

    const handleResetData = async () => {
        if (confirm('⚠️ 警告：此操作將清除所有員工資料、排休紀錄並重置系統！\n\n此操作無法復原，確定要繼續嗎？')) {
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
            alert('所有資料已完全清空！');
        }
    };

    const handleAddBranchSubmit = async () => {
        const trimmed = newBranchInput.trim();
        if (!trimmed) {
            alert('請輸入分校名稱');
            return;
        }
        if (branches.includes(trimmed)) {
            alert(`分校【${trimmed}】已存在！`);
            return;
        }

        await addBranch(trimmed);
        setNewBranchInput('');

        const log = createAuditLog({
            category: 'system',
            action: 'system_update' as any,
            details: { action: 'add_branch', branch: trimmed }
        });
        await addAuditLog(log);

        alert(`已成功新增分校【${trimmed}】！`);
    };

    const handleRemoveBranch = async (branchName: string) => {
        // 檢查分校是否有員工
        const assignedEmployees = employees.filter(e => e.branch === branchName);
        if (assignedEmployees.length > 0) {
            alert(`❌ 無法刪除分校【${branchName}】\n\n該校區目前尚有 ${assignedEmployees.length} 位員工（${assignedEmployees.slice(0, 3).map(e => e.name).join('、')}${assignedEmployees.length > 3 ? '…' : ''}）。\n請先前往「員工管理」將員工分校轉移或刪除後，方可移除此分校。`);
            return;
        }

        const validBranches = branches.filter(b => b !== '全部分校');
        if (validBranches.length <= 1) {
            alert('❌ 系統至少需要保留一個分校！');
            return;
        }

        if (confirm(`確定要移除分校【${branchName}】嗎？`)) {
            await removeBranch(branchName);

            const log = createAuditLog({
                category: 'system',
                action: 'system_update' as any,
                details: { action: 'remove_branch', branch: branchName }
            });
            await addAuditLog(log);

            alert(`已成功移除分校【${branchName}】`);
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
        if (cashOutReason === null) return;

        const confirmMsg = `確認執行 Cash Out？\n\n員工：${emp.name}\n假別：${type === 'annual' ? '特休' : '排休'}\n結算天數：${remaining} 天${cashOutReason ? `\n理由：${cashOutReason}` : ''}`;

        if (!confirm(confirmMsg)) return;

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
            <div>
                <h2 className="text-3xl font-black text-midnight-blue tracking-tight">系統設定</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">管理校區分支、年度結算、資料匯出與環境重置</p>
            </div>

            {/* Branch Management */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <Building2 size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">分校校區管理</h3>
                        <p className="text-slate-500 font-medium text-sm">新增、管理或移除補習班各分校校區</p>
                    </div>
                </div>

                {/* Branch Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {branches.filter(b => b !== '全部分校').map((b) => {
                        const count = employees.filter(e => e.branch === b && e.status === '在職').length;
                        return (
                            <div
                                key={b}
                                className="p-5 bg-slate-50 hover:bg-slate-100/80 border-2 border-slate-200/80 rounded-2xl flex items-center justify-between transition-all group shadow-xs"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-midnight-blue font-black shadow-xs">
                                        {b.slice(0, 1)}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800 text-base">{b}</h4>
                                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                            <Users size={12} />
                                            {count} 位在職員工
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveBranch(b)}
                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                    title={`刪除分校 ${b}`}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Add Branch Input */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                    <input
                        type="text"
                        value={newBranchInput}
                        onChange={(e) => setNewBranchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddBranchSubmit()}
                        placeholder="請輸入新分校名稱（例如：板橋校、敦南校）..."
                        className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-midnight-blue outline-none transition-all"
                    />
                    <button
                        type="button"
                        onClick={handleAddBranchSubmit}
                        className="bg-midnight-blue hover:bg-slate-800 active:scale-95 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
                    >
                        <Plus size={18} />
                        新增分校
                    </button>
                </div>
            </div>

            {/* Sample Data Generation */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                        <Sparkles size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">範例資料產生器</h3>
                        <p className="text-slate-500 font-medium text-sm">一鍵生成 8 位涵蓋各校區與假別情境之範例員工</p>
                    </div>
                </div>

                <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-200/60 mb-6">
                    <p className="font-bold text-purple-900 text-sm mb-2">範例資料包含：</p>
                    <ul className="space-y-1 text-purple-800 text-xs font-medium">
                        <li>• 信義校、南港校不同分校員工名冊</li>
                        <li>• 在職、離職、新進半年、資深滿 5 年特休與排休情境</li>
                        <li>• 當月壽星示範資料與 60 天到期警示</li>
                    </ul>
                </div>

                <button
                    type="button"
                    onClick={handleGenerateSampleData}
                    className="w-full bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                    <Sparkles size={20} />
                    生成範例資料
                </button>
            </div>

            {/* Cash Out */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-emerald-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <DollarSign size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">年度結算 (Cash Out)</h3>
                        <p className="text-slate-500 font-medium text-sm">結算員工未使用假別並歸零記錄</p>
                    </div>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {employees.filter(e => e.status === '在職').length === 0 ? (
                        <div className="text-center py-8 text-slate-400 font-bold">目前無在職員工資料</div>
                    ) : (
                        employees.filter(e => e.status === '在職').map(emp => {
                            const annualRemaining = calculateAvailable(emp.annualLeave);
                            const personalRemaining = calculateAvailable(emp.personalLeave);
                            const hasRemaining = annualRemaining > 0 || personalRemaining > 0;

                            return (
                                <div
                                    key={emp.id}
                                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${hasRemaining
                                        ? 'bg-emerald-50/50 border-emerald-200/80'
                                        : 'bg-slate-50 border-slate-100'
                                        }`}
                                >
                                    <div>
                                        <p className="font-black text-midnight-blue text-base">{emp.name}</p>
                                        <p className="text-xs font-bold text-slate-400 mt-0.5">{emp.branch} | 到職：{emp.hireDate}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {annualRemaining > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleCashOut(emp.id, 'annual')}
                                                className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                                            >
                                                結算特休 {annualRemaining} 天
                                            </button>
                                        )}
                                        {personalRemaining > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleCashOut(emp.id, 'personal')}
                                                className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                                            >
                                                結算排休 {personalRemaining} 天
                                            </button>
                                        )}
                                        {!hasRemaining && (
                                            <span className="text-slate-400 font-bold text-xs px-3 py-1.5">
                                                無剩餘額度
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* CSV Export */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <Settings size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-midnight-blue">全校資料匯出</h3>
                        <p className="text-slate-500 font-medium text-sm">匯出員工名冊與假別餘額匯總表</p>
                    </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h4 className="font-black text-slate-800">匯出員工名冊匯總表 (CSV)</h4>
                        <p className="text-xs font-bold text-slate-400 mt-1">包含員工編號、姓名、分校、到職日、特休與排休餘額</p>
                    </div>
                    <button
                        type="button"
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
                            link.download = `employee_roster_${new Date().toISOString().split('T')[0]}.csv`;
                            link.click();
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-all cursor-pointer select-none whitespace-nowrap"
                    >
                        匯出 CSV
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-rose-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                        <AlertTriangle size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-rose-900">危險區域 (Danger Zone)</h3>
                        <p className="text-rose-600 font-medium text-sm">全系統資料重置與徹底清空</p>
                    </div>
                </div>

                <div className="bg-rose-50 p-5 rounded-2xl border border-rose-200 mb-6">
                    <p className="font-bold text-rose-900 text-sm mb-1">⚠️ 注意事項</p>
                    <p className="text-rose-800 text-xs font-medium leading-relaxed">
                        此操作將永久清除所有員工資料、排休紀錄與稽核日誌。此操作無法復原，如需備份請先前往「資料備份」下載備份檔！
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleResetData}
                    className="w-full bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                    <Trash2 size={20} />
                    清空所有資料 (Reset All Data)
                </button>
            </div>
        </div>
    );
}

export default SystemSettings;

