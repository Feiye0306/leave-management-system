import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Calendar, User, Settings as SettingsIcon, Download } from 'lucide-react';
import { useLeaveSystem } from '../context/LeaveContext';
import { formatAuditLog, getAuditCategoryIcon, getAuditCategoryColor } from '../utils/auditLogger';
import type { AuditAction, AuditLog } from '../types';

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

        // Category filter
        if (categoryFilter !== 'all') {
            result = result.filter(log => log.category === categoryFilter);
        }

        // Action filter
        if (actionFilter !== 'all') {
            result = result.filter(log => log.action === actionFilter);
        }

        // Date range filter
        if (dateRange.start) {
            result = result.filter(log => log.timestamp >= dateRange.start);
        }
        if (dateRange.end) {
            result = result.filter(log => log.timestamp <= dateRange.end + 'T23:59:59');
        }

        // Search filter
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
                <h2 className="text-3xl font-black text-midnight-blue">操作日誌</h2>
                <button
                    onClick={handleExportCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg flex items-center gap-2 transition-all"
                >
                    <Download size={20} />
                    匯出 CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border-2 border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">搜尋</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜尋員工、操作、理由..."
                                className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl font-bold focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">類別</label>
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value as any)}
                                className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl font-bold focus:border-indigo-500 outline-none appearance-none"
                            >
                                <option value="all">全部類別</option>
                                <option value="employee">員工管理</option>
                                <option value="leave">請假管理</option>
                                <option value="system">系統操作</option>
                            </select>
                        </div>
                    </div>

                    {/* Date Range */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">日期範圍</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="flex-1 px-3 py-3 border-2 border-slate-200 rounded-xl font-bold focus:border-indigo-500 outline-none"
                            />
                            <span className="flex items-center text-slate-400">~</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="flex-1 px-3 py-3 border-2 border-slate-200 rounded-xl font-bold focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Filters Summary */}
                {(categoryFilter !== 'all' || searchTerm || dateRange.start || dateRange.end) && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-600">篩選條件：</span>
                            {categoryFilter !== 'all' && (
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                                    {categoryFilter === 'employee' ? '員工管理' : categoryFilter === 'leave' ? '請假管理' : '系統操作'}
                                </span>
                            )}
                            {searchTerm && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                    搜尋: {searchTerm}
                                </span>
                            )}
                            {(dateRange.start || dateRange.end) && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                    {dateRange.start || '開始'} ~ {dateRange.end || '結束'}
                                </span>
                            )}
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setCategoryFilter('all');
                                    setActionFilter('all');
                                    setDateRange({ start: '', end: '' });
                                }}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-all"
                            >
                                清除篩選
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium opacity-90">總操作數</p>
                            <p className="text-3xl font-black mt-1">{filteredLogs.length}</p>
                        </div>
                        <User size={40} className="opacity-50" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium opacity-90">員工操作</p>
                            <p className="text-3xl font-black mt-1">
                                {filteredLogs.filter(l => l.category === 'employee').length}
                            </p>
                        </div>
                        <User size={40} className="opacity-50" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium opacity-90">請假操作</p>
                            <p className="text-3xl font-black mt-1">
                                {filteredLogs.filter(l => l.category === 'leave').length}
                            </p>
                        </div>
                        <Calendar size={40} className="opacity-50" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium opacity-90">系統操作</p>
                            <p className="text-3xl font-black mt-1">
                                {filteredLogs.filter(l => l.category === 'system').length}
                            </p>
                        </div>
                        <SettingsIcon size={40} className="opacity-50" />
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-[2rem] p-8 shadow-xl border-2 border-slate-100">
                <h3 className="text-xl font-black text-midnight-blue mb-6">操作時間軸</h3>

                {filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p className="font-bold">無符合條件的操作記錄</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {filteredLogs.map((log, index) => {
                            const categoryColor = getAuditCategoryColor(log.category);
                            const icon = getAuditCategoryIcon(log.category);

                            return (
                                <div
                                    key={log.id}
                                    className={`relative pl-8 pb-8 ${index === filteredLogs.length - 1 ? '' : 'border-l-2 border-slate-200'}`}
                                >
                                    {/* Timeline dot */}
                                    <div className={`absolute left-0 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-${categoryColor}-500 flex items-center justify-center text-white font-bold shadow-lg`}>
                                        {icon}
                                    </div>

                                    {/* Log card */}
                                    <div className={`bg-${categoryColor}-50 border-2 border-${categoryColor}-200 rounded-2xl p-4 ml-4`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-sm font-bold text-slate-500">
                                                    {new Date(log.timestamp).toLocaleString('zh-TW')}
                                                </p>
                                                <p className="text-lg font-black text-midnight-blue mt-1">
                                                    {formatAuditLog(log)}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 bg-${categoryColor}-500 text-white rounded-full text-xs font-bold`}>
                                                {log.category === 'employee' ? '員工' : log.category === 'leave' ? '請假' : '系統'}
                                            </span>
                                        </div>

                                        {/* Details */}
                                        {(log.reason || log.details) && (
                                            <div className="mt-3 pt-3 border-t border-slate-200">
                                                {log.reason && (
                                                    <p className="text-sm text-slate-600">
                                                        <span className="font-bold">理由：</span>{log.reason}
                                                    </p>
                                                )}
                                                {log.details && Object.keys(log.details).length > 0 && (
                                                    <div className="text-sm text-slate-600 mt-2">
                                                        <span className="font-bold">詳細資訊：</span>
                                                        <pre className="mt-1 text-xs bg-white p-2 rounded">
                                                            {JSON.stringify(log.details, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
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
