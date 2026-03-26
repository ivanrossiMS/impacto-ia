import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Users, Lock, Globe, Plus, Hash, ChevronRight, X, Loader2, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { RealtimeDuelService } from '../../services/realtimeDuel.service';
import type { RealtimeRoom, RoomMode } from '../../types/realtimeDuel';
import type { DuelTheme, DuelDifficulty } from '../../types/duel';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';

// ── Theme config ─────────────────────────────────────────────
const THEMES: { id: DuelTheme; emoji: string; label: string; color: string }[] = [
  { id: 'aleatorio',      emoji: '🎲', label: 'Aleatório',   color: '#a78bfa' },
  { id: 'historia',       emoji: '📜', label: 'História',    color: '#fb923c' },
  { id: 'geografia',      emoji: '🌍', label: 'Geografia',   color: '#34d399' },
  { id: 'ciencias',       emoji: '🧬', label: 'Ciências',    color: '#60a5fa' },
  { id: 'arte',           emoji: '🎨', label: 'Arte',        color: '#f472b6' },
  { id: 'esportes',       emoji: '⚽', label: 'Esportes',    color: '#4ade80' },
  { id: 'entretenimento', emoji: '🎬', label: 'Cultura Pop', color: '#facc15' },
  { id: 'quem_sou_eu',    emoji: '🧐', label: 'Quem Sou Eu?',color: '#c084fc' },
  { id: 'logica',         emoji: '🧩', label: 'Lógica',      color: '#38bdf8' },
];

const DIFFICULTIES: { id: DuelDifficulty; label: string; color: string; emoji: string }[] = [
  { id: 'easy',   label: 'Fácil',  color: '#4ade80', emoji: '🌱' },
  { id: 'medium', label: 'Médio',  color: '#fbbf24', emoji: '⚡' },
  { id: 'hard',   label: 'Difícil',color: '#f87171', emoji: '🔥' },
];


