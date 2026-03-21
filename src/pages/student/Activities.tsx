import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import type { Activity } from '../../types/learning';
import {
  BookOpen, CheckCircle, Clock, PlayCircle, Star, Timer,
  Zap, ChevronRight, X
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { REWARDS, updateGamificationStats } from '../../lib/gamificationUtils';

export const Activities: React.FC = () => {



  const user = useAuthStore(state => state.user);

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<{ questionId: string; correct: boolean; selectedOptionId: string }[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [viewingResult, setViewingResult] = useState<{ activity: any; result: any } | null>(null);


  const [data, setData] = useState<any>({
    studentData: null,
    activities: [],
    activityResults: {},
    stats: null
  });

  const loadData = async () => {
    if (!user) return;
    try {
      const { data: studentData } = await supabase.from('users').select('*').eq('id', user.id).single();
      const classId = studentData?.classId;
      
      let classActivities: any[] = [];
      if (classId) {
        const { data: cAct } = await supabase.from('activities').select('*').eq('classId', classId);
        classActivities = cAct || [];
      } else {
        const { data: nullAct } = await supabase.from('activities').select('*').is('classId', null);
        classActivities = nullAct || [];
      }
      
      const parsedActivities = classActivities.map(ta => {
        if (ta.questions && ta.questions.length > 0 && (ta.questions[0] as any).text) {
          return {
            ...ta,
            type: 'mixed',
            questions: ta.questions.map((q: any, i: number) => ({
              id: q.id || String(i),
              questionText: q.text,
              type: q.type === 'objetiva' ? 'multiple_choice' : 'true_false',
              explanation: q.explanation || 'Muito bem!',
              options: q.type === 'objetiva' ? (q.options || []).map((opt: string, idx: number) => ({
                id: String(idx),
                text: opt,
                isCorrect: String(idx) === q.answer
              })) : [
                { id: 'true', text: 'Verdadeiro', isCorrect: q.answer === 'true' },
                { id: 'false', text: 'Falso', isCorrect: q.answer === 'false' }
              ]
            }))
          };
        }
        return ta;
      });

      const { data: resultsArr } = await supabase.from('student_activity_results').select('*').eq('studentId', user.id);
      const activityResults: Record<string, any> = {};
      (resultsArr || []).forEach((r: any) => { activityResults[r.activityId] = r; });

      const { data: stats } = await supabase.from('gamification_stats').select('*').eq('id', user.id).single();

      setData({ studentData, activities: parsedActivities, activityResults, stats });
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const ch = supabase.channel('activities_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_activity_results' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  
  const { activities, activityResults, stats } = data;
  
  // --- Timer Effect ---
  useEffect(() => {
    let timer: any;
    if (activeActivity && timeLeft !== null && !isFinished) {
      if (timeLeft > 0) {
        timer = setInterval(() => {
          setTimeLeft(prev => (prev !== null ? prev - 1 : null));
        }, 1000);
      } else {
        handleTimeout();
      }
    }
    return () => clearInterval(timer);
  }, [activeActivity, timeLeft, isFinished]);

  const handleTimeout = async () => {
    toast.error('O tempo acabou! A atividade foi encerrada.');
    handleGiveUp();
  };


  const handleStartActivity = (activity: Activity) => {
    setActiveActivity(activity);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setResults([]);
    setIsFinished(false);
    setStartedAt(Date.now());
    
    // Initialize timer
    if (activity.duration && activity.duration !== 'Sem limite') {
      const minutes = parseInt(activity.duration.replace(/\D/g, '')) || 0;
      if (minutes > 0) {
        setTimeLeft(minutes * 60);
      } else {
        setTimeLeft(null);
      }
    } else {
      setTimeLeft(null);
    }
  };

  const currentQuestion = activeActivity?.questions
    ? activeActivity.questions[currentQuestionIndex]
    : activeActivity;

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion || !user) return;
    
    const correct = currentQuestion.options?.find((o: any) => o.id === selectedAnswer)?.isCorrect;
    setAnswered(true);
    setResults((prev: any) => [...prev, { questionId: currentQuestion.id, correct: !!correct, selectedOptionId: selectedAnswer }]);

    if (correct) {
      toast.success('Resposta correta! Parabéns!');
    } else {
      toast.error('Não foi dessa vez. Continue aprendendo!');
    }
  };

  const handleNext = async () => {
    if (!activeActivity || !user) return;

    const totalQuestions = activeActivity.questions?.length || 1;
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev: number) => prev + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      // Finished activity
      setIsFinished(true);
      const correctCount = results.filter((r: any) => r.correct).length;
      
      let xpEarned = (correctCount * REWARDS.QUESTION_CORRECT_XP) + REWARDS.ACTIVITY_COMPLETE_XP;
      if (correctCount === totalQuestions && totalQuestions > 0) {
        xpEarned += REWARDS.ACTIVITY_PERFECT_BONUS;
      }
      
      const coinsEarned = (correctCount * REWARDS.QUESTION_CORRECT_COINS) + REWARDS.ACTIVITY_COMPLETE_COINS;

      const timeSpent = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

      const existingResult = activityResults[activeActivity.id];
      const result: any = {
        activityId: activeActivity.id,
        studentId: user.id,
        status: correctCount > 0 ? 'passed' : 'failed',
        score: correctCount,
        totalQuestions: totalQuestions,
        xpEarned,
        coinsEarned,
        completedAt: new Date().toISOString(),
        timeSpent,
        responses: results.map((r: any) => ({
          questionId: r.questionId,
          selectedOptionId: r.selectedOptionId,
          isCorrect: r.correct
        }))
      };

      if (existingResult?.id) {
        result.id = existingResult.id;
      }

      await supabase.from('student_activity_results').upsert(result);

      try {
        await updateGamificationStats(user.id, {
          xpToAdd: xpEarned,
          coinsToAdd: coinsEarned
        });
      } catch (error) {
        console.error('Error updating gamification stats:', error);
      }

      // Update Mission Progress
      await incrementMissionProgress(user.id, 'activity_completed', 1);
      if (correctCount > 0) {
        await incrementMissionProgress(user.id, 'question_correct', correctCount);
      }

      toast.success(`Atividade concluída! +${xpEarned} XP e +${coinsEarned} moedas!`);

    }
  };

  const handleGiveUp = async () => {
    if (!activeActivity || !user) return;

    const totalQuestions = activeActivity.questions?.length || 1;
    const correctCount = results.filter(r => r.correct).length;

    const timeSpent = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

    const existingResult = activityResults[activeActivity.id];
    const result: any = {
      activityId: activeActivity.id,
      studentId: user.id,
      status: 'given_up', // Will show as "Falhado"
      score: correctCount,
      totalQuestions: totalQuestions,
      xpEarned: 0,
      coinsEarned: 0,
      completedAt: new Date().toISOString(),
      timeSpent
    };

    if (existingResult?.id) {
      result.id = existingResult.id;
    }

    await supabase.from('student_activity_results').upsert(result);

    toast.error('Você desistiu da atividade. Ela foi marcada como falhada.');
    closeActivity();
  };


  const closeActivity = () => {
    setActiveActivity(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setResults([]);
    setIsFinished(false);
    setTimeLeft(null);
  };

  const handleViewResult = (activity: any) => {
    const result = activityResults[activity.id];
    if (result) {
      setViewingResult({ activity, result });
    }
  };


  const pending: any[] = activities.filter((a: any) => !activityResults[a.id]);
  const completed: any[] = activities.filter((a: any) => !!activityResults[a.id]);
  const shown: any[] = activeTab === 'pending' ? pending : completed;



  const subjectColors: Record<string, string> = {
    'Matemática': 'bg-primary-50 text-primary-700 border-primary-100',
    'Português': 'bg-success-50 text-success-700 border-success-100',
    'Ciências': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'História': 'bg-warning-50 text-warning-700 border-warning-100',
    'Geografia': 'bg-energy-50 text-energy-700 border-energy-100',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end gap-6 justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-500 mb-2">
            <BookOpen size={20} className="stroke-[3]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Aprendizado Ativo</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 leading-none">
            Minhas <span className="text-primary-600">Atividades</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2">
            {activities.length === 0
              ? 'Aguardando atividades do professor...'
              : `${pending.length} pendente${pending.length !== 1 ? 's' : ''} · ${completed.length} concluída${completed.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {stats && (
          <div className="flex items-center gap-3 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-primary-500" />
              <span className="font-black text-slate-800">{stats.xp} XP</span>
            </div>
            <div className="w-px h-6 bg-slate-100" />
            <div className="flex items-center gap-2">
              <span className="text-lg">🪙</span>
              <span className="font-black text-slate-800">{stats.coins}</span>
            </div>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem] w-fit">
        {[
          { id: 'pending', label: `Pendentes (${pending.length})`, icon: Clock },
          { id: 'completed', label: `Concluídas (${completed.length})`, icon: CheckCircle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-sm font-black transition-all',
              activeTab === tab.id ? 'bg-white text-primary-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {activities.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-black text-slate-600 mb-2">Nenhuma atividade disponível</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Assim que o professor adicionar atividades para sua turma, elas aparecerão aqui.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">{activeTab === 'pending' ? '🎉' : '📋'}</div>
          <h3 className="text-lg font-black text-slate-600">
            {activeTab === 'pending' ? 'Todas as atividades concluídas!' : 'Nenhuma atividade concluída ainda'}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map(activity => {
            const result = activityResults[activity.id];
            const isDone = !!result;
            const subColor = subjectColors[activity.subject] || 'bg-slate-50 text-slate-700 border-slate-100';

            return (
              <Card
                key={activity.id}
                onClick={() => isDone && handleViewResult(activity)}
                className={cn(
                  'p-6 flex flex-col group transition-all duration-300',
                  isDone ? 'bg-success-50/50 border-success-100 opacity-80 cursor-pointer hover:bg-success-50 hover:shadow-md' : 'hover:-translate-y-1 hover:shadow-floating hover:border-primary-100'
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={cn('border rounded-xl px-3 py-1 text-xs font-black uppercase tracking-wide', subColor)}>
                    {activity.subject}
                  </span>
                  {isDone ? (
                    <div className={cn(
                      "flex items-center gap-1 font-black text-xs border px-2 py-1 rounded-lg",
                      result.status === 'passed' 
                        ? "text-success-600 bg-success-50 border-success-100" 
                        : "text-red-600 bg-red-50 border-red-100"
                    )}>
                      {result.status === 'passed' ? <CheckCircle size={12} /> : <X size={12} />}
                      {result.status === 'passed' ? 'Sucesso' : 'Falhado'}
                    </div>
                  ) : (

                    <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                      {activity.type === 'multiple_choice' ? 'Múltipla Escolha' : activity.type === 'true_false' ? 'V ou F' : 'Relacionar'}
                    </span>
                  )}
                </div>

                <h3 className={cn('font-black text-lg text-slate-800 mb-2 flex-1 group-hover:text-primary-600 transition-colors', isDone && 'line-through text-slate-500')}>
                  {activity.title}
                </h3>
                <div className="flex items-center gap-4 mb-4 text-slate-400 text-xs font-bold">
                  <div className="flex items-center gap-1">
                    <BookOpen size={14} />
                    {activity.questions?.length || 1} questões
                  </div>
                  <div className="flex items-center gap-1">
                    <Star size={14} fill="currentColor" className="text-warning-500" />
                    +{((activity.questions?.length || 1) * REWARDS.QUESTION_CORRECT_XP) + REWARDS.ACTIVITY_COMPLETE_XP} XP
                  </div>
                  {activity.duration && (
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      {activity.duration}
                    </div>
                  )}
                </div>

                  {!isDone && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="rounded-xl gap-1 font-black"
                      onClick={() => handleStartActivity(activity)}
                    >
                      <PlayCircle size={16} /> Começar
                    </Button>
                  )}
              </Card>
            );
          })}
        </div>

      )}

      {/* Activity Modal */}
      {activeActivity && currentQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl animate-in zoom-in-95 duration-300 overflow-hidden">
            
            {!isFinished ? (
              <>
                {/* Header with Progress Bar */}
                <div className="bg-primary-600 p-8 text-white relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 h-1.5 bg-white/20 w-full">
                    <div 
                      className="h-full bg-warning-400 transition-all duration-500" 
                      style={{ width: `${((currentQuestionIndex + 1) / (activeActivity.questions?.length || 1)) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                        Questão {currentQuestionIndex + 1} de {activeActivity.questions?.length || 1}
                      </span>
                      {timeLeft !== null && (
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1",
                          timeLeft < 60 ? "bg-red-500 text-white animate-pulse" : "bg-white/20 text-white"
                        )}>
                          <Clock size={12} />
                          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                      {activeActivity.subject}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black leading-tight relative z-10">{activeActivity.title}</h2>
                </div>

                <div className="p-8 space-y-6">
                  <p className="text-slate-700 font-bold text-lg leading-relaxed">{currentQuestion.questionText}</p>


                  <div className="space-y-3">
                    {currentQuestion.options?.map((opt: any) => (
                      <button
                        key={opt.id}
                        disabled={answered}
                        onClick={() => setSelectedAnswer(opt.id)}
                        className={cn(
                          'w-full text-left p-4 rounded-2xl border-2 font-bold transition-all',
                          answered
                            ? opt.isCorrect
                              ? 'bg-success-50 border-success-400 text-success-700'
                              : selectedAnswer === opt.id
                                ? 'bg-red-50 border-red-400 text-red-700'
                                : 'bg-slate-50 border-slate-100 text-slate-400'
                            : selectedAnswer === opt.id
                              ? 'bg-primary-50 border-primary-500 text-primary-700'
                              : 'bg-white border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 text-slate-700'
                        )}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>

                  {answered && (
                    <div className={cn(
                      'p-4 rounded-2xl border text-sm font-medium animate-in slide-in-from-top-2',
                      currentQuestion.options?.find((o: any) => o.id === selectedAnswer)?.isCorrect
                        ? 'bg-success-50 border-success-100 text-success-700'
                        : 'bg-red-50 border-red-100 text-red-700'
                    )}>
                      💡 {currentQuestion.options?.find((o: any) => o.id === selectedAnswer)?.isCorrect 
                          ? currentQuestion.explanation 
                          : 'Não foi dessa vez!'}
                    </div>
                  )}


                  <div className="flex gap-3 pt-2">
                    <Button variant="secondary" className="flex-1 rounded-2xl" onClick={handleGiveUp}>
                      Desistir
                    </Button>

                    {!answered ? (
                      <Button
                        variant="primary"
                        className="flex-[2] rounded-2xl gap-2 h-14"
                        disabled={!selectedAnswer}
                        onClick={handleSubmitAnswer}
                      >
                        Confirmar Resposta
                      </Button>
                    ) : (
                      <Button
                        variant="ai"
                        className="flex-[2] rounded-2xl gap-2 h-14 font-black"
                        onClick={handleNext}
                      >
                        {currentQuestionIndex < (activeActivity.questions?.length || 1) - 1 ? 'Próxima Questão' : 'Ver Resultado'}
                        <ChevronRight size={18} />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Results Summary */
              <div className="p-10 text-center space-y-8 animate-in zoom-in-95">
                <div className="relative inline-block">
                  <div className="w-24 h-24 bg-success-100 rounded-full flex items-center justify-center text-5xl mb-2 mx-auto ring-8 ring-success-50">
                    🏆
                  </div>
                </div>
                
                <div>
                  <h2 className="text-3xl font-black text-slate-800">Mandou bem!</h2>
                  <p className="text-slate-500 font-bold mt-1">Você completou a atividade "{activeActivity.title}"</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Acertos</div>
                    <div className="text-2xl font-black text-slate-800">
                      {results.filter(r => r.correct).length} / {activeActivity.questions?.length || 1}
                    </div>
                  </div>
                  <div className="bg-primary-50 p-4 rounded-3xl border border-primary-100 text-primary-700">
                    <div className="text-primary-400 text-[10px] font-black uppercase tracking-widest mb-1">XP Ganho</div>
                    <div className="text-2xl font-black">
                      +{ (results.filter(r => r.correct).length * REWARDS.QUESTION_CORRECT_XP) + REWARDS.ACTIVITY_COMPLETE_XP + (results.filter(r => r.correct).length === (activeActivity.questions?.length || 0) ? REWARDS.ACTIVITY_PERFECT_BONUS : 0) }
                    </div>
                  </div>
                </div>

                <Button variant="primary" size="lg" className="w-full rounded-[2rem] h-14 text-lg font-black shadow-lg shadow-primary-200" onClick={closeActivity}>
                  Continuar Jornada
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Review Modal */}
      {viewingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-900 p-8 text-white flex justify-between items-start shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
              
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border border-white/20",
                    subjectColors[viewingResult.activity.subject] ? "bg-white/10 text-white" : "bg-primary-500/20 text-primary-400"
                  )}>
                    {viewingResult.activity.subject}
                  </span>
                  <div className="flex items-center gap-1.5 text-white/40 text-[10px] font-black uppercase tracking-widest">
                    <CheckCircle size={14} className="text-primary-400" />
                    Revisão de Atividade
                  </div>
                </div>
                
                <h2 className="text-3xl font-black leading-tight">{viewingResult.activity.title}</h2>
                
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                    <BookOpen size={14} className="text-primary-400" />
                    <span className="text-xs font-bold text-white/70">{viewingResult.activity.questions?.length || 0} Questões</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                    <Timer size={14} className="text-orange-400" />
                    <span className="text-xs font-bold text-white/70">Limite: {viewingResult.activity.duration || 'Sem limite'}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                    <Clock size={14} className="text-success-400" />
                    <span className="text-xs font-bold text-white/70">
                      Tempo: {Math.floor((viewingResult.result.timeSpent || 0) / 60)}:{(viewingResult.result.timeSpent % 60 || 0).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setViewingResult(null)}
                className="relative z-10 p-2 hover:bg-white/10 rounded-xl transition-colors"
                title="Fechar"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-8 overflow-y-auto space-y-8">
              {/* Score Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                  <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Desempenho</div>
                  <div className="text-3xl font-black text-slate-800">
                    {viewingResult.result.score} / {viewingResult.result.totalQuestions}
                  </div>
                  <div className={cn(
                    "inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    viewingResult.result.status === 'passed' ? "bg-success-100 text-success-700" : "bg-red-100 text-red-700"
                  )}>
                    {viewingResult.result.status === 'passed' ? 'Aprovado' : 'Não Aprovado'}
                  </div>
                </div>
                <div className="bg-primary-50 p-6 rounded-3xl border border-primary-100 text-center text-primary-700">
                  <div className="text-primary-400 text-[10px] font-black uppercase tracking-widest mb-1">Recompensa</div>
                  <div className="text-3xl font-black">+{viewingResult.result.xpEarned} XP</div>
                  <div className="text-[10px] font-black uppercase tracking-widest mt-2">🪙 {viewingResult.result.coinsEarned} moedas</div>
                </div>
              </div>

              {/* Questions Review */}
              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Star size={20} className="text-warning-500 fill-warning-500" /> Detalhes das Questões
                </h3>
                
                {viewingResult.activity.questions?.map((q: any, idx: number) => {
                  const studentResponse = viewingResult.result.responses?.find((r: any) => r.questionId === q.id);
                  const isCorrect = studentResponse?.isCorrect;
                  
                  return (
                    <div key={q.id} className="bg-white border-2 border-slate-50 rounded-2xl p-6 space-y-4 shadow-sm">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex gap-3">
                          <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-500 text-sm">
                            {idx + 1}
                          </span>
                          <p className="font-bold text-slate-700 leading-relaxed">{q.questionText}</p>
                        </div>
                        {isCorrect ? (
                          <div className="shrink-0 text-success-500 bg-success-50 p-2 rounded-xl">
                            <CheckCircle size={20} />
                          </div>
                        ) : (
                          <div className="shrink-0 text-red-500 bg-red-50 p-2 rounded-xl">
                            <X size={20} />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 ml-11">
                        {q.options?.map((opt: any) => {
                          const isStudentChoice = studentResponse?.selectedOptionId === opt.id;
                          const isCorrectOption = opt.isCorrect;
                          
                          return (
                            <div 
                              key={opt.id}
                              className={cn(
                                "p-3 rounded-xl border-2 text-sm font-medium flex items-center justify-between",
                                isCorrectOption 
                                  ? "bg-success-50 border-success-200 text-success-700" 
                                  : isStudentChoice && !isCorrectOption
                                    ? "bg-red-50 border-red-200 text-red-700"
                                    : "bg-slate-50 border-slate-50 text-slate-500"
                              )}
                            >
                              <span>{opt.text}</span>
                              {isStudentChoice && (
                                <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full bg-white/50">
                                  Sua Escolha
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      <div className="ml-11 bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                        <p className="text-xs text-indigo-700 leading-relaxed italic">
                          <span className="font-black not-italic uppercase mr-1">💡 Dica do Professor:</span>
                          {isCorrect ? (
                            q.explanation || "Muito bem! Continue assim."
                          ) : (
                            <>
                              <span className="font-bold text-indigo-800">Não desanime!</span> Errar faz parte do aprendizado. Vamos revisar este ponto para brilhar na próxima! 🚀
                              {q.explanation && !q.explanation.toLowerCase().includes('muito bem') && (
                                <span className="block mt-2 opacity-80">— {q.explanation}</span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-slate-100 shrink-0">
              <Button 
                className="w-full rounded-2xl h-14 font-black" 
                variant="primary"
                onClick={() => setViewingResult(null)}
              >
                Entendi, voltar às atividades
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
