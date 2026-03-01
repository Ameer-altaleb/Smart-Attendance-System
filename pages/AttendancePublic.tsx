
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../store.tsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  LogIn, LogOut, CheckCircle2, ShieldAlert, Smartphone,
  BellRing, Check, Loader2, ShieldCheck, MapPin, User, Clock, Globe, AlertTriangle, Wifi, WifiOff, Lock, Navigation, Building2, ChevronDown
} from 'lucide-react';
import { calculateDelay, calculateEarlyDeparture, calculateWorkingHours, getTodayDateString, calculateDistance } from '../utils/attendanceLogic.ts';
import { AttendanceRecord, Employee, Notification, Center } from '../types.ts';
import { supabase } from '../lib/supabase.ts';

const getDeviceId = () => {
  let id = localStorage.getItem('attendance_device_id');
  if (!id) {
    id = 'dev_auth_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('attendance_device_id', id);
  }
  return id;
};

const AttendancePublic: React.FC = () => {
  const { centers, employees, attendance, addAttendance, updateAttendance, updateEmployee, templates, notifications, settings, refreshData } = useApp();
  const [selectedCenterId, setSelectedCenterId] = useState(() => localStorage.getItem('last_center_id') || '');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => localStorage.getItem('last_emp_id') || '');

  // Persist selections
  useEffect(() => {
    localStorage.setItem('last_center_id', selectedCenterId);
  }, [selectedCenterId]);

  useEffect(() => {
    localStorage.setItem('last_emp_id', selectedEmployeeId);
  }, [selectedEmployeeId]);

  // Time & Location State
  const [timeOffset, setTimeOffset] = useState(0);
  const [isTimeSynced, setIsTimeSynced] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userLocation, setUserLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'active' | 'denied' | 'out_of_range'>('idle');

  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'security' } | null>(null);
  const [userIP, setUserIP] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  const [ipLoading, setIpLoading] = useState(true);

  // Robust Network Time Sync Logic targeting Syria/Turkey Time
  const syncWithNetworkTime = async () => {
    const timeAPIs = [
      'https://timeapi.io/api/Time/current/zone?timeZone=Europe/Istanbul',
      'https://worldtimeapi.org/api/timezone/Europe/Istanbul',
      'https://worldtimeapi.org/api/timezone/Asia/Damascus'
    ];

    for (const apiUrl of timeAPIs) {
      try {
        const start = Date.now();
        const response = await fetch(apiUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('API Response Error');

        const data = await response.json();
        const remoteDateStr = data.dateTime || data.datetime;
        const networkTime = new Date(remoteDateStr).getTime();

        const end = Date.now();
        const latency = (end - start) / 2;

        const correctedNetworkTime = networkTime + latency;
        const localDeviceTime = Date.now();

        const offset = correctedNetworkTime - localDeviceTime;

        // Only apply offset if it's significant (> 30s) or if explicitly syncing
        if (Math.abs(offset) > 30000 || !isTimeSynced) {
          setTimeOffset(offset);
          setIsTimeSynced(true);
        }
        setSyncError(false);
        return;
      } catch (err) {
        console.warn(`Failed to sync with ${apiUrl}:`, err);
      }
    }
    setIsTimeSynced(false);
    setSyncError(true);
  };

  const syncLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationStatus('active');
      },
      (err) => {
        console.error('Location error:', err);
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    syncWithNetworkTime();
    syncLocation();

    // IP Fetching with timeout
    const fetchIP = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

      try {
        const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        const data = await res.json();
        setUserIP(data.ip);
      } catch (err) {
        console.warn('IP fetch timed out or failed, falling back to manual mode');
        setUserIP('0.0.0.0');
      } finally {
        clearTimeout(timeoutId);
        setIpLoading(false);
      }
    };

    fetchIP();

    const syncInterval = setInterval(syncWithNetworkTime, 300000);
    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    refreshData('employees');
  }, [refreshData]);

  useEffect(() => {
    const timer = setInterval(() => {
      const syncedDate = new Date(Date.now() + timeOffset);
      setCurrentTime(syncedDate);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeOffset]);

  // Logic to identify the center based on IP
  const matchedCenter = useMemo(() => {
    if (!userIP || userIP === '0.0.0.0' || ipLoading) return null;
    return centers.find(c => c.isActive && c.authorizedIP === userIP);
  }, [centers, userIP, ipLoading]);

  // Automatically select center if matched, or clear if not
  useEffect(() => {
    if (matchedCenter) {
      setSelectedCenterId(matchedCenter.id);
    } else if (!ipLoading) {
      setSelectedCenterId('');
      setSelectedEmployeeId('');
    }
  }, [matchedCenter, ipLoading]);

  const selectedCenter = useMemo(() => centers.find(c => c.id === selectedCenterId), [centers, selectedCenterId]);

  // تم تعطيل التحقق الإجباري من الـ IP مؤقتاً بناءً على طلب المدير
  const isIpAuthorized = true; // تم ضبطها لـ true لتجاوز الحجب

  useEffect(() => {
    if (selectedEmployeeId) {
      const relevantNotif = notifications.find(n =>
        n.targetType === 'all' ||
        (n.targetType === 'center' && n.targetId === selectedCenterId) ||
        (n.targetType === 'employee' && n.targetId === selectedEmployeeId)
      );

      if (relevantNotif) {
        const dismissed = sessionStorage.getItem(`notif_seen_${relevantNotif.id}_${selectedEmployeeId}`);
        if (!dismissed) setActiveNotification(relevantNotif);
      }
    }
  }, [selectedEmployeeId, selectedCenterId, notifications]);

  const handleAction = async (type: 'in' | 'out') => {
    if (!selectedEmployeeId || !selectedCenter || isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const currentSyncedTime = new Date(Date.now() + timeOffset);
      const currentDeviceId = getDeviceId();

      // 1. Mandatory Network (IP) Verification
      if (selectedCenter.authorizedIP && userIP !== selectedCenter.authorizedIP) {
        setMessage({
          text: `فشل التحقق الشبكي: يجب أن تكون متصلاً بشبكة الإنترنت الخاصة بالمركز لتسجيل الحضور. (IP الحالي غير مصرح به)`,
          type: 'security'
        });
        setIsSubmitting(false);
        return;
      }

      // 2. Conditional GPS Geofencing Check
      if (selectedCenter.latitude && selectedCenter.longitude) {
        if (!userLocation) {
          setMessage({ text: 'يرجى تفعيل الـ GPS وتصريح الوصول للموقع للمتابعة.', type: 'security' });
          setIsSubmitting(false);
          syncLocation();
          return;
        }

        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lon,
          selectedCenter.latitude,
          selectedCenter.longitude
        );

        const allowedRadius = selectedCenter.radiusMeters || 50;

        if (distance > allowedRadius) {
          setMessage({
            text: `أنت خارج نطاق المركز بمسافة (${Math.round(distance)} متر). يرجى التواجد داخل مبنى المركز لتسجيل الحضور.`,
            type: 'security'
          });
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Mandatory Employee & Device Identity Verification
      const localEmployee = employees.find(e => e.id === selectedEmployeeId);
      if (!localEmployee) throw new Error('Employee record missing');

      if (localEmployee.deviceId && localEmployee.deviceId !== currentDeviceId) {
        setMessage({
          text: 'خطأ أمني: هذا الحساب مرتبط بجهاز آخر. لا يسمح بتسجيل الدخول إلا من جهازك الشخصي المسجل مسبقاً.',
          type: 'security'
        });
        setIsSubmitting(false);
        return;
      }

      const conflict = employees.find(e => e.deviceId === currentDeviceId && e.id !== selectedEmployeeId);
      if (conflict) {
        setMessage({
          text: `هذا الجهاز مستخدم بالفعل من قبل موظف آخر (${conflict.name}). يمنع تعدد الحسابات على جهاز واحد.`,
          type: 'security'
        });
        setIsSubmitting(false);
        return;
      }

      if (!localEmployee.deviceId) {
        await updateEmployee({ ...localEmployee, deviceId: currentDeviceId });
      }

      const today = format(currentSyncedTime, 'yyyy-MM-dd');

      // العثور على أحدث سجل للموظف
      const recentRecord = [...attendance]
        .filter(a => a.employeeId === selectedEmployeeId)
        .sort((a, b) => new Date(b.checkIn!).getTime() - new Date(a.checkIn!).getTime())[0];

      const isShiftWorker = localEmployee.workType === 'shifts';
      const hasOpenRecord = recentRecord && !recentRecord.checkOut;

      if (type === 'in') {
        if (hasOpenRecord) {
          setMessage({ text: 'لديك سجل دخول نشط بالفعل. يرجى تسجيل الخروج أولاً عند انتهاء المناوبة.', type: 'error' });
        } else {
          // للموظف الإداري، نمنع تكرار الدخول في نفس اليوم
          if (!isShiftWorker) {
            const alreadyCheckedInToday = attendance.find(a => a.employeeId === selectedEmployeeId && a.date === today);
            if (alreadyCheckedInToday) {
              setMessage({ text: 'لقد سجلت دخولك مسبقاً لهذا اليوم.', type: 'error' });
              setIsSubmitting(false);
              return;
            }
          }

          const delay = !isShiftWorker
            ? calculateDelay(currentSyncedTime, selectedCenter.defaultStartTime, selectedCenter.checkInGracePeriod)
            : 0; // نظام المناوبات لا يحسب التأخير الصباحي بنفس الطريقة الإدارية

          const record: AttendanceRecord = {
            id: crypto.randomUUID(),
            employeeId: selectedEmployeeId,
            centerId: selectedCenter.id,
            date: today,
            checkIn: currentSyncedTime.toISOString(),
            status: delay > 0 ? 'late' : 'present',
            delayMinutes: delay,
            earlyDepartureMinutes: 0,
            workingHours: 0,
            ipAddress: userIP,
            latitude: userLocation?.lat,
            longitude: userLocation?.lon
          };
          await addAttendance(record);
          const template = templates.find(t => t.type === (delay > 0 ? 'late_check_in' : 'check_in'));
          setMessage({ text: template?.content.replace('{minutes}', delay.toString()) || 'تم تسجيل الدخول بنجاح', type: 'success' });
        }
      } else {
        if (!hasOpenRecord) {
          setMessage({ text: 'يرجى تسجيل الدخول أولاً.', type: 'error' });
        } else {
          const now = currentSyncedTime;

          // الخروج المبكر يطبق فقط على الإداريين
          const early = !isShiftWorker
            ? calculateEarlyDeparture(now, selectedCenter.defaultEndTime, selectedCenter.checkOutGracePeriod)
            : 0;

          const hours = calculateWorkingHours(new Date(recentRecord.checkIn!), now);

          await updateAttendance({
            ...recentRecord,
            checkOut: now.toISOString(),
            checkOutDate: format(now, 'yyyy-MM-dd'),
            earlyDepartureMinutes: early,
            workingHours: hours,
            latitude: userLocation?.lat,
            longitude: userLocation?.lon
          });
          const template = templates.find(t => t.type === (early > 0 ? 'early_check_out' : 'check_out'));
          setMessage({ text: template?.content.replace('{minutes}', early.toString()) || 'تم تسجيل الخروج بنجاح', type: 'success' });
        }
      }
      refreshData('attendance');
    } catch (err) {
      console.error(err);
      setMessage({ text: 'حدث خطأ في النظام، يرجى إعادة المحاولة.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissNotif = () => {
    if (activeNotification && selectedEmployeeId) {
      sessionStorage.setItem(`notif_seen_${activeNotification.id}_${selectedEmployeeId}`, 'true');
      setActiveNotification(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 md:p-8 font-cairo text-right relative overflow-hidden" dir="rtl">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-indigo-400/5 rounded-full blur-[80px]"></div>

      <div className="w-full max-w-2xl space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 relative z-10">
        {/* Unified Compact Header */}
        <div className="w-full bg-white/70 backdrop-blur-md rounded-[2rem] md:rounded-[2.5rem] p-3 md:p-4 border border-white/60 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] flex items-center justify-between gap-4">
          {/* Brand Area */}
          <div className="flex items-center gap-3 md:gap-5 mr-2">
            <div className={`shrink-0 overflow-hidden flex items-center justify-center ${settings.logoUrl
              ? 'w-12 h-12 md:w-16 md:h-16'
              : 'w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl shadow-lg shadow-indigo-100'
              }`}>
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-white" />
              )}
            </div>
            <div className="text-right">
              <h2 className="text-lg md:text-xl font-black text-slate-900 leading-tight">{settings.systemName || 'Relief Experts'}</h2>
              <p className="text-[10px] md:text-sm font-black text-indigo-600/90 leading-none">خبراء الإغاثة</p>
            </div>
          </div>

          {/* Clock & Date Area */}
          <div className="flex flex-col items-center md:items-end justify-center ml-2 border-r pr-4 border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-black text-slate-900 tabular-nums">
                {format(currentTime, 'HH:mm')}
              </span>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-400">
              {format(currentTime, 'EEEE، dd MMMM', { locale: ar })}
            </p>
          </div>
        </div>

        {/* Status Badges Overlay */}
        <div className="flex justify-center gap-3 -mt-3 relative z-20">
          {isTimeSynced && (
            <div className="px-3 py-1 bg-emerald-50/80 backdrop-blur-sm border border-emerald-100/50 rounded-full shadow-sm flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-emerald-700 uppercase">GMT+3 Synced</span>
            </div>
          )}
          <div className={`px-3 py-1 backdrop-blur-sm border rounded-full shadow-sm flex items-center gap-1.5 ${locationStatus === 'active' ? 'bg-indigo-50/80 border-indigo-100/50 text-indigo-700' :
            'bg-rose-50/80 border-rose-100/50 text-rose-700'
            }`}>
            <Navigation className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase">{locationStatus === 'active' ? 'GPS Active' : 'GPS Inactive'}</span>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white/80 backdrop-blur-xl p-8 md:p-14 rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-white/80 space-y-8 md:space-y-12 relative overflow-hidden transition-all hover:shadow-[0_50px_120px_-30px_rgba(0,0,0,0.15)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full -translate-y-16 translate-x-16"></div>

          {ipLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-8">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-100 rounded-full animate-ping absolute opacity-40"></div>
                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin relative z-10" />
              </div>
              <p className="text-base font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">جاري المصادقة الأمنية...</p>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-10 animate-in fade-in slide-in-from-top-6 duration-1000">
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="block text-[11px] font-black text-slate-400 uppercase mr-6 tracking-widest flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" /> المركز الميداني
                  </label>
                  <div className="relative group/input">
                    {matchedCenter ? (
                      <div className="w-full px-8 py-5 bg-indigo-50/50 border-2 border-indigo-100/80 rounded-[2rem] text-indigo-900 font-black flex items-center gap-4 shadow-sm animate-in zoom-in-95 duration-500">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md">
                          <ShieldCheck className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-indigo-500 uppercase tracking-widest mb-0.5">المركز المكتشف تلقائياً</span>
                          <span className="text-xl md:text-2xl">{matchedCenter.name}</span>
                        </div>
                        <div className="mr-auto px-4 py-1.5 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider shadow-lg shadow-indigo-200 hidden md:block">
                          Secure Connection
                        </div>
                      </div>
                    ) : (
                      <div className="w-full px-8 py-8 md:py-10 bg-rose-50/50 border-2 border-rose-100 border-dashed rounded-[2.5rem] flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center shadow-sm text-rose-500 border border-rose-50">
                          <WifiOff className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-rose-900 font-black text-lg">الشبكة غير معروفة</h4>
                          <p className="text-rose-600/70 font-bold text-xs md:text-sm max-w-xs mx-auto leading-relaxed">يرجى الاتصال بشبكة الإنترنت الخاصة بالمركز (Wi-Fi) لتتمكن من تسجيل حضورك.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {matchedCenter && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-700 delay-300">
                    <label className="block text-[11px] font-black text-slate-400 uppercase mr-6 tracking-widest flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-indigo-500" /> هوية الموظف
                    </label>
                    <div className="relative group">
                      <User className="w-6 h-6 absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 z-10 group-focus-within:text-indigo-600 transition-colors" />
                      <select
                        value={selectedEmployeeId}
                        onChange={(e) => { setSelectedEmployeeId(e.target.value); setMessage(null); }}
                        className="w-full pr-16 pl-10 py-5.5 md:py-6 bg-white border-2 border-slate-100 rounded-[2rem] text-slate-900 font-black appearance-none focus:border-indigo-600 focus:bg-white outline-none transition-all cursor-pointer text-base md:text-lg shadow-sm hover:border-slate-200"
                      >
                        <option value="">ابحث عن اسمك في القائمة...</option>
                        {employees
                          .filter(e => e.centerId === selectedCenterId && e.isActive)
                          .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))
                        }
                      </select>
                      <ChevronDown className="w-6 h-6 absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:rotate-180 transition-transform duration-300" />
                    </div>
                  </div>
                )}
              </div>

              {matchedCenter && (
                <div className="flex flex-col md:flex-row gap-5 md:gap-6 pt-4 animate-in fade-in slide-in-from-top-4 duration-700 delay-500">
                  <button
                    onClick={() => handleAction('in')}
                    disabled={!selectedEmployeeId || isSubmitting}
                    className="flex-1 group relative overflow-hidden rounded-[2.2rem] transition-all active:scale-[0.98] disabled:opacity-30"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-700 group-hover:from-emerald-600 group-hover:to-emerald-800 transition-all"></div>
                    <div className="relative px-8 py-6 md:py-9 flex flex-col items-center gap-3 text-white shadow-xl shadow-emerald-200">
                      {isSubmitting ? <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin" /> : <LogIn className="w-8 h-8 md:w-10 md:h-10 mb-1" />}
                      <span className="text-xs md:text-sm uppercase tracking-[0.2em] font-black">تسجيل حضور العمل</span>
                      <div className="w-8 h-1 bg-white/30 rounded-full group-hover:w-16 transition-all duration-500"></div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleAction('out')}
                    disabled={!selectedEmployeeId || isSubmitting}
                    className="flex-1 group relative overflow-hidden rounded-[2.2rem] transition-all active:scale-[0.98] disabled:opacity-30"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-700 group-hover:from-indigo-600 group-hover:to-indigo-800 transition-all"></div>
                    <div className="relative px-8 py-6 md:py-9 flex flex-col items-center gap-3 text-white shadow-xl shadow-indigo-200">
                      {isSubmitting ? <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin" /> : <LogOut className="w-8 h-8 md:w-10 md:h-10 mb-1" />}
                      <span className="text-xs md:text-sm uppercase tracking-[0.2em] font-black">تسجيل انصراف العمل</span>
                      <div className="w-8 h-1 bg-white/30 rounded-full group-hover:w-16 transition-all duration-500"></div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {message && (
            <div className={`p-6 md:p-8 rounded-[2.5rem] border-2 shadow-sm animate-in zoom-in-95 duration-700 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100/50 text-emerald-800' :
              message.type === 'security' ? 'bg-rose-50 border-rose-100/50 text-rose-800' :
                'bg-amber-50 border-amber-100/50 text-amber-800'
              }`}>
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0 ${message.type === 'success' ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">تنبيه النظام</p>
                  <p className="text-base md:text-lg font-black leading-relaxed">{message.text}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-10 py-6 bg-white/40 backdrop-blur-sm rounded-[2rem] border border-white/60 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={`w-3.5 h-3.5 rounded-full shadow-lg ${ipLoading ? 'bg-slate-300 animate-pulse' :
              matchedCenter ? 'bg-emerald-500 shadow-emerald-200 animate-pulse' :
                'bg-amber-400 shadow-amber-200'
              }`}></div>
            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">
              {ipLoading ? 'جاري التحقق...' : matchedCenter ? 'اتصال آمن وموثق شبكياً' : 'وضعية الوصول المرن مفعلة'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>
            <Globe className={`w-5 h-5 ${matchedCenter ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              {matchedCenter ? `IP: ${userIP}` : 'Dynamic Network'}
            </span>
          </div>
        </div>
      </div>

      {activeNotification && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-700">
          <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] w-full max-w-lg shadow-[0_50px_100px_-20px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-8 md:p-12 text-center space-y-6 md:space-y-8">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-indigo-50 text-indigo-600 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
                <BellRing className="w-10 h-10 md:w-12 md:h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{activeNotification.title}</h3>
                <p className="text-[9px] md:text-[10px] text-indigo-600 font-black uppercase tracking-[0.3em]">إدارة شؤون الموظفين</p>
              </div>
              <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-inner">
                <p className="text-slate-600 font-bold leading-loose text-base md:text-lg">{activeNotification.message}</p>
              </div>
              <button
                onClick={handleDismissNotif}
                className="w-full bg-slate-900 text-white font-black py-5 md:py-6 rounded-2xl md:rounded-[2.5rem] hover:bg-black transition-all flex items-center justify-center gap-3 uppercase text-[10px] md:text-xs tracking-widest active:scale-95 shadow-xl shadow-slate-900/20"
              >
                <Check className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" /> قرأت وأوافق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePublic;
