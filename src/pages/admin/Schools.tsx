import React, { useState } from 'react';
import {
  School, Plus, ArrowUpRight, Search, X, Users, GraduationCap,
  BookOpen, Trophy, TrendingUp, Activity,
  Trash2, Edit3, Power, ChevronRight, LayoutGrid
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';

// ─── Types & Schemas ─────────────────────────────────────────────────────────
interface SchoolRecord {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  usersCount?: number;
  globalScore?: number;
  logo?: string;
}

const schoolSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  status: z.enum(['active', 'inactive']),
});
type SchoolFormData = z.infer<typeof schoolSchema>;

const classSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  grade: z.string().min(1, 'Série obrigatória'),
  year: z.string().min(4, 'Ano letivo inválido'),
  teacherId: z.string().optional(),
});
type ClassFormData = z.infer<typeof classSchema>;

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useSchoolStats(schoolId: string) {
  const allUsers = useSupabaseQuery<any>('users') || [];
  const allClasses = useSupabaseQuery<any>('classes') || [];
  const allGamStats = useSupabaseQuery<any>('gamification_stats') || [];

  const students = allUsers.filter(u => u.schoolId === schoolId && u.role === 'student');
  const teachers = allUsers.filter(u => u.schoolId === schoolId && u.role === 'teacher');
  const classes = allClasses.filter(c => c.schoolId === schoolId);
  
  const studentIds = students.map(s => s.id);
  const studentStats = allGamStats.filter(s => studentIds.includes(s.id));
  
  const totalCoins = studentStats.reduce((sum, s) => sum + (s.coins || 0), 0);
  const totalXp = studentStats.reduce((sum, s) => sum + (s.xp || 0), 0);
  const avgLevel = students.length > 0 ? (studentStats.reduce((sum, s) => sum + (s.level || 1), 0) / students.length).toFixed(1) : '1.0';
  const activeRatio = students.length > 0 ? Math.round((students.filter(s => s.status === 'active').length / students.length) * 100) : 0;

  const topStudents = [...studentStats]
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .slice(0, 5)
    .map(stat => ({ stat, user: students.find(u => u.id === stat.id) }))
    .filter(x => !!x.user);

  const classPerformance = classes.map(c => {
    const classStudents = students.filter(s => (c.studentIds || []).includes(s.id) || (s as any).classId === c.id);
    const classStats = studentStats.filter(st => classStudents.some(s => s.id === st.id));
    const avgXp = classStudents.length > 0 ? (classStats.reduce((sum, s) => sum + (s.xp || 0), 0) / classStudents.length) : 0;
    const avgLevel = classStudents.length > 0 ? (classStats.reduce((sum, s) => sum + (s.level || 1), 0) / classStudents.length) : 1;
    return { ...c, avgXp, avgLevel, studentCount: classStudents.length };
  }).sort((a, b) => b.avgXp - a.avgXp);

  return { studentCount: students.length, teacherCount: teachers.length, classCount: classes.length, totalCoins, totalXp, avgLevel, activeRatio, topStudents, classPerformance };
}

