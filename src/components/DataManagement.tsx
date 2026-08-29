import { useState } from 'react';
import { Download, Upload, FileJson, AlertTriangle, ArrowLeft, Archive, CloudUpload } from 'lucide-react';
import { migrateLocalToCloud } from '../utils/migrationUtils';
import { useLeaveSystem } from '../context/LeaveContext';
import { AutoBackupService } from '../services/AutoBackupService';
import type { Employee, LeaveRecord } from '../types';

function DataManagement() {
    const { employees, leaves: roster, branches, deleteEmployee } = useLeaveSystem();
    const [viewMode, setViewMode] = useState<'backup' | 'archive'>('backup');
    const [archiveData, setArchiveData] = useState<{ employees: Employee[], roster: LeaveRecord[] } | null>(null);

    // 檢測建議封存的員工
    const getArchiveCandidates = () => {
        const today = new Date();
        const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());

        return employees.filter(emp => {
            if (emp.status === '離職' && emp.resignDate) {
                const resignDate = new Date(emp.resignDate);
                return resignDate < twoYearsAgo;
            }
            return false;
        });
    };

    const archiveCandidates = getArchiveCandidates();

    const handleDownloadBackup = () => {
        const data = {
            employees: employees,
            roster: roster,
            branches: branches,
            timestamp: new Date().toISOString(),
            version: '1.1'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Record backup time
        AutoBackupService.recordBackup();
    };

    const handleArchiveUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const parsed = JSON.parse(content);
                // Validate basic structure
                if (parsed.employees && Array.isArray(parsed.employees)) {
                    setArchiveData({
                        employees: parsed.employees,
                        roster: parsed.roster || []
                    });
                } else if (parsed.employee && !Array.isArray(parsed.employee)) {
                    // Single archived employee
                    setArchiveData({
                        employees: [parsed.employee],
                        roster: parsed.roster || []
                    });
                } else {
                    alert('無效的備份檔案格式');
                }
            } catch (err) {
                alert('無法解析檔案');
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-midnight-blue">資料與備份</h2>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('backup')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'backup' ? 'bg-white text-midnight-blue shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        備份中心
                    </button>
                    <button
                        onClick={() => setViewMode('archive')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'archive' ? 'bg-white text-midnight-blue shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        封存檢視器
                    </button>
                </div>
            </div>

            {viewMode === 'backup' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* JSON Backup Card */}
                    <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 relative overflow-hidden group hover:border-indigo-100 transition-all">
                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-6 group-hover:scale-110 transition-transform">
                                <FileJson size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-midnight-blue mb-2">完整資料備份</h3>
                            <p className="text-slate-500 font-bold mb-8">
                                下載包含所有員工資料、排休紀錄與設定的 JSON 檔案。可用於系統還原或資料移轉。
                            </p>
                            <button
                                onClick={handleDownloadBackup}
                                className="w-full bg-indigo-500 text-white font-bold py-4 rounded-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
                            >
                                <Download size={20} />
                                下載備份檔案 (.json)
                            </button>
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-50 rounded-full opacity-50 z-0 pointer-events-none" />
                    </div>

                    {/* Archive Candidates */}
                    {archiveCandidates.length > 0 && (
                        <div className="bg-amber-50 p-8 rounded-[2rem] shadow-lg border border-amber-100 relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <Archive className="text-amber-600" size={24} />
                                    <h3 className="text-xl font-black text-amber-900">建議封存 ({archiveCandidates.length})</h3>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar mb-4">
                                    {archiveCandidates.map(emp => (
                                        <div key={emp.id} className="bg-white/60 p-3 rounded-xl flex justify-between items-center text-sm">
                                            <span className="font-bold text-amber-800">{emp.name}</span>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm(`封存並移除 ${emp.name}？`)) {
                                                        const data = { employee: emp, roster: roster.filter(r => r.employeeId === emp.id), archivedAt: new Date().toISOString() };
                                                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a'); a.href = url; a.download = `archive_${emp.name}.json`; a.click(); URL.revokeObjectURL(url);
                                                        await deleteEmployee(emp.id);
                                                    }
                                                }}
                                                className="text-amber-600 font-black hover:underline"
                                            >
                                                封存
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="md:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-start gap-4">
                        <AlertTriangle className="text-slate-400 shrink-0 mt-1" />
                        <div>
                            <h4 className="font-black text-slate-700 mb-1">備份說明</h4>
                            <p className="text-sm font-bold text-slate-500">
                                系統資料儲存於瀏覽器本地。請定期下載備份。若要檢視舊資料或已封存員工，請切換至「封存檢視器」。
                            </p>
                        </div>
                    </div>

                    {/* Migration Card */}
                    <div className="md:col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                                <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                                    <CloudUpload size={28} />
                                    一鍵上雲 (Cloud Sync)
                                </h3>
                                <p className="text-blue-100 font-bold max-w-lg">
                                    將您目前的 LocalStorage 資料一次性遷移至雲端資料庫 (Firebase)。
                                    啟用後，您將可在多台裝置上即時存取最新資料。
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (window.confirm('確定要執行資料遷移嗎？\n\n注意：這將會把您目前的本地資料寫入雲端，建議執行前先下載備份。')) {
                                        try {
                                            await migrateLocalToCloud();
                                        } catch (error) {
                                            console.error(error);
                                            alert('遷移失敗，請檢查 Console Log');
                                        }
                                    }
                                }}
                                className="bg-white text-blue-600 font-black px-8 py-4 rounded-xl shadow-lg hover:bg-blue-50 transition-all whitespace-nowrap"
                            >
                                開始遷移
                            </button>
                        </div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {!archiveData ? (
                        <div className="bg-white p-12 rounded-[2rem] shadow-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-all cursor-pointer relative group">
                            <input
                                type="file"
                                accept=".json,application/json"
                                onChange={handleArchiveUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-700 mb-2">上傳備份或封存檔</h3>
                            <p className="text-slate-400 font-bold">點擊或拖曳 JSON 檔案至此處</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">封存檔案檢視</h3>
                                    <p className="text-sm font-bold text-slate-500">
                                        包含 {archiveData.employees.length} 位員工資料
                                    </p>
                                </div>
                                <button
                                    onClick={() => setArchiveData(null)}
                                    className="text-slate-400 hover:text-slate-600 flex items-center gap-2 font-bold px-4 py-2 hover:bg-slate-100 rounded-lg transition-all"
                                >
                                    <ArrowLeft size={18} /> 重新上傳
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                                            <th className="py-4 px-6 font-black">員工姓名</th>
                                            <th className="py-4 px-6 font-black">分校</th>
                                            <th className="py-4 px-6 font-black">狀態</th>
                                            <th className="py-4 px-6 font-black">特休餘額</th>
                                            <th className="py-4 px-6 font-black">到期日</th>
                                            <th className="py-4 px-6 font-black">排休紀錄數</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {archiveData.employees.map(emp => {
                                            const empLeaves = archiveData.roster.filter(r => r.employeeId === emp.id);
                                            return (
                                                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-4 px-6 font-bold text-slate-700">{emp.name}</td>
                                                    <td className="py-4 px-6 font-bold text-slate-500">{emp.branch}</td>
                                                    <td className="py-4 px-6">
                                                        <span className={`px-2 py-1 rounded-lg text-xs font-black
                                                            ${emp.status === '在職' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            {emp.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-slate-700">
                                                        {(emp.annualLeave.initial + emp.annualLeave.earned) - emp.annualLeave.used} / {emp.annualLeave.initial + emp.annualLeave.earned}
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-slate-500 text-sm">{emp.annualLeave.expiry}</td>
                                                    <td className="py-4 px-6 font-bold text-blue-600">{empLeaves.length} 筆</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DataManagement;
