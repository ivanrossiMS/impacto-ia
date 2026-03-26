import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import {
  ChevronLeft, Sparkles, Users, BookOpen, Book, GraduationCap,
  Search, CheckCircle2, Trophy, Zap, Swords, Brain,
  Shield, Globe, Shuffle, Palette, Atom, Dumbbell,
  User, BookMarked, ArrowRight, Target, Star, Tv, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DuelService } from '../../services/duel.service';
import type { DuelTheme, DuelDifficulty } from '../../types/duel';
import { toast } from 'sonner';
import { calcDuelRewards } from '../../lib/duelRewards';
import { StudentAvatarMini } from '../../components/ui/StudentAvatarMini';
import { cn } from '../../lib/utils';

// ─── Grade Balancing Logic ──────────────────────────────────────
const GRADE_RANGES: Record<string, string[]> = {
  fund1: ['1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','1º ano','2º ano','3º ano','4º ano','5º ano','FUNDAMENTAL 1','Fundamental 1','EFI','EF1'],
  fund2: ['6º Ano','7º Ano','8º Ano','9º Ano','6º ano','7º ano','8º ano','9º ano','FUNDAMENTAL 2','Fundamental 2','EFII','EF2'],
  ens_medio: ['1º Médio','2º Médio','3º Médio','Ensino Médio','ENSINO MÉDIO','1EM','2EM','3EM'],
};
const getGradeWeight = (grade: string | null | undefined): number => {
  if (!grade) return 0;
  const g = grade.toLowerCase();
  if (g.includes('médio') || g.includes('medio') || g.includes('em')) { const m = g.match(/(\d+)/); return 10 + (m ? parseInt(m[1]) : 0); }
  const m = g.match(/(\d+)/); return m ? parseInt(m[1]) : 0;
};
const isGradeInSegment = (grade: string | null | undefined, seg: string) => {
  if (!grade) return false;
  const n = grade.toLowerCase().trim();
  if (seg === 'ens_medio' && (n.includes('médio') || n.includes('medio') || /^\d+\s?em$/.test(n))) return true;
  return (GRADE_RANGES[seg] || []).some(r => { const nr = r.toLowerCase().trim(); return n === nr || n.includes(nr); });
};

// ─── Tier helper ─────────────────────────────────────────────────────────────
const getTier = (wins = 0) => {
  if (wins >= 750) return { label: 'Grão-Mestre', emoji: '⚔️', color: '#ef4444', bg: 'rgba(239,68,68,0.18)' };
  if (wins >= 450) return { label: 'Mestre',      emoji: '👑', color: '#a855f7', bg: 'rgba(168,85,247,0.18)' };
  if (wins >= 270) return { label: 'Diamante',    emoji: '💠', color: '#38bdf8', bg: 'rgba(56,189,248,0.18)' };
  if (wins >= 150) return { label: 'Platina',     emoji: '💎', color: '#22d3ee', bg: 'rgba(34,211,238,0.18)' };
  if (wins >= 75)  return { label: 'Ouro',        emoji: '🥇', color: '#fbbf24', bg: 'rgba(251,191,36,0.18)' };
  if (wins >= 30)  return { label: 'Prata',       emoji: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.18)' };
  return            { label: 'Bronze',            emoji: '🥉', color: '#d97706', bg: 'rgba(217,119,6,0.18)' };
};

// ─── Static data ─────────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: 'minha_turma', label: 'Minha Turma', Icon: Users,         color: '#818cf8', glow: 'rgba(99,102,241,0.35)' },
  { id: 'fund1',       label: 'Fund. 1',     Icon: BookOpen,      color: '#38bdf8', glow: 'rgba(56,189,248,0.28)' },
  { id: 'fund2',       label: 'Fund. 2',     Icon: Book,          color: '#4ade80', glow: 'rgba(74,222,128,0.28)' },
  { id: 'ens_medio',   label: 'Médio',       Icon: GraduationCap, color: '#fbbf24', glow: 'rgba(251,191,36,0.28)' },
] as const;

const THEMES: { id: DuelTheme; label: string; Icon: any; color: string; bg: string }[] = [
  { id: 'historia',       label: 'História',    Icon: BookMarked, color: '#a78bfa', bg: 'from-violet-500/20 to-purple-500/5' },
  { id: 'geografia',      label: 'Geografia',   Icon: Globe,      color: '#38bdf8', bg: 'from-sky-500/20 to-blue-500/5'  },
  { id: 'ciencias',       label: 'Ciências',    Icon: Atom,       color: '#4ade80', bg: 'from-emerald-500/20 to-green-500/5'  },
  { id: 'arte',           label: 'Arte',        Icon: Palette,    color: '#f472b6', bg: 'from-pink-500/20 to-rose-500/5' },
  { id: 'esportes',       label: 'Esportes',    Icon: Dumbbell,   color: '#fb923c', bg: 'from-orange-500/20 to-amber-500/5'  },
  { id: 'entretenimento', label: 'TV/Séries',   Icon: Tv,         color: '#c084fc', bg: 'from-fuchsia-500/20 to-purple-500/5' },
  { id: 'logica',         label: 'Lógica',      Icon: Brain,      color: '#60a5fa', bg: 'from-blue-500/20 to-cyan-500/5'  },
  { id: 'quem_sou_eu',    label: 'Quem Sou Eu?',Icon: User,       color: '#f9a8d4', bg: 'from-pink-400/20 to-fuchsia-400/5' },
  { id: 'aleatorio',      label: 'Aleatório',   Icon: Shuffle,    color: '#fbbf24', bg: 'from-yellow-500/20 to-amber-500/5'  },
];

