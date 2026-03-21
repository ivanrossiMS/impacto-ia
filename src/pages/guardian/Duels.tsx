import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Sword, 
  CheckCircle2, 
  XCircle, 
  History,
  Target,
  Users,
  Star,
  Activity,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Duel, DuelQuestion } from '../../types/duel';
import type { Student, AppUser } from '../../types/user';

export const Duels: React.FC = () => {
  const user = useAuthStore(state => state.user) as (AppUser & { studentIds?: string[] }) | null;
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedDuelId, setSelectedDuelId] = useState<string | null>(null);

  // Fetch guardian's students with robust logic
  const students = useLiveQuery(async () => {
    if (!user || user.role !== 'guardian') return [] as Student[];
    
    const liveGuardian = await db.users.get(user.id);
    const sidList = (liveGuardian && liveGuardian.role === 'guardian') ? (liveGuardian.studentIds || []) : [];

    const linkedByGuardian = await db.users.where('id').anyOf(sidList).toArray();
    const linkedByStudent = await db.users.where('guardianIds').equals(user.id).toArray();
    
    const all = [...linkedByGuardian, ...linkedByStudent];
    const uniqueIds = new Set();
    return all.filter(s => {
      if (s.role !== 'student' || uniqueIds.has(s.id)) return false;
      uniqueIds.add(s.id);
      return true;
    }) as Student[];
  }, [user?.id]) || [];

  // Initial selection
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students]);

  // Fetch duels for selected student
  const duels = useLiveQuery(async () => {
    if (!selectedStudentId) return [] as Duel[];
    return await db.duels
      .where('challengerId').equals(selectedStudentId)
      .or('challengedId').equals(selectedStudentId)
      .reverse()
      .sortBy('createdAt');
  }, [selectedStudentId]) || [];

  // Fetch questions for selected duel
  const duelQuestions = useLiveQuery(async () => {
    if (!selectedDuelId) return [] as DuelQuestion[];
    return await db.duelQuestions
      .where('duelId').equals(selectedDuelId)
      .toArray();
  }, [selectedDuelId]) || [];

  // Fetch opponent data for each duel to show names
  const opponents = useLiveQuery(async () => {
    if (duels.length === 0) return {};
    const opIds = Array.from(new Set(duels.map(d => d.challengerId === selectedStudentId ? d.challengedId : d.challengerId)));
    const opData = await db.users.where('id').anyOf(opIds).toArray();
    return opData.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.name }), {} as Record<string, string>);
  }, [duels, selectedStudentId]) || {};

  const selectedDuel = duels.find(d => d.id === selectedDuelId);
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary-500">
            <Sword size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Monitoramento de Desafios</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">
            Histórico de <span className="text-primary-600">Duelos</span>
          </h1>
          <p className="text-slate-500 font-medium">Acompanhe os desafios e o desempenho dos seus filhos em tempo real.</p>
        </div>

        {/* Child Selector */}
        {students.length > 1 && (
          <div className="flex gap-2 p-1.5 bg-white border border-slate-100 rounded-[2rem] shadow-sm w-fit">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedStudentId(s.id);
                  setSelectedDuelId(null);
                }}
                className={cn(
                  "px-6 py-2.5 rounded-2xl text-sm font-black transition-all",
                  selectedStudentId === s.id
                    ? "bg-primary-600 text-white shadow-md scale-[1.05]"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Duel List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <History size={18} className="text-slate-400" /> Duelos Recentes
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{duels.length} Registrados</span>
          </div>

          {duels.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] p-12 border-2 border-dashed border-slate-100 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⚔️</div>
              <p className="text-slate-500 font-black text-sm">Nenhum duelo realizado</p>
              <p className="text-slate-400 text-xs mt-1">Os duelos do(a) {selectedStudent?.name.split(' ')[0]} aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
              {duels.map(duel => {
                const isChallenger = duel.challengerId === selectedStudentId;
                const opponentId = isChallenger ? duel.challengedId : duel.challengerId;
                const myScore = isChallenger ? duel.challengerScore : duel.challengedScore;
                const opScore = isChallenger ? duel.challengedScore : duel.challengerScore;
                const isWinner = duel.winnerId === selectedStudentId;
                const isDraw = duel.winnerId === 'draw';
                const isPending = duel.status !== 'completed';
                const opponentName = opponents[opponentId] || 'Oponente';

                return (
                  <button
                    key={duel.id}
                    onClick={() => setSelectedDuelId(duel.id)}
                    className={cn(
                      "w-full text-left p-5 rounded-[2rem] border-2 transition-all group relative overflow-hidden",
                      selectedDuelId === duel.id
                        ? "border-primary-500 bg-primary-50/30 shadow-lg scale-[1.02]"
                        : "border-slate-100 bg-white hover:border-primary-200"
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5",
                        isPending ? "bg-slate-100 text-slate-500" :
                        isWinner ? "bg-success-100 text-success-700" :
                        isDraw ? "bg-warning-100 text-warning-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", 
                          isPending ? "bg-slate-400" :
                          isWinner ? "bg-success-500" :
                          isDraw ? "bg-warning-500" : "bg-red-500"
                        )} />
                        {isPending ? 'Em Andamento' : isWinner ? 'Vitória' : isDraw ? 'Empate' : 'Derrota'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(duel.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Oponente</div>
                        <div className="font-black text-slate-700 truncate">{opponentName}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider bg-slate-50 w-fit px-2 rounded-md">Tema: {duel.theme}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Placar</div>
                        <div className="font-black text-slate-800 text-xl tracking-tight">
                          <span className={isWinner ? "text-success-600" : ""}>{myScore}</span>
                          <span className="text-slate-300 font-medium mx-1.5">×</span>
                          <span>{opScore}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed View */}
        <div className="lg:col-span-2 min-h-[600px]">
          {!selectedDuelId ? (
            <div className="h-full bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center group">
              <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-slate-100">
                <Target size={48} className="text-slate-200 group-hover:text-primary-200 transition-colors" />
              </div>
              <h3 className="text-2xl font-black text-slate-400">Análise de Desempenho</h3>
              <p className="text-slate-300 font-medium max-w-xs mt-3 leading-relaxed">Selecione um duelo da lista para revisar cada questão e as respostas do(a) seu filho(a).</p>
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col h-full animate-in zoom-in-95 duration-300">
              {/* Detail Header */}
              <div className="p-10 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 text-white relative flex flex-col justify-end overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-special-500/5 rounded-full blur-2xl -ml-16 -mb-16" />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 text-white/90">
                      {selectedDuel?.theme}
                    </span>
                    <span className={cn(
                      "px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-lg",
                      selectedDuel?.difficulty === 'easy' ? "bg-success-500/20 border-success-500/30 text-success-300" :
                      selectedDuel?.difficulty === 'medium' ? "bg-warning-500/20 border-warning-500/30 text-warning-300" :
                      "bg-red-500/20 border-red-500/30 text-red-300"
                    )}>
                      Nível {selectedDuel?.difficulty === 'easy' ? 'Fácil' : selectedDuel?.difficulty === 'medium' ? 'Médio' : 'Difícil'}
                    </span>
                  </div>
                  
                  <div className="flex items-end justify-between gap-6">
                    <div>
                      <h2 className="text-3xl font-black tracking-tight">{selectedStudent?.name}</h2>
                      <p className="text-slate-400 font-bold text-sm mt-1 flex items-center gap-2">
                        <Users size={14} /> Contra {selectedDuel ? (opponents[selectedDuel.challengerId === selectedStudentId ? selectedDuel.challengedId : selectedDuel.challengerId] || 'Oponente') : 'Oponente'}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-1">Resultado Final</div>
                      <div className="text-5xl font-black tracking-tighter flex items-center gap-3">
                        {selectedDuel?.challengerId === selectedStudentId ? selectedDuel?.challengerScore : selectedDuel?.challengedScore}
                        <span className="text-white/20 text-3xl font-normal">/</span>
                        <span className="text-white/40">{selectedDuel?.questionCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Revisão Técnica</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-success-500 rounded-full" />
                      <span className="text-[10px] font-black text-slate-500 uppercase">Acertos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-[10px] font-black text-slate-500 uppercase">Erros</span>
                    </div>
                  </div>
                </div>
                
                {duelQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-4">
                    <div className="animate-spin w-10 h-10 border-[3px] border-primary-500 border-t-transparent rounded-full shadow-inner" />
                    <p className="font-black text-sm uppercase tracking-widest">Carregando questões...</p>
                  </div>
                ) : (
                  duelQuestions.map((q, idx) => {
                    const isChallenger = selectedDuel?.challengerId === selectedStudentId;
                    const myAnswerId = isChallenger ? q.challengerAnswerId : q.challengedAnswerId;
                    const myOption = q.options.find(o => o.id === myAnswerId);
                    const isCorrect = myOption?.isCorrect;

                    return (
                      <div key={q.id} className="group relative">
                        <div className="flex items-start gap-6">
                          <div className={cn(
                            "w-12 h-12 rounded-[1.25rem] flex items-center justify-center font-black flex-shrink-0 text-lg shadow-xl shrink-0 transition-transform group-hover:scale-110",
                            isCorrect === undefined ? "bg-slate-100 text-slate-400" :
                            isCorrect ? "bg-success-500 text-white" : "bg-red-500 text-white"
                          )}>
                            {idx + 1}
                          </div>
                          
                          <div className="flex-1 space-y-5">
                            <div className="space-y-2">
                              <p className="font-black text-slate-800 text-lg leading-tight tracking-tight">{q.questionText}</p>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Activity size={12} /> Resposta do aluno: 
                                <span className={cn("font-black", 
                                  isCorrect ? "text-success-600" : 
                                  isCorrect === false ? "text-red-600" : "text-slate-500"
                                )}>
                                  {myOption ? (isCorrect ? 'Correta' : 'Incorreta') : 'Não respondida'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {q.options.map(opt => (
                                <div
                                  key={opt.id}
                                  className={cn(
                                    "p-5 rounded-2xl border-2 text-sm font-bold transition-all flex items-center justify-between group/opt",
                                    opt.id === myAnswerId && opt.isCorrect ? "border-success-500 bg-success-50 text-success-800 shadow-md" :
                                    opt.id === myAnswerId && !opt.isCorrect ? "border-red-500 bg-red-50 text-red-800 shadow-md" :
                                    opt.isCorrect ? "border-success-200 bg-success-50/20 text-success-700" :
                                    "border-slate-50 bg-slate-50 text-slate-400 opacity-60"
                                  )}
                                >
                                  <span className="flex-1 pr-4">{opt.text}</span>
                                  <div className="shrink-0 scale-110">
                                    {opt.id === myAnswerId ? (
                                      isCorrect ? <CheckCircle2 size={18} className="text-success-500" /> : <XCircle size={18} className="text-red-500" />
                                    ) : (
                                      opt.isCorrect && <CheckCircle2 size={18} className="text-success-500/40" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {q.explanation && (
                              <div className="bg-primary-50/50 rounded-2xl p-5 border border-primary-100 relative overflow-hidden group/expl">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover/expl:opacity-20 transition-opacity">
                                  <Star size={32} className="fill-primary-500" />
                                </div>
                                <div className="relative z-10">
                                  <div className="text-[10px] font-black uppercase text-primary-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                    <Sparkles size={12} className="fill-primary-500" /> Insight Pedagógico
                                  </div>
                                  <p className="text-sm text-primary-700 font-bold leading-relaxed">{q.explanation}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {idx < duelQuestions.length - 1 && <div className="h-px bg-slate-100 w-full mt-10" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}} />
    </div>
  );
};
