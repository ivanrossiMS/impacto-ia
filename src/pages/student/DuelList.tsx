import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { Trophy, Sword, Clock, History, Zap, Play, Gamepad2, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Duel } from '../../types/duel';

const THEME_EMOJI: Record<string, string> = {
  historia: '📜', geografia: '🌍', arte: '🎨', esportes: '⚽',
  ciencias: '🧪', entretenimento: '🍿', aleatorio: '🎲',
  quem_sou_eu: '🎭', logica: '🧩',
};

const DIFF_LABEL: Record<string, string> = { easy: 'Iniciante', medium: 'Médio', hard: 'Mestre' };
const DIFF_COLOR: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-600', medium: 'bg-amber-50 text-amber-600', hard: 'bg-red-50 text-red-600',
};

export const DuelList: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<'active' | 'pending' | 'history'>('active');
  const [duels, setDuels] = useState<Duel[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [ranking, setRanking] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [{ data: d1 }, { data: d2 }] = await Promise.all([
        supabase.from('duels').select('*').eq('challengerId', user.id),
        supabase.from('duels').select('*').eq('challengedId', user.id),
      ]);
      const all = [...(d1 || []), ...(d2 || [])]
        .filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i) // dedup (solo duels appear in both)
        .filter(d => d.challengerId !== d.challengedId)                 // exclude solo (challengerId===challengedId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const oppIds = Array.from(new Set(
        all.map(d => d.challengerId === user?.id ? d.challengedId : d.challengerId)
           .filter(id => id !== user?.id) // safety: exclude self
      ));
      const { data: oppUsers } = oppIds.length > 0
        ? await supabase.from('users').select('*').in('id', oppIds)
        : { data: [] };

      const { data: myData } = await supabase.from('users').select('classId').eq('id', user.id).single();
      if (myData?.classId) {
        const { data: classmates } = await supabase.from('users').select('id').eq('classId', myData.classId);
        if (classmates) {
          const ids = classmates.map(c => c.id);
          if (!ids.includes(user.id)) ids.push(user.id);
          const { data: stats } = await supabase.from('gamification_stats').select('*').in('id', ids);
          if (stats) {
            stats.sort((a, b) => (b.xp || 0) - (a.xp || 0));
            const r = stats.findIndex(s => s.id === user.id) + 1;
            setRanking(r > 0 ? r : 1);
          }
        }
      }
      setDuels(all); setUsers(oppUsers || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('duels_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const active  = duels.filter(d => d.status === 'active' || (d.status === 'pending' && d.challengerId === user?.id));
  const pending = duels.filter(d => d.status === 'pending' && d.challengedId === user?.id);
  const history = duels.filter(d => d.status === 'completed' || d.status === 'expired');

  const getOpp = (d: Duel) => users.find(u => u.id === (d.challengerId === user?.id ? d.challengedId : d.challengerId));
  const totalWins = history.filter(d => d.winnerId === user?.id).length;
  const totalXp   = history.reduce((acc, d) => {
    if (d.status !== 'completed') return acc;
    const my = d.challengerId === user?.id ? d.challengerScore : d.challengedScore;
    return acc + (d.winnerId === user?.id ? 50 : d.winnerId === 'draw' ? 20 : 10) + my * 15;
  }, 0);

  const StatusBadge = ({ d }: { d: Duel }) => {
    if (d.status === 'pending') {
      return d.challengerId === user?.id
        ? <span className="text-[9px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-black uppercase">Aguardando</span>
        : <span className="text-[9px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-black uppercase animate-pulse">Sua vez ⚡</span>;
    }
    if (d.status === 'active') {
      const myTurn = (d.challengerId === user?.id && !d.challengerTurnCompleted) ||
                     (d.challengedId === user?.id && !d.challengedTurnCompleted);
      return myTurn
        ? <span className="text-[9px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-black uppercase">Sua vez ⚡</span>
        : <span className="text-[9px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-black uppercase">Aguardando</span>;
    }
    if (d.status === 'completed') {
      if (d.winnerId === user?.id) return <span className="text-[9px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-black uppercase">Vitória 🏆</span>;
      if (d.winnerId === 'draw')   return <span className="text-[9px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-black uppercase">Empate</span>;
      return <span className="text-[9px] px-2 py-1 rounded-full bg-red-50 text-red-500 font-black uppercase">Derrota</span>;
    }
    return <span className="text-[9px] px-2 py-1 rounded-full bg-slate-100 text-slate-400 font-black uppercase">Expirado</span>;
  };

  const DuelCard = ({ d }: { d: Duel }) => {
    const opp = getOpp(d);
    const myScore  = d.challengerId === user?.id ? d.challengerScore : d.challengedScore;
    const oppScore = d.challengerId === user?.id ? d.challengedScore : d.challengerScore;
    const canPlay  = d.status === 'active' && (
      (d.challengerId === user?.id && !d.challengerTurnCompleted) ||
      (d.challengedId === user?.id && !d.challengedTurnCompleted)
    );
    const isPending = d.status === 'pending' && d.challengedId === user?.id;

    const accent = canPlay ? 'border-l-violet-500' : isPending ? 'border-l-amber-400'
                 : d.winnerId === user?.id ? 'border-l-emerald-500' : 'border-l-slate-200';

    return (
      <motion.div whileHover={{ y: -2, boxShadow: '0 10px 40px rgba(0,0,0,0.10)' }}
        onClick={() => navigate(`/student/duels/${d.id}`)}
        className={cn('bg-white rounded-[1.75rem] border border-slate-100 border-l-4 cursor-pointer transition-all duration-200 overflow-hidden shadow-sm', accent)}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
              {opp?.avatar ? <img src={opp.avatar} className="w-full h-full object-cover" /> : <span className="text-lg">🧑‍🎓</span>}
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm">{opp?.name || 'Oponente'}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {opp?.grade && (
                  <span className="text-[9px] font-black text-primary-600 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {opp.grade}
                  </span>
                )}
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{THEME_EMOJI[d.theme] || '🎲'} {d.theme}</span>
                <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', DIFF_COLOR[d.difficulty] || DIFF_COLOR.medium)}>{DIFF_LABEL[d.difficulty]}</span>
              </div>
            </div>
          </div>
          <StatusBadge d={d} />
        </div>

        <div className="px-5 pb-3 flex items-center">
          <div className="flex-1 text-center">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Você</div>
            <div className="text-2xl font-black text-slate-800">{myScore}</div>
          </div>
          <div className="px-4 flex flex-col items-center">
            <Sword size={12} className="text-slate-300" />
            <span className="text-[8px] font-black text-slate-300 uppercase mt-0.5">VS</span>
          </div>
          <div className="flex-1 text-center">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate max-w-[100px]">
              {opp?.grade ? opp.grade.split(' ').slice(0,2).join(' ') : opp?.name?.split(' ')[0] || '...'}
            </div>
            <div className="text-2xl font-black text-slate-400">{oppScore}</div>
          </div>
        </div>

        <div className="px-5 pb-4 flex items-center justify-between border-t border-slate-50 pt-3">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{d.questionCount} questões</span>
          {canPlay ? (
            <button onClick={e => { e.stopPropagation(); navigate(`/student/duels/${d.id}`); }}
              className="flex items-center gap-1.5 bg-violet-600 text-white font-black text-[10px] px-3 py-1.5 rounded-xl hover:bg-violet-700 transition-all shadow-md shadow-violet-200">
              <Play size={10} fill="currentColor" /> Jogar
            </button>
          ) : isPending ? (
            <button onClick={e => { e.stopPropagation(); navigate(`/student/duels/${d.id}`); }}
              className="flex items-center gap-1.5 bg-amber-500 text-white font-black text-[10px] px-3 py-1.5 rounded-xl hover:bg-amber-600 transition-all shadow-md shadow-amber-200">
              Aceitar ⚡
            </button>
          ) : (
            <span className="text-[10px] font-black text-slate-400">Ver detalhes →</span>
          )}
        </div>
      </motion.div>
    );
  };

  const Empty = ({ icon: Icon, text, cta, ctaLabel }: { icon: any; text: string; cta: () => void; ctaLabel: string }) => (
    <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4"><Icon size={32} /></div>
      <p className="text-slate-400 font-bold mb-6">{text}</p>
      <button onClick={cta} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">{ctaLabel}</button>
    </div>
  );

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  const TABS = [
    { id: 'active' as const,  label: `Ativos (${active.length})`,  Icon: Sword  },
    { id: 'pending' as const, label: `Convites (${pending.length})`, Icon: Clock  },
    { id: 'history' as const, label: 'Histórico',                   Icon: History },
  ];

  return (
    <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ─── HERO ─── */}
      <div className="relative bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 rounded-[2rem] p-6 shadow-2xl overflow-hidden">
        <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at 20% 70%, #6366f1 0%, transparent 55%), radial-gradient(circle at 85% 15%, #a855f7 0%, transparent 55%)' }} />
        <div className="relative">

          {/* Label */}
          <div className="flex items-center gap-2 mb-3">
            <Sword size={14} className="text-indigo-400 stroke-[3]" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.18em]">Arena de Duelos</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-black text-white mb-0.5">
            Prove seu <span className="text-indigo-400">conhecimento</span>
          </h1>
          <p className="text-white/40 font-bold text-xs mb-5">Desafie colegas ou treine solo e ganhe XP!</p>

          {/* Stats — 3 big cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1.5">
              <Trophy size={32} className="text-emerald-400" />
              <div className="text-2xl font-black text-white tabular-nums">{totalWins}</div>
              <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">Vitórias</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1.5">
              <Zap size={32} className="text-amber-400" />
              <div className="text-2xl font-black text-amber-400 tabular-nums">{totalXp}</div>
              <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">XP Duelos</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1.5">
              <Trophy size={32} className="text-indigo-400" />
              <div className="text-2xl font-black text-indigo-400 tabular-nums">#{ranking}</div>
              <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">Ranking</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-2.5">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/student/duels/solo')}
              className="flex items-center justify-center gap-2 flex-1 h-11 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-sm shadow-lg shadow-indigo-900/50 transition-all">
              <Gamepad2 size={16} /> Jogar Solo
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/student/duels/create')}
              className="flex items-center justify-center gap-2 flex-1 h-11 rounded-2xl bg-white/10 border border-white/20 text-white font-black text-sm hover:bg-white/20 transition-all">
              <Users size={16} /> Desafiar Colega
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── TABS ─── */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem] w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-[1.5rem] text-sm font-black transition-all',
            tab === t.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
          )}>
            <t.Icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ─── DUEL GRID ─── */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {tab === 'active' && (
            active.length === 0
              ? <Empty icon={Sword} text="Nenhum duelo ativo. Desafie um colega!" cta={() => navigate('/student/duels/create')} ctaLabel="Novo Desafio ⚔️" />
              : active.map(d => <DuelCard key={d.id} d={d} />)
          )}
          {tab === 'pending' && (
            pending.length === 0
              ? <Empty icon={Clock} text="Nenhum convite pendente." cta={() => navigate('/student/duels/create')} ctaLabel="Criar Desafio" />
              : pending.map(d => <DuelCard key={d.id} d={d} />)
          )}
          {tab === 'history' && (
            history.length === 0
              ? <Empty icon={History} text="Sem histórico ainda. Complete seu primeiro duelo!" cta={() => navigate('/student/duels/create')} ctaLabel="Iniciar Duelo" />
              : history.map(d => <DuelCard key={d.id} d={d} />)
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

