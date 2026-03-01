import React, { useState, useMemo, useCallback, memo } from 'react';
import { useApp } from '../store.tsx';
import {
  FileSpreadsheet, Printer, Clock, Activity, Zap,
  CheckCircle2, AlertTriangle, Copy, Check, Loader2, Calendar,
  ChevronLeft, ChevronRight, Gift
} from 'lucide-react';
import { format, eachDayOfInterval, isSameDay, startOfDay, endOfDay, differenceInMinutes, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

// Pagination settings
const ITEMS_PER_PAGE = 50;

// Memoized Table Row Component
const ReportRow = memo(({
  record,
  employee,
  center,
  project,
  holidays
}: {
  record: any;
  employee: any;
  center: any;
  project: any;
  holidays: any[];
}) => {
  const isShiftWorker = employee?.workType === 'shifts';
  const holiday = !isShiftWorker ? holidays.find(h => h.date === record.date) : null;
  const isWeekend = !isShiftWorker && center?.workingDays && !center.workingDays.includes(parseISO(record.date).getDay());

  return (
    <tr className="hover:bg-slate-50/30 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-600 text-[10px]">
            {employee?.name.charAt(0)}
          </div>
          <div>
            <p className="font-black text-slate-800 text-xs leading-none mb-1">{employee?.name}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-[9px] text-indigo-600 font-black uppercase tracking-tighter">{center?.name}</p>
              {project && (
                <>
                  <span className="text-[8px] text-slate-300">•</span>
                  <p className="text-[9px] text-amber-600 font-black uppercase tracking-tighter truncate max-w-[120px]">{project.name}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center text-xs font-bold text-slate-700">{record.date}</td>
      <td className="px-4 py-4 text-center">
        <div className="flex flex-col">
          <span className="text-[8px] text-slate-400 font-bold">مطلوب: {center?.defaultStartTime}</span>
          <span className={`text-xs font-black ${record.delayMinutes > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '--:--'}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className="flex flex-col">
          <span className="text-[8px] text-slate-400 font-bold">مطلوب: {center?.defaultEndTime}</span>
          <span className={`text-xs font-black ${record.earlyDepartureMinutes > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '--:--'}
            {record.isSplit && <span className="text-[10px] text-indigo-400 font-black mr-1">*</span>}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="text-center">
            <p className={`text-xs font-black ${record.delayMinutes > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{record.delayMinutes || 0}د</p>
            <p className="text-[8px] text-slate-400 font-black uppercase">تأخير</p>
          </div>
          <div className="w-px h-6 bg-slate-100"></div>
          <div className="text-center">
            <p className={`text-xs font-black ${record.earlyDepartureMinutes > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{record.earlyDepartureMinutes || 0}د</p>
            <p className="text-[8px] text-slate-400 font-black uppercase">مبكر</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
          <Clock className="w-3 h-3 text-indigo-500" />
          <span className="text-xs font-black text-slate-700">{record.workingHours}h</span>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black border uppercase ${record.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
            record.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-100' :
              'bg-slate-50 text-slate-500 border-slate-100'
            }`}>
            {record.status === 'present' ? 'منضبط' : record.status === 'late' ? 'تأخير حضور' : 'سجل معلق'}
          </span>
          {holiday && (
            <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
              عطلة: {holiday.name}
            </span>
          )}
          {isWeekend && !holiday && (
            <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase">
              عطلة أسبوعية
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="text-[10px] font-bold text-rose-600">{record.notes || '-'}</span>
      </td>
    </tr>
  );
});

ReportRow.displayName = 'ReportRow';

// Memoized Mobile Card
const ReportCard = memo(({
  record,
  employee,
  center,
  project,
  holidays
}: {
  record: any;
  employee: any;
  center: any;
  project: any;
  holidays: any[];
}) => {
  const isShiftWorker = employee?.workType === 'shifts';
  const holiday = !isShiftWorker ? holidays.find(h => h.date === record.date) : null;
  const isWeekend = !isShiftWorker && center?.workingDays && !center.workingDays.includes(parseISO(record.date).getDay());

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px]">
            {employee?.name.charAt(0)}
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm leading-tight mb-0.5">{employee?.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">{center?.name}</span>
              {project && (
                <>
                  <span className="text-[8px] text-slate-300">•</span>
                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">{project.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[8px] font-black border uppercase ${record.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
          record.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-400'
          }`}>
          {record.status === 'present' ? 'منضبط' : record.status === 'late' ? 'تأخير' : 'معلق'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest text-right">الحضور</p>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400">مطلوب: {center?.defaultStartTime}</span>
            <span className={`text-xs font-black ${record.delayMinutes > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '--:--'}
            </span>
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest text-right">الانصراف</p>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400">مطلوب: {center?.defaultEndTime}</span>
            <span className={`text-xs font-black ${record.earlyDepartureMinutes > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '--:--'}
            </span>
          </div>
        </div>
      </div>

      {(holiday || isWeekend) && (
        <div className="flex flex-wrap gap-2 px-1">
          {holiday && (
            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 uppercase flex items-center gap-1">
              <Gift className="w-3 h-3" /> عطلة: {holiday.name}
            </span>
          )}
          {isWeekend && !holiday && (
            <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3" /> عطلة أسبوعية
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-400 font-black uppercase">التأخير</span>
            <span className={`text-xs font-black ${record.delayMinutes > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{record.delayMinutes || 0}د</span>
          </div>
          <div className="w-px h-6 bg-slate-100"></div>
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-400 font-black uppercase">خروج مبكر</span>
            <span className={`text-xs font-black ${record.earlyDepartureMinutes > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{record.earlyDepartureMinutes || 0}د</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-xl text-indigo-600 font-black text-[10px]">
          <Clock className="w-3.5 h-3.5" /> {record.workingHours}h
        </div>
      </div>
    </div>
  );
});

ReportCard.displayName = 'ReportCard';

// Pagination Component
const Pagination = memo(({
  currentPage,
  totalPages,
  totalItems,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t border-slate-100">
      <div className="text-[10px] font-black text-slate-400 uppercase">
        عرض {startItem}-{endItem} من {totalItems} سجل
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${currentPage === pageNum
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

const Reports: React.FC = () => {
  const { attendance, employees, centers, projects, pendingOperations, settings, holidays } = useApp();

  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterCenter, setFilterCenter] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [copying, setCopying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [reportType, setReportType] = useState<'log' | 'monthly'>('log');

  const activeCenterIds = useMemo(() => centers.filter(c => c.isActive).map(c => c.id), [centers]);

  // Create lookup maps for better performance with large datasets
  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const centerMap = useMemo(() => new Map(centers.map(c => [c.id, c])), [centers]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const { filteredData, totalFiltered, totalPages, paginatedData, groupedByEmployee } = useMemo(() => {
    // 1. تفتيت المناوبات الطويلة إلى سجلات يومية
    const processedAttendance: any[] = [];

    attendance.forEach(record => {
      const emp = employeeMap.get(record.employeeId);
      const isShiftWorker = emp?.workType === 'shifts';

      if (isShiftWorker && record.checkIn) {
        const start = parseISO(record.checkIn);
        const end = record.checkOut ? parseISO(record.checkOut) : new Date();

        if (format(start, 'yyyy-MM-dd') !== format(end, 'yyyy-MM-dd')) {
          const days = eachDayOfInterval({ start, end });
          days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            let workingHours = 0;
            let dayCheckIn = record.checkIn;
            let dayCheckOut = record.checkOut;

            if (isSameDay(day, start)) {
              // First day: from checkIn to midnight
              const startOfNextDay = startOfDay(new Date(day.getTime() + 24 * 60 * 60 * 1000));
              workingHours = differenceInMinutes(startOfNextDay, start) / 60;
              dayCheckOut = startOfNextDay.toISOString();
            } else if (isSameDay(day, end)) {
              // Last day: from midnight to checkOut
              const sod = startOfDay(day);
              workingHours = differenceInMinutes(end, sod) / 60;
              dayCheckIn = sod.toISOString();
            } else {
              // Middle days: full 24 hours
              workingHours = 24;
              dayCheckIn = startOfDay(day).toISOString();
              dayCheckOut = startOfDay(new Date(day.getTime() + 24 * 60 * 60 * 1000)).toISOString();
            }

            processedAttendance.push({
              ...record,
              id: `${record.id}-${dateStr}`,
              date: dateStr,
              checkIn: dayCheckIn,
              checkOut: dayCheckOut,
              workingHours: Number(workingHours.toFixed(2)),
              isSplit: true,
              status: record.checkOut ? 'present' : 'not_logged_out'
            });
          });
          return;
        }
      }
      processedAttendance.push(record);
    });

    const filtered = processedAttendance.filter(record => {
      const matchesDate = record.date >= dateFrom && record.date <= dateTo;
      const matchesCenter = filterCenter === ''
        ? activeCenterIds.includes(record.centerId)
        : record.centerId === filterCenter;
      const matchesEmployee = filterEmployee === '' || record.employeeId === filterEmployee;
      return matchesDate && matchesCenter && matchesEmployee;
    }).sort((a, b) => b.date.localeCompare(a.date));

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);

    // Group for monthly statements
    const grouped = new Map();
    filtered.forEach(record => {
      if (!grouped.has(record.employeeId)) {
        grouped.set(record.employeeId, []);
      }
      grouped.get(record.employeeId).push(record);
    });

    // Apply pagination
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { filteredData: filtered, totalFiltered, totalPages, paginatedData, groupedByEmployee: grouped };
  }, [attendance, dateFrom, dateTo, filterCenter, filterEmployee, activeCenterIds, currentPage, employeeMap]);

  const stats = useMemo(() => {
    const totalRecords = filteredData.length;
    if (totalRecords === 0) return { disciplineRate: 0, totalHours: 0, criticalDelays: 0, activeRecords: 0 };

    const onTimeCount = filteredData.filter(r => r.status === 'present').length;
    const totalHours = filteredData.reduce((acc, curr) => acc + (curr.workingHours || 0), 0);
    const criticalDelays = filteredData.filter(r => r.delayMinutes > 30).length;

    // حساب أيام العمل الفعلية (أيام الدوام التي ليست عطلاً أو عطل أسبوعية)
    const actualWorkDays = filteredData.filter(r => {
      const emp = employeeMap.get(r.employeeId);
      if (emp?.workType === 'shifts') return r.workingHours > 0;

      const c = centerMap.get(r.centerId);
      const isH = holidays.some(h => h.date === r.date);
      const isW = c?.workingDays && !c.workingDays.includes(parseISO(r.date).getDay());
      return r.workingHours > 0 && !isH && !isW;
    }).length;

    return {
      disciplineRate: ((onTimeCount / totalRecords) * 100).toFixed(1),
      totalHours: totalHours.toFixed(1),
      criticalDelays,
      activeRecords: totalRecords,
      actualWorkDays
    };
  }, [filteredData]);

  const handleExportExcel = useCallback(() => {
    if (filteredData.length === 0) {
      alert('لا توجد بيانات لتصديرها في الفترة المحددة.');
      return;
    }

    setIsExporting(true);

    // Use setTimeout to allow UI to update before heavy processing
    setTimeout(() => {
      try {
        const headers = [
          'اسم الموظف',
          'رمز الموظف',
          'اسم المركز',
          'التاريخ',
          'الدخول المطلوب',
          'الدخول الفعلي',
          'الخروج المطلوب',
          'الخروج الفعلي',
          'دقائق التأخير',
          'دقائق الخروج المبكر',
          'مجموع ساعات الدوام',
          'ملاحظات الحالة'
        ];

        const rows = filteredData.map(record => {
          const emp = employeeMap.get(record.employeeId);
          const center = centerMap.get(record.centerId);
          const formatTime = (iso?: string) => iso ? format(new Date(iso), 'HH:mm') : '-';

          let note = '';
          if (record.delayMinutes > 0) note += `تأخير ${record.delayMinutes}د. `;
          if (record.earlyDepartureMinutes > 0) note += `خروج مبكر ${record.earlyDepartureMinutes}د. `;
          if (record.status === 'present' && record.delayMinutes === 0) note = 'منضبط';

          return [
            emp?.name || 'غير معروف',
            emp?.code || 'N/A',
            center?.name || 'غير معروف',
            record.date,
            center?.defaultStartTime || '-',
            formatTime(record.checkIn),
            center?.defaultEndTime || '-',
            formatTime(record.checkOut),
            record.delayMinutes || 0,
            record.earlyDepartureMinutes || 0,
            record.workingHours || 0,
            record.notes || note
          ];
        });

        const brandingRows = [
          [settings.systemName || 'خبراء الإغاثة'],
          [reportType === 'log' ? 'سجل الحضور والانصراف الميداني' : 'كشف الدوام الشهري للموظف'],
          [`النطاق الزمني: ${dateFrom} إلى ${dateTo}`],
          [`تاريخ الاستخراج: ${format(new Date(), 'yyyy/MM/dd HH:mm')}`],
          ['المركز:', filterCenter === '' ? 'جميع المراكز' : centers.find(c => c.id === filterCenter)?.name],
          [''] // Spacer
        ];

        const ws = XLSX.utils.aoa_to_sheet([...brandingRows, headers, ...rows]);
        if (!ws['!props']) ws['!props'] = {};
        ws['!margin'] = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "تقرير الحضور");
        XLSX.writeFile(wb, `${reportType === 'monthly' ? 'Monthly' : 'Attendance'}_Report_${dateFrom}_to_${dateTo}.xlsx`);

      } catch (error) {
        console.error('Export failed:', error);
        alert('فشل تصدير الملف، يرجى المحاولة مرة أخرى.');
      } finally {
        setTimeout(() => setIsExporting(false), 500);
      }
    }, 100);
  }, [filteredData, employeeMap, centerMap, dateFrom, dateTo]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleCopyTable = useCallback(() => {
    const text = filteredData.map(record => {
      const emp = employeeMap.get(record.employeeId);
      return `${emp?.name}\t${record.date}\t${record.workingHours}h`;
    }).join('\n');

    navigator.clipboard.writeText(text);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }, [filteredData, employeeMap]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleFilterChange = useCallback((setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value);
    setCurrentPage(1);
  }, []);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700">
      {/* Print Header (Visible only during printing) - Single Log Version */}
      {reportType === 'log' && (
        <div className="hidden print:flex flex-col items-center justify-center space-y-4 mb-8 text-center" dir="rtl">
          <div className="flex items-center justify-between w-full border-b-2 border-slate-900 pb-4">
            <div className="text-right">
              <h2 className="text-xl font-black">{settings.systemName || 'خبراء الإغاثة'}</h2>
              <p className="text-sm font-bold text-slate-500">إدارة شؤون الموظفين - سجل الحضور</p>
            </div>
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
            )}
            <div className="text-left text-[10px] font-black space-y-1">
              <p>تاريخ استخراج التقرير: {format(new Date(), 'yyyy/MM/dd HH:mm')}</p>
              <p>مجال التقرير: {dateFrom} إلى {dateTo}</p>
            </div>
          </div>
          <h1 className="text-2xl font-black mt-4 underline decoration-indigo-500 underline-offset-8">سجل الحضور والانصراف الميداني</h1>
          <div className="grid grid-cols-3 gap-8 w-full bg-white p-4 rounded-xl border-2 border-slate-900 text-sm font-black text-slate-900">
            <div>المركز: {filterCenter === '' ? 'جميع المراكز' : centers.find(c => c.id === filterCenter)?.name}</div>
            <div>الموظف: {filterEmployee === '' ? 'جميع الموظفين' : employees.find(e => e.id === filterEmployee)?.name}</div>
            <div>إجمالي السجلات: {totalFiltered} سجل</div>
          </div>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight text-right">التقارير التحليلية</h1>
            {pendingOperations > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full">
                <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                <span className="text-[9px] font-black text-amber-600 uppercase">{pendingOperations} معلق</span>
              </div>
            )}
          </div>
          <p className="text-slate-500 font-bold text-sm">استخراج البيانات الميدانية وتحليل مستويات الانضباط • {totalFiltered} سجل</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Report Type Switcher */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 mr-4">
            <button
              onClick={() => setReportType('log')}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${reportType === 'log' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              السجل العام
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${reportType === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              كشف دوام شهري
            </button>
          </div>

          <button
            onClick={handleCopyTable}
            className="flex-1 sm:flex-none bg-white text-slate-600 px-4 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            {copying ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copying ? 'تم النسخ' : 'نسخ سريع'}</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex-1 sm:flex-none bg-emerald-600 text-white px-5 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 active:scale-95 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            تصدير Excel
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none bg-slate-900 text-white px-5 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl active:scale-95"
          >
            <Printer className="w-4 h-4" /> طباعة
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">من تاريخ</label>
            <input
              type="date" value={dateFrom} onChange={handleFilterChange(setDateFrom)}
              className="w-full px-4 md:px-6 py-3 md:py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 font-bold text-slate-700 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">إلى تاريخ</label>
            <input
              type="date" value={dateTo} onChange={handleFilterChange(setDateTo)}
              className="w-full px-4 md:px-6 py-3 md:py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 font-bold text-slate-700 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">اختيار المركز</label>
            <select
              value={filterCenter} onChange={handleFilterChange(setFilterCenter)}
              className="w-full px-4 md:px-6 py-3 md:py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 font-black text-slate-600 appearance-none cursor-pointer text-sm"
            >
              <option value="">جميع المراكز النشطة</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">موظف محدد</label>
            <select
              value={filterEmployee} onChange={handleFilterChange(setFilterEmployee)}
              className="w-full px-4 md:px-6 py-3 md:py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 font-black text-slate-600 appearance-none cursor-pointer text-sm"
            >
              <option value="">كل الموظفين</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Decision Support Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 print:hidden">
        {[
          { label: 'معدل الانضباط', value: `${stats.disciplineRate}%`, icon: CheckCircle2, color: 'indigo', detail: 'الحضور في الموعد' },
          { label: 'ساعات العمل', value: `${stats.totalHours}h`, icon: Zap, color: 'amber', detail: 'ساعة محققة' },
          { label: 'أيام العمل الفعلية', value: stats.actualWorkDays, icon: Calendar, color: 'emerald', detail: 'يوم دوام فعلي' },
          { label: 'تأخيرات حرجة', value: stats.criticalDelays, icon: AlertTriangle, color: 'rose', detail: 'تتطلب مراجعة', critical: stats.criticalDelays > 0 }
        ].map((item, i) => (
          <div key={i} className={`bg-white text-slate-900 p-6 rounded-[2rem] border-2 border-slate-900 shadow-sm relative overflow-hidden group print:p-3 print:rounded-xl`}>
            <div className="relative z-10">
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 text-slate-400`}>{item.label}</p>
              <h3 className="text-3xl font-black print:text-xl">{item.value}</h3>
              <div className={`mt-3 flex items-center gap-2 text-[9px] font-black uppercase text-slate-500`}>
                <item.icon className="w-3.5 h-3.5" /> {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Data Table View for Desktop / Card View for Mobile */}
      <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden print:hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
              {reportType === 'log' ? 'سجل البيانات التفصيلي' : 'معاينة كشوف الدوام الشهرية'}
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-1">عرض {paginatedData.length} من {totalFiltered} سجل للفترة المحددة</p>
          </div>
          <div className="hidden sm:block text-left text-[10px] font-black text-slate-400 uppercase italic">
            Relief Experts Personnel Management
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-right min-w-[1250px] border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">الموظف / المركز</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">التاريخ</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الحضور (مطلوب/فعلي)</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الانصراف (مطلوب/فعلي)</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">تأخير / مبكر</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الساعات</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الحالة</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ملاحظات النظام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((record) => (
                <ReportRow
                  key={record.id}
                  record={record}
                  employee={employeeMap.get(record.employeeId)}
                  center={centerMap.get(record.centerId)}
                  project={projectMap.get(employeeMap.get(record.employeeId)?.projectId || '')}
                  holidays={holidays}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Cards */}
        <div className="lg:hidden divide-y divide-slate-100">
          {paginatedData.map((record) => (
            <ReportCard
              key={record.id}
              record={record}
              employee={employeeMap.get(record.employeeId)}
              center={centerMap.get(record.centerId)}
              holidays={holidays}
            />
          ))}
        </div>

        {filteredData.length === 0 && (
          <div className="py-24 text-center text-slate-300 font-bold italic">لا توجد سجلات مطابقة في الفترة المختارة</div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalFiltered}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Full Printing - LOG Mode */}
      {reportType === 'log' && (
        <div className="hidden print:block w-full" dir="rtl">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-2 border-slate-900">
                <th className="px-3 py-2 border-2 border-slate-900 font-black">الموظف</th>
                <th className="px-3 py-2 border-2 border-slate-900 font-black">المركز</th>
                <th className="px-3 py-2 border-2 border-slate-900 font-black text-center">التاريخ</th>
                <th className="px-3 py-2 border-2 border-slate-900 font-black text-center">الحضور</th>
                <th className="px-3 py-2 border-2 border-slate-900 font-black text-center">الانصراف</th>
                <th className="px-3 py-2 border-2 border-slate-900 font-black text-center">تأخير/مبكر</th>
                <th className="px-3 py-2 border-2 border-slate-900 font-black text-center">ساعات</th>
                <th className="px-3 py-2 border-2 border-slate-900 font-black text-center">الحالة</th>
                <th className="px-3 py-2 border-2 border-slate-900 font-black text-center">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((record) => {
                const emp = employeeMap.get(record.employeeId);
                const center = centerMap.get(record.centerId);
                return (
                  <tr key={record.id} className="border border-slate-300">
                    <td className="px-3 py-1.5 border border-slate-300 font-bold">{emp?.name}</td>
                    <td className="px-3 py-1.5 border border-slate-300">{center?.name}</td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center">{record.date}</td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center">
                      {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '--:--'}
                    </td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center">
                      {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '--:--'}
                    </td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center">
                      {record.delayMinutes || 0}د / {record.earlyDepartureMinutes || 0}د
                    </td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center font-bold">{record.workingHours}h</td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center">
                      {record.status === 'present' ? 'منضبط' : record.status === 'late' ? 'تأخير' : 'معلق'}
                    </td>
                    <td className="px-3 py-1.5 border border-slate-300 text-center text-[10px] text-rose-600 font-bold">
                      {record.notes || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Verification Section */}
          <div className="mt-12 grid grid-cols-2 gap-20 px-10">
            <div className="flex flex-col items-center space-y-12">
              <p className="font-black text-sm">توقيع مسؤول الموارد البشرية</p>
              <div className="w-48 border-b-2 border-dotted border-slate-900"></div>
            </div>
            <div className="flex flex-col items-center space-y-12">
              <p className="font-black text-sm">ختم وتوقيع إدارة المركز</p>
              <div className="w-48 border-b-2 border-dotted border-slate-900"></div>
            </div>
          </div>
        </div>
      )}

      {/* Full Printing - MONTHLY Mode (Horizontal Timesheet) */}
      {reportType === 'monthly' && (
        <div className="hidden print:block w-full" dir="rtl">
          {Array.from(groupedByEmployee.entries()).map(([employeeId, records], index) => {
            const emp = employeeMap.get(employeeId);
            const center = filterCenter === '' ? centerMap.get(records[0]?.centerId) : centers.find(c => c.id === filterCenter);

            // Generate 31 days data and weekday labels
            const year = parseInt(dateFrom.split('-')[0]);
            const month = parseInt(dateFrom.split('-')[1]);
            const daysInMonth = new Date(year, month, 0).getDate();

            const daysMap = new Array(31).fill(0);
            const weekdays = new Array(31).fill('');

            for (let i = 1; i <= 31; i++) {
              if (i <= daysInMonth) {
                const date = new Date(year, month - 1, i);
                weekdays[i - 1] = format(date, 'eee'); // Thu, Fri, etc.
              }
            }

            records.forEach((r: any) => {
              const day = parseInt(r.date.split('-')[2]);
              if (day >= 1 && day <= 31) {
                daysMap[day - 1] = r.workingHours || 0;
              }
            });

            const totalHours = records.reduce((acc: number, curr: any) => acc + (curr.workingHours || 0), 0);

            return (
              <div key={employeeId} className="page-break-container !p-0 !border-0 flex flex-col justify-between">
                <div>
                  {/* Unified Branding Header */}
                  <div className="flex flex-col items-center justify-center space-y-2 mb-4 text-center" dir="rtl">
                    <div className="flex items-center justify-between w-full border-b-2 border-slate-900 pb-2">
                      <div className="text-right flex items-center gap-4">
                        {settings.logoUrl && (
                          <img src={settings.logoUrl} alt="Logo" className="h-14 w-auto object-contain" />
                        )}
                        <div>
                          <h2 className="text-xl font-black">{settings.systemName || 'Relief Experts'}</h2>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Monthly Attendance Timesheet</p>
                        </div>
                      </div>
                      <div className="text-left text-[9px] font-black space-y-1">
                        <p>تاريخ الاستخراج: {format(new Date(), 'yyyy/MM/dd HH:mm')}</p>
                        <p className="text-indigo-600">ID: {emp?.id.split('-')[0].toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Header - Professional Grid */}
                  <table className="w-[277mm] border-collapse text-[9px] mb-3 font-sans" style={{ tableLayout: 'fixed' }}>
                    <tbody>
                      <tr className="border border-black h-[10mm] bg-slate-50/50">
                        <td className="w-[40mm] border-l border-black font-bold px-3 text-right" dir="rtl">اسم الموظف / Employee:</td>
                        <td className="w-[100mm] border-l border-black font-black px-3 text-sm text-right" dir="rtl">{emp?.name || '--'}</td>
                        <td className="w-[40mm] border-l border-black font-bold px-3 text-right" dir="rtl">المشروع / Project:</td>
                        <td className="w-[97mm] font-black px-3 text-indigo-600 font-serif italic text-sm text-right" dir="rtl">
                          {projectMap.get(emp?.projectId || '')?.name || '---'} ({projectMap.get(emp?.projectId || '')?.code || '---'})
                        </td>
                      </tr>
                      <tr className="border border-black h-[10mm]">
                        <td className="border-l border-black font-bold px-3 text-right" dir="rtl">المركز / Location:</td>
                        <td className="border-l border-black px-3 font-bold text-right" dir="rtl">{center?.name || '---'}</td>
                        <td className="border-l border-black font-bold px-3 text-right" dir="rtl">الشهر / Year-Month:</td>
                        <td className="px-3 font-black text-sm text-right" dir="rtl">{format(new Date(dateFrom), 'MMMM / yyyy')}</td>
                      </tr>
                      <tr className="border border-black h-[10mm]">
                        <td className="border-l border-black font-bold px-3 text-right" dir="rtl">المسمى الوظيفي / Role:</td>
                        <td className="border-l border-black px-3 text-right" dir="rtl">{emp?.role === 'admin' ? 'Manager' : 'Field Technician'}</td>
                        <td className="border-l border-black font-bold px-3 text-right" dir="rtl">رمز الموظف / Code:</td>
                        <td className="px-3 font-black uppercase text-sm text-right" dir="rtl">{emp?.code || '--'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Horizontal Timesheet Grid - Strict HTML Table */}
                  <table className="w-[277mm] border-collapse text-[8px] border border-black font-sans" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="border-b border-black h-[7mm] font-bold bg-slate-100/50">
                        <th className="w-[45mm] border-l border-black text-right px-3" dir="rtl">اليوم / Day Type</th>
                        {weekdays.map((wd, i) => (
                          <th key={i} className="border-l border-black text-center font-bold px-1">{wd}</th>
                        ))}
                        <th className="w-[15mm] border-l border-black text-center font-black">Total</th>
                      </tr>
                      <tr className="border-b border-black h-[7mm] font-black">
                        <th className="border-l border-black text-right px-3 italic text-[7px] text-slate-500 underline" dir="rtl">Attendance (Hours)</th>
                        {Array.from({ length: 31 }).map((_, i) => (
                          <th key={i} className={`border-l border-black text-center ${i + 1 > daysInMonth ? 'bg-slate-50 opacity-30 shadow-inner' : ''}`}>{String(i + 1).padStart(2, '0')}</th>
                        ))}
                        <th className="border-l border-black text-center text-xs">SUM</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-black h-[12mm]">
                        <td className="border-l border-black px-3 text-right" dir="rtl">
                          <div className="font-black text-xs">ساعات الدوام الفعلي</div>
                          <div className="text-[7px] uppercase opacity-50 font-bold">Logged Work Hours</div>
                        </td>
                        {daysMap.map((hours, i) => {
                          const dateObj = new Date(year, month - 1, i + 1);
                          const dateStr = format(dateObj, 'yyyy-MM-dd');
                          const isShiftWorker = emp?.workType === 'shifts';
                          const isH = !isShiftWorker && holidays.some(h => h.date === dateStr);
                          const isW = !isShiftWorker && center?.workingDays && !center.workingDays.includes(dateObj.getDay());

                          return (
                            <td key={i} className={`border-l border-black text-center text-[10px] ${hours > 0 ? 'font-black' : 'text-slate-200'} ${isH ? 'bg-indigo-50/50' : isW ? 'bg-rose-50/50' : ''
                              } ${i + 1 > daysInMonth ? 'bg-slate-50 opacity-30 shadow-inner' : ''}`}>
                              {i + 1 <= daysInMonth ? (hours > 0 ? hours.toFixed(1) : '-') : ''}
                            </td>
                          );
                        })}
                        <td className="border-l border-black text-center font-black text-sm bg-indigo-50/50 font-sans">{totalHours.toFixed(1)}</td>
                      </tr>
                      {/* Compact Leave Rows to save vertical space */}
                      {['Annual Leave', 'Sick Leave', 'Public Holiday (PH)'].map((label, idx) => (
                        <tr key={idx} className="border-b border-black h-[6mm]">
                          <td className="border-l border-black px-3 text-slate-400 italic text-right" dir="rtl">{label}</td>
                          {Array.from({ length: 31 }).map((_, i) => (
                            <td key={i} className={`border-l border-black text-center text-slate-200 ${i + 1 > daysInMonth ? 'bg-slate-50 opacity-30 shadow-inner' : ''}`}>-</td>
                          ))}
                          <td className="border-l border-black text-center text-slate-400 font-bold font-sans">0.0</td>
                        </tr>
                      ))}
                      <tr className="h-[8mm] font-black border-t-2 border-black bg-slate-50/50">
                        <td className="border-l border-black px-3 uppercase text-[8px] tracking-widest text-indigo-900 italic text-right" dir="rtl">Total Working Days: {records.filter((r: any) => r.workingHours > 0).length}</td>
                        <td colSpan={31} className="border-l border-black text-center italic text-slate-500 font-bold text-[9px]">
                          Certified Automated Record - Relief Experts Smart Attendance System
                        </td>
                        <td className="border-l border-black text-center text-sm font-sans">{totalHours.toFixed(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Secure Signature Section */}
                <div className="mt-8" dir="rtl">
                  <table className="w-[277mm] border-collapse" style={{ tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        <td className="w-[33.3%] p-2">
                          <div className="border-2 border-slate-900 p-4 h-[35mm] relative rounded-2xl bg-white/50">
                            <p className="font-black text-[10px] border-b-2 border-slate-900 pb-2 mb-3">إقرار الموظف (Employee Signature)</p>
                            <div className="space-y-1.5 text-[9px] font-bold">
                              <p>الاسم: <span className="font-black">{emp?.name}</span></p>
                              <p>التاريخ / Date: <span className="font-black">____ / ____ / 2026</span></p>
                              <div className="absolute bottom-4 left-4 right-4 flex items-end">
                                <span className="text-[10px] font-black italic opacity-30">SIGN:</span>
                                <div className="grow border-b-2 border-slate-900 border-dotted mx-2 mb-1"></div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="w-[33.3%] p-2">
                          <div className="border-2 border-slate-900 p-4 h-[35mm] relative rounded-2xl bg-white/50">
                            <p className="font-black text-[10px] border-b-2 border-slate-900 pb-2 mb-3">اعتماد المسؤول (Supervisor review)</p>
                            <div className="space-y-1.5 text-[9px] font-bold">
                              <p>الاسم / Name: _________________</p>
                              <p>التاريخ / Date: _________________</p>
                              <div className="absolute bottom-4 left-4 right-4 flex items-end">
                                <span className="text-[10px] font-black italic opacity-30">SIGN:</span>
                                <div className="grow border-b-2 border-slate-900 border-dotted mx-2 mb-1"></div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="w-[33.4%] p-2">
                          <div className="border-2 border-slate-900 p-4 h-[35mm] relative rounded-2xl bg-slate-50/30">
                            <p className="font-black text-[10px] border-b-2 border-slate-900 pb-2 mb-3">الموارد البشرية (HR Approval)</p>
                            <div className="space-y-1.5 text-[9px] font-bold text-slate-500">
                              <p>STAMP & SIGN REQUIRED</p>
                              <p>NAME: _________________</p>
                              <div className="absolute bottom-4 left-4 right-4 flex items-end">
                                <div className="grow border-b-2 border-indigo-600/20 border-dotted mx-2 mb-1"></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[8px] text-slate-400 font-bold text-center mt-2 italic">* This document is valid for official use and contains unique digital records.</p>
                </div>

                {index < Array.from(groupedByEmployee.entries()).length - 1 && (
                  <div style={{ pageBreakAfter: 'always' }}></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          @page { 
            size: A4 landscape; 
            margin-top: 25mm; 
            margin-bottom: 25mm; 
            margin-left: 20mm; 
            margin-right: 20mm; 
          }
          body { background: white !important; padding: 0 !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          aside, header, nav, .fixed, button { display: none !important; }
          main, #root { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          
          /* Force White Backgrounds Everywhere - Per User Request */
          * { background-color: transparent !important; background-image: none !important; box-shadow: none !important; }
          body, main, #root, .page-break-container { background-color: white !important; }
          
          table { width: 100% !important; border-collapse: collapse !important; border: 1.5px solid #000 !important; }
          th, td { border: 1px solid #000 !important; padding: 2px 4px !important; text-align: right !important; background-color: white !important; }
          th { font-weight: 950 !important; }
          
          /* Ensure text is black for readability */
          [class*="text-slate-"], [class*="text-gray-"], [class*="text-indigo-"] { color: black !important; }

          .print\\:block { display: block !important; }
          .print\\:flex { display: flex !important; }
          
          .page-break-container { 
            width: 277mm !important;
            height: 175mm !important;
            max-height: 175mm !important;
            position: relative; 
            box-sizing: border-box;
            background-color: white !important;
            overflow: hidden !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          
          /* Force landscape orientation scaling */
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          
          .print-footer {
            position: absolute;
            bottom: 5mm;
            left: 5mm;
            right: 5mm;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            font-weight: bold;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Reports;