// ─── Forms ───────────────────────────────────────────────────────────────────
const ClassForm: React.FC<{ schoolId: string; teachers: any[]; editingClass?: any; onDone: () => void; }> = ({ schoolId, teachers, editingClass, onDone }) => {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: editingClass ? { name: editingClass.name, grade: editingClass.grade, year: editingClass.year, teacherId: editingClass.teacherId } : { year: new Date().getFullYear().toString() }
  });

  const onSubmit = async (data: ClassFormData) => {
    const now = new Date().toISOString();
    const targetClassId = editingClass ? editingClass.id : crypto.randomUUID();
    
    // Bidirectional sync: if teacherId changed, update teacher's classIds
    const oldTeacherId = editingClass?.teacherId;
    const newTeacherId = data.teacherId;

    if (newTeacherId !== oldTeacherId) {
      if (oldTeacherId) {
        const { data: oldT } = await supabase.from('users').select('*').eq('id', oldTeacherId).single();
        if (oldT) {
          const newIds = (oldT.classIds || []).filter((id: string) => id !== targetClassId);
          await supabase.from('users').update({ classIds: newIds, classId: newIds[0] || null }).eq('id', oldTeacherId);
        }
      }
      if (newTeacherId) {
        const { data: newT } = await supabase.from('users').select('*').eq('id', newTeacherId).single();
        if (newT) {
          const newIds = Array.from(new Set([...(newT.classIds || []), targetClassId]));
          await supabase.from('users').update({ classIds: newIds, classId: newIds[0] }).eq('id', newTeacherId);
        }
      }
    }

    if (editingClass) {
      await supabase.from('classes').update({ ...data, updatedAt: now }).eq('id', editingClass.id);
      toast.success('Turma atualizada!');
    } else {
      await supabase.from('classes').insert({ id: targetClassId, ...data, schoolId, studentIds: [], createdAt: now, updatedAt: now });
      toast.success('Turma criada!');
    }
    onDone();
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 shadow-inner animate-in slide-in-from-top-4 duration-300">
      <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
        {editingClass ? <Edit3 size={16} /> : <Plus size={16} />} {editingClass ? 'Editar Turma' : 'Nova Turma'}
      </h4>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Nome</label>
          <input {...register('name')} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary-500/20" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Série</label>
          <select {...register('grade')} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none appearance-none">
            {['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano', '1º EM', '2º EM', '3º EM'].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Ano</label>
          <input {...register('year')} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none" />
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Professor (Opcional)</label>
          <select {...register('teacherId')} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none appearance-none">
            <option value="">Nenhum</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-1 flex items-end gap-2">
          <Button type="button" variant="outline" onClick={onDone} className="flex-1 rounded-xl">Cancelar</Button>
          <Button type="submit" variant="primary" className="flex-1 rounded-xl shadow-lg shadow-primary-500/20" disabled={isSubmitting}>Salvar</Button>
        </div>
      </form>
    </div>
  );
};

