import React, { useMemo, memo } from 'react';
import { useApp } from '../store.tsx';
import {
  Users, Building2, Clock, CheckCircle,
  AlertCircle, TrendingUp, ArrowUpRight,
  ShieldCheck, Zap, UserCheck, UserMinus,
  Activity, Map as MapIcon, CalendarDays, Loader2, WifiOff, RefreshCcw,
  CheckCircle2, AlertTriangle, Bell, Clock8, Info, Search, PowerOff,
  Upload, Database, HardDriveDownload, ExternalLink
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts';
import { format, isToday, isYesterday, subDays, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getTodayDateString, getSyriaDate } from '../utils/attendanceLogic.ts';

// --- Premium UI Components ---

const GlassCard = ({ children, className = "", hover = true }: { children: React.ReactNode, className?: string, hover?: boolean }) => (
  <div className={`
    bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] 
    rounded-[2.5rem] p-6 transition-all duration-500
    ${hover ? 'hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.12)] hover:border-white/60 hover:-translate-y-1' : ''}
    ${className}
  `}>
    {children}
  </div>
);

const StatHighlight = ({ label, value, icon: Icon, color, subtext }: { label: string, value: string | number, icon: any, color: string, subtext: string }) => (
  <GlassCard className="flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <div className={`w-12 h-12 rounded-2xl bg-${color}-50 text-${color}-600 flex items-center justify-center shadow-sm`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="px-3 py-1 bg-slate-50 rounded-full border border-slate-100 italic text-[10px] font-black text-slate-400">
        LIVE
      </div>
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-4xl font-black text-slate-900">{value}</h3>
      </div>
      <p className="text-[10px] font-bold text-slate-500 mt-2 flex items-center gap-1.5">
        <Activity className={`w-3 h-3 text-${color}-500`} /> {subtext}
      </p>
    </div>
  </GlassCard>
);

const PresenceItem = memo(({ employee, record, type }: { employee: any, record: any, type: 'admin' | 'shift' }) => {
  const checkInTime = new Date(record.checkIn);
  const diffMs = Date.now() - checkInTime.getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffMins = Math.floor((diffMs % 3600000) / 60000);

  return (
    <div className="flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-white/60 hover:bg-white transition-all group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-colors shadow-sm
          ${type === 'admin' ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'}`}>
          {employee?.name.charAt(0)}
        </div>
        <div>
          <p className="text-xs font-black text-slate-800">{employee?.name}</p>
          <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
            <MapIcon className="w-2.5 h-2.5" /> {employee?.centerId === 'all' ? 'المقر الرئيسي' : 'مركز ميداني'}
          </p>
        </div>
      </div>
      <div className="text-left">
        <p className={`text-[10px] font-black ${type === 'admin' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {format(checkInTime, 'hh:mm a', { locale: ar })}
        </p>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">منذ {diffHrs}س {diffMins}د</p>
      </div>
    </div>
  );
});

const Dashboard: React.FC = () => {
  const {
    employees, centers, attendance, pendingOperations,
    requestDataRecovery, currentTime, timeOffset, importRecordsFromJSON
  } = useApp();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const today = getTodayDateString(getSyriaDate(currentTime));

  // --- Logic & Data Processing ---

  const employeeMap = useMemo(() => {
    const map = new Map();
    employees.forEach(e => map.set(e.id, e));
    return map;
  }, [employees]);

  const centerMap = useMemo(() => {
    const map = new Map();
    centers.forEach(c => map.set(c.id, c));
    return map;
  }, [centers]);

  const activeCenterIds = useMemo(() => new Set(centers.filter(c => c.isActive).map(c => c.id)), [centers]);

  // Current Presence Logic (The source of truth)
  const presence = useMemo(() => {
    const fortyEightHoursAgo = new Date(currentTime.getTime() - (48 * 60 * 60 * 1000));

    return attendance.filter(a => {
      if (a.checkOut || !a.checkIn) return false;
      if (!activeCenterIds.has(a.centerId)) return false;

      const emp = employeeMap.get(a.employeeId);
      if (!emp) return false;

      const checkInTime = new Date(a.checkIn);
      const isShift = emp.workType === 'shifts';

      // Admin must be today, Shiit within 48h
      if (isShift) return checkInTime > fortyEightHoursAgo;
      return a.date === today;
    }).map(a => ({
      ...a,
      employee: employeeMap.get(a.employeeId)
    }));
  }, [attendance, today, activeCenterIds, employeeMap, currentTime]);

  const adminsPresent = useMemo(() => presence.filter(p => p.employee?.workType === 'administrative'), [presence]);
  const shiftsPresent = useMemo(() => presence.filter(p => p.employee?.workType === 'shifts'), [presence]);

  // Discipline Alerts
  const alerts = useMemo(() => {
    const list: { type: 'late' | 'missing_checkout' | 'system', title: string, sub: string, priority: 'high' | 'med' }[] = [];

    // Late today
    const lateCount = attendance.filter(a => a.date === today && a.status === 'late').length;
    if (lateCount > 0) {
      list.push({ type: 'late', title: `${lateCount} تأخير اليوم`, sub: 'يتطلب متابعة مع مدراء المراكز', priority: 'med' });
    }

    // Auto-closed recently (simulated/tracked via notes)
    const autoClosed = attendance.filter(a => a.notes?.includes('إغلاق آلي') && (isToday(new Date(a.date)) || isYesterday(new Date(a.date)))).length;
    if (autoClosed > 0) {
      list.push({ type: 'missing_checkout', title: `${autoClosed} نسيان بصمة خروج`, sub: 'تم إغلاق السجلات آلياً مع الخصم', priority: 'high' });
    }

    return list;
  }, [attendance, today]);

  // Center Coverage Health
  const centerHealth = useMemo(() => {
    return centers.filter(c => c.isActive).map(center => {
      const centerEmps = employees.filter(e => e.centerId === center.id).length;
      const centerPresent = presence.filter(p => p.centerId === center.id).length;
      const health = centerEmps > 0 ? (centerPresent / centerEmps) * 100 : 0;
      return { center, centerEmps, centerPresent, health };
    }).sort((a, b) => a.health - b.health); // Show low coverage centers first
  }, [centers, employees, presence]);

  // Weekly Trend
  const weeklyTrend = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(getSyriaDate(currentTime), 6 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const count = attendance.filter(a => a.date === dateStr).length;
      return {
        name: format(d, 'EEE', { locale: ar }),
        count
      };
    });
  }, [attendance, currentTime]);

  return (
    <div className="space-y-8 animate-in fade-in duration-1000 pb-20">

      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Welcome & Global Sync */}
        <GlassCard className="flex-1 flex flex-col md:flex-row items-center justify-between gap-6" hover={false}>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
              <Zap className="w-8 h-8 fill-current" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">غرفة العمليات المركزية</h1>
              <div className="flex items-center gap-2 text-slate-500 font-bold text-sm mt-1">
                <CalendarDays className="w-4 h-4 text-indigo-500" />
                <span>{format(currentTime, 'EEEE, dd MMMM yyyy', { locale: ar })}</span>
              </div>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-2xl border flex items-center gap-3 transition-colors
            ${pendingOperations > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className={`w-2 h-2 rounded-full ${pendingOperations > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${pendingOperations > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {pendingOperations > 0 ? `بانتظار مزامنة ${pendingOperations} سجلات` : 'النظام متزامن بالكامل'}
            </span>
          </div>
        </GlassCard>

        {/* Dynamic Alerts & Emergency Tools */}
        <div className="xl:w-[400px] flex flex-col gap-3">
          {/* Emergency Pull Tool */}
          <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest">أدوات طوارئ السيرفر</h4>
                <p className="text-[9px] font-bold text-slate-400">استرجاع السجلات يدوياً عند انقطاع السيرفر</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  requestDataRecovery();
                  alert('تم إرسال أمر استعادة البيانات عبر موجات البث. في حال عدم استجابة الأجهزة (بسبب المتصفح)، يرجى استخدام زر الرفع اليدوي أدناه.');
                }}
                className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/10 flex flex-col items-center gap-2 group"
              >
                <RefreshCcw className="w-4 h-4 text-indigo-400 group-hover:rotate-180 transition-transform duration-500" />
                <span className="text-[8px] font-black uppercase">سحب آلي (Broadcast)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="p-3 bg-indigo-600/10 rounded-2xl hover:bg-indigo-600/20 transition-all border border-indigo-500/30 flex flex-col items-center gap-2 group"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <Upload className="w-4 h-4 text-indigo-400" />}
                <span className="text-[8px] font-black uppercase">استيراد يدوي (JSON)</span>
              </button>
            </div>

            <button
              onClick={() => window.open('https://drive.google.com/', '_blank')}
              className="w-full p-3 bg-slate-800 rounded-2xl hover:bg-slate-700 transition-all border border-slate-700 flex items-center justify-center gap-2 group"
            >
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 group-hover:text-white">تصفح أرشيف السجلات (Google Drive)</span>
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImporting(true);
                  const result = await importRecordsFromJSON(file);
                  setImporting(false);
                  if (result.success) {
                    alert(`تم استيراد ${result.count} سجل بنجاح ودمجهم في التقارير.`);
                  } else {
                    alert(`فشل الاستيراد: ${result.error}`);
                  }
                }
              }}
            />
          </div>

          {alerts.length > 0 ? alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-3xl border animate-in slide-in-from-right duration-500 delay-${i * 100}
              ${alert.priority === 'high' ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
              <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm
                ${alert.priority === 'high' ? 'text-rose-500' : 'text-amber-500'}`}>
                {alert.type === 'missing_checkout' ? <AlertCircle className="w-5 h-5" /> : <Clock8 className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black truncate">{alert.title}</p>
                <p className="text-[10px] font-bold opacity-70 truncate">{alert.sub}</p>
              </div>
              <ArrowUpRight className="w-4 h-4 ml-auto opacity-40" />
            </div>
          )) : (
            <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-800">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 text-emerald-500 shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black">كل شيء تحت السيطرة</p>
                <p className="text-[10px] font-bold opacity-70">لا توجد تنبيهات انضباط حالياً</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Primary Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatHighlight label="إدارة - متواجدون" value={adminsPresent.length} icon={UserCheck} color="emerald" subtext="بصموا دخول اليوم" />
        <StatHighlight label="مناوبات - نشطة" value={shiftsPresent.length} icon={Activity} color="rose" subtext="مناوبات ميدانية جارية" />
        <StatHighlight label="تغطية المراكز" value={`${(centerHealth.reduce((acc, c) => acc + c.health, 0) / (centerHealth.length || 1)).toFixed(0)}%`} icon={Building2} color="indigo" subtext="متوسط نسبة الإشغال" />
        <StatHighlight label="إجمالي القوة" value={employees.length} icon={Users} color="slate" subtext="موظف مسجل حالياً" />
      </div>

      {/* Detailed Viewports */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Live Presence Lists */}
        <GlassCard className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
              <h3 className="text-lg font-black text-slate-800">قائمة المتواجدين الآن</h3>
            </div>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
              <div className="px-3 py-1 text-[10px] font-black text-indigo-600 bg-white rounded-lg shadow-sm">الميداني</div>
              <div className="px-3 py-1 text-[10px] font-black text-slate-400">الإحصائي</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Admin Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الموظفين الإداريين ({adminsPresent.length})</span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {adminsPresent.length > 0 ? adminsPresent.map((p, i) => (
                  <PresenceItem key={p.id} employee={p.employee} record={p} type="admin" />
                )) : (
                  <div className="py-10 text-center opacity-30">
                    <UserMinus className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-xs font-bold">لا يوجد إداريين</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shift Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">مناوبات الميدان ({shiftsPresent.length})</span>
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {shiftsPresent.length > 0 ? shiftsPresent.map((p, i) => (
                  <PresenceItem key={p.id} employee={p.employee} record={p} type="shift" />
                )) : (
                  <div className="py-10 text-center opacity-30">
                    <Activity className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-xs font-bold">لا توجد مناوبات</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Center Health Coverage */}
        <div className="space-y-6">
          <GlassCard className="h-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                <h3 className="text-lg font-black text-slate-800">تغطية المراكز</h3>
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
              {centerHealth.map(({ center, centerEmps, centerPresent, health }) => (
                <div key={center.id} className="space-y-2">
                  <div className="flex items-center justify-between px-1 text-[11px] font-black">
                    <span className="text-slate-700">{center.name}</span>
                    <span className={health < 50 ? 'text-rose-600' : 'text-slate-400'}>
                      {centerPresent} / {centerEmps} {health < 50 && '⚠️'}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      className={`h-full transition-all duration-1000 ${health < 50 ? 'bg-rose-500' : health < 80 ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                      style={{ width: `${health}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Analytics Row */}
      <GlassCard className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-black text-slate-800 tracking-tight">تريند الحضور الأسبوعي</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrend}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 900 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 900 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 900, fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6 border-r border-slate-100 pr-0 lg:pr-10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-black text-slate-800 tracking-tight">توزيع الحالة</h3>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'منضبط', value: adminsPresent.length + shiftsPresent.length, color: '#10b981' },
                    { name: 'متأخر', value: attendance.filter(a => a.date === today && a.status === 'late').length, color: '#f59e0b' },
                    { name: 'غائب', value: Math.max(0, employees.length - (adminsPresent.length + shiftsPresent.length)), color: '#f1f5f9' },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[0, 1, 2].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#f1f5f9'][index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> منضبط
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-600">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div> متأخر
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
              <div className="w-2 h-2 bg-slate-300 rounded-full"></div> متوقع غياب
            </div>
          </div>
        </div>
      </GlassCard>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