// ── All players in room ───────────────────────────────────────
function RoomPlayersRow({ roomId, hostId }: { roomId: string; hostId: string }) {
  const [players, setPlayers] = React.useState<{id:string;name:string;avatarUrl?:string;bgUrl?:string;borderUrl?:string;isHost:boolean}[]>([]);
  const fetchPlayers = React.useCallback(async () => {
    const { data: rp } = await supabase
      .from('realtime_room_players')
      .select('userId')
      .eq('roomId', roomId);
    if (!rp?.length) { setPlayers([]); return; }
    const userIds = rp.map((r:any) => r.userId);
    const [{ data: users }, { data: avps }] = await Promise.all([
      supabase.from('users').select('id,name,avatar').in('id', userIds),
      supabase.from('student_avatar_profiles')
        .select('studentId,selectedAvatarId,selectedBackgroundId,selectedBorderId')
        .in('studentId', userIds),
    ]);
    const allItemIds = Array.from(new Set(
      (avps||[]).flatMap((p:any) => [p.selectedAvatarId,p.selectedBackgroundId,p.selectedBorderId].filter(Boolean))
    ));
    let itemMap: Record<string,any> = {};
    if (allItemIds.length) {
      const { data: items } = await supabase.from('avatar_catalog').select('id,assetUrl,imageUrl').in('id', allItemIds);
      (items||[]).forEach((i:any) => { itemMap[i.id] = i; });
    }
    const avpMap: Record<string,any> = Object.fromEntries((avps||[]).map((p:any) => [p.studentId, p]));
    setPlayers((users||[]).map((u:any) => {
      const avp = avpMap[u.id];
      const av = avp?.selectedAvatarId ? itemMap[avp.selectedAvatarId] : null;
      const bg = avp?.selectedBackgroundId ? itemMap[avp.selectedBackgroundId] : null;
      const bd = avp?.selectedBorderId ? itemMap[avp.selectedBorderId] : null;
      return {
        id: u.id,
        name: u.name || '?',
        avatarUrl: av?.assetUrl || av?.imageUrl || u.avatar,
        bgUrl: bg?.assetUrl || bg?.imageUrl,
        borderUrl: bd?.assetUrl || bd?.imageUrl,
        isHost: u.id === hostId,
      };
    }));
  }, [roomId, hostId]);

  React.useEffect(() => {
    fetchPlayers();
    // Subscribe to player join/leave events so the lobby list stays live
    const ch = supabase.channel(`lobby_players_${roomId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'realtime_room_players',
        filter: `roomId=eq.${roomId}`,
      }, () => { fetchPlayers(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPlayers]);

  if (!players.length) return <div className="h-9 w-24 rounded-xl bg-white/10 animate-pulse" />;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {players.map(p => (
        <div key={p.id} className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-indigo-500/30">
            {p.avatarUrl
              ? <AvatarComposer avatarUrl={p.avatarUrl} backgroundUrl={p.bgUrl} borderUrl={p.borderUrl} size="sm" animate={false} isFloating={false} className="w-8 h-8" />
              : <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-black text-xs">{p.name[0]}</div>}
          </div>
          <div>
            <p className="text-[10px] font-black text-white leading-tight truncate max-w-[64px]" style={{fontFamily:"'Rajdhani',sans-serif"}}>
              {p.name.split(' ').slice(0,2).join(' ')}
            </p>
            {p.isHost && <span className="text-[8px] text-yellow-400 font-black">👑 Host</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Player count badge ────────────────────────────────────────
function PlayerCount({ roomId, max }: { roomId: string; max: number }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.from('realtime_room_players').select('id').eq('roomId', roomId).then(({ data }) => {
      if (mounted) setCount(data?.length ?? 0);
    });
    return () => { mounted = false; };
  }, [roomId]);
  if (count === null) return <span className="text-white/30 text-xs">…/{max}</span>;
  return <span className={cn('text-xs font-black', count >= max ? 'text-red-400' : 'text-emerald-400')}>{count}/{max}</span>;
}

// ── Create Room Modal ─────────────────────────────────────────
const CreateRoomModal: React.FC<{
  onClose: () => void;
  onCreate: (theme: DuelTheme, difficulty: DuelDifficulty, mode: RoomMode, isPrivate: boolean, autoBalance: boolean) => Promise<void>;
  loading: boolean;
}> = ({ onClose, onCreate, loading }) => {
  const [theme, setTheme] = useState<DuelTheme>('aleatorio');
  const [difficulty, setDifficulty] = useState<DuelDifficulty>('medium');
  const [mode, setMode] = useState<RoomMode>('1v1');
  const [isPrivate, setIsPrivate] = useState(false);
  const [autoBalance, setAutoBalance] = useState(false);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-0 sm:px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#0b1021 0%,#10142e 100%)', border: '1px solid rgba(99,102,241,0.25)' }}
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {/* Handle */}
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-white/20 mx-auto mt-3 mb-2" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.04em' }}>
                ⚡ Criar Sala
              </h2>
              <p className="text-xs text-white/40 font-bold mt-0.5">Configure seu duelo em tempo real</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition-all">
              <X size={16} />
            </button>
          </div>

          {/* Mode */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Modo</p>
            <div className="grid grid-cols-2 gap-2.5">
              {(['1v1','2v2'] as RoomMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'h-14 rounded-2xl flex flex-col items-center justify-center gap-1 border font-black text-sm transition-all',
                    mode === m
                      ? 'bg-indigo-600/30 border-indigo-500/70 text-white shadow-lg shadow-indigo-900/40'
                      : 'bg-white/4 border-white/10 text-white/50 hover:bg-white/8'
                  )}
                >
                  <span className="text-lg">{m === '1v1' ? '⚔️' : '🛡️'}</span>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif" }}>{m}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Tema</p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    'h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 border text-[11px] font-black transition-all',
                    theme === t.id
                      ? 'border-2' : 'bg-white/4 border-white/10 text-white/50 hover:bg-white/8'
                  )}
                  style={theme === t.id ? {
                    background: `${t.color}18`, borderColor: `${t.color}80`, color: t.color,
                  } : {}}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span>{t.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Dificuldade</p>
            <div className="grid grid-cols-3 gap-2.5">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={cn(
                    'h-12 rounded-2xl flex items-center justify-center gap-1.5 border font-black text-sm transition-all',
                    difficulty === d.id ? 'border-2' : 'bg-white/4 border-white/10 text-white/50 hover:bg-white/8'
                  )}
                  style={difficulty === d.id ? {
                    background: `${d.color}18`, borderColor: `${d.color}80`, color: d.color,
                  } : {}}
                >
                  {d.emoji} {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
            <div className="flex items-center gap-3">
              {isPrivate ? <Lock size={16} className="text-amber-400" /> : <Globe size={16} className="text-emerald-400" />}
              <div>
                <p className="text-sm font-black text-white">{isPrivate ? 'Sala Privada' : 'Sala Pública'}</p>
                <p className="text-[10px] text-white/40 font-bold">{isPrivate ? 'Só entra com código' : 'Aparece na lista pública'}</p>
              </div>
            </div>
            <button
              onClick={() => setIsPrivate(p => !p)}
              className={cn(
                'w-11 h-6 rounded-full relative transition-all duration-200',
                isPrivate ? 'bg-amber-500' : 'bg-white/15'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200',
                isPrivate ? 'left-[22px]' : 'left-0.5'
              )} />
            </button>
          </div>

          {/* AI Balancing */}
          <div className="flex items-start justify-between bg-white/5 rounded-2xl px-4 py-3 border border-white/10 gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-base">🤖</span>
              </div>
              <div>
                <p className="text-sm font-black text-white">IA de Balanceamento Automático</p>
                <p className="text-[10px] text-violet-300/80 font-bold mt-0.5">Séries de níveis diferentes. A IA usará a menor série como base.</p>
                {autoBalance && (
                  <p className="text-[10px] text-white/40 font-medium mt-1">Ajustado para: menor série entre os jogadores da sala</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setAutoBalance(b => !b)}
              className={cn(
                'w-11 h-6 rounded-full relative transition-all duration-200 shrink-0 mt-1',
                autoBalance ? 'bg-violet-500' : 'bg-white/15'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200',
                autoBalance ? 'left-[22px]' : 'left-0.5'
              )} />
            </button>
          </div>

          {/* Create CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => onCreate(theme, difficulty, mode, isPrivate, autoBalance)}
            disabled={loading}
            className="w-full h-14 rounded-2xl font-black text-white text-base relative overflow-hidden disabled:opacity-70"
            style={{
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              boxShadow: '0 8px 32px rgba(79,70,229,0.45)',
              fontFamily: "'Rajdhani',sans-serif",
              letterSpacing: '0.06em',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Gerando questões…
              </span>
            ) : '⚡ CRIAR SALA'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Room Card ─────────────────────────────────────────────────
const RoomCard: React.FC<{ room: RealtimeRoom; onJoin: (room: RealtimeRoom) => void; joining: string | null }> = ({ room, onJoin, joining }) => {
  const theme = THEMES.find(t => t.id === room.theme) ?? THEMES[0];
  const diff  = DIFFICULTIES.find(d => d.id === room.difficulty) ?? DIFFICULTIES[1];
  const max   = room.mode === '2v2' ? 4 : 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${theme.color}44` }}
      className="rounded-3xl overflow-hidden cursor-pointer relative"
      style={{
        background: 'linear-gradient(145deg,#0d1224,#111827)',
        border: `1px solid rgba(255,255,255,0.06)`,
      }}
      onClick={() => onJoin(room)}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg,transparent,${theme.color}80,transparent)` }} />

      <div className="p-4 flex items-center gap-3">
        {/* Theme icon */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{ background: `${theme.color}18`, border: `1px solid ${theme.color}40` }}>
          {theme.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {room.isPrivate && (
              <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg border text-amber-400 bg-amber-500/10 border-amber-500/30">
                <Lock size={10} /> Privada
              </span>
            )}
            <span className="font-black text-sm text-white" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
              {theme.label}
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border"
              style={{ color: diff.color, background: `${diff.color}18`, borderColor: `${diff.color}50` }}>
              {diff.emoji} {diff.label}
            </span>
            <span className="text-[10px] font-black text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded-lg border border-indigo-500/30">
              {room.mode}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-white/40">
              <Users size={11} />
              <PlayerCount roomId={room.id} max={max} />
            </div>
            <RoomPlayersRow roomId={room.id} hostId={room.hostId} />
          </div>
        </div>

        <motion.div
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 4px 16px rgba(79,70,229,0.4)' }}
        >
          {joining === room.id ? <Loader2 size={16} className="animate-spin text-white" /> : <ChevronRight size={16} className="text-white" />}
        </motion.div>
      </div>
    </motion.div>
  );
};

// ── Main Component ────────────────────────────────────────────
type TabId = 'rooms' | 'code';

export const RealtimeDuelLobby: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<TabId>('rooms');
  const [rooms, setRooms] = useState<RealtimeRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [showPrivateCodePrompt, setShowPrivateCodePrompt] = useState<RealtimeRoom | null>(null);
  const [privateCodeInput, setPrivateCodeInput] = useState('');
  const [rejoinRoom, setRejoinRoom] = useState<RealtimeRoom | null>(null);
  const [joiningPrivate, setJoiningPrivate] = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const list = await RealtimeDuelService.getPublicRooms();
      // Only show waiting rooms in lobby
      setRooms(list.filter(r => r.status === 'waiting'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  // On mount, check if user has a rejoinable room
  useEffect(() => {
    if (!user) return;
    RealtimeDuelService.getRejoinableRoom(user.id).then(r => {
      if (r) setRejoinRoom(r);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchRooms();
    const ch = supabase.channel('rt_lobby_rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'realtime_rooms' }, fetchRooms)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRooms]);

  const handleCreate = async (theme: DuelTheme, difficulty: DuelDifficulty, mode: RoomMode, isPrivate: boolean, autoBalance: boolean) => {
    if (!user) return;
    setCreating(true);
    try {
      const grade = (user as any).grade || '';
      const room = await RealtimeDuelService.createRoom(user.id, theme, difficulty, mode, isPrivate, grade, autoBalance);
      setShowCreate(false);
      toast.success(`Sala criada! Código: ${room.code} 🎉`);
      navigate(`/student/duels/realtime/${room.id}`, { state: { room } });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar sala.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (room: RealtimeRoom) => {
    if (!user) return;
    setJoining(room.id);
    try {
      await RealtimeDuelService.joinRoomByCode(room.code, user.id);
      navigate(`/student/duels/realtime/${room.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao entrar na sala.');
    } finally {
      setJoining(null);
    }
  };

  const handleRoomClick = (room: RealtimeRoom) => {
    if (room.isPrivate) {
      setShowPrivateCodePrompt(room);
      setPrivateCodeInput('');
    } else {
      handleJoin(room);
    }
  };

  const handleCodeJoin = async () => {
    if (!user || !codeInput.trim()) return;
    setCodeLoading(true);
    try {
      const room = await RealtimeDuelService.joinRoomByCode(codeInput.trim(), user.id);
      navigate(`/student/duels/realtime/${room.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Código inválido.');
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <div className="min-h-screen -mx-4 -mt-4 px-4 pt-4" style={{ background: 'linear-gradient(160deg,#030712 0%,#09102a 60%,#0f0a2e 100%)' }}>
    <div className="pb-20 space-y-5 max-w-xl mx-auto">
      <AnimatePresence>
        {showCreate && (
          <CreateRoomModal
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
            loading={creating}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrivateCodePrompt && (
          <motion.div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-0 sm:px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => !joiningPrivate && setShowPrivateCodePrompt(null)} />
            <motion.div className="relative z-10 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] overflow-hidden p-6 text-center"
              style={{ background: 'linear-gradient(145deg,#0d1224,#111827)', border: '1px solid rgba(255,255,255,0.07)' }}
              initial={{ y: 80, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 80, opacity: 0, scale: 0.95 }}>
              <div className="text-5xl mb-3">🔑</div>
              <h3 className="text-xl font-black text-white" style={{ fontFamily: "'Rajdhani',sans-serif" }}>Sala Privada</h3>
              <p className="text-xs text-white/40 font-bold mt-1 mb-5">Digite o código de 4 dígitos para entrar</p>

              <input
                type="text" placeholder="0000" maxLength={4}
                value={privateCodeInput}
                onChange={e => setPrivateCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && privateCodeInput.length === 4) {
                    e.preventDefault();
                    setJoiningPrivate(true);
                    try {
                      await RealtimeDuelService.joinRoomByCode(privateCodeInput.trim(), user!.id);
                      setShowPrivateCodePrompt(null);
                      navigate(`/student/duels/realtime/${showPrivateCodePrompt!.id}`);
                    } catch (err: any) {
                      toast.error(err.message || 'Código inválido ou sala encerrada.');
                    } finally { setJoiningPrivate(false); }
                  }
                }}
                autoFocus
                disabled={joiningPrivate}
                className="w-full h-14 mb-4 rounded-xl text-center text-3xl font-black tracking-[0.3em] text-white bg-white/5 border border-white/10 focus:border-indigo-500/70 focus:outline-none transition-all placeholder:text-white/20 disabled:opacity-50"
                style={{ fontFamily: "'Orbitron',monospace" }}
              />

              <div className="flex gap-3">
                <button
                  disabled={joiningPrivate}
                  onClick={() => setShowPrivateCodePrompt(null)}
                  className="flex-1 h-12 rounded-xl bg-white/10 text-white font-black hover:bg-white/15 transition-all text-sm disabled:opacity-50"
                >Cancelar</button>
                <button
                  disabled={joiningPrivate || privateCodeInput.length < 4}
                  onClick={async () => {
                    if (!user || !showPrivateCodePrompt) return;
                    setJoiningPrivate(true);
                    try {
                      await RealtimeDuelService.joinRoomByCode(privateCodeInput.trim(), user.id);
                      setShowPrivateCodePrompt(null);
                      navigate(`/student/duels/realtime/${showPrivateCodePrompt.id}`);
                    } catch (err: any) {
                      toast.error(err.message || 'Código inválido ou sala encerrada.');
                    } finally { setJoiningPrivate(false); }
                  }}
                  className="flex-1 h-12 rounded-xl font-black text-white transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                  {joiningPrivate ? <Loader2 size={16} className="animate-spin" /> : null}
                  Entrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(135deg,#020617 0%,#0f0a2e 50%,#1a0533 100%)' }}
      >
        {/* Glows */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-12 -left-12 w-56 h-56 rounded-full blur-[80px]"
            style={{ background: 'radial-gradient(circle,#6366f1,transparent)' }}
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute -bottom-12 -right-12 w-56 h-56 rounded-full blur-[80px]"
            style={{ background: 'radial-gradient(circle,#a855f7,transparent)' }}
          />
        </div>
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 p-6 text-center">
          {/* Icon burst */}
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-4 drop-shadow-2xl"
          >
            ⚡
          </motion.div>
          <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>
            DUELO EM TEMPO REAL
          </h1>
          <p className="text-sm text-white/50 font-bold mb-5">
            Enfrente rivais ao vivo, pergunta por pergunta, em sincronismo total
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {[
              { icon: '⚔️', label: '1v1 ou 2v2' },
              { icon: '🔄', label: 'Sincronizado' },
              { icon: '⚡', label: '8 Perguntas' },
              { icon: '🛡️', label: 'Poderes Ativos' },
            ].map(p => (
              <span key={p.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-xs font-black text-white/70">
                {p.icon} {p.label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreate(true)}
            className="w-full h-14 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              boxShadow: '0 8px 40px rgba(79,70,229,0.55)',
              fontFamily: "'Rajdhani',sans-serif",
              letterSpacing: '0.07em',
            }}
          >
            <Plus size={20} strokeWidth={3} /> CRIAR SALA
          </motion.button>
        </div>
      </motion.div>

      {/* Rejoin Banner */}
      <AnimatePresence>
        {rejoinRoom && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/30 px-4 py-3 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg,rgba(6,78,59,0.6),rgba(16,42,28,0.8))' }}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-xl">⚔️</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-emerald-300" style={{fontFamily:"'Rajdhani',sans-serif"}}>Você tem um duelo em andamento!</p>
              <p className="text-[10px] text-emerald-400/60 font-bold">Clique para voltar e continuar jogando</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={async () => {
                // Ignore = forfeit that room (player automatically loses)
                try {
                  await RealtimeDuelService.forfeitPlayer(rejoinRoom.id, user!.id);
                } catch (e) { console.warn('forfeit error', e); }
                setRejoinRoom(null);
              }} className="text-white/30 hover:text-red-400 transition-colors text-xs font-bold">🏳️ Desistir</button>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => navigate(`/student/duels/realtime/${rejoinRoom.id}`)}
                className="h-9 px-4 rounded-xl font-black text-white text-xs"
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' }}
              >
                ⚔️ Voltar ao Duelo
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Bar */}
      <div className="flex gap-2 p-1 rounded-2xl bg-white/5 border border-white/8">
        {[
          { id: 'rooms' as TabId, label: '🌐 Salas Abertas', icon: Globe },
          { id: 'code' as TabId, label: '🔑 Entrar com Código', icon: Hash },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 h-10 rounded-xl font-black text-sm transition-all',
              tab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-white/50 hover:text-white/80'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Salas Abertas */}
      <AnimatePresence mode="wait">
        {tab === 'rooms' && (
          <motion.div key="rooms" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-white/40 uppercase tracking-widest">
                {loading ? 'Buscando…' : `${rooms.length} sala${rooms.length !== 1 ? 's' : ''} disponível${rooms.length !== 1 ? 'is' : ''}`}
              </p>
              <button onClick={fetchRooms} className="flex items-center gap-1.5 text-xs font-black text-indigo-400 hover:text-indigo-300">
                <RefreshCw size={12} /> Atualizar
              </button>
            </div>

            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <motion.div key={i} animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
                  className="h-20 rounded-3xl bg-white/6" />
              ))
            ) : rooms.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="py-16 text-center rounded-3xl border border-dashed border-white/10 bg-white/3 space-y-3">
                <div className="text-5xl">⚡</div>
                <p className="text-white/40 font-bold text-sm">Nenhuma sala aberta no momento.</p>
                <p className="text-white/25 text-xs font-bold">Crie uma sala ou entre com um código!</p>
              </motion.div>
            ) : (
              rooms.map(room => (
                <RoomCard key={room.id} room={room} onJoin={handleRoomClick} joining={joining} />
              ))
            )}
          </motion.div>
        )}

        {tab === 'code' && (
          <motion.div key="code" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <div className="rounded-3xl overflow-hidden"
              style={{ background: 'linear-gradient(145deg,#0d1224,#111827)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-6 space-y-5 text-center">
                <div>
                  <div className="text-5xl mb-3">🔑</div>
                  <h3 className="text-base font-black text-white" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
                    Entrar com Código
                  </h3>
                  <p className="text-xs text-white/40 font-bold mt-1">
                    Peça o código de 6 dígitos ao criador da sala
                  </p>
                </div>

                {/* Code input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="0000"
                    maxLength={4}
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onKeyDown={e => e.key === 'Enter' && handleCodeJoin()}
                    className="w-full h-16 rounded-2xl text-center text-3xl font-black tracking-[0.3em] text-white bg-white/8 border border-white/15 focus:border-indigo-500/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-white/20 placeholder:tracking-[0.2em]"
                    style={{ fontFamily: "'Orbitron',monospace" }}
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={handleCodeJoin}
                  disabled={codeLoading || codeInput.trim().length < 4}
                  className="w-full h-14 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    boxShadow: '0 8px 32px rgba(79,70,229,0.4)',
                    fontFamily: "'Rajdhani',sans-serif",
                    letterSpacing: '0.06em',
                  }}
                >
                  {codeLoading ? <Loader2 size={18} className="animate-spin" /> : <><Zap size={18} fill="currentColor" /> ENTRAR NA SALA</>}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info footer */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="rounded-2xl p-4 flex items-start gap-3 border border-white/6 bg-white/3">
        <Shield size={16} className="text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-black text-white/60">Como funciona</p>
          <p className="text-[11px] text-white/35 font-bold mt-0.5 leading-relaxed">
            Todos os jogadores respondem as questões ao mesmo tempo. A próxima pergunta só é liberada quando todos responderam. Use poderes para ganhar vantagem!
          </p>
        </div>
      </motion.div>
    </div>
    </div>
  );
};
