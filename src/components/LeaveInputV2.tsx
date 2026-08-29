import { useState, useMemo } from 'react';
import { X, Edit2, Trash2, Calendar as CalendarIcon, FileText, User, ChevronDown, Check } from 'lucide-react';
import { useLeaveSystem } from '../context/LeaveContext';
import { createAuditLog } from '../utils/auditLogger';
import type { LeaveRecord, TimeSlot } from '../types';

interface LeaveInputV2Props {
    selectedBranch: string;
}

interface DateConfig {
    isFullDay: boolean;
    slots: TimeSlot[];
    note: string;
}

function LeaveInputV2({ selectedBranch }: LeaveInputV2Props) {
    const { employees, leaves: roster, addLeaves, updateEmployee, addAuditLog } = useLeaveSystem();

    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [leaveType, setLeaveType] = useState<'annual' | 'personal'>('annual');

    // Config State
    const [datesConfig, setDatesConfig] = useState<Record<string, DateConfig>>({});

    // UI State
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    const filteredEmployees = selectedBranch === '全部分校'
        ? employees.filter(emp => emp.status === '在職')
        : employees.filter(emp => emp.branch === selectedBranch && emp.status === '在職');

    // Calendar Generation
    const { calendar, year, month } = useMemo(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const cal: (number | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i++) cal.push(null);
        for (let i = 1; i <= daysInMonth; i++) cal.push(i);

        return { calendar: cal, year: y, month: m };
    }, []);

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // Actions
    const toggleDate = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        setDatesConfig(prev => {
            const newConfig = { ...prev };
            if (newConfig[dateStr]) {
                delete newConfig[dateStr];
            } else {
                newConfig[dateStr] = { isFullDay: true, slots: [], note: '' };
            }
            return newConfig;
        });
    };

    const handleSaveConfig = (config: DateConfig) => {
        if (!editingDate) return;
        setDatesConfig(prev => ({ ...prev, [editingDate]: config }));
        setEditingDate(null);
    };

    const removeDate = (dateStr: string) => {
        setDatesConfig(prev => {
            const newConfig = { ...prev };
            delete newConfig[dateStr];
            return newConfig;
        });
    };

    const handlePreSubmit = () => {
        if (!selectedEmployee || Object.keys(datesConfig).length === 0) {
            alert('請選擇員工和日期');
            return;
        }
        setIsReviewOpen(true);
    };

    const handleFinalSubmit = async () => {
        const employee = employees.find(emp => emp.id === selectedEmployee);
        if (!employee) {
            alert('找不到員工資料，請重新選擇');
            return;
        }

        // Conflict Check
        const conflicts: string[] = [];
        Object.keys(datesConfig).forEach(dateStr => {
            const othersOnLeave = roster.filter(r =>
                r.startDate === dateStr &&
                r.branch === employee.branch &&
                r.employeeId !== employee.id
            );
            if (othersOnLeave.length >= 2) {
                conflicts.push(`${dateStr} (已有 ${othersOnLeave.length} 人排休)`);
            }
        });

        if (conflicts.length > 0) {
            const confirmed = window.confirm(
                `⚠️ 注意：以下日期同分校已有較多人排休，是否仍要繼續？\n\n${conflicts.join('\n')}`
            );
            if (!confirmed) return;
        }

        // Monthly Quota Check for Personal Leave
        if (leaveType === 'personal' && employee.monthlyPersonalQuota > 0) {
            const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const existingInMonth = roster.filter(r =>
                r.employeeId === employee.id &&
                r.leaveType === 'personal' &&
                r.startDate.startsWith(currentMonthStr)
            );
            const existingDays = existingInMonth.reduce((sum, r) => sum + r.days, 0);
            const selectingDays = Object.values(datesConfig).reduce((sum, config) => sum + (config.isFullDay ? 1 : config.slots.length * 0.5), 0);

            if (existingDays + selectingDays > employee.monthlyPersonalQuota) {
                const confirmed = window.confirm(
                    `⚠️ 超過每月排休限額：\n` +
                    `本月已排：${existingDays} 天\n` +
                    `本次新增：${selectingDays} 天\n` +
                    `總計(${existingDays + selectingDays} 天) 將超過每月額度(${employee.monthlyPersonalQuota} 天)。\n\n` +
                    `是否仍要繼續提交？`
                );
                if (!confirmed) return;
            }
        }

        const newRecords: LeaveRecord[] = [];
        let totalDaysDeducted = 0;
        const sortedDatesList = Object.keys(datesConfig).sort();

        Object.entries(datesConfig).forEach(([dateStr, config]) => {
            const days = config.isFullDay ? 1 : config.slots.length * 0.5;
            const slotMap: Record<TimeSlot, string> = { morning: '上午', afternoon: '下午', evening: '晚上' };
            const timeSlotDesc = config.isFullDay
                ? undefined
                : config.slots.map(s => slotMap[s]).join('、');

            newRecords.push({
                id: `leave-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                employeeId: employee.id,
                employeeName: employee.name,
                branch: employee.branch,
                leaveType,
                startDate: dateStr,
                endDate: dateStr,
                isFullDay: config.isFullDay,
                timeSlot: timeSlotDesc,
                slots: config.isFullDay ? undefined : config.slots,
                note: config.note,
                days,
                createdAt: new Date().toISOString(),
            });

            totalDaysDeducted += days;
        });

        // Save Data in Batch
        await addLeaves(newRecords);

        // Update Quota
        const updatedEmployee = { ...employee };
        if (leaveType === 'annual') {
            updatedEmployee.annualLeave = { ...updatedEmployee.annualLeave, used: updatedEmployee.annualLeave.used + totalDaysDeducted };
        } else {
            updatedEmployee.personalLeave = { ...updatedEmployee.personalLeave, used: updatedEmployee.personalLeave.used + totalDaysDeducted };
        }
        await updateEmployee(updatedEmployee);

        // Log batch leave creation
        const log = createAuditLog({
            category: 'leave',
            action: 'leave_batch_create',
            employeeId: employee.id,
            employeeName: employee.name,
            details: {
                leaveType,
                count: newRecords.length,
                days: totalDaysDeducted,
                dateRange: `${sortedDatesList[0]} ~ ${sortedDatesList[sortedDatesList.length - 1]}`
            }
        });
        await addAuditLog(log);

        // Reset
        setIsReviewOpen(false);
        setDatesConfig({});
        setSelectedEmployee('');
        alert(`成功錄入排休！共扣除 ${totalDaysDeducted} 天。`);
    };

    const sortedDates = Object.keys(datesConfig).sort();
    const themeColor = leaveType === 'annual' ? 'orange' : 'blue';

    const totalReviewDays = Object.values(datesConfig).reduce((acc, curr) => acc + (curr.isFullDay ? 1 : curr.slots.length * 0.5), 0);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
                <h2 className="text-3xl font-black text-midnight-blue">排休申請</h2>

                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <div className="relative group min-w-[200px] flex-1 md:flex-none">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                            <User size={20} />
                        </div>
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="w-full pl-10 pr-10 py-3 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-700 appearance-none focus:outline-none focus:border-midnight-blue hover:border-slate-300 transition-all shadow-sm"
                        >
                            <option value="">請選擇員工</option>
                            {filteredEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.branch})</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                            <ChevronDown size={20} />
                        </div>
                    </div>

                    <div className="flex bg-slate-100 rounded-2xl p-1.5 border border-slate-200/50 shadow-inner relative">
                        <div
                            className={`absolute top-1.5 bottom-1.5 rounded-xl bg-white shadow-sm transition-all duration-300 ease-out z-0`}
                            style={{
                                width: 'calc(50% - 6px)',
                                left: leaveType === 'annual' ? '6px' : 'calc(50%)'
                            }}
                        />

                        <button
                            onClick={() => setLeaveType('annual')}
                            className={`relative z-10 flex-1 px-6 py-2.5 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 ${leaveType === 'annual' ? 'text-orange-500 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${leaveType === 'annual' ? 'bg-orange-500' : 'bg-slate-300'}`} />
                            特休
                        </button>
                        <button
                            onClick={() => setLeaveType('personal')}
                            className={`relative z-10 flex-1 px-6 py-2.5 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2 ${leaveType === 'personal' ? 'text-blue-500 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${leaveType === 'personal' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                            排休
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
                <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden order-2 lg:order-1">
                    <div className={`flex-1 bg-white rounded-[2.5rem] shadow-xl border-2 border-slate-100 flex flex-col min-h-0 overflow-hidden transition-all duration-300 ${sortedDates.length === 0 ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                        <div className="p-5 flex-shrink-0 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                                <FileText size={20} className="text-slate-400" />
                                已選清單
                            </h3>
                            <div className="mt-1 flex justify-between items-baseline">
                                <span className="text-xs font-bold text-slate-400">共 {sortedDates.length} 筆</span>
                                <span className={`text-xl font-black ${leaveType === 'annual' ? 'text-orange-500' : 'text-blue-500'}`}>
                                    {totalReviewDays}
                                    <span className="text-xs text-slate-400 ml-1">天</span>
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {sortedDates.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 min-h-[150px]">
                                    <CalendarIcon size={32} />
                                    <span className="font-bold text-sm">點擊日曆選擇日期</span>
                                </div>
                            ) : (
                                sortedDates.map(dateStr => {
                                    const config = datesConfig[dateStr];
                                    return (
                                        <div key={dateStr} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all group">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="font-black text-slate-700">
                                                        {dateStr.slice(5)} <span className="text-xs font-normal text-slate-400">({new Date(dateStr).toLocaleDateString('zh-TW', { weekday: 'narrow' })})</span>
                                                    </div>
                                                    <div className="text-xs font-bold text-slate-500 mt-1 flex flex-wrap gap-1">
                                                        <span className={`px-1.5 py-0.5 rounded-md ${config.isFullDay ? 'bg-slate-200' : 'bg-white border'}`}>
                                                            {config.isFullDay ? '全天' : `時段 (${config.slots.length * 0.5}天)`}
                                                        </span>
                                                        {config.note && <span className="text-slate-400 truncate max-w-[80px]">- {config.note}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingDate(dateStr)} className="p-1.5 text-slate-400 hover:text-midnight-blue hover:bg-white rounded-lg"><Edit2 size={14} /></button>
                                                    <button onClick={() => removeDate(dateStr)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {sortedDates.length > 0 && (
                            <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-white">
                                <button
                                    onClick={handlePreSubmit}
                                    className={`w-full py-3.5 rounded-2xl shadow-lg font-black text-white text-base transition-all flex items-center justify-center gap-2 ${leaveType === 'annual' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'} transform hover:scale-[1.02] active:scale-95`}
                                >
                                    <Check size={20} />
                                    準備提交
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-9 flex flex-col h-full min-h-0 order-1 lg:order-2">
                    <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-xl border-2 border-slate-100 h-full flex flex-col overflow-hidden relative">
                        <div className="flex justify-between items-center mb-6 flex-shrink-0 z-10">
                            <h3 className="text-2xl font-black text-midnight-blue flex items-center gap-2">
                                {year} 年 {month + 1} 月
                                {!selectedEmployee && (
                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg font-bold">請先選擇員工</span>
                                )}
                            </h3>
                            <div className="flex gap-4 text-sm font-bold">
                                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-orange-500 rounded-full ring-2 ring-orange-100"></div>特休</span>
                                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-blue-100"></div>排休</span>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 relative">
                            <div className="grid grid-cols-7 mb-2">
                                {weekDays.map(day => (
                                    <div key={day} className="text-center font-black text-slate-300 py-1 text-sm">{day}</div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-2 h-[calc(100%-30px)] auto-rows-[1fr]">
                                {calendar.map((day, index) => {
                                    if (day === null) return <div key={`empty-${index}`} className="bg-transparent" />;

                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const config = datesConfig[dateStr];
                                    const isSelected = !!config;
                                    const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                                    let containerClasses = "w-full h-full rounded-2xl relative transition-all duration-200 border-2 flex flex-col items-center justify-start py-2 gap-1 group overflow-hidden ";

                                    if (isSelected) {
                                        containerClasses += leaveType === 'annual'
                                            ? "bg-orange-500 border-orange-500 text-white shadow-md transform scale-[0.98] z-10"
                                            : "bg-blue-500 border-blue-500 text-white shadow-md transform scale-[0.98] z-10";
                                    } else {
                                        containerClasses += isToday
                                            ? "border-midnight-blue bg-midnight-blue/5 text-midnight-blue"
                                            : "border-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-50";
                                    }

                                    if (!selectedEmployee) containerClasses += " opacity-50 cursor-not-allowed";
                                    else containerClasses += " cursor-pointer";

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => selectedEmployee && toggleDate(day)}
                                            disabled={!selectedEmployee}
                                            className={containerClasses}
                                        >
                                            <span className={`text-lg font-bold leading-none ${isSelected ? 'text-white' : 'text-slate-700'}`}>{day}</span>

                                            {isSelected && (
                                                <div className="flex flex-col items-center gap-0.5 w-full px-1">
                                                    <div className="bg-white/20 backdrop-blur-sm rounded-md px-1.5 py-0.5 min-w-[30px]">
                                                        <span className="text-[10px] font-black leading-tight block text-center">
                                                            {config.isFullDay ? '1.0' : config.slots.length * 0.5}
                                                        </span>
                                                    </div>
                                                    {config.note && <div className="w-1 h-1 rounded-full bg-white mt-0.5" />}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {editingDate && (
                <DetailModal
                    dateStr={editingDate}
                    initialConfig={datesConfig[editingDate]}
                    themeColor={themeColor}
                    onSave={handleSaveConfig}
                    onClose={() => setEditingDate(null)}
                />
            )}

            {isReviewOpen && (
                <ReviewModal
                    employeeName={filteredEmployees.find(e => e.id === selectedEmployee)?.name || ''}
                    leaveType={leaveType}
                    datesConfig={datesConfig}
                    totalDays={totalReviewDays}
                    themeColor={themeColor}
                    onConfirm={handleFinalSubmit}
                    onCancel={() => setIsReviewOpen(false)}
                    onEdit={(dateStr: string) => setEditingDate(dateStr)}
                />
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 99px; }
            `}</style>
        </div>
    );
}

function DetailModal({ dateStr, initialConfig, themeColor, onSave, onClose }: {
    dateStr: string;
    initialConfig: DateConfig;
    themeColor: 'orange' | 'blue';
    onSave: (config: DateConfig) => void;
    onClose: () => void;
}) {
    const [config, setConfig] = useState<DateConfig>(initialConfig);

    const toggleSlot = (slot: TimeSlot) => {
        let newSlots = [...config.slots];
        if (newSlots.includes(slot)) {
            newSlots = newSlots.filter(s => s !== slot);
        } else if (newSlots.length < 2) {
            newSlots.push(slot);
        }
        setConfig({ ...config, slots: newSlots });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className={`bg-white rounded-[2rem] w-full max-w-sm shadow-2xl border-4 ${themeColor === 'orange' ? 'border-orange-500' : 'border-blue-500'} overflow-hidden animate-in fade-in zoom-in duration-200`}>
                <div className={`${themeColor === 'orange' ? 'bg-orange-500' : 'bg-blue-500'} p-6 flex justify-between items-center text-white`}>
                    <h3 className="text-2xl font-black">{dateStr.slice(5)} ({new Date(dateStr).toLocaleDateString('zh-TW', { weekday: 'narrow' })})</h3>
                    <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-2">
                        <button
                            onClick={() => setConfig({ ...config, isFullDay: true, slots: [] })}
                            className={`flex-1 py-3 rounded-xl font-bold transition-all ${config.isFullDay ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                        >
                            全天 (1.0)
                        </button>
                        <button
                            onClick={() => setConfig({ ...config, isFullDay: false, slots: config.slots.length > 0 ? config.slots : ['morning'] })}
                            className={`flex-1 py-3 rounded-xl font-bold transition-all ${!config.isFullDay ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                        >
                            時段 (0.5/1.0)
                        </button>
                    </div>
                    {!config.isFullDay && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 mb-2 text-center">請選擇 1~2 個時段 (多選)</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(['morning', 'afternoon', 'evening'] as const).map(slot => (
                                    <button
                                        key={slot}
                                        onClick={() => toggleSlot(slot)}
                                        disabled={!config.slots.includes(slot) && config.slots.length >= 2}
                                        className={`py-3 rounded-xl font-bold border-2 transition-all 
                                            ${config.slots.includes(slot)
                                                ? `${themeColor === 'orange' ? 'bg-orange-500 border-orange-500' : 'bg-blue-500 border-blue-500'} text-white shadow-md transform scale-105`
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}
                                            disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-50
                                        `}
                                    >
                                        {slot === 'morning' ? '上午' : slot === 'afternoon' ? '下午' : '晚上'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-bold text-slate-500 mb-2 block">備註</label>
                        <textarea
                            value={config.note || ''}
                            onChange={e => setConfig({ ...config, note: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl font-bold focus:outline-none focus:border-slate-400 h-24 resize-none"
                            placeholder="請輸入備註..."
                        />
                    </div>
                    <button
                        onClick={() => {
                            if (!config.isFullDay && config.slots.length === 0) {
                                alert('請至少選擇一個時段');
                                return;
                            }
                            onSave(config);
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-white text-lg shadow-xl ${themeColor === 'orange' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'}`}
                    >
                        儲存設定
                    </button>
                </div>
            </div>
        </div>
    );
}

function ReviewModal({ employeeName, leaveType, datesConfig, totalDays, themeColor, onConfirm, onCancel, onEdit }: {
    employeeName: string;
    leaveType: 'annual' | 'personal';
    datesConfig: Record<string, DateConfig>;
    totalDays: number;
    themeColor: 'orange' | 'blue';
    onConfirm: () => void;
    onCancel: () => void;
    onEdit: (dateStr: string) => void;
}) {
    return (
        <div className="fixed inset-0 bg-midnight-blue/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                <div className={`${themeColor === 'orange' ? 'bg-orange-500' : 'bg-blue-500'} p-8 text-white relative overflow-hidden flex-shrink-0`}>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 opacity-90">
                            <CalendarIcon size={20} />
                            <span className="font-bold text-base">待提交排休卡片</span>
                        </div>
                        <h2 className="text-3xl font-black mb-1">{employeeName}</h2>
                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full font-bold text-sm backdrop-blur-md mt-1">
                            申請假別：{leaveType === 'annual' ? '特休假' : '排休假'}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="space-y-3">
                        {Object.entries(datesConfig).sort().map(([dateStr, config]) => (
                            <div
                                key={dateStr}
                                className="flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border-l-[6px] hover:bg-slate-100 transition-colors group"
                                style={{ borderColor: leaveType === 'annual' ? '#f97316' : '#3b82f6' }}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-black text-xl text-slate-700">{dateStr.slice(5)}</span>
                                        <span className="text-sm font-bold text-slate-400">({new Date(dateStr).toLocaleDateString('zh-TW', { weekday: 'narrow' })})</span>
                                    </div>
                                    <div className="text-slate-500 font-bold text-sm mt-1 flex items-center gap-2 overflow-hidden">
                                        <span className="shrink-0 px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-600 font-bold">
                                            {config.isFullDay ? '全天' : `時段 ${config.slots.length * 0.5}天`}
                                        </span>
                                        {!config.isFullDay && (
                                            <span className="text-xs text-slate-400 truncate">
                                                {config.slots.map(s => s === 'morning' ? '早' : s === 'afternoon' ? '午' : '晚').join('、')}
                                            </span>
                                        )}
                                        {config.note && <span className="text-slate-400 truncate">- {config.note}</span>}
                                    </div>
                                </div>

                                <button
                                    onClick={() => onEdit(dateStr)}
                                    className="p-3 bg-white border-2 border-slate-200 rounded-xl shadow-sm text-slate-400 hover:text-midnight-blue hover:border-midnight-blue hover:shadow-md transition-all shrink-0"
                                >
                                    <Edit2 size={20} className="text-slate-500 group-hover:text-midnight-blue" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex-shrink-0">
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-slate-500 font-bold">總計天數</span>
                        <span className={`text-4xl font-black ${themeColor === 'orange' ? 'text-orange-500' : 'text-blue-500'}`}>
                            {totalDays}
                            <span className="text-lg ml-1 text-slate-400">天</span>
                        </span>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-white border-2 border-slate-200 hover:bg-slate-100 transition-all"
                        >
                            返回修改
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-4 rounded-2xl font-black text-white shadow-xl ${themeColor === 'orange' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'} transition-all`}
                        >
                            確認提交
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LeaveInputV2;

