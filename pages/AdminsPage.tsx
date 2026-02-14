
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { 
  UserCog, Plus, Edit2, Trash2, X, Shield, Key, Mail, User, 
  ShieldCheck, Lock, Building2, Check, Ban, Unlock, ShieldAlert,
  Eye, EyeOff, Loader2, Save
} from 'lucide-react';
import { Admin, UserRole } from '../types';

const AdminsPage: React.FC = () => {
  const { admins, addAdmin, updateAdmin, deleteAdmin, currentUser, centers } = useApp();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CENTER_MANAGER);
  const [managedCenterIds, setManagedCenterIds] = useState<string[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);

  // حساب المشرف الأعلى الثابت (Root) - لا يمكن حذفه أو حظره
  const ROOT_ADMIN_USERNAME = 'aaltaleb@reliefexperts.org';

  if (currentUser?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center shadow-inner">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">غير مصرح لك بالوصول</h2>
        <p className="text-slate-500 font-bold max-w-md text-center">هذه الصفحة مخصصة للمشرف الأعلى للنظام فقط لإدارة الحسابات وكلمات السر.</p>
      </div>
    );
  }

  const handleOpenAdd = () => {
    setEditingAdmin(null);
    setName(''); setUsername(''); setPassword(''); setRole(UserRole.CENTER_MANAGER); 
    setManagedCenterIds([]); setIsBlocked(false); setShowPassword(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setName(admin.name);
    setUsername(admin.username);
    setPassword(admin.password || '');
    setRole(admin.role);
    setManagedCenterIds(admin.managedCenterIds || []);
    setIsBlocked(admin.isBlocked || false);
    setShowPassword(false);
    setModalOpen(true);
  };

  const toggleCenter = (id: string) => {
    setManagedCenterIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleToggleBlock = async (admin: Admin) => {
    if (admin.username === ROOT_ADMIN_USERNAME) {
      alert('حماية النظام: لا يمكن حظر حساب المشرف الرئيسي.');
      return;
    }
    await updateAdmin({ ...admin, isBlocked: !admin.isBlocked });
  };

  const handleDeleteAdmin = async (id: string, adminUsername: string) => {
    if (adminUsername === ROOT_ADMIN_USERNAME) {
      alert('حماية النظام: لا يمكن حذف حساب المشرف الأعلى الرئيسي.');
      return;
    }
    if (id === currentUser?.id) {
      alert('لا يمكنك حذف حسابك الشخصي أثناء تسجيل الدخول.');
      return;
    }
    if (confirm('هل أنت متأكد من حذف هذا الحساب نهائياً؟')) {
      await deleteAdmin(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !password) {
      alert('يرجى ملء جميع الحقول المطلوبة بما في ذلك كلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    try {
      const adminData: Admin = {
        id: editingAdmin?.id || Math.random().toString(36).substr(2, 9),
        name,
        username: username.trim().toLowerCase(),
        password,
        role,
        managedCenterIds: role === UserRole.SUPER_ADMIN ? [] : managedCenterIds,
        isBlocked: editingAdmin ? isBlocked : false
      };

      if (editingAdmin) {
        await updateAdmin(adminData);
      } else {
        await addAdmin(adminData);
      }
      setModalOpen(false);
    } catch (err) {
      alert('حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">صلاحيات الوصول</h1>
          <p className="text-slate-500 font-bold">إدارة حسابات المدراء وتعديل كلمات السر والصلاحيات</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
        >
          <Plus className="w-5 h-5" /> إضافة حساب جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {admins.map((admin) => (
          <div key={admin.id} className={`bg-white rounded-[2.5rem] shadow-sm border-2 transition-all group overflow-hidden relative ${
            admin.isBlocked ? 'opacity-60 border-rose-100 grayscale' : 
            admin.username === ROOT_ADMIN_USERNAME ? 'border-indigo-100' : 'border-slate-50'
          } hover:shadow-2xl hover:border-indigo-200`}>
            
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:rotate-6 ${
                   admin.username === ROOT_ADMIN_USERNAME ? 'bg-slate-900 text-white' : 
                   admin.id === currentUser?.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  <Shield className="w-7 h-7" />
                </div>
                <div className="flex gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  {admin.username !== ROOT_ADMIN_USERNAME && (
                    <button 
                      onClick={() => handleToggleBlock(admin)} 
                      className={`p-2 rounded-xl transition-all shadow-sm ${admin.isBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-rose-600 hover:bg-rose-50'}`}
                      title={admin.isBlocked ? 'تفعيل الدخول' : 'تعطيل الدخول'}
                    >
                      {admin.isBlocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => handleOpenEdit(admin)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {admin.username !== ROOT_ADMIN_USERNAME && admin.id !== currentUser?.id && (
                    <button onClick={() => handleDeleteAdmin(admin.id, admin.username)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-900">{admin.name}</h3>
                  {admin.username === ROOT_ADMIN_USERNAME && <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded uppercase">ROOT</span>}
                </div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {admin.username}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`inline-flex px-3 py-1 text-[9px] font-black rounded-full uppercase border ${
                    admin.role === UserRole.SUPER_ADMIN ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {admin.role === UserRole.SUPER_ADMIN ? 'Super Admin' : admin.role === UserRole.GENERAL_MANAGER ? 'General Manager' : 'Center Manager'}
                  </span>
                  {admin.isBlocked && (
                    <span className="inline-flex px-3 py-1 bg-rose-100 text-rose-600 text-[9px] font-black rounded-full uppercase border border-rose-200">
                      Blocked
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-50">
                 <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-slate-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">كلمة السر المخزنة: </span>
                    <span className="text-xs font-black text-slate-700">••••••••</span>
                 </div>
                 
                 {admin.role !== UserRole.SUPER_ADMIN && (
                   <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> المراكز المخصصة ({admin.managedCenterIds?.length || 0})
                      </p>
                      <div className="flex flex-wrap gap-1">
                         {admin.managedCenterIds?.map(cid => (
                           <span key={cid} className="px-2 py-1 bg-slate-50 text-slate-600 text-[8px] font-black rounded-lg border border-slate-100">
                              {centers.find(c => c.id === cid)?.name || 'Unknown'}
                           </span>
                         ))}
                         {(!admin.managedCenterIds || admin.managedCenterIds.length === 0) && (
                           <span className="text-[9px] text-slate-300 font-bold italic">كامل الصلاحية</span>
                         )}
                      </div>
                   </div>
                 )}
              </div>
            </div>

            <div className={`px-8 py-3 text-center border-t ${
              admin.isBlocked ? 'bg-rose-50 border-rose-100 text-rose-600' : 
              admin.id === currentUser?.id ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'
            }`}>
               <span className="text-[10px] font-black uppercase tracking-widest">
                 {admin.isBlocked ? 'حساب معلق' : admin.id === currentUser?.id ? 'جلستك الحالية' : 'حساب نشط'}
               </span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/20 my-auto">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">{editingAdmin ? 'تحديث بيانات الحساب' : 'إضافة حساب جديد'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">تأكد من اختيار كلمة سر قوية</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">الاسم بالكامل</label>
                    <div className="relative">
                      <User className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text" required value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700"
                        placeholder="الاسم الحقيقي للمدير"
                      />
                    </div>
                  </div>
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">البريد الإلكتروني (اسم المستخدم)</label>
                    <div className="relative">
                      <Mail className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="email" required value={username} onChange={(e) => setUsername(e.target.value)}
                        className="w-full pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700 text-left"
                        dir="ltr"
                        placeholder="example@reliefexperts.org"
                        disabled={editingAdmin?.username === ROOT_ADMIN_USERNAME}
                      />
                    </div>
                  </div>
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">كلمة السر الحقيقية</label>
                    <div className="relative">
                      <Key className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pr-14 pl-14 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700 text-left"
                        dir="ltr"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">نوع الحساب والصلاحية</label>
                    <select
                      value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                      disabled={editingAdmin?.username === ROOT_ADMIN_USERNAME}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-600 appearance-none disabled:opacity-50"
                    >
                      <option value={UserRole.SUPER_ADMIN}>مشرف أعلى (كامل الصلاحيات)</option>
                      <option value={UserRole.GENERAL_MANAGER}>مدير عام (تقارير وإدارة مراكز)</option>
                      <option value={UserRole.CENTER_MANAGER}>مدير مركز (حضور وانصراف فقط)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">المراكز المخصصة (لغير المشرفين)</label>
                  <div className={`p-4 bg-slate-50 rounded-3xl border-2 border-slate-100 space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar ${role === UserRole.SUPER_ADMIN ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                    {role === UserRole.SUPER_ADMIN ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                        <ShieldCheck className="w-10 h-10 text-indigo-200" />
                        <p className="text-[10px] font-black text-slate-400 italic uppercase">المشرف الأعلى يملك حق الوصول<br/>لجميع المراكز تلقائياً</p>
                      </div>
                    ) : (
                      centers.map(center => (
                        <button
                          key={center.id}
                          type="button"
                          onClick={() => toggleCenter(center.id)}
                          className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border-2 ${
                            managedCenterIds.includes(center.id) 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                            : 'bg-white text-slate-600 border-slate-50 hover:border-indigo-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className={`w-4 h-4 ${managedCenterIds.includes(center.id) ? 'text-white' : 'text-slate-300'}`} />
                            <span className="text-xs font-black">{center.name}</span>
                          </div>
                          {managedCenterIds.includes(center.id) && <Check className="w-4 h-4" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-50">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-2 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex-grow uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {editingAdmin ? 'حفظ التعديلات' : 'إنشاء الحساب'}
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

export default AdminsPage;
