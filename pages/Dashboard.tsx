import React, { useMemo, memo } from 'react';
import { useApp } from '../store.tsx';
import {
  Users, Building2, Clock, CheckCircle,
  AlertCircle, TrendingUp, ArrowUpRight,
  ShieldCheck, Zap, UserCheck, UserMinus,
  Activity, Map as MapIcon, CalendarDays, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getTodayDateString } from '../utils/attendanceLogic.ts';

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

// Memoized Recent Log Item
const RecentLogItem = memo(({ record, employee }: { record: any; employee: any }) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-md transition-all">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs">
        {employee?.name.charAt(0) || 'U'}
      </div>
      <div>
        <p className="text-xs font-black text-slate-800">{employee?.name || 'موظف غير معروف'}</p>
        <p className="text-[9px] text-slate-400 font-bold uppercase">{record.checkOut ? 'تسجيل انصراف' : 'تسجيل حضور'}</p>
      </div>
    </div>
    <div className="text-left">
      <p className="text-xs font-black text-slate-900">
        {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : format(new Date(record.checkIn!), 'HH:mm')}
      </p>
      <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase inline-block ${record.status === 'late' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
        {record.status === 'late' ? 'متأخر' : 'منضبط'}
      </div>
    </div>
  </div>
));

RecentLogItem.displayName = 'RecentLogItem';

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
  const { employees, centers, attendance, pendingOperations } = useApp();
  const today = getTodayDateString();

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

  // Weekly activity chart data
  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const date = format(d, 'yyyy-MM-dd');
      const count = attendance.filter(a => a.date === date && activeCenterIds.has(a.centerId)).length;
      return {
        name: format(d, 'EEE', { locale: ar }),
        count: count
      };
    });
  }, [attendance, activeCenterIds]);

  // Recent logs (last 5, reversed)
  const recentLogs = useMemo(() =>
    todayRecords.slice(-5).reverse(),
    [todayRecords]
  );

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
        <div className="flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
          <CalendarDays className="w-5 h-5 text-indigo-600" />
          <span className="text-slate-700 font-black text-xs">{format(new Date(), 'dd MMMM yyyy', { locale: ar })}</span>
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
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">أحدث عمليات التسجيل</h3>
            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-4">
            {recentLogs.map((record, i) => (
              <RecentLogItem
                key={record.id || i}
                record={record}
                employee={employeeMap.get(record.employeeId)}
              />
            ))}
            {todayRecords.length === 0 && (
              <div className="py-20 text-center text-slate-300 font-bold italic">لا توجد عمليات تسجيل حتى الآن اليوم</div>
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
