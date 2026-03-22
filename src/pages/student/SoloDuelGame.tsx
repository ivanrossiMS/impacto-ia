import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Timer, CheckCircle2, XCircle, ArrowLeft, Star, BrainCircuit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DuelService } from '../../services/duel.service';
import type { DuelTheme, DuelDifficulty, DuelQuestion } from '../../types/duel';
import { calcDuelRewards } from '../../lib/duelRewards';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { incrementMissionProgress } from '../../lib/missionUtils';

type Phase = 'setup' | 'loading' | 'game' | 'result';

const THEMES: { id: DuelTheme; label: string; emoji: string }[] = [
  { id: 'aleatorio',      label: 'Aleatório',   emoji: '🎲' },
  { id: 'historia',       label: 'História',    emoji: '📜' },
  { id: 'geografia',      label: 'Geografia',   emoji: '🌍' },
  { id: 'ciencias',       label: 'Ciências',    emoji: '🧪' },
  { id: 'arte',           label: 'Arte',        emoji: '🎨' },
  { id: 'esportes',       label: 'Esportes',    emoji: '⚽' },
  { id: 'entretenimento', label: 'Cultura Pop', emoji: '🍿' },
  { id: 'quem_sou_eu',    label: 'Quem Sou Eu?',emoji: '🎭' },
  { id: 'logica',         label: 'Lógica',      emoji: '🧩' },
];

