import React, { useState } from 'react';
import { 
  Trophy, 
  Search, 
  School as SchoolIcon,
  Users,
  TrendingUp,
  Filter,
  ChevronRight,
  Globe
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/auth.store';
import type { Student } from '../../types/user';

export const AdminRanking: React.FC = () => {
  const { user } = useAuthStore();
  const isAdminMaster = user?.isMaster || user?.email === 'ivanrossi@outlook.com';
  const userSchoolId = user?.schoolId;

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(isAdminMaster ? 'all' : (userSchoolId || ''));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'schools'>('students');

  const [schools, setSchools] = useState<any[]>([]);
  const [studentsRanking, setStudentsRanking] = useState<any[]>([]);
  const [schoolsRanking, setSchoolsRanking] = useState<any[]>([]);

  const fetchData = async () => {
    // 1. Schools
    const { data: allSchools } = await supabase.from('schools').select('*');
    if (allSchools) {
      setSchools(allSchools);
      // For Demo purposes, calculating globalScore on the fly if not present in DB.
      // Usually you'd use a derived value or calculate it here based on users' XP.
      // Easiest is to attach a dummy score or compute securely. In the DB some schools had "globalScore" field.
      // Let's compute it.
      const { data: allStudentsData } = await supabase.from('users').select('id, schoolId').eq('role', 'student');
      const { data: allStatsData } = await supabase.from('gamification_stats').select('id, xp');
      
      let schoolsRanked = [...allSchools];
      if (allStudentsData && allStatsData) {
         schoolsRanked = schoolsRanked.map(sch => {
            const schStudents = allStudentsData.filter(u => u.schoolId === sch.id);
            const studentIds = schStudents.map(s => s.id);
            const schStats = allStatsData.filter(st => studentIds.includes(st.id));
            const totalXp = schStats.reduce((sum, s) => sum + (s.xp || 0), 0);
            return {
               ...sch,
               globalScore: Math.floor(totalXp / 5) + (schStudents.length * 10),
               usersCount: schStudents.length
            };
         });
      }
      setSchoolsRanking(schoolsRanked.sort((a, b) => (b.globalScore || 0) - (a.globalScore || 0)));
    }

    // 2. Students
    let query = supabase.from('users').select('*').eq('role', 'student');
    if (selectedSchoolId !== 'all') {
      query = query.eq('schoolId', selectedSchoolId);
    }
    const { data: usersData } = await query;
    const { data: statsData } = await supabase.from('gamification_stats').select('*');
    const { data: classesData } = await supabase.from('classes').select('*');

    if (usersData && statsData && allSchools && classesData) {
      let filteredStudents = usersData;
      if (searchTerm) {
        filteredStudents = filteredStudents.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      const studentsWithStats = filteredStudents.map((s): Student & { xp: number; coins: number; level: number; schoolName: string; className: string } => {
        const stats = statsData.find(st => st.id === s.id);
        const school = allSchools.find(sch => sch.id === s.schoolId);
        const studentClass = classesData.find(c => c.id === s.classId);
        
        return { 
          ...s as Student, 
          xp: stats?.xp || 0, 
          coins: stats?.coins || 0, 
          level: stats?.level || 1,
          schoolName: school?.name || 'Sem Escola',
          className: studentClass?.name || (s as any).grade || 'S/ Turma'
        };
      });

      setStudentsRanking(studentsWithStats.sort((a, b) => b.xp - a.xp));
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [selectedSchoolId, searchTerm]);

  React.useEffect(() => {
     // Subscribe to real-time events that would shift rankings
     const ch = supabase.channel('admin_ranking')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'gamification_stats' }, fetchData)
       .subscribe();
     return () => { supabase.removeChannel(ch); };
  }, [selectedSchoolId, searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <header className="bg-slate-900 p-10 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
             <Badge variant="ai" className="bg-white/10 border-white/20 text-white border-0 py-1.5 px-4 tracking-[0.2em]">
               GAMIFICAÇÃO & DESEMPENHO
             </Badge>
             <h1 className="text-4xl font-black tracking-tight">
               Hall da <span className="text-primary-400">Fama</span>
             </h1>
             <p className="text-slate-400 font-medium">Acompanhe o engajamento e a evolução de alunos e instituições.</p>
          </div>
          
          <div className="flex bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 self-start md:self-center">
            <button 
              onClick={() => setActiveTab('students')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black transition-all gap-2 flex items-center",
                activeTab === 'students' ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30" : "text-slate-400 hover:text-white"
              )}
            >
              <Users size={14} /> Alunos
            </button>
            <button 
              onClick={() => setActiveTab('schools')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black transition-all gap-2 flex items-center",
                activeTab === 'schools' ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30" : "text-slate-400 hover:text-white"
              )}
            >
              <SchoolIcon size={14} /> Instituições
            </button>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <Card className="p-4 border-slate-100 flex flex-wrap items-center gap-4 bg-white/80 backdrop-blur-sm sticky top-4 z-20 shadow-sm">
        {isAdminMaster && (
          <div className="flex-1 min-w-[200px]">
             <div className="relative">
                <SchoolIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select 
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 appearance-none focus:outline-none focus:border-primary-300 transition-colors"
                >
                  <option value="all">Todas as Escolas</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
             </div>
          </div>
        )}
        
        <div className="flex-1 min-w-[250px]">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:border-primary-300 transition-colors"
              />
           </div>
        </div>

        <div className="flex items-center gap-2 px-2 text-slate-400">
           <Filter size={14} />
           <span className="text-[10px] font-black uppercase tracking-widest">Filtros Ativos</span>
        </div>
      </Card>

      {activeTab === 'students' ? (
        <div className="grid grid-cols-1 gap-4">
          {studentsRanking && studentsRanking.length > 0 ? (
            studentsRanking.map((student, i) => (
              <Card key={student.id} className={cn(
                "p-5 border-slate-100 hover:border-primary-100 transition-all flex items-center gap-6 group relative overflow-hidden",
                i === 0 && "bg-gradient-to-r from-amber-50/50 to-transparent border-amber-200"
              )}>
                {/* Position Marker */}
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0",
                  i === 0 ? "bg-amber-100 text-amber-600 shadow-inner" :
                  i === 1 ? "bg-slate-100 text-slate-500" :
                  i === 2 ? "bg-orange-50 text-orange-400" :
                  "bg-slate-50 text-slate-300"
                )}>
                  {i + 1}º
                </div>

                {/* Avatar Placeholder */}
                <div className="w-14 h-14 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                   {student.avatar ? (
                     <img src={student.avatar} alt="" className="w-full h-full object-cover" />
                   ) : (
                     <Users size={24} className="text-slate-300" />
                   )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-3">
                      <h4 className="text-lg font-black text-slate-800 truncate">{student.name}</h4>
                      {i === 0 && <Badge variant="ai" className="bg-amber-400 text-white border-0 py-0.5 px-2 text-[8px]">CAMPEÃO</Badge>}
                   </div>
                   <div className="flex items-center gap-4 mt-1">
                      <span className="text-[10px] font-black uppercase text-primary-500 tracking-widest">{student.schoolName}</span>
                      <span className="text-[10px] font-bold text-slate-400">{(student as any).className}</span>
                   </div>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-8 shrink-0 px-6 border-r border-slate-100">
                   <div className="text-center">
                      <div className="text-xl font-black text-slate-900 leading-none">{(student as any).xp.toLocaleString()}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">XP Total</div>
                   </div>
                   <div className="text-center">
                      <div className="text-xl font-black text-amber-500 leading-none">{(student as any).coins.toLocaleString()}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Moedas</div>
                   </div>
                   <div className="text-center">
                      <div className="text-xl font-black text-special-500 leading-none">{(student as any).level}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Nível</div>
                   </div>
                </div>

                {/* Action button */}
                <Button variant="ghost" size="sm" className="p-2 rounded-xl group-hover:bg-primary-50 group-hover:text-primary-500">
                   <ChevronRight size={20} />
                </Button>

                {i === 0 && (
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Trophy size={80} className="text-amber-500" />
                  </div>
                )}
              </Card>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
               <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
               <h3 className="text-lg font-black text-slate-600">Nenhum aluno encontrado</h3>
               <p className="text-slate-400 max-w-xs mx-auto mt-2">Tente ajustar seus filtros ou termos de pesquisa.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {schoolsRanking && schoolsRanking.map((school, i) => (
             <Card key={school.id} className="p-8 border-slate-100 hover:border-primary-200 hover:shadow-xl transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-primary-500/10 transition-colors"></div>
                
                <div className="flex justify-between items-start mb-8">
                   <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Globe size={28} />
                   </div>
                   <div className={cn(
                     "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm",
                     i === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                   )}>
                     {i + 1}º
                   </div>
                </div>

                <div className="space-y-2">
                   <h4 className="text-xl font-black text-slate-800">{school.name}</h4>
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Users size={12} /> {school.usersCount || 0} Usuários Ativos
                   </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-50 flex items-end justify-between">
                   <div>
                      <div className="text-3xl font-black text-slate-900 leading-none">{school.globalScore || 0}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Pontuação Global</div>
                   </div>
                   <div className="flex items-center gap-1 text-success-500 font-black text-xs">
                      <TrendingUp size={16} /> +12%
                   </div>
                </div>
             </Card>
           ))}
        </div>
      )}
    </div>
  );
};
