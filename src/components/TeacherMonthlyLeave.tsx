import { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  Sliders
} from 'lucide-react';
import type {
  MonthlyLeaveData,
  TeacherMonthlyRecord,
  SpecialItem,
  HolidayItem
} from '../types/teacherLeave';
import {
  countMondays,
  calculateTeacherBalances,
  formatToNoteText,
  parseNoteText,
  SEED_DATA
} from '../utils/teacherLeaveParser';

const STORAGE_KEY = 'teacher_monthly_leave_data_v2';

export default function TeacherMonthlyLeave() {
  // 當前選取之年月
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(9);

  // 全域所有月份資料集
  const [allData, setAllData] = useState<Record<string, MonthlyLeaveData>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('載入本機歷史月假資料失敗:', e);
    }
    return SEED_DATA;
  });

  // 當前月份的資料
  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const currentMonthData: MonthlyLeaveData = allData[monthKey] || {
    year: currentYear,
    month: currentMonth,
    mondaysCount: countMondays(currentYear, currentMonth),
    holidays: [],
    teachers: []
  };

  // UI 狀態
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'cards' | 'preview'>('cards');

  // 自動持久化儲存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
    } catch (e) {
      console.error('儲存月假資料失敗:', e);
    }
  }, [allData]);

  // Toast 提示
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 更新當月資料輔助函式
  const updateCurrentMonthData = (updater: (prev: MonthlyLeaveData) => MonthlyLeaveData) => {
    setAllData(prev => {
      const existing = prev[monthKey] || {
        year: currentYear,
        month: currentMonth,
        mondaysCount: countMondays(currentYear, currentMonth),
        holidays: [],
        teachers: []
      };
      const updated = updater(existing);
      return {
        ...prev,
        [monthKey]: updated
      };
    });
  };

  // 年月份切換
  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
    const key = `${year}-${String(month).padStart(2, '0')}`;
    
    // 若該月份不存在，則初始化並嘗試繼承前一月的排休累計
    if (!allData[key]) {
      // 尋找前一個月的 key
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      const prevData = allData[prevKey];

      const initialTeachers: TeacherMonthlyRecord[] = prevData
        ? prevData.teachers.map(t => {
            const { accumulatedBalance } = calculateTeacherBalances(t, prevData.mondaysCount, prevData.holidays);
            return {
              ...t,
              id: `teacher_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              leaveDaysText: '',
              actualLeaveCount: 0,
              additions: [],
              deductions: [],
              holidayNotes: '',
              previousBalance: accumulatedBalance, // 自動繼承上一月的未休累計！
              monthlyBalanceManual: undefined,
              accumulatedBalanceManual: undefined
            };
          })
        : [];

      setAllData(prev => ({
        ...prev,
        [key]: {
          year,
          month,
          mondaysCount: countMondays(year, month),
          holidays: [],
          teachers: initialTeachers
        }
      }));
    }
  };

  // 一鍵複製群組記事本貼文
  const handleCopyNote = () => {
    const text = formatToNoteText(currentMonthData);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      showToast('✅ 已成功複製 LINE 群組標準記事本格式！');
      setTimeout(() => setCopySuccess(false), 2500);
    }).catch(err => {
      console.error('複製失敗:', err);
      showToast('❌ 複製失敗，請手動全選複製。');
    });
  };

  // 智慧解析貼上文字
  const handleParseAndImport = () => {
    if (!importText.trim()) return;
    try {
      const parsed = parseNoteText(importText);
      setCurrentYear(parsed.year);
      setCurrentMonth(parsed.month);
      const newKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      setAllData(prev => ({
        ...prev,
        [newKey]: parsed
      }));
      setShowImportModal(false);
      setImportText('');
      showToast(`🎉 成功解析並匯入 ${parsed.year} 年 ${parsed.month} 月共 ${parsed.teachers.length} 位老師的紀錄！`);
    } catch (e) {
      console.error(e);
      showToast('❌ 解析發生錯誤，請檢查文字格式是否包含【姓名】與日期。');
    }
  };

  // 新增一位老師
  const handleAddTeacher = () => {
    const newTeacher: TeacherMonthlyRecord = {
      id: `teacher_${Date.now()}`,
      name: '新進老師',
      hireDate: `${currentYear}/01/01`,
      scheduleType: 'mon_only',
      leaveDaysText: '',
      actualLeaveCount: 0,
      additions: [],
      deductions: [],
      annualRange: `${currentYear}0101~${currentYear}1231`,
      annualRemaining: 0,
      previousBalance: 0
    };
    updateCurrentMonthData(prev => ({
      ...prev,
      teachers: [...prev.teachers, newTeacher]
    }));
    showToast('➕ 已新增一位老師卡片');
  };

  // 刪除老師
  const handleDeleteTeacher = (id: string, name: string) => {
    if (window.confirm(`確定要刪除【${name}】在 ${currentMonth} 月的排休卡片嗎？`)) {
      updateCurrentMonthData(prev => ({
        ...prev,
        teachers: prev.teachers.filter(t => t.id !== id)
      }));
      showToast(`🗑️ 已刪除【${name}】`);
    }
  };

  // 更新單一老師屬性
  const handleUpdateTeacher = (id: string, updates: Partial<TeacherMonthlyRecord>) => {
    updateCurrentMonthData(prev => ({
      ...prev,
      teachers: prev.teachers.map(t => (t.id === id ? { ...t, ...updates } : t))
    }));
  };

  // 微調天數輔助 (支援增減 0.25, 0.5, 1 等)
  const adjustTeacherBalance = (id: string, delta: number) => {
    updateCurrentMonthData(prev => ({
      ...prev,
      teachers: prev.teachers.map(t => {
        if (t.id !== id) return t;
        const currentBal = t.monthlyBalanceManual !== undefined
          ? t.monthlyBalanceManual
          : calculateTeacherBalances(t, prev.mondaysCount, prev.holidays).monthlyBalance;
        const newBal = Number((currentBal + delta).toFixed(2));
        return {
          ...t,
          monthlyBalanceManual: newBal,
          accumulatedBalanceManual: Number((t.previousBalance + newBal).toFixed(2))
        };
      })
    }));
  };

  // 新增補假加項
  const handleAddAddition = (teacherId: string) => {
    const newItem: SpecialItem = {
      id: `add_${Date.now()}`,
      type: 'addition',
      title: '上課補假 (待補)',
      datesText: '',
      days: 1
    };
    updateCurrentMonthData(prev => ({
      ...prev,
      teachers: prev.teachers.map(t => {
        if (t.id !== teacherId) return t;
        return {
          ...t,
          additions: [...(t.additions || []), newItem]
        };
      })
    }));
  };

  // 新增扣假減項
  const handleAddDeduction = (teacherId: string) => {
    const newItem: SpecialItem = {
      id: `ded_${Date.now()}`,
      type: 'deduction',
      title: '英檢班 (待紀錄)',
      datesText: '',
      days: 0.5
    };
    updateCurrentMonthData(prev => ({
      ...prev,
      teachers: prev.teachers.map(t => {
        if (t.id !== teacherId) return t;
        return {
          ...t,
          deductions: [...(t.deductions || []), newItem]
        };
      })
    }));
  };

  // 移除加/減項
  const handleRemoveSpecialItem = (teacherId: string, itemId: string, type: 'addition' | 'deduction') => {
    updateCurrentMonthData(prev => ({
      ...prev,
      teachers: prev.teachers.map(t => {
        if (t.id !== teacherId) return t;
        return {
          ...t,
          [type === 'addition' ? 'additions' : 'deductions']: t[type === 'addition' ? 'additions' : 'deductions'].filter(i => i.id !== itemId)
        };
      })
    }));
  };

  // 新增國定假日紅字
  const handleAddHoliday = () => {
    const name = window.prompt('請輸入國定假日名稱（如：中秋節、國慶日）：', '節日');
    if (!name) return;
    const dateText = window.prompt('請輸入日期標記（如：9/26、10/10）：', `${currentMonth}/`);
    if (!dateText) return;

    const newH: HolidayItem = {
      id: `h_${Date.now()}`,
      name,
      dateText,
      days: 0
    };
    updateCurrentMonthData(prev => ({
      ...prev,
      holidays: [...(prev.holidays || []), newH]
    }));
  };

  // 移除國定假日
  const handleRemoveHoliday = (id: string) => {
    updateCurrentMonthData(prev => ({
      ...prev,
      holidays: prev.holidays.filter(h => h.id !== id)
    }));
  };

  // 生成即時預覽文字
  const previewNoteText = formatToNoteText(currentMonthData);

  return (
    <div className="space-y-6 pb-20">
      {/* Toast 提示 */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in font-bold text-sm">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 頂部操作中樞 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-indigo-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-indigo-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
                <Calendar size={28} />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  全職老師月假算式 & 群組記事本
                  <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-full border border-cyan-400/30 font-semibold">
                    v2.5 Pro
                  </span>
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  自動精算週一排休基數、加項補假、特殊扣除、跨月未休小計與勞基法特休，一鍵直接產出 LINE 記事本！
                </p>
              </div>
            </div>
          </div>

          {/* 年月份切換與快捷控制 */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 年份切換 */}
            <select
              value={currentYear}
              onChange={(e) => handleMonthChange(Number(e.target.value), currentMonth)}
              className="bg-slate-800/80 border border-slate-700 text-cyan-300 font-bold px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-cyan-400"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y} 年</option>
              ))}
            </select>

            {/* 月份快捷按鈕列 */}
            <div className="flex items-center bg-slate-800/90 p-1 rounded-2xl border border-slate-700">
              {[7, 8, 9, 10, 11, 12].map(m => (
                <button
                  key={m}
                  onClick={() => handleMonthChange(currentYear, m)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    currentMonth === m
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m} 月
                </button>
              ))}
            </div>

            {/* 智慧貼上辨識按鈕 */}
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold px-4 py-2 rounded-2xl shadow-lg transition-all text-sm active:scale-95"
            >
              <Sparkles size={16} />
              <span>貼上記事本辨識</span>
            </button>

            {/* 一鍵複製記事本貼文 */}
            <button
              onClick={handleCopyNote}
              className={`flex items-center gap-2 font-bold px-4 py-2 rounded-2xl shadow-lg transition-all text-sm active:scale-95 ${
                copySuccess
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white'
              }`}
            >
              {copySuccess ? <Check size={16} /> : <Copy size={16} />}
              <span>{copySuccess ? '已複製記事本！' : '複製記事本貼文'}</span>
            </button>
          </div>
        </div>

        {/* 月度參數條：本月週一數與國定假日 */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* 週一數量 */}
            <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 font-medium">🕒 本月週一數（基準額度）:</span>
              <span className="text-cyan-400 font-black text-sm">{currentMonthData.mondaysCount} 天</span>
              <button
                title="自動依日曆重新計算"
                onClick={() => {
                  const autoCount = countMondays(currentYear, currentMonth);
                  updateCurrentMonthData(prev => ({ ...prev, mondaysCount: autoCount }));
                  showToast(`已重算 ${currentMonth} 月週一數量為 ${autoCount} 個`);
                }}
                className="p-1 text-slate-400 hover:text-cyan-300"
              >
                <RefreshCw size={13} />
              </button>
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => updateCurrentMonthData(prev => ({ ...prev, mondaysCount: Math.max(1, prev.mondaysCount - 1) }))}
                  className="w-5 h-5 bg-slate-700 hover:bg-slate-600 rounded text-center text-xs text-white"
                >
                  -
                </button>
                <button
                  onClick={() => updateCurrentMonthData(prev => ({ ...prev, mondaysCount: prev.mondaysCount + 1 }))}
                  className="w-5 h-5 bg-slate-700 hover:bg-slate-600 rounded text-center text-xs text-white"
                >
                  +
                </button>
              </div>
            </div>

            {/* 國定假日紅字標籤 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-medium">🚩 當月紅字/國定節日:</span>
              {currentMonthData.holidays && currentMonthData.holidays.length > 0 ? (
                currentMonthData.holidays.map(h => (
                  <span
                    key={h.id}
                    className="inline-flex items-center gap-1.5 bg-rose-950/40 text-rose-300 border border-rose-800/50 px-2.5 py-1 rounded-lg text-xs"
                  >
                    <span>{h.dateText}({h.name})</span>
                    <button
                      onClick={() => handleRemoveHoliday(h.id)}
                      className="text-rose-400 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-slate-500 italic">無特殊國定假日</span>
              )}
              <button
                onClick={handleAddHoliday}
                className="text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 text-xs"
              >
                <Plus size={12} />
                <span>新增紅字</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">目前全職老師共:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
              {currentMonthData.teachers.length} 位
            </span>
          </div>
        </div>
      </div>

      {/* 視圖切換標籤（卡片式精算 / 記事本預覽） */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewTab('cards')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              previewTab === 'cards'
                ? 'bg-midnight-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Sliders size={16} />
            <span>老師排休精算卡片 ({currentMonthData.teachers.length})</span>
          </button>
          <button
            onClick={() => setPreviewTab('preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              previewTab === 'preview'
                ? 'bg-midnight-blue text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <FileText size={16} />
            <span>LINE 群組記事本文字預覽</span>
          </button>
        </div>

        <button
          onClick={handleAddTeacher}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl shadow transition-all text-xs active:scale-95"
        >
          <Plus size={15} />
          <span>新增全職老師</span>
        </button>
      </div>

      {/* 主體展示區 */}
      {previewTab === 'cards' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {currentMonthData.teachers.map((teacher, index) => {
            const {
              baseQuota,
              totalAdditions,
              totalDeductions,
              monthlyBalance,
              accumulatedBalance
            } = calculateTeacherBalances(
              teacher,
              currentMonthData.mondaysCount,
              currentMonthData.holidays
            );

            const isPositive = monthlyBalance >= 0;

            return (
              <div
                key={teacher.id}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* 卡片標頭：老師大名與入職日 */}
                  <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-black flex items-center justify-center text-sm border border-indigo-100">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={teacher.name}
                          onChange={(e) => handleUpdateTeacher(teacher.id, { name: e.target.value })}
                          className="text-xl font-black text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none px-1"
                        />
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                          全職
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 pl-1">
                        <span>到職日:</span>
                        <input
                          type="text"
                          value={teacher.hireDate}
                          onChange={(e) => handleUpdateTeacher(teacher.id, { hireDate: e.target.value })}
                          placeholder="YYYY/MM/DD"
                          className="font-mono text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* 週休模式與刪除按鈕 */}
                    <div className="flex items-center gap-2">
                      <select
                        value={teacher.scheduleType}
                        onChange={(e) => handleUpdateTeacher(teacher.id, { scheduleType: e.target.value as any })}
                        className="text-xs font-bold border border-slate-200 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-xl focus:outline-none"
                      >
                        <option value="mon_only">週休一日 (每週休週一)</option>
                        <option value="weekend2">週休 2 天</option>
                        <option value="custom">自訂應休基準</option>
                      </select>
                      <button
                        title="刪除此老師卡片"
                        onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 排休明細與天數 */}
                  <div className="mt-4 space-y-3">
                    <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span className="flex items-center gap-1 text-indigo-700">
                          <span>▶️ ➖ 排休登記</span>
                          <span className="text-[11px] text-slate-400 font-normal">(日期以頓號或換行分隔)</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">實休天數:</span>
                          <input
                            type="number"
                            step="0.25"
                            value={teacher.actualLeaveCount}
                            onChange={(e) => handleUpdateTeacher(teacher.id, { actualLeaveCount: parseFloat(e.target.value) || 0 })}
                            className="w-14 text-center font-bold font-mono text-indigo-700 bg-white border border-slate-300 rounded px-1 py-0.5 text-xs"
                          />
                          <span className="text-slate-600">天</span>
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        value={teacher.leaveDaysText}
                        onChange={(e) => {
                          const val = e.target.value;
                          // 粗估天數
                          const items = val.split(/[、,，\n]+/).filter(Boolean);
                          handleUpdateTeacher(teacher.id, {
                            leaveDaysText: val,
                            actualLeaveCount: items.length || teacher.actualLeaveCount
                          });
                        }}
                        placeholder="例如: 9/5、9/12、9/19、9/26&#10;9/3(病假)"
                        className="w-full text-xs font-mono text-slate-800 bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* 節日備註 (如 9/26(中秋節)；9/28(教師節)) */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 mb-1">
                        🚩 節日/額外備註 (直接顯示於記事本):
                      </div>
                      <input
                        type="text"
                        value={teacher.holidayNotes || ''}
                        onChange={(e) => handleUpdateTeacher(teacher.id, { holidayNotes: e.target.value })}
                        placeholder="如: 9/26(中秋節)；9/28(教師節)"
                        className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* 補假加項清單 (▶️ ➕) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                        <span className="flex items-center gap-1">
                          <span>▶️ ➕ 補假加項</span>
                          <span className="text-[11px] text-slate-400 font-normal">(增加老師休假權益)</span>
                        </span>
                        <button
                          onClick={() => handleAddAddition(teacher.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 underline flex items-center gap-0.5"
                        >
                          <Plus size={13} />
                          <span>新增補假</span>
                        </button>
                      </div>

                      {teacher.additions && teacher.additions.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 bg-emerald-50/50 p-2 rounded-xl border border-emerald-200/60 text-xs">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => {
                              const title = e.target.value;
                              handleUpdateTeacher(teacher.id, {
                                additions: teacher.additions.map(i => i.id === item.id ? { ...i, title } : i)
                              });
                            }}
                            className="w-32 bg-white border border-slate-200 rounded px-2 py-1 font-semibold text-slate-700"
                            placeholder="如: 上課補假 (待補)"
                          />
                          <input
                            type="text"
                            value={item.datesText}
                            onChange={(e) => {
                              const datesText = e.target.value;
                              handleUpdateTeacher(teacher.id, {
                                additions: teacher.additions.map(i => i.id === item.id ? { ...i, datesText } : i)
                              });
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-slate-700"
                            placeholder="如: 8/5，8/12，8/19"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-700 font-bold">+</span>
                            <input
                              type="number"
                              step="0.25"
                              value={item.days}
                              onChange={(e) => {
                                const days = parseFloat(e.target.value) || 0;
                                handleUpdateTeacher(teacher.id, {
                                  additions: teacher.additions.map(i => i.id === item.id ? { ...i, days } : i)
                                });
                              }}
                              className="w-12 text-center bg-white border border-slate-200 rounded px-1 py-1 font-bold font-mono text-emerald-700"
                            />
                            <span className="text-slate-500">天</span>
                          </div>
                          <button
                            onClick={() => handleRemoveSpecialItem(teacher.id, item.id, 'addition')}
                            className="text-slate-400 hover:text-rose-500 px-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* 扣假減項清單 (▶️ ➖) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-700">
                        <span className="flex items-center gap-1">
                          <span>▶️ ➖ 特殊扣假/班別抵扣</span>
                          <span className="text-[11px] text-slate-400 font-normal">(如英檢班、超休抵扣)</span>
                        </span>
                        <button
                          onClick={() => handleAddDeduction(teacher.id)}
                          className="text-xs text-amber-600 hover:text-amber-700 underline flex items-center gap-0.5"
                        >
                          <Plus size={13} />
                          <span>新增扣假</span>
                        </button>
                      </div>

                      {teacher.deductions && teacher.deductions.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 bg-amber-50/50 p-2 rounded-xl border border-amber-200/60 text-xs">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => {
                              const title = e.target.value;
                              handleUpdateTeacher(teacher.id, {
                                deductions: teacher.deductions.map(i => i.id === item.id ? { ...i, title } : i)
                              });
                            }}
                            className="w-32 bg-white border border-slate-200 rounded px-2 py-1 font-semibold text-slate-700"
                            placeholder="如: 英檢班 (待紀錄)"
                          />
                          <input
                            type="text"
                            value={item.datesText}
                            onChange={(e) => {
                              const datesText = e.target.value;
                              handleUpdateTeacher(teacher.id, {
                                deductions: teacher.deductions.map(i => i.id === item.id ? { ...i, datesText } : i)
                              });
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-slate-700"
                            placeholder="如: 9/1、9/8、9/15..."
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-amber-700 font-bold">-</span>
                            <input
                              type="number"
                              step="0.25"
                              value={item.days}
                              onChange={(e) => {
                                const days = parseFloat(e.target.value) || 0;
                                handleUpdateTeacher(teacher.id, {
                                  deductions: teacher.deductions.map(i => i.id === item.id ? { ...i, days } : i)
                                });
                              }}
                              className="w-12 text-center bg-white border border-slate-200 rounded px-1 py-1 font-bold font-mono text-amber-700"
                            />
                            <span className="text-slate-500">天</span>
                          </div>
                          <button
                            onClick={() => handleRemoveSpecialItem(teacher.id, item.id, 'deduction')}
                            className="text-slate-400 hover:text-rose-500 px-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 卡片底槽：即時公式結算與累積結果 */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                  {/* 本月餘假精算列 */}
                  <div className="flex items-center justify-between bg-slate-900 text-white p-3.5 rounded-2xl">
                    <div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span>公式: 應休({baseQuota}) + 補假({totalAdditions}) - 實休({teacher.actualLeaveCount}) - 扣假({totalDeductions})</span>
                      </div>
                      <div className="text-xs font-bold text-slate-300 mt-0.5">
                        ⭕ 本月餘假結果:
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* 快捷微調按鈕組 */}
                      <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                        <button
                          onClick={() => adjustTeacherBalance(teacher.id, -1)}
                          className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-mono text-slate-200"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => adjustTeacherBalance(teacher.id, -0.25)}
                          className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-mono text-slate-200"
                        >
                          -0.25
                        </button>
                        <button
                          onClick={() => adjustTeacherBalance(teacher.id, +0.25)}
                          className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-mono text-cyan-300"
                        >
                          +0.25
                        </button>
                        <button
                          onClick={() => adjustTeacherBalance(teacher.id, +1)}
                          className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-mono text-cyan-300"
                        >
                          +1
                        </button>
                      </div>

                      {/* 最終本月餘假數字 */}
                      <span className={`text-xl font-black font-mono px-3 py-1 rounded-xl border ${
                        isPositive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                        {monthlyBalance > 0 ? `+${monthlyBalance}` : monthlyBalance}
                      </span>
                    </div>
                  </div>

                  {/* 累積假期看板 (特休 & 未休小計) */}
                  <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                    {/* 特休剩餘 */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                      <div className="text-amber-800 font-bold flex items-center gap-1 mb-1">
                        <span>🥳 勞基法特休剩餘</span>
                      </div>
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={teacher.annualRange || ''}
                          onChange={(e) => handleUpdateTeacher(teacher.id, { annualRange: e.target.value })}
                          placeholder="年度週期如 20260101~20261231"
                          className="w-full text-[10px] font-mono text-amber-900 bg-white border border-amber-200 rounded px-1.5 py-0.5"
                        />
                        <div className="flex items-center gap-1 justify-between pt-0.5">
                          <span className="text-amber-700">特休剩餘:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={teacher.annualRemaining}
                              onChange={(e) => handleUpdateTeacher(teacher.id, { annualRemaining: parseInt(e.target.value, 10) || 0 })}
                              className="w-12 text-center font-black font-mono text-amber-800 bg-white border border-amber-300 rounded px-1 py-0.5 text-xs"
                            />
                            <span className="text-amber-800 font-bold">天</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 每月排休未休累計 */}
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl">
                      <div className="text-indigo-900 font-bold flex items-center gap-1 mb-1">
                        <span>🌞 每月排休未休小計</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-indigo-700">
                          <span>上月累計:</span>
                          <input
                            type="number"
                            step="0.25"
                            value={teacher.previousBalance}
                            onChange={(e) => handleUpdateTeacher(teacher.id, { previousBalance: parseFloat(e.target.value) || 0 })}
                            className="w-14 text-center font-mono font-bold bg-white border border-indigo-200 rounded px-1 py-0.5 text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-indigo-200/60">
                          <span className="text-indigo-950 font-bold">本月總累計:</span>
                          <span className="font-mono font-black text-sm text-indigo-900">
                            共 {accumulatedBalance} 天
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LINE 群組記事本文字即時預覽 */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <span>📱 LINE 群組記事本發布預覽</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                  100% 格式吻合
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                點擊右側按鈕即可一鍵複製，格式包含所有 Emoji、分隔線與樹狀縮排，直接在 LINE 記事本貼上送出。
              </p>
            </div>
            <button
              onClick={handleCopyNote}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-4 py-2 rounded-2xl shadow-md text-xs active:scale-95"
            >
              {copySuccess ? <Check size={16} /> : <Copy size={16} />}
              <span>{copySuccess ? '複製成功！' : '一鍵複製全篇文字'}</span>
            </button>
          </div>

          <div className="relative bg-slate-900 text-slate-100 p-6 rounded-2xl font-mono text-sm leading-relaxed overflow-x-auto shadow-inner border border-slate-800">
            <pre className="whitespace-pre-wrap font-sans selection:bg-cyan-500 selection:text-black">
              {previewNoteText}
            </pre>
          </div>
        </div>
      )}

      {/* 智慧貼上辨識彈窗 (Import Modal) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-black text-slate-800">貼上 LINE 記事本智慧解析</h3>
                  <p className="text-xs text-slate-500">將 LINE 群組中的記事本文本整段貼於下方，系統自動辨識並填入卡片</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div>
              <textarea
                rows={10}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`2026 9月 🕤本月4️⃣個週一\n\n【王暉宇】入職日2016/01/01\n▶️ ➖ 排休\n9/5、9/12、9/19、9/26\n9/3(病假)\n\n9/26(中秋節)；9/28(教師節)\n\n▶️ ➕ 上課補假 (待補)\n\n----\n⭕本月餘假 -1\n----\n\n✅假期累積紀錄 (已含本月)\n丨\n┣🥳20260101~20261231 特休剩 15 天\n丨\n┗🌞每月排休未休小計 共 1.25 天`}
                className="w-full font-mono text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-2xl p-4 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                取消
              </button>
              <button
                onClick={handleParseAndImport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-lg active:scale-95"
              >
                🚀 立即智慧解析並帶入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