const DIFFS: { id: DuelDifficulty; label: string; emoji: string; style: string }[] = [
  { id: 'easy',   label: 'Fácil',   emoji: '😊', style: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { id: 'medium', label: 'Médio',   emoji: '😤', style: 'border-amber-400  bg-amber-50  text-amber-700'   },
  { id: 'hard',   label: 'Difícil', emoji: '🔥', style: 'border-red-400    bg-red-50    text-red-700'     },
];

const LETTERS = ['A', 'B', 'C', 'D'];
const TIME_PER_Q = 30;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stars(accuracy: number) {
  if (accuracy >= 1)    return 5;
  if (accuracy >= 0.8)  return 4;
  if (accuracy >= 0.6)  return 3;
  if (accuracy >= 0.4)  return 2;
  return 1;
}

export const SoloDuelGame: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup
  const [theme, setTheme] = useState<DuelTheme>('aleatorio');
  const [diff, setDiff]   = useState<DuelDifficulty>('medium');
  const [count, setCount] = useState<5 | 8 | 10>(5);
  const [userGrade, setUserGrade] = useState('');

  // Game
  const [duelId, setDuelId]       = useState('');
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [optMap, setOptMap]       = useState<Record<string, any[]>>({});
  const [qIdx, setQIdx]           = useState(0);
  const [chosen, setChosen]       = useState<string | null>(null);
  const [answered, setAnswered]   = useState(false);
  const [timedOut, setTimedOut]   = useState(false);
  const [timeLeft, setTimeLeft]   = useState(TIME_PER_Q);
  const [results, setResults]     = useState<{ questionId: string; selectedOptionId: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Result
  const [xpEarned, setXp]     = useState(0);
  const [coins, setCoins]     = useState(0);
  const [finalScore, setFScore] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearT = () => { if (timerRef.current) clearInterval(timerRef.current); };

  useEffect(() => {
    if (!user) return;
    const classId = (user as any).classId;
    if (classId) {
      supabase.from('classes').select('grade').eq('id', classId).maybeSingle()
        .then(({ data }) => { if (data?.grade) setUserGrade(data.grade); });
    }
  }, [user?.id]);

  // Timer
  useEffect(() => {
    if (phase !== 'game' || answered) { clearT(); return; }
    setTimeLeft(TIME_PER_Q);
    clearT();
    timerRef.current = setInterval(() => setTimeLeft(p => p > 1 ? p - 1 : 0), 1000);
    return clearT;
  }, [qIdx, phase, answered]);

  // Timeout trigger
  useEffect(() => {
    if (phase === 'game' && timeLeft === 0 && !answered) {
      const q = questions[qIdx];
      if (!q) return;
      setResults(p => [...p, { questionId: q.id, selectedOptionId: 'timeout_skip' }]);
      setTimedOut(true);
      setAnswered(true);
      toast.error('⏱️ Tempo esgotado!');
    }
  }, [timeLeft, phase, answered, questions, qIdx]);

  const handleStart = async () => {
    if (!user) return;
    setPhase('loading');
    try {
      const duel = await DuelService.createSoloDuel(user.id, theme, diff, count, userGrade);
      const { data } = await supabase.from('duel_questions').select('*').eq('duelId', duel.id);
      const qs: DuelQuestion[] = data || [];
      const map: Record<string, any[]> = {};
      qs.forEach(q => { map[q.id] = shuffle(q.options); });
      setDuelId(duel.id); setQuestions(qs); setOptMap(map);
      setQIdx(0); setResults([]); setChosen(null); setAnswered(false); setTimedOut(false);
      setPhase('game');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar questões. Tente novamente.');
      setPhase('setup');
    }
  };

  const handleConfirm = () => {
    if (!chosen || !questions[qIdx]) return;
    clearT();
    const q = questions[qIdx];
    setResults(p => [...p, { questionId: q.id, selectedOptionId: chosen }]);
    setAnswered(true);
    const ok = q.options.find(o => o.id === chosen)?.isCorrect;
    toast[ok ? 'success' : 'error'](ok ? '✅ Correto!' : '❌ Errado!');
  };

  const handleNext = async () => {
    if (qIdx < questions.length - 1) {
      setQIdx(p => p + 1);
      setChosen(null); setAnswered(false); setTimedOut(false);
    } else {
      if (!user || submitting) return;
      setSubmitting(true);
      try {
        const { xpEarned: xp, coinsEarned: c, score: s } = await DuelService.submitSoloTurn(duelId, user.id, results);
        setXp(xp); setCoins(c); setFScore(s);
        await incrementMissionProgress(user.id, 'duel_completed');
        setPhase('result');
      } catch { toast.error('Erro ao salvar resultado.'); }
      finally { setSubmitting(false); }
    }
  };

  const resetToSetup = () => {
    setPhase('setup'); setResults([]); setQIdx(0); setChosen(null);
    setAnswered(false); setTimedOut(false); setXp(0); setCoins(0); setFScore(0);
  };

  const rewards  = calcDuelRewards(diff, count);
  const cq       = questions[qIdx];
  const opts     = cq ? (optMap[cq.id] || cq.options) : [];
  const timerPct = (timeLeft / TIME_PER_Q) * 100;
  const tColor   = timeLeft > 15 ? 'bg-emerald-500' : timeLeft > 7 ? 'bg-amber-500' : 'bg-red-500';
  const tText    = timeLeft > 15 ? 'text-emerald-600' : timeLeft > 7 ? 'text-amber-600' : 'text-red-600';
  const starCount = stars(questions.length > 0 ? finalScore / questions.length : 0);

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <AnimatePresence mode="wait">

        {/* ─── SETUP ─── */}
        {phase === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <button onClick={() => navigate('/student/duels')} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 font-black text-sm transition-colors">
              <ArrowLeft size={16} /> Voltar para Duelos
            </button>

            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 30% 50%, #6366f1 0%, transparent 60%)' }} />
              <div className="relative">
                <div className="text-6xl mb-4">🎮</div>
                <h1 className="text-3xl font-black text-white mb-2">Treino Solo</h1>
                <p className="text-white/40 font-bold text-sm">Pratique, aprenda e ganhe XP!</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Escolha o Tema</p>
              <div className="grid grid-cols-3 gap-2.5">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setTheme(t.id)} className={cn(
                    'flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 font-black text-[11px] transition-all',
                    theme === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                  )}>
                    <span className="text-2xl">{t.emoji}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Dificuldade</p>
              <div className="grid grid-cols-3 gap-3">
                {DIFFS.map(d => (
                  <button key={d.id} onClick={() => setDiff(d.id)} className={cn(
                    'p-4 rounded-2xl border-2 font-black text-center transition-all',
                    diff === d.id ? d.style + ' shadow-md' : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                  )}>
                    <div className="text-2xl mb-1">{d.emoji}</div>
                    <div className="text-sm">{d.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Número de Questões</p>
              <div className="flex gap-3">
                {([5, 8, 10] as const).map(n => (
                  <button key={n} onClick={() => setCount(n)} className={cn(
                    'flex-1 h-14 rounded-2xl border-2 font-black text-xl transition-all',
                    count === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-100 bg-white text-slate-600'
                  )}>{n}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <span className="text-sm font-black text-slate-600">Recompensa máxima</span>
              <div className="flex items-center gap-4 font-black">
                <span className="text-amber-600 flex items-center gap-1"><Zap size={15} className="text-amber-500" />+{rewards.maxXP} XP</span>
                <span className="text-yellow-600">🪙 +{rewards.maxCoins}</span>
              </div>
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={handleStart}
              className="w-full h-16 rounded-[1.5rem] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xl shadow-xl shadow-indigo-500/30 hover:-translate-y-0.5 transition-all">
              ▶ Jogar Solo
            </motion.button>
          </motion.div>
        )}

        {/* ─── LOADING ─── */}
        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-32 gap-8">
            <div className="w-24 h-24 relative">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 border-r-purple-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-3xl">🧠</div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-slate-800 mb-2">Gerando questões com IA</h2>
              <p className="text-slate-400 font-bold text-sm animate-pulse">Preparando seu desafio...</p>
            </div>
          </motion.div>
        )}

        {/* ─── GAME ─── */}
        {phase === 'game' && cq && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2rem] p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><BrainCircuit size={16} className="text-indigo-400" />
                  <span className="text-[11px] font-black text-white/50 uppercase tracking-widest">
                    Solo · {THEMES.find(t => t.id === theme)?.emoji} {THEMES.find(t => t.id === theme)?.label}
                  </span>
                </div>
                <span className="text-[11px] font-black text-white/50 bg-white/5 px-3 py-1 rounded-xl">Q{qIdx + 1}/{questions.length}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-indigo-400 to-purple-400"
                  animate={{ width: `${(qIdx / questions.length) * 100}%` }} transition={{ duration: 0.4 }} />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={qIdx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22 }}
                className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">

                <div className="px-7 pt-6 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Timer size={14} className={tText} />
                      <span className={cn('text-sm font-black tabular-nums', tText)}>{String(timeLeft).padStart(2, '0')}s</span>
                      {timeLeft <= 7 && !answered && (
                        <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}
                          className="text-[10px] font-black text-red-500">🚨 Corra!</motion.span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className={cn('h-full rounded-full', tColor)}
                      animate={{ width: `${timerPct}%` }} transition={{ duration: 1, ease: 'linear' }} />
                  </div>
                </div>

                <div className="px-7 py-5">
                  <div className="flex items-start gap-3 mb-6">
                    <span className="shrink-0 w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-black flex items-center justify-center">{qIdx + 1}</span>
                    <p className="text-xl font-black text-slate-800 leading-snug">{cq.questionText}</p>
                  </div>

                  <div className="grid gap-3">
                    {opts.map((opt, idx) => {
                      const sel = chosen === opt.id;
                      const show = answered;
                      let s = 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 text-slate-700';
                      if (show) {
                        if (opt.isCorrect) s = 'bg-emerald-50 border-emerald-400 text-emerald-800';
                        else if (sel)       s = 'bg-red-50 border-red-400 text-red-700';
                        else               s = 'bg-slate-50 border-slate-100 text-slate-400 opacity-60';
                      } else if (sel) s = 'bg-indigo-50 border-indigo-500 text-indigo-800 shadow-md ring-2 ring-indigo-200/50';
                      return (
                        <motion.button key={opt.id} disabled={answered} onClick={() => setChosen(opt.id)}
                          whileTap={{ scale: 0.98 }} className={cn('w-full text-left px-5 py-4 rounded-2xl border-2 font-bold transition-all flex items-center gap-4', s)}>
                          <span className={cn('shrink-0 w-9 h-9 rounded-xl text-sm font-black flex items-center justify-center',
                            show ? opt.isCorrect ? 'bg-emerald-100 text-emerald-700' : sel ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'
                                 : sel ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500')}>{LETTERS[idx]}</span>
                          <span className="flex-1">{opt.text}</span>
                          {show && opt.isCorrect && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle2 size={20} className="text-emerald-500" /></motion.div>}
                          {show && sel && !opt.isCorrect && <XCircle size={20} className="text-red-500" />}
                        </motion.button>
                      );
                    })}
                  </div>

                  {timedOut && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-center">
                      <p className="font-black text-red-600 text-sm">⏱️ Tempo esgotado!</p>
                    </motion.div>
                  )}
                  {answered && cq.explanation && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                      <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">💡 Explicação</p>
                      <p className="text-sm font-semibold text-blue-800">{cq.explanation}</p>
                    </motion.div>
                  )}
                </div>

                <div className="px-7 pb-7">
                  {!answered ? (
                    <motion.button whileTap={{ scale: 0.97 }} disabled={!chosen} onClick={handleConfirm}
                      className={cn('w-full h-14 rounded-2xl font-black text-lg transition-all shadow-lg',
                        chosen ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-500/30' : 'bg-slate-100 text-slate-300 cursor-not-allowed')}>
                      ✅ Confirmar Resposta
                    </motion.button>
                  ) : (
                    <motion.button initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      whileTap={{ scale: 0.97 }} onClick={handleNext} disabled={submitting}
                      className="w-full h-14 rounded-2xl font-black text-lg bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-xl transition-all disabled:opacity-50">
                      {submitting ? '⏳ Salvando...' : qIdx < questions.length - 1 ? '⚡ Próxima Questão' : '🏁 Ver Resultado'}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── RESULT ─── */}
        {phase === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2.5rem] p-10 text-center shadow-2xl">
              <div className="flex items-center justify-center gap-1 mb-6">
                {[1, 2, 3, 4, 5].map(s => (
                  <motion.div key={s} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: s * 0.08, type: 'spring' }}>
                    <Star size={32} className={s <= starCount ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'} />
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.3 }} className="text-7xl mb-4">
                {starCount >= 4 ? '🏆' : starCount >= 3 ? '⚔️' : '💪'}
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-1">
                {starCount >= 4 ? 'Excelente!' : starCount >= 3 ? 'Muito bom!' : 'Continue praticando!'}
              </h2>
              <p className="text-white/40 font-bold mb-8">{finalScore}/{questions.length} acertos</p>

              <div className="grid grid-cols-2 gap-4">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                  className="bg-amber-400/10 border border-amber-400/20 rounded-2xl p-5">
                  <div className="text-3xl font-black text-amber-400 mb-1">+{xpEarned}</div>
                  <div className="text-[10px] font-black text-amber-400/60 uppercase tracking-widest">⚡ XP Ganho</div>
                </motion.div>
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                  className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-5">
                  <div className="text-3xl font-black text-yellow-400 mb-1">+{coins}</div>
                  <div className="text-[10px] font-black text-yellow-400/60 uppercase tracking-widest">🪙 Moedas</div>
                </motion.div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={resetToSetup}
                className="h-14 rounded-2xl font-black text-slate-600 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2">
                🔄 Jogar Novamente
              </button>
              <button onClick={() => navigate('/student/duels')}
                className="h-14 rounded-2xl font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all">
                ⚔️ Arena de Duelos
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
