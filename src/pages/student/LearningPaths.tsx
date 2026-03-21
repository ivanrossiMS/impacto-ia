import React, { useEffect, useState } from 'react';
import { db } from '../../lib/dexie';
import type { LearningPath, StudentProgress } from '../../types/learning';
import { useAuthStore } from '../../store/auth.store';
import { Star, ChevronRight, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '../../lib/utils';

export const LearningPaths: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [progress, setProgress] = useState<Record<string, StudentProgress>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);

  useEffect(() => {
    const loadPaths = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        // 1. Get live user data (classId, grade)
        const liveUser = await db.users.get(user.id);
        if (!liveUser) return;

        const userClassId = (liveUser as any).classId || '';
        let userGrade = (liveUser as any).grade || '';
        const currentYear = new Date().getFullYear().toString();

        // If grade is missing, try to get it from the class
        if (!userGrade && userClassId) {
          const cls = await db.classes.get(userClassId);
          if (cls) userGrade = cls.grade;
        }

        // 2. Fetch Trails specifically linked to this class
        const classPaths = await db.learningPaths
          .where('classId').equals(userClassId)
          .filter(p => !p.schoolYear || p.schoolYear === currentYear)
          .toArray();

        // 3. Fetch General Trails for this grade (not linked to any class)
        const generalPaths = await db.learningPaths
          .where('grade').equals(userGrade)
          .filter(p => !p.classId || p.classId === '')
          .filter(p => !p.schoolYear || p.schoolYear === currentYear)
          .toArray();

        const allPaths = [...classPaths, ...generalPaths];

        // 4. Fetch Progress
        const allProgress = await db.studentProgress.where('studentId').equals(user.id).toArray();
        
        const progressMap = allProgress.reduce((acc, curr) => {
          acc[curr.pathId] = curr;
          return acc;
        }, {} as Record<string, StudentProgress>);

        setPaths(allPaths);
        setProgress(progressMap);
      } catch (err) {
        console.error('[LearningPaths] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPaths();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-black text-primary-600 animate-pulse">CARREGANDO MAPA...</p>
      </div>
    );
  }

  if (paths.length === 0) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Trilhas de <span className="text-primary-400">Aprendizagem</span></h1>
            <p className="text-slate-400 font-medium mt-1">Siga o mapa, complete os desafios e conquiste novos saberes!</p>
          </div>
        </header>
        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-black text-slate-600 mb-2">Nenhuma trilha disponível ainda</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Assim que o administrador cadastrar trilhas de aprendizagem, elas aparecerão aqui no mapa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Trilhas de <span className="text-primary-400">Aprendizagem</span></h1>
          <p className="text-slate-400 font-medium mt-1">Siga o mapa, complete os desafios e conquiste novos saberes!</p>
        </div>
        <div className="relative z-10 flex items-center gap-3 bg-white/10 border border-white/20 px-6 py-3 rounded-2xl backdrop-blur-md">
          <Star className="text-warning-400 fill-warning-400" size={24} />
          <div className="flex flex-col">
            <span className="text-xl font-black leading-none">{paths.length}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trilhas</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {paths.map((path, index) => {
          const pathProgress = progress[path.id];
          const isCompleted = pathProgress?.status === 'completed';
          const isInProgress = pathProgress?.status === 'in_progress';
          const isLocked = index > 0 && !progress[paths[index - 1].id]?.status && !isCompleted && !isInProgress;

          return (
            <div 
              key={path.id}
              onClick={() => !isLocked && setSelectedPath(path)}
              className={cn(
                "group relative bg-white rounded-[2.5rem] border-2 p-8 transition-all duration-500 cursor-pointer",
                isLocked 
                  ? "border-slate-100 opacity-60 grayscale bg-slate-50 cursor-not-allowed" 
                  : "border-transparent shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-2 hover:border-primary-100"
              )}
            >
              <div className="flex justify-between items-start mb-6">
                <div className={cn(
                  "w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-inner transform group-hover:scale-110 transition-transform duration-500",
                  path.subject === 'Matemática' ? "bg-primary-50" : "bg-special-50"
                )}>
                  {path.subject === 'Matemática' ? '📐' : '🧬'}
                </div>
                {isCompleted ? (
                  <div className="bg-success-100 text-success-600 p-2.5 rounded-2xl shadow-sm animate-in zoom-in">
                    <CheckCircle2 size={24} />
                  </div>
                ) : isLocked ? (
                  <div className="bg-slate-200 text-slate-500 p-2.5 rounded-2xl">
                    <Lock size={20} />
                  </div>
                ) : isInProgress ? (
                  <div className="bg-primary-100 text-primary-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Em curso
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border",
                    path.subject === 'Matemática' ? "text-primary-600 bg-primary-50 border-primary-100" : "text-special-600 bg-special-50 border-special-100"
                  )}>
                    {path.subject}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                    {path.grade}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight group-hover:text-primary-600 transition-colors">
                  {path.title}
                </h3>
              </div>

              {!isLocked && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Progresso</span>
                      <span>
                        {isCompleted ? '100' :
                          isInProgress
                            ? Math.round(((pathProgress?.completedStepIds?.length || 0) / (path.steps?.length || 1)) * 100)
                            : '0'}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
                      <div
                        className={cn('h-full rounded-full transition-all duration-1000 shadow-sm', path.subject === 'Matemática' ? 'bg-primary-500' : 'bg-special-500')}
                        style={{
                          width: isCompleted ? '100%' :
                            isInProgress
                              ? `${Math.round(((pathProgress?.completedStepIds?.length || 0) / (path.steps?.length || 1)) * 100)}%`
                              : '0%'
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-sm text-warning-600 bg-warning-50 px-4 py-2 rounded-2xl">
                      <span className="text-lg">🪙</span> {path.rewardCoins}
                    </div>
                    <div className="text-primary-500 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                      <ChevronRight size={28} />
                    </div>
                  </div>
                </div>
              )}

              {isLocked && (
                <div className="mt-8 pt-6 border-t border-slate-100 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Bloqueado • Conclua o anterior
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Path Detail Modal */}
      {selectedPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className={cn(
                "h-48 relative flex items-end p-10",
                selectedPath.subject === 'Matemática' ? "bg-primary-600" : "bg-special-600"
              )}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                <div className="relative z-10 flex items-center gap-6">
                   <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-5xl shadow-2xl">
                    {selectedPath.subject === 'Matemática' ? '📐' : '🧬'}
                   </div>
                   <div className="text-white">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">{selectedPath.grade}</div>
                      <h2 className="text-4xl font-black tracking-tight">{selectedPath.title}</h2>
                   </div>
                </div>
                <button 
                  onClick={() => setSelectedPath(null)}
                  className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all"
                >
                  <Lock size={20} className="rotate-45" /> {/* Using Lock as an X variant */}
                </button>
              </div>

              <div className="p-10 space-y-8">
                 <div className="grid grid-cols-3 gap-6">
                    {[
                      { label: 'Recompensa', val: `${selectedPath.rewardCoins} Moedas`, icon: '🪙' },
                      { label: 'Dificuldade', val: 'Mix Nível', icon: '🔥' },
                      { label: 'Tutor IA', val: 'Ativo', icon: '🤖' },
                    ].map((m, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center">
                         <div className="text-xl mb-1">{m.icon}</div>
                         <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{m.label}</div>
                         <div className="text-[11px] font-bold text-slate-800">{m.val}</div>
                      </div>
                    ))}
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                       <Star className="text-primary-500" size={20} fill="currentColor" /> Sobre esta trilha
                    </h4>
                    <p className="text-slate-500 font-medium leading-relaxed">
                       {selectedPath.description}. Prepare-se para uma jornada cheia de descobertas e desafios que vão testar suas habilidades em {selectedPath.subject}.
                    </p>
                 </div>

                 <div className="pt-6 border-t border-slate-100 flex gap-4">
                    <button 
                       onClick={() => setSelectedPath(null)}
                       className="flex-1 py-5 rounded-[1.5rem] font-black text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all"
                    >
                       Voltar
                    </button>
                    <button 
                       className="flex-[2] py-5 rounded-[1.5rem] font-black text-white bg-slate-900 shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                       onClick={() => {
                          toast.success(`Iniciando ${selectedPath.title}...`);
                          setSelectedPath(null);
                          // In a real app, this would navigate to the first lesson
                       }}
                    >
                       Explorar Trilha agora <ChevronRight size={20} />
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
