import { useState } from 'react';
import {
  LayoutDashboard,
  CalendarPlus,
  Users,
  FileText,
  Database,
  Settings,
  Building2,
  ScrollText
} from 'lucide-react';
import './index.css';
import DashboardV2 from './components/DashboardV2';
import LeaveInputV2 from './components/LeaveInputV2';
import EmployeeList from './components/EmployeeList';
import ReportCenterV2 from './components/ReportCenterV2';
import DataManagement from './components/DataManagement';
import SystemSettings from './components/SystemSettings';
import AuditLogViewer from './components/AuditLogViewer';
import { LeaveProvider, useLeaveSystem } from './context/LeaveContext';
import { AnnualResetService } from './services/AnnualResetService';
import { useEffect } from 'react';

// Auto-run annual reset check
function AnnualResetController() {
  useEffect(() => {
    AnnualResetService.checkAndRunAnnualReset();
  }, []);
  return null;
}

import { MonthlyAccrualService } from './services/MonthlyAccrualService';
function MonthlyAccrualController() {
  useEffect(() => {
    MonthlyAccrualService.checkAndRunMonthlyAccrual();
  }, []);
  return null;
}

import { AutoBackupService } from './services/AutoBackupService';
function AutoBackupController() {
  useEffect(() => {
    const timer = setTimeout(() => {
      AutoBackupService.checkAndRemind(() => {
        // 使用非阻塞方式記錄已提醒
        console.log('⚠️ 系統備份提醒：建議前往「資料備份」頁面下載最新備份檔。');
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

type TabType = 'dashboard' | 'leave-input' | 'employees' | 'reports' | 'audit-log' | 'data' | 'settings';

function AppContent() {
  const { branches } = useLeaveSystem();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedBranch, setSelectedBranch] = useState<string>('全部分校');

  // Ensure selected branch is valid (reset to All if not found, optional but good UX)
  // useEffect(() => {
  //   if (selectedBranch !== '全部分校' && !branches.includes(selectedBranch)) {
  //     setSelectedBranch('全部分校');
  //   }
  // }, [branches, selectedBranch]);

  const menuItems = [
    { id: 'dashboard' as TabType, label: '分校儀表板', icon: LayoutDashboard },
    { id: 'leave-input' as TabType, label: '排休申請', icon: CalendarPlus },
    { id: 'employees' as TabType, label: '員工管理', icon: Users },
    { id: 'reports' as TabType, label: '報表中心', icon: FileText },
    { id: 'audit-log' as TabType, label: '操作日誌', icon: ScrollText },
    { id: 'data' as TabType, label: '資料備份', icon: Database },
    { id: 'settings' as TabType, label: '系統設定', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* 側邊欄 */}
      <div className="w-64 bg-midnight-blue text-white flex flex-col shadow-2xl no-print">
        <div className="p-6 border-b border-indigo-400/20">
          <h1 className="text-2xl font-black tracking-tight">排休管理系統</h1>
          <p className="text-indigo-200 text-sm mt-1 font-medium">Tutoring School</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold ${activeTab === item.id
                  ? 'bg-white text-midnight-blue shadow-lg'
                  : 'text-indigo-100 hover:bg-indigo-900/30'
                  }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 主內容區 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 shadow-sm no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Building2 className="text-midnight-blue" size={24} />
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-4 py-2 border-2 border-slate-200 rounded-xl font-bold text-midnight-blue focus:outline-none focus:border-midnight-blue"
              >
                <option value="全部分校">全部分校</option>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* 內容區 */}
        <main className="flex-1 overflow-auto p-8">
          {activeTab === 'dashboard' && (
            <DashboardV2 selectedBranch={selectedBranch} onNavigate={(tab) => setActiveTab(tab as TabType)} />
          )}
          {activeTab === 'leave-input' && (
            <LeaveInputV2 selectedBranch={selectedBranch} />
          )}
          {activeTab === 'employees' && (
            <EmployeeList selectedBranch={selectedBranch} />
          )}
          {activeTab === 'reports' && (
            <ReportCenterV2 selectedBranch={selectedBranch} />
          )}
          {activeTab === 'audit-log' && (
            <AuditLogViewer />
          )}
          {activeTab === 'data' && (
            <DataManagement />
          )}
          {activeTab === 'settings' && (
            <SystemSettings />
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <LeaveProvider>
      <AnnualResetController />
      <MonthlyAccrualController />
      <AutoBackupController />
      <AppContent />
    </LeaveProvider>
  );
}

export default App;
