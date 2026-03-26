import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import {
  Trophy, Sword, Clock, History, Zap, Play, X,
  Star, Globe, Check, BarChart2, Target,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Duel } from '../../types/duel';
import { StudentAvatarMini } from '../../components/ui/StudentAvatarMini';
import { DuelService } from '../../services/duel.service';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// TIER SYSTEM
// ═══════════════════════════════════════════════════════════════

export interface TierInfo {
  id: string;
  name: string;
  emoji: string;
  minWins: number;
  maxWins: number;
  gradient: string;
  text: string;
  border: string;
  glow: string;
  bg: string;
  motText: string;
}

export const TIERS: TierInfo[] = [
  { id:'bronze',      name:'Bronze',      emoji:'🥉', minWins:0,    maxWins:29,    gradient:'from-amber-800 to-orange-900',              text:'text-amber-400',   border:'border-amber-600/50',  glow:'rgba(180,83,9,0.55)',    bg:'rgba(120,53,15,0.25)',  motText:'Mostre do que você é capaz!' },
  { id:'prata',       name:'Prata',       emoji:'🥈', minWins:30,   maxWins:74,    gradient:'from-slate-500 to-slate-600',                text:'text-slate-300',   border:'border-slate-400/50',  glow:'rgba(148,163,184,0.45)', bg:'rgba(71,85,105,0.25)',  motText:'Continue crescendo!' },
  { id:'ouro',        name:'Ouro',        emoji:'🥇', minWins:75,   maxWins:149,   gradient:'from-yellow-500 to-amber-600',               text:'text-yellow-300',  border:'border-yellow-500/50', glow:'rgba(234,179,8,0.55)',   bg:'rgba(161,98,7,0.25)',   motText:'Você está brilhando!' },
  { id:'platina',     name:'Platina',     emoji:'💎', minWins:150,  maxWins:269,   gradient:'from-cyan-500 to-sky-600',                   text:'text-cyan-300',    border:'border-cyan-400/50',   glow:'rgba(34,211,238,0.55)',  bg:'rgba(8,145,178,0.25)',  motText:'Elite do conhecimento!' },
  { id:'diamante',    name:'Diamante',    emoji:'💠', minWins:270,  maxWins:449,   gradient:'from-blue-500 to-indigo-600',                text:'text-blue-300',    border:'border-blue-500/50',   glow:'rgba(96,165,250,0.55)',  bg:'rgba(30,64,175,0.25)',  motText:'Lendário em evolução!' },
  { id:'mestre',      name:'Mestre',      emoji:'👑', minWins:450,  maxWins:749,   gradient:'from-purple-500 to-violet-700',              text:'text-purple-300',  border:'border-purple-500/50', glow:'rgba(168,85,247,0.55)',  bg:'rgba(88,28,135,0.25)',  motText:'Mestre absoluto!' },
  { id:'grao_mestre', name:'Grão-Mestre', emoji:'⚔️', minWins:750,  maxWins:Infinity, gradient:'from-red-600 via-orange-500 to-yellow-400', text:'text-orange-300', border:'border-red-500/50',    glow:'rgba(239,68,68,0.60)',  bg:'rgba(127,29,29,0.25)',  motText:'O ápice do duelo!' },
];

export function getTierByWins(totalWins: number) {
  const tier = TIERS.findLast(t => totalWins >= t.minWins) ?? TIERS[0];
  const nextTier = TIERS[TIERS.indexOf(tier) + 1] ?? null;
  const winsInTier = totalWins - tier.minWins;
  const tierRange = tier.maxWins === Infinity ? 50 : tier.maxWins - tier.minWins + 1;
  const progressPercent = tier.maxWins === Infinity ? 100 : Math.min(100, (winsInTier / tierRange) * 100);
  const winsToNextTier = nextTier ? nextTier.minWins - totalWins : 0;
  return { tier, nextTier, winsInTier, tierRange, progressPercent, winsToNextTier };
}

// ═══════════════════════════════════════════════════════════════
// TIER BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export const TierBadge: React.FC<{
  wins: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}> = ({ wins, size = 'sm', showLabel = false }) => {
  const { tier } = getTierByWins(wins);
  const sizes = { xs: 'text-xs px-1.5 py-0.5', sm: 'text-[11px] px-2 py-0.5', md: 'text-sm px-2.5 py-1', lg: 'text-base px-3 py-1.5' };
  const emojiSizes = { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-xl' };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-xl font-black border transition-all',
      sizes[size], tier.border,
      `bg-gradient-to-r ${tier.gradient} bg-opacity-20`,
    )} style={{ background: tier.bg, boxShadow: `0 0 8px ${tier.glow}` }}>
      <span className={emojiSizes[size]}>{tier.emoji}</span>
      {(showLabel || size === 'md' || size === 'lg') && (
        <span className={cn(tier.text, 'font-black')}>{tier.name}</span>
      )}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════
// TIER PROMOTION MODAL
// ═══════════════════════════════════════════════════════════════