const DIFFS = [
  { id: 'easy'   as DuelDifficulty, label: 'Iniciante', Icon: Shield, desc: 'Questões adaptadas ao nível basilar.', xp: '+60 XP',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  glow: 'rgba(74,222,128,0.25)'  },
  { id: 'medium' as DuelDifficulty, label: 'Médio',     Icon: Zap,    desc: 'Balanço entre desafio e aprendizado.',   xp: '+75 XP',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  glow: 'rgba(251,191,36,0.25)'  },
  { id: 'hard'   as DuelDifficulty, label: 'Mestre',    Icon: Swords, desc: 'Apenas para os mais corajosos.',  xp: '+100 XP', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', glow: 'rgba(248,113,113,0.25)' },
];

const LOADING_MSGS = [
  '🤖 IA criando perguntas personalizadas...',
  '⚖️ Calibrando o nível do duelo...',
  '🎯 Selecionando questões...',
  '⚡ Consolidando desafio...',
  '🧠 Gerando lógicas de alternativas...',
];

const RotatingMessages: React.FC = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(p => (p + 1) % LOADING_MSGS.length), 2500); return () => clearInterval(t); }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.p key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3 }} className="text-indigo-400 font-bold text-sm tracking-widest uppercase">
        {LOADING_MSGS[idx]}
      </motion.p>
    </AnimatePresence>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export const DuelCreate: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [opponent,        setOpponent]        = useState<any>(null);
  const [theme,           setTheme]           = useState<DuelTheme>('aleatorio');
  const [difficulty,      setDifficulty]      = useState<DuelDifficulty>('medium');
  const questionCount = 8 as const;
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [studentGrade,    setStudentGrade]    = useState('');
  
  // Filtering states
  const [segment,         setSegment]         = useState<'minha_turma'|'fund1'|'fund2'|'ens_medio'>('minha_turma');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  
  // Data states
  const [schoolClasses,   setSchoolClasses]   = useState<any[]>([]);
  const [allStudents,     setAllStudents]     = useState<any[]>([]);
  const [statsMap,        setStatsMap]        = useState<Record<string, any>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  const [step,            setStep]            = useState<0|1|2>(0); // 0=mode select, 1=opponent, 2=config
  const [search,          setSearch]          = useState('');
  
  // Random search Phase
  type SearchPhase = 'idle' | 'scanning' | 'matched' | 'revealed';
  const [searchPhase,     setSearchPhase]     = useState<SearchPhase>('idle');
  const [foundOpponent,   setFoundOpponent]   = useState<any>(null);
  
  const autoTriggered = useRef(false);
  const location = useLocation();
  const isAutoMode = new URLSearchParams(location.search).get('auto') === '1';

  // 1. Fetch initial background data
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingStudents(true);
      try {
        const { data: me } = await supabase.from('users').select('classId, schoolId, grade').eq('id', user.id).single();
        if (me?.grade) setStudentGrade(me.grade);
        
        // Fetch all classes of the school
        const { data: cls } = await supabase.from('classes').select('id, name, grade').eq('schoolId', me?.schoolId || '').order('name');
        setSchoolClasses(cls || []);

        // Fetch all students (except me)
        const { data: all } = await supabase.from('users').select('*').eq('schoolId', me?.schoolId || '').eq('role', 'student').neq('id', user.id);
        const stList = all || [];
        setAllStudents(stList);

        if (stList.length > 0) {
          const statsIds = [...stList.map(s => s.id), user.id];
          const [{ data: stats }, { data: winRows }] = await Promise.all([
            supabase.from('gamification_stats').select('id, xp, streak').in('id', statsIds),
            supabase.from('duels').select('winnerId').eq('status', 'completed').in('winnerId', statsIds),
          ]);
          const winsMap: Record<string, number> = {};
          (winRows || []).forEach((d: any) => { if (d.winnerId && d.winnerId !== 'draw') winsMap[d.winnerId] = (winsMap[d.winnerId] || 0) + 1; });
          const map: Record<string, any> = {};
          (stats || []).forEach((st: any) => { map[st.id] = { ...st, total_wins: winsMap[st.id] || 0 }; });
          setStatsMap(map);
        }
      } catch (e) { console.error(e); }
      finally { setLoadingStudents(false); }
    };
    load();
  }, [user?.id]);

  // 2. Reset sub-filters on segment change
  useEffect(() => {
    setSelectedClassFilter('all');
    setOpponent(null);
    setSearch('');
  }, [segment]);

  // 3. Compute available classes based on the chosen segment
  const availableClassesForSegment = useMemo(() => {
    if (segment === 'minha_turma') {
      const myClassId = (user as any)?.classId;
      return schoolClasses.filter(c => c.id === myClassId);
    }
    return schoolClasses.filter(c => isGradeInSegment(c.grade, segment));
  }, [segment, schoolClasses, user]);

  // 4. Compute the actual list of filtered students
  const filteredStudents = useMemo(() => {
    let list = allStudents;

    if (segment === 'minha_turma') {
      const myClassId = (user as any)?.classId;
      list = list.filter(s => s.classId === myClassId);
    } else {
      const validClassIds = availableClassesForSegment.map(c => c.id);
      list = list.filter(s => {
         if (s.classId && validClassIds.includes(s.classId)) return true;
         if (!s.classId && isGradeInSegment(s.grade, segment)) return true; // fallback
         return false;
      });
    }

    if (selectedClassFilter !== 'all') {
      list = list.filter(s => s.classId === selectedClassFilter);
    }

    if (search.trim()) {
      list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    }

    return list;
  }, [allStudents, segment, availableClassesForSegment, selectedClassFilter, search, user]);

  // ── Smart matchmaking (school-wide) ────────────────
  const triggerRandomSearch = async () => {
    if (!user || allStudents.length === 0) {
      toast.error('Nenhum aluno encontrado na escola.');
      return;
    }
    setSearchPhase('scanning');
    setFoundOpponent(null);
    const startTime = Date.now();
    try {
      const myClassId  = (user as any).classId || '';
      const pool = allStudents;

      // 4-tier smart matching
      const myWins      = statsMap[user.id]?.total_wins || 0;
      const myTierLabel = getTier(myWins).label;
      const myGW        = getGradeWeight(studentGrade);

      const p1 = pool.filter(s => s.classId === myClassId && getTier(statsMap[s.id]?.total_wins || 0).label === myTierLabel);
      const p2 = pool.filter(s => getTier(statsMap[s.id]?.total_wins || 0).label === myTierLabel);
      const p3 = pool.filter(s => Math.abs(getGradeWeight(s.grade || '') - myGW) <= 2);
      const ranked = p1.length > 0 ? p1 : p2.length > 0 ? p2 : p3.length > 0 ? p3 : pool;
      const pick   = ranked[Math.floor(Math.random() * ranked.length)];

      const elapsed   = Date.now() - startTime;
      const remaining = Math.max(0, 2500 - elapsed);
      await new Promise(r => setTimeout(r, remaining));

      setFoundOpponent(pick);
      setSearchPhase('matched');
      setTimeout(() => {
        setSearchPhase('revealed');
        setTimeout(() => {
          setOpponent(pick);
          setSearchPhase('idle');
          setFoundOpponent(null);
          setStep(2);
        }, 1800);
      }, 700);
    } catch (e) {
      setSearchPhase('idle');
      toast.error('Erro ao buscar oponente.');
    }
  };

  useEffect(() => {
    if (isAutoMode && !autoTriggered.current && !loadingStudents) {
      autoTriggered.current = true;
      setStep(1); // skip mode selection, go straight to opponent
      triggerRandomSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoMode, loadingStudents]);

  const handleCreate = async () => {
    if (!user || !opponent) return;
    setIsSubmitting(true);
    try {
      const mw = getGradeWeight(studentGrade), ow = getGradeWeight(opponent.grade);
      let finalGrade = studentGrade;
      if (ow > 0 && mw > 0) finalGrade = mw <= ow ? studentGrade : opponent.grade;
      else if (ow > 0) finalGrade = opponent.grade;
      const duel = await DuelService.createDuel(user.id, opponent.id, theme, difficulty, questionCount, finalGrade || studentGrade || '4º Ano');
      toast.success('🎉 Desafio enviado com sucesso!');
      navigate(`/student/duels/${duel.id}`);
    } catch { toast.error('Erro ao criar desafio.'); }
    finally { setIsSubmitting(false); }
  };

  const r = calcDuelRewards(difficulty, questionCount);
  const balancedGrade = opponent && studentGrade ? (getGradeWeight(studentGrade) <= getGradeWeight(opponent.grade) ? studentGrade : opponent.grade) : studentGrade;

  const oppSt       = opponent ? (statsMap[opponent.id] || {}) : {};
  const oppTier     = getTier(oppSt.total_wins);

  const mw = getGradeWeight(studentGrade), ow = getGradeWeight(opponent?.grade || '');
  const balanceStatus = !opponent ? null
    : Math.abs(mw - ow) === 0 ? { label: 'Equilíbrio Perfeito', color: '#4ade80', icon: '✅' }
    : Math.abs(mw - ow) <= 2  ? { label: 'Levemente Desafiador', color: '#fbbf24', icon: '⚡' }
    : { label: 'Alto Desafio', color: '#f87171', icon: '🔥' };

  return (
    <div className="max-w-[760px] mx-auto px-4 pb-24 relative">
      {/* Loading Overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 18 }} className="flex flex-col items-center gap-6 text-center px-8">
              <div className="relative w-28 h-28">
                <div className="absolute inset-0 rounded-full border-[3px] border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-400 border-r-purple-400 animate-spin" />
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="absolute inset-0 flex items-center justify-center text-5xl">🧠</motion.div>
              </div>
              <div>
                <h2 className="text-white text-3xl font-black mb-2 uppercase tracking-widest" style={{ fontFamily: "'Rajdhani',sans-serif" }}>Gerando o Duelo</h2>
                <RotatingMessages />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CINEMATIC RANDOM SEARCH OVERLAY ── */}
      <AnimatePresence>
        {searchPhase !== 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020414]/95 backdrop-blur-lg">
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.05) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

            {searchPhase !== 'revealed' ? (
              <div className="flex flex-col items-center gap-8 text-center px-8 z-10">
                <div className="relative w-48 h-48 flex items-center justify-center mb-4">
                  {[0,1,2].map(i => (
                    <motion.div key={i} animate={{ scale: [0.4, 2.2], opacity: [0.8, 0] }} transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.72, ease: 'easeOut' }}
                      className="absolute w-full h-full rounded-full border-2 border-indigo-500/70" />
                  ))}
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                    className="absolute h-[2px] w-24 left-1/2 top-1/2 origin-left rounded bg-gradient-to-r from-indigo-500/90 to-transparent" />
                  <motion.div animate={{ scale: [1, 1.25, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                    className="w-7 h-7 rounded-full bg-[radial-gradient(circle,#818cf8,#6366f1)] shadow-[0_0_28px_rgba(99,102,241,0.9)] z-10" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <motion.h2 animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.4, repeat: Infinity }}
                    className="text-white text-3xl font-black uppercase tracking-widest" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
                    {searchPhase === 'matched' ? 'OPONENTE ENCONTRADO!' : 'BUSCANDO OPONENTE...'}
                  </motion.h2>
                  <p className="text-indigo-400/80 font-bold text-sm">
                    {searchPhase === 'matched' ? '✅ Correspondência perfeita localizada!' : '🎯 Analisando tier, nível e turma...'}
                  </p>
                </div>
                {searchPhase === 'scanning' && (
                  <div className="flex gap-2 flex-wrap justify-center max-w-[340px]">
                    {allStudents.slice(0, 8).map((s, i) => (
                      <motion.div key={s.id} animate={{ opacity: [0, 1, 0], y: [8, 0, -8] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                        className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-black">
                        {s.name.split(' ')[0]}
                      </motion.div>
                    ))}
                  </div>
                )}
                <button onClick={() => { setSearchPhase('idle'); setFoundOpponent(null); }} className="mt-4 text-xs font-black text-white/30 border border-white/10 px-4 py-1.5 rounded-xl hover:bg-white/5 transition-colors uppercase tracking-widest">
                  CANCELAR
                </button>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-7 z-10">
                <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }} className="flex items-center gap-3">
                  <motion.div animate={{ opacity: [0.6,1,0.6], scale: [1,1.06,1] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 font-black text-sm uppercase tracking-[0.25em]" style={{ fontFamily: "'Rajdhani',sans-serif" }}>Oponente Localizado!</span>
                  <motion.div animate={{ opacity: [0.6,1,0.6], scale: [1,1.06,1] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </motion.div>
                <motion.div initial={{ scale: 0.6, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                  className="flex flex-col items-center gap-4 px-12 py-8 rounded-[2rem] bg-gradient-to-br from-[#0c1230]/95 to-[#140a28]/95 border border-indigo-500/50 shadow-[0_0_60px_rgba(99,102,241,0.35),0_32px_80px_rgba(0,0,0,0.6)]">
                  <div className="relative">
                    <motion.div animate={{ opacity: [0.4,0.9,0.4], scale: [1,1.12,1] }} transition={{ duration: 1.8, repeat: Infinity }}
                      className="absolute -inset-2 rounded-[1.5rem] bg-indigo-500/15 border border-indigo-500/40 pointer-events-none" />
                    <StudentAvatarMini studentId={foundOpponent?.id || ''} fallbackAvatarUrl={foundOpponent?.avatar} fallbackInitial={foundOpponent?.name?.[0] || '?'} size={120} shape="2xl" />
                  </div>
                  <div className="text-center mt-2">
                    <h3 className="text-white font-black text-3xl mb-1" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{foundOpponent?.name?.split(' ').slice(0, 2).join(' ')}</h3>
                    <p className="text-white/40 text-xs font-bold mb-3">{foundOpponent?.grade || 'Aluno'}</p>
                    {(() => { const st = statsMap[foundOpponent?.id] || {}; const t = getTier(st.total_wins); return (
                      <span className="text-xs font-black px-3 py-1 rounded-xl" style={{ background: t.bg, color: t.color }}>{t.emoji} {t.label}</span>
                    ); })()}
                  </div>
                  <p className="text-indigo-400/80 font-bold text-xs mt-2">⚡ Preparando configuração...</p>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="mt-2 mb-6 relative overflow-hidden rounded-[2rem] p-7 shadow-2xl bg-gradient-to-br from-[#080e24] to-[#0b1230] border border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f0a2e] to-[#1a0533] pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-indigo-500/30 blur-[40px] pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-purple-500/20 blur-[40px] pointer-events-none" />
        
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex-1">
            <button onClick={() => navigate('/student/duels')} className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-[0.15em] mb-4 hover:text-white/80 transition-colors">
              <ChevronLeft size={14} /> Voltar
            </button>
            <h1 className="text-4xl font-black text-white mb-1.5 uppercase tracking-widest" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
              Criar <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Desafio</span>
            </h1>
            <p className="text-white/40 text-sm font-bold">
              {step === 0 ? 'Escolha como quer duelar hoje' : step === 1 ? 'Escolha seu adversário nas arenas de duelo' : 'Configure as regras da batalha'}
            </p>
          </div>
          <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
            className="text-6xl opacity-10 leading-none shrink-0 ml-4 select-none drop-shadow-lg">⚔️</motion.div>
        </div>

        <div className="relative z-10 flex items-center gap-3 mt-8">
          {([1, 2] as const).map((s, i) => {
            const active = step === s || (step === 0 && s === 1);
            const done   = step > s;
            return (
              <React.Fragment key={s}>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (s === 1 || opponent) setStep(s); }}
                  className={cn("flex items-center gap-2.5 px-5 py-3 rounded-[1.25rem] font-black text-xs transition-all tracking-wider shadow-lg", 
                    active ? "bg-indigo-500/90 text-white border border-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.5)]" : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10")}>
                  <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", active ? "bg-white text-indigo-500" : done ? "bg-emerald-400 text-black shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-white/10 text-white/40")}>
                    {done ? <CheckCircle2 size={12} /> : s}
                  </div>
                  {s === 1 ? '⚔️ OPONENTE' : '⚙️ CONFIGURAR'}
                </motion.button>
                {i === 0 && <div className={cn("flex-1 h-[2px] rounded-full", opponent ? "bg-gradient-to-r from-indigo-500/70 to-purple-500/30" : "bg-white/5")} />}
              </React.Fragment>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ══════════════════ STEP 0 — MODE SELECT ══════════════════ */}
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
            className="flex flex-col gap-5">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-center">Como você quer duelar?</p>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* SOLO */}
              <motion.button whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/student/duels/solo')}
                className="relative overflow-hidden rounded-[2rem] p-6 flex flex-col items-center gap-3 border text-center"
                style={{ background: 'linear-gradient(145deg,#0d1224,#111827)', borderColor: 'rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
                <motion.div className="absolute inset-0 pointer-events-none"
                  animate={{ opacity: [0,0.06,0] }} transition={{ duration: 3, repeat: Infinity }} style={{ background: 'radial-gradient(circle at 50% 30%,#818cf8,transparent)' }} />
                <motion.div animate={{ y: [0,-6,0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="text-[52px] leading-none">🎮</motion.div>
                <div>
                  <p className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>SOLO</p>
                  <p className="text-[11px] font-bold text-white/40">Treine no seu ritmo sem oponente.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/8 border border-white/12 text-white/50">Iniciar →</span>
              </motion.button>

              {/* DESAFIAR */}
              <motion.button whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }}
                onClick={() => setStep(1)}
                className="relative overflow-hidden rounded-[2rem] p-6 flex flex-col items-center gap-3 border text-center"
                style={{ background: 'linear-gradient(145deg,#0f0a2e,#1a0533)', borderColor: 'rgba(124,58,237,0.45)', boxShadow: '0 12px 40px rgba(88,28,135,0.4)' }}>
                <motion.div className="absolute inset-0 pointer-events-none"
                  animate={{ opacity: [0,0.12,0] }} transition={{ duration: 2.5, repeat: Infinity }} style={{ background: 'radial-gradient(circle at 50% 30%,#7c3aed,transparent)' }} />
                <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }} className="text-[52px] leading-none">⚔️</motion.div>
                <div>
                  <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-1" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>DESAFIAR</p>
                  <p className="text-[11px] font-bold text-white/40">Escolha um colega para duelar.</p>
                </div>
                <motion.span whileHover={{ scale: 1.05 }}
                  className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-300"
                  style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', boxShadow: '0 0 14px rgba(99,102,241,0.3)' }}>Escolher →</motion.span>
              </motion.button>

              {/* DESAFIO RÁPIDO */}
              <motion.button whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }}
                onClick={() => { setStep(1); triggerRandomSearch(); }}
                className="relative overflow-hidden rounded-[2rem] p-6 flex flex-col items-center gap-3 border text-center"
                style={{ background: 'linear-gradient(145deg,#0a1a10,#091a14)', borderColor: 'rgba(74,222,128,0.45)', boxShadow: '0 12px 40px rgba(16,185,129,0.3)' }}>
                <motion.div className="absolute inset-0 pointer-events-none"
                  animate={{ opacity: [0,0.14,0] }} transition={{ duration: 2, repeat: Infinity }} style={{ background: 'radial-gradient(circle at 50% 30%,#4ade80,transparent)' }} />
                {/* Radar ping animation */}
                {[0,1,2].map(i => (
                  <motion.div key={i} className="absolute rounded-full border border-emerald-500/40"
                    style={{ width: 80, height: 80, top: '50%', left: '50%', marginTop: -40, marginLeft: -40 }}
                    animate={{ scale: [0.5, 2.5], opacity: [0.7, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }} />
                ))}
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="text-[52px] leading-none relative z-10">🎯</motion.div>
                <div className="relative z-10">
                  <p className="text-xl font-black text-emerald-400 mb-1" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>RÁPIDO</p>
                  <p className="text-[11px] font-bold text-white/40">IA encontra o oponente ideal para você.</p>
                </div>
                <motion.span animate={{ boxShadow: ['0 0 0px rgba(74,222,128,0)','0 0 18px rgba(74,222,128,0.5)','0 0 0px rgba(74,222,128,0)'] }} transition={{ duration: 1.8, repeat: Infinity }}
                  className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-300 relative z-10"
                  style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.5)' }}>Buscar Rival →</motion.span>
              </motion.button>

              {/* AO VIVO */}
              <motion.button whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/student/duels/realtime')}
                className="relative overflow-hidden rounded-[2rem] p-6 flex flex-col items-center gap-3 border text-center"
                style={{ background: 'linear-gradient(145deg,#1a0a00,#291000)', borderColor: 'rgba(234,179,8,0.45)', boxShadow: '0 12px 40px rgba(180,83,9,0.35)' }}>
                <motion.div className="absolute inset-0 pointer-events-none"
                  animate={{ opacity: [0,0.15,0] }} transition={{ duration: 1.8, repeat: Infinity }} style={{ background: 'radial-gradient(circle at 50% 30%,#f59e0b,transparent)' }} />
                <motion.div animate={{ scale: [1,1.15,1] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} className="text-[52px] leading-none">⚡</motion.div>
                <div>
                  <p className="text-xl font-black text-yellow-400 mb-1" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>AO VIVO</p>
                  <p className="text-[11px] font-bold text-white/40">Batalha em tempo real, simultânea.</p>
                </div>
                <motion.span animate={{ boxShadow: ['0 0 0px rgba(234,179,8,0)','0 0 18px rgba(234,179,8,0.5)','0 0 0px rgba(234,179,8,0)'] }} transition={{ duration: 2, repeat: Infinity }}
                  className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-yellow-300"
                  style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.5)' }}>Entrar →</motion.span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.28 }} className="flex flex-col gap-6">

            {/* Segment & Classes Selectors */}
            <div className="bg-gradient-to-br from-[#1e233d] via-[#111526] to-[#090b14] border border-[#2d3454] rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[80px] pointer-events-none" />
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4 relative z-10 flex items-center gap-2">
                <Filter size={12} /> Selecione o Segmento e a Turma
              </p>
              
              {/* Segments Tabs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                {SEGMENTS.map(seg => {
                  const active = segment === seg.id;
                  return (
                    <motion.button key={seg.id} whileTap={{ scale: 0.96 }} onClick={() => setSegment(seg.id)}
                      className={cn("flex flex-col items-center justify-center gap-2 p-4 rounded-[1.25rem] font-black text-sm transition-all border-2", 
                        active ? `border-transparent bg-gradient-to-br from-indigo-500/30 to-purple-500/10 text-indigo-200 shadow-[0_0_25px_rgba(99,102,241,0.25)]` : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10")}
                        style={active ? { borderColor: seg.color } : {}}>
                      <seg.Icon size={20} style={active ? { color: seg.color } : {}} />
                      {seg.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Specific Classes Filters (Sub-tabs) */}
              <AnimatePresence>
                {segment !== 'minha_turma' && availableClassesForSegment.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 16 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="relative z-10">
                    <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
                      <button onClick={() => setSelectedClassFilter('all')}
                        className={cn("shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border", selectedClassFilter === 'all' ? "bg-indigo-500/30 text-indigo-200 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10")}>
                        Todas as Turmas
                      </button>
                      {availableClassesForSegment.map(c => (
                        <button key={c.id} onClick={() => setSelectedClassFilter(c.id)}
                          className={cn("shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border", selectedClassFilter === c.id ? "bg-indigo-500/30 text-indigo-200 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10")}>
                          {c.name || c.grade}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Random search & Text Search */}
              <div className="flex flex-col md:flex-row gap-3 items-center mt-6 pt-6 border-t border-white/5 relative z-10">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={triggerRandomSearch} disabled={searchPhase !== 'idle' || allStudents.length === 0}
                  className={cn("w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-[1.25rem] border font-black text-sm transition-all uppercase tracking-wider", 
                    searchPhase === 'idle' && allStudents.length > 0 ? "border-indigo-400/50 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]" : "border-white/5 bg-black/40 text-white/20 cursor-not-allowed")}
                  style={{ fontFamily: "'Rajdhani',sans-serif" }}>
                  <Shuffle size={16} className={searchPhase !== 'idle' ? "animate-spin" : ""} /> Aleatório
                </motion.button>
                <div className="relative flex-1 w-full">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar aluno por nome..."
                    className="w-full pl-11 pr-4 py-3.5 rounded-[1.25rem] bg-black/20 border border-white/5 text-white text-sm font-bold outline-none focus:border-indigo-500/40 focus:bg-white/5 transition-all placeholder:text-white/20" />
                  {filteredStudents.length > 0 && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      {filteredStudents.length} ALUNOS
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Opponent CTA */}
            <AnimatePresence>
              {opponent && (
                <motion.div initial={{ opacity: 0, y: -20, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -20, height: 0 }}
                  className="rounded-[2rem] overflow-hidden bg-gradient-to-r from-indigo-950 to-purple-950 border border-indigo-500/40 shadow-[0_10px_40px_rgba(99,102,241,0.3)] p-5 flex flex-col md:flex-row items-center gap-5">
                  <div className="shrink-0 relative">
                    <div className="absolute -inset-2 bg-indigo-500/20 rounded-[1.5rem] animate-pulse pointer-events-none" />
                    <StudentAvatarMini studentId={opponent.id} fallbackAvatarUrl={opponent.avatar} fallbackInitial={opponent.name?.[0]||'?'} size={80} shape="2xl" className="ring-2 ring-indigo-400 ring-offset-4 ring-offset-[#1e1b4b]" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">Oponente Selecionado</p>
                    <p className="text-2xl font-black text-white leading-tight mb-2" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{opponent.name}</p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      {opponent.grade && <span className="text-[11px] font-bold text-white/50 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">{opponent.grade}</span>}
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-md" style={{ background: oppTier.bg, color: oppTier.color }}>{oppTier.emoji} {oppTier.label}</span>
                      {(oppSt.xp||0) > 0 && <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-yellow-500/10 text-yellow-500">⚡ {(oppSt.xp||0).toLocaleString()} XP</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-center">
                    <button onClick={() => setOpponent(null)} className="text-xs font-black text-white/40 hover:text-white/80 transition-colors uppercase px-3 py-2">Trocar</button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setStep(2)}
                      className="flex items-center gap-2 bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-[#022c22] px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(74,222,128,0.4)] transition-all">
                      Avançar <ArrowRight size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Opponent Grid */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-indigo-400" />
                  <span className="text-sm font-black text-white uppercase tracking-widest" style={{ fontFamily: "'Rajdhani',sans-serif" }}>Grid de Alunos</span>
                </div>
                {loadingStudents && <div className="animate-spin w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />}
              </div>
              
              <div className="bg-gradient-to-br from-[#1e233d] via-[#111526] to-[#090b14] border border-[#2d3454] rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] min-h-[300px] relative overflow-hidden">
                <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-500/10 blur-[100px] pointer-events-none" />
                <div className="relative z-10">
                  {loadingStudents ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="animate-pulse h-[160px] rounded-[1.5rem] bg-white/5" />)}
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-3xl">🧩</div>
                    <div>
                      <p className="text-base font-black text-white uppercase tracking-widest mb-1" style={{ fontFamily: "'Rajdhani',sans-serif" }}>Nenhum Aluno Encontrado</p>
                      <p className="text-sm font-bold text-white/40">Tente buscar em outro segmento ou turma.</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredStudents.map((s, i) => {
                      const sel = opponent?.id === s.id;
                      const st  = statsMap[s.id] || {};
                      const tier = getTier(st.total_wins);
                      return (
                        <motion.button key={s.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i*0.02, type:'spring', damping:20 }}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setOpponent(sel ? null : s)}
                          className={cn("relative p-4 rounded-[1.5rem] flex flex-col items-center gap-3 transition-all border-2 text-center",
                            sel ? "bg-indigo-500/15 border-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.25)]" : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10")}>
                          <div className="relative">
                            <StudentAvatarMini studentId={s.id} fallbackInitial={s.name?.[0] || '?'} size={64} shape="2xl" className={cn(sel ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#080d24]" : "")} />
                            {sel && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-indigo-500 border-2 border-[#0c1230] flex items-center justify-center z-10 shadow-lg">
                                <CheckCircle2 size={12} className="text-white" />
                              </motion.div>
                            )}
                          </div>
                          <div>
                            <p className="font-black text-[13px] text-white overflow-hidden text-ellipsis whitespace-nowrap w-[100px] mb-1" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{s.name.split(' ')[0]} {s.name.split(' ')[1]?.[0]??""}.</p>
                            <p className="text-[10px] font-bold text-white/40 mb-2 truncate">{s.grade || 'Aluno'}</p>
                            <span className="text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider block mx-auto" style={{ background: tier.bg, color: tier.color, width: 'fit-content' }}>{tier.emoji} {tier.label}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════ STEP 2 ══════════════════ */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.28 }} className="flex flex-col gap-4">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              
              {/* ── COL 1: THEMES & BALANCE ── */}
              <div className="flex flex-col gap-4">
                <div className="bg-[#0b1021] rounded-[2rem] p-5 relative overflow-hidden flex flex-col shadow-xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] pointer-events-none" />
                  <p className="text-[12px] font-black text-[#94a3b8] uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10"><Star size={16} className="text-yellow-400" strokeWidth={2.5} /> Tema da Batalha</p>
                  <div className="grid grid-cols-3 gap-2.5 relative z-10">
                    {THEMES.map(t => {
                      const active = theme === t.id;
                      return (
                        <motion.button key={t.id} whileTap={{ scale: 0.94 }} onClick={() => setTheme(t.id)}
                          className={cn("flex flex-col items-center justify-center gap-2 p-3 aspect-square rounded-[1.25rem] border-[2px] transition-all relative overflow-hidden",
                            active ? `bg-[#1a2035] border-transparent shadow-[0_4px_15px_rgba(0,0,0,0.4)]` : "bg-[#161b2c] border-transparent hover:bg-[#1a2035]")}
                          style={active ? { borderColor: t.color, boxShadow: `0 0 12px ${t.color}20` } : {}}>
                          <div className="flex items-center justify-center relative z-10 transition-colors">
                            <t.Icon size={26} style={{ color: active ? t.color : '#475569' }} strokeWidth={1.5} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.05em] text-center leading-tight relative z-10 break-words" style={{ color: active ? t.color : '#64748b' }}>{t.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Balance panel (moved below themes for better layout balance) */}
                {opponent && studentGrade && balanceStatus && (
                  <div className="bg-[#0b1021] rounded-[2rem] p-5 shadow-xl flex flex-col gap-1.5 relative overflow-hidden">
                    <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest flex items-center gap-2">
                       <span className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ backgroundColor: `${balanceStatus.color}20`, border: `1px solid ${balanceStatus.color}40`, color: balanceStatus.color }}>⚖️</span>
                       IA de Balanceamento Automático
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs border border-transparent bg-[#161b2c] p-1 rounded-md">{balanceStatus.icon}</span>
                      <span className="font-black text-[14px] uppercase tracking-wider" style={{ color: balanceStatus.color, fontFamily: "'Rajdhani',sans-serif" }}>{balanceStatus.label}</span>
                    </div>
                    <p className="text-[11px] font-bold text-[#64748b] leading-tight mt-1">
                      Séries de níveis diferentes. A IA usará a menor série como base. Ajustado para:{' '}
                      <span className="font-black text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-md ml-1 inline-block mt-1">{balancedGrade || studentGrade}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* ── COL 2: DIFFICULTY & REWARDS ── */}
              <div className="flex flex-col gap-4">

                <div className="bg-[#0b1021] rounded-[2rem] p-5 relative overflow-hidden shadow-xl flex flex-col h-full">
                  <p className="text-[12px] font-black text-[#94a3b8] uppercase tracking-widest mb-4 flex items-center gap-2"><Target size={16} className="text-red-400" strokeWidth={2.5} /> Intensidade do Duelo</p>
                  <div className="flex flex-col gap-2.5 flex-1 justify-between">
                    {DIFFS.map(d => {
                      const active = difficulty === d.id;
                      return (
                        <motion.button key={d.id} whileTap={{ scale: 0.98 }} onClick={() => setDifficulty(d.id)}
                          className={cn("flex items-center gap-4 p-4 rounded-[1.25rem] border-[2px] transition-all text-left relative overflow-hidden",
                            active ? `bg-[#1a2035] border-transparent shadow-[0_4px_15px_rgba(0,0,0,0.4)]` : "bg-[#161b2c] border-transparent hover:bg-[#1a2035]")}
                          style={active ? { borderColor: d.color, boxShadow: `0 0 12px ${d.color}20` } : {}}>
                          <div className="flex items-center justify-center shrink-0 relative z-10 transition-colors px-1">
                            <d.Icon size={26} style={{ color: d.color }} strokeWidth={1.5} />
                          </div>
                          <div className="flex-1 relative z-10">
                            <p className="font-black text-[14px] uppercase tracking-wider mb-0.5 transition-colors" style={{ color: active ? d.color : '#f1f5f9', fontFamily: "'Rajdhani',sans-serif" }}>{d.label}</p>
                            <p className="text-[11px] font-bold text-[#64748b] transition-colors line-clamp-1">{d.desc}</p>
                          </div>
                          <div className="text-right shrink-0 relative z-10 flex items-center pr-1">
                            {active && (
                              <div className="w-5 h-5 rounded-full border-[2px] flex items-center justify-center" style={{ borderColor: d.color }}>
                                <CheckCircle2 size={12} style={{ color: d.color }} strokeWidth={4} />
                              </div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#0b1021] rounded-[2rem] p-5 shadow-xl relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 text-[80px] opacity-[0.03] rotate-12 pointer-events-none select-none">🏆</div>
                  <div className="relative z-10">
                    <p className="text-[12px] font-black text-[#94a3b8] uppercase tracking-widest mb-3 flex items-center gap-2"><Trophy size={16} className="text-yellow-400" strokeWidth={2.5} /> Recompensas Estimadas</p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Vit.', emoji: '🏆', xp: r.winXP,  coins: r.winCoins,  color: '#f59e0b', active: true },
                        { label: 'Empate',  emoji: '🤝', xp: r.drawXP, coins: r.drawCoins, color: '#94a3b8', active: false },
                        { label: 'Derr.', emoji: '💔', xp: r.loseXP, coins: r.loseCoins, color: '#ef4444', active: false },
                      ].map(row => (
                        <div key={row.label} className={cn("rounded-[1rem] py-3.5 px-2 text-center transition-all flex flex-col items-center justify-center gap-0.5", row.active ? "bg-[#1a2035] shadow-[0_2px_10px_rgba(0,0,0,0.3)]" : "bg-[#161b2c]")}>
                          <span className="text-xl block mb-1 drop-shadow-md">{row.emoji}</span>
                          <p className="text-[9px] font-black text-[#64748b] uppercase tracking-widest leading-none">{row.label}</p>
                          <p className="font-black text-lg text-[#f1f5f9] leading-none mt-1 flex items-end gap-0.5 justify-center">{row.xp} <span className="text-[8px] text-[#64748b] mb-0.5">XP</span></p>
                          <p className="font-black text-[11px] mt-0.5 flex items-center gap-1 justify-center w-full" style={{ color: row.color }}>
                            <span className="bg-[#0b1021] p-0.5 rounded-full shadow-sm text-[8px]">🪙</span> {row.coins}
                          </p>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-[#161b2c] rounded-[1rem] p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">P. Máximo <Sparkles size={12} className="text-indigo-400" /></p>
                        <p className="text-[10px] font-bold text-[#64748b]">Aberto em <span className="text-[#f1f5f9]">{DIFFS.find(d=>d.id===difficulty)?.label}</span></p>
                      </div>
                      <div className="flex flex-col items-end gap-1 font-black">
                        <span className="text-[#f1f5f9] text-[18px] flex items-center gap-1 leading-none drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]"><Zap size={14} className="text-indigo-400" strokeWidth={3}/> {r.maxXP}</span>
                        <span className="text-yellow-400 text-[14px] flex items-center justify-end gap-1 w-full leading-none drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]">
                          <span className="bg-[#0b1021] p-0.5 rounded-full text-[10px] shadow-sm">🪙</span> {r.maxCoins}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
            </div> {/* End of grid columns */}

            {/* CTA Full Width */}
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} disabled={isSubmitting} onClick={handleCreate}
              className={cn("w-full py-4 rounded-[2rem] font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                isSubmitting ? "bg-[#1a2035] text-gray-500 cursor-not-allowed border-2 border-transparent" : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_4px_25px_rgba(79,70,229,0.3)] hover:shadow-[0_8px_35px_rgba(79,70,229,0.5)]")}
              style={{ fontFamily: "'Rajdhani',sans-serif" }}>
              {isSubmitting
                ? <><div className="animate-spin w-4 h-4 rounded-full border-2 border-gray-500 border-t-gray-300" /> Emitindo...</>
                : <><Swords size={20} className="text-white drop-shadow-md" /> Confirmar e Convocar Oponente</>}
            </motion.button>
            <button onClick={() => setStep(1)} className="mt-0 text-[10px] font-black text-[#64748b] uppercase tracking-widest mx-auto block hover:text-white transition-colors pb-6">← Voltar para seleção</button>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
