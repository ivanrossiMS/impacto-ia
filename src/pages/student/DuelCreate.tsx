import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import {
  ChevronLeft, Sparkles, Users, BookOpen, Book, GraduationCap,
  Search, CheckCircle2, Trophy, Zap, Swords, Brain,
  Shield, Globe, Shuffle, Palette, Atom, Dumbbell,
  User, BookMarked, ArrowRight, Target, Star, Tv,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DuelService } from '../../services/duel.service';
import type { DuelTheme, DuelDifficulty } from '../../types/duel';
import { toast } from 'sonner';
import { calcDuelRewards } from '../../lib/duelRewards';
import { StudentAvatarMini } from '../../components/ui/StudentAvatarMini';

// ─── Grade Balancing Logic (unchanged) ──────────────────────────────────────
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
  { id: 'historia',       label: 'História',    Icon: BookMarked, color: '#a78bfa', bg: 'rgba(167,139,250,0.13)' },
  { id: 'geografia',      label: 'Geografia',   Icon: Globe,      color: '#38bdf8', bg: 'rgba(56,189,248,0.13)'  },
  { id: 'ciencias',       label: 'Ciências',    Icon: Atom,       color: '#4ade80', bg: 'rgba(74,222,128,0.13)'  },
  { id: 'arte',           label: 'Arte',        Icon: Palette,    color: '#f472b6', bg: 'rgba(244,114,182,0.13)' },
  { id: 'esportes',       label: 'Esportes',    Icon: Dumbbell,   color: '#fb923c', bg: 'rgba(251,146,60,0.13)'  },
  { id: 'entretenimento', label: 'TV/Séries',   Icon: Tv,         color: '#c084fc', bg: 'rgba(192,132,252,0.13)' },
  { id: 'logica',         label: 'Lógica',      Icon: Brain,      color: '#60a5fa', bg: 'rgba(96,165,250,0.13)'  },
  { id: 'quem_sou_eu',    label: 'Quem Sou Eu?',Icon: User,       color: '#f9a8d4', bg: 'rgba(249,168,212,0.13)' },
  { id: 'aleatorio',      label: 'Aleatório',   Icon: Shuffle,    color: '#fbbf24', bg: 'rgba(251,191,36,0.18)'  },
];

const DIFFS = [
  { id: 'easy'   as DuelDifficulty, label: 'Iniciante', Icon: Shield, desc: 'Questões adaptadas ao nível mais baixo.', xp: '+60 XP',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.35)',  glow: 'rgba(74,222,128,0.25)'  },
  { id: 'medium' as DuelDifficulty, label: 'Médio',     Icon: Zap,    desc: 'Balanço entre desafio e aprendizado.',   xp: '+75 XP',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.35)',  glow: 'rgba(251,191,36,0.25)'  },
  { id: 'hard'   as DuelDifficulty, label: 'Mestre',    Icon: Swords, desc: 'Para os mais corajosos. Alto desafio.',  xp: '+100 XP', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.35)', glow: 'rgba(248,113,113,0.25)' },
];

const LOADING_MSGS = [
  '🤖 IA criando perguntas personalizadas...',
  '⚖️ Calibrando o nível do duelo...',
  '🎯 Selecionando questões na dificuldade certa...',
  '⚡ Quase pronto! Preparando o desafio...',
  '🧠 Gerando alternativas inteligentes...',
];

const RotatingMessages: React.FC = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(p => (p + 1) % LOADING_MSGS.length), 2500); return () => clearInterval(t); }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.p key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3 }} style={{ color: '#a5b4fc', fontWeight: 700, fontSize: 13 }}>
        {LOADING_MSGS[idx]}
      </motion.p>
    </AnimatePresence>
  );
};

// ─── Dark card style helpers ──────────────────────────────────────────────────
const CARD = { background: 'linear-gradient(160deg,#080e24 0%,#0b1230 100%)', border: '1px solid rgba(255,255,255,0.07)' };
const LABEL_STYLE = { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const };

