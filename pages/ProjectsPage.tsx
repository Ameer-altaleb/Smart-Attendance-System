
import React, { useState } from 'react';
import { useApp } from '../store';
import { Briefcase, Plus, Edit2, Trash2, X, Hash, AlignLeft, Info } from 'lucide-react';
import { Project } from '../types';

const ProjectsPage: React.FC = () => {
    const { projects, addProject, updateProject, deleteProject } = useApp();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');

    const handleOpenAdd = () => {
        setEditingProject(null);
        setName(''); setCode(''); setDescription('');
        setModalOpen(true);
    };

    const handleOpenEdit = (p: Project) => {
        setEditingProject(p);
        setName(p.name);
        setCode(p.code);
        setDescription(p.description || '');
        setModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !code) return;

        const projectData: Project = {
            id: editingProject?.id || crypto.randomUUID(),
            name,
            code,
            description
        };

        if (editingProject) {
            updateProject(projectData);
        } else {
            addProject(projectData);
        }
        setModalOpen(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">إدارة المشاريع</h1>
                    <p className="text-slate-500 font-bold">تحديد المشاريع والبرامج التي يتم تحميل الموظفين عليها</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                >
                    <Plus className="w-5 h-5" /> إضافة مشروع جديد
                </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                    <Info className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                    <h4 className="font-black text-indigo-900 text-sm">حول تخصيص المشاريع</h4>
                    <p className="text-indigo-700/80 text-xs font-bold leading-relaxed">
                        يسمح لك هذا القسم بتوزيع الموظفين على مشاريع محددة. سيظهر اسم المشروع المعتمد تلقائياً في كشوف الدوام الشهرية والتقارير الميدانية لضمان دقة التحميل المالي.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {projects.map((project) => (
                    <div key={project.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:translate-y-[-4px] transition-all group overflow-hidden relative">
                        <div className="p-8">
                            <div className="flex items-start justify-between mb-8">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 text-white flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                                    <Briefcase className="w-8 h-8" />
                                </div>
                                <div className="flex gap-1.5 bg-slate-50 p-1.5 rounded-2xl">
                                    <button onClick={() => handleOpenEdit(project)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => deleteProject(project.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all shadow-sm">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">{project.name}</h3>
                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                        <Hash className="w-3 h-3 text-indigo-500" /> رمز المشروع: {project.code}
                                    </div>
                                </div>

                                {project.description && (
                                    <p className="text-xs text-slate-500 font-bold leading-relaxed line-clamp-2">
                                        {project.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Project Details</span>
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        </div>
                    </div>
                ))}

                {projects.length === 0 && (
                    <div className="col-span-full py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                        <Briefcase className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold italic">لا توجد مشاريع مضافة حالياً</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-white/20">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-slate-900">{editingProject ? 'تعديل مشروع' : 'إضافة مشروع جديد'}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Project Configuration</p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="group">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">اسم المشروع</label>
                                    <input
                                        type="text" required value={name} onChange={(e) => setName(e.target.value)}
                                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700"
                                        placeholder="مثال: برنامج الاستجابة الطارئة"
                                    />
                                </div>

                                <div className="group">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">رمز المشروع (Code)</label>
                                    <div className="relative">
                                        <Hash className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                        <input
                                            type="text" required value={code} onChange={(e) => setCode(e.target.value)}
                                            className="w-full pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-black text-slate-700 uppercase"
                                            placeholder="RX-2026-001"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div className="group">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 mr-2 tracking-widest">وصف المشروع</label>
                                    <div className="relative">
                                        <AlignLeft className="w-5 h-5 absolute right-5 top-5 text-slate-300" />
                                        <textarea
                                            value={description} onChange={(e) => setDescription(e.target.value)}
                                            className="w-full pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-700 h-32"
                                            placeholder="تفاصيل إضافية عن المشروع..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="submit" className="flex-2 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex-grow uppercase text-xs tracking-widest">
                                    حفظ المشروع
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

export default ProjectsPage;
