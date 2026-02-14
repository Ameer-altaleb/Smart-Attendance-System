
import React, { useState } from 'react';
import { useApp } from '../store';
import { Calendar as CalendarIcon, Plus, Trash2, X, Gift, MapPin, Info } from 'lucide-react';
import { Holiday } from '../types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const HolidaysPage: React.FC = () => {
  const { holidays, addHoliday, deleteHoliday } = useApp();
  const [isModalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) return;

    const newHoliday: Holiday = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      date
    };

    addHoliday(newHoliday);
    setName('');
    setDate('');
    setModalOpen(false);
  };

  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">العطل الرسمية</h1>
          <p className="text-slate-500 font-bold">إدارة الأيام المستثناة من الدوام الرسمي والمناسبات الوطنية</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
        >
          <Plus className="w-5 h-5" /> إضافة عطلة جديدة
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm shrink-0">
          <Info className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-black text-amber-900 text-sm">ملاحظة هامة حول العطل</h4>
          <p className="text-amber-700/80 text-xs font-bold leading-relaxed">
            يتم استثناء هذه الأيام تلقائياً من تقارير الغياب. أي عملية تسجيل حضور تتم في هذه الأيام ستُحتسب كعمل إضافي (Overtime) في التقارير المتقدمة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sortedHolidays.map((holiday) => (
          <div key={holiday.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group overflow-hidden relative">
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform">
                  <Gift className="w-7 h-7" />
                </div>
                <button 
                  onClick={() => deleteHoliday(holiday.id)}
                  className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">{holiday.name}</h3>
              
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-4">
                <CalendarIcon className="w-5 h-5 text-indigo-500" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">تاريخ العطلة</p>
                  <p className="text-sm font-black text-slate-700">
                    {format(new Date(holiday.date), 'dd MMMM yyyy', { locale: ar })}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        ))}

        {sortedHolidays.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <CalendarIcon className="w-10 h-10" />
            </div>
            <div>
              <p className="text-slate-400 font-bold">لم يتم تسجيل أي عطل رسمية بعد</p>
              <p className="text-[10px] text-slate-300 font-bold uppercase mt-1">Holidays will appear here once added</p>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden border border-white/20">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">إضافة عطلة رسمية</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Public Holiday Configuration</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">مسمى العطلة</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700"
                    placeholder="مثال: عيد الفطر، اليوم الوطني"
                  />
                </div>
                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">تاريخ اليوم</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-700"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="submit" className="flex-2 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex-grow uppercase text-xs tracking-widest">
                  حفظ العطلة
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

export default HolidaysPage;
