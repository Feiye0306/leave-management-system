import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Calendar, User, Settings as SettingsIcon, Download, Clock, ChevronDown, ChevronUp, UserCheck, Trash2, Sliders, CalendarCheck2, Sparkles, RefreshCw } from 'lucide-react';
import { useLeaveSystem } from '../context/LeaveContext';
import { formatAuditLog } from '../utils/auditLogger';
import type { AuditAction, AuditLog } from '../types';

function renderDetailsFriendly(details: Record<string, any> | undefined) {
    if (!details || Object.keys(details).length === 0) return null;

    const keyLabels: Record<string, string> = {
        branch: '分校',
        hireDate: '到職日',
        annualInitial: '特休初始',
        personalInitial: '排休初始',
        monthlyQuota: '每月額度',
        leaveType: '請假類型',
        days: '天數',
        count: '筆數',
        dateRange: '日期區間',
        deletedAt: '刪除時間',
        employeeCount: '員工數量',
        monthKey: '月份',
        year: '年度',
        exportType: '匯出類型'
    };

    const formatVal = (key: string, val: any) => {
        if (key === 'leaveType') return val === 'annual' ? '特休' : '排休';
        if (key === 'deletedAt') return new Date(val).toLocaleString('zh-TW');
        if (typeof val === 'number') return `${val} 天`;
        return String(val);
    };

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(details).map(([k, v]) => {
                if (v === undefined || v === null || v === '') return null;
                const label = keyLabels[k] || k;
                return (
                    <span
                        key={k}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 text-slate-700 rounded-lg text-xs font-bold border border-slate-200/60 shadow-xs"
                    >
                        <span className="text-slate-400 font-medium">{label}:</span>
                        <span>{formatVal(k, v)}</span>
                    </span>
                );
            })}
        </div>
    );
}

function getLogIcon(category: string, action: string) {
    if (action.includes('create') || action.includes('add')) return <UserCheck size={16} className="text-emerald-500" />;
    if (action.includes('delete') || action.includes('remove')) return <Trash2 size={16} className="text-rose-500" />;
    if (action.includes('adjust') || action.includes('cashout')) return <Sliders size={16} className="text-blue-500" />;
    if (action.includes('leave')) return <CalendarCheck2 size={16} className="text-indigo-500" />;
    if (action.includes('sample')) return <Sparkles size={16} className="text-purple-500" />;
    if (action.includes('reset') || action.includes('accrual')) return <RefreshCw size={16} className="text-amber-500" />;
    return <Clock size={16} className="text-slate-400" />;
}

function getCategoryBadge(category: string) {
    switch (category) {
        case 'employee':
            return <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-xs font-black">員工管理</span>;
        case 'leave':
            return <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full text-xs font-black">排休請假</span>;
        case 'system':
            return <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/60 rounded-full text-xs font-black">系統操作</span>;
        default:
            return <span className="px-2.5 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-black">常規日誌</span>;
    }
}

