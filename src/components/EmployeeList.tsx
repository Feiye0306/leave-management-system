import { useState } from 'react';
import { Search, Edit, X, UserPlus, Trash2, Plus, Minus, TrendingUp } from 'lucide-react';
import { useLeaveSystem } from '../context/LeaveContext';
import { calculateAvailable, calculateAnnualLeave } from '../utils/leaveUtils';
import { createAuditLog } from '../utils/auditLogger';
import type { Employee } from '../types';

interface EmployeeListProps {
    selectedBranch: string;
}

function EmployeeList({ selectedBranch }: EmployeeListProps) {
    const { employees, addEmployee, updateEmployee, deleteEmployee, addAuditLog } = useLeaveSystem();
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    // Edit State - Enhanced
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [adjustmentType, setAdjustmentType] = useState<'annual' | 'personal'>('annual');
    const [adjustmentStep, setAdjustmentStep] = useState<number>(1); // 1, 0.5, 0.25
    const [reason, setReason] = useState<string>('');

    // Add Employee State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newEmp, setNewEmp] = useState<{
        name: string;
        id: string;
        branch: string;
        hireDate: string;
        annualInitial: number;
        personalInitial: number;
        monthlyQuota: number;
    }>({
        name: '',
        id: '',
        branch: '信義校',
        hireDate: new Date().toISOString().split('T')[0],
        annualInitial: 0,
        personalInitial: 0,
        monthlyQuota: 4
    });

    let filteredEmployees = employees;

    if (selectedBranch !== '全部分校') {
        filteredEmployees = filteredEmployees.filter(emp => emp.branch === selectedBranch);
    }

    if (!showInactive) {
        filteredEmployees = filteredEmployees.filter(emp => emp.status === '在職');
    }

    if (searchTerm) {
        filteredEmployees = filteredEmployees.filter(emp =>
            emp.name.includes(searchTerm) || emp.id.includes(searchTerm)
        );
    }

    // Get current employee and quota
    const currentQuota = editingEmployee
        ? calculateAvailable(adjustmentType === 'annual' ? editingEmployee.annualLeave : editingEmployee.personalLeave)
        : 0;

    const handleAdjustQuota = async (amount: number) => {
        if (!editingEmployee) return;

        const leaveData = adjustmentType === 'annual' ? editingEmployee.annualLeave : editingEmployee.personalLeave;
        const before = calculateAvailable(leaveData);
        const after = before + amount;

        if (after < 0) {
            alert('調整後額度不能為負數');
            return;
        }

        const confirmMsg = `確認調整 ${editingEmployee.name} 的${adjustmentType === 'annual' ? '特休' : '排休'}額度？\n\n當前額度：${before} 天\n調整量：${amount > 0 ? '+' : ''}${amount} 天\n調整後：${after} 天${reason ? `\n理由：${reason}` : ''}`;

        if (!confirm(confirmMsg)) return;

        // Update employee quota by adjusting 'adjustment' field
        const updated = { ...editingEmployee };
        if (adjustmentType === 'annual') {
            updated.annualLeave = {
                ...updated.annualLeave,
                adjustment: (updated.annualLeave.adjustment || 0) + amount
            };
        } else {
            updated.personalLeave = {
                ...updated.personalLeave,
                adjustment: (updated.personalLeave.adjustment || 0) + amount
            };
        }

        await updateEmployee(updated);

        // Log the adjustment
        const log = createAuditLog({
            category: 'employee',
            action: adjustmentType === 'annual' ? 'adjust_annual' : 'adjust_personal',
            employeeId: editingEmployee.id,
            employeeName: editingEmployee.name,
            before,
            after,
            amount,
            reason: reason || undefined
        });
        await addAuditLog(log);

        alert(`額度調整成功！\n${editingEmployee.name} 的${adjustmentType === 'annual' ? '特休' : '排休'}已${amount > 0 ? '增加' : '減少'} ${Math.abs(amount)} 天`);
        setEditingEmployee(null);
        setReason('');
        setAdjustmentStep(1);
    };

    const openEditModal = (emp: Employee) => {
        setEditingEmployee(emp);
        setAdjustmentType('annual');
        setAdjustmentStep(1);
        setReason('');
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`確定要刪除員工 ${name} 嗎？此動作無法復原。`)) {
            // Log before deletion
            const log = createAuditLog({
                category: 'employee',
                action: 'employee_delete',
                employeeId: id,
                employeeName: name,
                details: { deletedAt: new Date().toISOString() }
            });
            await addAuditLog(log);
            await deleteEmployee(id);
        }
    };

    const handleAddEmployeeSubmit = async () => {
        if (!newEmp.name || !newEmp.name.trim()) {
            alert('請填寫員工姓名');
            return;
        }

        try {
            const { expiry } = calculateAnnualLeave(newEmp.hireDate);

            const currentIds = employees.map(e => {
                const match = e.id.match(/\d+/);
                return match ? parseInt(match[0]) : 0;
            });
            const nextIdNum = currentIds.length > 0 ? Math.max(...currentIds) + 1 : 1;
            const newId = `emp${String(nextIdNum).padStart(3, '0')}`;

            const newEmployeeData: Employee = {
                id: newId,
                name: newEmp.name.trim(),
                branch: newEmp.branch,
                status: '在職',
                hireDate: newEmp.hireDate,
                annualLeave: {
                    initial: Number(newEmp.annualInitial) || 0,
                    earned: 0,
                    used: 0,
                    adjustment: 0,
                    expiry: expiry
                },
                personalLeave: {
                    initial: Number(newEmp.personalInitial) || 0,
                    earned: 0,
                    used: 0,
                    adjustment: 0
                },
                monthlyPersonalQuota: Number(newEmp.monthlyQuota) || 4
            };

            await addEmployee(newEmployeeData);

            // Log employee creation
            const log = createAuditLog({
                category: 'employee',
                action: 'employee_create',
                employeeId: newId,
                employeeName: newEmp.name.trim(),
                details: {
                    branch: newEmp.branch,
                    hireDate: newEmp.hireDate,
                    annualInitial: Number(newEmp.annualInitial) || 0,
                    personalInitial: Number(newEmp.personalInitial) || 0,
                    monthlyQuota: Number(newEmp.monthlyQuota) || 4
                }
            });
            await addAuditLog(log);

            setIsAddModalOpen(false);
            setNewEmp({
                name: '',
                id: '',
                branch: '信義校',
                hireDate: new Date().toISOString().split('T')[0],
                annualInitial: 0,
                personalInitial: 0,
                monthlyQuota: 4
            });
            alert(`員工新增成功！系統配號: ${newId}`);
        } catch (error) {
            console.error('新增員工錯誤:', error);
            alert('新增員工時發生錯誤，請重試');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-midnight-blue">員工管理</h2>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-midnight-blue hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold shadow-lg flex items-center gap-2 transition-all"
                >
                    <UserPlus size={20} />
                    新增員工
                </button>
            </div>

            {/* 搜尋與篩選 */}
            <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex-1 relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="搜尋員工姓名或編號..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border-none bg-slate-50 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 text-slate-700"
                    />
                </div>

                <div
                    onClick={() => setShowInactive(!showInactive)}
                    className="flex items-center gap-3 cursor-pointer bg-slate-50 px-5 py-3 rounded-xl hover:bg-slate-100 transition-all select-none group"
                >
                    <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${showInactive ? 'bg-slate-500' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 content-[''] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${showInactive ? 'translate-x-7' : 'translate-x-1'}`} />
                    </div>
                    <span className={`text-sm font-bold ${showInactive ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-500'}`}>顯示離職人員</span>
                </div>
            </div>

            {/* 員工列表 */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border-2 border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-midnight-blue text-white">
                            <tr>
                                <th className="px-6 py-4 font-black">姓名</th>
                                <th className="px-6 py-4 font-black">分校</th>
                                <th className="px-6 py-4 font-black">狀態</th>
                                <th className="px-6 py-4 font-black">特休餘額</th>
                                <th className="px-6 py-4 font-black">排休餘額</th>
                                <th className="px-6 py-4 font-black">每月固定排休</th>
                                <th className="px-6 py-4 font-black w-48 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map((emp, index) => {
                                const annualAvailable = calculateAvailable(emp.annualLeave);
                                const personalAvailable = calculateAvailable(emp.personalLeave);

                                return (
                                    <tr
                                        key={emp.id}
                                        className={`border-b border-slate-100 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}
                                    >
                                        <td className="px-6 py-4 font-bold text-slate-900">
                                            {emp.name}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">{emp.branch}</td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-black ${emp.status === '在職'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-slate-200 text-slate-600'
                                                    }`}
                                            >
                                                {emp.status}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 font-bold ${annualAvailable < 0 ? 'text-red-600' : 'text-orange-500'}`}>
                                            {annualAvailable} 天
                                        </td>
                                        <td className={`px-6 py-4 font-bold ${personalAvailable < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                            {personalAvailable} 天
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-500">
                                            {emp.monthlyPersonalQuota} 天/月
                                        </td>
                                        <td className="px-6 py-4 flex justify-center gap-2">
                                            <button
                                                onClick={() => openEditModal(emp)}
                                                className="bg-slate-100 hover:bg-midnight-blue hover:text-white text-slate-600 px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1 text-sm"
                                            >
                                                <Edit size={16} />
                                                調整
                                            </button>
                                            <button
                                                onClick={() => handleDelete(emp.id, emp.name)}
                                                className="bg-red-50 hover:bg-red-100 text-red-500 px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1 text-sm"
                                                title="刪除員工"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredEmployees.length === 0 && (
                    <div className="text-center py-12 text-slate-500 font-bold">
                        查無員工資料
                    </div>
                )}
            </div>

            {/* A. 新增員工彈窗 */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-lg w-full animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-black text-midnight-blue">新增員工</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 gap-y-6">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-bold text-slate-700 mb-2">姓名</label>
                                <input
                                    type="text"
                                    value={newEmp.name}
                                    onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                                    placeholder="請輸入姓名"
                                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl font-bold focus:border-midnight-blue outline-none"
                                />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-sm font-bold text-slate-400 mb-2">編號 (自動生成)</label>
                                <div className="w-full px-4 py-2 border-2 border-slate-100 bg-slate-50 text-slate-400 rounded-xl font-bold flex items-center select-none">
                                    系統自動配號
                                </div>
                            </div>

                            <div className="col-span-1">
                                <label className="block text-sm font-bold text-slate-700 mb-2">分校</label>
                                <select
                                    value={newEmp.branch}
                                    onChange={e => setNewEmp({ ...newEmp, branch: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl font-bold"
                                >
                                    <option value="信義校">信義校</option>
                                    <option value="南港校">南港校</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-bold text-slate-700 mb-2">到職日</label>
                                <input
                                    type="date"
                                    value={newEmp.hireDate}
                                    onChange={e => setNewEmp({ ...newEmp, hireDate: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl font-bold"
                                />
                            </div>

                            <div className="col-span-2 border-t border-slate-100 pt-4">
                                <h4 className="font-bold text-midnight-blue mb-4">初始額度設定</h4>
                            </div>

                            <div className="col-span-1">
                                <label className="block text-sm font-bold text-orange-500 mb-2">特休初始餘額</label>
                                <input
                                    type="number"
                                    value={newEmp.annualInitial}
                                    onChange={e => setNewEmp({ ...newEmp, annualInitial: Number(e.target.value) })}
                                    className="w-full px-4 py-2 border-2 border-orange-200 rounded-xl font-bold focus:border-orange-500 outline-none"
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-bold text-blue-500 mb-2">排休初始餘額</label>
                                <input
                                    type="number"
                                    value={newEmp.personalInitial}
                                    onChange={e => setNewEmp({ ...newEmp, personalInitial: Number(e.target.value) })}
                                    className="w-full px-4 py-2 border-2 border-blue-200 rounded-xl font-bold focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">每月固定排休額度</label>
                                <input
                                    type="number"
                                    value={newEmp.monthlyQuota}
                                    onChange={e => setNewEmp({ ...newEmp, monthlyQuota: Number(e.target.value) })}
                                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl font-bold"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleAddEmployeeSubmit}
                            className="w-full mt-8 bg-midnight-blue text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg cursor-pointer select-none flex items-center justify-center"
                        >
                            確認新增
                        </button>
                    </div>
                </div>
            )}

            {/* B. 額度調整彈窗 - Enhanced */}
            {editingEmployee && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[2.5rem] p-8 shadow-2xl max-w-2xl w-full animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="text-indigo-600" size={32} />
                                <div>
                                    <h3 className="text-2xl font-black text-midnight-blue">
                                        額度調整 - {editingEmployee.name}
                                    </h3>
                                    <p className="text-sm font-medium text-slate-500">{editingEmployee.branch}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingEmployee(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left: Controls */}
                            <div className="space-y-4">
                                {/* Leave Type Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">假別類型</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setAdjustmentType('annual')}
                                            className={`flex-1 py-3 rounded-xl font-bold transition-all ${adjustmentType === 'annual'
                                                ? 'bg-orange-500 text-white shadow-lg ring-2 ring-orange-300'
                                                : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-orange-300'
                                                }`}
                                        >
                                            特休
                                        </button>
                                        <button
                                            onClick={() => setAdjustmentType('personal')}
                                            className={`flex-1 py-3 rounded-xl font-bold transition-all ${adjustmentType === 'personal'
                                                ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-300'
                                                : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-blue-300'
                                                }`}
                                        >
                                            排休
                                        </button>
                                    </div>
                                </div>

                                {/* Adjustment Step */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">調整單位</label>
                                    <div className="flex gap-2">
                                        {[1, 0.5, 0.25].map(step => (
                                            <button
                                                key={step}
                                                onClick={() => setAdjustmentStep(step)}
                                                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${adjustmentStep === step
                                                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                                                    }`}
                                            >
                                                {step === 1 ? '1天' : step === 0.5 ? '0.5天' : '0.25天'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Reason Input */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">調整理由（選填）</label>
                                    <input
                                        type="text"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="例如：補償加班、特殊獎勵..."
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                    />
                                </div>
                            </div>

                            {/* Right: Preview & Actions */}
                            <div className="space-y-4">
                                {/* Current Quota Display */}
                                <div className="bg-white rounded-2xl p-6 border-2 border-indigo-100">
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-500 mb-2">當前額度</p>
                                        <p className="text-5xl font-black text-indigo-600 mb-1">{currentQuota}</p>
                                        <p className="text-sm font-medium text-slate-400">天</p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <p className="text-xs font-bold text-slate-600 text-center">
                                            {adjustmentType === 'annual' ? '特休' : '排休'}
                                        </p>
                                    </div>
                                </div>

                                {/* Adjustment Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleAdjustQuota(-adjustmentStep)}
                                        className="bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <Minus size={20} />
                                        減少 {adjustmentStep}
                                    </button>
                                    <button
                                        onClick={() => handleAdjustQuota(adjustmentStep)}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={20} />
                                        增加 {adjustmentStep}
                                    </button>
                                </div>

                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                    <p className="text-xs font-bold text-amber-800 text-center">
                                        💡 提示：調整會立即生效並記錄於操作日誌
                                    </p>
                                </div>

                                <button
                                    onClick={() => setEditingEmployee(null)}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all"
                                >
                                    關閉
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EmployeeList;
