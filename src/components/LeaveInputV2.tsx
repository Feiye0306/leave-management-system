import { useState, useMemo } from 'react';
import { X, Edit2, Trash2, Calendar as CalendarIcon, FileText, User, ChevronDown, Check, ArrowRightLeft, Clock, AlertCircle } from 'lucide-react';
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
    const { employees, leaves: roster, addLeaves, updateEmployee, updateLeave, deleteLeave, addAuditLog } = useLeaveSystem();

    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [leaveType, setLeaveType] = useState<'annual' | 'personal'>('annual');

    // Config State for New Leaves
    const [datesConfig, setDatesConfig] = useState<Record<string, DateConfig>>({});

    // UI State
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [managingLeave, setManagingLeave] = useState<LeaveRecord | null>(null);
    const [activeTab, setActiveTab] = useState<'calendar' | 'existing'>('calendar');

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

    // 該員工本月已登記之所有排休假單
    const employeeExistingLeaves = useMemo(() => {
        if (!selectedEmployee) return [];
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        return roster.filter(r =>
            r.employeeId === selectedEmployee &&
            r.startDate.startsWith(currentMonthPrefix)
        ).sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [roster, selectedEmployee, year, month]);

    // 所有人在本月的排休（用於分校檢視）
    const branchMonthLeaves = useMemo(() => {
        const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        return roster.filter(r => {
            const matchesBranch = selectedBranch === '全部分校' || r.branch === selectedBranch;
            return matchesBranch && r.startDate.startsWith(currentMonthPrefix);
        }).sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [roster, selectedBranch, year, month]);

    // 日期對應已排休假單字典
    const leavesByDate = useMemo(() => {
        const map: Record<string, LeaveRecord> = {};
        employeeExistingLeaves.forEach(leave => {
            map[leave.startDate] = leave;
        });
        return map;
    }, [employeeExistingLeaves]);

    // Actions
    const handleDateClick = (day: number) => {
        if (!selectedEmployee) return;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // 若該日期已經有已排休假單，直接點擊開啟管理/更正視窗
        const existing = leavesByDate[dateStr];
        if (existing) {
            setManagingLeave(existing);
            return;
        }

        // 否則切換新選取狀態
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

    const removeDate = (dateStr: string) => {
        setDatesConfig(prev => {
            const newConfig = { ...prev };
            delete newConfig[dateStr];
            return newConfig;
        });
    };

    const handleSaveConfig = (config: DateConfig) => {
        if (!editingDate) return;
        setDatesConfig(prev => ({ ...prev, [editingDate]: config }));
        setEditingDate(null);
    };

    const handlePreSubmit = () => {
        if (!selectedEmployee || Object.keys(datesConfig).length === 0) {
            alert('請選擇員工和排休日期');
            return;
        }
        setIsReviewOpen(true);
    };

    const handleFinalSubmit = async () => {
        const employee = employees.find(emp => emp.id === selectedEmployee);
        if (!employee) return;

        const newRecords: LeaveRecord[] = [];
        let totalDaysDeducted = 0;

        Object.entries(datesConfig).forEach(([dateStr, config]) => {
            const days = config.isFullDay ? 1 : config.slots.length * 0.5;
            const slotMap: Record<TimeSlot, string> = { morning: '上午', afternoon: '下午', evening: '晚上' };
            const timeSlotDesc = config.isFullDay ? undefined : config.slots.map(s => slotMap[s]).join('、');

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

        await addLeaves(newRecords);

        const updatedEmployee = { ...employee };
        if (leaveType === 'annual') {
            updatedEmployee.annualLeave = { ...updatedEmployee.annualLeave, used: updatedEmployee.annualLeave.used + totalDaysDeducted };
        } else {
            updatedEmployee.personalLeave = { ...updatedEmployee.personalLeave, used: updatedEmployee.personalLeave.used + totalDaysDeducted };
        }
        await updateEmployee(updatedEmployee);

        const log = createAuditLog({
            category: 'leave',
            action: 'leave_batch_create',
            employeeId: employee.id,
            employeeName: employee.name,
            details: { leaveType, count: newRecords.length, days: totalDaysDeducted }
        });
        await addAuditLog(log);

        setIsReviewOpen(false);
        setDatesConfig({});
        alert(`成功登記排休！共新增 ${newRecords.length} 筆，扣除 ${totalDaysDeducted} 天額度。`);
    };

    const handleDeleteExistingLeave = async (leave: LeaveRecord) => {
        if (confirm(`確定要取消並刪除【${leave.employeeName}】於 ${leave.startDate} 的${leave.leaveType === 'annual' ? '特休' : '排休'}（${leave.days} 天）嗎？\n\n系統將自動退回 ${leave.days} 天額度給該員工！`)) {
            await deleteLeave(leave.id);
            setManagingLeave(null);
            alert(`已成功取消排休，已退回 ${leave.days} 天額度！`);
        }
    };

    const handleUpdateExistingLeave = async (updated: LeaveRecord, original: LeaveRecord) => {
        await updateLeave(updated, original);
        setManagingLeave(null);
        alert(`已成功更正排休資料！`);
    };

    const sortedDates = Object.keys(datesConfig).sort();
    const themeColor = leaveType === 'annual' ? 'orange' : 'blue';
    const totalReviewDays = Object.values(datesConfig).reduce((acc, curr) => acc + (curr.isFullDay ? 1 : curr.slots.length * 0.5), 0);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-3xl font-black text-midnight-blue tracking-tight">排休申請與管理</h2>
                    <p className="text-slate-500 font-medium text-sm mt-0.5">點選日曆登記排休、更正日期時段或取消刪除排休</p>
                </div>

                <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
                    <div className="relative group min-w-[220px] flex-1 md:flex-none">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                            <User size={20} />
                        </div>
                        <select
                            data-testid="leave-employee-select"
                            value={selectedEmployee}
                            onChange={(e) => {
                                setSelectedEmployee(e.target.value);
                                setDatesConfig({});
                            }}
                            className="w-full pl-10 pr-10 py-3 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-700 appearance-none focus:outline-none focus:border-midnight-blue hover:border-slate-300 transition-all shadow-xs"
                        >
                            <option value="">請選擇請假員工</option>
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
                            className={`relative z-10 flex-1 px-5 py-2 rounded-xl font-black text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${leaveType === 'annual' ? 'text-orange-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${leaveType === 'annual' ? 'bg-orange-500' : 'bg-slate-300'}`} />
                            特休
                        </button>
                        <button
                            onClick={() => setLeaveType('personal')}
                            className={`relative z-10 flex-1 px-5 py-2 rounded-xl font-black text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${leaveType === 'personal' ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${leaveType === 'personal' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                            排休
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden order-2 lg:order-1">
                    <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-200">
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'calendar' ? 'bg-midnight-blue text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <CalendarIcon size={14} />
                            準備登記 ({sortedDates.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('existing')}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'existing' ? 'bg-midnight-blue text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <FileText size={14} />
                            本月已排休 ({selectedEmployee ? employeeExistingLeaves.length : branchMonthLeaves.length})
                        </button>
                    </div>

                    {activeTab === 'calendar' ? (
                        <div className={`flex-1 bg-white rounded-[2rem] shadow-xl border border-slate-100 flex flex-col min-h-0 overflow-hidden transition-all duration-300 ${sortedDates.length === 0 ? 'opacity-70' : 'opacity-100'}`}>
                            <div className="p-4 flex-shrink-0 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                                        <FileText size={18} className="text-slate-400" />
                                        本次排休清單
                                    </h3>
                                    <span className="text-xs font-bold text-slate-400">點選日曆添加多個日期</span>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xl font-black ${leaveType === 'annual' ? 'text-orange-500' : 'text-blue-500'}`}>
                                        {totalReviewDays}
                                        <span className="text-xs text-slate-400 ml-1">天</span>
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {sortedDates.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 min-h-[160px]">
                                        <CalendarIcon size={36} className="opacity-40" />
                                        <span className="font-bold text-xs text-slate-400">
                                            {selectedEmployee ? '請點擊右方日曆日期' : '請先在上方選擇員工'}
                                        </span>
                                    </div>
                                ) : (
                                    sortedDates.map(dateStr => {
                                        const config = datesConfig[dateStr];
                                        return (
                                            <div key={dateStr} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all group">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="font-black text-slate-800 text-sm">
                                                            {dateStr} <span className="text-xs font-normal text-slate-400">({new Date(dateStr).toLocaleDateString('zh-TW', { weekday: 'narrow' })})</span>
                                                        </div>
                                                        <div className="text-xs font-bold text-slate-500 mt-1 flex flex-wrap gap-1">
                                                            <span className={`px-2 py-0.5 rounded-md ${config.isFullDay ? 'bg-slate-200 text-slate-700' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                                                                {config.isFullDay ? '全天 (1.0天)' : `時段 (${config.slots.length * 0.5}天)`}
                                                            </span>
                                                            {config.note && <span className="text-slate-400 truncate max-w-[100px]">- {config.note}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setEditingDate(dateStr)}
                                                            className="p-1.5 text-slate-400 hover:text-midnight-blue hover:bg-white rounded-lg transition-colors cursor-pointer"
                                                            title="設定時段/備註"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => removeDate(dateStr)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                                            title="移除此日期"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
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
                                        className={`w-full py-3 rounded-xl shadow-lg font-black text-white text-sm transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${leaveType === 'annual' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'} active:scale-95`}
                                    >
                                        <Check size={18} />
                                        確認送出排休 ({sortedDates.length} 筆)
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 bg-white rounded-[2rem] shadow-xl border border-slate-100 flex flex-col min-h-0 overflow-hidden">
                            <div className="p-4 flex-shrink-0 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-slate-800 text-base">本月已登記排休</h3>
                                    <p className="text-xs text-slate-400 font-medium">點選可進行更正、移動日期或刪除退額度</p>
                                </div>
                                <span className="text-xs font-bold px-2.5 py-1 bg-slate-200 text-slate-700 rounded-full">
                                    {selectedEmployee ? employeeExistingLeaves.length : branchMonthLeaves.length} 筆
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                                {(selectedEmployee ? employeeExistingLeaves : branchMonthLeaves).length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 min-h-[160px]">
                                        <Clock size={36} className="opacity-40" />
                                        <span className="font-bold text-xs text-slate-400">本月尚無已排休紀錄</span>
                                    </div>
                                ) : (
                                    (selectedEmployee ? employeeExistingLeaves : branchMonthLeaves).map(leave => (
                                        <div
                                            key={leave.id}
                                            className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 transition-all flex items-center justify-between gap-2 group shadow-2xs"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-800 text-sm">{leave.startDate}</span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${leave.leaveType === 'annual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {leave.leaveType === 'annual' ? '特休' : '排休'} {leave.days}天
                                                    </span>
                                                </div>
                                                <div className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-2">
                                                    <span>{leave.employeeName} ({leave.branch})</span>
                                                    {leave.timeSlot && <span className="text-slate-400">| {leave.timeSlot}</span>}
                                                    {leave.note && <span className="text-slate-400 truncate max-w-[80px]">({leave.note})</span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setManagingLeave(leave)}
                                                    className="px-2.5 py-1.5 bg-white hover:bg-midnight-blue hover:text-white text-slate-600 rounded-lg text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                                    title="更正/移動日期"
                                                >
                                                    <Edit2 size={12} />
                                                    更正
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteExistingLeave(leave)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                    title="取消刪除並退回額度"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-8 flex flex-col h-full min-h-0 order-1 lg:order-2">
                    <div className="bg-white rounded-[2rem] p-6 lg:p-7 shadow-xl border border-slate-100 h-full flex flex-col overflow-hidden relative">
                        <div className="flex justify-between items-center mb-4 flex-shrink-0 z-10">
                            <div>
                                <h3 className="text-2xl font-black text-midnight-blue flex items-center gap-2">
                                    {year} 年 {month + 1} 月
                                    {!selectedEmployee && (
                                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                                            <AlertCircle size={12} />
                                            請先選擇員工
                                        </span>
                                    )}
                                </h3>
                                {selectedEmployee && (
                                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                                        💡 提示：點擊空白日期可排休；點擊<span className="text-orange-500 font-black">已排休格子</span>可直接更正或刪除
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 text-xs font-bold">
                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg border border-orange-200">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                    特休
                                </span>
                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                    排休
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 relative flex flex-col">
                            <div className="grid grid-cols-7 mb-2">
                                {weekDays.map(day => (
                                    <div key={day} className="text-center font-black text-slate-300 py-1 text-xs">{day}</div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-[1fr]">
                                {calendar.map((day, index) => {
                                    if (day === null) return <div key={`empty-${index}`} className="bg-transparent" />;

                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const newConfig = datesConfig[dateStr];
                                    const isNewlySelected = !!newConfig;
                                    const existingLeave = leavesByDate[dateStr];
                                    const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                                    let containerClasses = "w-full h-full rounded-2xl relative transition-all duration-200 border-2 flex flex-col items-center justify-between py-2 px-1 group overflow-hidden ";

                                    if (existingLeave) {
                                        containerClasses += existingLeave.leaveType === 'annual'
                                            ? "bg-orange-50 border-orange-400 text-orange-900 shadow-sm hover:border-orange-600 hover:bg-orange-100/80 cursor-pointer"
                                            : "bg-blue-50 border-blue-400 text-blue-900 shadow-sm hover:border-blue-600 hover:bg-blue-100/80 cursor-pointer";
                                    } else if (isNewlySelected) {
                                        containerClasses += leaveType === 'annual'
                                            ? "bg-orange-500 border-orange-500 text-white shadow-md transform scale-[0.98] z-10 cursor-pointer"
                                            : "bg-blue-500 border-blue-500 text-white shadow-md transform scale-[0.98] z-10 cursor-pointer";
                                    } else {
                                        containerClasses += isToday
                                            ? "border-midnight-blue bg-midnight-blue/5 text-midnight-blue hover:bg-midnight-blue/10 cursor-pointer"
                                            : "border-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer";
                                    }

                                    if (!selectedEmployee) {
                                        containerClasses += " opacity-40 cursor-not-allowed";
                                    }

                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => handleDateClick(day)}
                                            disabled={!selectedEmployee}
                                            className={containerClasses}
                                        >
                                            <div className="w-full flex justify-between items-center px-1">
                                                <span className={`text-sm font-black leading-none ${isNewlySelected ? 'text-white' : existingLeave ? (existingLeave.leaveType === 'annual' ? 'text-orange-700' : 'text-blue-700') : 'text-slate-700'}`}>
                                                    {day}
                                                </span>
                                                {isToday && !isNewlySelected && !existingLeave && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-midnight-blue" />
                                                )}
                                            </div>

                                            {existingLeave && (
                                                <div className="w-full text-center">
                                                    <span className={`text-[10px] font-black block px-1 py-0.5 rounded-md ${existingLeave.leaveType === 'annual' ? 'bg-orange-200/80 text-orange-900' : 'bg-blue-200/80 text-blue-900'}`}>
                                                        已排{existingLeave.leaveType === 'annual' ? '特休' : '排休'}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-500 block mt-0.5">
                                                        {existingLeave.days}天 {existingLeave.timeSlot ? `(${existingLeave.timeSlot})` : ''}
                                                    </span>
                                                </div>
                                            )}

                                            {isNewlySelected && (
                                                <div className="w-full text-center">
                                                    <div className="bg-white/20 backdrop-blur-sm rounded-md px-1 py-0.5">
                                                        <span className="text-[10px] font-black leading-tight block text-center">
                                                            {newConfig.isFullDay ? '1.0 天' : `${newConfig.slots.length * 0.5} 天`}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {!existingLeave && !isNewlySelected && <div className="h-3" />}
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

            {managingLeave && (
                <ManageExistingLeaveModal
                    leave={managingLeave}
                    onUpdate={handleUpdateExistingLeave}
                    onDelete={handleDeleteExistingLeave}
                    onClose={() => setManagingLeave(null)}
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

function ManageExistingLeaveModal({ leave, onUpdate, onDelete, onClose }: {
    leave: LeaveRecord;
    onUpdate: (updated: LeaveRecord, original: LeaveRecord) => Promise<void>;
    onDelete: (leave: LeaveRecord) => Promise<void>;
    onClose: () => void;
}) {
    const [targetDate, setTargetDate] = useState(leave.startDate);
    const [targetType, setTargetType] = useState<'annual' | 'personal'>(leave.leaveType);
    const [isFullDay, setIsFullDay] = useState(leave.isFullDay ?? true);
    const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>(leave.slots || []);
    const [note, setNote] = useState(leave.note || '');

    const toggleSlot = (slot: TimeSlot) => {
        let newSlots = [...selectedSlots];
        if (newSlots.includes(slot)) {
            newSlots = newSlots.filter(s => s !== slot);
        } else {
            newSlots.push(slot);
        }
        setSelectedSlots(newSlots);
    };

    const handleSave = async () => {
        if (!targetDate) {
            alert('請選擇有效日期');
            return;
        }

        const slotMap: Record<TimeSlot, string> = { morning: '上午', afternoon: '下午', evening: '晚上' };
        const calculatedDays = isFullDay ? 1 : Math.max(0.5, selectedSlots.length * 0.5);
        const timeSlotDesc = isFullDay ? undefined : selectedSlots.map(s => slotMap[s]).join('、');

        const updatedLeave: LeaveRecord = {
            ...leave,
            startDate: targetDate,
            endDate: targetDate,
            leaveType: targetType,
            isFullDay,
            slots: isFullDay ? undefined : selectedSlots,
            timeSlot: timeSlotDesc,
            days: calculatedDays,
            note: note.trim()
        };

        await onUpdate(updatedLeave, leave);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-midnight-blue">排休假單管理與更正</h3>
                            <p className="text-xs font-bold text-slate-400">員工：{leave.employeeName} ({leave.branch})</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4 text-sm">
                    <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">排休日期（可直接移動日期）</label>
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-midnight-blue outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">假別類型</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setTargetType('annual')}
                                className={`py-2.5 rounded-xl font-black text-xs border-2 transition-all cursor-pointer ${targetType === 'annual' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                            >
                                特休 (Annual Leave)
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetType('personal')}
                                className={`py-2.5 rounded-xl font-black text-xs border-2 transition-all cursor-pointer ${targetType === 'personal' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                            >
                                排休 (Personal Leave)
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">時段長度</label>
                        <div className="flex gap-2 mb-2">
                            <button
                                type="button"
                                onClick={() => setIsFullDay(true)}
                                className={`flex-1 py-2 rounded-xl font-black text-xs border-2 transition-all cursor-pointer ${isFullDay ? 'border-midnight-blue bg-midnight-blue text-white' : 'border-slate-200 text-slate-500'}`}
                            >
                                全天 (1.0 天)
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsFullDay(false)}
                                className={`flex-1 py-2 rounded-xl font-black text-xs border-2 transition-all cursor-pointer ${!isFullDay ? 'border-midnight-blue bg-midnight-blue text-white' : 'border-slate-200 text-slate-500'}`}
                            >
                                部分時段 (0.5/1.0 天)
                            </button>
                        </div>

                        {!isFullDay && (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                                {(['morning', 'afternoon', 'evening'] as TimeSlot[]).map((slot) => {
                                    const labels = { morning: '上午 (早)', afternoon: '下午 (中)', evening: '晚上 (晚)' };
                                    const isSelected = selectedSlots.includes(slot);
                                    return (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => toggleSlot(slot)}
                                            className={`py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                        >
                                            {labels[slot]}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">備註說明</label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="選填備註..."
                            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-midnight-blue outline-none"
                        />
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => onDelete(leave)}
                        className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <Trash2 size={16} />
                        取消並刪除排休 (退額度)
                    </button>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-5 py-2.5 bg-midnight-blue hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                        >
                            儲存更正
                        </button>
                    </div>
                </div>
            </div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-black text-midnight-blue">設定排休細項</h3>
                        <p className="text-sm font-bold text-slate-400">{dateStr}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">排休類型</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setConfig({ ...config, isFullDay: true, slots: [] })}
                                className={`py-3 rounded-xl font-bold text-sm border-2 transition-all cursor-pointer ${config.isFullDay
                                    ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-600`
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                全天 (1.0 天)
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfig({ ...config, isFullDay: false })}
                                className={`py-3 rounded-xl font-bold text-sm border-2 transition-all cursor-pointer ${!config.isFullDay
                                    ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-600`
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                時段 (0.5 天/段)
                            </button>
                        </div>
                    </div>

                    {!config.isFullDay && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">選擇時段 (最多 2 個)</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['morning', 'afternoon', 'evening'] as TimeSlot[]).map((slot) => {
                                    const isSelected = config.slots.includes(slot);
                                    const labels = { morning: '上午', afternoon: '下午', evening: '晚上' };
                                    return (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => toggleSlot(slot)}
                                            className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all cursor-pointer ${isSelected
                                                ? `border-${themeColor}-500 bg-${themeColor}-50 text-${themeColor}-600`
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            {labels[slot]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">備註事項 (選填)</label>
                        <input
                            type="text"
                            value={config.note}
                            onChange={(e) => setConfig({ ...config, note: e.target.value })}
                            placeholder="例如：私人事由、回診..."
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:border-midnight-blue"
                        />
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(config)}
                        className={`flex-1 py-3 bg-${themeColor}-500 hover:bg-${themeColor}-600 text-white rounded-xl font-bold shadow-lg transition-all cursor-pointer`}
                    >
                        確認儲存
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
    const dates = Object.keys(datesConfig).sort();

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border-2 border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-midnight-blue">確認排休申請</h3>
                    <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold text-slate-600">申請員工</span>
                        <span className="font-black text-midnight-blue text-lg">{employeeName}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold text-slate-600">假別與天數</span>
                        <div className="text-right">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-black mr-2 ${leaveType === 'annual' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                {leaveType === 'annual' ? '特休' : '排休'}
                            </span>
                            <span className="font-black text-midnight-blue text-lg">{totalDays} 天</span>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <span className="block text-sm font-bold text-slate-600 mb-2">排休日期清單 ({dates.length} 天)</span>
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {dates.map(dateStr => {
                                const config = datesConfig[dateStr];
                                return (
                                    <div key={dateStr} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div>
                                            <span className="font-bold text-slate-700">{dateStr}</span>
                                            <span className="text-xs text-slate-400 ml-2">
                                                {config.isFullDay ? '全天' : `時段 (${config.slots.length * 0.5}天)`}
                                            </span>
                                            {config.note && <span className="text-xs text-slate-500 ml-2">({config.note})</span>}
                                        </div>
                                        <button onClick={() => onEdit(dateStr)} className="text-xs font-bold text-slate-500 hover:text-midnight-blue cursor-pointer">
                                            修改
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black transition-colors cursor-pointer"
                    >
                        返回修改
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 py-4 bg-${themeColor}-500 hover:bg-${themeColor}-600 text-white rounded-2xl font-black shadow-lg shadow-${themeColor}-200 transition-all cursor-pointer`}
                    >
                        確認送出
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LeaveInputV2;

