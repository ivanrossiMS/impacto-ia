import React, { useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
  import { supabase } from '../../lib/supabase';
import type { Student, AppUser, Guardian } from '../../types/user';
import {
  Trophy, Star, Crown, Medal, Users, ChevronDown, Target, Flame,
  TrendingUp, ArrowUpRight, Globe, School, ChevronRight
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { calculateLevel } from '../../lib/gamificationUtils';
import { StudentAvatarMini } from '../../components/ui/StudentAvatarMini';

export const Ranking: React.FC = () => {
  const { user: guardian } = useAuthStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'class' | 'school' | 'global'>('class');

  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [rankingEntries, setRankingEntries] = useState<any[]>([]);

  // Load linked students
  React.useEffect(() => {
    const fetchStudents = async () => {
      if (!guardian || guardian.role !== 'guardian') return;
      
      const { data: liveG } = await supabase.from('users').select('*').eq('id', guardian.id).single();
      const sidList = liveG?.studentIds || [];

      let linkedByGuardian: any[] = [];
      if (sidList.length > 0) {
        const { data } = await supabase.from('users').select('*').in('id', sidList);
        linkedByGuardian = data || [];
      }

      const { data: linkedByStudent } = await supabase.from('users').select('*').contains('guardianIds', [guardian.id]);
      
      const all = [...linkedByGuardian, ...(linkedByStudent || [])];
      const uniqueIds = new Set();
      const linked = all.filter(s => {
        if (s.role !== 'student' || uniqueIds.has(s.id)) return false;
        uniqueIds.add(s.id);
        return true;
      }) as Student[];
      
      setStudentsList(linked);
      if (linked.length > 0 && !selectedStudentId) {
        setSelectedStudentId(linked[0].id);
      }
    };
    fetchStudents();
  }, [guardian?.id]);

  const selectedStudent = studentsList.find(s => s.id === selectedStudentId);

  // Load Ranking Data based on tab and selected student
  React.useEffect(() => {
    const fetchRanking = async () => {
      if (!selectedStudent) {
        setRankingEntries([]);
        return;
      }

      let studentsToRank: AppUser[] = [];

      if (activeTab === 'class') {
        if (selectedStudent.classId) {
          // Query directly by classId — reliable, doesn't depend on class.studentIds[]
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('classId', selectedStudent.classId)
            .eq('role', 'student');
          studentsToRank = data || [];
        } else {
          // Student has no class — fallback to school
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('schoolId', selectedStudent.schoolId || '')
            .eq('role', 'student');
          studentsToRank = data || [];
        }
      } else if (activeTab === 'school') {
        const { data } = await supabase.from('users').select('*').eq('schoolId', selectedStudent.schoolId || '').eq('role', 'student');
        studentsToRank = data || [];
      } else {
        // Global
        const { data } = await supabase.from('users').select('*').eq('role', 'student');
        studentsToRank = data || [];
      }

      const ids = studentsToRank.map(s => s.id);
      let statsMap = new Map();
      if (ids.length > 0) {
         const { data: stats } = await supabase.from('gamification_stats').select('*').in('id', ids);
         if (stats) {
            statsMap = new Map(stats.map(s => [s.id, s]));
         }
      }

      // --- Fetch class names for each student ---
      const classIds = [...new Set(studentsToRank.map(s => (s as any).classId).filter(Boolean))];
      const classNameMap: Record<string, string> = {};
      if (classIds.length > 0) {
        const { data: classData } = await supabase.from('classes').select('id, name').in('id', classIds);
        (classData || []).forEach((c: any) => { classNameMap[c.id] = c.name; });
      }

      // --- Fetch avatar profiles + catalog for real avatar URLs ---
      let profilesData: any[] = [];
      let catalogData: any[] = [];
      if (ids.length > 0) {
        const [{ data: profiles }, { data: catalog }] = await Promise.all([
          supabase.from('student_avatar_profiles').select('studentId, selectedAvatarId').in('studentId', ids),
          supabase.rpc('get_avatar_catalog'),
        ]);
        profilesData = profiles || [];
        catalogData = catalog || [];
      }

      const entries = studentsToRank.map(s => {
        const profile = profilesData.find((p: any) => p.studentId === s.id);
        const avatarItem = catalogData.find((c: any) => c.id === profile?.selectedAvatarId);
        return ({
          user: s,
          stats: statsMap.get(s.id) || null,
          className: classNameMap[(s as any).classId || ''] || '',
          isMyChild: (guardian as Guardian)?.studentIds?.includes(s.id) || (s as Student).guardianIds?.includes(guardian?.id || '') || false,
          avatarUrl: (avatarItem as any)?.assetUrl || null,
        });
      });

      // Sort by XP
      const sorted = entries
        .sort((a, b) => (b.stats?.xp || 0) - (a.stats?.xp || 0))
        .map((e, i) => ({ ...e, rank: i + 1 }));
        
      setRankingEntries(sorted);
    };
    
    fetchRanking();
    
    const ch = supabase.channel('guardian_ranking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gamification_stats' }, fetchRanking)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedStudent, activeTab, guardian?.id]);

  const myChildEntry = rankingEntries.find(e => e.user.id === selectedStudentId);
  const top3 = rankingEntries.slice(0, 3);
  const others = rankingEntries.slice(3);

  const avatarColors = [
    'bg-primary-500', 'bg-indigo-500', 'bg-special-500',
    'bg-success-500', 'bg-warning-500', 'bg-teal-500'
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Header Section */}
      <header className="bg-slate-900 p-10 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <Badge variant="ai" className="bg-white/10 border-white/20 text-white border-0 py-1.5 px-4 tracking-[0.2em] font-black italic">
              HALL DA FAMA
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
              Elite <span className="text-primary-400">Impacto IA</span>
            </h1>
            <p className="text-slate-400 font-medium text-lg max-w-lg font-outfit">
              Acompanhe a evolução e a conquista de espaço de seus filhos no ecossistema de aprendizado.
            </p>
          </div>

          <div className="flex flex-col gap-4 shrink-0">
             {/* Student Selector */}
             {studentsList.length > 1 && (
               <div className="relative">
                 <select
                   value={selectedStudentId}
                   onChange={e => setSelectedStudentId(e.target.value)}
                   className="w-full md:w-64 appearance-none bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-12 font-black text-white focus:outline-none focus:border-primary-400 backdrop-blur-md transition-all cursor-pointer"
                 >
                   {studentsList.map(s => (
                     <option key={s.id} value={s.id} className="text-slate-900">{s.name}</option>
                   ))}
                 </select>
                 <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
               </div>
             )}

             {/* Tab Switcher */}
             <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg">
                {[
                  { id: 'class', label: 'Turma', icon: Users },
                  { id: 'school', label: 'Escola', icon: School },
                  { id: 'global', label: 'Global', icon: Globe }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === t.id ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <t.icon size={14} /> {t.label}
                  </button>
                ))}
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid lg:grid-cols-12 gap-10">
        
        {/* Ranking List */}
        <div className="lg:col-span-8 space-y-8">
           
           {/* Podium View */}
           <div className="flex flex-col items-center py-10">
              <div className="grid grid-cols-3 gap-6 items-end w-full max-w-2xl px-4">
                 
                 {/* 2nd Place */}
                 {top3[1] && (
                   <div className="flex flex-col items-center group">
                      <div className="relative mb-4">
                         <StudentAvatarMini
                            studentId={top3[1].user.id}
                            fallbackInitial={top3[1].user.name[0]}
                            fallbackColor={avatarColors[1]}
                            size={64}
                            shape="xl"
                            className="shadow-xl ring-4 ring-white rounded-xl"
                          />
                         <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 font-black shadow-sm">
                            <Medal size={16} />
                         </div>
                      </div>
                      <div className="text-center mb-4">
                         <div className="text-xs font-black text-slate-700 truncate max-w-[90px]">{top3[1].user.name.split(' ').slice(0,2).join(' ')}</div>
                       {top3[1].className && <div className="text-[9px] font-bold text-primary-500 uppercase tracking-wider">{top3[1].className}</div>}
                         <div className="text-[10px] font-bold text-slate-400">{top3[1].stats?.xp || 0} XP</div>
                      </div>
                      <div className="w-full h-24 bg-slate-100/50 rounded-t-[2rem] border-x-2 border-t-2 border-slate-200 flex items-end justify-center pb-4">
                         <span className="text-4xl font-black text-slate-200">2</span>
                      </div>
                   </div>
                 )}

                 {/* 1st Place */}
                 {top3[0] && (
                   <div className="flex flex-col items-center group -mt-10">
                      <div className="relative mb-6">
                         <Crown size={48} className="text-amber-400 absolute -top-12 left-1/2 -translate-x-1/2 animate-bounce fill-amber-400/20" />
                         <StudentAvatarMini
                            studentId={top3[0].user.id}
                            fallbackInitial={top3[0].user.name[0]}
                            fallbackColor={avatarColors[0]}
                            size={96}
                            shape="2xl"
                            className="shadow-[0_20px_40px_rgba(245,158,11,0.3)] ring-4 ring-white rounded-2xl relative z-10 transition-all group-hover:scale-110"
                          />
                         <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-full bg-white flex items-center justify-center text-amber-500 border-2 border-amber-100 font-black text-xl shadow-xl z-20">
                            1
                         </div>
                      </div>
                      <div className="text-center mb-6">
                         <div className="text-lg font-black text-slate-900 truncate max-w-[130px]">{top3[0].user.name.split(' ').slice(0,2).join(' ')}</div>
                         {top3[0].className && <div className="text-[9px] font-bold text-primary-500 uppercase tracking-wider mb-1">{top3[0].className}</div>}
                         <div className="text-xs font-bold text-amber-600 flex items-center gap-1 justify-center">
                            <Star size={14} fill="currentColor" /> {top3[0].stats?.xp || 0} XP
                         </div>
                         {top3[0].isMyChild && <Badge variant="primary" className="mt-2 py-0.5 text-[9px] scale-90">MEU FILHO</Badge>}
                      </div>
                      <div className="w-full h-36 bg-amber-50/50 rounded-t-[2.5rem] border-x-2 border-t-2 border-amber-200 flex items-end justify-center pb-6">
                         <Trophy size={48} className="text-amber-200" />
                      </div>
                   </div>
                 )}

                 {/* 3rd Place */}
                 {top3[2] && (
                   <div className="flex flex-col items-center group">
                      <div className="relative mb-4">
                         <StudentAvatarMini
                            studentId={top3[2].user.id}
                            fallbackInitial={top3[2].user.name[0]}
                            fallbackColor={avatarColors[2]}
                            size={64}
                            shape="xl"
                            className="shadow-xl ring-4 ring-white rounded-xl"
                          />
                         <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 border border-orange-100 font-black shadow-sm">
                            <Medal size={16} />
                         </div>
                      </div>
                      <div className="text-center mb-4">
                         <div className="text-xs font-black text-slate-700 truncate max-w-[90px]">{top3[2].user.name.split(' ').slice(0,2).join(' ')}</div>
                       {top3[2].className && <div className="text-[9px] font-bold text-primary-500 uppercase tracking-wider">{top3[2].className}</div>}
                         <div className="text-[10px] font-bold text-slate-400">{top3[2].stats?.xp || 0} XP</div>
                      </div>
                      <div className="w-full h-20 bg-orange-50/30 rounded-t-[2.5rem] border-x-2 border-t-2 border-orange-100 flex items-end justify-center pb-4">
                         <span className="text-4xl font-black text-orange-100">3</span>
                      </div>
                   </div>
                 )}
              </div>
           </div>

           {/* Full List */}
           <div className="space-y-4">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Alunos em Destaque</span>
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Evolução XP</span>
              </div>
              
              {others.length > 0 ? others.map((entry) => (
                <div 
                  key={entry.user.id}
                  className={cn(
                    "flex items-center justify-between p-5 rounded-3xl border transition-all hover:translate-x-1 duration-300",
                    entry.isMyChild 
                      ? "bg-primary-50 border-primary-200 shadow-md ring-1 ring-primary-100" 
                      : "bg-white border-slate-100 hover:border-primary-100"
                  )}
                >
                   <div className="flex items-center gap-6">
                      <span className={cn(
                        "w-8 text-center font-black text-lg",
                        entry.rank <= 10 ? "text-slate-800" : "text-slate-300"
                      )}>
                        {entry.rank}º
                      </span>
                      <StudentAvatarMini
                        studentId={entry.user.id}
                        fallbackInitial={entry.user.name[0]}
                        fallbackColor={avatarColors[entry.rank % avatarColors.length]}
                        size={48}
                        shape="2xl"
                      />
                      <div>
                        <h4 className={cn("font-black tracking-tight", entry.isMyChild ? "text-primary-700" : "text-slate-800")}>
                          {entry.user.name}
                          {entry.isMyChild && <Badge variant="primary" className="ml-2 py-0 h-5 text-[8px] uppercase tracking-widest shadow-sm">Meu Filho</Badge>}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400 flex-wrap">
                           <span className="flex items-center gap-1.5"><Target size={12} className="text-primary-500" /> Nível {entry.stats ? calculateLevel(entry.stats.xp) : 1}</span>
                           <span className="w-1 h-1 bg-slate-200 rounded-full" />
                           <span className="flex items-center gap-1.5 text-orange-500"><Flame size={12} /> {entry.stats?.streak || 0} dias</span>
                            {entry.className && (
                              <>
                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                <span className="text-primary-500 font-black">{entry.className}</span>
                              </>
                            )}
                        </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-right">
                         <div className="text-lg font-black text-slate-900 leading-none">{entry.stats?.xp || 0}</div>
                         <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">XP Total</div>
                      </div>
                      <Button variant="ghost" size="sm" className="p-2 rounded-xl group hover:bg-primary-50 hover:text-primary-500">
                         <ChevronRight size={18} />
                      </Button>
                   </div>
                </div>
              )) : rankingEntries.length <= 3 && (
                <div className="text-center py-10 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                   <p className="text-slate-400 text-xs font-bold font-outfit">Sem mais competidores no momento.</p>
                </div>
              )}
           </div>
        </div>

        {/* Sidebar Status */}
        <aside className="lg:col-span-4 space-y-8">
           
           {/* My Child Floating Card (Special insight) */}
           {myChildEntry && (
             <Card className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group border-none">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>
                
                <div className="relative z-10 space-y-6">
                   <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl font-black border border-white/20 shadow-xl">
                        {myChildEntry.rank}º
                      </div>
                      <div>
                        <h3 className="text-xl font-black">{selectedStudent?.name.split(' ').slice(0,2).join(' ')}</h3>
                        <div className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Estatísticas Reais</div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                         <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">XP Coletado</div>
                         <div className="text-2xl font-black text-white">{myChildEntry.stats?.xp || 0}</div>
                      </div>
                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                         <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Moedas</div>
                         <div className="text-2xl font-black text-amber-500">{myChildEntry.stats?.coins || 0}</div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                         <span>Próximo do Top {Math.max(1, myChildEntry.rank - 1)}</span>
                         <span className="text-primary-400">+150 XP necessário</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                         <div className="h-full bg-gradient-to-r from-primary-600 to-indigo-600 w-[65%] rounded-full shadow-[0_0_12px_rgba(99,102,241,0.5)]"></div>
                      </div>
                   </div>

                   <Button 
                     onClick={() => window.location.href = '/guardian/reports'}
                     variant="primary" 
                     className="w-full rounded-2xl py-6 font-black text-sm shadow-xl shadow-primary-500/20 group-hover:scale-[1.02] transition-all"
                   >
                     Impulsionar Estudo <ArrowUpRight size={18} className="ml-2" />
                   </Button>
                </div>
             </Card>
           )}

           {/* Insights Card */}
           <Card className="p-8 border-slate-100 bg-white shadow-xl flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-500 mb-6">
                 <TrendingUp size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-3">Engajamento Semanal</h3>
              <p className="text-slate-400 text-sm font-medium mb-8 font-outfit">
                Os alunos que mantêm uma sequência de mais de <span className="text-orange-500 font-bold">5 dias</span> tendem a subir 12% mais rápido no ranking.
              </p>
              
              <div className="w-full space-y-3">
                 {[
                   { label: 'Participação da Turma', val: '88%' },
                   { label: 'Média de XP/Dia', val: '450' }
                 ].map((stat, i) => (
                   <div key={i} className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{stat.label}</span>
                      <span className="text-xs font-black text-slate-800">{stat.val}</span>
                   </div>
                 ))}
              </div>
           </Card>

           {/* Feedback support */}
           <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shrink-0">
                 <Star size={20} />
              </div>
              <div className="flex-1 min-w-0">
                 <h4 className="text-xs font-black text-indigo-900 uppercase tracking-tight">Dica Impacto IA</h4>
                 <p className="text-[10px] font-bold text-indigo-700 mt-0.5 leading-snug">Elogie as conquistas semanais para aumentar a motivação!</p>
              </div>
           </div>

        </aside>
      </div>
    </div>
  );
};
