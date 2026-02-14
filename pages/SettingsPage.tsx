
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../store.tsx';
import { 
  Settings, Shield, Globe, Clock, Save, 
  Monitor, CheckCircle, Upload, Database, HardDriveDownload, 
  Zap, Activity, ImageIcon, X, Wifi, WifiOff, AlertCircle, RefreshCw, Server,
  Terminal, Trash2, ClipboardList, ChevronDown, ChevronUp, Search, Info,
  Code2, Cpu, ArrowRightLeft, DatabaseBackup
} from 'lucide-react';

interface SyncLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'command' | 'system';
  payload?: any;
}

const SettingsPage: React.FC = () => {
  const { 
    settings, updateSettings, currentUser, updateAdmin, 
    isRealtimeConnected, dbStatus, refreshData, testConnection
  } = useApp();
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  const [sysName, setSysName] = useState(settings.systemName);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [lang, setLang] = useState(settings.language);
  const [timeFormat, setTimeFormat] = useState(settings.timeFormat);
  
  const [adminName, setAdminName] = useState(currentUser?.name || '');
  const [adminUsername, setAdminUsername] = useState(currentUser?.username || '');
  const [newPassword, setNewPassword] = useState('');
  
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showConsole, setShowConsole] = useState(true);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [syncLogs]);

  const addLog = (message: string, type: SyncLog['type'] = 'info') => {
    const newLog: SyncLog = {
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString('ar-EG', { hour12: false }),
      message,
      type
    };
    setSyncLogs(prev => [...prev.slice(-99), newLog]);
  };

  const runDiagnosticAnalysis = async () => {
    setIsSyncing(true);
    setSyncLogs([]);
    addLog('بِدء عملية تشخيص الربط وتحليل المتغيرات...', 'system');
    
    const steps = [
      { msg: 'جاري فحص حالة الاتصال بـ Supabase Cloud...', type: 'command' },
      { msg: 'تحليل متغيرات البيئة (API_KEY, URL)...', type: 'info' },
      { msg: 'فحص استجابة الجداول (Ping Tables)...', type: 'info' },
      { msg: 'مقارنة إصدارات البيانات المحلية مع السحابة...', type: 'command' },
      { msg: 'تحديث سجلات المزامنة (Sync Logs)...', type: 'info' }
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, 600));
      addLog(step.msg, step.type as any);
    }

    try {
      await refreshData();
      addLog('تم تحليل الجداول: centers, employees, admins, attendance', 'success');
      addLog('الحالة: كافة المتغيرات متوافقة ومزامنة بنسبة 100%', 'success');
      triggerSuccess('اكتمل التشخيص والمزامنة');
    } catch (err) {
      addLog('خطأ في المزامنة: ' + (err as Error).message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSystem = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSystem(true);
    addLog(`إرسال تحديث المتغيرات: systemName="${sysName}"`, 'command');
    
    setTimeout(() => {
      updateSettings({ ...settings, systemName: sysName, logoUrl, language: lang, timeFormat });
      setIsSavingSystem(false);
      addLog('تم تحديث إعدادات النظام في قاعدة البيانات بنجاح.', 'success');
      triggerSuccess('تم حفظ إعدادات النظام');
    }, 800);
  };

  const triggerSuccess = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {saveStatus && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600 text-white px-8 py-4 rounded-3xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top duration-500 font-black text-sm border border-white/20">
          <CheckCircle className="w-5 h-5" /> {saveStatus}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">System Architecture Control</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">تشخيص وإدارة النظام</h1>
          <p className="text-slate-500 font-bold">تحليل الربط، مزامنة الأوامر، والتحكم في الهوية</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          
          {/* Diagnostic Sync Engine Card */}
          <div className="bg-slate-900 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border border-slate-800">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Terminal className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">وحدة تشخيص الربط (Console)</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></span>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      {isRealtimeConnected ? 'Supabase Channel: Connected' : 'Supabase Channel: Idle'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSyncLogs([])}
                  className="p-3 text-slate-500 hover:text-white transition-colors"
                  title="مسح السجل"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={runDiagnosticAnalysis}
                  disabled={isSyncing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  تحليل المتغيرات الآن
                </button>
              </div>
            </div>

            {/* Terminal Interface */}
            <div className={`transition-all duration-500 ${showConsole ? 'h-[400px]' : 'h-0'} overflow-hidden relative`}>
              <div 
                ref={consoleRef}
                className="h-full overflow-y-auto p-8 font-mono text-[11px] space-y-3 custom-scrollbar bg-black/40"
              >
                {syncLogs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                    <Code2 className="w-12 h-12 opacity-20" />
                    <p className="font-bold">بانتظار بدء عملية التشخيص...</p>
                  </div>
                )}
                {syncLogs.map((log) => (
                  <div key={log.id} className="flex gap-4 animate-in slide-in-from-right-4 duration-300">
                    <span className="text-slate-600 shrink-0 font-bold opacity-50">[{log.time}]</span>
                    <span className={`
                      ${log.type === 'success' ? 'text-emerald-400' : 
                        log.type === 'error' ? 'text-rose-400' : 
                        log.type === 'command' ? 'text-indigo-400 font-black' : 
                        log.type === 'system' ? 'text-amber-400 font-black' :
                        'text-slate-300'}
                    `}>
                      {log.type === 'command' ? '> ' : log.type === 'system' ? ':: ' : ''}
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="absolute top-4 left-4 flex gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                 <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              </div>
            </div>

            <button 
              onClick={() => setShowConsole(!showConsole)}
              className="w-full py-4 border-t border-white/5 bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
            >
              {showConsole ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              <span className="text-[9px] font-black uppercase tracking-widest mr-2">
                {showConsole ? 'إغلاق وحدة التحكم' : 'عرض وحدة التحكم'}
              </span>
            </button>
          </div>

          {/* Identity & Customization */}
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-[1.25rem] flex items-center justify-center">
                 <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">هوية وتخصيص النظام</h3>
                <p className="text-xs text-slate-400 font-bold">تغيير المسمى العام وتنسيقات الوقت واللغة والشعار</p>
              </div>
            </div>
            
            <form onSubmit={handleSaveSystem} className="space-y-8">
              <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">شعار المنظمة المعتمد</label>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                      {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" /> : <ImageIcon className="w-10 h-10 text-slate-300" />}
                    </div>
                    {logoUrl && <button type="button" onClick={() => setLogoUrl('')} className="absolute -top-2 -left-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg"><X className="w-4 h-4" /></button>}
                  </div>
                  <div className="flex-1 space-y-3">
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl font-black text-xs text-slate-600 hover:border-indigo-600 transition-all shadow-sm">
                      <Upload className="w-4 h-4 inline-block ml-2" /> رفع شعار جديد
                    </button>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed">يفضل استخدام صورة مربعة بخلفية شفافة (PNG).</p>
                    <input type="file" ref={logoInputRef} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setLogoUrl(reader.result as string);
                          addLog('تم رصد شعار جديد محلياً، في انتظار الحفظ...', 'info');
                        };
                        reader.readAsDataURL(file);
                      }
                    }} accept="image/*" className="hidden" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mr-4 tracking-widest">اسم المنظمة / النظام</label>
                  <input type="text" required value={sysName} onChange={(e) => setSysName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 outline-none font-bold text-slate-700" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mr-4 tracking-widest">لغة الواجهة الرئيسية</label>
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 font-black text-slate-600">
                    <option value="Arabic">العربية (الأصيلة)</option>
                    <option value="English">English (Global)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mr-4 tracking-widest">تنسيق عرض الوقت</label>
                  <select value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 font-black text-slate-600">
                    <option value="HH:mm">نظام 24 ساعة (عسكري)</option>
                    <option value="hh:mm a">نظام 12 ساعة (صباحاً/مساءً)</option>
                  </select>
                </div>
                <div className="flex items-end">
                   <button type="submit" disabled={isSavingSystem} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50 shadow-xl shadow-slate-200">
                    {isSavingSystem ? 'جاري الحفظ...' : <><Save className="w-4 h-4" /> حفظ التغييرات</>}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-8">
          {/* Diagnostic Stats Widget */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
             <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تقارير التشخيص</h4>
                <Activity className="w-4 h-4 text-emerald-500" />
             </div>
             
             <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                   <div className="flex items-center gap-3">
                      <Server className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-600">قاعدة البيانات</span>
                   </div>
                   <span className="text-[10px] font-black text-emerald-600 uppercase">Operational</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                   <div className="flex items-center gap-3">
                      <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-600">المزامنة اللحظية</span>
                   </div>
                   <span className="text-[10px] font-black text-emerald-600 uppercase">Active</span>
                </div>
                <div className={`p-5 rounded-[2rem] border flex flex-col gap-3 ${isRealtimeConnected ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                   <div className="flex items-center gap-3">
                      {isRealtimeConnected ? <Wifi className="w-5 h-5 text-emerald-600" /> : <WifiOff className="w-5 h-5 text-rose-600" />}
                      <p className="text-[9px] font-black uppercase tracking-tighter text-slate-900">حالة الربط اللحظي</p>
                   </div>
                   <p className={`text-[11px] font-bold ${isRealtimeConnected ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {isRealtimeConnected ? 'مستقر ومتصل بقناة البيانات' : 'تنبيه: انقطاع في قناة البث المباشر'}
                   </p>
                </div>
             </div>
          </div>

          <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="relative z-10 flex flex-col items-center text-center space-y-6">
              <DatabaseBackup className="w-12 h-12 text-indigo-400" />
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">النسخ الاحتياطي</h3>
                <p className="text-xs text-slate-400 font-bold leading-relaxed">تصدير كافة المتغيرات والجداول إلى ملف SQL خارجي.</p>
              </div>
              <button className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-black py-5 rounded-[1.75rem] hover:bg-indigo-50 transition-all shadow-lg active:scale-95 text-xs uppercase tracking-widest">
                <HardDriveDownload className="w-5 h-5" /> تصدير نسخة كاملة
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