const TierPromotionModal: React.FC<{
  newTier: TierInfo;
  onClose: () => void;
}> = ({ newTier, onClose }) => (
  <motion.div className="fixed inset-0 z-[200] flex items-center justify-center px-4"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
    <motion.div className="relative z-10 text-center max-w-sm w-full"
      initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      {/* Glow burst */}
      <motion.div className="absolute inset-0 rounded-full blur-[80px] pointer-events-none"
        animate={{ opacity: [0, 0.5, 0.2], scale: [0.5, 1.5, 1.2] }}
        transition={{ duration: 1.2 }}
        style={{ background: `radial-gradient(circle,${newTier.glow},transparent)` }} />
      <motion.div
        animate={{ scale: [0, 1.3, 1], rotate: [0, 15, -10, 0] }}
        transition={{ delay: 0.2, duration: 0.8, type: 'spring' }}
        className="text-[80px] leading-none mb-4 filter drop-shadow-2xl">
        {newTier.emoji}
      </motion.div>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="text-[11px] font-black text-white/50 uppercase tracking-[0.25em] mb-2">
        Novo Tier Desbloqueado
      </motion.p>
      <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
        className={cn('text-4xl font-black mb-2', newTier.text)}
        style={{ fontFamily: "'Rajdhani', sans-serif", textShadow: `0 0 30px ${newTier.glow}` }}>
        {newTier.name.toUpperCase()}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="text-white/50 text-sm mb-8">{newTier.motText}</motion.p>
      <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        onClick={onClose}
        className={cn('w-full h-13 rounded-2xl font-black text-white text-sm py-3 bg-gradient-to-r', newTier.gradient)}
        style={{ boxShadow: `0 0 24px ${newTier.glow}`, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.06em' }}>
        CONTINUAR DUELANDO ⚔️
      </motion.button>
    </motion.div>
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════
// THEME / DIFFICULTY / STATUS CONFIG
// ═══════════════════════════════════════════════════════════════

const THEME_DATA: Record<string, { emoji: string; label: string; color: string }> = {
  historia:       { emoji:'📜', label:'História',    color:'#fb923c' },
  geografia:      { emoji:'🌍', label:'Geografia',   color:'#34d399' },
  arte:           { emoji:'🎨', label:'Arte',        color:'#f472b6' },
  esportes:       { emoji:'⚽', label:'Esportes',    color:'#4ade80' },
  ciencias:       { emoji:'🧬', label:'Ciências',    color:'#60a5fa' },
  entretenimento: { emoji:'🍿', label:'Pop',         color:'#facc15' },
  aleatorio:      { emoji:'🎲', label:'Aleatório',   color:'#a78bfa' },
  quem_sou_eu:    { emoji:'🎭', label:'Quem Sou?',   color:'#c084fc' },
  logica:         { emoji:'🧩', label:'Lógica',      color:'#38bdf8' },
};

const DIFF_CFG: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label:'Iniciante', color:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/25' },
  medium: { label:'Médio',     color:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/25' },
  hard:   { label:'Mestre',    color:'text-red-400',     bg:'bg-red-500/10 border-red-500/25' },
};

// ═══════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════

const Skeleton = ({ className }: { className?: string }) => (
  <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
    className={cn('bg-white/8 rounded-xl', className)} />
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

type TabId = 'active' | 'pending' | 'history' | 'ranking';

export const DuelList: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<TabId>('active');
  const [duels, setDuels] = useState<Duel[]>([]);
  const [oppUsers, setOppUsers] = useState<any[]>([]);
  const [rankingList, setRankingList] = useState<any[]>([]);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [rankPos, setRankPos] = useState(1);
  const [promotionTier, setPromotionTier] = useState<TierInfo | null>(null);
  const prevTierRef = useRef<string>('');
  const [pages, setPages] = useState<Record<string, number>>({ active: 1, pending: 1, history: 1 });
  const PAGE_SIZE = 10;

  // ── Fetch all data ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: d1 }, { data: d2 }] = await Promise.all([
        supabase.from('duels').select('*').eq('challengerId', user.id),
        supabase.from('duels').select('*').eq('challengedId', user.id),
      ]);
      const all = [...(d1 || []), ...(d2 || [])]
        .filter((d, i, a) => a.findIndex(x => x.id === d.id) === i)
        .filter(d => d.challengerId !== d.challengedId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const oppIds = Array.from(new Set(
        all.map(d => d.challengerId === user.id ? d.challengedId : d.challengerId).filter(Boolean)
      ));

      const [{ data: opps }] = await Promise.all([
        oppIds.length > 0 ? supabase.from('users').select('*').in('id', oppIds) : Promise.resolve({ data: [] }),
        supabase.from('gamification_stats').select('*').eq('id', user.id).maybeSingle(),
      ]);

      setDuels(all);
      setOppUsers(opps || []);

      // Class map
      const allIds = [...oppIds, user.id];
      const { data: allUsers } = await supabase.from('users').select('id,classId').in('id', allIds);
      const classIds = Array.from(new Set((allUsers || []).map((u: any) => u.classId).filter(Boolean)));
      if (classIds.length > 0) {
        const { data: classRows } = await supabase.from('classes').select('id,name').in('id', classIds);
        const idToName: Record<string, string> = {};
        (classRows || []).forEach((c: any) => { idToName[c.id] = c.name; });
        const cmap: Record<string, string> = {};
        (allUsers || []).forEach((u: any) => { if (u.classId) cmap[u.id] = idToName[u.classId] || ''; });
        setClassMap(cmap);
      }

      // Ranking — all students at the same school, sorted by duel wins
      const { data: myUserRow } = await supabase
        .from('users')
        .select('id,schoolId,classId')
        .eq('id', user.id)
        .single();

      const targetSchoolId = myUserRow?.schoolId;

      // Get all students in this school (fallback to classmates if no schoolId)
      let schoolStudents: any[] = [];
      if (targetSchoolId) {
        const { data: sStudents } = await supabase
          .from('users')
          .select('id,name,avatar,classId')
          .eq('schoolId', targetSchoolId)
          .eq('role', 'student');
        schoolStudents = sStudents || [];
      } else if (myUserRow?.classId) {
        // fallback: classmates
        const { data: cStudents } = await supabase
          .from('users')
          .select('id,name,avatar,classId')
          .eq('classId', myUserRow.classId);
        schoolStudents = cStudents || [];
      }

      if (schoolStudents.length > 0) {
        const studentIds = schoolStudents.map(s => s.id);

        // Count wins per student from duels table
        const { data: winDuels } = await supabase
          .from('duels')
          .select('winnerId')
          .eq('status', 'completed')
          .in('winnerId', studentIds);

        const winCountMap: Record<string, number> = {};
        (winDuels || []).forEach((d: any) => {
          if (d.winnerId && d.winnerId !== 'draw') {
            winCountMap[d.winnerId] = (winCountMap[d.winnerId] || 0) + 1;
          }
        });

        // Also count total duels played per student
        const { data: playedDuels } = await supabase
          .from('duels')
          .select('challengerId,challengedId')
          .eq('status', 'completed')
          .or(studentIds.map(id => `challengerId.eq.${id},challengedId.eq.${id}`).join(','));

        const playedMap: Record<string, number> = {};
        (playedDuels || []).forEach((d: any) => {
          if (studentIds.includes(d.challengerId)) playedMap[d.challengerId] = (playedMap[d.challengerId] || 0) + 1;
          if (studentIds.includes(d.challengedId)) playedMap[d.challengedId] = (playedMap[d.challengedId] || 0) + 1;
        });

        const merged = schoolStudents.map(s => ({
          ...s,
          duelWins: winCountMap[s.id] || 0,
          duelPlayed: playedMap[s.id] || 0,
        })).sort((a: any, b: any) => {
          if (b.duelWins !== a.duelWins) return b.duelWins - a.duelWins;
          // tiebreak: win rate
          const rateA = a.duelPlayed > 0 ? a.duelWins / a.duelPlayed : 0;
          const rateB = b.duelPlayed > 0 ? b.duelWins / b.duelPlayed : 0;
          return rateB - rateA;
        });

        setRankingList(merged);
        const pos = merged.findIndex((m: any) => m.id === user.id) + 1;
        setRankPos(pos > 0 ? pos : merged.length);
      }

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  // ── Realtime ──────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
    const ch = supabase.channel('duel_list_rt_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, fetchData]);

  // ── Tier promotion detection ──────────────────────────────────
  const wins = duels.filter(d => d.status === 'completed' && d.winnerId === user?.id).length;
  const tierData = getTierByWins(wins);

  useEffect(() => {
    const stored = localStorage.getItem(`tier_${user?.id}`) ?? '';
    if (stored && stored !== tierData.tier.id && wins > 0) {
      const prev = TIERS.find(t => t.id === stored);
      const curr = tierData.tier;
      if (prev && TIERS.indexOf(curr) > TIERS.indexOf(prev)) {
        setPromotionTier(curr);
      }
    }
    if (wins > 0) localStorage.setItem(`tier_${user?.id}`, tierData.tier.id);
    prevTierRef.current = tierData.tier.id;
  }, [wins, tierData.tier.id, user?.id]);

  // ── Derived ───────────────────────────────────────────────────
  const active  = duels.filter(d => d.status === 'active');
  const pending = duels.filter(d => d.status === 'pending');
  const history = duels.filter(d => ['completed','expired','declined'].includes(d.status));
  const totalXp = history.reduce((a, d) => {
    if (d.status !== 'completed') return a;
    const my = d.challengerId === user?.id ? d.challengerScore : d.challengedScore;
    return a + (d.winnerId === user?.id ? 50 : d.winnerId === 'draw' ? 20 : 10) + my * 15;
  }, 0);
  const totalLosses = history.filter(d => d.status === 'completed' && d.winnerId !== user?.id && d.winnerId !== 'draw').length;
  const accuracy = wins + totalLosses > 0 ? Math.round((wins / (wins + totalLosses)) * 100) : 0;

  const getOpp = (d: Duel) => oppUsers.find(u => u.id === (d.challengerId === user?.id ? d.challengedId : d.challengerId));

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  };

  const TABS: { id: TabId; label: string; Icon: any; count?: number }[] = [
    { id:'active',  label:'Em Batalha', Icon: Sword,   count: active.length },
    { id:'pending', label:'Convites',   Icon: Clock,   count: pending.length },
    { id:'history', label:'Histórico',  Icon: History },
    { id:'ranking', label:'Ranking',    Icon: Globe },
  ];

  // ═══════════════════════════════════════════════════════════════
  // DUEL MATCH CARD
  // ═══════════════════════════════════════════════════════════════
  const DuelMatchCard = ({ d }: { d: Duel }) => {
    const opp = getOpp(d);
    const myScore  = d.challengerId === user?.id ? d.challengerScore : d.challengedScore;
    const oppScore = d.challengerId === user?.id ? d.challengedScore : d.challengerScore;
    const myTurnPending = d.status === 'active' && (
      (d.challengerId === user?.id && !d.challengerTurnCompleted) ||
      (d.challengedId === user?.id && !d.challengedTurnCompleted)
    );
    const isPending = d.status === 'pending' && d.challengedId === user?.id;
    const isWon   = d.status === 'completed' && d.winnerId === user?.id;
    const isDraw  = d.status === 'completed' && d.winnerId === 'draw';
    const isLost  = d.status === 'completed' && d.winnerId && d.winnerId !== user?.id && d.winnerId !== 'draw';
    const isExpired  = d.status === 'expired';
    const isDeclined = d.status === 'declined';
    const theme = THEME_DATA[d.theme] ?? { emoji:'🎲', label:d.theme, color:'#a78bfa' };
    const diff  = DIFF_CFG[d.difficulty] ?? DIFF_CFG.medium;

    type StatusCfg = { label: string; color: string; pulse: boolean; icon: React.ReactNode };
    const statusCfg: StatusCfg = myTurnPending
      ? { label:'Sua vez!', color:'text-violet-300', pulse:true,  icon:<Zap size={10}/> }
      : isPending
      ? { label:'Convite',  color:'text-amber-300',  pulse:true,  icon:<Star size={10}/> }
      : isWon
      ? { label:'Vitória',  color:'text-emerald-300',pulse:false, icon:<Trophy size={10}/> }
      : isDraw
      ? { label:'Empate',   color:'text-blue-300',   pulse:false, icon:<Check size={10}/> }
      : isLost
      ? { label:'Derrota',  color:'text-red-400',    pulse:false, icon:<X size={10}/> }
      : isExpired
      ? { label:'Expirado', color:'text-white/30',   pulse:false, icon:<Clock size={10}/> }
      : isDeclined
      ? { label:'Recusado', color:'text-white/25',   pulse:false, icon:<X size={10}/> }
      : { label:'Aguard.', color:'text-white/40',    pulse:false, icon:<Clock size={10}/> };



    const cardBg = myTurnPending
      ? 'linear-gradient(145deg,#1a0a3a 0%,#0f0720 50%,#120828 100%)'
      : isPending
      ? 'linear-gradient(145deg,#1e0e00 0%,#150a00 50%,#0e0800 100%)'
      : 'linear-gradient(145deg,#06091a 0%,#090d26 50%,#070a1e 100%)';

    const handleDecline = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try { await DuelService.declineDuel(d.id, user!.id); toast.success('Duelo recusado.'); }
      catch { toast.error('Erro ao recusar.'); }
    };

    const accentColor = myTurnPending ? '#7c3aed' : isPending ? '#d97706' : isWon ? '#059669' : isLost ? '#dc2626' : 'rgba(255,255,255,0.12)';

    // ── inline status style (dark-first, no opacity classes) ──
    const stCfg = myTurnPending
      ? { color: '#c4b5fd', bg: 'rgba(124,58,237,0.25)', border: 'rgba(124,58,237,0.5)' }
      : isPending  ? { color: '#fcd34d', bg: 'rgba(180,83,9,0.22)',   border: 'rgba(217,119,6,0.5)'   }
      : isWon      ? { color: '#6ee7b7', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)' }
      : isDraw     ? { color: '#93c5fd', bg: 'rgba(37,99,235,0.15)',  border: 'rgba(59,130,246,0.35)' }
      : isLost     ? { color: '#fca5a5', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'   }
      : { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)' };


    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        whileHover={!isDeclined ? { y: -4, boxShadow: `0 24px 64px rgba(0,0,0,0.45), 0 0 0 1.5px ${accentColor}88` } : {}}
        whileTap={!isDeclined ? { scale: 0.99 } : {}}
        onClick={() => !isDeclined && navigate(`/student/duels/${d.id}`)}
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 24,
          border: `1px solid ${myTurnPending ? 'rgba(124,58,237,0.45)' : isPending ? 'rgba(217,119,6,0.42)' : isWon ? 'rgba(16,185,129,0.25)' : isLost ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.07)'}`,
          background: cardBg,
          cursor: isDeclined ? 'not-allowed' : 'pointer',
          opacity: isDeclined ? 0.38 : 1,
          filter: isDeclined ? 'grayscale(0.6)' : 'none',
          boxShadow: '0 6px 28px rgba(0,0,0,0.32)',
        }}>

        {/* Top accent glow line */}
        {(myTurnPending || isPending) && (
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${accentColor},transparent)`, pointerEvents: 'none' }} />
        )}
        {/* Center ambient glow */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 80% at 50% 50%,rgba(99,102,241,0.05),transparent)', pointerEvents: 'none' }} />

        {/* ── MAIN ROW ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 14px 10px' }}>

          {/* LEFT — Me */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 128, flexShrink: 0 }}>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 12, color: '#fff', textAlign: 'center', lineHeight: 1.2, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name?.split(' ').slice(0, 2).join(' ')}
            </span>
            <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ borderRadius: 16, boxShadow: myScore > oppScore ? `0 0 20px ${accentColor}66, 0 6px 20px rgba(0,0,0,0.5)` : '0 4px 18px rgba(0,0,0,0.4)', flexShrink: 0, lineHeight: 0 }}>
              <StudentAvatarMini studentId={user?.id || ''} fallbackAvatarUrl={user?.avatar} fallbackInitial={user?.name?.[0] || '?'} size={120} shape="2xl" />
            </motion.div>
            {classMap[user?.id || ''] && (
              <span style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {classMap[user?.id || '']}
              </span>
            )}
          </div>

          {/* CENTER */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0, padding: '0 6px' }}>
            {/* Status badge */}
            <motion.div
              animate={statusCfg.pulse ? { opacity: [0.72, 1, 0.72], scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: stCfg.bg, border: `1px solid ${stCfg.border}`, color: stCfg.color, fontWeight: 900, fontSize: 10, letterSpacing: '0.06em' }}>
              {statusCfg.icon} {statusCfg.label}
            </motion.div>

            {/* Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08, type: 'spring', stiffness: 300, damping: 22 }}
                style={{ fontFamily: "'Orbitron',monospace", fontWeight: 900, fontSize: 40, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 0 24px rgba(255,255,255,0.2)', lineHeight: 1 }}>
                {myScore}
              </motion.span>
              <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Sword size={15} style={{ color: 'rgba(255,255,255,0.35)' }} />
                <span style={{ fontWeight: 900, fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em' }}>VS</span>
              </motion.div>
              <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.14, type: 'spring', stiffness: 300, damping: 22 }}
                style={{ fontFamily: "'Orbitron',monospace", fontWeight: 900, fontSize: 40, color: 'rgba(255,255,255,0.42)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {oppScore}
              </motion.span>
            </div>

            {/* Theme + diff + Q */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: 13 }}>{theme.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{theme.label}</span>
              <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-lg border', diff.color, diff.bg)}>
                {diff.label}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)' }}>{d.questionCount}Q</span>
            </div>
            {/* Date centered */}
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>{formatDate(d.createdAt)}</span>
          </div>

          {/* RIGHT — Opp */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 128, flexShrink: 0 }}>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 12, color: '#fff', textAlign: 'center', lineHeight: 1.2, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opp?.name?.split(' ').slice(0, 2).join(' ') || '...'}
            </span>
            <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
              style={{ borderRadius: 16, boxShadow: oppScore > myScore ? `0 0 20px ${accentColor}66, 0 6px 20px rgba(0,0,0,0.5)` : '0 4px 18px rgba(0,0,0,0.4)', flexShrink: 0, lineHeight: 0 }}>
              <StudentAvatarMini studentId={opp?.id || ''} fallbackAvatarUrl={opp?.avatar} fallbackInitial={opp?.name?.[0] || '?'} size={120} shape="2xl" />
            </motion.div>
            {opp?.id && classMap[opp.id] && (
              <span style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {classMap[opp.id]}
              </span>
            )}
          </div>
        </div>

        {/* ── FOOTER — action buttons only ── */}
        {(isPending || myTurnPending) && (
          <div style={{ padding: '0 14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            {isPending && (
              <motion.button whileTap={{ scale: 0.94 }} onClick={handleDecline}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 900, padding: '5px 11px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5', cursor: 'pointer' }}>
                <X size={10} /> Recusar
              </motion.button>
            )}
            {(myTurnPending || isPending) && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={e => { e.stopPropagation(); navigate(`/student/duels/${d.id}`); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 900, padding: '6px 15px', borderRadius: 12, cursor: 'pointer', border: 'none', color: '#fff', background: myTurnPending ? 'linear-gradient(90deg,#6d28d9,#4f46e5)' : 'linear-gradient(90deg,#d97706,#ea580c)', boxShadow: myTurnPending ? '0 4px 14px rgba(109,40,217,0.4)' : '0 4px 14px rgba(217,119,6,0.35)' }}>
                {myTurnPending ? <><Play size={11} fill="currentColor" /> JOGAR</> : <>ACEITAR ⚡</>}
              </motion.button>
            )}
          </div>
        )}
      </motion.div>
    );
  };


  // ═══════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ═══════════════════════════════════════════════════════════════
  const EmptyState = ({ icon: Icon, text, ctaLabel, onCta }: { icon: any; text: string; ctaLabel: string; onCta: () => void }) => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="col-span-full py-16 text-center rounded-3xl border border-dashed border-white/10 bg-white/2">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mx-auto mb-4">
        <Icon size={28} />
      </div>
      <p className="text-white/30 font-bold text-sm mb-5">{text}</p>
      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onCta}
        className="px-6 py-2.5 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/40">
        {ctaLabel}
      </motion.button>
    </motion.div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RANKING TAB — Ultra-Premium School Ranking by Duel Wins
  // ═══════════════════════════════════════════════════════════════
  const RankingTab = () => {
    const winsByUser = (id: string) => {
      const entry = rankingList.find((r: any) => r.id === id);
      return entry?.duelWins ?? history.filter(d => d.status === 'completed' && d.winnerId === id).length;
    };

    const top3      = rankingList.slice(0, 3);
    const rest      = rankingList.slice(3, 20);
    const myPos     = rankingList.findIndex((r: any) => r.id === user?.id);
    const myEntry   = myPos >= 0 ? rankingList[myPos] : null;
    const isInTop20 = myPos >= 0 && myPos < 20;
    const maxWins   = rankingList[0]?.duelWins ?? 1;

    // Podium layout: silver-left · gold-center · bronze-right
    const podiumCfg = [
      {
        rank: 2, entry: top3[1] ?? null,
        medal: '🥈', color: '#94a3b8', glow: 'rgba(148,163,184,0.8)',
        platformH: 96, avatarSize: 80, nameColor: '#cbd5e1',
        bg: 'linear-gradient(180deg,#1e293b,#0f172a)',
        ringGlow: '0 0 0 3px #94a3b8, 0 0 24px rgba(148,163,184,0.65)',
        delayIdx: 1,
      },
      {
        rank: 1, entry: top3[0] ?? null,
        medal: '👑', color: '#fbbf24', glow: 'rgba(251,191,36,0.95)',
        platformH: 140, avatarSize: 104, nameColor: '#fef9c3',
        bg: 'linear-gradient(180deg,#78350f,#3b1200)',
        ringGlow: '0 0 0 4px #fbbf24, 0 0 40px rgba(251,191,36,0.8)',
        delayIdx: 0,
      },
      {
        rank: 3, entry: top3[2] ?? null,
        medal: '🥉', color: '#d97706', glow: 'rgba(217,119,6,0.7)',
        platformH: 64, avatarSize: 68, nameColor: '#fcd34d',
        bg: 'linear-gradient(180deg,#451a03,#1c0600)',
        ringGlow: '0 0 0 3px #d97706, 0 0 20px rgba(217,119,6,0.6)',
        delayIdx: 2,
      },
    ];

    const stars = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 0.5 + Math.random() * 1.5,
      d: 2 + Math.random() * 4,
      delay: Math.random() * 3,
    }));

    return (
      <div className="relative rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(145deg,#04071a 0%,#080e28 50%,#0c0520 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>

        {/* ── Ambient aurora orbs ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div animate={{ scale: [1,1.3,1], opacity: [0.15,0.28,0.15] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{ background: 'radial-gradient(circle,#7c3aed,transparent)' }} />
          <motion.div animate={{ scale: [1,1.2,1], opacity: [0.1,0.2,0.1] }} transition={{ duration: 11, repeat: Infinity, delay: 3 }}
            className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[100px]"
            style={{ background: 'radial-gradient(circle,#1d4ed8,transparent)' }} />
          <motion.div animate={{ scale: [1,1.4,1], opacity: [0.08,0.18,0.08] }} transition={{ duration: 9, repeat: Infinity, delay: 1.5 }}
            className="absolute bottom-0 right-0 w-[280px] h-[280px] rounded-full blur-[90px]"
            style={{ background: 'radial-gradient(circle,#be185d,transparent)' }} />

          {/* Floating star particles */}
          {stars.map(st => (
            <motion.div key={st.id}
              className="absolute rounded-full bg-white"
              style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s }}
              animate={{ opacity: [0, 0.7, 0], y: [0, -12, 0] }}
              transition={{ duration: st.d, repeat: Infinity, delay: st.delay, ease: 'easeInOut' }} />
          ))}

          {/* Horizontal scan line */}
          <motion.div className="absolute left-0 right-0 h-[1px]"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(124,58,237,0.4),transparent)' }}
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 2 }} />
        </div>

        {/* ────────────────────────────────────────────── */}
        {/* CINEMATIC HEADER */}
        {/* ────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center pt-6 pb-3 px-4">

          {/* Rank badge */}
          <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="text-4xl mb-2" style={{ filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.9))' }}>
            🏆
          </motion.div>

          <div className="flex items-center gap-3 mb-1">
            <motion.div animate={{ scaleX: [0.6,1,0.6], opacity: [0.4,1,0.4] }} transition={{ duration: 3, repeat: Infinity }}
              className="h-[1px] w-16" style={{ background: 'linear-gradient(90deg,transparent,#fbbf24)' }} />
            <h2 className="text-xl font-black tracking-[0.22em] uppercase"
              style={{ fontFamily: "'Rajdhani',sans-serif", background: 'linear-gradient(90deg,#fbbf24,#f59e0b,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Ranking da Escola
            </h2>
            <motion.div animate={{ scaleX: [0.6,1,0.6], opacity: [0.4,1,0.4] }} transition={{ duration: 3, repeat: Infinity }}
              className="h-[1px] w-16" style={{ background: 'linear-gradient(90deg,#fbbf24,transparent)' }} />
          </div>

          <p className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            {rankingList.length} guerreiros • ordenado por vitórias
          </p>
        </motion.div>

        {/* ────────────────────────────────────────────── */}
        {/* EMPTY STATE */}
        {/* ────────────────────────────────────────────── */}
        {rankingList.length === 0 && (
          <div className="relative z-10 py-20 text-center space-y-4 px-6">
            <motion.div animate={{ rotate: [0,10,-10,0] }} transition={{ duration: 4, repeat: Infinity }}
              className="text-6xl mx-auto w-fit">⚔️</motion.div>
            <p className="font-bold text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Nenhum duelo ainda.<br />Seja o primeiro a entrar no ranking!
            </p>
          </div>
        )}

        {rankingList.length > 0 && (
          <div className="relative z-10">

            {/* ────────────────────────────────────────── */}
            {/* PODIUM */}
            {/* ────────────────────────────────────────── */}
            <div className="px-4 pt-2 pb-0">
              <div className="flex items-end justify-center gap-1.5 sm:gap-3">
                {podiumCfg.map(({ rank, entry, medal, color, glow, platformH, avatarSize, nameColor, bg, ringGlow, delayIdx }) => {
                  if (!entry) return (
                    <div key={rank} className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
                      <div className="w-full rounded-t-2xl flex items-center justify-center"
                        style={{ height: platformH, background: 'rgba(255,255,255,0.02)', border: `1px dashed rgba(255,255,255,0.07)`, borderBottom: 'none' }}>
                        <span style={{ fontSize: 24, opacity: 0.3 }}>{medal}</span>
                      </div>
                    </div>
                  );
                  const isMe = entry.id === user?.id;
                  const eWins = winsByUser(entry.id);
                  const winPct = maxWins > 0 ? Math.round((eWins / maxWins) * 100) : 0;
                  return (
                    <motion.div key={entry.id}
                      initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: delayIdx * 0.15, type: 'spring', stiffness: 260, damping: 20 }}
                      className="flex-1 flex flex-col items-center gap-0" style={{ minWidth: 0 }}>

                      {/* Medal / crown float */}
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: delayIdx * 0.3 }}
                        className="text-2xl sm:text-3xl mb-1"
                        style={{ filter: `drop-shadow(0 0 12px ${glow})` }}>
                        {medal}
                      </motion.div>

                      {/* Avatar with animated glow ring */}
                      <div className="relative" style={{ marginBottom: 8 }}>
                        {/* Pulse rings */}
                        {[0,1].map(i => (
                          <motion.div key={i} className="absolute rounded-full"
                            style={{ inset: -(4 + i*8), border: `1px solid ${color}44` }}
                            animate={{ opacity: [0.6,0,0.6], scale: [0.95,1.08,0.95] }}
                            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7 }} />
                        ))}
                        {/* Avatar */}
                        <motion.div
                          animate={{ boxShadow: [ringGlow, ringGlow.replace('0.95','0.4').replace('0.8','0.35').replace('0.65','0.3').replace('0.6','0.25'), ringGlow] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          style={{
                            width: avatarSize, height: avatarSize,
                            borderRadius: '50%', overflow: 'hidden',
                            border: `3px solid ${color}`, flexShrink: 0,
                            boxShadow: ringGlow,
                          }}>
                          {entry.avatar
                            ? <img src={entry.avatar} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: 'rgba(15,23,42,0.95)' }}>🧑‍🎓</div>}
                        </motion.div>
                        {isMe && (
                          <motion.div animate={{ scale: [1,1.1,1] }} transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute -bottom-1 -right-1 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                            style={{ background: 'linear-gradient(135deg,#6366f1,#a21caf)', color: '#fff', boxShadow: '0 0 8px rgba(99,102,241,0.8)' }}>
                            Você
                          </motion.div>
                        )}
                      </div>

                      {/* Name */}
                      <p className="text-center font-black truncate w-full px-1 leading-tight text-sm"
                        style={{ fontFamily: "'Rajdhani',sans-serif", color: nameColor, maxWidth: '100%' }}>
                        {entry.name?.split(' ')[0]}
                      </p>
                      {classMap[entry.id] && (
                        <p className="text-[9px] font-bold truncate w-full text-center"
                          style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {classMap[entry.id]}
                        </p>
                      )}

                      {/* Wins chip */}
                      <motion.div animate={{ scale: [1,1.04,1] }} transition={{ duration: 2, repeat: Infinity, delay: delayIdx * 0.4 }}
                        className="mt-1.5 mb-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black"
                        style={{ background: `${color}22`, border: `1px solid ${color}66`, color }}>
                        ⚔️ {eWins}
                      </motion.div>

                      {/* Tier badge */}
                      <TierBadge wins={eWins} size="xs" showLabel />

                      {/* Win % bar */}
                      <div className="w-full h-1 rounded-full overflow-hidden mt-1.5 mb-0"
                        style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${winPct}%` }}
                          transition={{ duration: 1.2, delay: 0.3 + delayIdx * 0.15, ease: 'easeOut' }}
                          style={{ background: `linear-gradient(90deg,${color},${glow})` }} />
                      </div>

                      {/* Podium platform */}
                      <motion.div className="w-full rounded-t-2xl flex flex-col items-center justify-center gap-0.5 mt-0"
                        style={{ height: platformH, background: bg, borderTop: `2px solid ${color}`, position: 'relative', overflow: 'hidden' }}>
                        {/* Inner shimmer */}
                        <motion.div className="absolute inset-0 pointer-events-none"
                          animate={{ x: ['-100%','200%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                          style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', width: '60%' }} />
                        <span className="font-black tabular-nums" style={{ fontFamily: "'Orbitron',monospace", color, fontSize: rank === 1 ? 22 : 16 }}>
                          #{rank}
                        </span>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ────────────────────────────────────────── */}
            {/* LEADERBOARD LIST */}
            {/* ────────────────────────────────────────── */}
            {rest.length > 0 && (
              <div className="mt-4 px-3 pb-4 space-y-2">

                {/* Section header */}
                <div className="flex items-center gap-2 px-1 pb-1">
                  <div className="h-[1px] flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  <span className="text-[9px] font-black uppercase tracking-[0.25em]"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Classificação Geral
                  </span>
                  <div className="h-[1px] flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
                </div>

                {rest.map((r: any, i: number) => {
                  const pos    = i + 4;
                  const isMe   = r.id === user?.id;
                  const rWins  = r.duelWins ?? 0;
                  const rPct   = maxWins > 0 ? (rWins / maxWins) * 100 : 0;
                  const posColor = pos <= 5 ? '#fbbf24' : pos <= 10 ? '#a78bfa' : 'rgba(255,255,255,0.3)';
                  return (
                    <motion.div key={r.id}
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.035, type: 'spring', stiffness: 300, damping: 25 }}
                      className="relative overflow-hidden rounded-2xl"
                      style={{
                        background: isMe
                          ? 'linear-gradient(135deg,rgba(99,102,241,0.22),rgba(139,92,246,0.12))'
                          : 'rgba(255,255,255,0.04)',
                        border: isMe
                          ? '1.5px solid rgba(99,102,241,0.5)'
                          : '1px solid rgba(255,255,255,0.06)',
                      }}>

                      {/* Win bar fill (behind content) */}
                      <div className="absolute inset-y-0 left-0 pointer-events-none"
                        style={{ width: `${rPct}%`, background: isMe ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.025)', borderRadius: '1rem 0 0 1rem', transition: 'width 1s ease' }} />

                      {/* Me shimmer */}
                      {isMe && (
                        <motion.div className="absolute inset-0 pointer-events-none"
                          animate={{ x: ['-100%','200%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                          style={{ background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.15),transparent)', width: '50%' }} />
                      )}

                      <div className="relative z-10 flex items-center gap-2.5 px-3 py-2.5">
                        {/* Position */}
                        <div className="w-7 text-center shrink-0">
                          <span className="text-sm font-black tabular-nums leading-none"
                            style={{ fontFamily: "'Orbitron', monospace", color: isMe ? '#818cf8' : posColor }}>
                            {pos}
                          </span>
                        </div>

                        {/* Avatar */}
                        <div className="shrink-0" style={{
                          width: 38, height: 38, borderRadius: 10, overflow: 'hidden',
                          border: isMe ? '2px solid rgba(99,102,241,0.7)' : '1px solid rgba(255,255,255,0.1)',
                          boxShadow: isMe ? '0 0 12px rgba(99,102,241,0.5)' : 'none',
                        }}>
                          {r.avatar
                            ? <img src={r.avatar} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-base" style={{ background: 'rgba(15,23,42,0.95)' }}>🧑‍🎓</div>}
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] font-black truncate leading-tight"
                              style={{ fontFamily: "'Rajdhani',sans-serif", color: isMe ? '#c7d2fe' : '#f1f5f9' }}>
                              {r.name?.split(' ').slice(0, 2).join(' ')}
                            </span>
                            {isMe && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(99,102,241,0.35)', color: '#a5b4fc' }}>
                                Você
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <TierBadge wins={rWins} size="xs" showLabel />
                            {classMap[r.id] && (
                              <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {classMap[r.id]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Wins column */}
                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="flex items-baseline gap-1 justify-end">
                            <span className="text-base font-black tabular-nums leading-none"
                              style={{ color: isMe ? '#818cf8' : rWins > 0 ? '#34d399' : 'rgba(255,255,255,0.2)' }}>
                              {rWins}
                            </span>
                            <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>V</span>
                          </div>
                          {(r.duelPlayed || 0) > 0 && (
                            <div className="text-[9px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {r.duelPlayed} duelos
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ────────────────────────────────────────── */}
            {/* MY POSITION CARD — outside top 20 */}
            {/* ────────────────────────────────────────── */}
            {!isInTop20 && myEntry && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 22 }}
                className="relative mx-3 mb-4 rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))', border: '1.5px dashed rgba(99,102,241,0.45)' }}>

                {/* Scan shimmer */}
                <motion.div className="absolute inset-0 pointer-events-none"
                  animate={{ x: ['-100%','200%'] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 4 }}
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.18),transparent)', width: '45%' }} />

                {/* Header stripe */}
                <div className="px-4 py-2 border-b flex items-center justify-between"
                  style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'rgba(165,180,252,0.7)' }}>
                    Sua Posição
                  </span>
                  <span className="text-[9px] font-black" style={{ color: 'rgba(165,180,252,0.5)' }}>
                    {myPos - 19} posições do Top 20
                  </span>
                </div>

                <div className="relative z-10 flex items-center gap-3 px-4 py-3">
                  {/* Rank number */}
                  <span className="text-2xl font-black tabular-nums shrink-0"
                    style={{ fontFamily: "'Orbitron',monospace", color: '#818cf8' }}>
                    #{myPos + 1}
                  </span>
                  {/* Avatar */}
                  <div className="shrink-0" style={{
                    width: 42, height: 42, borderRadius: 12, overflow: 'hidden',
                    border: '2px solid rgba(99,102,241,0.7)', boxShadow: '0 0 14px rgba(99,102,241,0.5)',
                  }}>
                    {user?.avatar
                      ? <img src={user.avatar} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl" style={{ background: 'rgba(15,23,42,0.95)' }}>🧑</div>}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-black block truncate" style={{ fontFamily: "'Rajdhani',sans-serif", color: '#c7d2fe' }}>
                      {user?.name?.split(' ').slice(0, 2).join(' ')}
                    </span>
                    <TierBadge wins={wins} size="xs" showLabel />
                  </div>
                  {/* Wins */}
                  <div className="text-right shrink-0">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="text-xl font-black tabular-nums" style={{ color: '#818cf8' }}>
                        {myEntry.duelWins ?? wins}
                      </span>
                      <span className="text-[9px] font-bold" style={{ color: 'rgba(165,180,252,0.5)' }}>V</span>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-3 text-center">
                  <p className="text-[10px] font-bold" style={{ color: 'rgba(165,180,252,0.45)' }}>
                    ⚔️ Continue duelando para subir no ranking!
                  </p>
                </div>
              </motion.div>
            )}

          </div>
        )}
      </div>
    );
  };



  // ═══════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════
  if (loading) return (
    <div className="space-y-5 pb-10">
      <Skeleton className="h-60 w-full rounded-3xl" />
      <div className="flex gap-2"><Skeleton className="h-10 w-28 rounded-2xl" /><Skeleton className="h-10 w-28 rounded-2xl" /><Skeleton className="h-10 w-28 rounded-2xl" /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-3xl" />)}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  const near = tierData.progressPercent >= 80 && tierData.nextTier;

  return (
    <div className="pb-12 space-y-5">

      {/* ══════ TIER PROMOTION MODAL ══════ */}
      <AnimatePresence>
        {promotionTier && (
          <TierPromotionModal newTier={promotionTier} onClose={() => setPromotionTier(null)} />
        )}
      </AnimatePresence>

      {/* ══════ HERO CARD ══════ */}
      <motion.div initial={{ opacity: 0, y: -16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative rounded-[2rem] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
        style={{ background: 'linear-gradient(135deg,#06091a 0%,#0d0828 40%,#1a083a 75%,#090618 100%)' }}>

        {/* ── Layered ambient glows ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div animate={{ scale: [1,1.15,1], opacity: [0.18,0.32,0.18] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-20 -left-20 w-[320px] h-[320px] rounded-full blur-[90px]"
            style={{ background: 'radial-gradient(circle,#6366f1,transparent)' }} />
          <motion.div animate={{ scale: [1,1.2,1], opacity: [0.12,0.22,0.12] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute -bottom-24 right-16 w-[280px] h-[280px] rounded-full blur-[80px]"
            style={{ background: 'radial-gradient(circle,#a855f7,transparent)' }} />
          <motion.div animate={{ x: ['-100%','200%'] }} transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
            className="absolute top-0 left-0 w-1/3 h-full"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)' }} />
        </div>
        {/* ── Grid texture ── */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'linear-gradient(rgba(139,92,246,1) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,1) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* ── Top accent line ── */}
        <motion.div animate={{ opacity: [0.4,1,0.4] }} transition={{ duration: 2.5, repeat: Infinity }}
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg,transparent 5%,#6366f1 30%,#a855f7 60%,#6366f1 80%,transparent 95%)' }} />

        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-center gap-6">

            {/* ══ LEFT COLUMN ══ */}
            <div className="flex flex-col gap-4 flex-1 min-w-0">

              {/* Header text */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <motion.div animate={{ rotate: [0,-12,12,0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}>
                    <Sword size={13} className="text-indigo-400" strokeWidth={2.5} />
                  </motion.div>
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.25em]">Arena de Duelos</span>
                </div>
                <h1 className="text-[28px] sm:text-[34px] font-black text-white leading-[1.0] mb-1.5" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.01em' }}>
                  Prove seu{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                    Conhecimento
                  </span>
                </h1>
                <p className="text-white/30 text-[11px] font-semibold leading-relaxed">
                  Desafie colegas, evolua de tier e conquiste o topo da arena.
                </p>
              </div>

              {/* 4 Stats in 2x2 grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Trophy,   val: wins,          label:'Vitórias',  color:'#34d399', glow:'rgba(52,211,153,0.3)',  bg:'rgba(52,211,153,0.08)'  },
                  { icon: Zap,      val: totalXp,       label:'XP Total',  color:'#fbbf24', glow:'rgba(251,191,36,0.3)',  bg:'rgba(251,191,36,0.08)'  },
                  { icon: Target,   val:`${accuracy}%`, label:'Precisão',  color:'#818cf8', glow:'rgba(129,140,248,0.3)', bg:'rgba(129,140,248,0.08)' },
                  { icon: BarChart2,val:`#${rankPos}`,  label:'Ranking',   color:'#c084fc', glow:'rgba(192,132,252,0.3)', bg:'rgba(192,132,252,0.08)' },
                ].map(({ icon: Icon, val, label, color, glow, bg }, i) => (
                  <motion.div key={label}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 280, damping: 22 }}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                    style={{ background: bg, border: `1px solid ${color}22` }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${color}18`, boxShadow: `0 0 12px ${glow}` }}>
                      <Icon size={14} strokeWidth={2.5} style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-black leading-none text-white">{val}</div>
                      <div className="text-[9px] font-bold text-white/35 mt-0.5 uppercase tracking-wide">{label}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ══ RIGHT COLUMN — GIANT AVATAR ══ */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              {/* Avatar with glow rings */}
              <div className="relative flex items-center justify-center">
                {/* Outer pulse rings */}
                {[0,1,2].map(i => (
                  <motion.div key={i} className="absolute rounded-full border border-indigo-500/25"
                    style={{ width: 148 + i * 24, height: 148 + i * 24 }}
                    animate={{ opacity: [0.6,0,0.6], scale: [0.95,1.05,0.95] }}
                    transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.55, ease: 'easeInOut' }} />
                ))}
                {/* Inner glow */}
                <motion.div className="absolute w-[140px] h-[140px] rounded-full blur-[30px]"
                  animate={{ opacity: [0.25,0.5,0.25] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ background: 'radial-gradient(circle,#7c3aed,transparent)' }} />
                {/* Floating avatar */}
                <motion.div animate={{ y: [0,-8,0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ borderRadius: 28, boxShadow: '0 0 0 3px rgba(99,102,241,0.5), 0 0 40px rgba(99,102,241,0.4), 0 20px 50px rgba(0,0,0,0.6)', lineHeight: 0 }}>
                  <StudentAvatarMini studentId={user?.id ?? ''} fallbackInitial={user?.name?.[0] || '?'}
                    size={130} shape="2xl" />
                </motion.div>
              </div>

              {/* Name + Tier badge */}
              <div className="text-center space-y-1.5">
                <p className="text-sm font-black text-white leading-tight" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
                  {user?.name?.split(' ').slice(0,2).join(' ')}
                </p>
                <TierBadge wins={wins} size="sm" showLabel />
              </div>

              {/* Small Desafiar button */}
              <motion.button
                whileHover={{ scale: 1.06, boxShadow: '0 0 24px rgba(124,58,237,0.7)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/student/duels/create')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[11px] tracking-widest text-white uppercase relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.45)', fontFamily: "'Rajdhani',sans-serif" }}>
                {/* shimmer sweep */}
                <motion.div className="absolute inset-0 pointer-events-none"
                  animate={{ x: ['-100%','200%'] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)', width: '50%' }} />
                <Sword size={12} />
                ⚔️ Desafiar
              </motion.button>
            </div>

          </div>

          {/* ── TIER PROGRESS STRIP ── */}
          <div className="mt-5 flex items-center gap-3 px-1">
            <TierBadge wins={wins} size="xs" showLabel />
            <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              <motion.div className="absolute inset-y-0 left-0 rounded-full"
                initial={{ width: 0 }} animate={{ width: `${tierData.progressPercent}%` }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
                style={{ background: near
                  ? `linear-gradient(90deg,${tierData.tier.glow},${tierData.nextTier?.glow})`
                  : `linear-gradient(90deg,${tierData.tier.glow},rgba(255,255,255,0.25))` }}>
                {/* Shimmer on bar */}
                <motion.div className="absolute inset-0"
                  animate={{ x: ['-100%','200%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)', width: '40%' }} />
              </motion.div>
            </div>
            {tierData.nextTier ? (
              <span className="text-[9px] font-black text-white/35 whitespace-nowrap uppercase tracking-widest">
                {tierData.winsToNextTier} p/ {tierData.nextTier.name}
              </span>
            ) : (
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Star size={9} className="fill-amber-400" /> Máximo!
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ══════ TABS ══════ */}
      <div className="flex gap-1.5 p-1 bg-white/4 border border-white/6 rounded-2xl w-fit max-w-full overflow-x-auto">
        {TABS.map(t => (
          <motion.button key={t.id} whileTap={{ scale: 0.97 }} onClick={() => { setTab(t.id); setPages(p => ({ ...p, [t.id]: 1 })); }}
            className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0',
              tab === t.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                : 'bg-yellow-400 text-black hover:bg-yellow-300')}>
            <t.Icon size={12} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', tab === t.id ? 'bg-white/20' : 'bg-white/10 text-white/50')}>
                {t.count}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* ══════ CONTENT ══════ */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}>
          {tab === 'ranking' ? (
            <RankingTab />
          ) : (() => {
            const src = tab === 'active' ? active : tab === 'pending' ? pending : history;
            const pg = pages[tab] || 1;
            const totalPages = Math.ceil(src.length / PAGE_SIZE);
            const slice = src.slice((pg - 1) * PAGE_SIZE, pg * PAGE_SIZE);
            const isEmpty = src.length === 0;
            const emptyProps =
              tab === 'active'   ? { icon: Sword,   text: 'Nenhum duelo ativo. Desafie um colega!', ctaLabel: '⚔️ Novo Desafio', onCta: () => navigate('/student/duels/create') }
            : tab === 'pending'  ? { icon: Clock,   text: 'Nenhum convite pendente.',              ctaLabel: 'Criar Desafio',  onCta: () => navigate('/student/duels/create') }
            :                     { icon: History,  text: 'Sem histórico ainda.',                   ctaLabel: 'Iniciar Duelo', onCta: () => navigate('/student/duels/create') };
            return (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {isEmpty
                    ? <EmptyState {...emptyProps} />
                    : slice.map(d => <DuelMatchCard key={d.id} d={d} />)}
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 12 }}>
                    <motion.button whileTap={{ scale: 0.95 }} disabled={pg === 1}
                      onClick={() => setPages(p => ({ ...p, [tab]: pg - 1 }))}
                      style={{ padding: '7px 18px', borderRadius: 12, fontWeight: 900, fontSize: 13, cursor: pg === 1 ? 'not-allowed' : 'pointer', background: pg === 1 ? '#e2e8f0' : '#4f46e5', border: 'none', color: pg === 1 ? '#94a3b8' : '#fff', boxShadow: pg === 1 ? 'none' : '0 4px 12px rgba(79,70,229,0.4)' }}>
                      ← Anterior
                    </motion.button>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#64748b', minWidth: 60, textAlign: 'center' }}>
                      {pg} / {totalPages}
                    </span>
                    <motion.button whileTap={{ scale: 0.95 }} disabled={pg === totalPages}
                      onClick={() => setPages(p => ({ ...p, [tab]: pg + 1 }))}
                      style={{ padding: '7px 18px', borderRadius: 12, fontWeight: 900, fontSize: 13, cursor: pg === totalPages ? 'not-allowed' : 'pointer', background: pg === totalPages ? '#e2e8f0' : '#4f46e5', border: 'none', color: pg === totalPages ? '#94a3b8' : '#fff', boxShadow: pg === totalPages ? 'none' : '0 4px 12px rgba(79,70,229,0.4)' }}>
                      Próximo →
                    </motion.button>
                  </div>
                )}
              </>
            );
          })()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
