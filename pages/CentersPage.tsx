import React, { useState } from 'react';
import { useApp } from '../store';
import { Building2, Plus, Edit2, Trash2, X, Clock, Wifi, MapPin, Users, Power, PowerOff, ShieldCheck, Navigation, Crosshair, RefreshCw } from 'lucide-react';
import { Center } from '../types';

const CentersPage: React.FC = () => {
  const { centers, employees, addCenter, updateCenter, deleteCenter } = useApp();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);

  const [name, setName] = useState('');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('16:00');
  const [checkInGrace, setCheckInGrace] = useState(0);
  const [checkOutGrace, setCheckOutGrace] = useState(0);
  const [ip, setIp] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [radius, setRadius] = useState<number>(50);
  const [isActive, setIsActive] = useState(true);
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]); // الأحد-الخميس افتراضياً
  const [isLocating, setIsLocating] = useState(false);

  const handleOpenAdd = () => {
    setEditingCenter(null);
    setName(''); setStart('08:00'); setEnd('16:00');
    setCheckInGrace(0); setCheckOutGrace(0);
    setIp(''); setLatitude(undefined); setLongitude(undefined); setRadius(50);
    setIsActive(true);
    setWorkingDays([0, 1, 2, 3, 4]);
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Center) => {
    setEditingCenter(c);
    setName(c.name);
    setStart(c.defaultStartTime);
    setEnd(c.defaultEndTime);
    setCheckInGrace(c.checkInGracePeriod || 0);
    setCheckOutGrace(c.checkOutGracePeriod || 0);
    setIp(c.authorizedIP || '');
    setLatitude(c.latitude);
    setLongitude(c.longitude);
    setRadius(c.radiusMeters || 50);
    setIsActive(c.isActive);
    setWorkingDays(c.workingDays || [0, 1, 2, 3, 4]);
    setModalOpen(true);
  };

  const getCurrentLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setIsLocating(false);
      },
      (err) => {
        alert('فشل في تحديد الموقع. يرجى تفعيل الـ GPS في متصفحك.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const toggleCenterStatus = (center: Center) => {
    updateCenter({ ...center, isActive: !center.isActive });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const centerData = {
      id: editingCenter?.id || crypto.randomUUID(),
      name,
      defaultStartTime: start,
      defaultEndTime: end,
      checkInGracePeriod: Number(checkInGrace),
      checkOutGracePeriod: Number(checkOutGrace),
      authorizedIP: ip,
      latitude,
      longitude,
      radiusMeters: radius,
      isActive,
      workingDays
    };

    if (editingCenter) {
      updateCenter(centerData);
    } else {
      addCenter(centerData);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">إدارة المراكز الميدانية</h1>
          <p className="text-slate-500 font-bold">تحديد مواقع التشغيل، قيود الشبكة، والمواعيد الرسمية لكل فرع</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
        >
          <Plus className="w-5 h-5" /> إضافة مركز تشغيل
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {centers.map((center) => {
          const activeEmps = employees.filter(e => e.centerId === center.id).length;
          return (
            <div key={center.id} className={`bg-white rounded-[2.5rem] shadow-sm border transition-all group overflow-hidden relative ${!center.isActive ? 'grayscale opacity-60' : 'hover:shadow-2xl hover:translate-y-[-4px]'}`}>
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform ${center.isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <Building2 className="w-8 h-8" />
                  </div>
                  <div className="flex gap-1.5 bg-slate-50 p-1.5 rounded-2xl">
                    <button
                      onClick={() => toggleCenterStatus(center)}
                      className={`p-2.5 rounded-xl transition-all shadow-sm ${center.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-rose-600 hover:bg-rose-50'}`}
                      title={center.isActive ? 'إيقاف التفعيل' : 'تفعيل المركز'}
                    >
                      {center.isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleOpenEdit(center)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteCenter(center.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all shadow-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-black text-slate-900">{center.name}</h3>
                  {!center.isActive && <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-black rounded uppercase">متوقف حالياً</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4">
                  <MapPin className="w-3 h-3 text-indigo-500" /> {center.latitude ? `${center.latitude.toFixed(4)}, ${center.longitude?.toFixed(4)}` : 'الموقع الجغرافي غير محدد'}
                </div>

                <div className="flex flex-wrap gap-1 mb-8">
                  {['أحد', 'اثن', 'ثلا', 'أرب', 'خميس', 'جمع', 'سبت'].map((day, idx) => (
                    <span key={idx} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${center.workingDays?.includes(idx) ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-300'}`}>
                      {day}
                    </span>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Clock className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">دوام الموظفين</p>
                        <p className="text-xs font-black text-slate-800 tracking-widest">{center.defaultStartTime} - {center.defaultEndTime}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter mb-1">سماحية الحضور</p>
                      <p className="text-xs font-black text-indigo-600">{center.checkInGracePeriod || 0} دقيقة</p>
                    </div>
                    <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                      <p className="text-[9px] font-black text-rose-400 uppercase tracking-tighter mb-1">سماحية الانصراف</p>
                      <p className="text-xs font-black text-rose-600">{center.checkOutGracePeriod || 0} دقيقة</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm text-emerald-600">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">سياج جغرافي</p>
                        <p className="text-xs font-black text-slate-800">{center.latitude ? `نطاق ${center.radiusMeters}م` : 'غير مفعل'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-black text-slate-600">{activeEmps} موظف</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${center.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-white/20 my-auto">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">{editingCenter ? 'تعديل بيانات المركز' : 'فتح وحدة تشغيل جديدة'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Operational Center Settings</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">مسمى المركز</label>
                  <input
                    type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700"
                    placeholder="اسم المركز أو الفرع"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">وقت بدء العمل</label>
                    <input
                      type="time" required value={start} onChange={(e) => setStart(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-700"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">وقت نهاية العمل</label>
                    <input
                      type="time" required value={end} onChange={(e) => setEnd(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">سماحية الحضور (بالدقائق)</label>
                    <input
                      type="number" min="0" required value={checkInGrace} onChange={(e) => setCheckInGrace(Number(e.target.value))}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-700"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">سماحية الانصراف (بالدقائق)</label>
                    <input
                      type="number" min="0" required value={checkOutGrace} onChange={(e) => setCheckOutGrace(Number(e.target.value))}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-700"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest">إعدادات الموقع الجغرافي (Geofencing)</label>
                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={isLocating}
                      className="text-xs font-black text-indigo-600 flex items-center gap-1 hover:underline"
                    >
                      {/* Fixed: Use RefreshCw from lucide-react */}
                      {isLocating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
                      جلب موقعي الحالي
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400">خط العرض (Latitude)</span>
                      <input
                        type="number" step="any" value={latitude || ''} onChange={(e) => setLatitude(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700"
                        placeholder="مثال: 36.2021"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400">خط الطول (Longitude)</span>
                      <input
                        type="number" step="any" value={longitude || ''} onChange={(e) => setLongitude(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700"
                        placeholder="مثال: 37.1343"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400">نطاق السماحية (أمتار)</span>
                    <input
                      type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700"
                      placeholder="افتراضي: 50 متر"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 mr-2 tracking-widest">أيام العمل الأسبوعية</label>
                  <div className="grid grid-cols-7 gap-2">
                    {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((day, idx) => {
                      const isSelected = workingDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isSelected) setWorkingDays(workingDays.filter(d => d !== idx));
                            else setWorkingDays([...workingDays, idx].sort());
                          }}
                          className={`h-10 rounded-xl font-black text-xs transition-all border-2 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">تقييد الشبكة (IP Address)</label>
                  <div className="relative">
                    <Wifi className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text"
                      placeholder="اتركه فارغاً لفتح الوصول"
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                      className="w-full pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-700 text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="submit" className="flex-2 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex-grow uppercase text-xs tracking-widest">
                  حفظ بيانات المركز
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs tracking-widest">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CentersPage;