import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import {
  Trophy, Sword, Clock, History, Zap, Play, Gamepad2, X,
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

      // Ranking (classmates)
      const myData = (allUsers || []).find((u: any) => u.id === user.id);
      if (myData?.classId) {
        const { data: classmates } = await supabase.from('users').select('id,name,avatar').eq('classId', myData.classId);
        if (classmates) {
          const ids = classmates.map(c => c.id);
          const { data: stats } = await supabase.from('gamification_stats').select('*').in('id', ids);
          if (stats) {
            const merged = classmates.map(c => ({
              ...c,
              ...(stats.find(s => s.id === c.id) || {}),
            })).sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0));
            setRankingList(merged);
            const pos = merged.findIndex((m: any) => m.id === user.id) + 1;
            setRankPos(pos > 0 ? pos : 1);
          }
        }
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
      ? 'linear-gradient(145deg,rgba(91,33,182,0.22),rgba(15,23,42,0.96))'
      : isPending
      ? 'linear-gradient(145deg,rgba(120,53,15,0.22),rgba(15,23,42,0.96))'
      : 'linear-gradient(145deg,rgba(15,23,42,0.98),rgba(17,24,60,0.96))';

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
  // RANKING TAB — Podium + Top 15 + Self Position (dark-first)
  // ═══════════════════════════════════════════════════════════════
  const RankingTab = () => {
    // Compute wins per entry using duel history (best-effort, own duels only)
    const winsByUser = (id: string) =>
      history.filter(d => d.status === 'completed' && d.winnerId === id).length;

    const top3      = rankingList.slice(0, 3);
    const rest      = rankingList.slice(3, 15);
    const myPos     = rankingList.findIndex((r: any) => r.id === user?.id);
    const myEntry   = myPos >= 0 ? rankingList[myPos] : null;
    const isInTop15 = myPos >= 0 && myPos < 15;

    // Podium column order: 2nd (left) · 1st (center, tallest) · 3rd (right)
    type PodiumSlot = { entry: any; pos: number; podiumH: string; blockBg: string; blockBorder: string; medal: string; glow: string; ringCls: string; avatarCls: string; nameCls: string; xpCls: string; crown: boolean };
    const podiumSlots: PodiumSlot[] = [
      {
        entry: top3[1] ?? null, pos: 2,
        podiumH: 'h-24', medal: '🥈',
        blockBg: 'rgba(51,65,85,0.95)',  blockBorder: '#94a3b8',
        glow: 'rgba(148,163,184,0.7)',    ringCls: 'border-slate-300',
        avatarCls: 'w-[100px] h-[100px]',           nameCls: 'text-slate-200 text-sm',
        xpCls: 'text-slate-300 text-xs',  crown: false,
      },
      {
        entry: top3[0] ?? null, pos: 1,
        podiumH: 'h-32', medal: '🥇',
        blockBg: 'rgba(120,53,15,0.95)',  blockBorder: '#facc15',
        glow: 'rgba(234,179,8,0.85)',      ringCls: 'border-yellow-400',
        avatarCls: 'w-[100px] h-[100px]',            nameCls: 'text-white text-base',
        xpCls: 'text-yellow-300 text-sm',  crown: true,
      },
      {
        entry: top3[2] ?? null, pos: 3,
        podiumH: 'h-16', medal: '🥉',
        blockBg: 'rgba(69,26,3,0.95)',   blockBorder: '#b45309',
        glow: 'rgba(180,83,9,0.7)',       ringCls: 'border-amber-600',
        avatarCls: 'w-14 h-14',           nameCls: 'text-amber-100 text-xs',
        xpCls: 'text-amber-400 text-xs',  crown: false,
      },
    ];

    return (
      /* ── OUTER DARK GLASS CARD — ensures dark BG on any page theme ── */
      <div className="rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#080e24 0%,#0b1230 60%,#0d0620 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* No data */}
        {rankingList.length === 0 && (
          <div className="py-16 text-center space-y-3 px-6">
            <Globe size={44} className="mx-auto" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <p className="font-bold text-base" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Sem dados de ranking ainda.<br />Complete duelos para aparecer aqui!
            </p>
          </div>
        )}

        {rankingList.length > 0 && (
          <>
            {/* ── HEADER ── */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 py-4 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <Trophy size={18} className="text-yellow-400" />
              <span className="text-base font-black tracking-[0.18em] uppercase"
                style={{ fontFamily: "'Rajdhani',sans-serif", color: '#fff' }}>
                Ranking da Arena
              </span>
              <Trophy size={18} className="text-yellow-400" />
            </motion.div>

            {/* ── PODIUM ── */}
            {top3.length >= 1 && (
              <div className="px-4 pt-6 pb-0">
                <div className="flex items-end justify-center gap-2">
                  {podiumSlots.map(({ entry, pos, podiumH, medal, blockBg, blockBorder, glow, ringCls, avatarCls, nameCls, xpCls, crown }, colIdx) => {
                    if (!entry) {
                      return (
                        <div key={colIdx} className="flex-1 flex flex-col items-center">
                          <div className={cn('w-full rounded-t-2xl flex items-center justify-center', podiumH)}
                            style={{ background: 'rgba(255,255,255,0.03)', border: `1px dashed rgba(255,255,255,0.08)`, borderBottom: 'none' }}>
                            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 24 }}>{medal}</span>
                          </div>
                        </div>
                      );
                    }
                    const isMe = entry.id === user?.id;
                    const eWins = winsByUser(entry.id);
                    return (
                      <motion.div key={entry.id}
                        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: colIdx * 0.12, type: 'spring', stiffness: 280, damping: 22 }}
                        className="flex-1 flex flex-col items-center gap-1.5">
                        {/* Crown 1st */}
                        {crown && (
                          <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="text-3xl" style={{ filter: 'drop-shadow(0 0 10px rgba(234,179,8,0.9))' }}>👑</motion.div>
                        )}
                        {/* Avatar */}
                        <motion.div
                          animate={pos === 1 ? { boxShadow: [`0 0 0 3px ${blockBorder}, 0 0 20px ${glow}`, `0 0 0 3px ${blockBorder}, 0 0 35px ${glow}`, `0 0 0 3px ${blockBorder}, 0 0 20px ${glow}`] } : {}}
                          transition={{ duration: 2, repeat: Infinity }}
                          className={cn('rounded-full overflow-hidden border-3 bg-slate-900 shrink-0', avatarCls, ringCls)}
                          style={{ border: `3px solid ${blockBorder}`, boxShadow: `0 0 18px ${glow}` }}>
                          {entry.avatar
                            ? <img src={entry.avatar} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-3xl bg-indigo-950">🧑‍🎓</div>}
                        </motion.div>
                        {/* Name + class */}
                        <div className="text-center px-1 max-w-full">
                          <p className={cn('font-black leading-tight truncate max-w-[90px]', nameCls)}
                            style={{ fontFamily: "'Rajdhani',sans-serif" }}>
                            {entry.name?.split(' ')[0]}
                          </p>
                          {classMap[entry.id] && (
                            <p className="text-[9px] font-bold truncate max-w-[90px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              {classMap[entry.id]}
                            </p>
                          )}
                        </div>
                        {/* Tier + XP */}
                        <div className="flex flex-col items-center gap-1">
                          <TierBadge wins={eWins} size="xs" showLabel />
                          <span className={cn('font-black tabular-nums', xpCls)}>
                            {(entry.xp || 0).toLocaleString()} XP
                          </span>
                        </div>
                        {/* Podium platform */}
                        <div className={cn('w-full rounded-t-2xl flex flex-col items-center justify-center gap-0.5', podiumH)}
                          style={{ background: blockBg, borderTop: `2px solid ${blockBorder}`, borderLeft: `1px solid rgba(255,255,255,0.12)`, borderRight: `1px solid rgba(255,255,255,0.12)` }}>
                          <span style={{ fontSize: pos === 1 ? 28 : 22 }}>{medal}</span>
                          <span className="font-black text-white" style={{ fontFamily: "'Orbitron',monospace", fontSize: pos === 1 ? 14 : 11 }}>
                            #{pos}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full mt-0.5"
                              style={{ background: 'rgba(99,102,241,0.4)', color: '#a5b4fc' }}>Você</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── POSITIONS 4–15 ── */}
            {rest.length > 0 && (
              <div className="px-3 py-3 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest px-1 pb-1"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>Classificação</p>
                {rest.map((r: any, i: number) => {
                  const pos   = i + 4;
                  const isMe  = r.id === user?.id;
                  const rWins = winsByUser(r.id);
                  return (
                    <motion.div key={r.id}
                      initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.04 }}
                      className="flex items-center gap-3 px-3 py-3 rounded-2xl"
                      style={{
                        background: isMe ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                        border: isMe ? '1.5px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
                      }}>
                      {/* Position number */}
                      <div className="w-8 text-center shrink-0">
                        <span className="text-sm font-black tabular-nums"
                          style={{ color: isMe ? '#a5b4fc' : 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron',monospace" }}>
                          {pos}
                        </span>
                      </div>
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                        style={{ background: '#1e2a48', border: isMe ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)' }}>
                        {r.avatar
                          ? <img src={r.avatar} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-lg">🧑‍🎓</div>}
                      </div>
                      {/* Name + Class + Tier */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black truncate leading-tight"
                            style={{ fontFamily: "'Rajdhani',sans-serif", color: isMe ? '#c7d2fe' : '#fff' }}>
                            {r.name?.split(' ').slice(0, 2).join(' ')}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg"
                              style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }}>Você</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {classMap[r.id] && (
                            <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.38)' }}>
                              {classMap[r.id]}
                            </span>
                          )}
                          <TierBadge wins={rWins} size="xs" showLabel />
                        </div>
                      </div>
                      {/* XP + streak */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black tabular-nums" style={{ color: '#fbbf24' }}>
                          {(r.xp || 0).toLocaleString()}
                          <span className="text-[10px] font-bold ml-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>XP</span>
                        </div>
                        {(r.streak || 0) > 0 && (
                          <div className="text-[11px] font-black" style={{ color: '#fb923c' }}>
                            🔥 {r.streak}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ── MY POSITION — shown even outside top 15 ── */}
            {!isInTop15 && myEntry && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="mx-3 mb-3 rounded-2xl overflow-hidden"
                style={{ border: '1.5px dashed rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)' }}>
                <div className="px-3 py-2 text-center border-b" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(165,180,252,0.7)' }}>
                    Sua posição atual
                  </p>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl font-black tabular-nums" style={{ fontFamily: "'Orbitron',monospace", color: '#818cf8' }}>
                    #{myPos + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                    style={{ background: '#1e2a48', border: '2px solid #6366f1' }}>
                    {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-950 flex items-center justify-center text-xl">🧑</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black" style={{ fontFamily: "'Rajdhani',sans-serif", color: '#fff' }}>
                      {user?.name?.split(' ').slice(0, 2).join(' ')}
                    </div>
                    <TierBadge wins={wins} size="xs" showLabel />
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black" style={{ color: '#fbbf24' }}>
                      {(myEntry.xp || 0).toLocaleString()} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>XP</span>
                    </div>
                    {myPos >= 15 && (
                      <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {myPos - 14} posições do Top 15
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-4 pb-3 text-center text-xs font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  ⚔️ Continue duelando para subir no ranking!
                </div>
              </motion.div>
            )}
          </>
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

      {/* ══════ HERO ══════ */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(135deg,#020617 0%,#0f0a2e 45%,#1a0533 80%,#020617 100%)' }}>
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full blur-[80px] opacity-25" style={{ background: 'radial-gradient(circle,#6366f1,transparent)' }} />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full blur-[80px] opacity-20" style={{ background: 'radial-gradient(circle,#a855f7,transparent)' }} />
        </div>
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 p-5 sm:p-6">
          {/* Label */}
          <div className="flex items-center gap-2 mb-4">
            <Sword size={13} className="text-indigo-400 stroke-[2.5]" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Arena de Duelos</span>
          </div>

          {/* Two-col: title + player hud */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
            <div className="flex-1">
              <h1 className="text-3xl font-black text-white leading-tight mb-1" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
                Prove seu <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg,#818cf8,#c084fc)' }}>Conhecimento</span>
              </h1>
              <p className="text-white/35 text-xs font-semibold">Desafie colegas, evolua de tier, conquiste o topo da arena.</p>
            </div>
            {/* Player mini hud — 2x enlarged */}
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 shrink-0 self-start">
              <StudentAvatarMini
                studentId={user?.id ?? ''}
                fallbackInitial={user?.name?.[0] || '?'}
                size={72}
                shape="2xl"
              />
              <div className="min-w-0">
                <div className="text-base font-black text-white leading-tight truncate max-w-[130px]" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
                  {user?.name?.split(' ')[0]}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <TierBadge wins={wins} size="sm" showLabel />
                  <span className="text-xs font-bold text-white/30">#{rankPos}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Quick action strip: 3 compact icon+label buttons ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {/* ⚡ Aleatório */}
            <motion.button whileHover={{ scale: 1.05, y: -2, boxShadow: '0 0 20px rgba(34,211,238,0.4)' }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/student/duels/create?auto=1')}
              style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '11px 6px', borderRadius: 14, background: 'linear-gradient(135deg,rgba(34,211,238,0.14),rgba(99,102,241,0.12))', border: '1px solid rgba(34,211,238,0.28)', cursor: 'pointer', boxShadow: '0 0 10px rgba(34,211,238,0.15)' }}>
              <motion.div animate={{ x: ['-130%', '230%'] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
                style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)', pointerEvents: 'none' }} />
              <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 1.6, repeat: Infinity }}
                style={{ color: '#22d3ee', display: 'inline-flex' }}><Zap size={17} /></motion.span>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#22d3ee', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Rajdhani',sans-serif" }}>Aleatório</span>
            </motion.button>

            {/* ⚔️ Desafiar Colega */}
            <motion.button whileHover={{ scale: 1.05, y: -2, boxShadow: '0 0 20px rgba(124,58,237,0.4)' }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/student/duels/create')}
              style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '11px 6px', borderRadius: 14, background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.14))', border: '1px solid rgba(124,58,237,0.35)', cursor: 'pointer', boxShadow: '0 0 10px rgba(124,58,237,0.2)' }}>
              <motion.div animate={{ x: ['-130%', '230%'] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2.5 }}
                style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)', pointerEvents: 'none' }} />
              <motion.span animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ color: '#a78bfa', display: 'inline-flex' }}><Sword size={17} /></motion.span>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#a78bfa', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Rajdhani',sans-serif" }}>Desafiar</span>
            </motion.button>

            {/* 🎮 Treino Solo */}
            <motion.button whileHover={{ scale: 1.05, y: -2, boxShadow: '0 0 14px rgba(255,255,255,0.1)' }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/student/duels/solo')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '11px 6px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer' }}>
              <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                style={{ color: 'rgba(255,255,255,0.5)', display: 'inline-flex' }}><Gamepad2 size={17} /></motion.span>
              <span style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Rajdhani',sans-serif" }}>Solo</span>
            </motion.button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            {[
              { icon: Trophy, val: wins,       label:'Vitórias',  color:'text-emerald-400' },
              { icon: Zap,    val: totalXp,    label:'XP Duelos', color:'text-amber-400' },
              { icon: Target, val: `${accuracy}%`, label:'Precisão', color:'text-indigo-400' },
              { icon: BarChart2, val:`#${rankPos}`, label:'Ranking',  color:'text-violet-400' },
            ].map(({ icon: Icon, val, label, color }) => (
              <div key={label} className="bg-white/5 border border-white/8 rounded-2xl p-3 flex flex-col items-center gap-1">
                <Icon size={18} className={color} />
                <div className={cn('text-lg font-black tabular-nums', color)}>{val}</div>
                <div className="text-[8px] font-black text-white/25 uppercase tracking-wider text-center">{label}</div>
              </div>
            ))}
          </div>

          {/* Tier progress */}
          <div className={cn('rounded-2xl p-3 mb-4 border', tierData.tier.border)}
            style={{ background: tierData.tier.bg }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TierBadge wins={wins} size="sm" showLabel />
                <span className="text-[10px] text-white/40 font-bold">{wins} vitórias</span>
              </div>
              {tierData.nextTier && (
                <span className="text-[10px] text-white/30 font-bold">
                  {tierData.winsToNextTier} para {tierData.nextTier.name}
                </span>
              )}
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${tierData.progressPercent}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{
                  background: near
                    ? `linear-gradient(90deg,${tierData.tier.glow},${tierData.nextTier?.glow})`
                    : `linear-gradient(90deg,${tierData.tier.glow},rgba(255,255,255,0.1))`
                }} />
            </div>
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
