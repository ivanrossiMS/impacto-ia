import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Student } from '../../types/user';
import type { GamificationStats, StudentAchievement, Achievement, StudentMissionProgress, Mission, StudentActivityResult } from '../../types/gamification';
import type { Activity } from '../../types/learning';
import type { StudentAvatarProfile, AvatarCatalogItem } from '../../types/avatar';

import { useAuthStore } from '../../store/auth.store';
import {
  TrendingUp,
  Trophy,
  Flame,
  Star,
  Target,
  CheckCircle2,
  Circle,
  Award,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Users,
  Zap,
  BookOpen,
  X
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { XPProgressBar } from '../../components/ui/XPProgressBar';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';
import { cn } from '../../lib/utils';
import { calculateLevel, getLevelProgress } from '../../lib/gamificationUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type StudentFull = {
  student: Student;
  stats: GamificationStats | null;
  profile: StudentAvatarProfile | null;
  achievements: (StudentAchievement & { detail?: Achievement })[];
  missions: (StudentMissionProgress & { detail?: Mission })[];
  activityResults: (StudentActivityResult & { detail?: Activity })[];
  className?: string;
  grade?: string;
};

// Removed hardcoded XP_PER_LEVEL

const getEngagementLabel = (streak: number) => {
  if (streak >= 14) return { label: 'Lenda 🏆', color: 'bg-special-100 text-special-700', bar: 100 };
  if (streak >= 7)  return { label: 'Excelente 🚀', color: 'bg-success-100 text-success-700', bar: 85 };
  if (streak >= 3)  return { label: 'Bom 👍', color: 'bg-primary-100 text-primary-700', bar: 65 };
  if (streak >= 1)  return { label: 'Regular ⚡', color: 'bg-warning-100 text-warning-700', bar: 40 };
  return { label: 'Inativo 😴', color: 'bg-red-100 text-red-600', bar: 10 };
};