function AuditLogViewer() {
    const { getAuditLogs } = useLeaveSystem();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'employee' | 'leave' | 'system'>('all');
    const [actionFilter, setActionFilter] = useState<'all' | AuditAction>('all');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: '',
        end: ''
    });
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    useEffect(() => {
        const loadLogs = async () => {
            const auditLogs = await getAuditLogs();
            setLogs(auditLogs);
        };
        loadLogs();
    }, [getAuditLogs]);

    // Filter and search logs
    const filteredLogs = useMemo(() => {
        let result = [...logs].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        if (categoryFilter !== 'all') {
            result = result.filter(log => log.category === categoryFilter);
        }

        if (actionFilter !== 'all') {
            result = result.filter(log => log.action === actionFilter);
        }

        if (dateRange.start) {
            result = result.filter(log => log.timestamp >= dateRange.start);
        }
        if (dateRange.end) {
            result = result.filter(log => log.timestamp <= dateRange.end + 'T23:59:59');
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(log =>
                log.employeeName?.toLowerCase().includes(term) ||
                log.action.toLowerCase().includes(term) ||
                log.reason?.toLowerCase().includes(term) ||
                formatAuditLog(log).toLowerCase().includes(term)
            );
        }

        return result;
    }, [logs, categoryFilter, actionFilter, dateRange, searchTerm]);

    const handleExportCSV = () => {
        const headers = ['時間', '類別', '操作', '員工', '變動前', '變動後', '變動量', '理由'];
        const csvContent = [
            headers.join(','),
            ...filteredLogs.map(log => [
                new Date(log.timestamp).toLocaleString('zh-TW'),
                log.category,
                log.action,
                log.employeeName || '-',
                log.before?.toString() || '-',
                log.after?.toString() || '-',
                log.amount?.toString() || '-',
                log.reason || '-'
            ].join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-midnight-blue tracking-tight">操作日誌</h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">即時追蹤全校員工異動、排休登記與額度調整歷程</p>
                </div>
                <button
                    onClick={handleExportCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-6 py-3 rounded-2xl font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer select-none"
                >
                    <Download size={18} />
                    匯出 CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">關鍵字搜尋</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜尋員工姓名、操作項目或異動理由..."
                                className="w-full pl-11 pr-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-midnight-blue outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">日誌類別</label>
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value as any)}
                                className="w-full pl-11 pr-4 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-midnight-blue outline-none appearance-none transition-all bg-white"
                            >
                                <option value="all">全部類別</option>
                                <option value="employee">員工管理</option>
                                <option value="leave">排休請假</option>
                                <option value="system">系統操作</option>
                            </select>
                        </div>
                    </div>

                    {/* Date Range */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">日期區間</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="flex-1 px-3 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-midnight-blue outline-none text-xs"
                            />
                            <span className="flex items-center text-slate-400 font-bold">~</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="flex-1 px-3 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-midnight-blue outline-none text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Filters Summary */}
                {(categoryFilter !== 'all' || searchTerm || dateRange.start || dateRange.end) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500">篩選條件：</span>
                            {categoryFilter !== 'all' && (
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
                                    {categoryFilter === 'employee' ? '員工管理' : categoryFilter === 'leave' ? '排休請假' : '系統操作'}
                                </span>
                            )}
                            {searchTerm && (
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                                    搜尋: {searchTerm}
                                </span>
                            )}
                            {(dateRange.start || dateRange.end) && (
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                                    {dateRange.start || '起始'} ~ {dateRange.end || '迄止'}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setCategoryFilter('all');
                                setActionFilter('all');
                                setDateRange({ start: '', end: '' });
                            }}
                            className="text-xs font-bold text-slate-400 hover:text-midnight-blue transition-colors cursor-pointer"
                        >
                            清除全部條件
                        </button>
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-midnight-blue">操作時間軸</h3>
                    <span className="text-xs font-bold text-slate-400">共 {filteredLogs.length} 筆記錄</span>
                </div>

                {filteredLogs.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Clock size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold text-slate-500 text-base">目前尚無符合條件的操作日誌</p>
                    </div>
                ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                        {filteredLogs.map((log) => {
                            const isExpanded = !!expandedIds[log.id];
                            const hasDetails = (log.reason || (log.details && Object.keys(log.details).length > 0));

                            return (
                                <div key={log.id} className="relative group">
                                    {/* Dot */}
                                    <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-white border-2 border-slate-300 group-hover:border-midnight-blue transition-colors flex items-center justify-center shadow-xs">
                                        <div className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-midnight-blue transition-colors" />
                                    </div>

                                    {/* Card */}
                                    <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-5 transition-all shadow-xs hover:shadow-md">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                                                    {getLogIcon(log.category, log.action)}
                                                </div>
                                                <span className="text-base font-black text-slate-800 tracking-tight">
                                                    {formatAuditLog(log)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {getCategoryBadge(log.category)}
                                                <span className="text-xs font-bold text-slate-400">
                                                    {new Date(log.timestamp).toLocaleString('zh-TW', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Amount Badge */}
                                        {log.amount !== undefined && (
                                            <div className="mt-2 text-xs font-bold text-slate-500">
                                                異動數值：
                                                <span className="text-slate-400 mx-1">{log.before ?? 0} 天</span>
                                                ➔
                                                <span className={`mx-1 font-black ${log.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {log.after ?? 0} 天 ({log.amount > 0 ? `+${log.amount}` : log.amount} 天)
                                                </span>
                                            </div>
                                        )}

                                        {/* Reason */}
                                        {log.reason && (
                                            <p className="text-xs font-bold text-slate-600 mt-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                                                <span className="text-slate-400 font-medium">備註理由：</span>
                                                {log.reason}
                                            </p>
                                        )}

                                        {/* Details Badges */}
                                        {log.details && (
                                            <div className="mt-2">
                                                {renderDetailsFriendly(log.details)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AuditLogViewer;

