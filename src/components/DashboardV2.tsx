import { useState } from 'react';
import { Users, Calendar, Bell, CheckCircle, ChevronRight } from 'lucide-react';
import { useLeaveSystem } from '../context/LeaveContext';
import { calculateAvailable } from '../utils/leaveUtils';
import type { Employee, LeaveRecord } from '../types';

interface DashboardV2Props {
    selectedBranch: string;
    onNavigate: (tab: string) => void;
}

function DashboardV2({ selectedBranch, onNavigate }: DashboardV2Props) {
    const { employees, leaves: roster } = useLeaveSystem();
    const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());

    // 過濾員工
    const filteredEmployees = selectedBranch === '全部分校'
        ? employees
        : employees.filter(emp => emp.branch === selectedBranch);

    const activeEmployees = filteredEmployees.filter(emp => emp.status === '在職');

    // 生成通知列表
    const alerts: { id: string; type: 'overdraft' | 'expiry' | 'birthday'; emp: Employee; message: string }[] = [];

    activeEmployees.forEach(emp => {
        // 透支
        if (calculateAvailable(emp.annualLeave) < 0) {
            alerts.push({
                id: `overdraft-${emp.id}`,
                type: 'overdraft',
                emp,
                message: '特休透支'
            });
        }
        // 到期
        const expiryDate = new Date(emp.annualLeave.expiry || '2099-12-31');
        const today = new Date();
        const twoMonthsLater = new Date();
        twoMonthsLater.setMonth(today.getMonth() + 2);

        const remainingDays = calculateAvailable(emp.annualLeave);
        if (expiryDate <= twoMonthsLater && remainingDays > 0) {
            // Calculate days until expiry
            const diffTime = Math.abs(expiryDate.getTime() - today.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            alerts.push({
                id: `expiry-${emp.id}`,
                type: 'expiry',
                emp,
                message: `${remainingDays} 天特休將於 ${diffDays} 天後到期`
            });
        }
        // 員工生日提醒
        if (emp.birthDate) {
            const birthParts = emp.birthDate.split('-');
            if (birthParts.length >= 3) {
                const birthMonth = parseInt(birthParts[1], 10);
                const birthDay = parseInt(birthParts[2], 10);
                if (birthMonth === today.getMonth() + 1) {
                    alerts.push({
                        id: `birthday-${emp.id}`,
                        type: 'birthday',
                        emp,
                        message: `本月壽星 🎂 (${birthMonth}月${birthDay}日)`
                    });
                }
            }
        }
    });

    const handleNotificationClick = (id: string) => {
        const newRead = new Set(readNotifications);
        newRead.add(id);
        setReadNotifications(newRead);
        onNavigate('employees');
    };

    // 獲取今日排休與本月排休

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const monthlyRoster = roster.filter(record => {
        const recordDate = new Date(record.startDate);
        return recordDate.getMonth() === currentMonth &&
            recordDate.getFullYear() === currentYear &&
            (selectedBranch === '全部分校' || record.branch === selectedBranch);
    });

    // Determine if leave covers today
    const todaysLeaves = roster.filter(record => {
        return record.startDate <= todayStr && record.endDate >= todayStr && (selectedBranch === '全部分校' || record.branch === selectedBranch);
    });

    // 生成月曆
    const generateCalendar = () => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const calendar: (number | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i++) calendar.push(null);
        for (let i = 1; i <= daysInMonth; i++) calendar.push(i);
        return calendar;
    };

    const hasLeaveOnDate = (day: number): LeaveRecord[] => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return monthlyRoster.filter(record => record.startDate === dateStr);
    };

    const calendar = generateCalendar();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-black text-midnight-blue">分校儀表板</h2>

            {/* 統計卡片 - 高度縮小，標題對齊 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. 在職人數 */}
                <div className="bg-white rounded-[2rem] p-5 shadow-lg border border-slate-100 flex flex-col h-36 relative overflow-hidden">
                    <div className="flex items-start justify-between z-10">
                        <div className="flex flex-col">
                            <p className="text-slate-500 font-bold text-sm mb-1">在職人數</p>
                            <p className="text-4xl font-black text-midnight-blue mt-2">{activeEmployees.length}</p>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded-2xl text-emerald-500">
                            <Users size={24} />
                        </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-emerald-50 rounded-full opacity-50 z-0 pointer-events-none" />
                </div>

                {/* 2. 今日排休 */}
                <div className="bg-white rounded-[2rem] p-5 shadow-lg border border-slate-100 flex flex-col h-36 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2 z-10">
                        <div>
                            <p className="text-slate-500 font-bold text-sm">今日排休</p>
                            <div className="flex items-baseline gap-1 mt-1">
                                <p className="text-3xl font-black text-midnight-blue">{todaysLeaves.length}</p>
                                <span className="text-xs text-slate-400 font-bold">人</span>
                            </div>
                        </div>
                        <div className="bg-blue-50 p-2.5 rounded-2xl text-blue-500">
                            <Calendar size={24} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar z-10 space-y-1 pr-1">
                        {todaysLeaves.length > 0 ? (
                            todaysLeaves.map(leave => (
                                <div key={leave.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg">
                                    <div className={`w-1.5 h-1.5 rounded-full ${leave.leaveType === 'annual' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                                    <span className="truncate max-w-[4rem]">{leave.employeeName}</span>
                                    {!leave.isFullDay && <span className="text-slate-400 text-[10px] ml-auto whitespace-nowrap">{leave.timeSlot}</span>}
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold bg-slate-50 px-2 py-1.5 rounded-lg mt-1">
                                <CheckCircle size={12} />
                                <span>今日全員到齊</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. 系統通知 */}
                <div className="bg-white rounded-[2rem] p-5 shadow-lg border border-slate-100 flex flex-col h-36 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2 z-10">
                        <p className="text-slate-500 font-bold text-sm">系統通知</p>
                        <div className="bg-orange-50 p-2.5 rounded-2xl text-orange-500">
                            <Bell size={24} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar z-10 pr-1 space-y-1.5">
                        {alerts.length > 0 ? (
                            alerts.map(alert => {
                                const isRead = readNotifications.has(alert.id);
                                return (
                                    <div
                                        key={alert.id}
                                        onClick={() => handleNotificationClick(alert.id)}
                                        className={`flex items-center gap-2 text-xs p-2 rounded-lg border-l-2 cursor-pointer transition-all hover:bg-slate-50
                                            ${alert.type === 'overdraft' ? 'border-red-400 bg-red-50/50' : alert.type === 'birthday' ? 'border-purple-400 bg-purple-50/50' : 'border-amber-400 bg-amber-50/50'}
                                        `}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`truncate ${!isRead ? 'font-black text-slate-800' : 'font-medium text-slate-500'}`}>
                                                {alert.emp.branch} | {alert.emp.name}
                                            </div>
                                            <div className={`${!isRead ? 'font-bold' : 'font-medium'} ${alert.type === 'overdraft' ? 'text-red-500' : alert.type === 'birthday' ? 'text-purple-600' : 'text-amber-600'}`}>
                                                {alert.message}
                                            </div>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-300" />
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex items-center gap-2 text-slate-300 text-xs font-bold p-2 mt-1">
                                <CheckCircle size={14} />
                                <span>目前無新通知</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 月預覽日曆 */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-black text-midnight-blue flex items-center gap-3">
                        {currentYear} 年 {currentMonth + 1} 月
                        <span className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">排休總覽</span>
                    </h3>
                    <div className="flex gap-4 text-sm font-bold">
                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>特休</span>
                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>排休</span>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-3">
                    {weekDays.map(day => (
                        <div key={day} className="text-center font-black text-slate-400 py-2 border-b-2 border-slate-50 mb-2">
                            {day}
                        </div>
                    ))}

                    {calendar.map((day, index) => {
                        if (day === null) return <div key={`empty-${index}`} className="min-h-[100px]" />;

                        const leavesOnDay = hasLeaveOnDate(day);
                        const isToday = day === new Date().getDate() &&
                            currentMonth === new Date().getMonth() &&
                            currentYear === new Date().getFullYear();

                        return (
                            <div
                                key={day}
                                className={`min-h-[100px] border-2 rounded-2xl p-2 transition-all flex flex-col gap-1 
                                    ${isToday ? 'border-midnight-blue bg-blue-50/30' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                            >
                                <div className={`text-lg font-black leading-none mb-1 ${isToday ? 'text-midnight-blue' : 'text-slate-300'}`}>
                                    {day}
                                </div>

                                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                    {leavesOnDay.slice(0, 3).map((leave, idx) => (
                                        <div
                                            key={idx}
                                            className={`text-[10px] sm:text-xs font-bold px-1.5 py-1 rounded-lg truncate flex items-center justify-between group cursor-default transition-transform hover:scale-[1.02]
                                                ${leave.leaveType === 'annual'
                                                    ? 'bg-orange-50 text-orange-700 border border-orange-100'
                                                    : 'bg-blue-50 text-blue-700 border border-blue-100'}`}
                                            title={`${leave.employeeName} (${leave.leaveType === 'annual' ? '特休' : '排休'}) - ${leave.isFullDay ? '全天' : leave.timeSlot}`}
                                        >
                                            <span className="truncate">{leave.employeeName}</span>
                                            {!leave.isFullDay && (
                                                <span className="flex gap-0.5 ml-1 shrink-0">
                                                    {(leave.slots || []).map((s, i) => (
                                                        <span key={i} className={`text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-black text-white bg-indigo-500`}>
                                                            {s === 'morning' ? '早' : s === 'afternoon' ? '午' : '晚'}
                                                        </span>
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                    {leavesOnDay.length > 3 && (
                                        <div className="text-[10px] font-black text-slate-400 text-center bg-slate-50 rounded-lg py-0.5 mt-auto">
                                            還有 {leavesOnDay.length - 3} 人...
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 99px; }
            `}</style>
        </div>
    );
}

export default DashboardV2;