const generateXPChartData = (
  activityResults: (StudentActivityResult & { detail?: Activity })[],
  achievements: (StudentAchievement & { detail?: Achievement })[]
) => {
  const now = new Date();
  const weeks = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Atual'];
  const buckets = new Array(5).fill(0);
  
  const getWeekIndex = (dateStr: string) => {
    const d = new Date(dateStr);
    // Find how many weeks ago this was relative to "now"
    // Simplified: index 4 is this week, index 3 is last week, etc.
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0,0,0,0);

    const diffWeeks = Math.floor((startOfThisWeek.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
    
    if (d >= startOfThisWeek) return 4; // Atual
    if (diffWeeks === 1) return 3; // Sem 4
    if (diffWeeks === 2) return 2; // Sem 3
    if (diffWeeks === 3) return 1; // Sem 2
    if (diffWeeks === 4) return 0; // Sem 1
    return -1;
  };

  activityResults.forEach(res => {
    if (res.completedAt) {
      const idx = getWeekIndex(res.completedAt);
      if (idx !== -1) buckets[idx] += (res.xpEarned || 0);
    }
  });

  achievements.forEach(ach => {
    if (ach.unlockedAt) {
      const idx = getWeekIndex(ach.unlockedAt);
      if (idx !== -1) buckets[idx] += (ach.detail?.rewardXp || 0);
    }
  });

  return weeks.map((week, i) => ({
    week,
    xp: buckets[i]
  }));
};

const ActivityReviewModal: React.FC<{
  result: StudentActivityResult & { detail?: Activity };
  onClose: () => void;
}> = ({ result, onClose }) => {
  if (!result || !result.detail) return null;

  const detail = result.detail;
  // Normalize questions (handle single question and teacher created with q.text)
  const normalizedQuestions = (detail.questions || (detail.questionText ? [detail] : [])).map((q: any, i: number) => {
    const isTeacherStyle = !!q.text && !q.questionText;
    return {
      ...q,
      id: q.id || String(i),
      questionText: isTeacherStyle ? q.text : q.questionText,
      options: (q.options || []).map((opt: any, optIdx: number) => {
        if (typeof opt === 'string') {
          return {
            id: String(optIdx),
            text: opt,
            isCorrect: String(optIdx) === q.answer || (q.type === 'true_false' && q.answer === opt.toLowerCase())
          };
        }
        return opt;
      })
    };
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-[2.5rem] shadow-2xl border-none">
        <div className="p-8 bg-gradient-to-r from-primary-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-2xl font-black">{detail.title}</h3>
            <p className="text-primary-100 text-sm font-medium">Revisão Detalhada da Atividade</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
          <div className="grid grid-cols-3 gap-4">
             <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center">
               <div className="text-2xl font-black text-primary-600">{result.score}/{result.totalQuestions}</div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pontuação</div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center">
               <div className="text-2xl font-black text-warning-500">+{result.xpEarned || 0}</div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">XP Ganho</div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center">
               <div className="text-2xl font-black text-success-500">{result.status === 'passed' ? 'Sucesso' : 'Falha'}</div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</div>
             </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Questões e Respostas</h4>
            {normalizedQuestions.map((q, idx) => {
              const response = result.responses?.find(r => r.questionId === q.id);

              return (
                <div key={q.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
                   <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 shrink-0">
                        {idx + 1}
                     </div>
                     <p className="font-bold text-slate-700 leading-relaxed">{q.questionText}</p>
                   </div>

                   <div className="grid grid-cols-1 gap-2 pl-12">
                      {q.options?.map((opt: any) => {
                        const isSelected = opt.id === response?.selectedOptionId;
                        const isCorrect = opt.isCorrect;
                        
                        let bgColor = "bg-slate-50";
                        let borderColor = "border-slate-100";
                        let textColor = "text-slate-600";

                        if (isSelected) {
                          if (isCorrect) {
                            bgColor = "bg-success-50";
                            borderColor = "border-success-200";
                            textColor = "text-success-700";
                          } else {
                            bgColor = "bg-red-50";
                            borderColor = "border-red-200";
                            textColor = "text-red-700";
                          }
                        } else if (isCorrect && response) {
                          bgColor = "bg-success-50/30";
                          borderColor = "border-success-100";
                          textColor = "text-success-600";
                        }

                        return (
                          <div key={opt.id} className={cn(
                            "p-3 rounded-xl border text-[11px] font-bold flex justify-between items-center",
                            bgColor, borderColor, textColor
                          )}>
                            {opt.text}
                            {isSelected && (isCorrect ? <CheckCircle2 size={14} /> : <Zap size={14} />)}
                            {!isSelected && isCorrect && response && <CheckCircle2 size={14} className="opacity-50" />}
                          </div>
                        );
                      })}
                   </div>

                   {response ? (
                     <div className={cn(
                       "mt-4 p-3 rounded-xl text-[10px] font-black text-center flex items-center justify-center gap-2",
                       response.isCorrect ? "bg-success-50 text-success-700" : "bg-red-50 text-red-700"
                     )}>
                       {response.isCorrect ? "O aluno acertou esta questão! ✅" : "O aluno errou esta questão. ❌"}
                     </div>
                   ) : (
                     <div className="mt-4 p-3 rounded-xl bg-slate-100 text-slate-400 text-[10px] font-black text-center">
                        DETALHES DE RESPOSTA NÃO DISPONÍVEIS
                     </div>
                   )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};

export const Reports: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedResult, setSelectedResult] = useState<(StudentActivityResult & { detail?: Activity }) | null>(null);

  const [catalog, setCatalog] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<StudentFull[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportsData = async () => {
    if (!user || user.role !== 'guardian') {
      setLoading(false);
      return;
    }

    try {
      const { data: liveG } = await supabase.from('users').select('*').eq('id', user.id).single();
      const sidList = liveG?.studentIds || [];

      let linkedByGuardian: any[] = [];
      if (sidList.length > 0) {
        const { data } = await supabase.from('users').select('*').in('id', sidList);
        linkedByGuardian = data || [];
      }
      
      const { data: linkedByStudent } = await supabase.from('users').select('*').contains('guardianIds', [user.id]);
      
      const all = [...linkedByGuardian, ...(linkedByStudent || [])];
      const uniqueIds = new Set();
      const students = all.filter(s => {
        if (s.role !== 'student' || uniqueIds.has(s.id)) return false;
        uniqueIds.add(s.id);
        return true;
      }) as Student[];

      if (students.length === 0) {
        setStudentsData([]);
        setLoading(false);
        return;
      }

      const [
        { data: allAchievDefs },
        { data: allMissionDefs },
        { data: allActivityDefs },
        { data: allCatalog }
      ] = await Promise.all([
        supabase.from('achievements').select('*'),
        supabase.from('missions').select('*'),
        supabase.from('activities').select('*'),
        supabase.from('avatar_catalog').select('*')
      ]);

      setCatalog(allCatalog || []);

      const studentIds = students.map(s => s.id);

      const [
        { data: statsData },
        { data: profilesData },
        { data: studentAchievsData },
        { data: studentMissionsData },
        { data: studentResultsData },
        { data: classesData }
      ] = await Promise.all([
        supabase.from('gamification_stats').select('*').in('id', studentIds),
        supabase.from('student_avatar_profiles').select('*').in('id', studentIds),
        supabase.from('student_achievements').select('*').in('studentId', studentIds),
        supabase.from('student_missions').select('*').in('studentId', studentIds),
        supabase.from('student_activity_results').select('*').in('studentId', studentIds),
        supabase.from('classes').select('*')
      ]);

      const enrichedStudents: StudentFull[] = students.map(student => {
        const stats = statsData?.find(s => s.id === student.id) || null;
        const profile = profilesData?.find(p => p.id === student.id) || null;
        
        const rawAch = studentAchievsData?.filter(a => a.studentId === student.id) || [];
        const achievements = rawAch.map(sa => ({
          ...sa,
          detail: allAchievDefs?.find(a => a.id === sa.achievementId)
        }));

        const rawMissions = studentMissionsData?.filter(m => m.studentId === student.id) || [];
        const missions = rawMissions.map(sm => ({
          ...sm,
          detail: allMissionDefs?.find(m => m.id === sm.missionId)
        }));

        const rawResults = studentResultsData?.filter(r => r.studentId === student.id) || [];
        const activityResults = rawResults.map(r => ({
          ...r,
          detail: allActivityDefs?.find(a => a.id === r.activityId)
        }));

        const schoolClass = classesData?.find(c => c.id === student.classId) || null;

        return { 
          student, 
          stats, 
          profile, 
          achievements, 
          missions, 
          activityResults, 
          className: schoolClass?.name, 
          grade: student.grade 
        };
      });

      setStudentsData(enrichedStudents);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
    const ch = supabase.channel('guardian_reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_activity_results' }, fetchReportsData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    if (studentsData.length > 0 && !selectedStudentId) {
      setSelectedStudentId(studentsData[0].student.id);
    }
  }, [studentsData, selectedStudentId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (studentsData.length === 0) {
    return (
      <div className="text-center py-20">
        <Users className="mx-auto text-slate-200 mb-6" size={64} />
        <h2 className="text-2xl font-black text-slate-400">Nenhum aluno vinculado</h2>
        <p className="text-slate-300 mt-2">Vincule um aluno no menu "Meus Filhos" para ver o desempenho.</p>
      </div>
    );
  }

  const selected = studentsData.find((d: StudentFull) => d.student.id === selectedStudentId) || studentsData[0];
  const { student, stats, profile, achievements, missions } = selected;
  
  const activeAvatar = catalog.find(i => i.id === profile?.selectedAvatarId);
  const activeBg = catalog.find(i => i.id === profile?.selectedBackgroundId);
  const activeBorder = catalog.find(i => i.id === profile?.selectedBorderId);
  const activeStickers = profile?.equippedStickerIds
    ?.map((id: string) => catalog.find((i: AvatarCatalogItem) => i.id === id)?.assetUrl)
    .filter((url: string | undefined): url is string => !!url) || [];

  const engagement = getEngagementLabel(stats?.streak || 0);
  const xpChartData = generateXPChartData(selected.activityResults, achievements);
  const completedMissions = missions.filter(m => !!m.completedAt).length;
  const totalMissions = missions.length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary-500">
            <BarChart3 size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Central de Relatórios</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">
            Desempenho <span className="text-primary-600">Detalhado</span>
          </h1>
          <p className="text-slate-500 font-medium">Acompanhe o progresso, conquistas e missões do seu filho em tempo real.</p>
        </div>

        {studentsData.length > 1 && (
          <div className="relative">
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="appearance-none bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 pr-12 font-black text-slate-800 focus:outline-none focus:border-primary-400 shadow-sm cursor-pointer"
            >
              {studentsData.map((d: StudentFull) => (
                <option key={d.student.id} value={d.student.id}>{d.student.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
          </div>
        )}
      </header>

      <Card className="p-0 overflow-hidden rounded-[2.5rem] border-2 border-slate-100">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-shrink-0">
            <AvatarComposer
              avatarUrl={activeAvatar?.assetUrl || '/avatars/default-impacto.png'}
              backgroundUrl={activeBg?.assetUrl}
              borderUrl={activeBorder?.assetUrl}
              stickerUrls={activeStickers}
              size="lg"
            />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-black text-white">{student.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2 justify-center md:justify-start">
              {student.grade && <Badge variant="primary">{student.grade}</Badge>}
              {selected.className && <Badge variant="outline">{selected.className}</Badge>}
              <span className={cn('px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider', engagement.color)}>
                {engagement.label}
              </span>
            </div>
            <div className="mt-6 max-w-sm">
              {stats && (() => {
                const progress = getLevelProgress(stats.xp);
                return (
                  <XPProgressBar
                    currentXP={progress.xpInLevel}
                    targetXP={progress.xpNextLevel}
                    level={progress.level}
                  />
                );
              })()}
              {!stats && <XPProgressBar currentXP={0} targetXP={100} level={1} />}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Nível', value: stats ? calculateLevel(stats.xp) : 1, icon: Star, color: 'text-special-400' },
              { label: 'XP Total', value: (stats?.xp || 0).toLocaleString('pt-BR'), icon: Zap, color: 'text-warning-400' },
              { label: 'Streak', value: `${stats?.streak || 0}d 🔥`, icon: Flame, color: 'text-energy-400' },
              { label: 'Moedas', value: `${stats?.coins || 0} 🪙`, icon: Trophy, color: 'text-warning-300' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/10">
                <kpi.icon size={20} className={cn('mx-auto mb-2', kpi.color)} />
                <div className="text-xl font-black text-white">{kpi.value}</div>
                <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8 rounded-[2rem] border-2 border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <TrendingUp className="text-primary-500" size={24} /> Evolução de XP
              </h3>
              <Badge variant="outline">Últimas 5 semanas</Badge>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={xpChartData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', fontWeight: 700 }}
                  formatter={(val) => [`${Number(val).toLocaleString('pt-BR')} XP`, 'XP Acumulado']}
                />
                <Bar dataKey="xp" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-8 rounded-[2rem] border-2 border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Target className="text-indigo-500" size={24} /> Missões
              </h3>
              <div className="text-sm font-black text-slate-400">
                {completedMissions}/{totalMissions} concluídas
              </div>
            </div>
            {missions.length === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <Target size={40} className="mx-auto mb-3" />
                <p className="font-bold text-sm">Nenhuma missão registrada ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {missions.slice(0, 6).map((m: any, i: number) => (
                  <div key={i} className={cn(
                    'flex items-center gap-4 p-4 rounded-2xl border transition-all',
                    m.completedAt ? 'bg-success-50/50 border-success-100' : 'bg-slate-50 border-slate-100'
                  )}>
                    {m.completedAt
                      ? <CheckCircle2 size={20} className="text-success-500 flex-shrink-0" />
                      : <Circle size={20} className="text-slate-300 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-slate-700 text-sm truncate">{m.detail?.title || 'Missão'}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {m.detail?.type || 'Diária'} · {m.completedAt ? 'Concluída' : `${m.currentCount}/${m.detail?.targetCount || 1}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Activity Results Detailed Card */}
          <Card className="p-8 rounded-[2rem] border-2 border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <BookOpen size={100} />
            </div>
            
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <BarChart3 className="text-primary-500" size={24} /> Atividades Realizadas
                </h3>
                <p className="text-slate-500 font-medium text-xs mt-1">Clique em uma atividade para revisar.</p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xl font-black text-primary-600">
                    {selected.activityResults.length > 0 
                      ? Math.round((selected.activityResults.filter((r: StudentActivityResult) => r.status === 'passed').length / selected.activityResults.length) * 100) 
                      : 0}%
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eficiência</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-success-50 border border-success-100 rounded-2xl p-4 text-center">
                 <div className="text-2xl font-black text-success-700">{selected.activityResults.filter((r: StudentActivityResult) => r.status === 'passed').length}</div>
                 <div className="text-[9px] font-black text-success-600/70 uppercase tracking-wider">Concluídas</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                 <div className="text-2xl font-black text-red-700">{selected.activityResults.filter((r: StudentActivityResult) => r.status === 'failed').length}</div>
                 <div className="text-[9px] font-black text-red-600/70 uppercase tracking-wider">Falhas</div>
              </div>
              <div className="bg-slate-900 rounded-2xl p-4 text-center text-white">
                 <div className="text-2xl font-black text-primary-400">{selected.activityResults.length}</div>
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total</div>
              </div>
            </div>

            {selected.activityResults.length > 0 && (
              <div className="space-y-3">
                {[...selected.activityResults].slice(-5).reverse().map((res: any, i: number) => (
                  <button 
                    key={res.id || i} 
                    onClick={() => setSelectedResult(res)}
                    className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-primary-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        res.status === 'passed' ? "bg-success-100 text-success-600" : "bg-red-100 text-red-600"
                      )}>
                        {res.status === 'passed' ? <CheckCircle2 size={18} /> : <Zap size={18} />}
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-xs group-hover:text-primary-600 transition-colors">
                          {res.detail?.title || `Atividade #${res.activityId.slice(0, 5)}`}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">
                           {res.completedAt ? new Date(res.completedAt).toLocaleDateString('pt-BR') : 'Data n/d'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={res.status === 'passed' ? 'primary' : 'outline'} className="text-[9px] py-0 px-2 h-5">
                        {res.score}/{res.totalQuestions || '-'} pts
                      </Badge>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-400 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="p-8 rounded-[2rem] border-2 border-slate-100 h-full">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-6">
              <Award className="text-warning-500" size={24} /> Conquistas
            </h3>
            {achievements.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🏆</div>
                <p className="font-black text-slate-400">Nenhuma conquista ainda</p>
                <p className="text-xs text-slate-300 mt-1">Continue estudando para desbloquear!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {achievements.map((ach: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-gradient-to-r from-warning-50 to-amber-50 rounded-2xl border border-warning-100">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-warning-100 flex-shrink-0">
                      {ach.detail?.icon || '🏅'}
                    </div>
                    <div>
                      <div className="font-black text-slate-700 text-sm">{ach.detail?.title || 'Conquista Especial'}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">{ach.detail?.description || ''}</div>
                    </div>
                  </div>
                ))}
                <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <div className="text-3xl font-black text-warning-500">{achievements.length}</div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total de Conquistas</div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {selectedResult && (
        <ActivityReviewModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};
