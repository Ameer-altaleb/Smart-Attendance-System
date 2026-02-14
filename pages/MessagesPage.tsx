
import React, { useState } from 'react';
import { useApp } from '../store';
import { MessageSquare, Edit3, Save, RotateCcw, Info, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { MessageTemplate } from '../types';

const MessagesPage: React.FC = () => {
  const { templates, updateTemplate } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempContent, setTempContent] = useState('');

  const handleEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setTempContent(template.content);
  };

  const handleSave = (template: MessageTemplate) => {
    updateTemplate({ ...template, content: tempContent });
    setEditingId(null);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'check_in': return <CheckCircle className="w-6 h-6 text-emerald-500" />;
      case 'late_check_in': return <Clock className="w-6 h-6 text-amber-500" />;
      case 'check_out': return <CheckCircle className="w-6 h-6 text-indigo-500" />;
      case 'early_check_out': return <AlertTriangle className="w-6 h-6 text-rose-500" />;
      default: return <MessageSquare className="w-6 h-6 text-slate-400" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'check_in': return 'رسالة الدخول (في الوقت)';
      case 'late_check_in': return 'رسالة الدخول (متأخر)';
      case 'check_out': return 'رسالة الخروج (في الوقت)';
      case 'early_check_out': return 'رسالة الخروج (مبكر)';
      default: return 'قالب غير معروف';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">قوالب رسائل النظام</h1>
          <p className="text-slate-500 font-bold">تخصيص الرسائل التي تظهر للموظفين عند استخدام بوابة الحضور</p>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex items-start gap-4">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
          <Info className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-black text-indigo-900 text-sm">نصيحة تقنية حول القوالب</h4>
          <p className="text-indigo-700/80 text-xs font-bold leading-relaxed">
            يمكنك استخدام الرمز <code className="bg-indigo-200 px-1.5 py-0.5 rounded text-indigo-900 font-mono">{"{minutes}"}</code> في رسائل التأخير والخروج المبكر ليقوم النظام تلقائياً باستبداله بعدد الدقائق الفعلي.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden group hover:shadow-xl transition-all">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    {getIcon(template.type)}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900">{getLabel(template.type)}</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">System Template ID: {template.id}</p>
                  </div>
                </div>
                {editingId === template.id ? (
                  <button 
                    onClick={() => setEditingId(null)}
                    className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={() => handleEdit(template)}
                    className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {editingId === template.id ? (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <textarea
                    value={tempContent}
                    onChange={(e) => setTempContent(e.target.value)}
                    rows={4}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700 resize-none"
                    placeholder="اكتب نص الرسالة هنا..."
                  />
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleSave(template)}
                      className="flex-1 bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                      <Save className="w-4 h-4" /> حفظ التغييرات
                    </button>
                    <button 
                      onClick={() => setEditingId(null)}
                      className="px-6 bg-slate-100 text-slate-500 font-black py-3 rounded-xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 min-h-[120px] flex items-center">
                  <p className="text-slate-600 font-bold leading-relaxed">
                    {template.content.split('{minutes}').map((part, i, arr) => (
                      <React.Fragment key={i}>
                        {part}
                        {i < arr.length - 1 && <span className="text-indigo-600 font-black px-1">XX</span>}
                      </React.Fragment>
                    ))}
                  </p>
                </div>
              )}
            </div>
            
            <div className="px-8 py-4 bg-slate-900/5 flex items-center justify-between border-t border-slate-50">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                 Last updated: {new Date().toLocaleDateString('ar-SA')}
               </span>
               <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 uppercase">
                 <CheckCircle className="w-3.5 h-3.5" /> قالب نشط
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Section */}
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <h3 className="text-2xl font-black">معاينة التجربة الرقمية</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed">
              تأكد من أن الرسائل ودودة وواضحة، فهي أول ما يراه الموظف عند بدء يومه العملي. الرسائل الواضحة تساهم في رفع مستوى الالتزام والرضا الوظيفي.
            </p>
            <div className="flex items-center gap-4 pt-4">
               <div className="w-px h-10 bg-white/10"></div>
               <div>
                 <p className="text-[10px] text-slate-500 font-black uppercase">Current Language</p>
                 <p className="text-sm font-black text-indigo-400">العربية (الافتراضية)</p>
               </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-[2rem] relative">
            <div className="absolute -top-3 right-8 bg-indigo-600 px-3 py-1 rounded-full text-[9px] font-black">مثال حي</div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <p className="font-black text-sm">تم تسجيل الدخول بنجاح</p>
            </div>
            <p className="text-xs text-slate-300 font-bold leading-relaxed">
              {templates.find(t => t.type === 'check_in')?.content || 'مرحباً بك، تم تسجيل حضورك بنجاح!'}
            </p>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default MessagesPage;
