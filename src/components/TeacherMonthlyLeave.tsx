import { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Copy,
  Check,
  Plus,
  Trash2,
  Printer,
  UserCheck,
  FileText,
  Sliders
} from 'lucide-react';
import type {
  MonthlyCalendarState,
  TeacherRosterProfile,
  DayStatus
} from '../types/teacherSchedule';
import {
  DAY_STATUS_CONFIGS
} from '../types/teacherSchedule';
import {
  getMondaysInMonth,
  getMonthDays,
  calculateTeacherAttendance,
  generateGroupNoteText,
  getDefaultHolidays,
  INITIAL_SCHEDULE_DATA
} from '../utils/teacherScheduleEngine';

const STORAGE_KEY = 'teacher_calendar_schedule_store_v3';

export default function TeacherMonthlyLeave() {
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(9);

  // 全域所有月份日曆資料
  const [allData, setAllData] = useState<Record<string, MonthlyCalendarState>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('載入本機排休資料失敗:', e);
    }
    return INITIAL_SCHEDULE_DATA;
  });

  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // 當前月份的日曆狀態 (若尚未有資料，自動載入該月台灣法定國定假日)
  const currentState: MonthlyCalendarState = allData[monthKey] || {
    year: currentYear,
    month: currentMonth,
    mondaysCount: getMondaysInMonth(currentYear, currentMonth),
    holidays: getDefaultHolidays(currentYear, currentMonth),
    teachers: (allData['2026-09']?.teachers || []).map(t => ({
      ...t,
      previousBalance: 0
    })),
    attendance: {}
  };

  // 當前聚焦的老師 ID (預設第一位)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    return currentState.teachers[0]?.id || 'wang_hy';
  });

  // 當前選取的畫筆模式 (免打字點選)
  const [activeBrush, setActiveBrush] = useState<DayStatus>('leave');

  // 檢視模式：'calendar' (日曆點選排休) | 'matrix' (全體老師月度總表) | 'custom_sheet' (自製版面匯出) | 'note' (記事本輸出)
  const [activeView, setActiveView] = useState<'calendar' | 'matrix' | 'custom_sheet' | 'note'>('calendar');

  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 國定假日極速增刪彈窗
  const [showHolidayModal, setShowHolidayModal] = useState<boolean>(false);
  const [newHolidayDay, setNewHolidayDay] = useState<number>(10);
  const [newHolidayName, setNewHolidayName] = useState<string>('國慶日');

  // 國定假日全員加發假期額度開關 (所有人多一天假期，當天自由排休或存入未休)
  const [includeHolidayBonus, setIncludeHolidayBonus] = useState<boolean>(false);
  const holidayBonus = includeHolidayBonus ? Object.keys(currentState.holidays).length : 0;

  // 自動持久化
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
    } catch (e) {
      console.error('儲存排休資料失敗:', e);
    }
  }, [allData]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 更新當月狀態
  const updateCurrentState = (updater: (prev: MonthlyCalendarState) => MonthlyCalendarState) => {
    setAllData(prev => {
      const existing = prev[monthKey] || {
        year: currentYear,
        month: currentMonth,
        mondaysCount: getMondaysInMonth(currentYear, currentMonth),
        holidays: {},
        teachers: prev['2026-09']?.teachers || [],
        attendance: {}
      };
      const updated = updater(existing);
      return {
        ...prev,
        [monthKey]: updated
      };
    });
  };

  // 切換月份 (自動帶出上月未休累積作為本月初始值)
  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
    const key = `${year}-${String(month).padStart(2, '0')}`;

    if (!allData[key]) {
      // 尋找前一個月份
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      const prevData = allData[prevKey];

      const inheritedTeachers = (prevData?.teachers || allData['2026-09']?.teachers || []).map(t => {
        const prevAtt = prevData?.attendance[t.id];
        const prevCalc = prevData ? calculateTeacherAttendance(t, prevAtt, prevData.mondaysCount) : null;
        return {
          ...t,
          previousBalance: prevCalc ? prevCalc.accumulatedBalance : t.previousBalance
        };
      });

      setAllData(prev => ({
        ...prev,
        [key]: {
          year,
          month,
          mondaysCount: getMondaysInMonth(year, month),
          holidays: getDefaultHolidays(year, month),
          teachers: inheritedTeachers,
          attendance: {}
        }
      }));
    }
  };

  // 點擊日曆格子：使用當前畫筆標記，若再次點擊相同假別則清除
  const handleDayClick = (teacherId: string, day: number) => {
    updateCurrentState(prev => {
      const teacherAtt = prev.attendance[teacherId] || { teacherId, dayMarks: {} };
      const currentMark = teacherAtt.dayMarks[day];
      const nextMark: DayStatus = currentMark === activeBrush ? 'none' : activeBrush;

      const newDayMarks = { ...teacherAtt.dayMarks };
      if (nextMark === 'none') {
        delete newDayMarks[day];
      } else {
        newDayMarks[day] = nextMark;
      }

      return {
        ...prev,
        attendance: {
          ...prev.attendance,
          [teacherId]: {
            ...teacherAtt,
            dayMarks: newDayMarks
          }
        }
      };
    });
  };

  // 當前選定老師物件
  const activeTeacher = currentState.teachers.find(t => t.id === selectedTeacherId) || currentState.teachers[0];
  const activeAttendance = activeTeacher ? currentState.attendance[activeTeacher.id] : undefined;
  const activeCalc = activeTeacher
    ? calculateTeacherAttendance(activeTeacher, activeAttendance, currentState.mondaysCount, holidayBonus)
    : null;

  // 日期清單
  const monthDays = getMonthDays(currentYear, currentMonth, currentState.holidays);

  // 複製群組記事本
  const handleCopyNote = () => {
    const text = generateGroupNoteText(currentState);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      showToast('✅ 已複製 LINE 群組標準記事本文字！');
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // 修改老師基本設定 (如週休天數)
  const handleUpdateTeacherProfile = (teacherId: string, updates: Partial<TeacherRosterProfile>) => {
    updateCurrentState(prev => ({
      ...prev,
      teachers: prev.teachers.map(t => t.id === teacherId ? { ...t, ...updates } : t)
    }));
  };

  // 新增老師
  const handleAddTeacher = () => {
    const name = window.prompt('請輸入全職老師姓名：', '新老師');
    if (!name) return;
    const daysOffStr = window.prompt('每週排休天數（預設每週休 1 天請填 1，週休二日請填 2）：', '1');
    const daysOff = parseFloat(daysOffStr || '1') || 1;

    const newId = `teacher_${Date.now()}`;
    const newT: TeacherRosterProfile = {
      id: newId,
      name,
      hireDate: `${currentYear}/01/01`,
      weeklyDaysOff: daysOff,
      scheduleNote: daysOff > 1 ? `週休 ${daysOff}` : undefined,
      annualRange: `${currentYear}0101~${currentYear}1231`,
      annualRemaining: 0,
      previousBalance: 0
    };

    updateCurrentState(prev => ({
      ...prev,
      teachers: [...prev.teachers, newT]
    }));
    setSelectedTeacherId(newId);
    showToast(`➕ 已新增老師【${name}】`);
  };

  // 刪除老師
  const handleDeleteTeacher = (id: string, name: string) => {
    if (window.confirm(`確定要刪除【${name}】的排休資料嗎？`)) {
      updateCurrentState(prev => ({
        ...prev,
        teachers: prev.teachers.filter(t => t.id !== id)
      }));
      showToast(`🗑️ 已刪除【${name}】`);
    }
  };

  // 開啟國定假日新增彈窗
  const handleOpenHolidayModal = () => {
    // 預設日期為 1 號或今天
    setNewHolidayDay(Math.min(new Date().getDate(), getMonthDays(currentYear, currentMonth).length));
    setNewHolidayName('國定節日');
    setShowHolidayModal(true);
  };

  // 確認新增國定假日
  const confirmAddHoliday = () => {
    if (!newHolidayName.trim()) {
      alert('請填寫節日名稱！');
      return;
    }
    updateCurrentState(prev => ({
      ...prev,
      holidays: {
        ...prev.holidays,
        [newHolidayDay]: newHolidayName.trim()
      }
    }));
    setShowHolidayModal(false);
    showToast(`🚩 已新增國定假日: ${currentMonth}/${newHolidayDay} (${newHolidayName.trim()})`);
  };

  // 刪除國定假日
  const handleDeleteHoliday = (day: number) => {
    updateCurrentState(prev => {
      const nextH = { ...prev.holidays };
      delete nextH[day];
      return {
        ...prev,
        holidays: nextH
      };
    });
    showToast(`🗑️ 已移除 ${currentMonth}/${day} 國定假日`);
  };

  // 一鍵自動帶入官方國定假日
  const handleAutoFillHolidays = () => {
    const defaults = getDefaultHolidays(currentYear, currentMonth);
    const count = Object.keys(defaults).length;
    if (count === 0) {
      showToast(`ℹ️ ${currentYear} 年 ${currentMonth} 月無特殊官方國定假日`);
      return;
    }
    updateCurrentState(prev => ({
      ...prev,
      holidays: {
        ...prev.holidays,
        ...defaults
      }
    }));
    showToast(`🎉 已自動載入 ${count} 個法定國定假日！`);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Toast 提示 */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-bold text-sm">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 頂部主控台 */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <CalendarIcon size={28} />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  全職老師排休計算系統
                  <span className="text-xs bg-blue-500 text-white px-2.5 py-0.5 rounded-full font-bold">
                    免打字・點選排班
                  </span>
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  依「該月週一數 × 週休天數」精準計算每位老師假期，點擊日曆直接排休，自動即時結算與產生自製版面！
                </p>
              </div>
            </div>
          </div>

          {/* 年月份切換與視圖切換 */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 年份選擇 */}
            <select
              value={currentYear}
              onChange={(e) => handleMonthChange(Number(e.target.value), currentMonth)}
              className="bg-slate-800 border border-slate-700 text-cyan-300 font-bold px-3 py-2 rounded-xl text-sm focus:outline-none"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y} 年</option>
              ))}
            </select>

            {/* 月份按鈕 */}
            <div className="flex items-center bg-slate-800 p-1 rounded-2xl border border-slate-700">
              {[7, 8, 9, 10, 11, 12].map(m => (
                <button
                  key={m}
                  onClick={() => handleMonthChange(currentYear, m)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    currentMonth === m
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m} 月
                </button>
              ))}
            </div>

            {/* 一鍵複製記事本貼文按鈕 */}
            <button
              onClick={handleCopyNote}
              className={`flex items-center gap-2 font-bold px-4 py-2 rounded-2xl shadow-lg transition-all text-xs active:scale-95 ${
                copySuccess ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white'
              }`}
            >
              {copySuccess ? <Check size={16} /> : <Copy size={16} />}
              <span>{copySuccess ? '已複製記事本！' : '一鍵複製記事本'}</span>
            </button>
          </div>
        </div>

        {/* 核心算式參數條 */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* 該月週一數 */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700">
              <span className="text-slate-300 font-medium">🕒 當月日曆週一數量:</span>
              <span className="text-cyan-400 font-black text-sm">{currentState.mondaysCount} 個週一</span>
              <span className="text-slate-400 text-[11px]">(基準應休依此乘算法定天數)</span>
            </div>

            {/* 國定假日 */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 flex-wrap">
              <span className="text-slate-300 font-medium">🚩 當月國定假日:</span>
              {Object.keys(currentState.holidays).length > 0 ? (
                Object.entries(currentState.holidays).map(([d, name]) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1.5 bg-rose-950/60 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded text-xs font-semibold"
                  >
                    <span>{currentMonth}/{d} ({name})</span>
                    <button
                      onClick={() => handleDeleteHoliday(parseInt(d, 10))}
                      title="刪除此假日"
                      className="text-rose-400 hover:text-white font-bold ml-0.5 px-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-slate-500 italic">無特殊國定紅字</span>
              )}

              {/* 操作按鈕組 */}
              <div className="flex items-center gap-2 ml-1">
                <button
                  onClick={handleOpenHolidayModal}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 bg-slate-700/60 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-600 transition-colors shadow-sm active:scale-95"
                >
                  <Plus size={12} />
                  <span>➕ 新增紅字</span>
                </button>
                <button
                  onClick={handleAutoFillHolidays}
                  title="自動帶入台灣法定國定假日"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-700/40 hover:bg-slate-700 px-2 py-1 rounded-lg border border-slate-600/60 transition-colors"
                >
                  <span>🔄 自動帶入法定假日</span>
                </button>

                {/* 國定假日全員加假開關 */}
                {Object.keys(currentState.holidays).length > 0 && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-cyan-300 font-bold bg-cyan-950/40 hover:bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-700/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={includeHolidayBonus}
                      onChange={(e) => setIncludeHolidayBonus(e.target.checked)}
                      className="rounded accent-cyan-400"
                    />
                    <span>全員應休加發 +{Object.keys(currentState.holidays).length}天假 (當天自由排休)</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">目前全職老師:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              {currentState.teachers.length} 位
            </span>
          </div>
        </div>
      </div>

      {/* 視圖切換標籤 (Tab Switcher) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('calendar')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
              activeView === 'calendar'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <CalendarIcon size={17} />
            <span>日曆點選排休 (免打字)</span>
          </button>
          <button
            onClick={() => setActiveView('matrix')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
              activeView === 'matrix'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Sliders size={17} />
            <span>全校月度排休總表</span>
          </button>
          <button
            onClick={() => setActiveView('custom_sheet')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
              activeView === 'custom_sheet'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <UserCheck size={17} />
            <span>自製版面卡片匯出</span>
          </button>
          <button
            onClick={() => setActiveView('note')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
              activeView === 'note'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <FileText size={17} />
            <span>記事本輸出文字</span>
          </button>
        </div>

        <button
          onClick={handleAddTeacher}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl shadow transition-all text-xs active:scale-95"
        >
          <Plus size={15} />
          <span>新增全職老師</span>
        </button>
      </div>

      {/* 視圖 A：日曆點選排休 (核心主畫面，完全免打字！) */}
      {activeView === 'calendar' && activeTeacher && activeCalc && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左側：老師切換名冊 */}
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                選擇排休老師
              </h3>
              <div className="space-y-2">
                {currentState.teachers.map((t) => {
                  const att = currentState.attendance[t.id];
                  const calc = calculateTeacherAttendance(t, att, currentState.mondaysCount, holidayBonus);
                  const isSelected = t.id === selectedTeacherId;

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeacherId(t.id)}
                      className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 shadow-sm'
                          : 'bg-slate-50/70 border-slate-200/70 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-base ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                            {t.name}
                          </span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                            {t.scheduleNote || `週休 ${t.weeklyDaysOff}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          應休 {calc.baseQuota} 天 ｜ 已排 {calc.leaveCount + calc.sickCount} 天
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-sm font-black font-mono px-2 py-0.5 rounded-lg ${
                          calc.monthlyBalance >= 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {calc.monthlyBalance > 0 ? `+${calc.monthlyBalance}` : calc.monthlyBalance}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          餘假
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 快速畫筆工具列 (Palette) */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 space-y-2.5">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                排假畫筆（點擊日曆直接標記）
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(['leave', 'sick', 'make_up', 'gept', 'none'] as DayStatus[]).map((type) => {
                  const cfg = DAY_STATUS_CONFIGS[type];
                  const isActive = activeBrush === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveBrush(type)}
                      className={`p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
                        isActive
                          ? 'ring-2 ring-blue-500 border-transparent shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                      style={{ backgroundColor: isActive ? `${cfg.color}15` : undefined }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <span>{cfg.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右側：主日曆網格與即時算式 */}
          <div className="lg:col-span-9 space-y-4">
            {/* 老師大名與算式看板 (Live Calculation HUD) */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md">
                    {activeTeacher.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900">{activeTeacher.name}</h2>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-bold">
                        到職日: {activeTeacher.hireDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span>排休設定: <strong>每週休 {activeTeacher.weeklyDaysOff} 天</strong></span>
                      <span>年度特休: <strong>{activeTeacher.annualRemaining} 天</strong> ({activeTeacher.annualRange})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={activeTeacher.weeklyDaysOff}
                    onChange={(e) => handleUpdateTeacherProfile(activeTeacher.id, {
                      weeklyDaysOff: parseFloat(e.target.value) || 1,
                      scheduleNote: parseFloat(e.target.value) > 1 ? `週休 ${e.target.value}` : undefined
                    })}
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none"
                  >
                    <option value="1">週休 1 天 (算式: 週一數 × 1)</option>
                    <option value="2">週休 2 天 (算式: 週一數 × 2)</option>
                    <option value="1.7">特殊 1.7 (如徐子翔 8.5天)</option>
                  </select>
                  <button
                    onClick={() => handleDeleteTeacher(activeTeacher.id, activeTeacher.name)}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"
                    title="刪除老師"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* 5 大即時指標看板 */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-center">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <div className="text-[11px] text-slate-500 font-medium">當月應休假期</div>
                  <div className="text-xl font-black text-slate-800 font-mono mt-0.5">
                    {activeCalc.baseQuota} <span className="text-xs font-normal">天</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentState.mondaysCount}週一 × {activeTeacher.weeklyDaysOff}天
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200/70">
                  <div className="text-[11px] text-blue-700 font-medium">實排休假天數</div>
                  <div className="text-xl font-black text-blue-700 font-mono mt-0.5">
                    {activeCalc.leaveCount + activeCalc.sickCount} <span className="text-xs font-normal">天</span>
                  </div>
                  <div className="text-[10px] text-blue-500">
                    排休{activeCalc.leaveCount} + 病假{activeCalc.sickCount}
                  </div>
                </div>

                <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-200/70">
                  <div className="text-[11px] text-purple-700 font-medium">特殊加減假</div>
                  <div className="text-xl font-black text-purple-700 font-mono mt-0.5">
                    {activeCalc.makeUpCount > 0 ? `+${activeCalc.makeUpCount}` : ''}
                    {activeCalc.geptDeduction > 0 ? `-${activeCalc.geptDeduction}` : (activeCalc.makeUpCount === 0 ? '0' : '')}
                    <span className="text-xs font-normal"> 天</span>
                  </div>
                  <div className="text-[10px] text-purple-500">
                    補假+{activeCalc.makeUpCount} / 英檢-{activeCalc.geptDeduction}
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border ${
                  activeCalc.monthlyBalance >= 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="text-[11px] font-bold">⭕ 本月餘假</div>
                  <div className="text-2xl font-black font-mono mt-0.5">
                    {activeCalc.monthlyBalance > 0 ? `+${activeCalc.monthlyBalance}` : activeCalc.monthlyBalance}
                    <span className="text-xs font-normal"> 天</span>
                  </div>
                  <div className="text-[10px] opacity-80">
                    {activeCalc.monthlyBalance >= 0 ? '少休存假' : '超休借假'}
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200/70">
                  <div className="text-[11px] text-indigo-700 font-medium">🌞 未休累積小計</div>
                  <div className="text-2xl font-black text-indigo-900 font-mono mt-0.5">
                    {activeCalc.accumulatedBalance} <span className="text-xs font-normal">天</span>
                  </div>
                  <div className="text-[10px] text-indigo-500">
                    上月{activeTeacher.previousBalance} + 本月{activeCalc.monthlyBalance}
                  </div>
                </div>
              </div>
            </div>

            {/* 日曆網格 (Calendar Grid - 點擊上色) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-800">
                    📅 {currentYear} 年 {currentMonth} 月 日曆排班表
                  </span>
                  <span className="text-xs text-slate-400">
                    (目前畫筆: <strong className="text-blue-600">{DAY_STATUS_CONFIGS[activeBrush].label}</strong>，點擊日期直接上色)
                  </span>
                </div>
              </div>

              {/* 星期表頭 */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-2">
                <span className="text-rose-500">週日</span>
                <span className="text-cyan-600 font-black">週一 (基準日)</span>
                <span>週二</span>
                <span>週三</span>
                <span>週四</span>
                <span>週五</span>
                <span className="text-rose-500">週六</span>
              </div>

              {/* 日期網格 */}
              <div className="grid grid-cols-7 gap-2">
                {/* 補齊 1 號之前的空位 */}
                {Array.from({ length: new Date(currentYear, currentMonth - 1, 1).getDay() }).map((_, idx) => (
                  <div key={`empty_${idx}`} className="h-20 bg-slate-50/40 rounded-2xl border border-transparent" />
                ))}

                {/* 當月所有日期 */}
                {monthDays.map((d) => {
                  const status: DayStatus = activeAttendance?.dayMarks[d.day] || 'none';
                  const cfg = DAY_STATUS_CONFIGS[status];
                  const hasMark = status !== 'none';

                  return (
                    <button
                      key={d.day}
                      onClick={() => handleDayClick(activeTeacher.id, d.day)}
                      className={`h-20 p-2 rounded-2xl transition-all flex flex-col justify-between text-left border relative group ${
                        hasMark
                          ? 'shadow-sm border-transparent text-white'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-800'
                      }`}
                      style={{
                        backgroundColor: hasMark ? cfg.color : undefined
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`font-mono text-sm font-bold ${
                          hasMark ? 'text-white' : (d.isMonday ? 'text-cyan-700 font-black' : (d.isWeekend ? 'text-rose-500' : 'text-slate-700'))
                        }`}>
                          {d.day}
                        </span>

                        {d.holidayName && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                            hasMark ? 'bg-black/20 text-white' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {d.holidayName}
                          </span>
                        )}
                      </div>

                      {/* 假別徽章 */}
                      {hasMark ? (
                        <div className="bg-black/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg truncate text-center">
                          {cfg.label}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                          點擊排休
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 視圖 B：全校月度總表 (Matrix View) */}
      {activeView === 'matrix' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-800">
              📊 {currentYear} 年 {currentMonth} 月 全校老師排休一覽表
            </h3>
            <span className="text-xs text-slate-500">
              提示：可直接在此表格點擊任何格子進行排假
            </span>
          </div>

          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                <th className="p-3 sticky left-0 bg-slate-100 z-10 w-24">全職老師</th>
                <th className="p-3 w-16 text-center">應休</th>
                <th className="p-3 w-16 text-center">實排</th>
                <th className="p-3 w-16 text-center">餘假</th>
                <th className="p-3 w-16 text-center">未休累積</th>
                {monthDays.map((d) => (
                  <th
                    key={d.day}
                    className={`p-2 text-center w-8 font-mono ${
                      d.isMonday ? 'bg-cyan-100 text-cyan-800 font-black' : (d.isWeekend ? 'text-rose-500' : '')
                    }`}
                  >
                    <div>{d.day}</div>
                    <div className="text-[9px] font-normal">{['日', '一', '二', '三', '四', '五', '六'][d.dayOfWeek]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentState.teachers.map((t) => {
                const att = currentState.attendance[t.id];
                const calc = calculateTeacherAttendance(t, att, currentState.mondaysCount, holidayBonus);

                return (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="p-3 font-black text-slate-800 sticky left-0 bg-white shadow-sm">
                      {t.name}
                    </td>
                    <td className="p-2 text-center font-mono font-bold text-slate-700 bg-slate-50">
                      {calc.baseQuota}
                    </td>
                    <td className="p-2 text-center font-mono font-bold text-blue-600 bg-blue-50/30">
                      {calc.leaveCount + calc.sickCount}
                    </td>
                    <td className="p-2 text-center font-mono font-black">
                      <span className={`px-1.5 py-0.5 rounded ${calc.monthlyBalance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {calc.monthlyBalance > 0 ? `+${calc.monthlyBalance}` : calc.monthlyBalance}
                      </span>
                    </td>
                    <td className="p-2 text-center font-mono font-black text-indigo-900 bg-indigo-50/30">
                      {calc.accumulatedBalance}
                    </td>

                    {/* 每日點選格子 */}
                    {monthDays.map((d) => {
                      const status: DayStatus = att?.dayMarks[d.day] || 'none';
                      const hasMark = status !== 'none';
                      const cfg = DAY_STATUS_CONFIGS[status];

                      return (
                        <td
                          key={d.day}
                          onClick={() => handleDayClick(t.id, d.day)}
                          className="p-1 text-center cursor-pointer"
                        >
                          <div
                            className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center font-bold text-[10px] transition-all ${
                              hasMark ? 'text-white shadow-sm' : 'hover:bg-slate-200/60 text-transparent'
                            }`}
                            style={{ backgroundColor: hasMark ? cfg.color : undefined }}
                          >
                            {status === 'leave' && '休'}
                            {status === 'sick' && '病'}
                            {status === 'make_up' && '補'}
                            {status === 'gept' && '檢'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 視圖 C：自製版面卡片匯出 (Custom Visual Sheet) */}
      {activeView === 'custom_sheet' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 max-w-4xl mx-auto print:shadow-none print:border-none">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                🏫 補習班全職老師月度休假結算表
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                年份月份: {currentYear} 年 {currentMonth} 月 ｜ 本月 {currentState.mondaysCount} 個週一 (法定休假基數)
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow hover:bg-slate-800"
            >
              <Printer size={15} />
              <span>列印 / 存為 PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentState.teachers.map((t) => {
              const att = currentState.attendance[t.id];
              const calc = calculateTeacherAttendance(t, att, currentState.mondaysCount, holidayBonus);

              return (
                <div key={t.id} className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div>
                      <span className="text-lg font-black text-slate-800">{t.name}</span>
                      <span className="text-xs text-slate-500 ml-2">入職日: {t.hireDate}</span>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded">
                      每週休 {t.weeklyDaysOff} 天
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-700">
                    <div>
                      <strong className="text-blue-700">▶️ 排休日:</strong>{' '}
                      {calc.leaveDays.length > 0 ? calc.leaveDays.map(d => `${currentMonth}/${d}`).join('、') : '無'}
                    </div>
                    {calc.sickDays.length > 0 && (
                      <div>
                        <strong className="text-orange-700">▶️ 病假:</strong>{' '}
                        {calc.sickDays.map(d => `${currentMonth}/${d}`).join('、')}
                      </div>
                    )}
                    {calc.makeUpDays.length > 0 && (
                      <div>
                        <strong className="text-emerald-700">▶️ 補假:</strong>{' '}
                        {calc.makeUpDays.map(d => `${currentMonth}/${d}`).join('、')}
                      </div>
                    )}
                    {calc.geptDays.length > 0 && (
                      <div>
                        <strong className="text-purple-700">▶️ 英檢班扣假:</strong>{' '}
                        {calc.geptDays.map(d => `${currentMonth}/${d}`).join('、')} (扣 {calc.geptDeduction} 天)
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <div className="text-slate-400 text-[10px]">應休 / 實休</div>
                      <div className="font-bold text-slate-800 mt-0.5 font-mono">
                        {calc.baseQuota} / {calc.leaveCount + calc.sickCount}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <div className="text-slate-400 text-[10px]">本月餘假</div>
                      <div className="font-bold font-mono mt-0.5 text-blue-600">
                        {calc.monthlyBalance > 0 ? `+${calc.monthlyBalance}` : calc.monthlyBalance}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <div className="text-slate-400 text-[10px]">未休小計</div>
                      <div className="font-black font-mono mt-0.5 text-indigo-900">
                        {calc.accumulatedBalance} 天
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 視圖 D：LINE 記事本輸出文字 (Output View) */}
      {activeView === 'note' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4 max-w-3xl mx-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-800">
                📱 LINE 群組記事本輸出文字
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                此文字是系統根據您點選排休日曆與週休公式自動生成的結果，按右邊按鈕即可一鍵複製至群組發布。
              </p>
            </div>
            <button
              onClick={handleCopyNote}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow active:scale-95"
            >
              {copySuccess ? <Check size={15} /> : <Copy size={15} />}
              <span>{copySuccess ? '已複製！' : '複製記事本'}</span>
            </button>
          </div>

          <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl font-mono text-sm leading-relaxed overflow-x-auto shadow-inner border border-slate-800">
            <pre className="whitespace-pre-wrap font-sans selection:bg-cyan-500 selection:text-black">
              {generateGroupNoteText(currentState)}
            </pre>
          </div>
        </div>
      )}

      {/* 國定假日快捷新增彈窗 (Holiday Modal) */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-lg">🚩</span>
                <div>
                  <h3 className="text-lg font-black text-slate-800">新增 {currentMonth} 月國定假日 / 紅字</h3>
                  <p className="text-xs text-slate-400">設定後會自動標記在日曆上並組合於記事本</p>
                </div>
              </div>
              <button
                onClick={() => setShowHolidayModal(false)}
                className="text-slate-400 hover:text-slate-600 font-black text-lg p-1"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-left">
              {/* 日期選擇 */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">
                  選擇日期 (幾號):
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 text-sm">{currentMonth} 月</span>
                  <select
                    value={newHolidayDay}
                    onChange={(e) => setNewHolidayDay(parseInt(e.target.value, 10))}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    {monthDays.map(d => (
                      <option key={d.day} value={d.day}>
                        {d.day} 號 (週{['日', '一', '二', '三', '四', '五', '六'][d.dayOfWeek]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 節日名稱 */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">
                  節日名稱:
                </label>
                <input
                  type="text"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  placeholder="例如: 中秋節、教師節、國慶日、颱風假"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 快捷常見節日標籤 */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-2">常用節日快捷點選:</div>
                <div className="flex flex-wrap gap-1.5">
                  {['中秋節', '教師節', '國慶日', '元旦', '春節', '清明節', '端午節', '勞動節', '颱風假', '校慶補假'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNewHolidayName(tag)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        newHolidayName === tag
                          ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 底部按鈕 */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowHolidayModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                取消
              </button>
              <button
                onClick={confirmAddHoliday}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md active:scale-95"
              >
                確定新增紅字
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