// ─── Main Component ──────────────────────────────────────────────────────────
export const DuelCreate: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [opponent,        setOpponent]        = useState<any>(null);
  const [theme,           setTheme]           = useState<DuelTheme>('aleatorio');
  const [difficulty,      setDifficulty]      = useState<DuelDifficulty>('medium');
  const questionCount = 10 as const;  // 10+1 swap reserve = 11 sent to AI
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [studentGrade,    setStudentGrade]    = useState('');
  const [segment,         setSegment]         = useState<'minha_turma'|'fund1'|'fund2'|'ens_medio'>('minha_turma');
  const [students,        setStudents]        = useState<any[]>([]);
  const [statsMap,        setStatsMap]        = useState<Record<string, any>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [step,            setStep]            = useState<1|2>(1);
  const [search,          setSearch]          = useState('');
  // ── Random search ──────────────────────────────────────────────
  type SearchPhase = 'idle' | 'scanning' | 'matched' | 'revealed';
  const [searchPhase,   setSearchPhase]   = useState<SearchPhase>('idle');
  const [foundOpponent, setFoundOpponent] = useState<any>(null);
  const autoTriggered = useRef(false);
  const location = useLocation();
  const isAutoMode = new URLSearchParams(location.search).get('auto') === '1';

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingStudents(true);
      try {
        const { data: me } = await supabase.from('users').select('classId, schoolId, grade').eq('id', user.id).single();
        if (me?.grade) setStudentGrade(me.grade);
        let list: any[] = [];
        if (segment === 'minha_turma') {
          if (me?.classId) { const { data } = await supabase.from('users').select('*').eq('classId', me.classId).eq('role', 'student').neq('id', user.id); list = data || []; }
        } else {
          const { data: all } = await supabase.from('users').select('*').eq('schoolId', me?.schoolId || '').eq('role', 'student').neq('id', user.id);
          const { data: cls } = await supabase.from('classes').select('id, grade').eq('schoolId', me?.schoolId || '');
          const cgMap: Record<string, string> = {};
          (cls || []).forEach(c => { if (c.grade) cgMap[c.id] = c.grade; });
          list = (all || []).filter(s => isGradeInSegment(s.grade, segment) || (s.classId && isGradeInSegment(cgMap[s.classId], segment)));
        }
        setStudents(list);
        // Only query stats when there are actual students to show — avoids 400 on gamification_stats when list is empty
        if (list.length > 0) {
          const statsIds = [...list.map(s => s.id), user.id];
          const [{ data: stats }, { data: winRows }] = await Promise.all([
            supabase.from('gamification_stats').select('id, xp, streak').in('id', statsIds),
            supabase.from('duels').select('winnerId').eq('status', 'completed').in('winnerId', statsIds),
          ]);
          // Build win-count map from completed duels
          const winsMap: Record<string, number> = {};
          (winRows || []).forEach((d: any) => {
            if (d.winnerId && d.winnerId !== 'draw') winsMap[d.winnerId] = (winsMap[d.winnerId] || 0) + 1;
          });
          const map: Record<string, any> = {};
          (stats || []).forEach((st: any) => { map[st.id] = { ...st, total_wins: winsMap[st.id] || 0 }; });
          setStatsMap(map);
        }
      } catch (e) { console.error(e); }
      finally { setLoadingStudents(false); }
    };
    load();
  }, [user?.id, segment]);

  // ── Smart matchmaking (school-wide, async) ────────────────
  const triggerRandomSearch = async () => {
    if (!user) return;
    setSearchPhase('scanning');
    setFoundOpponent(null);
    const startTime = Date.now();
    try {
      // Fetch all school students regardless of current segment
      const { data: me } = await supabase.from('users').select('classId, schoolId, grade').eq('id', user.id).single();
      const myClassId  = me?.classId  || '';
      const mySchoolId = me?.schoolId || '';
      const myGrade    = me?.grade    || studentGrade;

      const { data: allStudents } = await supabase.from('users')
        .select('id, name, avatar, grade, classId')
        .eq('schoolId', mySchoolId)
        .eq('role', 'student')
        .neq('id', user.id);

      const pool = allStudents || [];
      if (pool.length === 0) {
        setSearchPhase('idle');
        toast.error('Nenhum aluno encontrado na escola.');
        return;
      }

      // Fetch stats for pool + wins from duels table
      const poolIds = pool.map(s => s.id);
      const allIds = [...poolIds, user.id];
      const [{ data: statsRows }, { data: winRows2 }] = await Promise.all([
        supabase.from('gamification_stats').select('id, xp, streak').in('id', allIds),
        supabase.from('duels').select('winnerId').eq('status', 'completed').in('winnerId', allIds),
      ]);
      const winsMap2: Record<string, number> = {};
      (winRows2 || []).forEach((d: any) => {
        if (d.winnerId && d.winnerId !== 'draw') winsMap2[d.winnerId] = (winsMap2[d.winnerId] || 0) + 1;
      });
      const poolStats: Record<string, any> = { ...statsMap };
      (statsRows || []).forEach((st: any) => { poolStats[st.id] = { ...st, total_wins: winsMap2[st.id] || 0 }; });

      // 4-tier smart matching
      const myWins      = poolStats[user.id]?.total_wins || 0;
      const myTierLabel = getTier(myWins).label;
      const myGW        = getGradeWeight(myGrade);

      const p1 = pool.filter(s => s.classId === myClassId && getTier(poolStats[s.id]?.total_wins || 0).label === myTierLabel);
      const p2 = pool.filter(s => getTier(poolStats[s.id]?.total_wins || 0).label === myTierLabel);
      const p3 = pool.filter(s => Math.abs(getGradeWeight(s.grade || '') - myGW) <= 2);
      const ranked = p1.length > 0 ? p1 : p2.length > 0 ? p2 : p3.length > 0 ? p3 : pool;
      const pick   = ranked[Math.floor(Math.random() * ranked.length)];

      // Ensure minimum 2.5s of scanning animation before revealing
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
      console.error(e);
      setSearchPhase('idle');
      toast.error('Erro ao buscar oponente. Tente novamente.');
    }
  };

  // ── Auto-trigger when navigated with ?auto=1 ─────────────
  useEffect(() => {
    if (isAutoMode && !autoTriggered.current && !loadingStudents) {
      autoTriggered.current = true;
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
  const balancedGrade = opponent && studentGrade
    ? (getGradeWeight(studentGrade) <= getGradeWeight(opponent.grade) ? studentGrade : opponent.grade)
    : studentGrade;

  const filtered = useMemo(() =>
    search.trim() ? students.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) : students,
    [students, search],
  );

  const activeTheme = THEMES.find(t => t.id === theme)!;
  const activeDiff  = DIFFS.find(d => d.id === difficulty)!;
  const oppSt       = opponent ? (statsMap[opponent.id] || {}) : {};
  const oppTier     = getTier(oppSt.total_wins);

  const mw = getGradeWeight(studentGrade), ow = getGradeWeight(opponent?.grade || '');
  const balanceStatus = !opponent ? null
    : Math.abs(mw - ow) === 0 ? { label: 'Equilíbrio Perfeito', color: '#4ade80', icon: '✅' }
    : Math.abs(mw - ow) <= 2  ? { label: 'Levemente Desafiador', color: '#fbbf24', icon: '⚡' }
    : { label: 'Alto Desafio', color: '#f87171', icon: '🔥' };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px 96px' }}>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.9)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 18 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center', padding: '0 32px' }}>
              <div style={{ position: 'relative', width: 112, height: 112 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.2)' }} />
                <div className="animate-spin" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#818cf8', borderRightColor: '#a855f7' }} />
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                  style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>🧠</motion.div>
              </div>
              <div>
                <h2 style={{ color: '#fff', fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 24, marginBottom: 8 }}>Gerando o Duelo</h2>
                <RotatingMessages />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0,1,2].map(i => <motion.div key={i} animate={{ opacity:[0.3,1,0.3], scale:[0.8,1,0.8] }} transition={{ repeat: Infinity, duration: 1.2, delay: i*0.3 }} style={{ width: 8, height: 8, borderRadius: '50%', background: '#818cf8' }} />)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CINEMATIC RANDOM SEARCH OVERLAY ── */}
      <AnimatePresence>
        {searchPhase !== 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,4,20,0.97)', backdropFilter: 'blur(12px)' }}>

            {/* Background grid texture */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(99,102,241,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.05) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

            {searchPhase !== 'revealed' ? (
              /* ─── SCANNING ─── */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, textAlign: 'center', padding: '0 32px', zIndex: 1 }}>
                {/* Radar rings */}
                <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {[0,1,2].map(i => (
                    <motion.div key={i}
                      animate={{ scale: [0.4, 2.2], opacity: [0.8, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.72, ease: 'easeOut' }}
                      style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.7)' }} />
                  ))}
                  {/* Scan beam */}
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', width: 90, height: 2, left: '50%', top: '50%', transformOrigin: '0 50%', background: 'linear-gradient(90deg,rgba(99,102,241,0.9),transparent)', borderRadius: 4 }} />
                  {/* Center dot */}
                  <motion.div animate={{ scale: [1, 1.25, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: 'radial-gradient(circle,#818cf8,#6366f1)', boxShadow: '0 0 28px rgba(99,102,241,0.9)', zIndex: 2 }} />
                </div>
                {/* Text */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <motion.h2
                    animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.4, repeat: Infinity }}
                    style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 28, color: '#fff', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {searchPhase === 'matched' ? 'OPONENTE ENCONTRADO!' : 'BUSCANDO OPONENTE...'}
                  </motion.h2>
                  <p style={{ color: 'rgba(99,102,241,0.8)', fontWeight: 700, fontSize: 13 }}>
                    {searchPhase === 'matched' ? '✅ Correspondência perfeita localizada!' : '🎯 Analisando tier, nível e turma...'}
                  </p>
                </div>
                {/* Floating name chips cycling */}
                {searchPhase === 'scanning' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 340 }}>
                    {students.slice(0, 6).map((s, i) => (
                      <motion.div key={s.id}
                        animate={{ opacity: [0, 1, 0], y: [8, 0, -8] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
                        style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'rgba(165,180,252,0.8)', fontSize: 11, fontWeight: 800 }}>
                        {s.name.split(' ')[0]}
                      </motion.div>
                    ))}
                  </div>
                )}
                {/* Abort */}
                <button onClick={() => { setSearchPhase('idle'); setFoundOpponent(null); }}
                  style={{ marginTop: 8, fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.25)', background: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: 10, cursor: 'pointer', letterSpacing: '0.08em' }}>
                  CANCELAR
                </button>
              </div>
            ) : (
              /* ─── REVEALED ─── */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, zIndex: 1 }}>
                {/* VS FOUND banner */}
                <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.div animate={{ opacity: [0.6,1,0.6], scale: [1,1.06,1] }} transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 14, color: '#4ade80', letterSpacing: '0.25em', textTransform: 'uppercase' }}>Oponente Localizado!</span>
                  <motion.div animate={{ opacity: [0.6,1,0.6], scale: [1,1.06,1] }} transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                </motion.div>

                {/* Opponent card — cinematic */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0, y: 40 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 48px', borderRadius: 32,
                    background: 'linear-gradient(160deg,rgba(12,18,48,0.98),rgba(20,10,40,0.98))',
                    border: '1.5px solid rgba(99,102,241,0.5)',
                    boxShadow: '0 0 60px rgba(99,102,241,0.35), 0 32px 80px rgba(0,0,0,0.6)' }}>
                  {/* Avatar glow ring */}
                  <div style={{ position: 'relative' }}>
                    <motion.div animate={{ opacity: [0.4,0.9,0.4], scale: [1,1.12,1] }} transition={{ duration: 1.8, repeat: Infinity }}
                      style={{ position: 'absolute', inset: -8, borderRadius: 24, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', pointerEvents: 'none' }} />
                    <StudentAvatarMini studentId={foundOpponent?.id || ''} fallbackAvatarUrl={foundOpponent?.avatar} fallbackInitial={foundOpponent?.name?.[0] || '?'} size={120} shape="2xl" />
                  </div>
                  {/* Name + info */}
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 26, color: '#fff', marginBottom: 4 }}>
                      {foundOpponent?.name?.split(' ').slice(0, 2).join(' ')}
                    </h3>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>{foundOpponent?.grade || 'Aluno'}</p>
                    {(() => { const st = statsMap[foundOpponent?.id] || {}; const t = getTier(st.total_wins); return (
                      <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 12, background: t.bg, color: t.color }}>{t.emoji} {t.label}</span>
                    ); })()}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(99,102,241,0.8)' }}>⚡ Preparando configuração do duelo...</p>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        style={{ ...CARD, borderRadius: 28, overflow: 'hidden', marginBottom: 20, marginTop: 8, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#020617 0%,#0f0a2e 50%,#1a0533 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle,#6366f1,transparent)', filter: 'blur(50px)', opacity: 0.3, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle,#a855f7,transparent)', filter: 'blur(50px)', opacity: 0.2, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <button onClick={() => navigate('/student/duels')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, padding: 0 }}>
                <ChevronLeft size={13} /> Voltar para Duelos
              </button>
              <h1 style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 34, color: '#fff', lineHeight: 1, marginBottom: 6 }}>
                Criar{' '}
                <span style={{ background: 'linear-gradient(90deg,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Desafio</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: 600 }}>
                {step === 1 ? 'Escolha seu adversário para o duelo' : 'Configure as regras da batalha'}
              </p>
            </div>
            <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
              style={{ fontSize: 64, opacity: 0.12, lineHeight: 1, flexShrink: 0, marginLeft: 16, userSelect: 'none' }}>⚔️</motion.div>
          </div>

          {/* Step progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
            {([1, 2] as const).map((s, i) => {
              const active = step === s;
              const done   = s < step;
              return (
                <React.Fragment key={s}>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (s === 1 || opponent) setStep(s); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 16, fontWeight: 900, fontSize: 12, cursor: 'pointer', border: `1px solid ${active ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.08)'}`, background: active ? 'rgba(99,102,241,0.85)' : 'rgba(255,255,255,0.05)', color: active ? '#fff' : 'rgba(255,255,255,0.4)', boxShadow: active ? '0 0 18px rgba(99,102,241,0.4)' : 'none', transition: 'all 0.2s' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, background: active ? '#fff' : done ? '#4ade80' : 'rgba(255,255,255,0.15)', color: active ? '#6366f1' : done ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                      {done ? <CheckCircle2 size={11} /> : s}
                    </div>
                    {s === 1 ? '⚔️ Oponente' : '⚙️ Configurar'}
                  </motion.button>
                  {i === 0 && <div style={{ flex: 1, height: 1, background: opponent ? 'linear-gradient(90deg,rgba(99,102,241,0.6),rgba(168,85,247,0.3))' : 'rgba(255,255,255,0.07)' }} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ══════════════════ STEP 1 ══════════════════ */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.28 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Segment chips */}
            <div style={{ ...CARD, borderRadius: 24, padding: 16 }}>
              <p style={{ ...LABEL_STYLE, display: 'block', marginBottom: 10 }}>Buscar por segmento</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {SEGMENTS.map(seg => {
                  const active = segment === seg.id;
                  return (
                    <motion.button key={seg.id} whileTap={{ scale: 0.96 }} onClick={() => { setSegment(seg.id); setOpponent(null); setSearch(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: 'pointer', border: `1.5px solid ${active ? seg.color : 'rgba(255,255,255,0.07)'}`, background: active ? seg.glow : 'rgba(255,255,255,0.03)', color: active ? seg.color : 'rgba(255,255,255,0.45)', boxShadow: active ? `0 0 14px ${seg.glow}` : 'none', transition: 'all 0.2s' }}>
                      <seg.Icon size={15} /> {seg.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Random search button + search bar */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <motion.button whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(34,211,238,0.45)' }} whileTap={{ scale: 0.96 }}
                onClick={triggerRandomSearch} disabled={searchPhase !== 'idle'}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 16,
                  border: '1px solid rgba(129,140,248,0.4)',
                  background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 55%, #a855f7 100%)',
                  color: '#fff', fontWeight: 900, fontSize: 13, cursor: searchPhase !== 'idle' ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  boxShadow: '0 0 18px rgba(129,140,248,0.35), 0 4px 14px rgba(0,0,0,0.25)',
                  opacity: searchPhase !== 'idle' ? 0.6 : 1, letterSpacing: '0.04em',
                  fontFamily: "'Rajdhani',sans-serif" }}>
                <motion.span animate={{ rotate: [0,360] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-flex' }}>⚡</motion.span>
                Aleatório
              </motion.button>
              <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aluno por nome..."
                style={{ width: '100%', padding: '12px 44px 12px 38px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              {filtered.length > 0 && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                  {filtered.length} alunos
                </span>
              )}
              </div>
            </div>

            {/* Opponent grid */}
            <div style={{ ...CARD, borderRadius: 24, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={14} style={{ color: '#818cf8' }} />
                <span style={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>Escolha seu Oponente</span>
                {loadingStudents && <div className="animate-spin" style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#818cf8' }} />}
              </div>
              <div style={{ padding: 14, maxHeight: 360, overflowY: 'auto' }}>
                {loadingStudents ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[1,2,3,4,5,6].map(i => <div key={i} className="animate-pulse" style={{ height: 130, borderRadius: 16, background: 'rgba(255,255,255,0.05)' }} />)}
                  </div>
                ) : filtered.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '48px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 36 }}>🔍</span>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 14 }}>{search ? `Nenhum aluno com "${search}"` : 'Nenhum aluno neste segmento'}</p>
                    {search && <button onClick={() => setSearch('')} style={{ fontSize: 11, fontWeight: 900, padding: '6px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: 'none', cursor: 'pointer' }}>Limpar busca</button>}
                  </motion.div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {filtered.map((s, i) => {
                      const sel = opponent?.id === s.id;
                      const st  = statsMap[s.id] || {};
                      const tier = getTier(st.total_wins);
                      return (
                        <motion.button key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i*0.03 }}
                          whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setOpponent(sel ? null : s)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 10, borderRadius: 18, cursor: 'pointer', border: `1.5px solid ${sel ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.06)'}`, background: sel ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.03)', boxShadow: sel ? '0 0 18px rgba(99,102,241,0.25)' : 'none', transition: 'all 0.15s' }}>
                          <div style={{ position: 'relative' }}>
                            <StudentAvatarMini
                              studentId={s.id}
                              fallbackInitial={s.name?.[0] || '?'}
                              size={80}
                              shape="2xl"
                              className={sel ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-transparent' : ''}
                            />
                            {sel && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
                              style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#6366f1', border: '2px solid #080e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle2 size={10} color="#fff" />
                            </motion.div>}
                          </div>
                          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 12, color: sel ? '#c7d2fe' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>{s.name.split(' ')[0]}</p>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{s.grade || 'Aluno'}</p>
                          <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 8, background: tier.bg, color: tier.color }}>{tier.emoji} {tier.label}</span>
                          {(st.xp || 0) > 0 && <span style={{ fontSize: 9, fontWeight: 900, color: '#fbbf24' }}>⚡{(st.xp||0).toLocaleString()} XP</span>}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Selected CTA */}
            <AnimatePresence>
              {opponent && (
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
                  style={{ borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)', border: '1px solid rgba(99,102,241,0.45)', boxShadow: '0 8px 32px rgba(99,102,241,0.25)', padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>
                    {opponent.avatar ? <img src={opponent.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🧑‍🎓</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(165,180,252,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 3 }}>Oponente selecionado</p>
                    <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 18, color: '#fff', lineHeight: 1.1 }}>{opponent.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      {opponent.grade && <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>{opponent.grade}</span>}
                      <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 8, background: oppTier.bg, color: oppTier.color }}>{oppTier.emoji} {oppTier.label}</span>
                      {(oppSt.xp||0) > 0 && <span style={{ fontSize: 10, fontWeight: 900, color: '#fbbf24' }}>⚡{(oppSt.xp||0).toLocaleString()} XP</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} onClick={() => setStep(2)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 14, fontWeight: 900, fontSize: 13, background: '#fff', color: '#4338ca', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,255,255,0.2)' }}>
                      Avançar <ArrowRight size={14} />
                    </motion.button>
                    <button onClick={() => setOpponent(null)} style={{ fontSize: 10, fontWeight: 900, padding: '6px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer' }}>Trocar</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ══════════════════ STEP 2 ══════════════════ */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.28 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Opponent summary */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ ...CARD, borderRadius: 20, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {opponent && (
                <StudentAvatarMini
                  studentId={opponent.id}
                  fallbackInitial={opponent?.name?.[0] || '?'}
                  size={64}
                  shape="2xl"
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Desafiando</p>
                <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 16, color: '#fff' }}>{opponent?.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {opponent?.grade && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>{opponent.grade}</span>}
                  <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 8, background: oppTier.bg, color: oppTier.color }}>{oppTier.emoji} {oppTier.label}</span>
                </div>
              </div>
              <button onClick={() => setStep(1)} style={{ fontSize: 11, fontWeight: 900, padding: '6px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>Trocar →</button>
            </motion.div>

            {/* Theme selector */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
              style={{ ...CARD, borderRadius: 24, padding: 16 }}>
              <p style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Star size={11} style={{ color: '#fbbf24' }} /> Tema do Duelo
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
            </motion.div>

            {/* Difficulty */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={{ ...CARD, borderRadius: 24, padding: 16 }}>
              <p style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Target size={11} style={{ color: '#f87171' }} /> Nível de Dificuldade
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DIFFS.map(d => {
                  const active = difficulty === d.id;
                  return (
                    <motion.button key={d.id} whileTap={{ scale: 0.97 }} onClick={() => setDifficulty(d.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, cursor: 'pointer', border: `1.5px solid ${active ? d.border : 'rgba(255,255,255,0.07)'}`, background: active ? d.bg : 'rgba(255,255,255,0.03)', boxShadow: active ? `0 0 16px ${d.glow}` : 'none', transition: 'all 0.15s', textAlign: 'left' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: active ? d.bg : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? d.border : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <d.Icon size={18} style={{ color: d.color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 900, fontSize: 14, color: active ? d.color : '#fff', marginBottom: 2 }}>{d.label}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{d.desc}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 900, color: d.color, flexShrink: 0 }}>{d.xp}</span>
                      {active && <CheckCircle2 size={16} style={{ color: d.color, flexShrink: 0 }} />}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Balance panel */}
            {opponent && studentGrade && balanceStatus && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
                style={{ ...CARD, borderRadius: 20, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⚖️</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Duelo Equilibrado pela IA</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12 }}>{balanceStatus.icon}</span>
                    <span style={{ fontWeight: 900, fontSize: 14, color: balanceStatus.color }}>{balanceStatus.label}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, lineHeight: 1.5 }}>
                    Séries diferentes? A IA usa a menor série como referência. Nível do duelo:{' '}
                    <span style={{ fontWeight: 900, color: '#818cf8', background: 'rgba(99,102,241,0.2)', padding: '1px 8px', borderRadius: 8 }}>{balancedGrade || studentGrade}</span>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Rewards */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              style={{ borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(160deg,#0c1533,#0f0a2e,#1a0533)', border: '1px solid rgba(255,255,255,0.08)', padding: 20, position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, fontSize: 100, opacity: 0.04, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>🏆</div>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Trophy size={16} style={{ color: '#fbbf24' }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Recompensas do Duelo</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: '🏆 Vitória', xp: r.winXP,  coins: r.winCoins,  hi: true  },
                    { label: '🤝 Empate',  xp: r.drawXP, coins: r.drawCoins, hi: false },
                    { label: '💪 Derrota', xp: r.loseXP, coins: r.loseCoins, hi: false },
                  ].map(row => (
                    <div key={row.label} style={{ background: row.hi ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${row.hi ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: '12px 8px', textAlign: 'center' }}>
                      <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{row.label}</p>
                      <p style={{ fontWeight: 900, fontSize: 16, color: '#fff', marginBottom: 3 }}>{row.xp} XP</p>
                      <p style={{ fontWeight: 900, fontSize: 13, color: '#fbbf24' }}>🪙 {row.coins}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Por questão correta</span>
                  <div style={{ display: 'flex', gap: 14, fontWeight: 900 }}>
                    <span style={{ color: '#a5b4fc', fontSize: 13 }}>⚡ +{r.xpPerCorrect} XP</span>
                    <span style={{ color: '#fbbf24', fontSize: 13 }}>🪙 +{r.coinsPerCorrect}</span>
                  </div>
                </div>
                <div style={{ background: 'linear-gradient(90deg,#4338ca,#7c3aed)', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Máximo possível 🚀</p>
                    <div style={{ display: 'flex', gap: 16, fontWeight: 900 }}>
                      <span style={{ color: '#fff', fontSize: 20 }}>⚡ {r.maxXP} XP</span>
                      <span style={{ color: '#fbbf24', fontSize: 20 }}>🪙 {r.maxCoins}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 36 }}>🚀</span>
                </div>
              </div>
            </motion.div>

            {/* Summary card */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
              style={{ ...CARD, borderRadius: 20, padding: 16 }}>
              <p style={{ ...LABEL_STYLE, display: 'block', marginBottom: 12 }}>Resumo do desafio</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {[
                  { label: 'Oponente',    value: opponent?.name?.split(' ').slice(0,2).join(' '), icon: '⚔️' },
                  { label: 'Tema',        value: activeTheme.label,  icon: '🎯' },
                  { label: 'Dificuldade', value: activeDiff.label,   icon: '🛡️' },
                  { label: 'Questões',    value: `${questionCount} perguntas`, icon: '📝' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '10px 12px' }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{item.icon} {item.label}</p>
                    <p style={{ fontWeight: 900, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* CTA */}
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} disabled={isSubmitting} onClick={handleCreate}
              style={{ width: '100%', height: 60, borderRadius: 22, fontWeight: 900, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: isSubmitting ? 'not-allowed' : 'pointer', border: 'none', background: isSubmitting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(90deg,#4338ca,#7c3aed,#4338ca)', color: isSubmitting ? 'rgba(255,255,255,0.3)' : '#fff', boxShadow: isSubmitting ? 'none' : '0 8px 32px rgba(99,102,241,0.4)', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.05em', transition: 'box-shadow 0.2s' }}>
              {isSubmitting
                ? <><div className="animate-spin" style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'rgba(255,255,255,0.5)' }} /> Gerando Duelo...</>
                : <><Sparkles size={20} /> Lançar Desafio ⚔️</>}
            </motion.button>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
