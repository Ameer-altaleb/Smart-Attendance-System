import React, { useState, useMemo, useCallback, memo } from 'react';
import { useApp } from '../store.tsx';
import {
  UserPlus, Search, Filter, Edit2, Trash2, RotateCcw, X,
  ShieldCheck, ShieldAlert, Download, Building2, Clock,
  Power, PowerOff, FileSpreadsheet, Fingerprint, Building,
  ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { Employee } from '../types';
import { normalizeArabic } from '../utils/attendanceLogic';
import { debounce } from '../utils/performance';

// Pagination settings
const ITEMS_PER_PAGE = 25;

// Memoized Employee Row Component for better performance
const EmployeeRow = memo(({
  emp,
  center,
  project,
  settings,
  onEdit,
  onDelete,
  onToggleStatus,
  onResetDevice
}: {
  emp: Employee;
  center: any;
  project: any;
  settings: any;
  onEdit: (emp: Employee) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (emp: Employee) => void;
  onResetDevice: (emp: Employee) => void;
}) => (
  <tr className={`hover:bg-slate-50/30 transition-colors group ${!emp.isActive ? 'opacity-50 grayscale' : ''}`}>
    <td className="px-8 py-4">
      <div className="flex items-center gap-4">
        <div>
          <p className="font-black text-slate-800 text-sm leading-none mb-1">{emp.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-[9px] text-indigo-600 font-black uppercase tracking-tighter">الرمز: {emp.code || 'بدون رمز'}</p>
            {project && (
              <>
                <span className="text-[8px] text-slate-300">•</span>
                <p className="text-[9px] text-amber-600 font-black uppercase tracking-tighter">{project.name}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </td>
    <td className="px-8 py-4 text-center">
      {emp.deviceId ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black border border-emerald-100 uppercase">
          <ShieldCheck className="w-3.5 h-3.5" /> مقترن
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[9px] font-black border border-amber-100 uppercase">
          <ShieldAlert className="w-3.5 h-3.5" /> غير مقترن
        </span>
      )}
    </td>
    <td className="px-8 py-4 text-center">
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black border uppercase ${emp.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
        {emp.isActive ? 'نشط' : 'متوقف'}
      </span>
    </td>
    <td className="px-8 py-4 text-center">
      <div className="flex flex-col items-center">
        <span className="text-slate-700 font-black text-xs">{emp.workingHours}h</span>
        <span className="text-[8px] font-black text-slate-400 uppercase mt-1">
          {emp.workType === 'shifts' ? 'نظام مناوبات' : 'إداري'}
        </span>
      </div>
    </td>
    <td className="px-8 py-4">
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => onToggleStatus(emp)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${emp.isActive ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-rose-600 bg-rose-50 hover:bg-rose-100'}`}>
          {emp.isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
        </button>
        <button onClick={() => onResetDevice(emp)} className="w-9 h-9 flex items-center justify-center text-amber-600 bg-amber-50 rounded-xl transition-all hover:bg-amber-100"><RotateCcw className="w-4 h-4" /></button>
        <button onClick={() => onEdit(emp)} className="w-9 h-9 flex items-center justify-center text-indigo-600 bg-indigo-50 rounded-xl transition-all hover:bg-indigo-100"><Edit2 className="w-4 h-4" /></button>
        <button onClick={() => onDelete(emp.id)} className="w-9 h-9 flex items-center justify-center text-rose-600 bg-rose-50 rounded-xl transition-all hover:bg-rose-100"><Trash2 className="w-4 h-4" /></button>
      </div>
    </td>
  </tr>
));

EmployeeRow.displayName = 'EmployeeRow';

// Memoized Mobile Card Component
const EmployeeCard = memo(({
  emp,
  project,
  settings,
  onEdit,
  onDelete,
  onToggleStatus,
  onResetDevice
}: {
  emp: Employee;
  project: any;
  settings: any;
  onEdit: (emp: Employee) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (emp: Employee) => void;
  onResetDevice: (emp: Employee) => void;
}) => (
  <div className={`bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 space-y-4 ${!emp.isActive ? 'grayscale opacity-60' : ''}`}>
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div>
          <p className="font-black text-slate-800 text-sm leading-tight mb-0.5">{emp.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-[9px] text-indigo-600 font-black uppercase tracking-tighter">الرمز: {emp.code}</p>
            {project && <span className="text-[9px] text-amber-600 font-black uppercase tracking-tighter shrink-0 truncate max-w-[100px]">{project.name}</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => onEdit(emp)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={() => onDelete(emp.id)} className="p-2 text-rose-600 bg-rose-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-2 border-y border-slate-50 py-3">
      <div className="text-center">
        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">الأمان</p>
        <span className={`text-[9px] font-black uppercase ${emp.deviceId ? 'text-emerald-600' : 'text-amber-500'}`}>
          {emp.deviceId ? 'مقترن' : 'مفتوح'}
        </span>
      </div>
      <div className="text-center border-x border-slate-50">
        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">الحالة</p>
        <span className={`text-[9px] font-black uppercase ${emp.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {emp.isActive ? 'نشط' : 'متوقف'}
        </span>
      </div>
      <div className="text-center">
        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">نوع العمل</p>
        <span className="text-indigo-600 font-black text-[9px]">
          {emp.workType === 'shifts' ? 'مناوبات' : 'إداري'}
        </span>
      </div>
    </div>

    <div className="flex gap-2">
      <button onClick={() => onToggleStatus(emp)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${emp.isActive ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-rose-700 bg-rose-50 border-rose-100'}`}>
        {emp.isActive ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
        {emp.isActive ? 'إيقاف' : 'تفعيل'}
      </button>
      <button onClick={() => onResetDevice(emp)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase border text-amber-700 bg-amber-50 border-amber-100">
        <RotateCcw className="w-3 h-3" /> تصفير
      </button>
    </div>
  </div>
));

EmployeeCard.displayName = 'EmployeeCard';

// Pagination Component
const Pagination = memo(({
  currentPage,
  totalPages,
  totalItems,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t border-slate-100">
      <div className="text-[10px] font-black text-slate-400 uppercase">
        عرض {startItem}-{endItem} من {totalItems} موظف
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${currentPage === pageNum
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

const Employees: React.FC = () => {
  const { employees, centers, projects, addEmployee, updateEmployee, deleteEmployee, settings, pendingOperations } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCenterId, setFilterCenterId] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [centerId, setCenterId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [workingHours, setWorkingHours] = useState(8);
  const [isActive, setIsActive] = useState(true);
  const [workType, setWorkType] = useState<'administrative' | 'shifts'>('administrative');

  // Debounced search handler
  const handleSearchChange = useMemo(() =>
    debounce((value: string) => {
      setDebouncedSearch(value);
      setCurrentPage(1); // Reset to first page on search
    }, 300)
    , []);

  const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    handleSearchChange(value);
  }, [handleSearchChange]);

  const handleExport = useCallback(() => {
    const activeEmps = employees.filter(e => {
      const matchesSearch = normalizeArabic(e.name).includes(normalizeArabic(debouncedSearch));
      const matchesCenter = filterCenterId === '' || e.centerId === filterCenterId;
      return matchesSearch && matchesCenter;
    });

    const headers = ['Employee Code', 'Name', 'Center', 'Status', 'Daily Hours', 'Joined Date'];
    const rows = activeEmps.map(e => [
      e.code, e.name, centers.find(c => c.id === e.centerId)?.name || 'Unknown',
      e.isActive ? 'Active' : 'Inactive', e.workingHours, e.joinedDate
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [employees, centers, debouncedSearch, filterCenterId]);

  const handleOpenAdd = useCallback(() => {
    setEditingEmployee(null); setName(''); setCode(''); setCenterId(''); setProjectId(''); setWorkingHours(8); setIsActive(true);
    setWorkType('administrative');
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((emp: Employee) => {
    setEditingEmployee(emp); setName(emp.name); setCode(emp.code || '');
    setCenterId(emp.centerId); setProjectId(emp.projectId || ''); setWorkingHours(emp.workingHours); setIsActive(emp.isActive);
    setWorkType(emp.workType || 'administrative');
    setModalOpen(true);
  }, []);

  const toggleEmployeeStatus = useCallback((emp: Employee) => {
    updateEmployee({ ...emp, isActive: !emp.isActive });
  }, [updateEmployee]);

  const handleResetDevice = useCallback((emp: Employee) => {
    if (confirm(`تحذير أمني: هل أنت متأكد من فك ارتباط الجهاز للموظف (${emp.name})؟\nسيتمكن الموظف من التسجيل من جهاز جديد في المرة القادمة.`)) {
      updateEmployee({ ...emp, deviceId: null });
    }
  }, [updateEmployee]);

  const handleDelete = useCallback((id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
      deleteEmployee(id);
    }
  }, [deleteEmployee]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !centerId || !code) return;
    if (editingEmployee) {
      updateEmployee({ ...editingEmployee, name, code, centerId, projectId, workingHours, isActive, workType });
    } else {
      addEmployee({
        id: crypto.randomUUID(),
        code, name, centerId, projectId, workingHours,
        joinedDate: new Date().toISOString().split('T')[0],
        isActive,
        workType
      });
    }
    setModalOpen(false);
    // Reset selection after submit
    setProjectId('');
  }, [name, code, centerId, projectId, workingHours, isActive, workType, editingEmployee, addEmployee, updateEmployee]);

  // Filtered and grouped employees with pagination
  const { groupedEmployees, totalFiltered, totalPages } = useMemo(() => {
    const filtered = employees.filter(e => {
      const searchNormalized = normalizeArabic(debouncedSearch);
      const nameNormalized = normalizeArabic(e.name);
      const codeMatches = (e.code || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesSearch = nameNormalized.includes(searchNormalized) || codeMatches;
      const matchesCenter = filterCenterId === '' || e.centerId === filterCenterId;
      return matchesSearch && matchesCenter;
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);

    // Apply pagination
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedEmployees = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const groups: { [key: string]: Employee[] } = {};
    paginatedEmployees.forEach(emp => {
      if (!groups[emp.centerId]) groups[emp.centerId] = [];
      groups[emp.centerId].push(emp);
    });

    const groupedEmployees = Object.entries(groups).map(([cId, emps]) => ({
      center: centers.find(c => c.id === cId),
      employees: emps.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    })).sort((a, b) => (a.center?.name || '').localeCompare(b.center?.name || '', 'ar'));

    return { groupedEmployees, totalFiltered, totalPages };
  }, [employees, centers, projects, debouncedSearch, filterCenterId, currentPage]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">سجل القوى الميدانية</h1>
            {pendingOperations > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full">
                <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                <span className="text-[9px] font-black text-amber-600 uppercase">{pendingOperations} معلق</span>
              </div>
            )}
          </div>
          <p className="text-slate-500 font-bold text-sm">تنظيم الكوادر، إدارة الأمان، وحالة النشاط • {totalFiltered} موظف</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button onClick={handleExport} className="bg-white text-slate-600 px-6 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> تصدير CSV
          </button>
          <button onClick={handleOpenAdd} className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
            <UserPlus className="w-4 h-4" /> إضافة موظف
          </button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2 group">
          <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            placeholder="البحث بالاسم أو الرمز..."
            value={searchTerm}
            onChange={onSearchChange}
            className="w-full pr-12 pl-4 py-4 bg-slate-50/50 border border-slate-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:bg-white transition-all font-bold text-slate-700 text-sm"
          />
        </div>
        <div className="relative group">
          <Filter className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <select
            value={filterCenterId}
            onChange={(e) => { setFilterCenterId(e.target.value); setCurrentPage(1); }}
            className="w-full pr-12 pl-4 py-4 bg-slate-50/50 border border-slate-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:bg-white transition-all font-black text-slate-600 appearance-none text-sm"
          >
            <option value="">كل المراكز</option>
            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-10">
        {groupedEmployees.map(({ center, employees: centerEmps }) => (
          <div key={center?.id} className="space-y-4">
            <div className="flex items-center gap-3 px-2 md:px-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <Building2 className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-black text-slate-900">{center?.name || 'بدون مركز'}</h3>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">{centerEmps.length} موظف في هذه الصفحة</p>
              </div>
              <div className="flex-1 border-t-2 border-dashed border-slate-100 mr-4"></div>
            </div>

            {/* Desktop View */}
            <div className="hidden lg:block bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">الموظف</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">حالة الأمان</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الحالة</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ساعات العمل</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {centerEmps.map((emp) => (
                      <EmployeeRow
                        key={emp.id}
                        emp={emp}
                        center={center}
                        project={projects.find(p => p.id === emp.projectId)}
                        settings={settings}
                        onEdit={handleOpenEdit}
                        onDelete={handleDelete}
                        onToggleStatus={toggleEmployeeStatus}
                        onResetDevice={handleResetDevice}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden grid grid-cols-1 gap-4">
              {centerEmps.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  project={projects.find(p => p.id === emp.projectId)}
                  settings={settings}
                  onEdit={handleOpenEdit}
                  onDelete={handleDelete}
                  onToggleStatus={toggleEmployeeStatus}
                  onResetDevice={handleResetDevice}
                />
              ))}
            </div>
          </div>
        ))}

        {groupedEmployees.length === 0 && (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-20 text-center">
            <p className="text-slate-400 font-bold">لا يوجد موظفين مطابقين للبحث</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalFiltered}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-white/20 my-auto">
            <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-1">
                <h3 className="text-lg md:text-xl font-black text-slate-900">{editingEmployee ? 'تحديث بيانات الموظف' : 'تسجيل كادر جديد'}</h3>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">{settings.systemName}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 md:space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2">الاسم الثلاثي</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold text-slate-700" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2">رمز الموظف</label>
                  <div className="relative">
                    <Fingerprint className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} className="w-full pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-black text-slate-700 uppercase" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2">المركز</label>
                  <select required value={centerId} onChange={(e) => setCenterId(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white font-black text-slate-600 appearance-none">
                    <option value="">-- اختر --</option>
                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2">المشروع</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white font-black text-slate-600 appearance-none">
                    <option value="">-- غير محدد --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 mr-2">نظام العمل</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWorkType('administrative')}
                      className={`py-3 px-4 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${workType === 'administrative' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                    >
                      طريقة إدارية
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkType('shifts')}
                      className={`py-3 px-4 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${workType === 'shifts' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                    >
                      طريقة المناوبات
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button type="submit" className="flex-2 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex-grow uppercase text-xs tracking-widest">{editingEmployee ? 'تحديث' : 'تثبيت'}</button>
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs tracking-widest">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
