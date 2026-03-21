import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { db } from '../../lib/dexie';
import type { Achievement, StudentAchievement, GamificationStats } from '../../types/gamification';
import { Trophy, Lock, Star, Zap, Shield, Sparkles, Target, Medal, Crown, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import { checkAndUnlockAchievements } from '../../lib/gameSeeder';

type UnlockedAch = StudentAchievement & { detail?: Achievement };

const ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  Trophy, Star, Zap, Shield, Sparkles, Target, Medal, Crown, CheckCircle2,
};

export const Achievements: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [unlocked, setUnlocked] = useState<UnlockedAch[]>([]);
  const [allDefs, setAllDefs] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // First check and unlock any due achievements
      try { await checkAndUnlockAchievements(user.id); } catch(_) {}

      const defs = await db.achievements.toArray();
      setAllDefs(defs);

      const rawUnlocked = await db.studentAchievements.where('studentId').equals(user.id).toArray();
      const enriched = rawUnlocked.map(a => ({ ...a, detail: defs.find(d => d.id === a.achievementId) }));
      setUnlocked(enriched);

      const s = await db.gamificationStats.get(user.id);
      setStats(s || null);

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

  // Locked achievements
  const lockedDefs = allDefs.filter(d => !unlockedIds.has(d.id));

  const achColors = [
    'text-primary-500 bg-primary-50 border-primary-100',
    'text-energy-500 bg-energy-50 border-energy-100',
    'text-special-500 bg-special-50 border-special-100',
    'text-success-500 bg-success-50 border-success-100',
    'text-warning-500 bg-warning-50 border-warning-100',
    'text-indigo-500 bg-indigo-50 border-indigo-100',
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative z-10 space-y-4">
          <Badge variant="energy" className="bg-white/10 border-white/20 text-white tracking-widest uppercase">Galeria de Heróis</Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Suas <span className="text-primary-400">Conquistas</span>
          </h1>
          <p className="text-slate-400 font-medium text-lg max-w-lg">
            Colecione badges, ganhe XP e mostre toda sua evolução na plataforma.
          </p>
        </div>

        <div className="relative z-10 flex gap-4">
          <div className="bg-white/5 border border-white/10 p-5 rounded-3xl text-center backdrop-blur-sm min-w-[120px]">
            <div className="text-3xl font-black text-primary-400 mb-1">{unlocked.length}</div>
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Desbloqueadas</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-5 rounded-3xl text-center backdrop-blur-sm min-w-[120px]">
            <div className="text-3xl font-black text-warning-400 mb-1">{totalXP > 0 ? totalXP : (stats?.xp || 0)}</div>
            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">XP Total</div>
          </div>
        </div>
      </header>

      {/* Unlocked Achievements */}
      {unlocked.length > 0 && (
        <section>
          <h2 className="text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-warning-500" /> Desbloqueadas ({unlocked.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unlocked.map((ach, i) => {
              const colorClass = achColors[i % achColors.length];
              const [textColor, bgColor, borderColor] = colorClass.split(' ');
              const IcComponent = Zap; // default icon since icon names stored as strings
              return (
                <Card key={ach.id} className="p-8 border-slate-100 group hover:shadow-floating hover:border-primary-100 transition-all duration-500 relative overflow-hidden">
                  <div className="flex items-center gap-6 mb-6">
                    <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center border text-3xl shadow-sm group-hover:scale-110 transition-transform duration-500', bgColor, borderColor)}>
                      {ach.detail?.icon || '🏅'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-slate-800 leading-tight">{ach.detail?.title || 'Conquista'}</h3>
                      <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">
                        {new Date(ach.unlockedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                    {ach.detail?.description || ''}
                  </p>
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                    <Badge variant="success" className="bg-success-50 text-success-600 border-success-100 uppercase text-[9px] tracking-widest">
                      ✓ Completado
                    </Badge>
                    {ach.detail?.rewardXp && (
                      <span className="text-[10px] font-black text-slate-400">+{ach.detail.rewardXp} XP</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Locked Achievements */}
      {lockedDefs.length > 0 && (
        <section>
          <h2 className="text-lg font-black text-slate-400 mb-4 flex items-center gap-2">
            <Lock size={20} /> Bloqueadas ({lockedDefs.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lockedDefs.map((def, i) => (
              <Card key={def.id} className="p-8 border-slate-50 opacity-70 sepia-[0.2] relative overflow-hidden">
                <div className="absolute top-4 right-4 text-slate-300">
                  <Lock size={18} />
                </div>
                <div className="flex items-center gap-6 mb-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-100 text-3xl shadow-inner text-slate-300">
                    {def.icon || '🔒'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-slate-600 leading-tight">{def.title}</h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Em progresso</span>
                  </div>
                </div>
                <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">{def.description}</p>
                <div className="pt-4 border-t border-slate-50">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-slate-300 h-full rounded-full w-0" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Empty state - no achievements defined at all */}
      {allDefs.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="text-6xl mb-4">🏅</div>
          <h3 className="text-xl font-black text-slate-600 mb-2">Nenhuma conquista cadastrada ainda</h3>
          <p className="text-slate-400 text-sm">O administrador ainda não adicionou conquistas ao sistema.</p>
        </div>
      )}

      {/* All achieved - no locked */}
      {allDefs.length > 0 && lockedDefs.length === 0 && (
        <Card className="p-10 bg-gradient-to-br from-warning-400 to-warning-600 text-white text-center rounded-[2.5rem] shadow-2xl">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-2xl font-black">Parabéns! Você desbloqueou tudo!</h3>
          <p className="text-warning-100 mt-2">Você é um verdadeiro campeão do conhecimento!</p>
        </Card>
      )}
    </div>
  );
};
