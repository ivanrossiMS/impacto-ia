import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import {
  User, Sparkles, ChevronLeft, GraduationCap, Zap,
  CheckCircle2, Users, Shield, Flame, Trophy
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { DuelService } from '../../services/duel.service';
import type { DuelTheme, DuelDifficulty } from '../../types/duel';
import { toast } from 'sonner';
import { calcDuelRewards } from '../../lib/duelRewards';

// ─── Grade Balancing Logic (unchanged) ───────────────────────────────────────
const GRADE_RANGES: Record<string, string[]> = {
  fund1: ['1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','1º ano','2º ano','3º ano','4º ano','5º ano','1o Ano','2o Ano','3o Ano','4o Ano','5o Ano','1o ano','2o ano','3o ano','4o ano','5o ano','FUNDAMENTAL 1','Fundamental 1','EFI','EF1'],
  fund2: ['6º Ano','7º Ano','8º Ano','9º Ano','6º ano','7º ano','8º ano','9º ano','6o Ano','7o Ano','8o Ano','9o Ano','6o ano','7o ano','8o ano','9o ano','FUNDAMENTAL 2','Fundamental 2','EFII','EF2'],
  ens_medio: ['1º Médio','2º Médio','3º Médio','1º médio','2º médio','3º médio','1o Médio','2o Médio','3o Médio','1ª Série EM','2ª Série EM','3ª Série EM','Ensino Médio','Ensino medio','ENSINO MÉDIO','1EM','2EM','3EM','1ª EM','2ª EM','3ª EM'],
};

const getGradeWeight = (grade: string | null | undefined): number => {
  if (!grade) return 0;
  const g = grade.toLowerCase();
  if (g.includes('médio') || g.includes('medio') || g.includes('em')) {
    const m = g.match(/(\d+)/); return 10 + (m ? parseInt(m[1]) : 0);
  }
  const m = g.match(/(\d+)/); return m ? parseInt(m[1]) : 0;
};

const isGradeInSegment = (grade: string | null | undefined, seg: string) => {
  if (!grade) return false;
  const n = grade.toLowerCase().trim();
  if (seg === 'ens_medio' && (n.includes('médio') || n.includes('medio') || n.includes('em') || n.includes('série em') || /^\d+\s?em$/.test(n))) return true;
  return (GRADE_RANGES[seg] || []).some(r => { const nr = r.toLowerCase().trim(); return n === nr || n.includes(nr); });
};

// ─── Static data ─────────────────────────────────────────────────────────────
const THEMES: { id: DuelTheme; label: string; emoji: string }[] = [
  { id: 'historia',       label: 'História',    emoji: '📜' },
  { id: 'geografia',      label: 'Geografia',   emoji: '🌍' },
  { id: 'ciencias',       label: 'Ciências',    emoji: '🧪' },
  { id: 'arte',           label: 'Arte',        emoji: '🎨' },
  { id: 'esportes',       label: 'Esportes',    emoji: '⚽' },
  { id: 'entretenimento', label: 'Cultura Pop', emoji: '🍿' },
  { id: 'logica',         label: 'Lógica',      emoji: '🧩' },
  { id: 'quem_sou_eu',    label: 'Quem Sou Eu?',emoji: '🎭' },
  { id: 'aleatorio',      label: 'Aleatório',   emoji: '🎲' },
];

const DIFFS: { id: DuelDifficulty; label: string; emoji: string; xpHint: string; style: string; activeStyle: string }[] = [
  { id: 'easy',   label: 'Iniciante', emoji: '🟢', xpHint: '+60 XP base',  style: 'border-slate-100 hover:border-emerald-200', activeStyle: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { id: 'medium', label: 'Médio',     emoji: '🟡', xpHint: '+75 XP base',  style: 'border-slate-100 hover:border-amber-200',   activeStyle: 'border-amber-400  bg-amber-50  text-amber-700'   },
  { id: 'hard',   label: 'Mestre',    emoji: '🔴', xpHint: '+100 XP base', style: 'border-slate-100 hover:border-red-200',     activeStyle: 'border-red-400    bg-red-50    text-red-700'     },
];

const SEGMENTS = [
  { id: 'minha_turma', label: '⭐ Minha Turma' },
  { id: 'fund1',       label: '📚 Fund. 1'     },
  { id: 'fund2',       label: '📖 Fund. 2'     },
  { id: 'ens_medio',   label: '🎓 Médio'       },
] as const;

// ─── Rotating loading messages ────────────────────────────────────────────────
const LOADING_MSGS = [
  '🤖 A IA está criando perguntas personalizadas...',
  '⚖️ Calibrando o nível para o duelo equilibrado...',
  '🎯 Selecionando questões na dificuldade certa...',
  '⚡ Quase pronto! Preparando o desafio...',
  '🧠 Gerando alternativas inteligentes...',
];

const RotatingMessages: React.FC = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % LOADING_MSGS.length), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.p key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3 }} className="text-indigo-300 font-bold text-sm">
        {LOADING_MSGS[idx]}
      </motion.p>
    </AnimatePresence>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export const DuelCreate: React.FC = () => {
  const navigate = useNavigate();
  const user     = useAuthStore(s => s.user);

  const [opponent,       setOpponent]       = useState<any>(null);
  const [theme,          setTheme]          = useState<DuelTheme>('aleatorio');
  const [difficulty,     setDifficulty]     = useState<DuelDifficulty>('medium');
  const [questionCount,  setQuestionCount]  = useState<5 | 8 | 10>(5);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [studentGrade,   setStudentGrade]   = useState('');
  const [segment,        setSegment]        = useState<'minha_turma'|'fund1'|'fund2'|'ens_medio'>('minha_turma');
  const [students,       setStudents]       = useState<any[]>([]);
  const [loadingStudents,setLoadingStudents]= useState(false);
  const [step,           setStep]           = useState<1 | 2>(1);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingStudents(true);
      try {
        const { data: me } = await supabase.from('users').select('classId, schoolId, grade').eq('id', user.id).single();
        if (me?.grade) setStudentGrade(me.grade);

        if (segment === 'minha_turma') {
          if (me?.classId) {
            const { data } = await supabase.from('users').select('*').eq('classId', me.classId).eq('role', 'student').neq('id', user.id);
            setStudents(data || []);
          } else setStudents([]);
        } else {
          const { data: all } = await supabase.from('users').select('*').eq('schoolId', me?.schoolId || '').eq('role', 'student').neq('id', user.id);
          const { data: cls } = await supabase.from('classes').select('id, grade').eq('schoolId', me?.schoolId || '');
          const cgMap: Record<string, string> = {};
          (cls || []).forEach(c => { if (c.grade) cgMap[c.id] = c.grade; });
          setStudents((all || []).filter(s => isGradeInSegment(s.grade, segment) || (s.classId && isGradeInSegment(cgMap[s.classId], segment))));
        }
      } catch (e) { console.error(e); }
      finally { setLoadingStudents(false); }
    };
    load();
  }, [user?.id, segment]);

  const handleCreate = async () => {
    if (!user || !opponent) return;
    setIsSubmitting(true);
    try {
      const mw = getGradeWeight(studentGrade);
      const ow = getGradeWeight(opponent.grade);
      let finalGrade = studentGrade;
      if (ow > 0 && mw > 0) finalGrade = mw <= ow ? studentGrade : opponent.grade;
      else if (ow > 0)       finalGrade = opponent.grade;

      const duel = await DuelService.createDuel(user.id, opponent.id, theme, difficulty, questionCount, finalGrade || studentGrade || '4º Ano');
      toast.success('🎉 Desafio enviado com sucesso!');
      navigate(`/student/duels/${duel.id}`);
    } catch { toast.error('Erro ao criar desafio.'); }
    finally { setIsSubmitting(false); }
  };

  const r = calcDuelRewards(difficulty, questionCount);
  const balancedGrade = opponent && studentGrade
    ? (getGradeWeight(studentGrade) <= getGradeWeight(opponent.grade) ? studentGrade : opponent.grade)
    : studentGrade;

  return (
    <div className="max-w-3xl mx-auto pb-20">

      {/* ─── LOADING OVERLAY ─────────────────────────────────────── */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }}
              className="flex flex-col items-center gap-6 text-center px-8"
            >
              {/* Spinner ring */}
              <div className="relative w-28 h-28">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-900/60" />
                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-purple-500 animate-spin" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-b-indigo-400/30 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="absolute inset-0 flex items-center justify-center text-4xl"
                >
                  🧠
                </motion.div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-white mb-2">Gerando o Duelo</h2>
                <RotatingMessages />
              </div>

              <div className="flex items-center gap-2">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
                    className="w-2 h-2 rounded-full bg-indigo-400" />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── HERO HEADER ─────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 rounded-[2.5rem] p-7 mb-8 shadow-2xl overflow-hidden">
        <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at 15% 60%, #6366f1, transparent 55%), radial-gradient(circle at 85% 20%, #a855f7, transparent 55%)' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <button onClick={() => navigate('/student/duels')} className="flex items-center gap-1.5 text-white/40 hover:text-white/80 font-black text-xs mb-3 transition-colors">
              <ChevronLeft size={14} /> Voltar para Duelos
            </button>
            <h1 className="text-3xl font-black text-white mb-1">Criar <span className="text-indigo-400">Desafio</span></h1>
            <p className="text-white/40 font-bold text-sm">Configure e desafie um colega</p>
          </div>
          <div className="text-7xl opacity-20 leading-none select-none">⚔️</div>
        </div>

        {/* Step indicator */}
        <div className="relative flex items-center gap-3 mt-6">
          {[1, 2].map(s => (
            <React.Fragment key={s}>
              <button onClick={() => { if (s === 1 || opponent) setStep(s as any); }}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-xs transition-all',
                  step === s ? 'bg-white text-slate-800 shadow-lg' : 'bg-white/10 text-white/50 hover:bg-white/15')}>
                <span className={cn('w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center',
                  step === s ? 'bg-indigo-600 text-white' : opponent && s === 2 ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white/60')}>
                  {s === 2 && opponent ? <CheckCircle2 size={12} /> : s}
                </span>
                {s === 1 ? '⚔️ Oponente' : '⚙️ Configurar'}
              </button>
              {s === 1 && <div className="flex-1 h-px bg-white/10" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ─── STEP 1: OPPONENT ─────────────────────────────────── */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="space-y-5">
            {/* Segment selector */}
            <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Buscar alunos por segmento</p>
              <div className="grid grid-cols-4 gap-2">
                {SEGMENTS.map(seg => (
                  <button key={seg.id} onClick={() => { setSegment(seg.id); setOpponent(null); }}
                    className={cn('py-2.5 px-2 rounded-xl text-[10px] font-black transition-all border-2 text-center',
                      segment === seg.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-100 text-slate-500 hover:border-slate-200')}>
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Student list */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  <span className="font-black text-slate-700 text-sm">Escolha seu Oponente</span>
                </div>
                {loadingStudents && <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />}
              </div>

              <div className="p-4 max-h-[380px] overflow-y-auto space-y-2">
                {loadingStudents ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Buscando oponentes...</span>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-slate-400 font-bold text-sm">Nenhum aluno encontrado neste segmento.</p>
                  </div>
                ) : (
                  students.map(s => {
                    const selected = opponent?.id === s.id;
                    return (
                      <motion.button key={s.id} whileTap={{ scale: 0.98 }} onClick={() => setOpponent(selected ? null : s)}
                        className={cn('w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left',
                          selected ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-md' : 'border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30')}>
                        <div className={cn('w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 transition-all',
                          selected ? 'ring-2 ring-indigo-400 ring-offset-1' : 'bg-slate-100')}>
                          {s.avatar ? <img src={s.avatar} className="w-full h-full object-cover" alt={s.name} /> : <User size={18} className="text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-slate-800 text-sm truncate">{s.name}</h4>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{s.grade || 'Aluno'}</p>
                        </div>
                        {selected && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                            <CheckCircle2 size={20} className="text-indigo-500 shrink-0" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected opponent preview */}
            <AnimatePresence>
              {opponent && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-[2rem] p-5 flex items-center justify-between shadow-xl shadow-indigo-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/20 flex items-center justify-center ring-2 ring-white/30">
                      {opponent.avatar ? <img src={opponent.avatar} className="w-full h-full object-cover" /> : <User size={20} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Oponente selecionado</p>
                      <h3 className="font-black text-white text-base">{opponent.name}</h3>
                      <p className="text-[9px] text-indigo-300 font-bold">{opponent.grade || 'Aluno'}</p>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStep(2)}
                    className="flex items-center gap-2 bg-white text-indigo-700 font-black text-sm px-5 py-2.5 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                    Avançar ⚡
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── STEP 2: SETTINGS ─────────────────────────────────── */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">

            {/* Opponent summary */}
            <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-[1.75rem] p-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                {opponent?.avatar ? <img src={opponent.avatar} className="w-full h-full object-cover" /> : <User size={16} className="text-slate-400" />}
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desafiando</p>
                <p className="font-black text-slate-800 text-sm">{opponent?.name}</p>
              </div>
              <button onClick={() => setStep(1)} className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-widest">
                Trocar →
              </button>
            </div>

            {/* Themes */}
            <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Flame size={12} className="text-amber-500" /> Tema do Duelo
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setTheme(t.id)} className={cn(
                    'flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border-2 font-black text-[11px] transition-all',
                    theme === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-100 text-slate-600 hover:border-indigo-100 hover:bg-indigo-50/30'
                  )}>
                    <span className="text-2xl">{t.emoji}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Shield size={12} className="text-indigo-500" /> Nível de Dificuldade
              </p>
              <div className="grid grid-cols-3 gap-3">
                {DIFFS.map(d => (
                  <button key={d.id} onClick={() => setDifficulty(d.id)} className={cn(
                    'p-4 rounded-2xl border-2 font-black transition-all text-center',
                    difficulty === d.id ? d.activeStyle + ' shadow-md' : 'border-slate-100 text-slate-600 hover:border-slate-200'
                  )}>
                    <div className="text-2xl mb-1">{d.emoji}</div>
                    <div className="text-sm">{d.label}</div>
                    <div className="text-[9px] opacity-60 mt-0.5">{d.xpHint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Question count */}
            <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Zap size={12} className="text-amber-500" /> Quantidade de Questões
              </p>
              <div className="flex gap-3">
                {([5, 8, 10] as const).map(n => (
                  <button key={n} onClick={() => setQuestionCount(n)} className={cn(
                    'flex-1 py-4 rounded-2xl border-2 font-black text-center transition-all',
                    questionCount === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-100 text-slate-600 hover:border-indigo-100'
                  )}>
                    <div className="text-2xl font-black">{n}</div>
                    <div className="text-[10px] opacity-60">questões</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Balanced duel info */}
            {opponent && studentGrade && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-4 flex items-start gap-3">
                <GraduationCap size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">Duelo Equilibrado ✓</p>
                  <p className="text-[10px] font-bold text-indigo-500 leading-relaxed">
                    Séries diferentes? A IA usa a série menor para equilibrar o desafio.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] font-black text-indigo-400">Nível do duelo:</span>
                    <span className="text-[10px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">{balancedGrade || studentGrade}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Rewards preview */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute right-0 top-0 text-[100px] opacity-5 leading-none select-none">🏆</div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-5">
                  <Trophy size={16} className="text-amber-400" />
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Recompensas do Duelo</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: '🏆 Vitória',   xp: r.winXP,   coins: r.winCoins   },
                    { label: '🤝 Empate',    xp: r.drawXP,  coins: r.drawCoins  },
                    { label: '💪 Derrota',   xp: r.loseXP,  coins: r.loseCoins  },
                  ].map(row => (
                    <div key={row.label} className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                      <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2">{row.label}</div>
                      <div className="text-white font-black text-base">{row.xp} XP</div>
                      <div className="text-yellow-400 font-black text-sm">🪙 {row.coins}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">+ por acerto</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-4">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Por questão correta</span>
                  <div className="flex items-center gap-3 font-black">
                    <span className="text-amber-400">⚡ +{r.xpPerCorrect} XP</span>
                    <span className="text-yellow-400">🪙 +{r.coinsPerCorrect}</span>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">Máximo possível 🚀</div>
                    <div className="flex items-center gap-4 font-black">
                      <span className="text-white text-xl">⚡ {r.maxXP} XP</span>
                      <span className="text-yellow-300 text-xl">🪙 {r.maxCoins}</span>
                    </div>
                  </div>
                  <span className="text-4xl">🚀</span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <motion.button whileTap={{ scale: 0.97 }} disabled={isSubmitting} onClick={handleCreate}
              className={cn('w-full h-16 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl',
                isSubmitting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5')}>
              {isSubmitting ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Gerando Duelo Equilibrado...</>
              ) : (
                <><Sparkles size={20} /> Enviar Desafio ⚔️</>
              )}
            </motion.button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
