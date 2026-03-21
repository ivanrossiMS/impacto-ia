import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { db } from '../../lib/dexie';
import type { GamificationStats, Mission, StudentMissionProgress } from '../../types/gamification';
import {
  Target,
  Zap,
  Trophy,
  Timer,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Flame,
  Star,
  AlertCircle
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { ensureMissionsAreUpToDate } from '../../lib/gameSeeder';
import { updateGamificationStats } from '../../lib/gamificationUtils';

type MissionWithProgress = Mission & {
  progress: StudentMissionProgress | null;
};

export const Missions: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'epic'>('daily');
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [missions, setMissions] = useState<MissionWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Ensure missions are up-to-date before loading
    ensureMissionsAreUpToDate().then(() => loadAll()).catch(() => loadAll());
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    const s = await db.gamificationStats.get(user.id);
    setStats(s || null);

    const allMissions = await db.missions.toArray();
    const studentMissions = await db.studentMissions.where('studentId').equals(user.id).toArray();

    const enriched: MissionWithProgress[] = allMissions.map(mission => ({
      ...mission,
      progress: studentMissions.find(sm => sm.missionId === mission.id) || null
    }));

    setMissions(enriched);
    setLoading(false);
  };

  const handleCollect = async (mission: MissionWithProgress) => {
    if (!user || !mission.progress?.completedAt || mission.progress?.claimedAt) return;
    
    const now = new Date().toISOString();
    try {
      const result = await updateGamificationStats(user.id, {
        xpToAdd: mission.rewardXp || 0,
        coinsToAdd: mission.rewardCoins || 0
      });

      // Mark as claimed
      await db.studentMissions.update(mission.progress.id, {
        claimedAt: now
      });
      
      // Update local state
      if (result) {
        setStats(prev => prev ? { 
          ...prev, 
          coins: prev.coins + (mission.rewardCoins || 0), 
          xp: prev.xp + (mission.rewardXp || 0), 
          level: result.newLevel,
          lastStudyDate: now
        } : null);
      }

      setMissions(prev => prev.map(m => 
        m.id === mission.id 
          ? { ...m, progress: { ...m.progress!, claimedAt: now } } 
          : m
      ));
      
      toast.success(`+${mission.rewardXp} XP e +${mission.rewardCoins} 🪙 coletados!`);
    } catch (error) {
      console.error('Error collecting mission reward:', error);
      toast.error('Erro ao coletar recompensa.');
    }
  };

  const filteredMissions = missions.filter(m => m.type === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-energy-500">
            <Target size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Desafios e Objetivos</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Missões <span className="text-energy-600">Ativas</span></h1>
          <p className="text-slate-500 font-medium">Complete tarefas para ganhar moedas e subir de nível mais rápido.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] shadow-sm border border-slate-100">
          {stats && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 bg-energy-50 rounded-full border border-energy-100">
                <Flame size={16} className="text-energy-500" />
                <span className="text-sm font-black text-energy-600">{stats.streak} Dias</span>
              </div>
              <div className="w-px h-6 bg-slate-100"></div>
              <div className="flex items-center gap-2 px-4 py-2 bg-warning-50 rounded-full border border-warning-100">
                <span className="text-lg">🪙</span>
                <span className="text-sm font-black text-warning-600">{stats.coins}</span>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2.5rem] w-fit mx-auto md:mx-0">
        {[
          { id: 'daily', label: 'Diárias', icon: Timer },
          { id: 'weekly', label: 'Semanais', icon: Zap },
          { id: 'epic', label: 'Mensais', icon: Sparkles },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-8 py-3 rounded-[2rem] text-sm font-black transition-all',
              activeTab === tab.id
                ? 'bg-white text-primary-600 shadow-md scale-[1.05]'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {filteredMissions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-black text-slate-600 mb-2">
            Nenhuma missão {activeTab === 'daily' ? 'diária' : activeTab === 'weekly' ? 'semanal' : 'épica'} disponível
          </h3>
          <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto">
            As missões serão adicionadas pelo professor ou pelo sistema.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMissions.map((mission) => {
            const prog = mission.progress;
            const current = prog?.currentCount || 0;
            const total = mission.targetCount || 1;
            const isDone = !!prog?.completedAt;
            const isLocked = (stats?.level || 1) < (mission.requiredLevel || 1);

            return (
              <Card
                key={mission.id}
                className={cn(
                  'p-8 border-slate-100 group transition-all duration-500 relative overflow-hidden',
                  isLocked ? 'bg-slate-50/50 opacity-60' : isDone ? 'border-success-100 bg-success-50/30' : 'hover:border-primary-100 hover:shadow-floating'
                )}
              >
                {isLocked && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/5 backdrop-blur-[1px]">
                    <div className="bg-white p-4 rounded-3xl shadow-2xl flex items-center gap-3">
                      <AlertCircle size={20} className="text-slate-400" />
                      <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Nível {mission.requiredLevel || 1} Requerido</span>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0',
                      isDone ? 'bg-success-500' :
                      mission.type === 'daily' ? 'bg-energy-500' :
                      mission.type === 'weekly' ? 'bg-primary-500' : 'bg-special-600'
                    )}>
                      {isDone ? <CheckCircle2 size={24} /> : <Target size={24} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 leading-tight flex items-center gap-2">
                        {mission.title}
                        {isDone && <Badge variant="success" className="scale-75">Conclúido</Badge>}
                      </h3>
                      <p className="text-sm font-medium text-slate-400 mt-1">{mission.description}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    {mission.rewardCoins && <div className="text-lg font-black text-warning-500">+{mission.rewardCoins} 🪙</div>}
                    {mission.rewardXp && <div className="text-[10px] font-black uppercase text-primary-400">+{mission.rewardXp} XP</div>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Progresso</span>
                    <span className="text-sm font-black text-slate-700">{Math.min(current, total)} / {total}</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner">
                    <div
                      className={cn('h-full rounded-full transition-all duration-1000', isDone ? 'bg-success-500' : 'bg-primary-500')}
                      style={{ width: `${(Math.min(current, total) / total) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                  {isDone ? (
                    <Button 
                      variant={prog?.claimedAt ? "outline" : "success"} 
                      className={cn(
                        "w-full rounded-2xl font-black py-4 transition-all",
                        !prog?.claimedAt && "shadow-xl shadow-success-500/10"
                      )} 
                      onClick={() => handleCollect(mission)}
                      disabled={!!prog?.claimedAt}
                    >
                      {prog?.claimedAt ? "Recompensa Coletada ✅" : "Coletar Recompensa 🎉"}
                    </Button>
                  ) : (
                    <Button 
                      variant="ghost" 
                      className="w-full rounded-2xl font-bold text-slate-400 group-hover:text-primary-500 transition-colors gap-2"
                      onClick={() => {
                        switch(mission.criteria) {
                          case 'store_visit': navigate('/student/store'); break;
                          case 'diary_entry': navigate('/student/diary'); break;
                          case 'ranking_visit': navigate('/student/ranking'); break;
                          case 'path_started': 
                          case 'path_completed': navigate('/student/paths'); break;
                          case 'library_access': navigate('/student/library'); break;
                          case 'avatar_customized': navigate('/student/avatar'); break;
                          case 'tutor_question': navigate('/student/tutor'); break;
                          case 'duel_completed': navigate('/student/duels'); break;
                          default: navigate('/student/activities');
                        }
                      }}
                    >
                      {mission.criteria === 'store_visit' ? 'Ir para Loja' : 
                       mission.criteria === 'diary_entry' ? 'Ir para Diário' : 
                       mission.criteria === 'ranking_visit' ? 'Ir para Ranking' : 
                       mission.criteria === 'library_access' ? 'Ir para Biblioteca' : 
                       mission.criteria === 'tutor_question' ? 'Ir para Tutor IA' : 
                       mission.criteria === 'duel_completed' ? 'Ir para Duelos' : 
                       'Ir para Atividade'} <ChevronRight size={18} />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Streak Bonus Banner */}
      {stats && stats.streak >= 3 && (
        <Card className="p-10 bg-gradient-to-br from-slate-900 to-slate-800 border-none rounded-[3rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-primary-500/20 transition-all duration-1000"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="w-24 h-24 bg-white/10 rounded-[2rem] flex items-center justify-center text-warning-400 backdrop-blur-md border border-white/10">
              <Trophy size={48} className="stroke-[1.5]" />
            </div>
            <div className="flex-1 text-center md:text-left space-y-2">
              <h3 className="text-2xl font-black text-white">Sequência Incrível! 🔥</h3>
              <p className="text-slate-400 font-medium">
                Você está em uma sequência de <span className="text-warning-400 font-bold">{stats.streak} dias</span>! Continue assim para desbloquear recompensas exclusivas.
              </p>
            </div>
            <Button variant="ai" className="rounded-2xl px-10 py-5 font-black gap-2 shadow-2xl shadow-special-500/20"
              onClick={() => navigate('/student/store')}>
              Ver Recompensas <Star size={18} />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
