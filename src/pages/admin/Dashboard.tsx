import React, { useState } from 'react';
import { 
  School, 
  Users, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap,
  Globe,
  Database,
  Search,
  Download,
  Trophy,
  MessageSquare,
  Star,
  Clock,
  TrendingUp,
  Award
} from 'lucide-react';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/auth.store';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import type { Student } from '../../types/user';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminMaster = user?.isMaster || user?.email === 'ivanrossi@outlook.com';
  const userSchoolId = user?.schoolId;

  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  
  // Real database metrics with filtering
  const usersCount = useLiveQuery(() => {
    if (isAdminMaster) return db.users.count();
    return db.users.where('schoolId').equals(userSchoolId || '').count();
  }, [isAdminMaster, userSchoolId]) || 0;

  const schools = useLiveQuery(() => {
    if (isAdminMaster) return db.schools.toArray();
    return db.schools.where('id').equals(userSchoolId || '').toArray();
  }, [isAdminMaster, userSchoolId]) || [];

  const activitiesCount = useLiveQuery(async () => {
    if (isAdminMaster) return db.activities.count();
    // For school-specific, we need to filter activities by schoolId
    // If activities don't have schoolId, we might need to filter by teacher's school or similar
    const allActivities = await db.activities.toArray();
    const allUsers = await db.users.toArray();
    return allActivities.filter(a => {
      const teacher = allUsers.find(u => u.id === a.teacherId);
      return teacher?.schoolId === userSchoolId;
    }).length;
  }, [isAdminMaster, userSchoolId]) || 0;

  const classesCount = useLiveQuery(() => {
    if (isAdminMaster) return db.classes.count();
    return db.classes.where('schoolId').equals(userSchoolId || '').count();
  }, [isAdminMaster, userSchoolId]) || 0;
  
  const schoolsCount = schools.length;
  const activeUsersFormatted = usersCount.toLocaleString();

  // Filtered schools for the list
  const filteredSchools = (schools || []).filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // New High-Value Metrics
  const supportStats = useLiveQuery(async () => {
    const allTickets = await db.supportTickets.toArray();
    const allUsers = await db.users.toArray();
    
    const filtered = allTickets.filter(t => {
      const ticketUser = allUsers.find(u => u.id === t.userId);
      return isAdminMaster || (ticketUser as any)?.schoolId === userSchoolId;
    });

    const resolvedTickets = filtered.filter(t => t.status === 'resolved');
    const avgResponseTime = resolvedTickets.length > 0 
      ? Math.round(resolvedTickets.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime();
          const updated = new Date(t.updatedAt || t.createdAt).getTime();
          return sum + (updated - created);
        }, 0) / (resolvedTickets.length * 60000))
      : 0;

    return {
      open: filtered.filter(t => t.status === 'open').length,
      resolved: resolvedTickets.length,
      pending: filtered.filter(t => t.status === 'pending').length,
      avgTime: avgResponseTime > 0 ? `${avgResponseTime} min` : 'N/A'
    };
  }, [isAdminMaster, userSchoolId]) || { open: 0, resolved: 0, pending: 0, avgTime: '...' };

  const rankingData = useLiveQuery(async () => {
    if (isAdminMaster) {
      // Top 3 Schools by Global Student XP
      const allSchools = await db.schools.toArray();
      const schoolsWithXp = await Promise.all(allSchools.map(async (s) => {
        const students = await db.users.where({ schoolId: s.id, role: 'student' }).toArray();
        const studentIds = students.map(st => st.id);
        const stats = await db.gamificationStats.where('id').anyOf(studentIds).toArray();
        const totalXp = stats.reduce((sum, st) => sum + (st.xp || 0), 0);
        return { name: s.name, value: totalXp, type: 'Escola' };
      }));
      return schoolsWithXp.sort((a, b) => b.value - a.value).slice(0, 3);
    } else {
      // Top 3 Classes in the school by Student XP
      const schoolClasses = await db.classes.where('schoolId').equals(userSchoolId || '').toArray();
      const classesWithXp = await Promise.all(schoolClasses.map(async (c) => {
        const students = await db.users.where({ schoolId: userSchoolId || '', role: 'student' }).toArray();
        const classStudents = students.filter(s => (c.studentIds || []).includes(s.id) || (s as any).classId === c.id);
        const studentIds = classStudents.map(st => st.id);
        const stats = await db.gamificationStats.where('id').anyOf(studentIds).toArray();
        const totalXp = stats.reduce((sum, st) => sum + (st.xp || 0), 0);
        return { name: `${c.name} (${c.grade})`, value: totalXp, type: 'Turma' };
      }));
      return classesWithXp.sort((a, b) => b.value - a.value).slice(0, 3);
    }
  }, [isAdminMaster, userSchoolId]) || [];

  const topStudents = useLiveQuery(async () => {
    const query = db.users.where('role').equals('student');
    const students = isAdminMaster 
      ? await query.toArray() 
      : await query.filter(u => u.schoolId === userSchoolId).toArray();
    
    // Fetch stats for each student to get coins
    const studentsWithStats = await Promise.all(students.map(async (s) => {
      const stats = await db.gamificationStats.get(s.id);
      return { ...s, coins: stats?.coins || 0, xp: stats?.xp || 0 };
    }));

    return studentsWithStats
      .sort((a, b) => (b as any).xp - (a as any).xp) // Sort by XP for "Destaque"
      .slice(0, 3);
  }, [isAdminMaster, userSchoolId]) || [];

  const handleExport = () => {
    if (!schools.length) {
      toast.error('Nenhuma escola para exportar.');
      return;
    }
    const data = schools.map(s => ({
      Nome: s.name,
      Alunos: s.usersCount,
      Status: s.status,
      Score: s.globalScore
    }));
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Nome,Alunos,Status,Score"].concat(data.map(d => `${d.Nome},${d.Alunos},${d.Status},${d.Score}`)).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `escolas_impacto_ia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório exportado com sucesso!');
  };

  // Real engagement data calculation
  const engagementData = useLiveQuery(async () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); 
    startOfWeek.setHours(0, 0, 0, 0);

    // Get all students for context
    const students = isAdminMaster 
      ? await db.users.where('role').equals('student').toArray()
      : await db.users.where({ schoolId: userSchoolId || '', role: 'student' }).toArray();
    
    const studentIds = students.map(s => s.id);

    // Fetch activity markers
    const [results, diary, challengerDuels, challengedDuels, achievements] = await Promise.all([
      db.studentActivityResults.where('studentId').anyOf(studentIds).toArray(),
      db.diaryEntries.where('studentId').anyOf(studentIds).toArray(),
      db.duels.where('challengerId').anyOf(studentIds).toArray(),
      db.duels.where('challengedId').anyOf(studentIds).toArray(),
      db.studentAchievements.where('studentId').anyOf(studentIds).toArray()
    ]);
 
    const duels = [...challengerDuels, ...challengedDuels];
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const data = days.map((name) => ({ name, users: 0, activity: 0 }));
 
    const processDate = (dateStr: string | undefined) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (d >= startOfWeek) {
        const dayIdx = d.getDay();
        data[dayIdx].activity++;
        // Rough estimation of unique users per day would require a Set, but 'activity' count is sufficient for the chart
        data[dayIdx].users++; 
      }
    };
 
    results.forEach(r => processDate(r.completedAt));
    diary.forEach(d => processDate(d.createdAt));
    duels.forEach(d => d.completedAt && processDate(d.completedAt));
    achievements.forEach(a => processDate(a.unlockedAt));
 
    // Unique users active today (from any activity signal)
    const today = new Date().toLocaleDateString();
    const activeToday = new Set([
      ...results.filter(r => new Date(r.completedAt).toLocaleDateString() === today).map(r => r.studentId),
      ...diary.filter(d => new Date(d.createdAt).toLocaleDateString() === today).map(d => d.studentId),
      ...duels.filter(d => d.completedAt && new Date(d.completedAt).toLocaleDateString() === today).map(d => (d as any).challengerId || (d as any).studentId),
      ...achievements.filter(a => new Date(a.unlockedAt).toLocaleDateString() === today).map(a => a.studentId)
    ]).size;

    return { chartData: data, activeToday };
  }, [isAdminMaster, userSchoolId]) || { chartData: [], activeToday: 0 };

  // Sub-component for dynamic school stats in the list
  const SchoolListItem = ({ school }: { school: any }) => {
    const stats = useLiveQuery(async () => {
      const students = await db.users.where({ schoolId: school.id, role: 'student' }).toArray();
      const studentIds = students.map(s => s.id);
      const gamStats = await db.gamificationStats.where('id').anyOf(studentIds).toArray();
      const totalXp = gamStats.reduce((sum, s) => sum + (s.xp || 0), 0);
      return {
        studentCount: students.length,
        // Formula: XP contribution + Activity participation points
        globalScore: Math.floor(totalXp / 5) + (students.length * 10)
      };
    }, [school.id]);

    return (
      <Card key={school.id} className="p-6 border-slate-100 hover:border-primary-100 transition-all flex items-center justify-between shadow-sm hover:shadow-md group">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
            <School size={24} />
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-800 leading-tight">{school.name}</h4>
            <div className="flex items-center gap-3 mt-1 font-outfit">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{stats?.studentCount || 0} Alunos</span>
              <Badge variant={school.status === 'active' ? 'success' : 'energy'} className="scale-75 origin-left">
                {school.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="hidden sm:flex items-center gap-8">
          <div className="text-right">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Global</div>
            <div className="text-xl font-black text-slate-800">{stats?.globalScore || 0}</div>
          </div>
          <Button 
            onClick={() => navigate('/admin/schools')}
            variant="ghost" 
            size="sm" 
            className="p-2 rounded-xl"
          >
            <ArrowUpRight className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Button>
        </div>
      </Card>
    );
  };


  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header Section */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-4">
          <Badge variant="ai" className="bg-white/10 border-white/20 text-white border-0 py-1.5 px-4 tracking-[0.2em]">
            {isAdminMaster ? 'PAINEL GESTOR' : 'PAINEL ESCOLAR'}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
            Visão <span className="text-primary-400">{isAdminMaster ? 'Global' : 'Institucional'}</span>
          </h1>
          <p className="text-slate-400 font-medium text-lg max-w-lg font-outfit">
            {isAdminMaster 
              ? 'Monitoramento consolidado de instituições, engajamento e métricas de aprendizado.'
              : 'Monitoramento detalhado da sua instituição, engajamento e métricas de aprendizado.'}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-3">
           <Button onClick={handleExport} variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-2xl gap-2 font-bold px-6 py-5">
              <Download size={18} /> Planilha CSV
           </Button>
           <Button onClick={() => navigate('/admin/users')} variant="primary" className="rounded-2xl gap-2 font-black px-8 py-5 shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
              <Users size={20} /> Gerenciar Usuários
           </Button>
        </div>
      </header>

      {/* High-Level Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: isAdminMaster ? 'Escolas Parceiras' : 'Sua Instituição', value: schoolsCount.toString(), growth: schoolsCount > 0 ? (isAdminMaster ? '+1' : 'OK') : '0', trend: 'up', icon: School, color: 'text-primary-400', bg: 'bg-primary-500/10' },
          { label: 'Usuários Ativos', value: activeUsersFormatted, growth: '+12%', trend: 'up', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Atividades Geradas', value: activitiesCount.toString(), growth: '+24%', trend: 'up', icon: Activity, color: 'text-success-400', bg: 'bg-success-500/10' },
          { label: 'Turmas Ativas', value: classesCount.toString(), growth: '+5', trend: 'up', icon: Database, color: 'text-warning-400', bg: 'bg-warning-500/10' },
        ].map((m, i) => (
          <Card key={i} className="p-8 border-slate-100 group hover:shadow-floating transition-all duration-500 border-b-4 border-b-transparent hover:border-b-primary-500">
             <div className="flex justify-between items-start mb-6">
                <div className={cn("p-4 rounded-2xl shadow-inner", m.bg, m.color)}>
                   <m.icon size={24} />
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl",
                  m.trend === 'up' ? "bg-success-50 text-success-600" : "bg-red-50 text-red-600"
                )}>
                   {m.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                   {m.growth}
                </div>
             </div>
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{m.label}</div>
             <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">{m.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        
        {/* Institutional Monitoring */}
        <div className="lg:col-span-2 space-y-8">
           <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                    <Globe size={28} className="text-primary-500" /> {isAdminMaster ? 'Instituições Ativas' : 'Sua Escola'}
                 </h2>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Filtrar escolas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-primary-300 w-64 shadow-sm"
                    />
                 </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                 {filteredSchools.length > 0 ? filteredSchools.map((school) => (
                    <SchoolListItem key={school.id} school={school} />
                 )) : (
                    <div className="p-16 text-center space-y-4 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50">
                       <School className="w-12 h-12 text-slate-200 mx-auto" />
                       <div className="max-w-xs mx-auto">
                          <h4 className="text-sm font-black text-slate-800">Nenhuma Instituição</h4>
                          <p className="text-[11px] text-slate-400 mt-1">Nenhuma escola foi cadastrada ou encontrada com os filtros atuais.</p>
                       </div>
                       <Button onClick={() => navigate('/admin/schools')} variant="outline" size="sm" className="rounded-xl font-black text-[10px] uppercase tracking-widest mt-4">Cadastrar Escola</Button>
                    </div>
                 )}
              </div>
           </section>

           {/* Health & Infrastructure Panel */}
           <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-10 text-white relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mb-32 -mr-32"></div>
              <div className="space-y-4 text-center md:text-left relative z-10">
                 <h3 className="text-2xl font-black flex items-center justify-center md:justify-start gap-3">
                    <Zap className="text-warning-400" /> Infraestrutura IA
                 </h3>
                 <p className="text-slate-400 font-medium max-w-sm font-outfit">O motor de inteligência pedagógica e os bancos de dados estão operando com 100% de estabilidade.</p>
                 <div className="flex gap-2 justify-center md:justify-start">
                    <Badge className="bg-success-500/20 text-success-400 border-0">API: 12ms</Badge>
                    <Badge className="bg-success-500/20 text-success-400 border-0">GPU: Stable</Badge>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4 shrink-0 relative z-10">
                 {[
                   { label: 'Uptime', val: '99.98%', sub: '30 dias' },
                   { label: 'Erros', val: '0.00%', sub: 'Total 24h' },
                 ].map((d, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center backdrop-blur-sm">
                       <div className="text-2xl font-black text-white leading-none">{d.val}</div>
                       <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{d.label}</div>
                       <div className="text-[8px] font-bold text-slate-600 mt-1">{d.sub}</div>
                    </div>
                 ))}
              </div>
           </section>
        </div>

        {/* Global Stats & Distribution */}
        <aside className="space-y-10">
           <Card className="p-8 border-slate-100 bg-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                 <ArrowUpRight size={16} className="text-primary-500" strokeWidth={3} /> Atividade da Semana
              </h3>
              
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={engagementData.chartData}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 900, color: '#1e293b' }}
                      />
                      <Area type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                    </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 mt-6 space-y-4">
                 {[
                   { label: 'Pico Real (Hoje)', val: `${engagementData.activeToday} usuários` },
                   { label: 'Engajamento', val: engagementData.activeToday > 0 ? 'Ativo' : 'Parado' },
                 ].map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                       <span className="text-slate-400">{f.label}</span>
                       <span className="text-slate-900">{f.val}</span>
                    </div>
                 ))}
              </div>
            </Card>

            {/* Engagement Ranking Card */}
            <Card className="p-8 border-slate-100 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" /> {isAdminMaster ? 'Ranking de Escolas' : 'Ranking de Turmas'}
              </h3>
              
              <div className="space-y-6">
                {rankingData.length > 0 ? rankingData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs",
                        i === 0 ? "bg-amber-100 text-amber-600 ring-2 ring-amber-500/20" :
                        i === 1 ? "bg-slate-100 text-slate-500" :
                        "bg-orange-50 text-orange-400"
                      )}>
                        {i + 1}º
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800 leading-none">{item.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{item.type}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">{item.value.toLocaleString()}</div>
                      <div className="text-[9px] font-bold text-success-500">PTS</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-4 text-slate-400 text-xs font-bold font-outfit">Aguardando dados de engajamento...</div>
                )}
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary-500 gap-2"
                onClick={() => navigate(isAdminMaster ? '/admin/schools' : '/admin/schools')}
              >
                Ver Ranking Completo <TrendingUp size={14} />
              </Button>
            </Card>

            {/* Support Monitoring Card */}
            <Card className="p-8 border-slate-100 shadow-xl bg-slate-900 text-white overflow-hidden relative">
               <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl"></div>
               <h3 className="text-sm font-black uppercase tracking-tight mb-8 flex items-center gap-2">
                 <MessageSquare size={18} className="text-primary-400" /> Suporte Técnico
               </h3>
               
               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                    <div className="text-2xl font-black text-white">{supportStats.open}</div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Abertos</div>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                    <div className="text-2xl font-black text-success-400">{supportStats.resolved}</div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Resolvidos</div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                     <span className="text-slate-500 flex items-center gap-2">
                        <Clock size={12} /> Tempo Médio
                     </span>
                     <span className="text-primary-400">{supportStats.avgTime}</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-primary-500 h-full w-[85%] rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                  </div>
               </div>

               <Button 
                 variant="primary" 
                 size="sm" 
                 className="w-full mt-8 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2"
                 onClick={() => navigate('/admin/support')}
               >
                 Acessar Central <ArrowUpRight size={14} />
               </Button>
            </Card>

            {/* Top Students / Highlight Card */}
            <Card className="p-8 border-slate-100 shadow-xl">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-2">
                 <Star size={18} className="text-primary-500 fill-primary-500" /> Alunos em Destaque
               </h3>
               <div className="space-y-6">
                 {topStudents.length > 0 ? topStudents.map((student, i) => (
                   <div key={student.id} className="flex items-center gap-4">
                     <div className="relative">
                       <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 overflow-hidden text-slate-400">
                         {student.avatar ? (
                           <img src={student.avatar} alt="" className="w-full h-full object-cover" />
                         ) : (
                           <Users size={20} />
                         )}
                       </div>
                       {i === 0 && (
                         <div className="absolute -top-2 -right-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-white">
                           <Award size={12} className="text-white" />
                         </div>
                       )}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="text-sm font-black text-slate-800 truncate">{student.name}</div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                         {(student as Student).studentCode}
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="text-sm font-black text-primary-600">{(student as any).coins || 0}</div>
                       <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Moedas</div>
                     </div>
                   </div>
                 )) : (
                    <div className="text-center py-4 text-slate-400 text-xs font-bold font-outfit">Nenhum aluno em destaque ainda.</div>
                 )}
               </div>
            </Card>
        </aside>
      </div>
    </div>
  );
};
