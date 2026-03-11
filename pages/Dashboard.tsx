import React, { useMemo, memo } from 'react';
import { useApp } from '../store.tsx';
import {
  Users, Building2, Clock, CheckCircle,
  AlertCircle, TrendingUp, ArrowUpRight,
  ShieldCheck, Zap, UserCheck, UserMinus,
  Activity, Map as MapIcon, CalendarDays, Loader2, WifiOff, RefreshCcw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getTodayDateString, getSyriaDate } from '../utils/attendanceLogic.ts';

// Memoized Stat Card
const StatCard = memo(({ stat, index }: { stat: any; index: number }) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:border-indigo-200 transition-all">
    <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      <stat.icon className="w-6 h-6" />
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
    <h3 className="text-4xl font-black text-slate-900 mb-4">{stat.value}</h3>
    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full w-fit">
      <Activity className="w-3 h-3 text-indigo-500" /> {stat.trend}
    </div>
    <div className={`absolute top-0 left-0 w-1.5 h-full bg-${stat.color}-500 opacity-20`}></div>
  </div>
));

StatCard.displayName = 'StatCard';

// Memoized Daily Summary Item
const DailySummaryItem = memo(({ index, employee, record }: { index: number; employee: any; record?: any }) => (
  <div className="flex items-center justify-between p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
      <span className="text-[9px] md:text-[10px] font-black text-slate-400 w-4 md:w-5 shrink-0">{index}.</span>
      <div className="w-7 h-7 md:w-8 md:h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-[9px] md:text-[10px] group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
        {employee?.name.charAt(0) || 'U'}
      </div>
      <p className="text-[11px] md:text-xs font-black text-slate-800 truncate">{employee?.name || 'موظف غير معروف'}</p>
    </div>
    
    <div className="flex items-center gap-3 md:gap-8 text-left shrink-0">
      <div className="flex flex-col items-start min-w-[50px] md:min-w-[60px]">
        <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase mb-0.5">دخول</span>
        <p className="text-[10px] md:text-xs font-black text-emerald-600">
          {record?.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '-'}
        </p>
      </div>
      <div className="flex flex-col items-start min-w-[50px] md:min-w-[60px]">
        <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase mb-0.5">خروج</span>
        <p className="text-[10px] md:text-xs font-black text-indigo-600">
          {record?.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}
        </p>
      </div>
    </div>
  </div>
));

DailySummaryItem.displayName = 'DailySummaryItem';