// ─── Dashboard Modal ─────────────────────────────────────────────────────────
const SchoolDashboard: React.FC<{ school: SchoolRecord; onClose: () => void }> = ({ school, onClose }) => {
  const stats = useSchoolStats(school.id);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes'>('overview');
  const [showCreate, setShowCreate] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const allUsers = useSupabaseQuery<any>('users') || [];
  const allClasses = useSupabaseQuery<any>('classes') || [];
  const gamStats = useSupabaseQuery<any>('gamification_stats') || [];

  const users = allUsers.filter(u => u.schoolId === school.id);
  const classes = allClasses.filter(c => c.schoolId === school.id);

  const filteredItems = (activeTab === 'classes' ? classes : [])
    .filter((it: any) => it.name.toLowerCase().includes(search.toLowerCase()))
    .filter((it: any) => yearFilter === 'all' || it.year === yearFilter);

  const availableYears = Array.from(new Set(classes.map(c => c.year || ''))).sort((a, b) => b.localeCompare(a));

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Excluir ${item.name}?`)) return;
    if (activeTab === 'classes') await supabase.from('classes').delete().eq('id', item.id);
    else {
      await supabase.from('users').delete().eq('id', item.id);
      if (item.role === 'student') await supabase.from('gamification_stats').delete().eq('id', item.id);
    }
    toast.success('Excluído com sucesso');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit for original
      toast.error('Imagem muito grande. Limite de 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const resizedBase64 = canvas.toDataURL('image/png', 0.8);
        await supabase.from('schools').update({ logo: resizedBase64 }).eq('id', school.id);
        toast.success('Logo redimensionada e salva!');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Modal Header */}
        <header className="bg-slate-950 p-10 text-white flex-shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all z-20"><X size={20} /></button>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className={cn(
                  "w-20 h-20 rounded-3xl flex items-center justify-center border shadow-2xl overflow-hidden transition-all",
                  school.logo ? "bg-white border-white" : "bg-white/10 backdrop-blur-xl border-white/20"
                )}>
                  {school.logo ? (
                    <img src={school.logo} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <School size={40} className="text-primary-400" />
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-3xl cursor-pointer transition-opacity">
                  <Plus size={20} className="text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              </div>
              <div>
                <Badge variant={school.status === 'active' ? 'success' : 'energy'} className="mb-2 px-3 py-1 text-[9px] uppercase tracking-widest font-black italic">
                   {school.status === 'active' ? '✓ Operacional' : '⚠ Manutenção'}
                </Badge>
                <h2 className="text-4xl font-black tracking-tight">{school.name}</h2>
                <div className="flex items-center gap-4 mt-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
                   <span className="flex items-center gap-1.5"><Users size={14} /> {stats.studentCount} Alunos</span>
                   <span className="w-1 h-1 bg-slate-700 rounded-full" />
                   <span className="flex items-center gap-1.5"><GraduationCap size={14} /> {stats.teacherCount} Profs</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
               <div className="text-center px-4">
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-1">XP Médio</div>
                  <div className="text-xl font-black text-white">{(+stats.totalXp / Math.max(1, stats.studentCount)).toFixed(0)}</div>
               </div>
               <div className="text-center px-4 border-x border-white/10">
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Nível Médio</div>
                  <div className="text-xl font-black text-amber-400">{stats.avgLevel}</div>
               </div>
               <div className="text-center px-4">
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Atividade</div>
                  <div className="text-xl font-black text-green-400">{stats.activeRatio}%</div>
               </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-50 px-10 border-b border-slate-200">
           {[
             { id: 'overview', label: 'Dashboard Analítico', icon: LayoutGrid },
             { id: 'classes', label: 'Gestão de Turmas', icon: BookOpen }
           ].map(t => (
             <button
               key={t.id}
               onClick={() => { setActiveTab(t.id as any); setShowCreate(null); setEditingItem(null); }}
               className={cn(
                 "px-6 py-5 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-4 transition-all",
                 activeTab === t.id ? `border-primary-500 text-primary-600` : "border-transparent text-slate-400 hover:text-slate-600"
               )}
             >
               <t.icon size={16} /> {t.label}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-10">
          
          {/* Header Actions */}
          {activeTab !== 'overview' && (
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={`Buscar ${activeTab === 'classes' ? 'turmas' : activeTab}...`} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/10" 
                />
              </div>
              {activeTab === 'classes' && availableYears.length > 0 && (
                <select 
                  value={yearFilter}
                  onChange={e => setYearFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-tight outline-none focus:ring-2 focus:ring-primary-500/10 appearance-none min-w-[160px] text-slate-600"
                >
                  <option value="all">Todos os Anos</option>
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
              <Button 
                onClick={() => setShowCreate(activeTab)}
                variant="primary" className="rounded-2xl px-8 h-12 shadow-lg shadow-primary-500/10">
                <Plus size={20} className="mr-2" /> Novo {activeTab.slice(0, -1)}
              </Button>
            </div>
          )}

          {/* Forms Overlay */}
          {(showCreate || editingItem) && activeTab === 'classes' && (
            <div className="mb-10">
              <ClassForm schoolId={school.id} teachers={users.filter(u => u.role === 'teacher')} editingClass={editingItem} onDone={() => { setShowCreate(null); setEditingItem(null); }} />
            </div>
          )}

          {/* Dynamic Content */}
          {activeTab === 'overview' ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
               {/* Analytics Grid */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Estudantes', val: stats.studentCount, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Corpo Docente', val: stats.teacherCount, icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Turmas Ativas', val: stats.classCount, icon: BookOpen, color: 'text-primary-600', bg: 'bg-primary-50' },
                    { label: 'Engajamento', val: `${stats.activeRatio}%`, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                  ].map((m, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                       <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", m.bg, m.color)}>
                          <m.icon size={24} />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{m.label}</p>
                          <h4 className="text-2xl font-black text-slate-800 tracking-tight">{m.val}</h4>
                       </div>
                    </div>
                  ))}
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  {/* Performance Ranking */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><Trophy className="text-amber-500" /> Top Desertores e Conquistadores</h3>
                       <Badge className="bg-slate-100 text-[10px] font-black px-3 py-1 rounded-full text-slate-500 uppercase">Ranking Geral</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estudantes Destaque</p>
                          {stats.topStudents.map(({ user, stat }, i) => (
                            <div key={stat.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-[1.5rem] hover:border-primary-100 transition-all shadow-sm group">
                               <div className="flex items-center gap-3">
                                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-[10px]", i === 0 ? "bg-amber-400" : "bg-slate-200")}>{i + 1}</div>
                                  <div className="min-w-0">
                                     <div className="font-black text-slate-800 text-xs truncate w-32">{user?.name}</div>
                                     <div className="text-[9px] font-bold text-slate-400 uppercase">Nível {stat.level}</div>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <div className="text-[10px] font-black text-amber-600 flex items-center gap-1 justify-end">{(stat.xp || 0).toLocaleString()} XP</div>
                               </div>
                            </div>
                          ))}
                       </div>

                       <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Turmas Performance</p>
                          {stats.classPerformance.slice(0, 5).map((c, i) => (
                            <div key={c.id} className="flex items-center justify-between p-4 bg-indigo-50/30 border border-indigo-100/50 rounded-[1.5rem] hover:border-indigo-200 transition-all shadow-sm group">
                               <div className="flex items-center gap-3">
                                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-[10px]", i === 0 ? "bg-indigo-500" : "bg-indigo-300")}>{i + 1}</div>
                                  <div className="min-w-0">
                                     <div className="font-black text-indigo-900 text-xs truncate w-32">{c.name}</div>
                                     <div className="text-[9px] font-bold text-indigo-400 uppercase">{c.studentCount} Alunos</div>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <div className="text-[10px] font-black text-indigo-600 flex items-center gap-1 justify-end">{c.avgXp.toFixed(0)} XP Avg</div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>

                  {/* Institution Global Radar */}
                  <div className="space-y-6">
                     <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><TrendingUp className="text-emerald-500" /> Score Institucional</h3>
                     <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden h-[400px] flex flex-col justify-between border border-slate-800 shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse"></div>
                        
                        <div>
                           <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Métrica de Qualidade</div>
                           <h4 className="text-5xl font-black text-white">{school.globalScore || 0}<span className="text-xs text-primary-500 ml-2">PTS</span></h4>
                        </div>

                        <div className="space-y-6">
                           <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                                 <span>Engajamento Diário</span>
                                 <span>{stats.activeRatio}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${stats.activeRatio}%` }} />
                              </div>
                           </div>
                           
                           <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                                 <span>Progresso Pedagógico</span>
                                 <span>{Math.min(100, (stats.totalXp / Math.max(1, stats.studentCount * 1000)) * 100).toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-primary-500 transition-all duration-1000" style={{ width: `${Math.min(100, (stats.totalXp / Math.max(1, stats.studentCount * 1000)) * 100)}%` }} />
                              </div>
                           </div>
                        </div>

                        <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                           <div className="flex -space-x-3">
                              {stats.topStudents.slice(0, 4).map(({ user, stat }) => (
                                <img key={stat.id} src={user?.avatar || '/avatars/default-capybara.png'} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800" />
                              ))}
                           </div>
                           <p className="text-[9px] font-bold text-slate-500 uppercase">Top Talentos</p>
                        </div>
                     </div>

                     <div className="p-8 bg-white border border-slate-100 rounded-[3rem] shadow-sm space-y-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Users size={16} className="text-primary-500" /> Distribuição</h3>
                        <div className="space-y-4">
                           {[
                             { label: 'Estudantes', count: stats.studentCount, total: stats.studentCount + stats.teacherCount, color: 'bg-blue-500' },
                             { label: 'Professores', count: stats.teacherCount, total: stats.studentCount + stats.teacherCount, color: 'bg-indigo-500' }
                           ].map(d => (
                             <div key={d.label} className="space-y-2">
                               <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                 <span>{d.label}</span>
                                 <span>{d.count}</span>
                               </div>
                               <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                 <div className={cn("h-full rounded-full", d.color)} style={{ width: `${(d.count / Math.max(1, d.total)) * 100}%` }} />
                               </div>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filteredItems.map((item: any) => {
                 const stat = gamStats.find(s => s.id === item.id);
                 return (
                   <div key={item.id} className="p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-primary-100 transition-all shadow-sm flex flex-col group">
                     <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl border border-slate-100 uppercase">
                              {item.avatar ? <img src={item.avatar} className="w-full h-full object-cover rounded-2xl" /> : item.name[0]}
                           </div>
                           <div>
                              <h4 className="font-black text-slate-800 leading-tight">{item.name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.email || item.studentCode || item.grade || 'Membro'}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setEditingItem(item)} className="p-2 hover:bg-primary-50 text-slate-300 hover:text-primary-500 rounded-xl transition-all"><Edit3 size={16} /></button>
                           <button onClick={() => handleDelete(item)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16} /></button>
                        </div>
                     </div>
                     
                     {stat && (
                       <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-slate-50">
                          <div className="bg-slate-50 p-2 rounded-xl text-center">
                             <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nível</div>
                             <div className="text-sm font-black text-slate-800">{stat.level}</div>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl text-center">
                             <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">XP</div>
                             <div className="text-sm font-black text-slate-800">{stat.xp}</div>
                          </div>
                       </div>
                     )}
                     {!stat && activeTab === 'classes' && (
                       <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50 text-[10px] font-black uppercase text-slate-400">
                          <span>{item.studentIds?.length || 0} Alunos</span>
                          <span className="text-primary-500 flex items-center gap-1">Ver Turma <ChevronRight size={12} /></span>
                       </div>
                     )}
                   </div>
                 );
               })}
               {filteredItems.length === 0 && (
                 <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <Search size={40} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold">Nenhum resultado encontrado.</p>
                 </div>
               )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// ─── School Card Component ───────────────────────────────────────────────────
const SchoolStatsCard: React.FC<{ 
  school: any; 
  onClick: () => void;
  onToggleStatus: (s: any, e: React.MouseEvent) => void;
  onDelete: (s: any, e: React.MouseEvent) => void;
}> = ({ school, onClick, onToggleStatus, onDelete }) => {
  const stats = useSchoolStats(school.id);
  
  return (
    <Card 
      onClick={onClick} 
      className="p-8 border-slate-100 group hover:border-primary-200 hover:shadow-2xl transition-all duration-500 cursor-pointer relative overflow-hidden flex flex-col rounded-[2.5rem] bg-white group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-all" />
      
      {/* Header Info */}
      <div className="flex justify-between items-start mb-6">
         <div className={cn(
           "w-16 h-16 rounded-2xl flex items-center justify-center border transition-all shadow-sm overflow-hidden",
           school.logo ? "bg-white border-slate-100" : "bg-slate-50 border-slate-100 group-hover:bg-emerald-500 group-hover:border-emerald-500"
         )}>
            {school.logo ? (
              <img src={school.logo} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <School size={32} className="text-slate-300 group-hover:text-white" />
            )}
         </div>
         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => onToggleStatus(school, e)} className="p-2.5 bg-white border border-slate-100 rounded-xl hover:bg-amber-50 text-slate-300 hover:text-amber-500 shadow-sm transition-all"><Power size={18} /></button>
            <button onClick={(e) => onDelete(school, e)} className="p-2.5 bg-white border border-slate-100 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 shadow-sm transition-all"><Trash2 size={18} /></button>
         </div>
      </div>

      <div className="space-y-2 mb-8">
         <Badge variant={school.status === 'active' ? 'success' : 'energy'} className="scale-90 -ml-1 py-1 px-3">
            {school.status === 'active' ? 'Unidade Operacional' : 'Em Manutenção'}
         </Badge>
         <h3 className="text-2xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors leading-tight uppercase tracking-tight">{school.name}</h3>
      </div>

      {/* Real Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-8">
         <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 text-center">
            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Alunos</div>
            <div className="text-lg font-black text-slate-800">{stats.studentCount}</div>
         </div>
         <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 text-center">
            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Profs</div>
            <div className="text-lg font-black text-slate-800">{stats.teacherCount}</div>
         </div>
         <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 text-center">
            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Turmas</div>
            <div className="text-lg font-black text-slate-800">{stats.classCount}</div>
         </div>
      </div>

      {/* Performance Score */}
      <div className="bg-slate-900 rounded-[2rem] p-5 mb-8 text-white relative overflow-hidden group-hover:bg-emerald-950 transition-colors">
         <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
         <div className="relative z-10 flex items-center justify-between">
            <div>
               <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">XP Médio Network</div>
               <div className="text-xl font-black flex items-center gap-2">
                  <Trophy size={18} className="text-amber-400" />
                  {stats.studentCount > 0 ? (stats.totalXp / stats.studentCount).toFixed(0) : 0}
               </div>
            </div>
            <div className="text-right">
               <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Nível Médio</div>
               <div className="text-lg font-black text-emerald-400">{stats.avgLevel}</div>
            </div>
         </div>
      </div>

      <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
         <div className="flex -space-x-3">
            {stats.topStudents.slice(0, 3).map(({ user, stat }) => (
              <div key={stat.id} className="w-9 h-9 rounded-full border-2 border-white bg-slate-100 overflow-hidden shadow-sm" title={user?.name}>
                 <img src={user?.avatar || '/avatars/default-capybara.png'} className="w-full h-full object-cover" />
              </div>
            ))}
            {stats.studentCount > 3 && (
              <div className="w-9 h-9 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-400">
                 +{stats.studentCount - 3}
              </div>
            )}
         </div>
         <div className="flex items-center gap-2 text-xs font-black text-emerald-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
            Dashboard Unit <ArrowUpRight size={16} />
         </div>
      </div>
    </Card>
  );
};

// ─── Main List Component ─────────────────────────────────────────────────────
export const Schools: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminMaster = user?.isMaster || user?.email === 'ivanrossi@outlook.com';
  const userSchoolId = user?.schoolId;

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolRecord | null>(null);

  const schools = useSupabaseQuery<any>('schools') || [];
  const users = useSupabaseQuery<any>('users') || [];
  const classes = useSupabaseQuery<any>('classes') || [];

  const filteredSchools = schools.filter(s => (isAdminMaster || s.id === userSchoolId) && s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalStudents = users.filter(u => u.role === 'student').length;
  const totalTeachers = users.filter(u => u.role === 'teacher').length;
  const totalActiveClasses = classes.length;

  const { register, handleSubmit, reset } = useForm<SchoolFormData>({ defaultValues: { status: 'active' } });

  const onSubmit = async (data: SchoolFormData) => {
    await supabase.from('schools').insert({ id: crypto.randomUUID(), ...data, usersCount: 0, globalScore: 0 });
    toast.success('Escola Cadastrada!');
    setIsAddOpen(false);
    reset();
  };

  const handleToggleStatus = async (school: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('schools').update({ status: school.status === 'active' ? 'inactive' : 'active' }).eq('id', school.id);
    toast.success('Status atualizado!');
  };

  const handleDelete = async (school: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Excluir ${school.name}?`)) {
      await supabase.from('schools').delete().eq('id', school.id);
      toast.success('Excluída!');
    }
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* List Header */}
      <header className="bg-slate-950 p-12 rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] -mr-32 -mt-32"></div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-12">
          <div className="space-y-4">
             <Badge variant="ai" className="bg-white/5 border-white/10 text-emerald-400 py-1.5 px-6 italic font-black uppercase tracking-[0.3em] scale-90 -ml-4">REDE DE ENSINO IMPACTO</Badge>
             <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">
               {isAdminMaster ? 'Centros de' : 'Unidade de'} <br/>
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">Inovação IA</span>
             </h1>
             <p className="text-slate-400 font-medium text-lg max-w-xl border-l-4 border-emerald-500 pl-6 py-2">Monitoramento inteligente de performance, engajamento e resultados acadêmicos em tempo real.</p>
          </div>
          
          <div className="flex flex-wrap gap-8 items-center">
             <div className="flex gap-4">
                <div className="bg-white/5 px-8 py-4 rounded-[2rem] border border-white/10 text-center backdrop-blur-md">
                   <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tokens Alunos</div>
                   <div className="text-3xl font-black text-emerald-400">{totalStudents}</div>
                </div>
                <div className="bg-white/5 px-8 py-4 rounded-[2rem] border border-white/10 text-center backdrop-blur-md">
                   <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Mestres</div>
                   <div className="text-3xl font-black text-amber-400">{totalTeachers}</div>
                </div>
                <div className="bg-white/5 px-8 py-4 rounded-[2rem] border border-white/10 text-center backdrop-blur-md">
                   <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nodes Acadêmicos</div>
                   <div className="text-3xl font-black text-indigo-400">{totalActiveClasses}</div>
                </div>
             </div>

             {isAdminMaster && (
               <Button onClick={() => setIsAddOpen(true)} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-[2rem] px-12 py-10 font-black text-lg shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                 <Plus size={28} className="mr-3" /> Expandir Rede
               </Button>
             )}
          </div>
        </div>
      </header>

      {/* Search & Stats */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-[2.5rem] py-5 px-16 text-lg font-bold outline-none focus:ring-4 focus:ring-primary-500/10 transition-all shadow-sm"
            placeholder="Buscar por nome da instituição..."
          />
        </div>
        <div className="bg-white px-8 py-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="text-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instituições</div>
              <div className="text-2xl font-black text-slate-800">{schools.length}</div>
           </div>
           <div className="w-px h-10 bg-slate-100" />
           <div className="text-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</div>
              <div className="text-2xl font-black text-green-500">100%</div>
           </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filteredSchools.map((school) => (
          <SchoolStatsCard 
            key={school.id}
            school={school}
            onClick={() => setSelectedSchool(school as any)}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
          />
        ))}

        {isAdminMaster && (
          <button 
            onClick={() => setIsAddOpen(true)} 
            className="p-12 border-4 border-dashed border-slate-100 rounded-[3rem] hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group flex flex-col items-center justify-center text-center space-y-4"
          >
             <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center text-slate-200 group-hover:text-emerald-500 group-hover:scale-110 transition-all border border-slate-100">
                <Plus size={40} />
             </div>
             <div>
                <div className="font-black text-slate-800 text-xl">Novo Centro</div>
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-2">{isAdminMaster ? 'Expandir Rede' : 'Adicionar Unidade'}</p>
             </div>
          </button>
        )}
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-10 border-b border-slate-100 flex justify-between items-center">
                 <h2 className="text-3xl font-black text-slate-800 tracking-tight">Nova Escola</h2>
                 <button onClick={() => setIsAddOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="p-10 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Nome da Instituição</label>
                    <input {...register('name', { required: true })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-primary-500/10" placeholder="Ex: Colégio Impacto" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Status Inicial</label>
                    <select {...register('status')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none appearance-none">
                       <option value="active">Ativa</option>
                       <option value="inactive">Manutenção</option>
                    </select>
                 </div>
                 <div className="pt-4 flex gap-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="flex-1 rounded-2xl py-6 font-black">Cancelar</Button>
                    <Button type="submit" variant="primary" className="flex-1 rounded-2xl py-6 font-black shadow-2xl shadow-primary-500/20">Criar Unidade</Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {selectedSchool && <SchoolDashboard school={selectedSchool} onClose={() => setSelectedSchool(null)} />}
    </div>
  );
};
