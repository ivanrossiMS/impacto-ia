import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth.store';
import type { LearningPath, StudentProgress } from '../../types/learning';
import { ArrowLeft, CheckCircle2, Bot, ChevronRight, Lock, BookOpen, Trophy, PlayCircle, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import { updateGamificationStats } from '../../lib/gamificationUtils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StepQuestion {
  id: string;
  text: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation: string;
}

interface EnrichedStep {
  id: string;
  title: string;
  type: string;
  content?: string;      // brief intro summary
  theory?: string;       // rich Markdown content for Tutor IA panel
  questions?: StepQuestion[]; // AI-generated quiz questions
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase icon helper
const STEP_EMOJIS: Record<string, string> = {
  intro: '🌟', theory: '🧠', practice: '💪', quiz: '🎯', boss: '🔥'
};

// ─── Step Quiz ────────────────────────────────────────────────────────────────
const StepQuiz: React.FC<{
  questions: StepQuestion[];
  onAllCorrect: () => void;
}> = ({ questions, onAllCorrect }) => {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const q = questions[current];
  const shuffledOpts = React.useMemo(() =>
    [...q.options].sort(() => Math.random() - 0.5), [q.id]);

  const handleSelect = (optId: string) => {
    if (answered) return;
    setSelected(optId);
    setAnswered(true);
    const isRight = q.options.find(o => o.id === optId)?.isCorrect;
    if (isRight) setCorrectCount(c => c + 1);
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      const lastIsCorrect = q.options.find(o => o.id === selected)?.isCorrect;
      const totalCorrect = correctCount + (lastIsCorrect ? 1 : 0);
      const needed = Math.ceil(questions.length * 0.67);
      if (totalCorrect >= needed) {
        onAllCorrect();
      } else {
        toast.error(`Precisas acertar pelo menos ${needed} / ${questions.length} questões. Tente de novo!`);
        setCurrent(0); setSelected(null); setAnswered(false); setCorrectCount(0);
      }
      return;
    }
    setCurrent(c => c + 1);
    setSelected(null);
    setAnswered(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-400">
        <span>Questão {current + 1} / {questions.length}</span>
        <span className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full transition-all", i < current ? "bg-primary-500" : i === current ? "bg-primary-400 animate-pulse" : "bg-slate-200")} />
          ))}
        </span>
      </div>

      <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
        <p className="text-slate-900 font-bold text-lg leading-relaxed">{q.text}</p>
      </div>

      <div className="space-y-3">
        {shuffledOpts.map((opt, idx) => {
          const isSelected = selected === opt.id;
          const isCorrect = opt.isCorrect;
          const letter = String.fromCharCode(65 + idx); // A, B, C, D
          let cls = "border-2 border-slate-100 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50";
          if (answered && isSelected && isCorrect)  cls = "border-2 border-emerald-400 bg-emerald-50 text-emerald-800";
          if (answered && isSelected && !isCorrect) cls = "border-2 border-red-400 bg-red-50 text-red-800";
          if (answered && !isSelected && isCorrect) cls = "border-2 border-emerald-300 bg-emerald-50/50 text-emerald-700";

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={cn("w-full text-left px-5 py-4 rounded-2xl font-semibold transition-all flex items-center gap-3", cls, answered ? "cursor-default" : "cursor-pointer")}
            >
              <span className={cn("w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-black flex-shrink-0 uppercase",
                answered && isSelected && isCorrect ? "bg-emerald-500 text-white border-emerald-500" :
                answered && isSelected && !isCorrect ? "bg-red-500 text-white border-red-500" :
                answered && !isSelected && isCorrect ? "bg-emerald-400 text-white border-emerald-400" :
                "border-current text-slate-500"
              )}>
                {letter}
              </span>
              {opt.text}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={cn("rounded-3xl p-5 animate-in slide-in-from-bottom-3 duration-300", q.options.find(o=>o.id===selected)?.isCorrect ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100")}>
          <div className="flex items-start gap-3">
            <Bot size={20} className={q.options.find(o=>o.id===selected)?.isCorrect ? "text-emerald-600 mt-0.5" : "text-red-600 mt-0.5"} />
            <div>
              <p className={cn("font-black text-sm mb-1", q.options.find(o=>o.id===selected)?.isCorrect ? "text-emerald-800" : "text-red-800")}>
                {q.options.find(o=>o.id===selected)?.isCorrect ? "Correto! 🎉" : "Não foi desta vez..."}
              </p>
              <p className="text-slate-600 text-sm leading-relaxed">{q.explanation}</p>
            </div>
          </div>
          <button onClick={handleNext} className="mt-4 w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all flex items-center justify-center gap-2">
            {current + 1 >= questions.length ? "Verificar Resultado" : "Próxima Questão"} <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const LearningPathViewer: React.FC = () => {
  const { pathId } = useParams<{ pathId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);

  const [path, setPath] = useState<LearningPath | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReplay, setIsReplay] = useState(false);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionState, setSessionState] = useState<'intro' | 'theory' | 'quiz' | 'completed'>('intro');

  useEffect(() => { loadData(); }, [pathId, user]);

  const loadData = async () => {
    if (!pathId || !user) return;
    try {
      setLoading(true);

      // 1. Load the trail data
      const { data: pathData, error: pathErr } = await supabase
        .from('learning_paths').select('*').eq('id', pathId).single();
      if (pathErr) throw pathErr;
      if (pathData) setPath(pathData as LearningPath);

      // Helper: fetch progress robustly (handles multiple rows by taking first)
      const fetchProgress = async () => {
        const { data } = await supabase
          .from('student_progress')
          .select('*')
          .eq('pathId', pathId)
          .eq('studentId', user.id)
          .limit(1);
        return data && data.length > 0 ? data[0] : null;
      };

      let progressData = await fetchProgress();

      if (!progressData) {
        // No progress yet — upsert with ignoreDuplicates (safe against race conditions)
        await supabase.from('student_progress').upsert({
          studentId: user.id,
          pathId,
          completedStepIds: [],
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        });
        // Whether insert succeeded or hit a duplicate, fetch the current row
        progressData = await fetchProgress();
      }

      if (progressData) {
        setProgress(progressData as unknown as StudentProgress);
        const alreadyCompleted = progressData.status === 'completed';
        if (alreadyCompleted) {
          setIsReplay(true);
          setCurrentStepIndex(0);
        } else {
          const cids = (progressData.completedStepIds || []) as string[];
          const steps = (pathData?.steps || []) as any[];
          const firstUncompleted = steps.findIndex((s, i) => {
            const stepKey = s.id || String(i + 1);
            return !cids.includes(stepKey);
          });
          setCurrentStepIndex(firstUncompleted >= 0 ? firstUncompleted : 0);
        }
      }
    } catch (err) {
      console.error('[LearningPathViewer] Load error:', err);
      toast.error('Erro ao carregar a trilha.');
    } finally {
      setLoading(false);
    }
  };



  const currentStep = path?.steps?.[currentStepIndex] as EnrichedStep | undefined;
  const tutorContent = currentStep?.theory || currentStep?.content || '';
  const hasContent = !!tutorContent;
  const hasQuestions = (currentStep?.questions?.length ?? 0) > 0;

  const completeStep = async () => {
    if (!currentStep || !path) return;

    // In replay mode: just advance locally without saving or rewarding
    if (isReplay) {
      const isLast = currentStepIndex + 1 >= path.steps.length;
      if (isLast) {
        setSessionState('completed');
      } else {
        setCurrentStepIndex(prev => prev + 1);
        setSessionState('intro');
      }
      return;
    }

    if (!progress) return;

    // Use step.id if available, else fallback to index-based key
    const stepKey = currentStep.id || String(currentStepIndex + 1);
    const newCompletedIds = [...new Set([...(progress.completedStepIds || []), stepKey])];
    const isPathFinished = newCompletedIds.length >= path.steps.length;

    const newProg = {
      ...progress,
      completedStepIds: newCompletedIds,
      status: isPathFinished ? 'completed' : 'in_progress',
      completedAt: isPathFinished ? new Date().toISOString() : undefined,
    };
    setProgress(newProg as any);

    try {
      const { error: updateErr } = await supabase
        .from('student_progress')
        .update({
          completedStepIds: newProg.completedStepIds,
          status: newProg.status,
          completedAt: newProg.completedAt ?? null,
        })
        .eq('pathId', pathId)
        .eq('studentId', user!.id);

      if (updateErr) {
        console.error('[LearningPathViewer] Progress update failed:', updateErr);
      } else {
        console.log(`[LearningPathViewer] Step "${stepKey}" saved. Completed: ${newCompletedIds.length}/${path.steps.length}. Status: ${newProg.status}`);
      }

      if (isPathFinished && progress.status !== 'completed' && user) {
        const xp = path.rewardXp || 0;
        const coins = path.rewardCoins || 0;
        await updateGamificationStats(user.id, { xpToAdd: xp, coinsToAdd: coins });
        toast.success(`Trilha concluída! +${xp} XP e +${coins} moedas creditados! 🎉`, { duration: 5000 });
      }
    } catch (err) {
      console.error('[LearningPathViewer] completeStep error:', err);
    }

    if (isPathFinished) {
      setSessionState('completed');
    } else {
      setCurrentStepIndex(prev => prev + 1);
      setSessionState('intro');
    }
  };

  const stepsCount = path?.steps?.length || 1;
  const compCount = progress?.completedStepIds?.length || 0;
  const completionPercent = Math.min(100, Math.round((compCount / stepsCount) * 100));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin"></div>
        <p className="font-black text-slate-400 animate-pulse">Iniciando ambiente de aprendizagem...</p>
      </div>
    </div>
  );

  if (!path) return (
    <div className="text-center py-20">
      <h1 className="text-3xl font-black text-slate-700">Trilha não encontrada</h1>
      <button onClick={() => navigate('/student/paths')} className="mt-4 text-primary-500 font-bold hover:underline">Voltar às trilhas</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-32 animate-in fade-in duration-500">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/student/paths')} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 leading-tight">{path.title}</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{path.subject} • {path.grade}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progresso</span>
            <span className="text-sm font-black text-primary-600">{completionPercent}%</span>
          </div>
          <div className="w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-1000" style={{ width: `${completionPercent}%` }}></div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 mt-8 flex flex-col lg:flex-row gap-8">
        {/* Left: Step Sidebar */}
        <aside className="lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary-400 to-special-400"></div>
            <h3 className="font-black text-slate-800 text-base mb-5 flex items-center gap-2">
              <BookOpen size={18} className="text-primary-500" /> Mapa da Trilha
            </h3>
            <div className="relative border-l-2 border-slate-100 ml-4 space-y-6 pb-4">
              {(path.steps as EnrichedStep[]).map((step, idx) => {
                const isPast = progress?.completedStepIds?.includes(step.id);
                const isCurrent = idx === currentStepIndex;
                const isLocked = !isPast && !isCurrent;
                return (
                  <div key={step.id} className={cn("relative pl-8 transition-all", isCurrent ? "scale-105" : "")}>
                    <div className={cn("absolute -left-[11px] top-0.5 w-5 h-5 rounded-full border-4 outline outline-2 outline-white flex items-center justify-center transition-all text-xs",
                      isPast ? "bg-primary-500 border-primary-500" : isCurrent ? "bg-white border-primary-500" : "bg-slate-100 border-slate-200")}>
                      {isPast ? <CheckCircle2 size={10} strokeWidth={4} className="text-white" /> :
                        isLocked ? <Lock size={8} strokeWidth={3} className="text-slate-400" /> :
                          <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-ping"></div>}
                    </div>
                    <div>
                      <div className={cn("text-[9px] font-black uppercase tracking-widest", isPast ? "text-primary-600" : isLocked ? "text-slate-300" : "text-primary-500")}>
                        {STEP_EMOJIS[step.type]} Fase {idx + 1}
                      </div>
                      <h4 className={cn("font-bold text-xs leading-tight mt-0.5", isPast ? "text-slate-700" : isLocked ? "text-slate-400" : "text-slate-900")}>
                        {step.title}
                      </h4>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right: Content */}
        <main className="flex-1">
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl p-8 min-h-[550px] flex flex-col">

            {/* INTRO STATE — Show step card before starting */}
            {sessionState === 'intro' && currentStep && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto animate-in zoom-in-95 duration-500">
                {isReplay && (
                  <div className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-700 text-xs font-bold">
                    <span>🔄</span>
                    <span>Modo Revisão — sem XP ou moedas nesta sessão</span>
                  </div>
                )}
                <div className="text-6xl">{STEP_EMOJIS[currentStep.type]}</div>
                <div>
                  <div className="text-primary-600 font-black tracking-widest uppercase text-xs mb-2">Fase {currentStepIndex + 1} de {stepsCount}</div>
                  <h2 className="text-3xl font-black text-slate-800">{currentStep.title}</h2>
                  {hasContent && (
                    <p className="text-slate-500 mt-3 text-sm leading-relaxed">{currentStep.content}</p>
                  )}
                </div>
                <button onClick={() => setSessionState('theory')} className="mt-6 bg-primary-600 hover:bg-primary-700 text-white text-base font-black px-10 py-5 rounded-[2rem] shadow-lg hover:-translate-y-1 transition-all flex items-center gap-3 w-full justify-center">
                  <PlayCircle size={22} /> {isReplay ? 'Revisar esta fase' : 'Começar esta fase'}
                </button>
              </div>
            )}

            {/* THEORY STATE — Show the AI-generated content */}
            {sessionState === 'theory' && currentStep && (
              <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-right-4 duration-500">
                {/* Step Header */}
                <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 shadow-sm border border-primary-200 text-xl">
                    {STEP_EMOJIS[currentStep.type]}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fase {currentStepIndex + 1}</div>
                    <h3 className="text-xl font-black text-slate-800">{currentStep.title}</h3>
                  </div>
                </div>

                {/* Theory Content */}
                {hasContent ? (
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex-1 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-primary-700 font-black text-sm uppercase tracking-widest">
                      <Bot size={16} /> Explicação do Tutor IA
                    </div>
                    <div className="prose prose-slate prose-p:leading-relaxed prose-headings:font-black prose-li:my-0.5 prose-strong:text-slate-800 max-w-none text-slate-700">
                      <ReactMarkdown>{tutorContent}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400">
                    <p>Conteúdo desta etapa não disponível.</p>
                  </div>
                )}

                {/* Proceed to Quiz */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  {hasQuestions ? (
                    <button onClick={() => setSessionState('quiz')} className="bg-primary-600 hover:bg-primary-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg transition-all flex items-center gap-2">
                      Ir para as Questões <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button onClick={completeStep} className="bg-primary-600 hover:bg-primary-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg transition-all flex items-center gap-2">
                      Concluir Fase <ChevronRight size={18} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* QUIZ STATE — Interactive questions */}
            {sessionState === 'quiz' && currentStep?.questions && (
              <div className="flex-1 flex flex-col space-y-5 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <button onClick={() => setSessionState('theory')} className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-all">
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Questões</div>
                    <h3 className="text-base font-black text-slate-800">{currentStep.title}</h3>
                  </div>
                </div>
                <div className="flex-1">
                  <StepQuiz
                    questions={currentStep.questions}
                    onAllCorrect={() => {
                      toast.success('Excelente! Fase concluída! 🎉');
                      completeStep();
                    }}
                  />
                </div>
              </div>
            )}

            {/* COMPLETED STATE */}
            {sessionState === 'completed' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto animate-in zoom-in duration-700">
                <div className="relative">
                  <div className="absolute inset-0 bg-warning-400 blur-3xl opacity-30 rounded-full"></div>
                  <div className={cn(
                    "w-32 h-32 rounded-full border-8 border-white shadow-2xl flex items-center justify-center text-white relative z-10",
                    isReplay ? "bg-gradient-to-br from-slate-400 to-slate-600" : "bg-gradient-to-br from-warning-300 to-warning-500"
                  )}>
                    <Trophy size={64} fill="currentColor" />
                  </div>
                </div>
                <div>
                  <h2 className="text-4xl font-black text-slate-800">
                    {isReplay ? 'Revisão Completa!' : 'Trilha Concluída!'}
                  </h2>
                  <p className="text-slate-500 mt-3 font-medium text-lg">
                    {isReplay ? 'Revisão finalizada. XP e moedas não são concedidos novamente.' : 'Você dominou este assunto de forma espetacular!'}
                  </p>
                </div>
                <div className="flex gap-4 items-center justify-center bg-slate-50 border border-slate-100 rounded-3xl p-4 w-full mt-4">
                  <div className="flex items-center gap-2 font-black text-xl text-warning-600"><span>🪙</span> +{isReplay ? 0 : path.rewardCoins}</div>
                  <div className="w-1 h-8 bg-slate-200 rounded-full"></div>
                  <div className="flex items-center gap-2 font-black text-xl text-primary-600"><span>⚡</span> +{isReplay ? 0 : path.rewardXp} XP</div>
                </div>
                <button onClick={() => navigate('/student/paths')} className="mt-8 bg-slate-900 hover:bg-black text-white text-lg font-black px-10 py-5 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all w-full">
                  Voltar ao Mapa
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
