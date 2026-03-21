import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Student, SchoolClass, AppUser } from '../../types/user';
import type { GamificationStats, StudentAchievement, Achievement, Mission, StudentMissionProgress } from '../../types/gamification';
import type { StudentAvatarProfile } from '../../types/avatar';
import type { LearningPath, StudentProgress } from '../../types/learning';
import { useAuthStore } from '../../store/auth.store';
import {
  BrainCircuit,
  Trophy,
  Flame,
  Star,
  Heart,
  ChevronRight,
  Sparkles,
  Target,
  Award,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Zap
} from 'lucide-react';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { XPProgressBar } from '../../components/ui/XPProgressBar';

import { calculateLevel, getLevelProgress } from '../../lib/gamificationUtils';

type StudentFull = {
  student: Student;
  stats: GamificationStats | null;
  profile: StudentAvatarProfile | null;
  achievements: (StudentAchievement & { detail?: Achievement })[];
  missions: (StudentMissionProgress & { detail?: Mission })[];
  paths: (StudentProgress & { detail?: LearningPath })[];
  schoolClass: SchoolClass | null;
};

const getHour = () => new Date().getHours();
const getGreeting = () => {
  const h = getHour();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getStreakStatus = (streak: number) => {
  if (streak >= 14) return { label: 'Lendário', emoji: '🏆', bg: 'from-yellow-400 to-amber-500', text: 'text-amber-900' };
  if (streak >= 7)  return { label: 'Em Chamas!', emoji: '🔥', bg: 'from-orange-400 to-red-500', text: 'text-red-900' };
  if (streak >= 3)  return { label: 'Aquecendo', emoji: '⚡', bg: 'from-primary-400 to-indigo-500', text: 'text-indigo-900' };
  if (streak >= 1)  return { label: 'Nascente', emoji: '🌱', bg: 'from-green-400 to-emerald-500', text: 'text-emerald-900' };
  return { label: 'Começando', emoji: '💤', bg: 'from-slate-300 to-slate-400', text: 'text-slate-700' };
};

  // Smart Alerts logic
  const getAlerts = (data: StudentFull[]): { type: 'warning' | 'success' | 'info'; text: string }[] => {
    const alerts: { type: 'warning' | 'success' | 'info'; text: string }[] = [];
    const now = new Date();
    
    for (const { student, stats } of data) {
      if (!stats) continue;
      const name = student.name.split(' ')[0];
      const currentLevel = calculateLevel(stats.xp);
      
      let daysSinceLastStudy = 99;
      if (stats.lastStudyDate) {
        const lastDate = new Date(stats.lastStudyDate);
        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        daysSinceLastStudy = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      // 1. Critical Inactivity (Mutually exclusive with success)
      if (daysSinceLastStudy >= 3) {
        alerts.push({ 
          type: 'warning', 
          text: daysSinceLastStudy >= 7 
            ? `${name} não acessa a plataforma há uma semana. Vamos incentivá-lo? 💤` 
            : `${name} não estuda há alguns dias. Incentive-o a retomar! 💤` 
        });
        continue; 
      }

      // 2. High Streak
      if (stats.streak >= 7) {
        alerts.push({ 
          type: 'success', 
          text: `${name} está com uma sequência de ${stats.streak} dias! Incrível dedicação! 🔥` 
        });
        continue;
      }

      // 3. Level Achievement (Only if recently active)
      if (currentLevel > 1 && daysSinceLastStudy <= 2) {
        alerts.push({ 
          type: 'info', 
          text: `${name} subiu para o Nível ${currentLevel}! Celebre com ele essa conquista. ⭐` 
        });
      }
    }
    
    // Prioritize warnings > successes > info
    return alerts
      .sort((a, b) => {
        const order = { warning: 0, success: 1, info: 2 };
        return order[a.type] - order[b.type];
      })
      .slice(0, 3);
  };

export const GuardianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user) as (AppUser & { studentIds?: string[] }) | null;
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const [studentsData, setStudentsData] = useState<StudentFull[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<boolean[]>(new Array(7).fill(false));
  const [catalog, setCatalog] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    if (!user || user.role !== 'guardian') {
      setLoading(false);
      return;
    }

    try {
      // 1. Get live guardian record for studentIds
      const { data: liveGuardian } = await supabase.from('users').select('*').eq('id', user.id).single();
      const sidList = liveGuardian?.studentIds || [];

      // 2. Fetch by studentIds array OR search where guardianIds contains user.id
      let linkedByGuardian: any[] = [];
      if (sidList.length > 0) {
        const { data } = await supabase.from('users').select('*').in('id', sidList);
        linkedByGuardian = data || [];
      }
      
      const { data: linkedByStudent } = await supabase.from('users').select('*').contains('guardianIds', [user.id]);

      const allUsers = [...linkedByGuardian, ...(linkedByStudent || [])];
      const uniqueIds = new Set();
      const students = allUsers.filter(s => {
        if (s.role !== 'student' || uniqueIds.has(s.id)) return false;
        uniqueIds.add(s.id);
        return true;
      }) as Student[];

      if (students.length === 0) {
        setStudentsData([]);
        setLoading(false);
        return;
      }

      // Fetch global static definitions
      const [
        { data: allAchievDefs },
        { data: allMissionDefs },
        { data: allPathDefs },
        { data: allCatalog }
      ] = await Promise.all([
        supabase.from('achievements').select('*'),
        supabase.from('missions').select('*'),
        supabase.from('learning_paths').select('*'),
        supabase.from('avatar_catalog').select('*')
      ]);

      setCatalog(allCatalog || []);

      const studentIds = students.map(s => s.id);
      
      const [
        { data: statsData },
        { data: profilesData },
        { data: studentAchievsData },
        { data: studentMissionsData },
        { data: studentProgressData },
        { data: classesData }
      ] = await Promise.all([
        supabase.from('gamification_stats').select('*').in('id', studentIds),
        supabase.from('student_avatar_profiles').select('*').in('id', studentIds),
        supabase.from('student_achievements').select('*').in('studentId', studentIds),
        supabase.from('student_missions').select('*').in('studentId', studentIds),
        supabase.from('student_progress').select('*').in('studentId', studentIds),
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

        const rawProgress = studentProgressData?.filter(p => p.studentId === student.id) || [];
        const paths = rawProgress.map(sp => ({
          ...sp,
          detail: allPathDefs?.find(p => p.id === sp.pathId)
        }));

        const schoolClass = classesData?.find(c => c.id === student.classId) || null;

        return { student, stats, profile, achievements, missions, paths, schoolClass };
      });

      setStudentsData(enrichedStudents);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching guardian dashboard:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const ch = supabase.channel('guardian_dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gamification_stats' }, fetchDashboardData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const fetchWeeklyActivity = async (studentId: string) => {
    if (!studentId) return;
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); 
      startOfWeek.setHours(0, 0, 0, 0);

      const isoStart = startOfWeek.toISOString();

      const [
        { data: activities },
        { data: diary },
        { data: challengerDuels },
        { data: challengedDuels },
        { data: achievements },
        { data: missions },
        { data: progress },
        { data: notices }
      ] = await Promise.all([
        supabase.from('student_activity_results').select('completedAt').eq('studentId', studentId).gte('completedAt', isoStart),
        supabase.from('diary_entries').select('createdAt').eq('studentId', studentId).gte('createdAt', isoStart),
        supabase.from('duels').select('completedAt').eq('challengerId', studentId).gte('completedAt', isoStart),
        supabase.from('duels').select('completedAt').eq('challengedId', studentId).gte('completedAt', isoStart),
        supabase.from('student_achievements').select('unlockedAt').eq('studentId', studentId).gte('unlockedAt', isoStart),
        supabase.from('student_missions').select('completedAt').eq('studentId', studentId).gte('completedAt', isoStart),
        supabase.from('student_progress').select('startedAt,completedAt').eq('studentId', studentId),
        supabase.from('notifications').select('createdAt,type').eq('userId', studentId).gte('createdAt', isoStart).in('type', ['reward', 'success', 'system'])
      ]);

      const activeDays = new Array(7).fill(false);
      
      const checkDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (d >= startOfWeek) {
          const dayIndex = d.getDay();
          if (dayIndex >= 0 && dayIndex < 7) {
            activeDays[dayIndex] = true;
          }
        }
      };

      activities?.forEach(a => checkDate(a.completedAt));
      diary?.forEach(d => checkDate(d.createdAt));
      challengerDuels?.forEach(d => checkDate(d.completedAt));
      challengedDuels?.forEach(d => checkDate(d.completedAt));
      achievements?.forEach(a => checkDate(a.unlockedAt));
      missions?.forEach(m => checkDate(m.completedAt));
      progress?.forEach(p => { checkDate(p.startedAt); checkDate(p.completedAt); });
      notices?.forEach(n => checkDate(n.createdAt));

      setWeeklyActivity(activeDays);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
       fetchWeeklyActivity(selectedStudentId);
    }
  }, [selectedStudentId, studentsData]);

  if (loading && studentsData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
            <Heart className="absolute inset-0 m-auto text-primary-500" size={24} />
          </div>
          <p className="text-slate-400 font-bold">Carregando dados da família...</p>
        </div>
      </div>
    );
  }

  const selected = studentsData.find(d => d.student.id === selectedStudentId);
  const alerts = getAlerts(studentsData);

  // Aggregate family stats
  const totalXP = studentsData.reduce((acc, d) => acc + (d.stats?.xp || 0), 0);
  const totalAchievements = studentsData.reduce((acc, d) => acc + d.achievements.length, 0);
  const maxStreak = studentsData.reduce((acc, d) => Math.max(acc, d.stats?.streak || 0), 0);
  const allActive = studentsData.length > 0 && studentsData.every(d => (d.stats?.streak || 0) > 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">

      {/* ── GREETING HERO ── */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 p-8 md:p-12 shadow-2xl">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-special-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-primary-600/5 to-special-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
          {/* Left: Greeting */}
          <div className="text-center lg:text-left space-y-5 flex-1">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2">
              <Heart size={14} className="text-energy-400 fill-energy-400/30" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Portal da Família</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3">
                {getGreeting()},<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-special-300">
                  {user?.name.split(' ')[0]}!
                </span>
              </h1>
              <p className="text-slate-400 text-lg font-medium">
                {studentsData.length === 0
                  ? 'Vincule um aluno para começar a acompanhar.'
                  : allActive
                    ? `${studentsData.length === 1 ? 'Seu filho está' : 'Todos os seus filhos estão'} estudando hoje! 🎉`
                    : `Acompanhe o desenvolvimento de ${studentsData.length === 1 ? 'seu filho' : 'seus filhos'}.`}
              </p>
            </div>

            {/* Family KPI Pills */}
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-3">
                <Zap size={18} className="text-warning-400" />
                <div>
                  <div className="text-xs font-black text-white">{totalXP.toLocaleString('pt-BR')} XP</div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total da Família</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-3">
                <Trophy size={18} className="text-amber-400" />
                <div>
                  <div className="text-xs font-black text-white">{totalAchievements}</div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Conquistas</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-3">
                <Flame size={18} className="text-energy-400" />
                <div>
                  <div className="text-xs font-black text-white">{maxStreak} dias</div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Melhor Streak</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Student tabs preview */}
          {studentsData.length > 0 && (
            <div className="flex gap-4 flex-wrap justify-center">
              {studentsData.map(({ student, stats, profile, schoolClass }) => {
                const activeAvatar = catalog.find(i => i.id === profile?.selectedAvatarId);
                const streakStatus = getStreakStatus(stats?.streak || 0);
                const isSelected = student.id === selectedStudentId;
                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={cn(
                      'relative flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border transition-all duration-300 min-w-[180px]',
                      isSelected
                        ? 'bg-white/20 border-white/40 scale-105 shadow-xl'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:scale-102'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-7 h-7 bg-primary-500 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle2 size={16} className="text-white" />
                      </div>
                    )}
                    <div className="relative">
                      <AvatarComposer
                        avatarUrl={activeAvatar?.assetUrl || '/avatars/default-capybara.png'}
                        size="md"
                      />
                      <div className="absolute -bottom-2 -right-2 text-xl">{streakStatus.emoji}</div>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="text-lg font-black text-white truncate max-w-[140px] uppercase">{student.name.split(' ')[0]}</div>
                      <div className="text-xs font-bold text-slate-400">Nível {stats ? calculateLevel(stats.xp) : 1}</div>
                      {schoolClass && (
                        <div className="text-xs font-black text-warning-400 uppercase tracking-widest">{schoolClass.name}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── SMART ALERTS ── */}
      {alerts.length > 0 && (
        <section className="space-y-3">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start gap-4 p-5 rounded-2xl border text-sm font-medium',
                alert.type === 'warning' && 'bg-warning-50 border-warning-100 text-warning-800',
                alert.type === 'success' && 'bg-success-50 border-success-100 text-success-800',
                alert.type === 'info'    && 'bg-primary-50 border-primary-100 text-primary-800'
              )}
            >
              {alert.type === 'warning' && <AlertCircle size={20} className="text-warning-500 flex-shrink-0 mt-0.5" />}
              {alert.type === 'success' && <CheckCircle2 size={20} className="text-success-500 flex-shrink-0 mt-0.5" />}
              {alert.type === 'info'    && <Sparkles size={20} className="text-primary-500 flex-shrink-0 mt-0.5" />}
              <span>{alert.text}</span>
            </div>
          ))}
        </section>
      )}

      {/* ── SELECTED STUDENT DEEP VIEW ── */}
      {selected ? (() => {
        const { student, stats, profile, achievements, missions, paths, schoolClass } = selected;
        const activeAvatar = catalog.find(i => i.id === profile?.selectedAvatarId);
        const activeBg    = catalog.find(i => i.id === profile?.selectedBackgroundId);
        const activeBorder = catalog.find(i => i.id === profile?.selectedBorderId);
        const activeStickers = profile?.equippedStickerIds
          ?.map(id => catalog.find(i => i.id === id)?.assetUrl)
          .filter((url): url is string => !!url) || [];
        const streakStatus = getStreakStatus(stats?.streak || 0);

        return (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Student Card */}
            <div className="lg:col-span-1 space-y-4">
              <div className={cn('rounded-[2rem] p-6 bg-gradient-to-br text-center relative overflow-hidden', streakStatus.bg)}>
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="relative">
                    <AvatarComposer
                      avatarUrl={activeAvatar?.assetUrl || '/avatars/default-capybara.png'}
                      backgroundUrl={activeBg?.assetUrl}
                      borderUrl={activeBorder?.assetUrl}
                      stickerUrls={activeStickers}
                      size="xl"
                    />
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-xl shadow-lg">
                      {streakStatus.emoji}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white drop-shadow">{student.name}</h2>
                    <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                      {schoolClass ? (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-3 py-1 rounded-full border border-white/30">
                          {schoolClass.name}
                        </span>
                      ) : student.grade ? (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-3 py-1 rounded-full border border-white/30">
                          {student.grade}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-white/80 font-bold text-sm">{streakStatus.label}</div>
                  </div>
                </div>
              </div>

              {/* XP Card */}
              <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Progresso de Nível</div>
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
                
                <div className="grid grid-cols-2 gap-3 mt-5">
                  {[
                    { label: 'XP Total', val: (stats?.xp || 0).toLocaleString('pt-BR'), icon: '⚡', color: 'bg-warning-50 text-warning-700' },
                    { label: 'Moedas', val: (stats?.coins || 0).toLocaleString('pt-BR'), icon: '🪙', color: 'bg-amber-50 text-amber-700' },
                    { label: 'Nível', val: stats ? calculateLevel(stats.xp) : 1, icon: '🏅', color: 'bg-special-50 text-special-700' },
                    { label: 'Conquistas', val: achievements.length, icon: '🏆', color: 'bg-primary-50 text-primary-700' },
                  ].map((kpi, i) => (
                    <div key={i} className={cn('rounded-2xl p-3 text-center', kpi.color)}>
                      <div className="text-2xl mb-1">{kpi.icon}</div>
                      <div className="text-lg font-black leading-none">{kpi.val}</div>
                      <div className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">{kpi.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Streak Card */}
              <div className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden">
                <div className="absolute right-4 top-4 text-6xl opacity-10">🔥</div>
                <div className="relative z-10">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Streak de Estudos</div>
                  <div className="text-6xl font-black text-white leading-none">{stats?.streak || 0}</div>
                  <div className="text-slate-400 font-bold text-sm mt-1">dias consecutivos</div>
                  <div className="mt-4 flex gap-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                       <div key={i} className={cn('h-2 flex-1 rounded-full', i < Math.min(stats?.streak || 0, 7) ? 'bg-energy-500' : 'bg-slate-700')} />
                    ))}
                  </div>
                  <div className="text-[9px] font-black text-slate-600 uppercase mt-2 tracking-widest">Últimos 7 dias</div>
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Weekly Focus */}
              <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                    <Target size={20} className="text-primary-500" /> Engajamento da Semana
                  </h3>
                  {(() => {
                    const activeDaysCount = weeklyActivity.filter(Boolean).length;
                    return (
                      <span className={cn(
                        'text-[10px] font-black uppercase px-3 py-1.5 rounded-full',
                        activeDaysCount >= 5 ? 'bg-success-100 text-success-700' : 
                        activeDaysCount >= 2 ? 'bg-warning-100 text-warning-700' : 
                        'bg-red-100 text-red-600'
                      )}>
                        {activeDaysCount >= 5 ? 'Excelente' : activeDaysCount >= 2 ? 'Bom' : 'Precisa Melhorar'}
                      </span>
                    );
                  })()}
                </div>
                
                {/* Days of the week */}
                <div className="grid grid-cols-7 gap-2">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => {
                    const isActive = weeklyActivity[i];
                    const isToday = i === new Date().getDay();
                    return (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <div className={cn(
                          'w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all',
                          isActive ? 'bg-gradient-to-br from-energy-400 to-orange-500 text-white shadow-md' :
                          isToday ? 'bg-primary-100 text-primary-600 border-2 border-primary-300' :
                          'bg-slate-100 text-slate-300'
                        )}>
                          {isActive ? '✓' : day}
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase">{day}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Achievements Grid */}
              <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                    <Award size={20} className="text-warning-500" /> Conquistas Recentes
                  </h3>
                  <button onClick={() => navigate('/guardian/reports')} className="text-[10px] font-black uppercase tracking-widest text-primary-500 hover:text-primary-600 flex items-center gap-1">
                    Ver todas <ChevronRight size={14} />
                  </button>
                </div>

                {achievements.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {achievements.slice(0, 4).map((ach, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 bg-gradient-to-r from-warning-50 to-amber-50 rounded-2xl border border-warning-100 group hover:scale-[1.02] transition-transform">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-warning-100 flex-shrink-0">
                          {ach.detail?.icon || '🏅'}
                        </div>
                        <div>
                          <div className="font-black text-slate-700 text-sm leading-tight">{ach.detail?.title || 'Conquista'}</div>
                          <div className="text-[9px] font-bold text-slate-400 mt-0.5">{new Date(ach.unlockedAt).toLocaleDateString('pt-BR')}</div>
                          {ach.detail?.rewardXp && (
                            <div className="text-[9px] font-black text-warning-600 mt-1">+{ach.detail.rewardXp} XP</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">🏅</div>
                    <p className="font-black text-slate-400 text-sm">Nenhuma conquista ainda</p>
                    <p className="text-xs text-slate-300 mt-1">Continue estudando para desbloquear!</p>
                  </div>
                )}
              </div>
              {/* ── ACTIVITIES CARD ── */}
              {(() => {
                const pendingMissions = missions.filter(m => !m.completedAt);
                const doneMissions = missions.filter(m => !!m.completedAt);
                const inProgressPaths = paths.filter(p => p.status === 'in_progress');
                const completedPaths = paths.filter(p => p.status === 'completed');

                return (
                  <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                        <BookOpen size={20} className="text-indigo-500" /> Atividades & Missões
                      </h3>
                      <button onClick={() => navigate('/guardian/reports')} className="text-[10px] font-black uppercase tracking-widest text-primary-500 hover:text-primary-600 flex items-center gap-1">
                        Detalhes <ChevronRight size={14} />
                      </button>
                    </div>

                    {/* Summary Pills */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-warning-50 border border-warning-100 rounded-2xl p-3 text-center">
                        <div className="text-2xl font-black text-warning-700">{pendingMissions.length}</div>
                        <div className="text-[9px] font-black uppercase text-warning-500 tracking-widest mt-0.5">Pendentes</div>
                      </div>
                      <div className="bg-success-50 border border-success-100 rounded-2xl p-3 text-center">
                        <div className="text-2xl font-black text-success-700">{doneMissions.length}</div>
                        <div className="text-[9px] font-black uppercase text-success-500 tracking-widest mt-0.5">Concluídas</div>
                      </div>
                      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-3 text-center">
                        <div className="text-2xl font-black text-primary-700">{inProgressPaths.length}</div>
                        <div className="text-[9px] font-black uppercase text-primary-500 tracking-widest mt-0.5">Em Curso</div>
                      </div>
                    </div>

                    {/* Missions List */}
                    {missions.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Missões Recentes</div>
                        {[...pendingMissions, ...doneMissions].slice(0, 4).map((m, i) => {
                          const isDone = !!m.completedAt;
                          const progress = isDone ? 100 : Math.round(((m.currentCount || 0) / (m.detail?.targetCount || 1)) * 100);
                          return (
                            <div key={i} className={cn(
                              'flex items-center gap-3 p-3 rounded-2xl border transition-colors',
                              isDone ? 'bg-success-50/50 border-success-100' : 'bg-slate-50 border-slate-100'
                            )}>
                              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm', isDone ? 'bg-success-100' : 'bg-slate-200')}>
                                {isDone ? '✓' : '○'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={cn('font-black text-sm truncate', isDone ? 'text-success-700 line-through decoration-success-400/50' : 'text-slate-700')}>
                                  {m.detail?.title || 'Missão'}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={cn('h-full rounded-full transition-all', isDone ? 'bg-success-500' : 'bg-primary-500')}
                                      style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className="text-[9px] font-black text-slate-400 whitespace-nowrap">
                                    {isDone ? 'Feito!' : `${m.currentCount || 0}/${m.detail?.targetCount || 1}`}
                                  </span>
                                </div>
                              </div>
                              {m.detail?.rewardXp && (
                                <div className="text-[9px] font-black text-warning-600 bg-warning-50 px-2 py-1 rounded-lg border border-warning-100 flex-shrink-0">
                                  +{m.detail.rewardXp} XP
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* Learning Paths Progress */}
                    {(inProgressPaths.length > 0 || completedPaths.length > 0) && (
                      <div className={cn('space-y-2', missions.length > 0 && 'mt-5 pt-5 border-t border-slate-100')}>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Trilhas de Aprendizado</div>
                        {[...inProgressPaths, ...completedPaths].slice(0, 3).map((p, i) => {
                          const total = p.detail?.steps?.length || 1;
                          const done = p.completedStepIds?.length || 0;
                          const pct = Math.round((done / total) * 100);
                          const isComplete = p.status === 'completed';
                          return (
                            <div key={i} className={cn(
                              'flex items-center gap-3 p-3 rounded-2xl border',
                              isComplete ? 'bg-success-50/50 border-success-100' : 'bg-indigo-50/50 border-indigo-100'
                            )}>
                              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm', isComplete ? 'bg-success-100' : 'bg-indigo-100')}>
                                {isComplete ? '⭐' : '📚'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={cn('font-black text-sm truncate', isComplete ? 'text-success-700' : 'text-indigo-700')}>
                                  {p.detail?.title || 'Trilha'}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={cn('h-full rounded-full', isComplete ? 'bg-success-500' : 'bg-indigo-500')}
                                      style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[9px] font-black text-slate-400">{pct}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty State */}
                    {missions.length === 0 && paths.length === 0 && (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3">📋</div>
                        <p className="font-black text-slate-400 text-sm">Nenhuma atividade registrada</p>
                        <p className="text-xs text-slate-300 mt-1">Missões e trilhas aparecerão aqui conforme o aluno progredir.</p>
                      </div>
                    )}
                  </div>
                );
              })()}


              <div className="bg-gradient-to-br from-special-600 to-primary-700 rounded-[2rem] p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -mr-8 -mt-8" />
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/30">
                    <BrainCircuit size={28} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Dica de IA para Hoje</div>
                      <div className="w-1.5 h-1.5 rounded-full bg-energy-400 animate-pulse" />
                    </div>
                    <p className="text-white font-bold text-sm leading-relaxed">
                      {(stats?.streak || 0) > 0
                        ? `${student.name.split(' ')[0]} está em uma sequência incrível! Esta noite, pergunte a ele/ela o que aprendeu hoje. Conversas sobre aprendizado reforçam a memória em até 40%.`
                        : `Tente criar um ritual de estudos com ${student.name.split(' ')[0]} — um lanche especial antes de estudar, por exemplo. Associações positivas aumentam a motivação!`
                      }
                    </p>
                    <button onClick={() => navigate('/guardian/tips')} className="mt-4 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white flex items-center gap-1 transition-colors">
                      Ver todas as dicas <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })() : (
        studentsData.length > 0 && (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-3xl">👈</div>
            <p className="text-slate-500 font-black">Selecione um aluno acima para ver os detalhes.</p>
          </div>
        )
      )}

      {/* ── NO STUDENTS STATE ── */}
      {studentsData.length === 0 && (
        <section className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl">👨‍👩‍👧</div>
          <h2 className="text-2xl font-black text-slate-600 mb-2">Bem-vindo à Central da Família!</h2>
          <p className="text-slate-400 font-medium max-w-sm mx-auto">Vincule o código do seu filho para começar a acompanhar o progresso na plataforma.</p>
          <button onClick={() => navigate('/guardian/students')}
            className="mt-6 px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black shadow-xl shadow-primary-500/20 transition-all hover:-translate-y-1 active:scale-95">
            Vincular Agora
          </button>
        </section>
      )}


      {/* ── FAMILY LEADERBOARD ── */}
      {studentsData.length > 1 && (
        <section>
          <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
            <Star size={20} className="text-warning-500" /> Destaque da Família
          </h2>
          <div className="bg-white rounded-[2rem] border-2 border-slate-100 overflow-hidden">
            {[...studentsData]
              .sort((a, b) => (b.stats?.xp || 0) - (a.stats?.xp || 0))
              .map(({ student, stats, profile, achievements }, i) => {
                const activeAvatar = catalog.find(x => x.id === profile?.selectedAvatarId);
                const pct = Math.min(100, Math.round(((stats?.xp || 0) / Math.max(...studentsData.map(d => d.stats?.xp || 1))) * 100));
                return (
                  <div key={student.id} className={cn('flex items-center gap-5 p-5 border-b border-slate-50 last:border-none hover:bg-slate-50/50 transition-colors cursor-pointer')}
                    onClick={() => setSelectedStudentId(student.id)}>
                    <div className="text-xl font-black text-slate-300 w-6 text-center">{i + 1}</div>
                    <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-slate-100">
                      {activeAvatar?.assetUrl ? (
                         <img src={activeAvatar.assetUrl} alt={student.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                          {student.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-slate-800 truncate">{student.name}</span>
                        <span className="text-sm font-black text-warning-600 ml-2">{(stats?.xp || 0).toLocaleString('pt-BR')} XP</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-warning-400 to-amber-500 rounded-full transition-all duration-700"
                           style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Nível {stats ? calculateLevel(stats.xp) : 1}</span>
                        <span className="text-[9px] font-black text-energy-500">🔥 {stats?.streak || 0} dias</span>
                        <span className="text-[9px] font-black text-warning-500">🏆 {achievements.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ── MOTIVATIONAL FOOTER ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: '🧠', title: 'Sabia que...', text: 'Crianças que estudam com consistência por 7+ dias têm 3x more retenção de conteúdo.', color: 'bg-blue-50 border-blue-100' },
          { icon: '💬', title: 'Dica Parental', text: 'Pergunte o que seu filho aprendeu hoje — essa simples ação reforça a memória de longo prazo.', color: 'bg-green-50 border-green-100' },
          { icon: '🎯', title: 'Meta da Semana', text: 'Incentive uma sequência de 5 dias de estudo para desbloquear recompensas especiais no Impacto IA!', color: 'bg-purple-50 border-purple-100' },
        ].map((card, i) => (
          <div key={i} className={cn('rounded-[2rem] p-6 border-2 flex items-start gap-4', card.color)}>
            <div className="text-3xl flex-shrink-0">{card.icon}</div>
            <div>
              <div className="font-black text-slate-700 text-sm mb-1">{card.title}</div>
              <div className="text-xs text-slate-500 font-medium leading-relaxed">{card.text}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
