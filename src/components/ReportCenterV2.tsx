import { useState, useRef } from 'react';
import { Calendar, User, AlertCircle, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useLeaveSystem } from '../context/LeaveContext';
import { calculateAvailable } from '../utils/leaveUtils';
// import type { Employee } from '../types';

interface ReportCenterV2Props {
    selectedBranch: string;
}

function ReportCenterV2({ selectedBranch }: ReportCenterV2Props) {
    const { employees, leaves: roster } = useLeaveSystem();
    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [reportType, setReportType] = useState<'monthly' | 'individual' | 'expiry' | 'balance'>('monthly');
    const [showPreview, setShowPreview] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Add Year State
    const availableYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i); // Add Available Years

    const filteredEmployees = selectedBranch === '全部分校'
        ? employees
        : employees.filter(emp => emp.branch === selectedBranch);

    const activeEmployees = filteredEmployees.filter(emp => emp.status === '在職');
    const reportRef = useRef<HTMLDivElement>(null);

    // Image Download Function
    const handleDownloadImage = async () => {
        if (reportType === 'individual' && !selectedEmployee) {
            alert('請先選擇一位員工以生成報表');
            return;
        }
        if (!reportRef.current) return;

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const link = document.createElement('a');
            link.download = `report_${new Date().getTime()}.png`;
            if (reportType === 'monthly') link.download = `${new Date().getFullYear()}-${new Date().getMonth() + 1}_月度排休表_${selectedBranch}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Image Generation Error:', error);
            alert('圖片生成失敗，請重試');
        }
    };

    // PDF Download Function
    const handleDownloadPDF = async () => {
        if (reportType === 'individual' && !selectedEmployee) {
            alert('請先選擇一位員工以生成報表');
            return;
        }

        if (!reportRef.current) return;

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2, // High resolution
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: reportType === 'monthly' ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

            let filename = 'report.pdf';
            if (reportType === 'monthly') filename = `${new Date().getFullYear()}-${new Date().getMonth() + 1}_月度排休表_${selectedBranch}.pdf`;
            if (reportType === 'individual') {
                const emp = employees.find(e => e.id === selectedEmployee);
                filename = `${emp?.name || 'Employee'}_個人報表.pdf`;
            }
            if (reportType === 'expiry') filename = `特休到期警示_${new Date().toISOString().split('T')[0]}.pdf`;
            if (reportType === 'balance') filename = `假別餘額結算_${new Date().toISOString().split('T')[0]}.pdf`;

            pdf.save(filename);

        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert('PDF 生成失敗，請重試');
        }
    };

    // Data for Monthly Report
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = new Date(year, month, 1).getDay();

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    const getLeavesForDay = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return roster.filter(r => r.startDate === dateStr && (selectedBranch === '全部分校' || r.branch === selectedBranch));
    };

    // --- RENDER HELPERS ---

    // 1. Monthly Calendar (HTML)
    const renderMonthlyReport = () => (
        <div className="print-container bg-white p-8 w-[297mm] mx-auto shadow-none text-slate-800" ref={reportRef}>
            <div className="text-center mb-6">
                <h1 className="text-3xl font-black text-black mb-2">{year}-{String(month + 1).padStart(2, '0')} 排休確認表</h1>
                <p className="text-lg font-bold text-slate-600">{selectedBranch}</p>
            </div>

            <div className="border-2 border-slate-300 mb-8">
                <div className="grid grid-cols-7 bg-slate-100 border-b-2 border-slate-300">
                    {['週日', '週一', '週二', '週三', '週四', '週五', '週六'].map(d => (
                        <div key={d} className="p-2 text-center font-black border-r border-slate-300 last:border-r-0 text-slate-700">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {calendarDays.map((day, idx) => {
                        if (day === null) return <div key={`empty-${idx}`} className="border-r border-b border-slate-200 min-h-[100px] bg-slate-50/50" />;
                        const leaves = getLeavesForDay(day);
                        return (
                            <div key={day} className={`p-1 border-r border-b border-slate-300 min-h-[100px] flex flex-col relative`}>
                                <div className="font-bold text-lg leading-none p-1 text-slate-400">{day}</div>
                                <div className="flex-1 flex flex-col gap-0.5 pt-1">
                                    {leaves.map((l, i) => (
                                        <div key={i} className="text-[10px] font-bold leading-tight truncate px-1 rounded flex justify-between items-center"
                                            style={{
                                                color: l.leaveType === 'annual' ? '#c2410c' : '#1d4ed8', // Orange-700 / Blue-700
                                                backgroundColor: l.leaveType === 'annual' ? '#fff7ed' : '#eff6ff' // Orange-50 / Blue-50
                                            }}>
                                            <span>{l.employeeName}</span>
                                            {!l.isFullDay && (
                                                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] text-white ml-1
                                                    ${l.timeSlot === 'morning' ? 'bg-pink-500' :
                                                        l.timeSlot === 'afternoon' ? 'bg-amber-500' :
                                                            'bg-purple-600'}`}>
                                                    {l.timeSlot === 'morning' ? '早' : l.timeSlot === 'afternoon' ? '午' : '晚'}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-8">
                <h2 className="text-xl font-black mb-4 border-l-4 border-slate-800 pl-3">假別餘額總表中</h2>
                <table className="w-full text-sm border-collapse border border-slate-300">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="border border-slate-300 p-2 text-left">姓名</th>
                            <th className="border border-slate-300 p-2 text-left">分校</th>
                            <th className="border border-slate-300 p-2 text-left">特休剩餘</th>
                            <th className="border border-slate-300 p-2 text-left">排休剩餘</th>
                            <th className="border border-slate-300 p-2 text-left">月固定額度</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeEmployees.map(emp => (
                            <tr key={emp.id}>
                                <td className="border border-slate-300 p-2 font-bold">{emp.name}</td>
                                <td className="border border-slate-300 p-2">{emp.branch}</td>
                                <td className="border border-slate-300 p-2 text-orange-600 font-bold">{calculateAvailable(emp.annualLeave)} / {(emp.annualLeave.initial + emp.annualLeave.earned)}</td>
                                <td className="border border-slate-300 p-2 text-blue-600 font-bold">{calculateAvailable(emp.personalLeave)} / {(emp.personalLeave.initial + emp.personalLeave.earned)}</td>
                                <td className="border border-slate-300 p-2">{emp.monthlyPersonalQuota}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-8 text-right text-xs text-slate-400 font-mono">
                Generated by Leave Management System on {new Date().toLocaleString('zh-TW')}
            </div>
        </div>
    );

    // 2. Individual Report (HTML)
    const renderIndividualReport = () => {
        const emp = employees.find(e => e.id === selectedEmployee);
        if (!emp) return <div className="text-center p-10 font-bold text-slate-400">請先選擇員工</div>;

        const empLeaves = roster.filter(r =>
            r.employeeId === emp.id &&
            r.startDate.startsWith(String(selectedYear))
        ).sort((a, b) => a.startDate.localeCompare(b.startDate));

        const annualTotal = emp.annualLeave.initial + emp.annualLeave.earned;
        const personalTotal = emp.personalLeave.initial + emp.personalLeave.earned;

        return (
            <div className="print-container bg-white p-12 w-[210mm] min-h-[297mm] mx-auto shadow-none" ref={reportRef}>
                <div className="border-b-4 border-slate-800 pb-4 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 mb-2">{emp.name} 個人請假明細</h1>
                        <p className="text-lg font-bold text-slate-500">{emp.branch} | {selectedYear}年度</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-400">員工編號: {emp.id}</p>
                        <p className="text-sm font-bold text-slate-400">入職日期: {emp.hireDate}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-100">
                        <h3 className="text-orange-800 font-bold mb-2">特休假 (Annual Leave)</h3>
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm text-orange-600 font-bold">初始+累計</span>
                            <span className="text-xl font-black text-orange-900">{annualTotal}</span>
                        </div>
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm text-orange-600 font-bold">已使用</span>
                            <span className="text-xl font-black text-orange-900">{emp.annualLeave.used}</span>
                        </div>
                        <div className="border-t border-orange-200 mt-2 pt-2 flex justify-between items-baseline">
                            <span className="text-base text-orange-800 font-black">剩餘</span>
                            <span className={`text-2xl font-black ${calculateAvailable(emp.annualLeave) < 0 ? 'text-red-500' : 'text-orange-600'}`}>
                                {calculateAvailable(emp.annualLeave)}
                            </span>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100">
                        <h3 className="text-blue-800 font-bold mb-2">排休假 (Personal Leave)</h3>
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm text-blue-600 font-bold">初始+累計</span>
                            <span className="text-xl font-black text-blue-900">{personalTotal}</span>
                        </div>
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm text-blue-600 font-bold">已使用</span>
                            <span className="text-xl font-black text-blue-900">{emp.personalLeave.used}</span>
                        </div>
                        <div className="border-t border-blue-200 mt-2 pt-2 flex justify-between items-baseline">
                            <span className="text-base text-blue-800 font-black">剩餘</span>
                            <span className={`text-2xl font-black ${calculateAvailable(emp.personalLeave) < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                                {calculateAvailable(emp.personalLeave)}
                            </span>
                        </div>
                    </div>
                </div>

                <h3 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-slate-800 pl-3">詳細紀錄</h3>
                <table className="w-full text-sm text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 border-b-2 border-slate-200">
                            <th className="p-3 font-black text-slate-700">日期</th>
                            <th className="p-3 font-black text-slate-700">假別</th>
                            <th className="p-3 font-black text-slate-700">天數/時段</th>
                            <th className="p-3 font-black text-slate-700">備註</th>
                        </tr>
                    </thead>
                    <tbody>
                        {empLeaves.length > 0 ? empLeaves.map(leave => (
                            <tr key={leave.id} className="border-b border-slate-100 even:bg-slate-50">
                                <td className="p-3 font-bold text-slate-600">{leave.startDate}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-black ${leave.leaveType === 'annual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {leave.leaveType === 'annual' ? '特休' : '排休'}
                                    </span>
                                </td>
                                <td className="p-3 font-bold text-slate-800">
                                    {leave.isFullDay ? '1.0 天' : `${leave.days} 天 (${leave.timeSlot === 'morning' ? '早' : leave.timeSlot === 'afternoon' ? '午' : '晚'})`}
                                </td>
                                <td className="p-3 text-slate-500 font-medium">{leave.note || '-'}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">尚無請假紀錄</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <div className="mt-auto pt-12 text-right text-xs text-slate-400 font-mono">
                    Generated by Leave Management System on {new Date().toLocaleString('zh-TW')}
                </div>
            </div>
        );
    };

    // 3. Expiry Report (HTML)
    const renderExpiryReport = () => {
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(currentDate.getMonth() + 3);

        const expiringList = activeEmployees.filter(emp => {
            const expiryDate = new Date(emp.annualLeave.expiry || '2099-12-31');
            return expiryDate <= threeMonthsLater && calculateAvailable(emp.annualLeave) > 0;
        });

        const today = new Date();

        return (
            <div className="print-container bg-white p-12 w-[210mm] min-h-[297mm] mx-auto shadow-none" ref={reportRef}>
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-red-600 mb-2">特休到期警示報表</h1>
                    <p className="text-lg font-bold text-slate-600">統計基準日: {today.toLocaleDateString('zh-TW')}</p>
                </div>

                {expiringList.length > 0 ? (
                    <div className="space-y-4">
                        {expiringList.map(emp => {
                            const expiry = new Date(emp.annualLeave.expiry || '2099-12-31');
                            const diffTime = expiry.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            return (
                                <div key={emp.id} className="border-2 border-red-100 bg-red-50 p-6 rounded-2xl flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-black text-red-900">{emp.name}</h3>
                                        <p className="text-red-700 font-bold">{emp.branch}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-red-600 mb-1">離到期還有</p>
                                        <p className="text-3xl font-black text-red-600">{diffDays} <span className="text-lg">天</span></p>
                                        <p className="text-xs font-bold text-red-400 mt-1">
                                            剩餘特休: {calculateAvailable(emp.annualLeave)} 天 (到期日: {emp.annualLeave.expiry})
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100">
                        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="text-green-600" size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-700">目前無即將到期名單</h3>
                        <p className="text-slate-500 font-bold mt-2">所有員工特休效期皆在三個月後</p>
                    </div>
                )}
                <div className="mt-auto pt-12 text-right text-xs text-slate-400 font-mono">
                    Generated by Leave Management System on {new Date().toLocaleString('zh-TW')}
                </div>
            </div>
        );
    };

    // 4. Balance Sheet Report (HTML)
    const renderBalanceSheet = () => (
        <div className="print-container bg-white p-8 w-[297mm] mx-auto shadow-none text-slate-800" ref={reportRef}>
            <div className="text-center mb-8">
                <h1 className="text-3xl font-black text-slate-900 mb-2">假別餘額結算表</h1>
                <p className="text-lg font-bold text-slate-600">統計日期: {new Date().toLocaleDateString('zh-TW')}</p>
            </div>

            <table className="w-full text-sm border-collapse border border-slate-300">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="border border-slate-300 p-2 text-left">姓名</th>
                        <th className="border border-slate-300 p-2 text-left">分校</th>
                        <th className="border border-slate-300 p-2 text-left bg-orange-50">特休初始</th>
                        <th className="border border-slate-300 p-2 text-left bg-orange-50">特休已用</th>
                        <th className="border border-slate-300 p-2 text-left bg-orange-50">特休調整</th>
                        <th className="border border-slate-300 p-2 text-left bg-orange-50 font-black">特休餘額</th>
                        <th className="border border-slate-300 p-2 text-left bg-blue-50">排休初始/累計</th>
                        <th className="border border-slate-300 p-2 text-left bg-blue-50">排休已用</th>
                        <th className="border border-slate-300 p-2 text-left bg-blue-50">排休調整</th>
                        <th className="border border-slate-300 p-2 text-left bg-blue-50 font-black">排休餘額</th>
                    </tr>
                </thead>
                <tbody>
                    {activeEmployees.map(emp => {
                        const annualAvail = calculateAvailable(emp.annualLeave);
                        const personalAvail = calculateAvailable(emp.personalLeave);
                        return (
                            <tr key={emp.id}>
                                <td className="border border-slate-300 p-2 font-bold">{emp.name}</td>
                                <td className="border border-slate-300 p-2">{emp.branch}</td>
                                <td className="border border-slate-300 p-2 bg-orange-50/30">{emp.annualLeave.initial}</td>
                                <td className="border border-slate-300 p-2 bg-orange-50/30">{emp.annualLeave.used}</td>
                                <td className="border border-slate-300 p-2 bg-orange-50/30">{emp.annualLeave.adjustment || 0}</td>
                                <td className={`border border-slate-300 p-2 bg-orange-50/30 font-black ${annualAvail < 0 ? 'text-red-500' : 'text-slate-900'}`}>{annualAvail}</td>
                                <td className="border border-slate-300 p-2 bg-blue-50/30">{(emp.personalLeave.initial || 0) + emp.personalLeave.earned}</td>
                                <td className="border border-slate-300 p-2 bg-blue-50/30">{emp.personalLeave.used}</td>
                                <td className="border border-slate-300 p-2 bg-blue-50/30">{emp.personalLeave.adjustment || 0}</td>
                                <td className={`border border-slate-300 p-2 bg-blue-50/30 font-black ${personalAvail < 0 ? 'text-red-500' : 'text-slate-900'}`}>{personalAvail}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="mt-8 text-right text-xs text-slate-400 font-mono">
            </div>
        </div>
    );


    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-black text-midnight-blue no-print">報表中心</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                <button
                    onClick={() => { setReportType('monthly'); setShowPreview(true); setSelectedEmployee(''); }}
                    className={`p-6 rounded-[2.5rem] border-2 transition-all ${reportType === 'monthly'
                        ? 'bg-midnight-blue text-white border-midnight-blue shadow-xl'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                >
                    <Calendar className="mx-auto mb-3" size={32} />
                    <h3 className="font-black text-lg">月度公告</h3>
                    <p className="text-sm mt-2 opacity-80">生成分校月度排休表</p>
                </button>
                <button
                    onClick={() => { setReportType('individual'); setShowPreview(true); }}
                    className={`p-6 rounded-[2.5rem] border-2 transition-all ${reportType === 'individual'
                        ? 'bg-midnight-blue text-white border-midnight-blue shadow-xl'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                >
                    <User className="mx-auto mb-3" size={32} />
                    <h3 className="font-black text-lg">個人明細</h3>
                    <p className="text-sm mt-2 opacity-80">匯出員工年度假別歷史</p>
                </button>
                <button
                    onClick={() => { setReportType('expiry'); setShowPreview(true); setSelectedEmployee(''); }}
                    className={`p-6 rounded-[2.5rem] border-2 transition-all ${reportType === 'expiry'
                        ? 'bg-midnight-blue text-white border-midnight-blue shadow-xl'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                >
                    <AlertCircle className="mx-auto mb-3" size={32} />
                    <h3 className="font-black text-lg">到期警示</h3>
                    <p className="text-sm mt-2 opacity-80">60天內特休到期名單</p>
                </button>
                <button
                    onClick={() => { setReportType('balance'); setShowPreview(true); setSelectedEmployee(''); }}
                    className={`p-6 rounded-[2.5rem] border-2 transition-all ${reportType === 'balance'
                        ? 'bg-midnight-blue text-white border-midnight-blue shadow-xl'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                >
                    <AlertCircle className="mx-auto mb-3" size={32} />
                    <h3 className="font-black text-lg">餘額結算</h3>
                    <p className="text-sm mt-2 opacity-80">全校假別餘額總表</p>
                </button>
            </div>

            <div className={`bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-slate-100`}>

                {reportType === 'individual' && (
                    <div className="max-w-md mx-auto mb-8 text-left no-print bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">請選擇員工以預覽報表</label>
                        <div className="flex gap-4">
                            <select
                                value={selectedEmployee}
                                onChange={e => setSelectedEmployee(e.target.value)}
                                className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:border-midnight-blue"
                            >
                                <option value="">請選擇員工...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="w-32 px-4 py-3 border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:border-midnight-blue"
                            >
                                {availableYears.map(y => (
                                    <option key={y} value={y}>{y}年</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {(showPreview) && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6 no-print bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <span className="text-slate-500 font-bold ml-2">
                                {reportType === 'monthly' ? '月度報表' :
                                    reportType === 'individual' ? '個人明細' :
                                        reportType === 'expiry' ? '到期警示' : '餘額結算'} 預覽
                            </span>
                            <div className="flex gap-4">
                                <button onClick={handleDownloadImage} className="bg-white text-midnight-blue border-2 border-midnight-blue px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
                                    <Download size={20} /> 下載圖片
                                </button>
                                <button onClick={handleDownloadPDF} className="bg-midnight-blue text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all">
                                    <Download size={20} /> 下載 PDF
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto shadow-sm border border-slate-200 rounded-lg bg-slate-100 p-8 flex justify-center">
                            {reportType === 'monthly' && renderMonthlyReport()}
                            {reportType === 'individual' && renderIndividualReport()}
                            {reportType === 'expiry' && renderExpiryReport()}
                            {reportType === 'balance' && renderBalanceSheet()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ReportCenterV2;
