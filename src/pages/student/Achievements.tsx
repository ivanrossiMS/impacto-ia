import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import type { Achievement, StudentAchievement, GamificationStats } from '../../types/gamification';
import { Trophy, Lock, Zap } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import { checkAndUnlockAchievements, ALL_ACHIEVEMENTS } from '../../lib/gameSeeder';

// ── Types ─────────────────────────────────────────────────────────────────────
type AchDef = Achievement & { condition?: string };
type UnlockedAch = StudentAchievement & { detail?: AchDef };

interface ExtraCounts {
  activitiesCorrect: number;
  missionsCompleted: number;
  itemsOwned: number;
  pathsStarted: number;
  pathsCompleted: number;
  diaryEntries: number;
  diaryAiEntries: number;
  duelCompleted: number;
  duelWins: number;
  daysRegistered: number;
}

// ── Progress calculator — mirrors checkAndUnlockAchievements logic ─────────────
function getCurrentValue(criteria: string, stats: GamificationStats, extra: ExtraCounts, totalUnlocked: number): number {
  switch (criteria) {
    case 'xp':                return stats.xp;
    case 'coins':             return stats.coins;
    case 'level':             return stats.level;
    case 'streak':            return stats.streak;
    case 'login':             return stats.xp >= 0 ? 1 : 0;
    case 'login_days':        return extra.daysRegistered;
    case 'days_registered':   return extra.daysRegistered;
    case 'activities_correct': return extra.activitiesCorrect;
    case 'math_correct':      return extra.activitiesCorrect;
    case 'portuguese_correct':return extra.activitiesCorrect;
    case 'science_correct':   return extra.activitiesCorrect;
    case 'history_correct':   return extra.activitiesCorrect;
    case 'geography_correct': return extra.activitiesCorrect;
    case 'subjects_mastered': return Math.min(5, Math.floor(extra.activitiesCorrect / 10));
    case 'missions_completed':return extra.missionsCompleted;
    case 'all_daily':         return extra.missionsCompleted > 0 ? 1 : 0;
    case 'all_weekly':        return extra.missionsCompleted > 0 ? 1 : 0;
    case 'epic_mission':      return extra.missionsCompleted > 0 ? 1 : 0;
    case 'items_owned':       return extra.itemsOwned;
    case 'items_purchased':   return extra.itemsOwned > 0 ? 1 : 0;
    case 'avatar_customized': return extra.itemsOwned > 0 ? 1 : 0;
    case 'full_avatar':       return extra.itemsOwned >= 3 ? 1 : 0;
    case 'stickers_equipped': return Math.min(extra.itemsOwned, 4);
    case 'paths_started':     return extra.pathsStarted;
    case 'paths_completed':   return extra.pathsCompleted;
    case 'diary_entries':     return extra.diaryEntries;
    case 'diary_ai_entry':    return extra.diaryAiEntries > 0 ? 1 : 0;
    case 'diary_tags':        return extra.diaryEntries;
    case 'duel_completed':    return extra.duelCompleted;
    case 'duel_wins':         return extra.duelWins;
    case 'all_achievements':  return totalUnlocked;
    case 'coins_spent':       return Math.max(0, (stats.xp * 2) - stats.coins);
    default:                  return 0;
  }
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function barGradient(pct: number): string {
  if (pct >= 100) return 'from-success-400 to-success-500';
  if (pct >= 70)  return 'from-primary-400 to-primary-600';
  if (pct >= 30)  return 'from-warning-400 to-warning-500';
  return 'from-slate-300 to-slate-400';
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-success-600';
  if (pct >= 70)  return 'text-primary-600';
  if (pct >= 30)  return 'text-warning-600';
  return 'text-slate-400';
}

// ── Component ─────────────────────────────────────────────────────────────────
export const Achievements: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [unlocked, setUnlocked] = useState<UnlockedAch[]>([]);
  const [allDefs, setAllDefs] = useState<AchDef[]>([]);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [extra, setExtra] = useState<ExtraCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // 1. Check & unlock any due achievements first
      try { await checkAndUnlockAchievements(user.id); } catch (_) {}

      // 2. Parallel: fetch definitions, unlocked, stats, and all extra counts
      const [defsRes, unlockedRes, statsRes, ...extraArr] = await Promise.all([
        supabase.from('achievements').select('*'),
        supabase.from('student_achievements').select('*').eq('studentId', user.id),
        supabase.from('gamification_stats').select('*').eq('id', user.id).single(),
        // Extra counts
        supabase.from('student_activity_results')
          .select('id', { count: 'exact', head: true })
          .eq('studentId', user.id).eq('status', 'passed'),
        supabase.from('student_missions')
          .select('id', { count: 'exact', head: true })
          .eq('studentId', user.id).not('claimedAt', 'is', null),
        supabase.from('student_owned_avatars')
          .select('id', { count: 'exact', head: true })
          .eq('studentId', user.id),
        supabase.from('student_progress')
          .select('id', { count: 'exact', head: true })
          .eq('studentId', user.id),
        supabase.from('student_progress')
          .select('id', { count: 'exact', head: true })
          .eq('studentId', user.id).eq('status', 'completed'),
        supabase.from('diary_entries')
          .select('id', { count: 'exact', head: true })
          .eq('studentId', user.id),
        supabase.from('diary_entries')
          .select('id', { count: 'exact', head: true })
          .eq('studentId', user.id).eq('isAIGenerated', true),
        supabase.from('duels')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .or(`challengerId.eq.${user.id},challengedId.eq.${user.id}`),
        supabase.from('duels')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .eq('winnerId', user.id),
        supabase.from('users')
          .select('createdAt')
          .eq('id', user.id)
          .single(),
      ]);

      const defs = (defsRes.data || []) as AchDef[];
      setAllDefs(defs);

      const rawUnlocked = unlockedRes.data || [];
      const enriched = rawUnlocked.map(a => ({
        ...a,
        detail: defs.find(d => d.id === a.achievementId),
      }));
      const unique = Array.from(
        new Map(enriched.map(i => [i.achievementId, i])).values()
      );
      setUnlocked(unique);

      setStats((statsRes.data as GamificationStats) || null);

      const [actR, misR, invR, pathStR, pathCoR, diaryR, diaryAiR, duelCR, duelWR, userR] = extraArr as any[];
      const userCreatedAt = userR?.data?.createdAt;
      setExtra({
        activitiesCorrect: actR?.count ?? 0,
        missionsCompleted: misR?.count ?? 0,
        itemsOwned: invR?.count ?? 0,
        pathsStarted: pathStR?.count ?? 0,
        pathsCompleted: pathCoR?.count ?? 0,
        diaryEntries: diaryR?.count ?? 0,
        diaryAiEntries: diaryAiR?.count ?? 0,
        duelCompleted: duelCR?.count ?? 0,
        duelWins: duelWR?.count ?? 0,
        daysRegistered: userCreatedAt
          ? Math.floor((Date.now() - new Date(userCreatedAt).getTime()) / 86400000)
          : 0,
      });

      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const unlockedIds = new Set(unlocked.map(u => u.achievementId));
  const totalXP = unlocked.reduce((acc, a) => acc + (a.detail?.rewardXp || 0), 0);
  const lockedDefs = allDefs.filter(d => !unlockedIds.has(d.id));

  const achColors = [
    { text: 'text-primary-500', bg: 'bg-primary-50', border: 'border-primary-100' },
    { text: 'text-energy-500', bg: 'bg-energy-50', border: 'border-energy-100' },
    { text: 'text-special-500', bg: 'bg-special-50', border: 'border-special-100' },
    { text: 'text-success-500', bg: 'bg-success-50', border: 'border-success-100' },
    { text: 'text-warning-500', bg: 'bg-warning-50', border: 'border-warning-100' },
    { text: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  ];

  // Helper: get progress data for a locked achievement
  const getProgress = (def: AchDef) => {
    // `condition` in DB = criteria string saved by seedAchievements
    const criteria = (def.condition ?? '') as string;
    const template = ALL_ACHIEVEMENTS.find(a => a.id === def.id || a.title === def.title);
    const requiredCount = template?.requiredCount ?? 1;
    if (!stats || !extra) return { current: 0, total: requiredCount, pct: 0, criteria };
    const current = getCurrentValue(criteria, stats, extra, unlockedIds.size);
    const pct = Math.min(100, Math.round((current / requiredCount) * 100));
    return { current, total: requiredCount, pct, criteria };
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative z-10 space-y-3">
          <Badge variant="energy" className="bg-white/10 border-white/20 text-white tracking-widest uppercase">Galeria de Heróis</Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Suas <span className="text-primary-400">Conquistas</span>
          </h1>
          <p className="text-slate-400 font-medium text-lg max-w-lg">
            Colecione badges, ganhe XP e mostre toda sua evolução na plataforma.
          </p>
        </div>
        <div className="relative z-10 flex gap-4 flex-wrap">
          {[
            { label: 'Desbloqueadas', value: unlocked.length, color: 'text-primary-400' },
            { label: 'XP Ganho', value: totalXP > 0 ? totalXP : (stats?.xp || 0), color: 'text-warning-400' },
            { label: '% Completo', value: `${allDefs.length > 0 ? Math.round((unlocked.length / allDefs.length) * 100) : 0}%`, color: 'text-special-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 p-5 rounded-3xl text-center backdrop-blur-sm min-w-[120px]">
              <div className={cn("text-3xl font-black mb-1", s.color)}>{s.value}</div>
              <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── Overall progress bar ────────────────────────────────────────────── */}
      {allDefs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-black text-slate-600">Progresso Geral</span>
            <span className="font-black text-primary-600">{unlocked.length} / {allDefs.length} conquistas</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-special-500 rounded-full transition-all duration-1000"
              style={{ width: `${Math.round((unlocked.length / allDefs.length) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Unlocked Achievements ───────────────────────────────────────────── */}
      {unlocked.length > 0 && (
        <section>
          <h2 className="text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-warning-500" /> Desbloqueadas ({unlocked.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {unlocked.map((ach, i) => {
              const col = achColors[i % achColors.length];
              return (
                <Card key={ach.id} className="p-6 border-slate-100 group hover:shadow-floating hover:border-success-100 transition-all duration-500 relative overflow-hidden">
                  {/* Shine on hover */}
                  <div className="absolute inset-0 bg-success-50/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="relative z-10 space-y-4">
                    {/* Icon + title */}
                    <div className="flex items-start gap-4">
                      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center border text-3xl shadow-sm group-hover:scale-110 transition-transform duration-500 flex-shrink-0', col.bg, col.border)}>
                        {ach.detail?.icon || '🏅'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-black text-slate-800 leading-tight">{ach.detail?.title || 'Conquista'}</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{ach.detail?.description || ''}</p>
                      </div>
                    </div>
                    {/* Rewards + date */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="bg-success-50 text-success-600 border-success-100 text-[9px] uppercase tracking-widest py-0.5">✓ Completa</Badge>
                        {ach.detail?.rewardXp ? (
                          <span className="text-[10px] font-black text-slate-400 flex items-center gap-0.5">
                            <Zap size={9} /> {ach.detail.rewardXp} XP
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(ach.unlockedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {/* 100% progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progresso</span>
                        <span className="text-[10px] font-black text-success-600">100% ✓</span>
                      </div>
                      <div className="h-2.5 bg-success-100 rounded-full overflow-hidden">
                        <div className="h-full w-full bg-gradient-to-r from-success-400 to-success-500 rounded-full" />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Locked Achievements ─────────────────────────────────────────────── */}
      {lockedDefs.length > 0 && (
        <section>
          <h2 className="text-lg font-black text-slate-400 mb-4 flex items-center gap-2">
            <Lock size={20} /> Em Progresso ({lockedDefs.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lockedDefs.map((def) => {
              const { current, total, pct } = getProgress(def);
              const isClose = pct >= 70;
              const hasProgress = pct > 0;

              return (
                <Card
                  key={def.id}
                  className={cn(
                    "p-6 border transition-all duration-300 relative overflow-hidden group",
                    isClose
                      ? "border-primary-100 bg-primary-50/20 hover:border-primary-200 hover:shadow-lg"
                      : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-md"
                  )}
                >
                  {/* Pulse dot for "almost there" */}
                  {isClose && (
                    <div className="absolute top-3 right-3">
                      <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-pulse" />
                    </div>
                  )}

                  <div className="relative z-10 space-y-4">
                    {/* Icon + title + description */}
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm flex-shrink-0 border transition-all duration-300',
                        isClose
                          ? 'bg-primary-100 border-primary-200 group-hover:scale-110'
                          : hasProgress
                          ? 'bg-slate-100 border-slate-200'
                          : 'bg-slate-50 border-slate-100 grayscale'
                      )}>
                        {pct < 5 ? '🔒' : def.icon || '🏅'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          "text-base font-black leading-tight",
                          isClose ? "text-slate-800" : "text-slate-600"
                        )}>
                          {def.title}
                        </h3>
                        {/* Description always visible */}
                        <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1">
                          {def.description}
                        </p>
                      </div>
                    </div>

                    {/* Rewards */}
                    {(def.rewardXp > 0 || def.rewardCoins > 0) && (
                      <div className="flex items-center gap-2">
                        {def.rewardXp > 0 && (
                          <span className="text-[10px] font-black text-slate-300 flex items-center gap-0.5">
                            <Zap size={9} /> +{def.rewardXp} XP
                          </span>
                        )}
                        {def.rewardCoins > 0 && (
                          <span className="text-[10px] font-black text-slate-300 flex items-center gap-0.5">
                            🪙 +{def.rewardCoins}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {isClose ? '🔥 Quase lá!' : 'Progresso'}
                        </span>
                        <span className={cn("text-[11px] font-black tabular-nums", pctColor(pct))}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                        <div
                          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out relative", barGradient(pct))}
                          style={{ width: `${pct}%`, minWidth: pct > 0 ? '6px' : '0' }}
                        >
                          {/* Shimmer */}
                          {pct > 5 && (
                            <div className="absolute inset-0 overflow-hidden rounded-full">
                              <div className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-medium text-slate-400">
                          {current.toLocaleString('pt-BR')} / {total.toLocaleString('pt-BR')}
                        </span>
                        {isClose && (
                          <span className="text-[10px] font-black text-primary-500">Falta pouco!</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {allDefs.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="text-6xl mb-4">🏅</div>
          <h3 className="text-xl font-black text-slate-600 mb-2">Nenhuma conquista cadastrada ainda</h3>
          <p className="text-slate-400 text-sm">O administrador ainda não adicionou conquistas ao sistema.</p>
        </div>
      )}

      {/* ── All unlocked! ───────────────────────────────────────────────────── */}
      {allDefs.length > 0 && lockedDefs.length === 0 && (
        <Card className="p-10 bg-gradient-to-br from-warning-400 to-warning-600 text-white text-center rounded-[2.5rem] shadow-2xl">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-2xl font-black">Parabéns! Você desbloqueou tudo!</h3>
          <p className="text-warning-100 mt-2">Você é um verdadeiro campeão do conhecimento!</p>
        </Card>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { left: -2rem; }
          100% { left: 110%; }
        }
        .animate-\\[shimmer_2s_infinite\\] {
          animation: shimmer 2s ease-in-out infinite;
          position: absolute;
          top: 0; bottom: 0;
        }
      `}</style>
    </div>
  );
};