// Memoized Center Progress Bar
const CenterProgress = memo(({ center, percentage, records, totalEmps }: {
  center: any;
  percentage: number;
  records: number;
  totalEmps: number;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between px-2">
      <span className="text-xs font-black text-slate-700">{center.name}</span>
      <span className="text-[10px] font-black text-slate-400">{records} / {totalEmps} موظف</span>
    </div>
    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
      <div
        className="h-full bg-indigo-600 transition-all duration-1000"
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  </div>
));

CenterProgress.displayName = 'CenterProgress';

const Dashboard: React.FC = () => {
  const { employees, centers, attendance, pendingOperations, requestDataRecovery, currentTime } = useApp();
  const today = getTodayDateString(getSyriaDate(currentTime));

  const handleForceSync = async () => {
    if (window.confirm('سيتم إرسال أمر برفع جميع البيانات المعلقة من هواتف الموظفين الآن. هل تريد المتابعة؟')) {
      await requestDataRecovery();
      alert('تم إرسال نداء المزامنة لجميع الأجهزة النشطة.');
    }
  };

  // Create lookup maps for O(1) access
  const employeeMap = useMemo(() => {
    const map = new Map();
    employees.forEach(e => map.set(e.id, e));
    return map;
  }, [employees]);

  // Filter active centers only
  const activeCentersList = useMemo(() => centers.filter(c => c.isActive), [centers]);
  const activeCenterIds = useMemo(() => new Set(activeCentersList.map(c => c.id)), [activeCentersList]);

  // Filter employees and records for active centers only
  const activeEmployees = useMemo(() =>
    employees.filter(e => activeCenterIds.has(e.centerId)),
    [employees, activeCenterIds]
  );

  const todayRecords = useMemo(() =>
    attendance.filter(a => a.date === today && activeCenterIds.has(a.centerId)),
    [attendance, today, activeCenterIds]
  );

  // Calculate advanced statistics based on active filters
  const stats = useMemo(() => {
    const totalEmps = activeEmployees.length;
    const presentToday = todayRecords.length;
    const lateToday = todayRecords.filter(a => a.status === 'late').length;
    const activeCentersCount = activeCentersList.length;

    return [
      { label: 'إجمالي الموظفين (النشطين)', value: totalEmps, icon: Users, color: 'indigo', trend: 'القوة الميدانية حالياً' },
      { label: 'سجلات اليوم', value: presentToday, icon: UserCheck, color: 'emerald', trend: `${((presentToday / totalEmps) * 100 || 0).toFixed(0)}% نسبة الحضور` },
      { label: 'حالات التأخير', value: lateToday, icon: Clock, color: 'amber', trend: 'يحتاج متابعة' },
      { label: 'المراكز النشطة', value: activeCentersCount, icon: Building2, color: 'blue', trend: 'تعمل حالياً' },
    ];
  }, [activeEmployees, activeCentersList, todayRecords]);

  // Pie chart data - active centers only
  const pieData = useMemo(() => {
    const late = todayRecords.filter(a => a.status === 'late').length;
    const onTime = todayRecords.filter(a => a.status === 'present').length;
    const absent = Math.max(0, activeEmployees.length - todayRecords.length);

    return [
      { name: 'منضبط', value: onTime, color: '#10b981' },
      { name: 'متأخر', value: late, color: '#f59e0b' },
      { name: 'غائب', value: absent, color: '#ef4444' },
    ];
  }, [todayRecords, activeEmployees]);

  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = getSyriaDate();
      d.setDate(d.getDate() - (6 - i));
      const date = format(d, 'yyyy-MM-dd');
      const count = attendance.filter(a => a.date === date && activeCenterIds.has(a.centerId)).length;
      return {
        name: format(d, 'EEE', { locale: ar }),
        count: count
      };
    });
  }, [attendance, activeCenterIds]);

  // Daily Summary (List of all employees and their movements for today)
  const dailySummary = useMemo(() => {
    const summary: { employee: any; record?: any; latestTime?: number }[] = [];
    
    activeEmployees.forEach(emp => {
      const empRecords = todayRecords
        .filter(r => r.employeeId === emp.id)
        .sort((a, b) => new Date(a.checkIn!).getTime() - new Date(b.checkIn!).getTime());
        
      if (empRecords.length === 0) {
        summary.push({ employee: emp, latestTime: 0 }); // No activity = bottom
      } else {
        empRecords.forEach(rec => {
          const time = new Date(rec.checkOut || rec.checkIn!).getTime();
          summary.push({ employee: emp, record: rec, latestTime: time });
        });
      }
    });

    // Sort: Latest activity first, then by name for those with same activity status
    return summary.sort((a, b) => {
      if ((b.latestTime || 0) !== (a.latestTime || 0)) {
        return (b.latestTime || 0) - (a.latestTime || 0);
      }
      return a.employee.name.localeCompare(b.employee.name, 'ar');
    });
  }, [activeEmployees, todayRecords]);

  // Registered employees count for the header
  const registeredCount = useMemo(() => {
    const uniqueIds = new Set(todayRecords.map(r => r.employeeId));
    return uniqueIds.size;
  }, [todayRecords]);

  // Center statistics for progress bars
  const centerStats = useMemo(() =>
    activeCentersList.map(center => {
      const centerRecords = todayRecords.filter(r => r.centerId === center.id).length;
      const centerEmps = employees.filter(e => e.centerId === center.id).length;
      const percentage = centerEmps > 0 ? (centerRecords / centerEmps) * 100 : 0;
      return { center, centerRecords, centerEmps, percentage };
    }),
    [activeCentersList, todayRecords, employees]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-1000">
      {/* Header Welcome */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-indigo-200">
              <Zap className="w-8 h-8 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">مرحباً بك في لوحة التحكم الذكية</h2>
                {pendingOperations > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full">
                    <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                    <span className="text-[9px] font-black text-amber-600 uppercase">{pendingOperations} معلق</span>
                  </div>
                )}
              </div>
              <p className="text-slate-500 font-bold text-sm">نظرة عامة على حالة الانضباط (للمراكز النشطة فقط)</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleForceSync}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-3 rounded-2xl border border-indigo-100 font-black text-[10px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
              title="طلب مزامنة فورية من جميع هواتف الموظفين"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>نداء المزامنة الشامل</span>
            </button>
            {attendance.filter(a => a.syncStatus === 'pending' || a.syncStatus === 'failed').length > 0 && (
              <div className="flex items-center gap-2 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 border-dashed animate-pulse">
                <WifiOff className="w-4 h-4 text-rose-500" />
                <span className="text-[10px] font-black text-rose-600 uppercase">
                  {attendance.filter(a => a.syncStatus === 'pending' || a.syncStatus === 'failed').length} سجلات غير مزامنة
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
              <span className="text-slate-700 font-black text-xs">{format(currentTime, 'dd MMMM yyyy', { locale: ar })}</span>
            </div>
          </div>
        </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <StatCard key={i} stat={stat} index={i} />
        ))}
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Weekly Trend (2/3 width) */}
        <div className="xl:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">نشاط الحضور الأسبوعي</h3>
              <p className="text-xs text-slate-400 font-bold mt-1">تطور عدد الموظفين الحاضرين في المراكز النشطة</p>
            </div>
            <div className="px-4 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-xl border border-indigo-100 uppercase tracking-widest">
              Active Scope
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution (1/3 width) */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">توزيع الحالات اليوم</h3>
          <p className="text-xs text-slate-400 font-bold mb-8">نسبة الالتزام اللحظية للكوادر النشطة</p>

          <div className="h-[250px] w-full relative mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900">{todayRecords.length}</span>
              <span className="text-[10px] text-slate-400 font-black uppercase">سجل اليوم</span>
            </div>
          </div>

          <div className="space-y-3 mt-auto">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs font-black text-slate-700">{item.name}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{item.value} موظف</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity & Centers Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Recent Logs (Filtered for Active Centers) */}
        <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[400px] md:h-[500px]">
          <div className="flex items-center justify-between mb-6 md:mb-8 shrink-0">
            <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">سجل حركات اليوم</h3>
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">
                {registeredCount} / {activeEmployees.length} مسجل
              </div>
              <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300" />
            </div>
          </div>
          <div className="space-y-2 md:space-y-3 overflow-y-auto pr-1 md:pr-2 custom-scrollbar flex-1">
            {dailySummary.map((item, i) => (
              <DailySummaryItem
                key={item.record?.id || `no-rec-${item.employee.id}`}
                index={i + 1}
                employee={item.employee}
                record={item.record}
              />
            ))}
            {dailySummary.length === 0 && (
              <div className="py-20 text-center text-slate-300 font-bold italic text-sm">لا توجد سجلات للمراكز النشطة اليوم</div>
            )}
          </div>
        </div>

        {/* Centers Overview (Active Centers Only) */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">حالة المراكز الميدانية النشطة</h3>
            <MapIcon className="w-5 h-5 text-slate-300" />
          </div>
          <div className="space-y-4">
            {centerStats.map((item, i) => (
              <CenterProgress
                key={item.center.id || i}
                center={item.center}
                percentage={item.percentage}
                records={item.centerRecords}
                totalEmps={item.centerEmps}
              />
            ))}
            {activeCentersList.length === 0 && (
              <div className="py-10 text-center text-slate-400 font-bold italic">جميع المراكز متوقفة حالياً</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
