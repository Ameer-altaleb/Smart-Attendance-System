
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { 
  Send, Bell, User, Building2, Users, Search, Filter, X, 
  CheckCircle, Clock, LayoutGrid, Trash2, Info, Loader2, 
  AlertCircle, MessageSquare, ArrowLeftRight, Check, History
} from 'lucide-react';
import { Notification } from '../types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const NotificationsPage: React.FC = () => {
  const { notifications, addNotification, deleteNotification, employees, centers, currentUser, refreshData } = useApp();
  const [isModalOpen, setModalOpen] = useState(false);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'center' | 'employee' | 'system'>('all');

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'center' | 'employee'>('all');
  const [targetId, setTargetId] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Filtered Notifications Logic
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            n.message.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = activeFilter === 'all' || 
                           (activeFilter === 'system' && n.targetType === 'all') ||
                           n.targetType === activeFilter;
      return matchesSearch && matchesFilter;
    }).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [notifications, searchTerm, activeFilter]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message || (targetType !== 'all' && !targetId)) {
      alert('يرجى إكمال كافة البيانات المطلوبة قبل الإرسال.');
      return;
    }

    setIsSending(true);

    try {
      const newNotification: Notification = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        message,
        targetType,
        targetId,
        senderName: currentUser?.name || 'الإدارة المركزية',
        sentAt: new Date().toISOString()
      };

      await addNotification(newNotification);
      
      // Reset and Close
      setTitle(''); 
      setMessage(''); 
      setTargetType('all'); 
      setTargetId('');
      setModalOpen(false);
      
      // Refresh to ensure sync
      await refreshData('notifications');
    } catch (err) {
      alert('فشل في إرسال الإشعار، يرجى التحقق من اتصال الإنترنت.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('تنبيه: هل أنت متأكد من حذف هذا الإشعار نهائياً؟ لن يظهر للموظفين بعد الآن.')) {
      try {
        await deleteNotification(id);
        await refreshData('notifications');
      } catch (err) {
        alert('فشل الحذف، يرجى المحاولة مرة أخرى.');
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">مركز الإشعارات المباشرة</h1>
          <p className="text-slate-500 font-bold">بث التعاميم والرسائل الإدارية التي تظهر للموظفين فوراً</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 shrink-0"
        >
          <Bell className="w-5 h-5" /> إنشاء تعميم جديد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Search & History Column */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Real Search & Filter Bar */}
          <div className="bg-white p-4 md:p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 group w-full">
              <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <input 
                type="text" 
                placeholder="ابحث في سجل الرسائل..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-12 pl-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:bg-white transition-all font-bold text-slate-700"
              />
            </div>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-full md:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide">
              {[
                { id: 'all', label: 'الكل', icon: History },
                { id: 'system', label: 'عام', icon: LayoutGrid },
                { id: 'center', label: 'مراكز', icon: Building2 },
                { id: 'employee', label: 'موظفين', icon: User }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as any)}
                  className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 ${
                    activeFilter === filter.id 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <filter.icon className="w-3.5 h-3.5" /> {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-4">
            {filteredNotifications.map((notif) => {
              const targetName = notif.targetType === 'all' 
                ? 'كافة الكوادر الميدانية' 
                : notif.targetType === 'center' 
                  ? centers.find(c => c.id === notif.targetId)?.name || 'مركز غير معروف'
                  : employees.find(e => e.id === notif.targetId)?.name || 'موظف غير معروف';

              return (
                <div key={notif.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden animate-in slide-in-from-bottom-2">
                  <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:rotate-3 transition-transform ${
                      notif.targetType === 'all' ? 'bg-indigo-50 text-indigo-600' :
                      notif.targetType === 'center' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {notif.targetType === 'all' ? <Users className="w-7 h-7" /> :
                       notif.targetType === 'center' ? <Building2 className="w-7 h-7" /> :
                       <User className="w-7 h-7" />}
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-black text-slate-900 text-lg leading-none">{notif.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                            <span className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1">
                              <User className="w-3 h-3" /> {notif.senderName}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {format(new Date(notif.sentAt), 'hh:mm a • dd MMMM', { locale: ar })}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                               notif.targetType === 'all' ? 'bg-indigo-100 text-indigo-700' :
                               notif.targetType === 'center' ? 'bg-emerald-100 text-emerald-700' :
                               'bg-amber-100 text-amber-700'
                            }`}>
                               المستهدف: {targetName}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDelete(notif.id)}
                          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                         <p className="text-sm text-slate-600 font-bold leading-relaxed">{notif.message}</p>
                      </div>

                      <div className="flex items-center gap-4 pt-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                           <CheckCircle className="w-3.5 h-3.5" /> الإشعار فعال حالياً
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredNotifications.length === 0 && (
              <div className="py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 text-center space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                  <MessageSquare className="w-12 h-12" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-slate-500 font-black text-lg">لم يتم العثور على إشعارات</p>
                  <p className="text-[10px] text-slate-300 font-bold uppercase mt-1 leading-relaxed">جرب تغيير معايير البحث أو الفلترة أو أضف إشعاراً جديداً</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Statistics & Instructions */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
             <div className="relative z-10 space-y-5">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Info className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-black">آلية عمل التعاميم</h3>
                <p className="text-slate-400 text-xs font-bold leading-relaxed">
                  عند بث إشعار، يظهر للموظف المستهدف كـ "نافذة إجبارية" في واجهة الحضور. يضمن النظام أن الموظف لن يستطيع تسجيل حضوره إلا بعد تأكيد قراءة التعميم.
                </p>
                <div className="space-y-3 pt-2">
                  {[
                    { label: 'ضمان القراءة الكاملة', color: 'indigo' },
                    { label: 'تخصيص حسب المراكز', color: 'emerald' },
                    { label: 'أرشفة آلية للرسائل', color: 'amber' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                       <div className={`w-1.5 h-1.5 rounded-full bg-${item.color}-500 shadow-[0_0_8px_rgba(var(--tw-color-${item.color}-500),0.5)]`}></div>
                       <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{item.label}</span>
                    </div>
                  ))}
                </div>
             </div>
             <div className="absolute -right-16 -bottom-16 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl group-hover:bg-indigo-600/20 transition-all"></div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-4">إحصائيات الإشعارات</h4>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <p className="text-2xl font-black text-slate-900">{notifications.length}</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase mt-1">إجمالي المراسلات</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <p className="text-2xl font-black text-indigo-600">{notifications.filter(n => n.targetType === 'all').length}</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase mt-1">تعاميم عامة</p>
                </div>
             </div>
             <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <History className="w-5 h-5 text-emerald-600" />
                <div>
                   <p className="text-[9px] font-black text-emerald-700 uppercase">آخر تحديث للمزامنة</p>
                   <p className="text-[10px] font-bold text-emerald-900">{format(new Date(), 'hh:mm:ss a')}</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Modern Add Notification Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden border border-white/20 my-auto">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">إنشاء تعميم ذكي</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">New Administrative Broadcast</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSend} className="p-8 space-y-6">
              <div className="space-y-5">
                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">عنوان التعميم</label>
                  <div className="relative">
                    <MessageSquare className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                      className="w-full pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700"
                      placeholder="مثال: تعليمات صرف المستحقات الميدانية"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">نطاق البث</label>
                    <div className="relative">
                      <ArrowLeftRight className="w-4 h-4 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <select
                        value={targetType} onChange={(e) => { setTargetType(e.target.value as any); setTargetId(''); }}
                        className="w-full pr-12 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-600 appearance-none"
                      >
                        <option value="all">كافة الموظفين والمراكز</option>
                        <option value="center">مركز ميداني محدد</option>
                        <option value="employee">موظف بعينه</option>
                      </select>
                    </div>
                  </div>
                  
                  {targetType !== 'all' && (
                    <div className="group animate-in slide-in-from-right-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">
                        {targetType === 'center' ? 'تحديد المركز' : 'تحديد الموظف'}
                      </label>
                      <select
                        required value={targetId} onChange={(e) => setTargetId(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-600 appearance-none"
                      >
                        <option value="">-- اختر من القائمة --</option>
                        {targetType === 'center' 
                          ? centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                          : employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)
                        }
                      </select>
                    </div>
                  )}
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">محتوى الرسالة (تظهر بوضوح للمستلم)</label>
                  <textarea
                    required rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700 resize-none"
                    placeholder="اكتب التعليمات الرسمية هنا، سيتم تنسيقها تلقائياً للموظف..."
                  ></textarea>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit" 
                  disabled={isSending}
                  className="flex-2 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex-grow uppercase text-xs tracking-widest disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> بث التعميم فوراً</>}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs tracking-widest">
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
