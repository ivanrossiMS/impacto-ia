import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useAvatarStore } from '../../store/avatar.store';
import { updateGamificationStats } from '../../lib/gamificationUtils';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/dexie';
import {
  Target,
  ChevronRight,
  PlayCircle,
  BookOpen,
  Compass,
  Trophy,
  Flame,
  Zap,
  Lock,
  Coins,
  GraduationCap,
  Swords,
  Sparkles,
  Lightbulb,
  Brain,
  Clock,
  Star,
  Shield,
  Smile,
  Rocket
} from 'lucide-react';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { getLevelProgress } from '../../lib/gamificationUtils';
import { cn } from '../../lib/utils';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { checkAndUnlockAchievements } from '../../lib/gameSeeder';
import { AchievementUnlockModal, useAchievementUnlock } from '../../components/achievements/AchievementUnlockModal';




export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const { profile, fetchProfile, fetchCatalog, catalog } = useAvatarStore();
  const { firstInQueue, clearFirst, checkForNew } = useAchievementUnlock(user?.id);
  
  const [dashboardData, setDashboardData] = useState<any>({
    stats: null,
    liveUser: null,
    myClass: null,
    activeMission: null,
    activePath: null,
    achievements: [],
    availableActivities: [],
    duelData: { recent: [] }
  });
  const [loading, setLoading] = useState(true);

  // ── 1. Skeleton Loader ────────────────────────────────────────────────────
  const DashboardSkeleton = () => (
    <div className="space-y-8 animate-pulse">
      {/* Hero skeleton */}
      <div className="h-64 bg-slate-800 rounded-[2rem]">
        <div className="p-10 space-y-4">
          <div className="h-3 w-24 bg-white/10 rounded-full" />
          <div className="h-10 w-64 bg-white/10 rounded-2xl" />
          <div className="flex gap-3 mt-6">
            {[80, 100, 200].map(w => (
              <div key={w} className="h-16 rounded-[2rem] bg-white/5" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
      {/* Cards row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="h-64 bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-4">
            <div className="h-6 w-40 bg-slate-100 rounded-xl" />
            {[1, 2, 3].map(j => (
              <div key={j} className="h-12 bg-slate-50 rounded-2xl" />
            ))}
          </div>
        ))}
      </div>
      {/* Bottom row */}
      <div className="grid md:grid-cols-2 gap-8">
        {[1, 2].map(i => (
          <div key={i} className="h-48 bg-white rounded-[2.5rem] border border-slate-100" />
        ))}
      </div>
    </div>
  );

  // ── 2. Load from Dexie cache (instant) ───────────────────────────────────
  const loadFromCache = async () => {
    if (!user) return;
    try {
      const [stats, liveUser] = await Promise.all([
        db.gamificationStats.get(user.id),
        db.users.get(user.id),
      ]);

      let myClass = null;
      const liveUserAny = liveUser as any;
      if (liveUserAny?.classId) myClass = await db.classes.get(liveUserAny.classId) ?? null;

      const currentYear = new Date().getFullYear().toString();
      const userGrade = (liveUser as any)?.grade || (myClass as any)?.grade || '';

      // Mission
      let activeMission = null;
      const smList = await db.studentMissions.where('studentId').equals(user.id).filter((m: any) => !m.completedAt).toArray();
      if (smList.length > 0) {
        const first = smList[0] as any;
        const detail = await db.missions.get(first.missionId);
        activeMission = { ...first, detail };
      }

      // Paths
      let classPaths: any[] = [];
      if (liveUserAny?.classId) {
        classPaths = (await db.learningPaths.where('classId' as any).equals(liveUserAny.classId).toArray())
          .filter((p: any) => !p.schoolYear || p.schoolYear === currentYear);
      }
      const generalPaths = (await db.learningPaths.where('grade' as any).equals(userGrade).toArray())
        .filter((p: any) => (!p.classId || p.classId === '') && (!p.schoolYear || p.schoolYear === currentYear));
      const allPathDefs = [...classPaths, ...generalPaths];

      let activePath = null;
      const inProgress = await db.studentProgress.where('studentId' as any).equals(user.id).filter((p: any) => p.status === 'in_progress').toArray();
      if (inProgress.length > 0) {
        const first = inProgress[0] as any;
        activePath = { ...first, detail: allPathDefs.find(p => p.id === first.pathId) };
      } else if (allPathDefs.length > 0) {
        activePath = { id: 'none', studentId: user.id, pathId: allPathDefs[0].id, completedStepIds: [], status: 'not_started', startedAt: '', detail: allPathDefs[0] };
      }

      // Achievements
      const [achievDefs, rawAch] = await Promise.all([
        db.achievements.toArray(),
        db.studentAchievements.where('studentId' as any).equals(user.id).toArray(),
      ]);
      const achievements = rawAch.map((a: any) => ({ ...a, detail: achievDefs.find(d => d.id === a.achievementId) }));

      // Activities
      let availableActivities: any[] = [];
      if (liveUserAny?.classId) {
        const [classActivities, results] = await Promise.all([
          db.activities.where('classId' as any).equals(liveUserAny.classId).toArray(),
          db.studentActivityResults.where('studentId' as any).equals(user.id).toArray(),
        ]);
        availableActivities = (classActivities as any[]).map(act => {
          const result = (results as any[]).find(r => r.activityId === act.id);
          return { ...act, status: result ? 'Concluída' : 'Pendente' };
        }).sort((a, b) => {
          if (a.status === 'Pendente' && b.status !== 'Pendente') return -1;
          if (a.status !== 'Pendente' && b.status === 'Pendente') return 1;
          return b.id.localeCompare(a.id);
        });
      }

      // Duels (basic, no server round-trip for opponent names)
      const [d1, d2] = await Promise.all([
        db.duels.where('challengerId' as any).equals(user.id).toArray(),
        db.duels.where('challengedId' as any).equals(user.id).toArray(),
      ]);
      const allDuels = [...(d1 as any[]), ...(d2 as any[])]
        .sort((a, b) => {
          const aPend = a.status !== 'completed', bPend = b.status !== 'completed';
          if (aPend && !bPend) return -1; if (!aPend && bPend) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 3)
        .map((d: any) => {
          let outcome = 'Pendente';
          if (d.status === 'completed') {
            outcome = d.winnerId === user.id ? 'Vitória' : d.winnerId === 'draw' ? 'Empate' : 'Derrota';
          }
          return { ...d, opponentName: 'Oponente', opponentClass: '', outcome,
            myScore: d.challengerId === user.id ? d.challengerScore : d.challengedScore,
            opScore: d.challengerId === user.id ? d.challengedScore : d.challengerScore };
        });

      // Only update state if we got meaningful data
      if (stats || liveUser) {
        setDashboardData({ stats: stats as any, liveUser: liveUser as any, myClass, activeMission, activePath, achievements, availableActivities, duelData: { recent: allDuels } });
        setLoading(false); // Instant — no spinner!
      }
    } catch (err) {
      console.warn('[Dashboard] Dexie cache read error:', err);
    }
  };

  // ── 3. Background refresh from Supabase (enriches data) ──────────────────
  const refreshFromNetwork = async () => {
    if (!user) return;
    try {
      const { data: stats } = await supabase.from('gamification_stats').select('*').eq('id', user.id).single();
      const { data: liveUser } = await supabase.from('users').select('*').eq('id', user.id).single();
      let myClass = null;
      if (liveUser?.classId) {
        const { data: c } = await supabase.from('classes').select('*').eq('id', liveUser.classId).single();
        myClass = c;
        if (c) await db.classes.put(c);
      }
      if (stats) await db.gamificationStats.put(stats as any);
      if (liveUser) await db.users.put(liveUser as any);

      const currentYear = new Date().getFullYear().toString();
      const userGrade = liveUser?.grade || (myClass as any)?.grade || '';

      let activeMission = null;
      const { data: studentMissions } = await supabase.from('student_missions').select('*').eq('studentId', user.id).is('completedAt', null);
      if (studentMissions?.length) {
        const first = studentMissions[0];
        const { data: detail } = await supabase.from('missions').select('*').eq('id', first.missionId).single();
        activeMission = { ...first, detail };
        if (detail) await db.missions.put(detail as any);
      }

      let classPaths: any[] = [], generalPaths: any[] = [];
      if (liveUser?.classId) {
        const { data: cp } = await supabase.from('learning_paths').select('*').eq('classId', liveUser.classId);
        classPaths = (cp || []).filter(p => !p.schoolYear || p.schoolYear === currentYear);
        for (const p of classPaths) await db.learningPaths.put(p as any);
      }
      const { data: gp } = await supabase.from('learning_paths').select('*').eq('grade', userGrade);
      generalPaths = (gp || []).filter(p => (!p.classId || p.classId === '') && (!p.schoolYear || p.schoolYear === currentYear));
      for (const p of generalPaths) await db.learningPaths.put(p as any);
      const allPathDefs = [...classPaths, ...generalPaths];

      let activePath = null;
      const { data: studentProgress } = await supabase.from('student_progress').select('*').eq('studentId', user.id).eq('status', 'in_progress');
      if (studentProgress?.length) {
        const first = studentProgress[0];
        activePath = { ...first, detail: allPathDefs.find(p => p.id === first.pathId) };
      } else if (allPathDefs.length > 0) {
        activePath = { id: 'none', studentId: user.id, pathId: allPathDefs[0].id, completedStepIds: [], status: 'not_started', startedAt: '', detail: allPathDefs[0] };
      }

      const { data: achievDefs } = await supabase.from('achievements').select('*');
      const { data: rawAch } = await supabase.from('student_achievements').select('*').eq('studentId', user.id);
      const achievements = (rawAch || []).map(a => ({ ...a, detail: (achievDefs || []).find(d => d.id === a.achievementId) }));

      let availableActivities: any[] = [];
      if (liveUser?.classId) {
        const { data: classActivities } = await supabase.from('activities').select('*').eq('classId', liveUser.classId);
        const { data: results } = await supabase.from('student_activity_results').select('*').eq('studentId', user.id);
        availableActivities = (classActivities || []).map(act => {
          const result = (results || []).find(r => r.activityId === act.id);
          return { ...act, status: result ? 'Concluída' : 'Pendente' };
        }).sort((a, b) => {
          if (a.status === 'Pendente' && b.status !== 'Pendente') return -1;
          if (a.status !== 'Pendente' && b.status === 'Pendente') return 1;
          return b.id.localeCompare(a.id);
        });
      }

      const { data: d1 } = await supabase.from('duels').select('*').eq('challengerId', user.id);
      const { data: d2 } = await supabase.from('duels').select('*').eq('challengedId', user.id);
      let allDuels = [...(d1 || []), ...(d2 || [])]
        .sort((a, b) => {
          const aPend = a.status !== 'completed', bPend = b.status !== 'completed';
          if (aPend && !bPend) return -1; if (!aPend && bPend) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      const recent = await Promise.all(allDuels.slice(0, 3).map(async (d: any) => {
        const oppId = d.challengerId === user.id ? d.challengedId : d.challengerId;
        const oppCached = await db.users.get(oppId);
        let oppName = (oppCached as any)?.name || 'Oponente';
        let opponentClass = '';
        if (!oppCached) {
          const { data: opp } = await supabase.from('users').select('name, classId').eq('id', oppId).single();
          oppName = opp?.name?.split(' ').slice(0, 2).join(' ') || 'Oponente';
          if (opp?.classId) { const { data: cls } = await supabase.from('classes').select('name').eq('id', opp.classId).single(); opponentClass = cls?.name || ''; }
        } else { opponentClass = (myClass as any)?.name || ''; }
        let outcome = d.status === 'completed' ? (d.winnerId === user.id ? 'Vitória' : d.winnerId === 'draw' ? 'Empate' : 'Derrota') : 'Pendente';
        return { ...d, opponentName: oppName, opponentClass, outcome,
          myScore: d.challengerId === user.id ? d.challengerScore : d.challengedScore,
          opScore: d.challengerId === user.id ? d.challengedScore : d.challengerScore };
      }));

      setDashboardData({ stats, liveUser, myClass, activeMission, activePath, achievements, availableActivities, duelData: { recent } });
      setLoading(false);
    } catch (e) {
      console.error('[Dashboard] Network refresh error:', e);
      setLoading(false);
    }
  };

  const { stats, myClass, activeMission, activePath, achievements } = dashboardData;
  const className = myClass?.name || '';
 
  // --- AI Tips Engine ---
  const ALL_AI_TIPS = [
    {
      icon: Lightbulb,
      title: "Poder do Foco",
      description: "Estude em blocos de 25min com 5min de descanso. Isso ajuda seu cérebro a absorver 30% mais informações!",
      color: "text-amber-500",
      bg: "bg-amber-50/50",
      border: "border-amber-100"
    },
    {
      icon: Brain,
      title: "Dica de Ouro",
      description: "Revisar o conteúdo em um Duelo logo após a aula fixa a memória de longo prazo. Desafie alguém!",
      color: "text-special-500",
      bg: "bg-special-50/50",
      border: "border-special-100"
    },
    {
      icon: Clock,
      title: "Rotina de Elite",
      description: "Entrar no IA Lab no mesmo horário todo dia ajuda a criar um hábito imbatível de estudos.",
      color: "text-primary-500",
      bg: "bg-primary-50/50",
      border: "border-primary-100"
    },
    {
      icon: Target,
      title: "Precisão Máxima",
      description: "Tente não chutar! Responder com calma aumenta sua precisão e te dá bônus de moedas.",
      color: "text-energy-500",
      bg: "bg-energy-50/50",
      border: "border-energy-100"
    },
    {
      icon: Star,
      title: "Exploração",
      description: "A biblioteca tem materiais exclusivos que não caem nas trilhas comuns. Dê uma espiada lá!",
      color: "text-yellow-500",
      bg: "bg-yellow-50/50",
      border: "border-yellow-100"
    },
    {
      icon: Shield,
      title: "Defesa de Rank",
      description: "Manter sua ofensiva protege seus pontos de experiência caso você tire uma nota baixa.",
      color: "text-indigo-500",
      bg: "bg-indigo-50/50",
      border: "border-indigo-100"
    },
    {
      icon: Smile,
      title: "Humor e Estudo",
      description: "Registrar seu humor no diário ajuda a IA a sugerir atividades que combinam com seu estado de espírito.",
      color: "text-pink-500",
      bg: "bg-pink-50/50",
      border: "border-pink-100"
    },
    {
      icon: Rocket,
      title: "Subida Rápida",
      description: "Completar missões diárias é o caminho mais rápido para chegar ao nível 50 e desbloquear itens épicos.",
      color: "text-orange-600",
      bg: "bg-orange-50/50",
      border: "border-orange-100"
    }
  ];

  const [aiTips, setAiTips] = useState<any[]>([]);

  useEffect(() => {
    // Pick 3 random tips once on mount (when user logs in/visits)
    const shuffled = [...ALL_AI_TIPS].sort(() => 0.5 - Math.random());
    setAiTips(shuffled.slice(0, 3));
  }, []);
  // ----------------------

  const { availableActivities, duelData } = dashboardData;

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      // Phase 1: Instant render from local cache
      await fetchProfile(user.id);
      await fetchCatalog();
      await loadFromCache();

      // Phase 2: Background network sync (non-blocking)
      refreshFromNetwork().then(async () => {
        try {
          await updateGamificationStats(user.id, {});
          await checkAndUnlockAchievements(user.id);
          await checkForNew();
          await incrementMissionProgress(user.id, 'login', 1);
        } catch (err) {
          console.warn('[Dashboard] Gamification update error:', err);
        }
      });
    };
    init();

    const channel = supabase.channel('dashboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gamification_stats' }, () => refreshFromNetwork())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_missions' }, () => refreshFromNetwork())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchProfile, fetchCatalog]);

  if (loading) return <DashboardSkeleton />;

  // Safe fallback values - never block if stats is null
  const safeStats = stats ?? { level: 1, xp: 0, coins: 0, streak: 0, lastStudyDate: '' };
  const levelProgress = getLevelProgress(safeStats.xp);


  // Get active avatar assets
  const activeAvatar = catalog.find(i => i.id === profile?.selectedAvatarId);
  const activeBg = catalog.find(i => i.id === profile?.selectedBackgroundId);
  const activeBorder = catalog.find(i => i.id === profile?.selectedBorderId);
  const activeStickers = (profile?.equippedStickerIds || [])
    .map(id => catalog.find(i => i.id === id)?.assetUrl)
    .filter((url): url is string => !!url);

  const pathProgress = activePath?.completedStepIds?.length || 0;
  const pathTotal = activePath?.detail?.steps?.length || 1;
  const pathPct = Math.round((pathProgress / pathTotal) * 100);
 


  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Achievement Unlock Celebration */}
      {firstInQueue && (
        <AchievementUnlockModal
          achievement={firstInQueue}
          onClose={clearFirst}
        />
      )}

      {/* Hero Section - Modern & Compact */}
      <section className="relative group overflow-hidden rounded-[2rem] shadow-2xl border border-white/10">
        {/* Creative Background with Abstract Shapes */}
        <div className="absolute inset-0 bg-[#0F172A]">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/40 via-special-600/40 to-primary-900/40 opacity-70" />
          <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-primary-500/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] bg-special-500/20 rounded-full blur-[80px] animate-pulse delay-1000" />
          {/* Abstract Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="relative z-10 p-6 md:p-10 flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-16">
          
          {/* Left Side: Welcome & Compact Stats */}
          <div className="flex-1 min-w-0 space-y-6 w-full">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 animate-in slide-in-from-left duration-500">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
                   <Sparkles className="text-warning-300" size={14} />
                   <span className="text-[9px] font-black uppercase tracking-widest text-white/80">IA Lab</span>
                </div>
                {className && (
                  <div className="bg-primary-400/10 backdrop-blur-md border border-primary-400/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
                    <GraduationCap className="text-primary-300" size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary-300">{className}</span>
                  </div>
                )}
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black text-white leading-none tracking-tight">
                Fala aí, <span className="text-transparent bg-clip-text bg-gradient-to-r from-warning-300 to-orange-400 drop-shadow-sm">{user?.name.split(' ')[0]}!</span>
              </h1>
              
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left duration-700 delay-200">
                <div className="h-1 w-12 bg-warning-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                <p className="text-white/60 text-sm md:text-base font-medium truncate">
                  {activePath?.detail
                    ? `Progresso em "${activePath.detail.title}"`
                    : 'Pronto para o desafio de hoje?'}
                </p>
              </div>
            </div>

            {/* High Tech Stats Row — on mobile: streak+coins side by side, level below */}
            <div className="flex flex-wrap items-center gap-3 animate-in zoom-in-95 duration-700 delay-300">
               {/* Ofensiva */}
               <div className="bg-white/5 backdrop-blur-xl border border-white/10 pl-3 pr-7 py-3 rounded-[2rem] flex items-center gap-3 transition-all duration-300 cursor-default shadow-[0_0_20px_rgba(251,146,60,0.1)] hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(251,146,60,0.2)] group/stat">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-orange-400 bg-orange-400/10 group-hover/stat:scale-110 group-hover/stat:rotate-12 transition-all">
                     <Flame size={20} />
                  </div>
                  <div>
                    <div className="text-xl font-black text-white leading-none tracking-tight">{safeStats.streak}d</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-white/40 group-hover/stat:text-orange-300/60 transition-colors">Ofensiva</div>
                  </div>
               </div>

               {/* Moedas — next to streak on mobile */}
               <div className="bg-white/5 backdrop-blur-xl border border-white/10 pl-3 pr-7 py-3 rounded-[2rem] flex items-center gap-3 transition-all duration-300 cursor-default shadow-[0_0_20px_rgba(251,191,36,0.1)] hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)] group/coins">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-yellow-400 bg-yellow-400/10 group-hover/coins:scale-110 group-hover/coins:rotate-12 transition-all">
                     <Coins size={20} />
                  </div>
                  <div>
                    <div className="text-xl font-black text-white leading-none tracking-tight">{safeStats.coins.toLocaleString('pt-BR')}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-white/40 group-hover/coins:text-yellow-300/60 transition-colors">Moedas</div>
                  </div>
               </div>

               {/* Nível com Barra de Progresso — full width on mobile */}
               <div className="bg-white/5 backdrop-blur-xl border border-white/10 pl-3 pr-7 py-3 rounded-[2rem] flex items-center gap-4 transition-all duration-300 cursor-default w-full md:w-auto md:min-w-[220px] shadow-[0_0_20px_rgba(252,211,77,0.1)] hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(252,211,77,0.2)] group/level">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-amber-300 bg-amber-300/10 group-hover/level:scale-110 group-hover/level:rotate-12 transition-all">
                     <Trophy size={20} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-8">
                      <div className="text-lg font-black text-white leading-none whitespace-nowrap">Nível {safeStats.level}</div>
                      <div className="text-[9px] font-black text-white/50 tracking-tighter whitespace-nowrap">{levelProgress.xpInLevel} / {levelProgress.xpNextLevel} XP</div>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden p-[1px]">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.4)] transition-all duration-1000 ease-out" 
                        style={{ width: `${levelProgress.percentage}%` }}
                      />
                    </div>
                  </div>
               </div>
            </div>

            {/* Quick Actions - Neumorphic dark buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button 
                variant="ai" 
                className="h-14 px-8 rounded-2xl gap-3 font-black text-base shadow-xl shadow-primary-900/40 w-full sm:w-auto group/play active:scale-95 transition-all"
                onClick={() => navigate('/student/activities')}
              >
                <div className="bg-white/20 p-1.5 rounded-lg group-hover/play:rotate-12 transition-transform">
                  <PlayCircle size={20} />
                </div>
                Continuar Lab
              </Button>

              <button 
                className="bg-white/5 backdrop-blur-xl border border-white/10 pl-3 pr-6 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-all group/task w-full sm:w-auto h-14 active:scale-95"
                onClick={() => navigate('/student/missions')}
              >
                <div className="w-10 h-10 bg-special-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover/task:rotate-6 transition-transform">
                  <Target size={20} />
                </div>
                <div className="text-left">
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Missão Ativa</div>
                  <div className="text-white font-bold text-xs truncate max-w-[120px]">
                    {activeMission?.detail?.title || 'Explorar Mapa'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Right Side: Avatar Showcase — moves to TOP on mobile */}
          <div className="flex flex-col items-center gap-4 order-first lg:order-last w-full lg:w-auto">
            <div className="relative group/avatar">
              {/* Outer Glow */}
              <div className="absolute inset-0 bg-primary-400/30 rounded-[3rem] blur-3xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {/* Main Container - Thick White Border Style */}
              <div className="relative z-10 p-1.5 bg-white rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 border-white/20">
                <div className="relative rounded-[2.5rem] bg-[#F8FAFF] overflow-hidden p-2">
                  <AvatarComposer
                    avatarUrl={activeAvatar?.assetUrl || '/avatars/default-impacto.png'}
                    backgroundUrl={activeBg?.assetUrl}
                    borderUrl={activeBorder?.assetUrl}
                    stickerUrls={activeStickers}
                    size="xl"
                    className="relative z-10"
                    isFloating={true}
                  />

                </div>
              </div>
            </div>

            <div className="flex flex-row items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/student/avatar')}
                className="bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl text-[10px] font-black h-9 px-4 md:px-6 uppercase tracking-widest transition-all"
              >
                Customizar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/student/store')}
                className="bg-primary-100 border border-primary-200 text-primary-900 font-black hover:bg-primary-200 rounded-xl text-[10px] h-9 px-4 md:px-6 uppercase tracking-widest transition-all shadow-lg shadow-primary-500/10"
              >
                Loja 🪙
              </Button>
            </div>
          </div>
        </div>
      </section>
 
      {/* Central Hub: Atividades e Duelos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividades Card */}
        <div 
          className="relative group overflow-hidden bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity text-primary-500">
            <BookOpen size={120} className="-rotate-12" />
          </div>
          
          <div className="relative z-10 flex flex-col gap-6 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
                  <BookOpen size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">Minhas Atividades</h3>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest leading-none mt-1">Laboratório de Criatividade</p>
                </div>
              </div>
              <div className="bg-primary-500 text-white px-4 py-2 rounded-xl font-black text-sm shadow-lg shadow-primary-500/20">
                {availableActivities.length}
              </div>
            </div>

            {/* Listagem das Últimas 3 Atividades */}
            <div className="space-y-3 flex-1">
              {availableActivities.slice(0, 3).map((act: any) => (
                <div key={act.id} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-white hover:border-primary-100 transition-all group/item">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      act.status === 'Concluída' ? "bg-green-500" : "bg-primary-500 animate-pulse"
                    )} />
                    <span className="font-bold text-slate-700 text-sm truncate max-w-[180px]">{act.title}</span>
                  </div>
                  <Badge variant={act.status === 'Concluída' ? 'primary' : 'energy'}>
                    {act.status}
                  </Badge>
                </div>
              ))}
              {availableActivities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                  <BookOpen size={40} className="opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Nenhuma atividade disponível</p>
                </div>
              )}
            </div>

            <Button 
              variant="ai" 
              className="rounded-2xl w-full h-12 font-black shadow-lg shadow-primary-500/20 mt-auto"
              onClick={() => navigate('/student/activities')}
            >
              Abrir Atividades
            </Button>
          </div>
        </div>
 
        {/* Duelos Card */}
        <div 
          className="relative group overflow-hidden bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col gap-6"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity text-special-500">
            <Swords size={120} className="-rotate-12" />
          </div>
          
          <div className="relative z-10 flex flex-col gap-6 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-special-50 rounded-2xl flex items-center justify-center text-special-500 group-hover:scale-110 transition-transform">
                  <Swords size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">Arena de Duelos</h3>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest leading-none mt-1">Desafio de Conhecimento</p>
                </div>
              </div>
              {duelData.recent.filter((d: any) => d.status === 'active').length > 0 && (
                <div className="bg-energy-500 animate-bounce text-white px-4 py-2 rounded-xl font-black text-sm shadow-lg shadow-energy-500/20">
                  Duelo Ativo!
                </div>
              )}
            </div>

            {/* Listagem dos Últimos 3 Duelos */}
            <div className="space-y-3 flex-1">
              {duelData.recent.map((duel: any) => (
                <div key={duel.id} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-white hover:border-special-100 transition-all group/duel">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 text-sm">vs {duel.opponentName}</span>
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                        duel.outcome === 'Vitória' ? "bg-green-100 text-green-700" :
                        duel.outcome === 'Derrota' ? "bg-red-100 text-red-700" :
                        duel.outcome === 'Empate' ? "bg-slate-100 text-slate-700" :
                        "bg-primary-100 text-primary-700"
                      )}>
                        {duel.outcome}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                      {duel.opponentClass && <span className="text-primary-500 font-black">{duel.opponentClass}</span>}
                      {duel.opponentClass && <span>·</span>}
                      <span>{duel.myScore} acertos • {duel.questionCount - duel.myScore} erros</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-800">{duel.myScore} x {duel.opScore}</div>
                  </div>
                </div>
              ))}
              {duelData.recent.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                  <Zap size={40} className="opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Nenhum duelo recente</p>
                </div>
              )}
            </div>

            <Button 
              variant="secondary" 
              className="rounded-2xl w-full h-12 font-black bg-special-500 text-white hover:bg-special-600 shadow-lg shadow-special-500/20 mt-auto"
              onClick={() => navigate('/student/duels')}
            >
              Desafiar Agora
            </Button>
          </div>
        </div>
      </section>

      {/* Trilhas e Conquistas */}
      <div className="grid md:grid-cols-2 gap-8">

        {/* Active Path */}
        <Card className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Compass className="text-primary-500" size={28} /> Trilhas
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/student/paths')}>Ver Tudo <ChevronRight size={16} /></Button>
          </div>

          {activePath?.detail ? (
            <div
              className="group cursor-pointer p-6 rounded-2xl border-2 border-slate-50 hover:border-primary-100 bg-slate-50/50 hover:bg-white transition-all duration-300"
              onClick={() => navigate('/student/paths')}
            >
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-primary-100 rounded-3xl flex items-center justify-center text-4xl shadow-sm group-hover:scale-110 transition-transform">
                  {activePath.detail.subject === 'Matemática' ? '🧮' :
                    activePath.detail.subject === 'Português' ? '📝' :
                    activePath.detail.subject === 'Ciências' ? '🔬' : '📚'}
                </div>
                <div className="flex-1 space-y-2">
                  <Badge>{activePath.detail.subject}</Badge>
                  <h3 className="font-black text-xl text-slate-800">{activePath.detail.title}</h3>
                  <div className="space-y-1">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${pathPct}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                      <span>{activePath.status === 'not_started' ? 'Não iniciada' : `${pathProgress}/${pathTotal} etapas`}</span>
                      <span>{pathPct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="font-black text-slate-400 text-sm">Nenhuma trilha disponível ainda</p>
              <p className="text-xs text-slate-300 mt-1">Aguarde o professor adicionar trilhas para sua turma.</p>
            </div>
          )}
        </Card>

        {/* Achievements */}
        <Card className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Trophy className="text-warning-500" size={28} /> Conquistas
            </h2>
            <span className="text-xs font-black text-slate-400">{achievements.length} desbloqueadas</span>
          </div>

          {achievements.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {achievements.slice(0, 4).map((ach: any, i: number) => (
                <div key={i} className="p-4 rounded-2xl bg-warning-50 border-2 border-warning-100 flex flex-col items-center text-center gap-2 group hover:scale-105 transition-all cursor-default">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">
                    {ach.detail?.icon || '🏅'}
                  </div>
                  <span className="text-xs font-black text-warning-700 uppercase leading-tight">
                    {ach.detail?.title || 'Conquista'}
                  </span>
                </div>
              ))}
              {achievements.length < 4 && Array.from({ length: 4 - Math.min(achievements.length, 4) }).map((_, i) => (
                <div key={`empty-${i}`} className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center text-center gap-2 opacity-40">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">
                    <Lock size={20} className="text-slate-300" />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase">Bloqueado</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center text-center gap-2 opacity-40">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Lock size={20} className="text-slate-300" />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase">Bloqueado</span>
                </div>
              ))}
              <div className="col-span-2 text-center text-sm font-bold text-slate-400 -mt-2">
                Complete missões para desbloquear conquistas!
              </div>
            </div>
          )}

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/student/missions')}
          >
            Ver Missões e Conquistas
          </Button>
        </Card>
      </div>

      {/* Dicas da IA */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Sparkles size={22} className="text-primary-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
            Dicas da IA para você
          </h2>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
            Gerado agora
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {aiTips.map((tip, idx) => (
            <div 
              key={`${tip.title}-${idx}`}
              className={cn(
                "group relative overflow-hidden rounded-[2rem] p-6 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl bg-white",
                tip.bg,
                tip.border
              )}
            >
              <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <tip.icon size={120} />
              </div>

              <div className="relative z-10 space-y-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm transition-transform group-hover:scale-110", tip.color)}>
                  <tip.icon size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-slate-800">{tip.title}</h3>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    {tip.description}
                  </p>
                </div>
                <div className="pt-2">
                  <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-primary-500 transition-colors cursor-pointer flex items-center gap-1">
                    Hack de Aprendizado <ChevronRight size={10} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
