import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { Sword, CheckCircle2, XCircle, Timer, Flame, Zap, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DuelService } from '../../services/duel.service';
import type { Duel, DuelQuestion } from '../../types/duel';
import { toast } from 'sonner';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// DuelGame — fully redesigned with:
//   • Randomized option order (correct answer not always first)
//   • 30s per question countdown with visual pressure
//   • Opponent name & avatar displayed
//   • Auto-advance on timeout (marks as incorrect)
//   • Exciting, emotional UI
// ============================================================

const LETTERS = ['A', 'B', 'C', 'D'];
const TIME_PER_QUESTION = 30;

/** Shuffle an array using Fisher-Yates */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DuelGame: React.FC = () => {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [results, setResults] = useState<{ questionId: string; selectedOptionId: string }[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);

  const [duel, setDuel] = useState<Duel | null>(null);
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [shuffledOptionsMap, setShuffledOptionsMap] = useState<Record<string, any[]>>({});
  const [opponent, setOpponent] = useState<any>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>('/avatars/default-impacto.png');
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string>('/avatars/default-impacto.png');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineKey  = `duel_deadline_${duelId}_q${currentQuestionIndex}`;
  const answeredKey  = `duel_answered_${duelId}_q${currentQuestionIndex}`;
  const resultsKey   = `duel_results_${duelId}`;

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const saveDeadline = (deadline: number) =>
    localStorage.setItem(deadlineKey, String(deadline));

  const clearDeadline = () =>
    localStorage.removeItem(deadlineKey);

  const getSecondsFromDeadline = (key: string): number | null => {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return Math.max(0, Math.ceil((Number(stored) - Date.now()) / 1000));
  };

  /** Persist that this question was timed-out so we can restore it on re-mount */
  const saveAnsweredState = (qId: string, optionId: string) => {
    localStorage.setItem(answeredKey, JSON.stringify({ questionId: qId, selectedOptionId: optionId }));
  };

  /** Persist full results array so it survives navigation */
  const saveResults = (r: { questionId: string; selectedOptionId: string }[]) => {
    localStorage.setItem(resultsKey, JSON.stringify(r));
  };

  /** Load persisted results from localStorage */
  const loadResults = (): { questionId: string; selectedOptionId: string }[] => {
    try { return JSON.parse(localStorage.getItem(resultsKey) || '[]'); } catch { return []; }
  };

  const fetchData = async () => {
    if (!duelId || !user) return;
    try {
      const { data: d } = await supabase.from('duels').select('*').eq('id', duelId).single();
      setDuel(d);
      if (d) {
        const { data: q } = await supabase.from('duel_questions').select('*').eq('duelId', duelId);
        const qs = q || [];
        setQuestions(qs);

        // Pre-shuffle options for every question so they don't change on re-render
        const map: Record<string, any[]> = {};
        qs.forEach((question: DuelQuestion) => {
          map[question.id] = shuffle(question.options);
        });
        setShuffledOptionsMap(map);

        const opponentId = d.challengerId === user.id ? d.challengedId : d.challengerId;
        const { data: opp } = await supabase.from('users').select('*').eq('id', opponentId).single();
        setOpponent(opp);

        // Use avatar directly from the user profile (stored in users.avatar)
        if (user.avatar) setMyAvatarUrl(user.avatar);
        if (opp?.avatar) setOpponentAvatarUrl(opp.avatar);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel(`duel_game_${duelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `id=eq.${duelId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [duelId, user?.id]);

  useEffect(() => {
    if (duel && questions && questions.length > 0) {
      const alreadyPlayed = (duel.challengerId === user?.id && duel.challengerTurnCompleted) ||
                            (duel.challengedId === user?.id && duel.challengedTurnCompleted);
      if (alreadyPlayed) setIsFinished(true);
      setIsLoading(false);
    }
  }, [duel, questions, user?.id]);

  // Auto-submit on timeout
  const handleTimeout = useCallback(() => {
    if (answered) return;
    clearTimer();
    clearDeadline();
    const currentQuestion = questions[currentQuestionIndex];
    const entry = { questionId: currentQuestion.id, selectedOptionId: 'timeout_skip' };
    // Persist so re-mount restores this post-timeout state
    saveAnsweredState(currentQuestion.id, 'timeout_skip');
    const newResults = [...results, entry];
    saveResults(newResults);
    setResults(newResults);
    setTimedOut(true);
    setAnswered(true);
    toast.error('⏱️ Tempo esgotado! Questão marcada como incorreta.');
  }, [answered, questions, currentQuestionIndex, results]);

  // ─── Deadline-based persistent countdown ───
  useEffect(() => {
    if (isLoading || isFinished) return;

    // 1. Restore persisted results on first mount
    const persisted = loadResults();
    if (persisted.length > 0 && results.length === 0) {
      setResults(persisted);
    }

    // 2. Check if this question was already answered (e.g. timed out while away)
    const savedAnswer = localStorage.getItem(answeredKey);
    if (savedAnswer) {
      // Question already done — restore UI without starting a timer
      setAnswered(true);
      setTimedOut(true);
      setTimeLeft(0);
      clearTimer();
      return;
    }

    if (answered) return;

    const existingSeconds = getSecondsFromDeadline(deadlineKey);

    if (existingSeconds === null) {
      // No deadline stored yet — this is a new question, create one
      const deadline = Date.now() + TIME_PER_QUESTION * 1000;
      saveDeadline(deadline);
      setTimeLeft(TIME_PER_QUESTION);
    } else if (existingSeconds === 0) {
      // Deadline already passed while we were away — timeout immediately
      setTimeLeft(0);
      handleTimeout();
      return;
    } else {
      // Restore remaining time
      setTimeLeft(existingSeconds);
    }

    clearTimer();
    timerRef.current = setInterval(() => {
      const secs = getSecondsFromDeadline(deadlineKey);
      if (secs === null || secs <= 0) {
        clearTimer();
        setTimeLeft(0);
        handleTimeout();
      } else {
        setTimeLeft(secs);
      }
    }, 500); // 500ms polling is more accurate than 1000ms

    // Also sync on tab-visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const secs = getSecondsFromDeadline(deadlineKey);
        if (secs === null) return;
        if (secs <= 0) {
          clearTimer();
          setTimeLeft(0);
          handleTimeout();
        } else {
          setTimeLeft(secs);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentQuestionIndex, isLoading, isFinished, answered]);

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !questions[currentQuestionIndex]) return;
    clearTimer();
    clearDeadline();
    setAnswered(true);
    const currentQuestion = questions[currentQuestionIndex];
    const entry = { questionId: currentQuestion.id, selectedOptionId: selectedAnswer };
    const newResults = [...results, entry];
    saveResults(newResults);
    setResults(newResults);
    const isCorrect = currentQuestion.options.find(o => o.id === selectedAnswer)?.isCorrect;
    if (isCorrect) {
      toast.success('✅ Correto! +25 XP');
    } else {
      toast.error('❌ Errou! Estude mais este tema.');
    }
  };

  /** Clear ALL deadline + answered keys for this duel */
  const clearAllDuelDeadlines = () => {
    for (let i = 0; i < Math.max(questions.length, 10); i++) {
      localStorage.removeItem(`duel_deadline_${duelId}_q${i}`);
      localStorage.removeItem(`duel_answered_${duelId}_q${i}`);
    }
    localStorage.removeItem(`duel_results_${duelId}`);
  };

  const handleNext = async () => {
    // Clean up the current question's answered state so new question starts fresh
    localStorage.removeItem(answeredKey);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setAnswered(false);
      setTimedOut(false);
    } else {
      if (!user || !duelId) return;
      clearAllDuelDeadlines();
      try {
        await DuelService.submitTurn(duelId, user.id, results);
        setIsFinished(true);
        await incrementMissionProgress(user.id, 'duel_completed');
        toast.success('🏆 Turno enviado! Aguarde o oponente.');
      } catch (error) {
        toast.error('Erro ao salvar resultado.');
      }
    }
  };

  const handleForfeit = async () => {
    if (!user || !duelId) return;
    setIsForfeiting(true);
    clearAllDuelDeadlines();
    try {
      await DuelService.forfeit(duelId, user.id);
      toast.error('🏳️ Você desistiu do duelo. Derrota registrada.');
      setIsFinished(true);
      setShowForfeitModal(false);
    } catch (e) {
      toast.error('Erro ao registrar desistência.');
    } finally {
      setIsForfeiting(false);
    }
  };

  if (isLoading || !duel || !questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-special-100 border-t-special-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Carregando duelo...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const shuffledOptions = shuffledOptionsMap[currentQuestion?.id] || currentQuestion?.options || [];
  const totalQuestions = questions.length;
  const timerPercent = (timeLeft / TIME_PER_QUESTION) * 100;
  const timerColor = timeLeft > 15 ? 'bg-success-500' : timeLeft > 7 ? 'bg-warning-500' : 'bg-red-500';
  const timerTextColor = timeLeft > 15 ? 'text-success-600' : timeLeft > 7 ? 'text-warning-600' : 'text-red-600';

  // ─── Derived: viewer's perspective ───────────────────────────
  const isAmChallenger = duel.challengerId === user?.id;
  const myScore  = isAmChallenger ? duel.challengerScore : duel.challengedScore;
  const oppScore = isAmChallenger ? duel.challengedScore : duel.challengerScore;

  // correctCount: from in-session results (just played now)
  const correctCount = results.filter((r, i) =>
    questions?.[i]?.options?.find(o => o.id === r.selectedOptionId)?.isCorrect
  ).length;

  // displayScore: use DB value when revisiting a completed turn (results[] empty),
  // use in-session correctCount immediately after playing
  const displayScore = results.length > 0 ? correctCount : myScore;

  // Pending? show waiting screen if this user is challenged and hasn't accepted
  const isDuelWon  = duel.status === 'completed' && duel.winnerId === user?.id;
  const isDuelDraw = duel.status === 'completed' && (duel.winnerId === 'draw' || duel.challengerScore === duel.challengedScore);

  return (
    <div className="max-w-2xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!isFinished ? (
        <div className="space-y-5">

          {/* ─── Forfeit Confirmation Modal ─── */}
          {showForfeitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full mx-4 shadow-2xl text-center"
              >
                <div className="text-6xl mb-4">🏳️</div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">Desistir do Duelo?</h3>
                <p className="text-slate-500 font-bold mb-2">Isso conta como <span className="text-red-600 font-black">derrota</span> para você.</p>
                <p className="text-sm text-slate-400 mb-6">
                  Você receberá apenas <span className="font-black text-warning-600">metade</span> da XP e moedas.
                  O adversário leva a vitória automaticamente.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowForfeitModal(false)}
                    className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-all"
                  >
                    Continuar
                  </button>
                  <button
                    onClick={handleForfeit}
                    disabled={isForfeiting}
                    className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 disabled:opacity-50 transition-all"
                  >
                    {isForfeiting ? 'Saindo...' : 'Desistir 🏳️'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* ─── Arena Header ─── */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2.5rem] p-6 shadow-2xl"
          >
            {/* Players Row */}
            <div className="flex items-center justify-between mb-5">
              {/* ME */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl overflow-hidden shadow-lg shadow-primary-500/30 ring-2 ring-primary-300/30">
                  <img src={myAvatarUrl} alt={user?.name || 'Você'} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default-impacto.png'; }} />
                </div>
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Você</span>
                <span className="text-xs font-black text-white truncate max-w-[80px] text-center">{user?.name?.split(' ')[0]}</span>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 bg-red-500/20 border-2 border-red-400/40 rounded-2xl flex items-center justify-center">
                  <Sword size={22} className="text-red-400" />
                </div>
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">VS</span>
              </div>

              {/* OPPONENT */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-gradient-to-br from-special-400 to-special-600 rounded-2xl overflow-hidden shadow-lg shadow-special-500/30 ring-2 ring-special-300/30">
                  <img src={opponentAvatarUrl} alt={opponent?.name || 'Rival'} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default-impacto.png'; }} />
                </div>
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Rival</span>
                <span className="text-xs font-black text-white truncate max-w-[80px] text-center">{opponent?.name?.split(' ')[0] || '...'}</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-warning-400" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{duel.theme}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-special-400" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{duel.difficulty}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-yellow-400" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Q {currentQuestionIndex + 1}/{totalQuestions}</span>
              </div>
              <button
                onClick={() => setShowForfeitModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20 transition-all"
              >
                <span className="text-[9px] font-black uppercase tracking-widest">🏳️ Desistir</span>
              </button>
            </div>
          </motion.div>

          {/* ─── Progress Bar ─── */}
          <div className="bg-slate-100 h-2 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-special-500 to-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentQuestionIndex) / totalQuestions) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* ─── Question Card ─── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden"
            >
              {/* Timer Bar */}
              <div className="px-8 pt-7 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Timer size={14} className={timerTextColor} />
                    <span className={cn("text-sm font-black tabular-nums", timerTextColor)}>
                      {String(timeLeft).padStart(2, '0')}s
                    </span>
                    {timeLeft <= 7 && !answered && (
                      <motion.span
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ repeat: Infinity, duration: 0.6 }}
                        className="text-[10px] font-black text-red-500 uppercase tracking-widest"
                      >
                        🚨 Corra!
                      </motion.span>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    ⚔️ {duel.theme}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full transition-colors duration-500", timerColor)}
                    animate={{ width: `${timerPercent}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                  />
                </div>
              </div>

              {/* Question Text */}
              <div className="px-8 py-6">
                <div className="flex items-start gap-3 mb-6">
                  <span className="shrink-0 w-8 h-8 rounded-xl bg-special-50 border border-special-100 text-special-600 text-xs font-black flex items-center justify-center">
                    {currentQuestionIndex + 1}
                  </span>
                  <p className="text-xl font-black text-slate-800 leading-snug">{currentQuestion.questionText}</p>
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 gap-3">
                  {shuffledOptions.map((opt, idx) => {
                    const isSelected = selectedAnswer === opt.id;
                    const isCorrectOpt = opt.isCorrect;
                    const showResult = answered;

                    let style = 'bg-white border-slate-100 hover:border-special-200 hover:bg-special-50/30 text-slate-700 hover:shadow-md';
                    if (showResult) {
                      if (isCorrectOpt)
                        style = 'bg-success-50 border-success-400 text-success-800 shadow-md shadow-success-100';
                      else if (isSelected && !isCorrectOpt)
                        style = 'bg-red-50 border-red-400 text-red-700';
                      else
                        style = 'bg-slate-50 border-slate-100 text-slate-400 opacity-60';
                    } else if (isSelected) {
                      style = 'bg-special-50 border-special-500 text-special-800 shadow-md shadow-special-100 ring-2 ring-special-200/50';
                    }

                    return (
                      <motion.button
                        key={opt.id}
                        disabled={answered}
                        onClick={() => setSelectedAnswer(opt.id)}
                        whileTap={{ scale: 0.98 }}
                        whileHover={!answered ? { scale: 1.01 } : {}}
                        className={cn(
                          'w-full text-left px-5 py-4 rounded-2xl border-2 font-bold transition-all duration-200 flex items-center gap-4',
                          style
                        )}
                      >
                        <span className={cn(
                          "shrink-0 w-9 h-9 rounded-xl text-sm font-black flex items-center justify-center transition-colors",
                          showResult
                            ? isCorrectOpt ? "bg-success-100 text-success-700" : isSelected ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400"
                            : isSelected ? "bg-special-500 text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          {LETTERS[idx]}
                        </span>
                        <span className="flex-1 text-base">{opt.text}</span>
                        {showResult && isCorrectOpt && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                            <CheckCircle2 size={22} className="text-success-500 shrink-0" />
                          </motion.div>
                        )}
                        {showResult && isSelected && !isCorrectOpt && (
                          <XCircle size={22} className="text-red-500 shrink-0" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Timed out feedback */}
                {timedOut && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-center"
                  >
                    <p className="font-black text-red-600">⏱️ Tempo esgotado! Questão marcada como incorreta.</p>
                  </motion.div>
                )}

                {/* Explanation after answering */}
                {answered && currentQuestion.explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl"
                  >
                    <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">💡 Explicação</p>
                    <p className="text-sm font-semibold text-blue-800">{currentQuestion.explanation}</p>
                  </motion.div>
                )}
              </div>

              {/* Action Button */}
              <div className="px-8 pb-8">
                {!answered ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={!selectedAnswer}
                    onClick={handleSubmitAnswer}
                    className={cn(
                      "w-full h-16 rounded-[1.5rem] font-black text-lg transition-all shadow-xl",
                      selectedAnswer
                        ? "bg-gradient-to-r from-special-600 to-indigo-600 text-white shadow-special-500/30 hover:shadow-special-500/50"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                    )}
                  >
                    ✅ Confirmar Resposta
                  </motion.button>
                ) : (
                  <motion.button
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleNext}
                    className="w-full h-16 rounded-[1.5rem] font-black text-lg bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-xl hover:shadow-2xl transition-all"
                  >
                    {currentQuestionIndex < totalQuestions - 1 ? '⚡ Próxima Questão' : '🏁 Ver Resultado'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        /* ─── Result Screen ─── */
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-6"
        >
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2.5rem] p-10 text-center shadow-2xl">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="text-8xl mb-6"
            >
              {displayScore >= totalQuestions * 0.8 ? '🏆' : displayScore >= totalQuestions * 0.5 ? '⚔️' : '😤'}
            </motion.div>
            <h2 className="text-4xl font-black text-white mb-2">Turno Concluído!</h2>
            <p className="text-white/50 font-bold">Você respondeu {totalQuestions} questões de {duel.theme}</p>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="text-3xl font-black text-white mb-1">{displayScore}<span className="text-white/30">/{totalQuestions}</span></div>
                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">✅ Acertos</div>
              </div>
              <div className="bg-special-500/10 border border-special-500/20 rounded-2xl p-5">
                <div className="text-3xl font-black text-special-400 mb-1">+{displayScore * 25}</div>
                <div className="text-[10px] font-black text-special-500/60 uppercase tracking-widest">⚡ XP Ganho</div>
              </div>
            </div>

            {duel.status === 'completed' ? (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 p-6 bg-white/5 rounded-2xl border border-white/10"
              >
                <div className="text-xs font-black text-white/40 uppercase tracking-widest mb-3">RESULTADO FINAL ⚔️</div>
                <div className="text-5xl font-black text-white mb-2">
                  {myScore} <span className="text-white/30">×</span> {oppScore}
                </div>
                <p className="text-xl font-black">
                  {isDuelWon ? '🎉 VITÓRIA!' : isDuelDraw ? '🤝 Empate!' : '😔 Não foi dessa vez!'}
                </p>
              </motion.div>
            ) : (
              <div className="mt-6 p-5 bg-primary-500/10 border border-primary-500/20 rounded-2xl">
                <p className="font-bold text-primary-300 text-sm flex items-center justify-center gap-2">
                  ⏳ Aguardando o turno de <strong>{opponent?.name?.split(' ')[0] || 'seu rival'}</strong>...
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/student/duels')}
            className="w-full h-14 rounded-2xl font-black text-slate-400 hover:text-slate-600 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all text-sm uppercase tracking-widest"
          >
            ⚔️ Voltar para Duelos
          </button>
        </motion.div>
      )}
    </div>
  );
};
