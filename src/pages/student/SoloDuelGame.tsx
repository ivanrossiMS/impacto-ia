import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Timer, CheckCircle2, XCircle, ArrowLeft, Star,
  BrainCircuit, Shuffle, BookMarked, Globe, Atom, Palette,
  Dumbbell, User, Brain, Shield, Swords, Gamepad2, Tv,
  Trophy, Target,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DuelService } from '../../services/duel.service';
import type { DuelTheme, DuelDifficulty, DuelQuestion } from '../../types/duel';
import { calcDuelRewards } from '../../lib/duelRewards';
import { toast } from 'sonner';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { AnswerFeedbackOverlay, type FeedbackType } from '../../components/ui/AnswerFeedbackOverlay';

type Phase = 'setup' | 'loading' | 'game' | 'result';

const THEMES: { id: DuelTheme; label: string; Icon: any; color: string; bg: string }[] = [
  { id: 'aleatorio',      label: 'Aleatório',   Icon: Shuffle,    color: '#fbbf24', bg: 'rgba(251,191,36,0.14)'  },
  { id: 'historia',       label: 'História',    Icon: BookMarked, color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  { id: 'geografia',      label: 'Geografia',   Icon: Globe,      color: '#38bdf8', bg: 'rgba(56,189,248,0.14)'  },
  { id: 'ciencias',       label: 'Ciências',    Icon: Atom,       color: '#4ade80', bg: 'rgba(74,222,128,0.14)'  },
  { id: 'arte',           label: 'Arte',        Icon: Palette,    color: '#f472b6', bg: 'rgba(244,114,182,0.14)' },
  { id: 'esportes',       label: 'Esportes',    Icon: Dumbbell,   color: '#fb923c', bg: 'rgba(251,146,60,0.14)'  },
  { id: 'entretenimento', label: 'TV/Séries',   Icon: Tv,         color: '#c084fc', bg: 'rgba(192,132,252,0.14)' },
  { id: 'quem_sou_eu',    label: 'Quem Sou Eu?',Icon: User,       color: '#f9a8d4', bg: 'rgba(249,168,212,0.14)' },
  { id: 'logica',         label: 'Lógica',      Icon: Brain,      color: '#60a5fa', bg: 'rgba(96,165,250,0.14)'  },
];

const DIFFS: { id: DuelDifficulty; label: string; Icon: any; desc: string; xp: string; color: string; bg: string; border: string; glow: string }[] = [
  { id: 'easy',   label: 'Iniciante', Icon: Shield, desc: 'Questões adaptadas ao nível básico.',        xp: '+60 XP',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.35)',  glow: 'rgba(74,222,128,0.25)'  },
  { id: 'medium', label: 'Médio',     Icon: Zap,    desc: 'Balanço entre desafio e aprendizado.',       xp: '+75 XP',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.35)',  glow: 'rgba(251,191,36,0.25)'  },
  { id: 'hard',   label: 'Mestre',    Icon: Swords, desc: 'Para os mais corajosos. Alto desafio.',      xp: '+100 XP', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.35)', glow: 'rgba(248,113,113,0.25)' },
];

const LETTERS = ['A', 'B', 'C', 'D'];
const TIME_PER_Q = 30;
const CARD = { background: 'linear-gradient(160deg,#080e24 0%,#0b1230 100%)', border: '1px solid rgba(255,255,255,0.07)' };
const LABEL = { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 900 as const, letterSpacing: '0.18em', textTransform: 'uppercase' as const };

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stars(accuracy: number) {
  if (accuracy >= 1)   return 5;
  if (accuracy >= 0.8) return 4;
  if (accuracy >= 0.6) return 3;
  if (accuracy >= 0.4) return 2;
  return 1;
}

export const SoloDuelGame: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [phase, setPhase] = useState<Phase>('setup');

  const [theme, setTheme] = useState<DuelTheme>('aleatorio');
  const [diff, setDiff]   = useState<DuelDifficulty>('medium');
  const count = 10;
  const [userGrade, setUserGrade] = useState('');

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

  const [soloFeedback, setSoloFeedback] = useState<{ type: FeedbackType; correctText?: string; explanation?: string } | null>(null);
  const pendingSoloNext = useRef<(() => void) | null>(null);

  const [xpEarned, setXp]       = useState(0);
  const [coins, setCoins]       = useState(0);
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

  useEffect(() => {
    if (phase !== 'game' || answered) { clearT(); return; }
    setTimeLeft(TIME_PER_Q);
    clearT();
    timerRef.current = setInterval(() => setTimeLeft(p => p > 1 ? p - 1 : 0), 1000);
    return clearT;
  }, [qIdx, phase, answered]);

  useEffect(() => {
    if (phase === 'game' && timeLeft === 0 && !answered) {
      const q = questions[qIdx];
      if (!q) return;
      setResults(p => [...p, { questionId: q.id, selectedOptionId: 'timeout_skip' }]);
      setTimedOut(true);
      setAnswered(true);
      setSoloFeedback({ type: 'timeout' });
      pendingSoloNext.current = () => handleNext();
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
      qs.forEach(q => { map[q.id] = shuffleArr(q.options); });
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
    const correctOpt = q.options.find((o: any) => o.isCorrect);
    setSoloFeedback({
      type: ok ? 'correct' : 'wrong',
      correctText: !ok ? correctOpt?.text : undefined,
      explanation: (q as any).explanation ?? undefined,
    });
    pendingSoloNext.current = () => handleNext();
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

  const rewards    = calcDuelRewards(diff, count);
  const cq         = questions[qIdx];
  const opts       = cq ? (optMap[cq.id] || cq.options) : [];
  const timerPct   = (timeLeft / TIME_PER_Q) * 100;
  const starCount  = stars(questions.length > 0 ? finalScore / questions.length : 0);
  const activeTheme = THEMES.find(t => t.id === theme)!;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 96px' }}>
      <AnimatePresence mode="wait">

        {/* ─── SETUP ─── */}
        {phase === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Back */}
            <button onClick={() => navigate('/student/duels')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={13} /> Voltar para Duelos
            </button>

            {/* Hero card */}
            <div style={{ ...CARD, borderRadius: 28, overflow: 'hidden', position: 'relative', padding: '28px 28px 24px' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#020617 0%,#0f0a2e 50%,#1a0533 100%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: -50, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,#6366f1,transparent)', filter: 'blur(60px)', opacity: 0.25, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,#a855f7,transparent)', filter: 'blur(50px)', opacity: 0.2, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,1) 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 20 }}>
                <motion.div animate={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 2 }}
                  style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(99,102,241,0.2)', border: '1.5px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Gamepad2 size={30} style={{ color: '#818cf8' }} />
                </motion.div>
                <div>
                  <p style={{ ...LABEL, marginBottom: 4 }}>Modo Treinamento</p>
                  <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 30, color: '#fff', lineHeight: 1, marginBottom: 6 }}>
                    Treino <span style={{ background: 'linear-gradient(90deg,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Solo</span>
                  </h1>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 600 }}>Pratique, aprenda e ganhe XP sem adversário!</p>
                </div>
              </div>
            </div>

            {/* Theme selector */}
            <div style={{ ...CARD, borderRadius: 24, padding: 16 }}>
              <p style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Star size={11} style={{ color: '#fbbf24' }} /> Tema do Treino
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {THEMES.map(t => {
                  const active = theme === t.id;
                  return (
                    <motion.button key={t.id} whileTap={{ scale: 0.94 }} onClick={() => setTheme(t.id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', borderRadius: 16, cursor: 'pointer', border: `1.5px solid ${active ? t.color : 'rgba(255,255,255,0.07)'}`, background: active ? t.bg : 'rgba(255,255,255,0.03)', boxShadow: active ? `0 0 14px ${t.bg}` : 'none', transition: 'all 0.15s' }}>
                      <t.Icon size={22} style={{ color: t.color, opacity: active ? 1 : 0.55, filter: active ? `drop-shadow(0 0 6px ${t.color})` : 'none' }} />
                      <span style={{ fontSize: 10, fontWeight: 900, color: active ? t.color : 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty */}
            <div style={{ ...CARD, borderRadius: 24, padding: 16 }}>
              <p style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Target size={11} style={{ color: '#f87171' }} /> Dificuldade
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DIFFS.map(d => {
                  const active = diff === d.id;
                  return (
                    <motion.button key={d.id} whileTap={{ scale: 0.97 }} onClick={() => setDiff(d.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, cursor: 'pointer', border: `1.5px solid ${active ? d.border : 'rgba(255,255,255,0.07)'}`, background: active ? d.bg : 'rgba(255,255,255,0.03)', boxShadow: active ? `0 0 16px ${d.glow}` : 'none', transition: 'all 0.15s', textAlign: 'left' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: active ? d.bg : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? d.border : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <d.Icon size={18} style={{ color: d.color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 900, fontSize: 14, color: active ? d.color : '#fff', marginBottom: 2, fontFamily: "'Rajdhani',sans-serif" }}>{d.label}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{d.desc}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 900, color: d.color }}>{d.xp}</span>
                      {active && <CheckCircle2 size={16} style={{ color: d.color, flexShrink: 0 }} />}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Rewards bar */}
            <div style={{ ...CARD, borderRadius: 20, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Recompensa máxima</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 900, fontSize: 13, color: '#fbbf24' }}>
                  <Zap size={13} style={{ color: '#fbbf24' }} /> +{rewards.maxXP} XP
                </span>
                <span style={{ fontWeight: 900, fontSize: 13, color: '#f59e0b' }}>🪙 +{rewards.maxCoins}</span>
              </div>
            </div>

            {/* Start button */}
            <motion.button whileHover={{ scale: 1.02, boxShadow: '0 0 36px rgba(99,102,241,0.55)' }} whileTap={{ scale: 0.97 }} onClick={handleStart}
              style={{ width: '100%', height: 56, borderRadius: 20, background: 'linear-gradient(135deg,#6366f1 0%,#7c3aed 50%,#a855f7 100%)', color: '#fff', fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: '0.08em', border: 'none', cursor: 'pointer', boxShadow: '0 0 24px rgba(99,102,241,0.45), 0 8px 24px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Gamepad2 size={20} /> JOGAR SOLO
            </motion.button>
          </motion.div>
        )}

        {/* ─── LOADING ─── */}
        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 32 }}>
            <div style={{ position: 'relative', width: 112, height: 112 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.15)' }} />
              <div className="animate-spin" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#818cf8', borderRightColor: '#a855f7' }} />
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BrainCircuit size={40} style={{ color: '#818cf8' }} />
              </motion.div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 22, color: '#fff', marginBottom: 8 }}>Gerando questões com IA</h2>
              <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }}
                style={{ color: '#818cf8', fontWeight: 700, fontSize: 13 }}>Preparando seu desafio solo...</motion.p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#818cf8' }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── GAME ─── */}
        {phase === 'game' && cq && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* HUD bar */}
            <div style={{ ...CARD, borderRadius: 20, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BrainCircuit size={14} style={{ color: '#818cf8' }} />
                  <span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                    Solo · {activeTheme.label}
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#818cf8', background: 'rgba(99,102,241,0.15)', padding: '3px 10px', borderRadius: 10 }}>
                  Q{qIdx + 1}/{questions.length}
                </span>
              </div>
              {/* Progress */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <motion.div style={{ height: '100%', background: 'linear-gradient(90deg,#818cf8,#a855f7)', borderRadius: 4 }}
                  animate={{ width: `${(qIdx / questions.length) * 100}%` }} transition={{ duration: 0.4 }} />
              </div>
            </div>

            {/* Question card */}
            <AnimatePresence mode="wait">
              <motion.div key={qIdx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22 }}
                style={{ ...CARD, borderRadius: 24, overflow: 'hidden' }}>

                {/* Timer bar */}
                <div style={{ padding: '14px 20px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Timer size={13} style={{ color: timeLeft > 15 ? '#4ade80' : timeLeft > 7 ? '#fbbf24' : '#f87171' }} />
                    <span style={{ fontSize: 13, fontWeight: 900, color: timeLeft > 15 ? '#4ade80' : timeLeft > 7 ? '#fbbf24' : '#f87171', fontFamily: "'Rajdhani',sans-serif" }}>
                      {String(timeLeft).padStart(2, '0')}s
                    </span>
                    {timeLeft <= 7 && !answered && (
                      <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}
                        style={{ fontSize: 10, fontWeight: 900, color: '#f87171' }}>🚨 Corra!</motion.span>
                    )}
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                    <motion.div
                      style={{ height: '100%', background: timeLeft > 15 ? 'linear-gradient(90deg,#4ade80,#22d3ee)' : timeLeft > 7 ? 'linear-gradient(90deg,#fbbf24,#f59e0b)' : 'linear-gradient(90deg,#f87171,#ef4444)', borderRadius: 4 }}
                      animate={{ width: `${timerPct}%` }} transition={{ duration: 1, ease: 'linear' }} />
                  </div>
                </div>

                {/* Question text */}
                <div style={{ padding: '0 20px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
                    <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 10, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: '#818cf8', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{qIdx + 1}</span>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.5 }}>{cq.questionText}</p>
                  </div>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {opts.map((opt, idx) => {
                      const sel = chosen === opt.id;
                      const show = answered;
                      let bg = 'rgba(255,255,255,0.04)';
                      let border = 'rgba(255,255,255,0.08)';
                      let color = 'rgba(255,255,255,0.8)';
                      let letBg = 'rgba(255,255,255,0.1)';
                      let letColor = 'rgba(255,255,255,0.5)';
                      if (!show && sel) { bg = 'rgba(99,102,241,0.2)'; border = 'rgba(99,102,241,0.7)'; color = '#fff'; letBg = '#6366f1'; letColor = '#fff'; }
                      if (show) {
                        if (opt.isCorrect) { bg = 'rgba(74,222,128,0.12)'; border = 'rgba(74,222,128,0.55)'; color = '#4ade80'; letBg = 'rgba(74,222,128,0.25)'; letColor = '#4ade80'; }
                        else if (sel) { bg = 'rgba(248,113,113,0.12)'; border = 'rgba(248,113,113,0.55)'; color = '#f87171'; letBg = 'rgba(248,113,113,0.25)'; letColor = '#f87171'; }
                        else { bg = 'rgba(255,255,255,0.02)'; border = 'rgba(255,255,255,0.05)'; color = 'rgba(255,255,255,0.3)'; letBg = 'rgba(255,255,255,0.05)'; letColor = 'rgba(255,255,255,0.25)'; }
                      }
                      return (
                        <motion.button key={opt.id} disabled={answered} onClick={() => setChosen(opt.id)}
                          whileTap={{ scale: 0.98 }}
                          style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${border}`, background: bg, display: 'flex', alignItems: 'center', gap: 12, cursor: answered ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                          <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: letBg, color: letColor, fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>{LETTERS[idx]}</span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color, lineHeight: 1.4 }}>{opt.text}</span>
                          {show && opt.isCorrect && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle2 size={18} style={{ color: '#4ade80' }} /></motion.div>}
                          {show && sel && !opt.isCorrect && <XCircle size={18} style={{ color: '#f87171' }} />}
                        </motion.button>
                      );
                    })}
                  </div>

                  {timedOut && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, textAlign: 'center' }}>
                      <p style={{ fontWeight: 900, color: '#f87171', fontSize: 13 }}>⏱️ Tempo esgotado!</p>
                    </motion.div>
                  )}
                  {answered && cq.explanation && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 14 }}>
                      <p style={{ fontSize: 10, fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>💡 Explicação</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{cq.explanation}</p>
                    </motion.div>
                  )}
                </div>

                {/* Action btn */}
                <div style={{ padding: '0 20px 20px' }}>
                  {!answered ? (
                    <motion.button whileTap={{ scale: 0.97 }} disabled={!chosen} onClick={handleConfirm}
                      style={{ width: '100%', height: 50, borderRadius: 16, border: 'none', fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 16, cursor: chosen ? 'pointer' : 'not-allowed', background: chosen ? 'linear-gradient(135deg,#6366f1,#a855f7)' : 'rgba(255,255,255,0.06)', color: chosen ? '#fff' : 'rgba(255,255,255,0.2)', boxShadow: chosen ? '0 0 20px rgba(99,102,241,0.45)' : 'none', transition: 'all 0.2s' }}>
                      ✅ Confirmar Resposta
                    </motion.button>
                  ) : (
                    <motion.button initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      whileTap={{ scale: 0.97 }} onClick={handleNext} disabled={submitting}
                      style={{ width: '100%', height: 50, borderRadius: 16, border: 'none', fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 16, cursor: 'pointer', background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', color: '#818cf8', boxShadow: '0 0 16px rgba(99,102,241,0.25)', opacity: submitting ? 0.6 : 1 }}>
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
          <motion.div key="result" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Result hero */}
            <div style={{ ...CARD, borderRadius: 28, padding: '36px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#020617 0%,#0f0a2e 50%,#1a0533 100%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.3),transparent)', filter: 'blur(40px)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Stars */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <motion.div key={s} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: s * 0.1, type: 'spring' }}>
                      <Star size={30} style={{ color: s <= starCount ? '#fbbf24' : 'rgba(255,255,255,0.12)', fill: s <= starCount ? '#fbbf24' : 'transparent' }} />
                    </motion.div>
                  ))}
                </div>

                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.4 }}
                  style={{ fontSize: 72, marginBottom: 12 }}>
                  {starCount >= 4 ? '🏆' : starCount >= 3 ? '⚔️' : '💪'}
                </motion.div>
                <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 32, color: '#fff', marginBottom: 6 }}>
                  {starCount >= 4 ? 'Excelente!' : starCount >= 3 ? 'Muito Bom!' : 'Continue Praticando!'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 28 }}>{finalScore}/{questions.length} acertos</p>

                {/* Rewards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                    style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 18, padding: '16px 12px' }}>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 28, color: '#fbbf24', marginBottom: 4 }}>+{xpEarned}</div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(251,191,36,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>⚡ XP Ganho</div>
                  </motion.div>
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 18, padding: '16px 12px' }}>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 28, color: '#f59e0b', marginBottom: 4 }}>+{coins}</div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(245,158,11,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>🪙 Moedas</div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={resetToSetup}
                style={{ height: 50, borderRadius: 16, fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                🔄 Jogar Novamente
              </motion.button>
              <motion.button whileHover={{ scale: 1.02, boxShadow: '0 0 24px rgba(99,102,241,0.4)' }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/student/duels')}
                style={{ height: 50, borderRadius: 16, fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}>
                <Trophy size={15} /> Arena de Duelos
              </motion.button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      <AnswerFeedbackOverlay
        feedback={soloFeedback?.type ?? null}
        correctAnswerText={soloFeedback?.correctText}
        explanation={soloFeedback?.explanation}
        manualAdvance
        nextLabel={qIdx >= questions.length - 1 ? 'Ver Resultado' : 'Próxima Pergunta'}
        onDismiss={() => {
          const next = pendingSoloNext.current;
          pendingSoloNext.current = null;
          setSoloFeedback(null);
          if (next) next();
        }}
      />
    </div>
  );
};
