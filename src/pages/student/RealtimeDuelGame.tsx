import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Zap, Users, CheckCircle2, XCircle, Loader2, Shield, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { RealtimeDuelService } from '../../services/realtimeDuel.service';
import type { RealtimeRoom, RealtimeRoomPlayer, RealtimeRoomQuestion } from '../../types/realtimeDuel';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';
import { AnswerFeedbackOverlay, type FeedbackType } from '../../components/ui/AnswerFeedbackOverlay';
import { TIME_PER_QUESTION, calcQuestionScore, MAX_ENERGY } from '../../lib/duelScoring';
import { calcDuelRewards } from '../../lib/duelRewards';
import { incrementMissionProgress } from '../../lib/missionUtils';
import type { DuelAnswerData, DuelPowerType } from '../../types/duel';

type Phase = 'loading' | 'waiting' | 'cinematic' | 'playing' | 'finished';

const LETTERS = ['A','B','C','D'];

const DUEL_THEMES: Record<string, { emoji: string; label: string; color: string }> = {
  aleatorio:{emoji:'🎲',label:'Aleatório',color:'#a78bfa'},
  historia:{emoji:'📜',label:'História',color:'#fb923c'},
  geografia:{emoji:'🌍',label:'Geografia',color:'#34d399'},
  ciencias:{emoji:'🧬',label:'Ciências',color:'#60a5fa'},
  arte:{emoji:'🎨',label:'Arte',color:'#f472b6'},
  esportes:{emoji:'⚽',label:'Esportes',color:'#4ade80'},
  entretenimento:{emoji:'🎬',label:'Cultura Pop',color:'#facc15'},
  quem_sou_eu:{emoji:'🧐',label:'Quem Sou Eu?',color:'#c084fc'},
  logica:{emoji:'🧩',label:'Lógica',color:'#38bdf8'},
};

type PowerCat = 'defense' | 'control' | 'strategy' | 'boost';
const POWERS_INFO: Record<string, {
  emoji:string; label:string; desc:string;
  color:string; bg:string; border:string; glow:string;
  cat:PowerCat; cost:number;
}> = {
  shield:         { emoji:'🛡️', label:'Escudo',          desc:'Bloqueia 1 erro — mantém streak e energia',            color:'text-cyan-300',    bg:'from-cyan-950 to-blue-950',        border:'border-cyan-500/50',    glow:'rgba(34,211,238,0.45)',   cat:'defense',  cost:1 },
  dica:           { emoji:'💡', label:'Dica',             desc:'Revela uma dica da questão atual',                      color:'text-amber-300',   bg:'from-amber-950 to-yellow-950',     border:'border-amber-500/50',   glow:'rgba(251,191,36,0.45)',   cat:'strategy', cost:2 },
  freeze:         { emoji:'❄️', label:'Congelar',         desc:'+10 segundos no cronômetro desta questão',              color:'text-blue-200',    bg:'from-blue-950 to-indigo-950',      border:'border-blue-400/50',    glow:'rgba(96,165,250,0.45)',   cat:'control',  cost:2 },
  turbo:          { emoji:'⚡', label:'Turbo',             desc:'Próximos 3 acertos dão energia em dobro',               color:'text-yellow-300',  bg:'from-yellow-950 to-amber-950',     border:'border-yellow-500/50',  glow:'rgba(234,179,8,0.45)',    cat:'boost',    cost:1 },
  swap:           { emoji:'🔄', label:'Trocar Questão',   desc:'Substitui a pergunta atual por outra',                  color:'text-teal-300',    bg:'from-teal-950 to-emerald-950',     border:'border-teal-500/50',    glow:'rgba(20,184,166,0.45)',   cat:'strategy', cost:3 },
  eliminate:      { emoji:'✂️', label:'Eliminar',         desc:'Remove 2 alternativas erradas da questão',              color:'text-purple-300',  bg:'from-purple-950 to-fuchsia-950',   border:'border-purple-500/50',  glow:'rgba(168,85,247,0.45)',  cat:'strategy', cost:4 },
  segunda_chance: { emoji:'⏳', label:'Segunda Chance',   desc:'Permite responder novamente se errar',                  color:'text-orange-300',  bg:'from-orange-950 to-red-950',       border:'border-orange-500/50',  glow:'rgba(251,146,60,0.45)',   cat:'defense',  cost:3 },
  queima:         { emoji:'🔥', label:'Queima de Energia',desc:'Cada energia gasta = +20% de pontos na próxima questão',color:'text-yellow-300',  bg:'from-yellow-950 to-orange-950',    border:'border-yellow-500/60',  glow:'rgba(251,191,36,0.55)',   cat:'boost',    cost:1 },
};

const ALL_POWERS = ['shield','dica','freeze','turbo','swap','eliminate','segunda_chance','queima'] as const;
const MAX_POWERS = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

// ── Avatar helper ─────────────────────────────────────────────
const PlayerAvatar: React.FC<{ player: RealtimeRoomPlayer; size?: string }> = ({ player, size='w-[90px] h-[90px]' }) => {
  if (player.avatarCompose?.avatarUrl) {
    return (
      <AvatarComposer
        avatarUrl={player.avatarCompose.avatarUrl}
        backgroundUrl={player.avatarCompose.backgroundUrl}
        borderUrl={player.avatarCompose.borderUrl}
        stickerUrls={player.avatarCompose.stickerUrls ?? []}
        size="md"
        animate={false}
        isFloating={false}
        className={size}
      />
    );
  }
  return (
    <div className={cn('rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-600',size)}>
      {player.avatar
        ? <img src={player.avatar} className="w-full h-full object-cover" onError={e=>{(e.target as any).src='/avatars/default-impacto.png'}} />
        : <div className="w-full h-full flex items-center justify-center text-3xl text-white">🧑‍🎓</div>}
    </div>
  );
};

export const RealtimeDuelGame: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(s => s.user);

  // ── Core state ────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('loading');
  // Seed room from navigation state (host path) to avoid read-replica lag after INSERT
  const [room, setRoom] = useState<RealtimeRoom | null>(
    (location.state as any)?.room ?? null
  );
  const [players, setPlayers] = useState<RealtimeRoomPlayer[]>([]);
  const [questions, setQuestions] = useState<RealtimeRoomQuestion[]>([]);
  const [shuffledMap, setShuffledMap] = useState<Record<string,any[]>>({});
  const isHost = room?.hostId === user?.id;

  // ── Game state ────────────────────────────────────────────
  const [selectedAnswer, setSelectedAnswer] = useState<string|null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [_answerData, setAnswerData] = useState<DuelAnswerData[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [usedPowers, setUsedPowers] = useState<DuelPowerType[]>([]);
  const [activePower, setActivePower] = useState<DuelPowerType|null>(null);
  const [shieldActive, setShieldActive] = useState(false);
  const [turboRemaining, setTurboRemaining] = useState(0);
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [showPowerPanel, setShowPowerPanel] = useState(false);
  const [secondChanceAvailable, setSecondChanceAvailable] = useState(false);
  const [freezeActive, setFreezeActive] = useState(false);
  const [powerActivationAnim, setPowerActivationAnim] = useState<string|null>(null);
  const [showQueimModal, setShowQueimModal] = useState(false);
  const [queimAmount, setQueimAmount] = useState(1);
  const [energyBurnBonus, setEnergyBurnBonus] = useState(0);
  const [energyBurnTargetQuestion, setEnergyBurnTargetQuestion] = useState(-1);
  const [showBonusFlash, setShowBonusFlash] = useState<string|null>(null);
  const [feedback, setFeedback] = useState<{type: FeedbackType;correctText?:string;pointsEarned?:number;explanation?:string}|null>(null);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [readyForNext, setReadyForNext] = useState(false);
  const [pendingEntry, setPendingEntry] = useState<DuelAnswerData|null>(null);
  const [abandonCountdown, setAbandonCountdown] = useState(90);

  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const abandonRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const roomRef = useRef<typeof room>(null);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  // Refs needed for cleanup in event listeners (avoid stale closures)
  const roomIdRef = useRef<string | undefined>(roomId);
  const userIdRef = useRef<string | undefined>(user?.id);
  const isHostRef = useRef<boolean>(false); // updated after fetchAll resolves
  // Track mount time to guard against React StrictMode double-invoke
  const mountedAtRef = useRef<number>(Date.now());
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);
  const deadlineKey = `rt_deadline_${roomId}_q${room?.currentQuestion ?? 0}`;

  const clearTimer = () => { if(timerRef.current) clearInterval(timerRef.current); };

  // ── Fetch room + players + questions ─────────────────────────
  const fetchAll = useCallback(async () => {
    if (!roomId || !user) return;
    // If room is already seeded from navigation state, skip joinRoomById
    const [r, q] = await Promise.all([
      room ? Promise.resolve(room) : RealtimeDuelService.joinRoomById(roomId, user.id),
      RealtimeDuelService.getQuestions(roomId),
    ]);
    setRoom(r);
    roomRef.current = r;
    isHostRef.current = r.hostId === user?.id; // update role ref
    if (q.length > 0) {
      setQuestions(q.slice(0, r.totalQuestions));
      const m: Record<string,any[]> = {};
      q.forEach(qq => { m[qq.id] = shuffle(qq.options); });
      setShuffledMap(m);
    }
    const p = await RealtimeDuelService.getPlayersWithInfo(roomId);
    setPlayers(p);

    // Set phase based on room status
    if (r.status === 'waiting') setPhase('waiting');
    else if (r.status === 'starting') setPhase('cinematic');
    else if (r.status === 'playing') setPhase('playing');
    else if (r.status === 'finished') setPhase('finished');
  }, [roomId, user]); // intentionally omit `room` to avoid re-running when room updates

  // Fetch players only (lightweight)
  const fetchPlayers = useCallback(async () => {
    if (!roomId) return;
    const p = await RealtimeDuelService.getPlayersWithInfo(roomId);
    setPlayers(p);
  }, [roomId]);

  useEffect(() => {
    fetchAll();
    const roomCh = supabase.channel(`rt_room_${roomId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'realtime_rooms', filter:`id=eq.${roomId}` },
        async (payload) => {
          const r = payload.new as RealtimeRoom;
          setRoom(r);
          roomRef.current = r;
          isHostRef.current = r.hostId === user?.id; // update role ref
          // Always refresh players on any room change (fallback in case player DELETE event misses filter)
          await fetchPlayers();
          // Transition phases
          if (r.status === 'starting') { setPhase('cinematic'); }
          if (r.status === 'playing') {
            // Fetch questions (host may already have them; guest needs them)
            const q = await RealtimeDuelService.getQuestions(roomId!);
            if (q.length > 0) {
              setQuestions(q.slice(0, r.totalQuestions ?? 8));
              const m: Record<string,any[]> = {};
              q.forEach((qq: any) => { m[qq.id] = shuffle(qq.options); });
              setShuffledMap(m);
            }
            // Reset all per-question state
            setAnswered(false); setSelectedAnswer(null); setFeedback(null);
            setFeedbackDismissed(false); setReadyForNext(false); setPendingEntry(null);
            setAbandonCountdown(45);
            if (abandonRef.current) clearInterval(abandonRef.current);
            setActivePower(null); setEliminatedIds([]); setShowHint(false);
            localStorage.removeItem(deadlineKey);
            setPhase('playing');
          }
          if (r.status === 'finished') setPhase('finished');
        })
      .on('postgres_changes', { event:'*', schema:'public', table:'realtime_room_players', filter:`roomId=eq.${roomId}` },
        async (_payload) => {
          await fetchPlayers();
          // Host: check if all answered — advance question (use roomRef for current state)
          const currentRoom = roomRef.current;
          if (currentRoom && user && currentRoom.hostId === user.id && currentRoom.status === 'playing') {
            const p = await RealtimeDuelService.getPlayersWithInfo(roomId!);
            const allAnswered = p.length > 0 && p.every(pl => pl.hasAnsweredCurrent);
            if (allAnswered) {
              const next = (currentRoom.currentQuestion ?? 0) + 1;
              await RealtimeDuelService.advanceQuestion(roomId!, next, currentRoom.totalQuestions);
              if (next >= currentRoom.totalQuestions) {
                await incrementMissionProgress(user.id, 'duel_completed');
                await incrementMissionProgress(user.id, 'duel_realtime_completed');
              }
            }
          }
        })
      .subscribe();

    // Also fetch questions when they appear (generated async)
    const qCh = supabase.channel(`rt_questions_${roomId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'realtime_room_questions', filter:`roomId=eq.${roomId}` },
        async () => {
          const q = await RealtimeDuelService.getQuestions(roomId!);
          if (q.length > 0) {
            setQuestions(prev => prev.length === 0 ? q.slice(0, 8) : prev);
            const m: Record<string,any[]> = {};
            q.forEach(qq => { m[qq.id] = shuffle(qq.options); });
            setShuffledMap(m);
          }
        })
      .subscribe();

    return () => {
      supabase.removeChannel(roomCh);
      supabase.removeChannel(qCh);
      // Role-aware unmount guard:
      // - Host: 2000ms guard to prevent React StrictMode from deleting the room on dev double-invoke
      // - Guest: 200ms guard (long enough to skip StrictMode ~50ms cycle, short enough to clean up quick exits)
      const rid = roomIdRef.current;
      const uid = userIdRef.current;
      const mountedMs = Date.now() - mountedAtRef.current;
      const guardMs = isHostRef.current ? 2000 : 200;
      if (rid && uid && mountedMs > guardMs) {
        RealtimeDuelService.leaveRoom(rid, uid).catch(() => {});
      }
    };
  }, [roomId, user?.id]);

  // ── Cinematic auto-advance ─────────────────────────────────
  // Transition is driven by Realtime 'playing' status — no timer needed.
  // We just keep playing cinematic animations until questions are ready.

  // ── Timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || answered) return;
    const stored = localStorage.getItem(deadlineKey);
    const now = Date.now();
    let deadline: number;
    if (!stored) {
      deadline = now + TIME_PER_QUESTION * 1000;
      localStorage.setItem(deadlineKey, String(deadline));
    } else {
      deadline = Number(stored);
    }
    setTimeLeft(Math.max(0, Math.ceil((deadline - now) / 1000)));
    clearTimer();
    timerRef.current = setInterval(() => {
      const secs = Math.max(0, Math.ceil((Number(localStorage.getItem(deadlineKey) || deadline) - Date.now()) / 1000));
      setTimeLeft(secs);
      if (secs <= 0) { clearTimer(); handleTimeout(); }
    }, 500);
    return () => clearTimer();
  }, [phase, room?.currentQuestion, answered]);

  const handleTimeout = () => {
    if (answered) return;
    clearTimer();
    const q = questions[room?.currentQuestion ?? 0];
    if (!q) return;
    const entry: DuelAnswerData = {
      questionId: q.id, selectedOptionId: 'timeout_skip', isCorrect: false,
      timeUsed: TIME_PER_QUESTION, timeMax: TIME_PER_QUESTION, pointsEarned: 0,
      speedBonus: 0, streakBonus: 0, comboMultiplier: 1, streakAtAnswer: currentStreak,
    };
    setAnswerData(prev => [...prev, entry]);
    setCurrentStreak(0);
    setAnswered(true);
    setPendingEntry(entry);
    const correct = q.options.find((o:any) => o.isCorrect);
    // Timeout: feedback auto-dismisses (not manual) — no waiting for the player
    setFeedback({ type: 'timeout', correctText: correct?.text, explanation: q.explanation });
    // User must dismiss feedback and manually click "Próxima Pergunta" to proceed
  };

  const submitToServer = async (entry: DuelAnswerData) => {
    if (!roomId || !user || !room) return;
    try {
      await RealtimeDuelService.submitAnswer(
        roomId, user.id, entry,
        entry.isCorrect ? 1 : 0, entry.pointsEarned, room,
      );
    } catch(e) { console.error(e); }
  };

  // Called when player clicks "Próxima Pergunta"
  const handleGoNext = async () => {
    if (!pendingEntry || readyForNext) return;
    setReadyForNext(true);
    await submitToServer(pendingEntry);
    // Host checks if all answered after submission
    if (isHost && roomId && room) {
      const p = await RealtimeDuelService.getPlayersWithInfo(roomId);
      const allAnswered = p.length > 0 && p.every(pl => pl.hasAnsweredCurrent);
      if (allAnswered) {
        const next = (room.currentQuestion ?? 0) + 1;
        await RealtimeDuelService.advanceQuestion(roomId, next, room.totalQuestions);
        if (next >= room.totalQuestions) {
          await incrementMissionProgress(user!.id, 'duel_completed');
          await incrementMissionProgress(user!.id, 'duel_realtime_completed');
        }
      }
    }
  };

  // Abandon timer — runs for ANY player who already answered, giving fair pressure
  useEffect(() => {
    if (!answered) return;
    setAbandonCountdown(45);
    abandonRef.current = setInterval(() => {
      setAbandonCountdown(prev => {
        if (prev <= 1) {
          clearInterval(abandonRef.current!);
          // Only the host advances the question to avoid race conditions
          if (isHost && roomId && room) {
            RealtimeDuelService.forceAdvanceAbandoned(roomId, (room.currentQuestion ?? 0) + 1, room.totalQuestions)
              .then(() => { if (room && (room.currentQuestion ?? 0) + 1 >= room.totalQuestions) { incrementMissionProgress(user!.id, 'duel_completed'); incrementMissionProgress(user!.id, 'duel_realtime_completed'); } })
              .catch(console.error);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (abandonRef.current) clearInterval(abandonRef.current); };
  }, [answered, isHost]);

  const handleSelectAnswer = () => {
    if (answered || !selectedAnswer) return;
    const q = questions[room?.currentQuestion ?? 0];
    if (!q) return;
    clearTimer();
    const rawCorrect = (shuffledMap[q.id] || q.options).find((o:any) => o.id === selectedAnswer)?.isCorrect ?? false;
    const shieldAbsorbed = !rawCorrect && shieldActive;
    if (shieldAbsorbed) setShieldActive(false);
    
    // Fix: If Freeze is active, the max time available was increased by 10
    const maxTimeLimit = freezeActive ? TIME_PER_QUESTION + 10 : TIME_PER_QUESTION;
    const timeUsed = Math.max(1, maxTimeLimit - timeLeft);
    
    const scored = calcQuestionScore({ isCorrect: rawCorrect, timeUsed, streakBefore: currentStreak, shieldAbsorbed, wasSkipped: false });
    setCurrentStreak(scored.newStreak);
    if (rawCorrect || shieldAbsorbed) {
      const gain = turboRemaining > 0 ? 2 : 1;
      setEnergy(e => Math.min(MAX_ENERGY, e + gain));
      if (turboRemaining > 0) {
        setShowBonusFlash('+2 ⚡ TURBO!');
        setTurboRemaining(r => r-1);
        setTimeout(() => setShowBonusFlash(null), 1400);
      }
    }
    // Segunda Chance: if wrong and available, allow retry without setting answered
    if (!rawCorrect && !shieldAbsorbed && secondChanceAvailable) {
      setSecondChanceAvailable(false);
      setSelectedAnswer(null);
      setShowBonusFlash('⏳ Segunda Chance! Tente novamente!');
      setTimeout(() => setShowBonusFlash(null), 2200);
      return; // don't mark answered, let them try again
    }
    setAnswered(true);
    // Queima: apply if this is the target question
    const isQueimTargetQ = energyBurnBonus > 0 && (room?.currentQuestion ?? 0) === energyBurnTargetQuestion;
    const appliedBurnBonus = isQueimTargetQ ? energyBurnBonus : 0;
    if (isQueimTargetQ) { setEnergyBurnBonus(0); setEnergyBurnTargetQuestion(-1); }
    const finalPoints = rawCorrect && appliedBurnBonus > 0
      ? Math.round(scored.points * (1 + appliedBurnBonus / 100))
      : scored.points;
    const entry: DuelAnswerData = {
      questionId: q.id, selectedOptionId: selectedAnswer, isCorrect: rawCorrect,
      timeUsed, timeMax: TIME_PER_QUESTION, pointsEarned: finalPoints,
      speedBonus: scored.speedBonus, streakBonus: scored.streakBonus,
      comboMultiplier: scored.comboMultiplier, streakAtAnswer: currentStreak,
      shieldActivated: shieldAbsorbed||undefined, powerUsed: activePower||undefined,
      energyBurnBonus: appliedBurnBonus > 0 ? appliedBurnBonus : undefined,
    };
    setAnswerData(prev => [...prev, entry]);
    setPendingEntry(entry);
    const correct = q.options.find((o:any) => o.isCorrect);
    setFeedback({ type: rawCorrect ? 'correct' : 'wrong', correctText: !rawCorrect ? correct?.text : undefined, pointsEarned: finalPoints, explanation: q.explanation });
  };

  const handleActivatePower = (p: DuelPowerType) => {
    const info = POWERS_INFO[p];
    if (!info || usedPowers.includes(p) || usedPowers.length >= MAX_POWERS || energy < info.cost || answered) return;

    // Queima: show the amount-selection modal before activating
    if (p === 'queima') {
      setQueimAmount(1);
      setShowQueimModal(true);
      return;
    }

    setEnergy(e => e - info.cost);
    setUsedPowers(prev => [...prev, p]);
    setActivePower(p);
    setShowPowerPanel(false);

    // Cinematic activation animation
    setPowerActivationAnim(p);
    setTimeout(() => setPowerActivationAnim(null), 2200);

    if (p === 'shield') {
      setShieldActive(true);
    } else if (p === 'turbo') {
      setTurboRemaining(3);
      setShowBonusFlash('⚡ TURBO ATIVO!');
      setTimeout(() => setShowBonusFlash(null), 1800);
    } else if (p === 'dica') {
      setShowHint(true);
    } else if (p === 'freeze') {
      setFreezeActive(true);
      // Add +10s to timer
      const stored = localStorage.getItem(deadlineKey);
      if (stored) {
        const extended = Number(stored) + 10_000;
        localStorage.setItem(deadlineKey, String(extended));
        setTimeLeft(prev => prev + 10);
      }
      freezeTimerRef.current = setTimeout(() => setFreezeActive(false), 10_000);
    } else if (p === 'eliminate') {
      const q = questions[room?.currentQuestion ?? 0];
      const opts = (shuffledMap[q?.id]||[]).filter((o:any) => !eliminatedIds.includes(o.id) && !o.isCorrect);
      if (opts.length < 2) {
        // Refund
        setEnergy(e => Math.min(MAX_ENERGY, e + info.cost));
        setUsedPowers(prev => prev.filter(pp => pp !== p));
        setActivePower(null);
        toast.error('Alternativas insuficientes para eliminar!');
        return;
      }
      setEliminatedIds(opts.slice(0,2).map((o:any) => o.id));
    } else if (p === 'segunda_chance') {
      setSecondChanceAvailable(true);
    }

    toast.success(`${info.emoji} ${info.label} ativado!`);
  };

  // Queima confirmation
  const handleConfirmQueima = () => {
    const amt = Math.max(1, Math.min(queimAmount, Math.min(energy, 5)));
    setEnergy(e => Math.max(0, e - amt));
    setEnergyBurnBonus(amt * 20);
    setEnergyBurnTargetQuestion((room?.currentQuestion ?? 0) + 1);
    setUsedPowers(prev => [...prev, 'queima']);
    setActivePower('queima');
    setShowQueimModal(false);
    setShowPowerPanel(false);
    setPowerActivationAnim('queima');
    setTimeout(() => setPowerActivationAnim(null), 2200);
    setShowBonusFlash(`🔥 +${amt * 20}% na próxima questão!`);
    setTimeout(() => setShowBonusFlash(null), 2000);
    toast.success(`🔥 Queima ativa! +${amt * 20}% na próxima questão`);
  };


  const handleReady = async () => {
    if (!roomId || !user || !room) return;
    try { await RealtimeDuelService.setReady(roomId, user.id, room); }
    catch(e:any) { toast.error(e.message); }
  };

  // ── Derived ───────────────────────────────────────────────
  const me = players.find(p => p.userId === user?.id);
  const others = players.filter(p => p.userId !== user?.id);
  const currentQ = questions[room?.currentQuestion ?? 0];
  const options = currentQ ? (shuffledMap[currentQ.id] || currentQ.options).filter((o:any) => !eliminatedIds.includes(o.id)) : [];
  const timerPercent = (timeLeft / TIME_PER_QUESTION) * 100;
  const themeInfo = room ? (DUEL_THEMES[room.theme] ?? { emoji:'🎲', label: room.theme, color:'#a78bfa' }) : null;
  const rewards = room ? calcDuelRewards(room.difficulty, room.totalQuestions) : null;

  // ──────────────────────────────────────────────────────────
  // LOADING
  if (phase === 'loading') return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Entrando na sala…</p>
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────
  // WAITING ROOM
  if (phase === 'waiting') return (
    <div className="min-h-screen -mx-4 -mt-4 px-4 pt-4" style={{ background: 'linear-gradient(160deg,#030712 0%,#09102a 60%,#0f0a2e 100%)' }}>
    <div className="max-w-md mx-auto pb-24 pt-4 space-y-4">
      <motion.div initial={{opacity:0,y:-16}} animate={{opacity:1,y:0}}
        className="rounded-[2rem] overflow-hidden shadow-2xl"
        style={{background:'linear-gradient(160deg,#0b1021,#10142e)', border:'1px solid rgba(99,102,241,0.2)'}}>
        <div className="p-6 space-y-5">
          {/* Room code */}
          <div className="text-center">
            <motion.div animate={{scale:[1,1.06,1]}} transition={{duration:2.5,repeat:Infinity}} className="text-5xl mb-3">⚔️</motion.div>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Código da Sala</p>
            <div className="text-5xl font-black tracking-[0.3em]" style={{fontFamily:"'Orbitron',monospace",color:'#818cf8'}}>
              {room?.code}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(room?.code ?? '').catch(() => {});
                toast.success('Código copiado! 📋');
              }}
              className="mt-2 text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mx-auto"
            >
              📋 Copiar código
            </button>
            <p className="text-xs text-white/30 font-bold mt-1">Compartilhe este código com seus amigos</p>
          </div>

          {/* Info pills */}
          {themeInfo && (
            <div className="flex flex-wrap justify-center gap-2">
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/8 border border-white/10 text-xs font-black" style={{color:themeInfo.color}}>
                {themeInfo.emoji} {themeInfo.label}
              </span>
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/8 border border-white/10 text-xs font-black text-indigo-300">
                {room?.mode}
              </span>
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/8 border border-white/10 text-xs font-black text-white/60">
                {room?.totalQuestions} questões
              </span>
            </div>
          )}

          {/* Players */}
          <div>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Users size={12}/> Jogadores ({players.length}/{room?.mode==='2v2'?4:2})
            </p>
            <div className="space-y-3">
              {players.map(p => (
                <motion.div key={p.userId} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}}
                  className="flex items-center gap-4 bg-white/5 rounded-3xl px-5 py-4 border border-white/8">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 ring-2 ring-indigo-500/30">
                    <PlayerAvatar player={p} size="w-24 h-24" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-xl text-white truncate" style={{fontFamily:"'Rajdhani',sans-serif"}}>{p.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {p.className && <span className="text-xs font-bold text-white/40 bg-white/6 px-2 py-0.5 rounded-md">{p.className}</span>}
                      <span className="text-xs font-black text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded-md">Nív.{p.level}</span>
                      {p.userId === room?.hostId && <span className="text-xs font-black text-yellow-400">👑 Host</span>}
                    </div>
                  </div>
                  <motion.div animate={{scale: p.isReady ? [1,1.2,1]:1}} transition={{duration:0.4}}>
                    {p.isReady
                      ? <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center"><CheckCircle2 size={20} className="text-emerald-400"/></div>
                      : <div className="w-10 h-10 rounded-xl bg-white/8 border border-white/15 flex items-center justify-center"><div className="w-4 h-4 rounded-full bg-white/25 animate-pulse"/></div>}
                  </motion.div>
                </motion.div>
              ))}
              {/* Empty slots */}
              {Array.from({length: Math.max(0,(room?.mode==='2v2'?4:2)-players.length)}).map((_,i)=>(
                <motion.div key={`empty-${i}`} animate={{opacity:[0.3,0.6,0.3]}} transition={{duration:1.5,repeat:Infinity}}
                  className="flex items-center gap-4 rounded-3xl px-5 py-4 border border-dashed border-white/10">
                  <div className="w-24 h-24 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 text-4xl">?</div>
                  <p className="text-lg font-black text-white/25">Aguardando jogador…</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Ready button */}
          {!me?.isReady ? (
            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={handleReady}
              className="w-full h-14 rounded-2xl font-black text-white text-lg"
              style={{background:'linear-gradient(135deg,#059669,#10b981)', boxShadow:'0 8px 32px rgba(16,185,129,0.4)', fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.06em'}}>
              ✅ ESTOU PRONTO!
            </motion.button>
          ) : (
            <div className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 size={20} className="text-emerald-400"/>
              <span className="font-black text-emerald-400 text-sm">Aguardando os demais…</span>
              <motion.div animate={{rotate:360}} transition={{duration:1.5,repeat:Infinity,ease:'linear'}}>
                <Loader2 size={16} className="text-emerald-400/50"/>
              </motion.div>
            </div>
          )}
          {/* Leave room button */}
          <button
            onClick={async () => {
              if (roomId && user) {
                await RealtimeDuelService.leaveRoom(roomId, user.id).catch(() => {});
              }
              navigate('/student/duels/realtime');
            }}
            className="w-full h-10 rounded-xl text-sm font-black text-white/30 hover:text-red-400 transition-colors"
          >
            {isHost ? '🗑️ Encerrar Sala' : '↩ Sair da Sala'}
          </button>
        </div>
      </motion.div>
    </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────
  // CINEMATIC
  if (phase === 'cinematic') return (
    <motion.div className="min-h-screen -mx-4 -mt-4 flex items-center justify-center"
      style={{background:'linear-gradient(135deg,#020617,#0f0a2e,#1a0533)'}}>
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({length:40}).map((_,i)=>(
          <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-white"
            style={{left:`${Math.random()*100}%`, top:`${Math.random()*100}%`, opacity: Math.random()*0.6+0.2}}
            animate={{opacity:[0.2,0.8,0.2]}} transition={{duration:2+Math.random()*3,repeat:Infinity,delay:Math.random()*2}}/>
        ))}
      </div>
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Theme badge */}
        {themeInfo && (
          <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
            className="flex justify-center mb-8">
            <span className="flex items-center gap-2 px-5 py-2 rounded-full border text-sm font-black"
              style={{background:`${themeInfo.color}18`, borderColor:`${themeInfo.color}60`, color: themeInfo.color}}>
              {themeInfo.emoji} {themeInfo.label.toUpperCase()}
            </span>
          </motion.div>
        )}
        {/* Players */}
        <div className="flex items-center gap-4">
          {players.map((p, idx) => (
            <React.Fragment key={p.userId}>
              {idx > 0 && idx === Math.floor(players.length/2) && (
                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{delay:0.5,type:'spring',bounce:0.7}}
                  className="shrink-0 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-900/40 border border-red-500/50 flex items-center justify-center">
                    <Sword size={32} className="text-red-400"/>
                  </div>
                  <span className="text-sm font-black text-red-400 uppercase tracking-widest mt-1 block">VS</span>
                </motion.div>
              )}
              <motion.div
                initial={idx<Math.floor(players.length/2)?{x:-60,opacity:0}:{x:60,opacity:0}}
                animate={{x:0,opacity:1}} transition={{delay:0.3+idx*0.1}}
                className="flex-1 flex flex-col items-center gap-3">
                <div className="w-[135px] h-[135px]"><PlayerAvatar player={p} size="w-[135px] h-[135px]"/></div>
                <div className="text-center">
                  <p className="text-xl font-black text-white truncate max-w-[140px]" style={{fontFamily:"'Rajdhani',sans-serif"}}>
                    {p.name?.split(' ')[0]}
                  </p>
                  {p.className && <p className="text-xs text-white/40 font-bold">{p.className}</p>}
                  <span className="text-xs font-black text-indigo-300 bg-indigo-900/40 px-3 py-1 mt-1 inline-block rounded-md">Nív.{p.level}</span>
                </div>
              </motion.div>
            </React.Fragment>
          ))}
        </div>
        {/* Battle phrase */}
        <motion.p initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.8}}
          className="text-center text-sm font-black text-white/60 mt-8 uppercase tracking-widest">
          ⚡ Que vença o mais inteligente! 🧠
        </motion.p>
        <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.2}}
          className="text-center text-xs text-white/30 font-bold mt-3">
          Duelo em tempo real — todos respondem juntos
        </motion.p>
      </div>
    </motion.div>
  );

  // ──────────────────────────────────────────────────────────
  // FINISHED
  if (phase === 'finished') {
    const sorted = [...players].sort((a,b) => (b.detailedScore||b.score||0)-(a.detailedScore||a.score||0));
    const winner = sorted[0];
    const isWinner = winner?.userId === user?.id;
    const isDraw = sorted.length > 1 && sorted[0].detailedScore === sorted[1].detailedScore;

    return (
      <motion.div className="min-h-screen -mx-4 -mt-4 overflow-auto relative"
        style={{background:'linear-gradient(135deg,#020617,#0f0a2e,#1a0533)'}}>
        {/* Stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({length:50}).map((_,i)=>(
            <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-white"
              style={{left:`${Math.random()*100}%`, top:`${Math.random()*100}%`}}
              animate={{opacity:[0.1,0.7,0.1],scale:[0.5,1.5,0.5]}}
              transition={{duration:2+Math.random()*3,repeat:Infinity,delay:Math.random()*3}}/>
          ))}
        </div>

        <div className="relative z-10 max-w-md mx-auto px-4 py-8 space-y-6">
          {/* Winner banner */}
          <motion.div initial={{opacity:0,scale:0.5}} animate={{opacity:1,scale:1}} transition={{type:'spring',stiffness:200,damping:18}}
            className="text-center">
            <motion.div animate={{y:[0,-8,0]}} transition={{duration:2,repeat:Infinity,ease:'easeInOut'}}
              className="text-7xl mb-3">
              {isDraw ? '🤝' : isWinner ? '🏆' : '⚔️'}
            </motion.div>
            <motion.h1 initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
              className="text-3xl font-black text-white" style={{fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.05em'}}>
              {isDraw ? 'EMPATE!' : isWinner ? 'VITÓRIA!' : 'FIM DE JOGO!'}
            </motion.h1>
            <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5}}
              className="text-sm text-white/50 font-bold mt-1">
              {isDraw ? 'Igual em pontos — bem jogado a todos!' : isWinner ? 'Você foi o melhor desta batalha! 🎉' : `${winner?.name?.split(' ')[0]} venceu a batalha`}
            </motion.p>
          </motion.div>

          {/* Podium */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}}
            className="rounded-[2rem] overflow-hidden"
            style={{background:'linear-gradient(145deg,#0d1224,#111827)', border:'1px solid rgba(255,255,255,0.08)'}}>
            <div className="p-5 space-y-3">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center">Classificação Final</p>
              {sorted.map((p, idx) => {
                const medal = ['🥇','🥈','🥉'][idx] ?? `#${idx+1}`;
                const isMe = p.userId === user?.id;
                return (
                  <motion.div key={p.userId}
                    initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:0.5 + idx*0.1}}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{background: isMe?'rgba(99,102,241,0.18)':'rgba(255,255,255,0.05)', border: isMe?'1px solid rgba(99,102,241,0.45)':'1px solid rgba(255,255,255,0.07)'}}>
                    <span className="text-2xl w-8 text-center">{medal}</span>
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0"><PlayerAvatar player={p} size="w-11 h-11"/></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-white truncate" style={{fontFamily:"'Rajdhani',sans-serif"}}>
                        {p.name?.split(' ').slice(0,2).join(' ')} {isMe&&<span className="text-indigo-400">• Você</span>}
                      </p>
                      <p className="text-[10px] text-white/40 font-bold">{p.score || 0} acertos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-base text-white" style={{fontFamily:"'Orbitron',monospace"}}>{p.detailedScore || p.score || 0}</p>
                      <p className="text-[9px] text-white/30 font-bold">pts</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* XP rewards */}
          {rewards && me && (
            <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.8}}
              className="rounded-[1.5rem] p-4 text-center"
              style={{background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)'}}>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Recompensas Ganhas</p>
              <div className="flex justify-center gap-8">
                <div>
                  <p className="text-2xl font-black text-white">+{(isWinner&&!isDraw?rewards.winXP:isDraw?rewards.drawXP:rewards.loseXP) + (me.score||0)*rewards.xpPerCorrect} XP</p>
                  <p className="text-[9px] text-white/40 font-bold uppercase">experiência</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-yellow-300">+{(isWinner&&!isDraw?rewards.winCoins:isDraw?rewards.drawCoins:rewards.loseCoins) + (me.score||0)*rewards.coinsPerCorrect} 🪙</p>
                  <p className="text-[9px] text-white/40 font-bold uppercase">moedas</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* CTAs */}
          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1}} className="flex gap-3">
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              onClick={() => navigate('/student/duels/realtime')}
              className="flex-1 h-13 rounded-2xl font-black text-sm text-white py-3"
              style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow:'0 6px 24px rgba(79,70,229,0.4)', fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.06em'}}>
              ⚡ NOVO DUELO
            </motion.button>
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              onClick={() => navigate('/student/duels')}
              className="flex-1 h-13 rounded-2xl font-black text-sm text-white/60 py-3 bg-white/8 border border-white/12">
              Voltar ao Lobby
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // PLAYING
  if (!currentQ) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto"/>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Gerando questões com IA…</p>
      </div>
    </div>
  );

  const qIdx = room?.currentQuestion ?? 0;

  return (
    <div className="min-h-screen -mx-4 -mt-4" style={{ background: 'linear-gradient(160deg,#030712 0%,#09102a 60%,#0f0a2e 100%)' }}>
    <div className="max-w-[480px] mx-auto pb-28 pt-4 px-4 space-y-3 relative">
      {/* Answer feedback overlay — manual advance: user clicks 'Próxima Pergunta' */}
      <AnimatePresence>
        {feedback && (
          <AnswerFeedbackOverlay
            feedback={feedback.type}
            correctAnswerText={feedback.correctText}
            points={feedback.pointsEarned}
            explanation={feedback.explanation}
            manualAdvance={true}
            nextLabel="Próxima Pergunta"
            onDismiss={() => { setFeedback(null); setFeedbackDismissed(true); }}
          />
        )}
      </AnimatePresence>

      {/* ⚡ Power Activation Cinematic Overlay */}
      <AnimatePresence>
        {powerActivationAnim && (() => {
          const p = POWERS_INFO[powerActivationAnim];
          const glowColor = p?.cat==='defense'?'rgba(34,211,238,0.6)':p?.cat==='control'?'rgba(96,165,250,0.6)':p?.cat==='strategy'?'rgba(168,85,247,0.6)':'rgba(234,179,8,0.6)';
          const ringCls = p?.cat==='defense'?'border-cyan-400/80':p?.cat==='control'?'border-blue-400/80':p?.cat==='strategy'?'border-purple-400/80':'border-yellow-400/80';
          return (
            <motion.div key={`pact-${powerActivationAnim}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}
              className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
              <motion.div initial={{scale:0,opacity:0}} animate={{scale:[0,3.5,2.5],opacity:[0,0.7,0]}} transition={{duration:1.4,ease:'easeOut'}}
                className="absolute w-72 h-72 rounded-full" style={{background:`radial-gradient(circle,${glowColor} 0%,transparent 70%)`}} />
              <motion.div initial={{scale:0,y:100,rotate:-25}} animate={{scale:[0,1.28,1.05,1],y:[100,-12,4,0],rotate:[-25,8,-3,0]}}
                exit={{scale:0.3,y:-120,opacity:0,rotate:15}} transition={{type:'spring',stiffness:360,damping:18}}
                className={cn('relative flex flex-col items-center gap-3 px-12 py-8 rounded-[2.5rem] border-4 shadow-2xl',`bg-gradient-to-br ${p?.bg} ${ringCls}`)}
                style={{boxShadow:`0 0 80px 25px ${glowColor},0 30px 60px rgba(0,0,0,0.6)`}}>
                <motion.div initial={{scale:0.5,opacity:1}} animate={{scale:3,opacity:0}} transition={{duration:1,ease:'easeOut'}}
                  className={cn('absolute inset-0 rounded-[2.5rem] border-4',ringCls)} />
                <motion.span className={cn('text-[10px] font-black uppercase tracking-[0.3em]',p?.color)}>⚔️ PODER ATIVADO</motion.span>
                <motion.span className="text-[7rem] leading-none drop-shadow-2xl"
                  animate={{y:[0,-25,0,-12,0],scale:[1,1.18,1,1.08,1],rotate:[0,-12,8,-5,0]}}
                  transition={{duration:0.9,ease:'easeInOut',times:[0,0.25,0.5,0.75,1]}}>{p?.emoji}</motion.span>
                <motion.p initial={{opacity:0,y:20,scale:0.7}} animate={{opacity:1,y:0,scale:1}} transition={{delay:0.25,type:'spring'}}
                  className={cn('text-2xl font-black text-center',p?.color)} style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:'0.06em'}}>{p?.label}</motion.p>
                <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.4}} className="text-xs font-bold text-white/60 text-center max-w-[180px] leading-snug">{p?.desc}</motion.p>
                <motion.div initial={{scale:0}} animate={{scale:[0,1.3,1]}} transition={{delay:0.55,type:'spring'}}
                  className="px-6 py-1.5 rounded-full bg-white/15 border border-white/25 backdrop-blur-sm">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">⚡ Ativado!</span>
                </motion.div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* 🔥 Queima Modal */}
      <AnimatePresence>
        {showQueimModal && (
          <motion.div className="fixed inset-0 z-[210] flex items-center justify-center px-4"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => setShowQueimModal(false)} />
            <motion.div className="relative z-10 w-full max-w-sm rounded-[2rem] p-6 border shadow-2xl"
              style={{background:'linear-gradient(145deg,#1a0a00,#291000)',borderColor:'rgba(234,179,8,0.35)'}}
              initial={{scale:0.85,y:20}} animate={{scale:1,y:0}} exit={{scale:0.9,opacity:0}}>
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">🔥</div>
                <h3 className="text-xl font-black text-white" style={{fontFamily:"'Rajdhani',sans-serif"}}>Queima de Energia</h3>
                <p className="text-xs text-white/50 font-bold mt-1">Cada ⚡ gasta = +20% de pontos na próxima questão</p>
              </div>
              <div className="flex items-center justify-center gap-4 mb-5">
                <button onClick={() => setQueimAmount(a => Math.max(1, a-1))}
                  className="w-10 h-10 rounded-xl bg-white/10 text-white font-black text-xl hover:bg-white/20 transition-all">−</button>
                <div className="text-center">
                  <span className="text-4xl font-black text-yellow-400" style={{fontFamily:"'Orbitron',monospace"}}>{queimAmount}</span>
                  <p className="text-[10px] text-white/40 font-bold">energia ⚡</p>
                </div>
                <button onClick={() => setQueimAmount(a => Math.min(Math.min(energy,5), a+1))}
                  className="w-10 h-10 rounded-xl bg-white/10 text-white font-black text-xl hover:bg-white/20 transition-all">+</button>
              </div>
              <div className="text-center mb-5 py-3 rounded-2xl" style={{background:'rgba(234,179,8,0.12)',border:'1px solid rgba(234,179,8,0.3)'}}>
                <span className="text-2xl font-black text-yellow-400">+{queimAmount*20}%</span>
                <span className="text-sm text-white/50 font-bold ml-2">de pontos na próxima questão</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowQueimModal(false)} className="flex-1 h-12 rounded-2xl bg-white/10 text-white font-black hover:bg-white/15 transition-all">Cancelar</button>
                <button onClick={handleConfirmQueima} className="flex-1 h-12 rounded-2xl font-black text-white transition-all"
                  style={{background:'linear-gradient(135deg,#d97706,#f59e0b)',boxShadow:'0 6px 20px rgba(234,179,8,0.4)'}}>🔥 Queimar!</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 💫 Bonus Flash */}
      <AnimatePresence>
        {showBonusFlash && (
          <motion.div className="fixed top-24 left-0 right-0 z-[80] flex justify-center pointer-events-none"
            initial={{opacity:0,y:-12,scale:0.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.85}}>
            <div className="px-6 py-3 rounded-2xl font-black text-white text-sm shadow-2xl"
              style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',boxShadow:'0 8px 32px rgba(79,70,229,0.5)'}}>
              {showBonusFlash}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waiting overlay — shown only after clicking 'Próxima Pergunta' */}
      <AnimatePresence>
        {readyForNext && (() => {
          const othersAnswered = others.every(p => p.hasAnsweredCurrent);
          if (othersAnswered) return null;
          const absentOthers = others.filter(p => !p.hasAnsweredCurrent);
          const countdownColor = abandonCountdown <= 10 ? '#f87171' : abandonCountdown <= 20 ? '#fbbf24' : '#818cf8';
          return (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center"
              style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(14px)'}}
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
              <div className="text-center max-w-[300px] space-y-5 px-4">
                {/* Pulsing swords */}
                <motion.div animate={{scale:[1,1.15,1],rotate:[0,5,-5,0]}} transition={{duration:1.8,repeat:Infinity}} className="text-6xl">
                  ⚔️
                </motion.div>
                <div>
                  <h3 className="text-xl font-black text-white" style={{fontFamily:"'Rajdhani',sans-serif"}}>Aguardando rival…</h3>
                  <p className="text-xs text-white/40 font-bold mt-1">{absentOthers.length === 1 ? 'Seu oponente ainda está pensando' : 'Rivais ainda estão respondendo'}</p>
                </div>
                <div className="space-y-2.5">
                  {others.map(p => (
                    <div key={p.userId} className="flex items-center gap-3 bg-white/8 rounded-2xl px-4 py-2.5">
                      <div className="w-9 h-9 rounded-lg overflow-hidden"><PlayerAvatar player={p} size="w-9 h-9"/></div>
                      <p className="flex-1 text-sm font-black text-white text-left">{p.name?.split(' ')[0]}</p>
                      {p.hasAnsweredCurrent
                        ? <CheckCircle2 size={18} className="text-emerald-400"/>
                        : <motion.div animate={{opacity:[0.4,1,0.4]}} transition={{duration:0.9,repeat:Infinity}}>
                            <span className="text-[10px] font-black text-yellow-400 bg-yellow-400/15 px-2 py-0.5 rounded-full">✏️ digitando…</span>
                          </motion.div>}
                    </div>
                  ))}
                </div>
                {/* Live countdown — always visible */}
                <motion.div
                  animate={{scale: abandonCountdown <= 10 ? [1,1.05,1] : 1}}
                  transition={{duration:0.5,repeat:abandonCountdown<=10?Infinity:0}}
                  className="rounded-2xl px-4 py-3 text-center"
                  style={{background:'rgba(255,255,255,0.06)', border:`1px solid ${countdownColor}35`}}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{color:countdownColor}}>
                    {abandonCountdown <= 10 ? '⚠️ Avançando em breve' : '⏱️ Avanço automático'}
                  </p>
                  <p className="text-2xl font-black" style={{fontFamily:"'Orbitron',monospace", color:countdownColor}}>
                    {abandonCountdown}s
                  </p>
                </motion.div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ═══ HUD HEADER ═══ */}
      <div className="rounded-[2rem] overflow-hidden relative" style={{background:'linear-gradient(145deg,#0b1021,#101830)',border:'1px solid rgba(99,102,241,0.25)'}}>
        {/* Top strip: question progress */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest" style={{fontFamily:"'Orbitron',monospace"}}>
            {qIdx + 1}
            <span className="text-white/30">/{room?.totalQuestions}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div className="h-full rounded-full" animate={{width:`${((qIdx+1)/(room?.totalQuestions||8))*100}%`}}
              style={{background:'linear-gradient(90deg,#6366f1,#a855f7)'}} />
          </div>
          <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Tempo Real ⚡</span>
        </div>

        {/* Central: Player vs Timer vs Player */}
        <div className="relative flex items-center justify-between px-3 pb-4 gap-2">
          {players.map((p, idx) => {
            const isMe = p.userId === user?.id;
            const isLeft = idx < Math.ceil(players.length / 2);
            const answered = p.hasAnsweredCurrent;
            return (
              <motion.div key={p.userId}
                initial={{opacity:0, x: isLeft ? -20 : 20}} animate={{opacity:1, x:0}} transition={{delay: idx * 0.1}}
                className={cn('flex-1 flex flex-col items-center gap-1.5', !isLeft && 'flex-row-reverse items-center justify-start gap-0 flex-col')}>
                {/* Avatar ring */}
                <div className={cn('relative rounded-[1.4rem] overflow-hidden shrink-0 shadow-2xl',
                  isMe ? 'ring-2 ring-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)]' : 'ring-2 ring-white/15'
                )} style={{width:76,height:76}}>
                  <PlayerAvatar player={p} size="w-[76px] h-[76px]" />
                  {answered && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}}
                      className="absolute inset-0 bg-emerald-500/20 flex items-end justify-end p-1">
                      <div className="bg-emerald-500 rounded-full w-5 h-5 flex items-center justify-center">
                        <CheckCircle2 size={12} className="text-white" />
                      </div>
                    </motion.div>
                  )}
                </div>
                {/* Name */}
                <p className="text-xs font-black text-white/90 truncate max-w-[72px] text-center" style={{fontFamily:"'Rajdhani',sans-serif"}}>
                  {p.name?.split(' ')[0]} {isMe && <span className="text-indigo-400 text-[9px]">• Você</span>}
                </p>
                {/* Score */}
                <div className={cn('flex items-baseline gap-0.5 px-2 py-0.5 rounded-lg',
                  isMe ? 'bg-indigo-600/25 border border-indigo-500/40' : 'bg-white/6 border border-white/10')}>
                  <span className="text-lg font-black" style={{fontFamily:"'Orbitron',monospace", color: isMe ? '#a5b4fc' : 'rgba(255,255,255,0.7)'}}>
                    {p.detailedScore || p.score || 0}
                  </span>
                  <span className="text-[9px] font-bold text-white/30">pts</span>
                </div>
              </motion.div>
            );
          })}

          {/* Central Timer Ring */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <div className="relative w-[72px] h-[72px]">
              {/* Glow behind ring */}
              <div className="absolute inset-0 rounded-full blur-lg opacity-40"
                style={{background: timeLeft>10 ? '#6366f1' : timeLeft>5 ? '#f59e0b' : '#ef4444'}} />
              <svg className="absolute inset-0 -rotate-90" width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5"/>
                <motion.circle cx="36" cy="36" r="30" fill="none"
                  stroke={timeLeft>10?'#6366f1':timeLeft>5?'#f59e0b':'#ef4444'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray="188.5" strokeDashoffset={188.5*(1-timerPercent/100)}/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-2xl font-black',
                  timeLeft <= 5 ? 'text-red-400' : timeLeft <= 10 ? 'text-amber-400' : 'text-white'
                )} style={{fontFamily:"'Orbitron',monospace"}}>{timeLeft}</span>
              </div>
            </div>
            <span className="text-[8px] font-black text-white/25 uppercase tracking-widest">seg</span>
          </div>

          {/* VS sparkle — shown only for 2-player mode */}
          {/* (already covered by the layout flex above) */}
        </div>

        {/* Thin gradient bottom border */}
        <div className="absolute bottom-0 left-4 right-4 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(99,102,241,0.6),transparent)'}} />
      </div>

      {/* Active power banners */}
      {shieldActive && (
        <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
          className="flex items-center justify-center gap-2 rounded-2xl py-2 px-4 relative overflow-hidden"
          style={{background:'linear-gradient(135deg,rgba(8,145,178,0.12),rgba(99,102,241,0.10))',border:'1px solid rgba(34,211,238,0.35)'}}>
          <motion.div className="absolute inset-0 pointer-events-none rounded-2xl"
            animate={{boxShadow:['0 0 0px rgba(34,211,238,0)',`0 0 18px rgba(34,211,238,0.35)`,'0 0 0px rgba(34,211,238,0)']}}
            transition={{duration:1.6,repeat:Infinity}} />
          <motion.div animate={{scale:[1,1.2,1]}} transition={{duration:1.4,repeat:Infinity}}>
            <Shield size={13} className="text-cyan-400" />
          </motion.div>
          <span className="text-[10px] font-black text-cyan-300 tracking-wide">🛡️ ESCUDO ATIVO — Próximo erro bloqueado</span>
        </motion.div>
      )}
      {secondChanceAvailable && (
        <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className="flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl py-1.5 px-3">
          <span className="text-sm">⏳</span>
          <span className="text-[10px] font-black text-orange-400">SEGUNDA CHANCE ATIVA — Se errar, poderá tentar novamente!</span>
        </motion.div>
      )}
      {turboRemaining > 0 && (
        <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
          className="flex items-center justify-center gap-2 rounded-2xl py-2 px-4 relative overflow-hidden"
          style={{background:'linear-gradient(135deg,rgba(161,98,7,0.18),rgba(120,65,0,0.12))',border:'1px solid rgba(234,179,8,0.40)'}}>
          <motion.div className="absolute inset-0 pointer-events-none"
            animate={{x:['-100%','200%']}} transition={{duration:1.2,repeat:Infinity,ease:'linear'}}
            style={{background:'linear-gradient(90deg,transparent,rgba(251,191,36,0.12),transparent)',width:'40%'}} />
          <motion.div animate={{scale:[1,1.3,1],rotate:[0,15,-15,0]}} transition={{duration:0.8,repeat:Infinity}}>
            <Flame size={13} className="text-yellow-400" />
          </motion.div>
          <span className="text-[10px] font-black text-yellow-300">⚡ TURBO {turboRemaining}/3 — energia em dobro!</span>
          <div className="flex gap-0.5 ml-1">
            {[0,1,2].map(i => <div key={i} className={`w-2 h-2 rounded-full ${i<turboRemaining?'bg-yellow-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]':'bg-white/15'}`} />)}
          </div>
        </motion.div>
      )}
      {freezeActive && (
        <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
          className="flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-400/30 rounded-xl py-1.5 px-3">
          <motion.span animate={{rotate:[0,15,-15,0]}} transition={{duration:0.6,repeat:Infinity}}>❄️</motion.span>
          <span className="text-[10px] font-black text-blue-300">CONGELADO — +10s no cronômetro!</span>
        </motion.div>
      )}

      {/* Question card */}
      <motion.div key={`q-${qIdx}`} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
        className="rounded-[1.75rem] overflow-hidden"
        style={{background:'linear-gradient(145deg,#0d1224,#111827)', border:'1px solid rgba(99,102,241,0.2)'}}>
        <div className="p-5 relative">
          {/* Freeze icy overlay with snowflakes */}
          {freezeActive && (
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-[1.75rem]">
              <div className="absolute inset-0" style={{background:'linear-gradient(180deg,rgba(30,64,175,0.12) 0%,rgba(7,89,133,0.08) 100%)'}} />
              {[0,1,2,3,4,5,6].map(i => (
                <motion.div key={i} className="absolute text-blue-200 select-none"
                  style={{fontSize:`${20+i*6}px`,left:`${6+i*13}%`,textShadow:'0 0 12px rgba(147,197,253,0.9)'}}
                  initial={{y:'-40px',opacity:0,rotate:0}} animate={{y:'115%',opacity:[0,1,1,0.8,0],rotate:360*((i%2===0)?1:-1)}}
                  transition={{duration:1.5+i*0.3,delay:i*0.25,repeat:Infinity,ease:'linear'}}>❄</motion.div>
              ))}
            </div>
          )}
          {/* Shield outer pulse ring */}
          {shieldActive && (
            <motion.div className="absolute -inset-1 rounded-[2rem] pointer-events-none z-20"
              animate={{opacity:[0,0.4,0],scale:[1,1.01,1]}} transition={{duration:2,repeat:Infinity}}
              style={{boxShadow:'0 0 30px rgba(34,211,238,0.20)'}} />
          )}
          {/* Hint */}
          {showHint && currentQ.explanation && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs font-bold text-amber-300">
              💡 {currentQ.explanation.slice(0,120)}…
            </div>
          )}
          <p className="text-base font-black text-white leading-relaxed">{currentQ.questionText}</p>
        </div>

        {/* Options */}
        <div className="px-4 pb-5 space-y-2.5">
          {options.map((opt:any, i:number) => {
            const isSelected = selectedAnswer === opt.id;
            // Only reveal correctness AFTER the player answered AND the feedback overlay is visible.
            // Never expose opt.isCorrect to CSS before that moment — prevents green flash on load.
            const revealCorrect = answered && feedback !== null;
            const isCorrectOpt = revealCorrect && !!opt.isCorrect;
            const isWrongSelected = revealCorrect && !opt.isCorrect && isSelected;
            const isNeutralUnselected = revealCorrect && !opt.isCorrect && !isSelected;
            return (
              <motion.button key={opt.id} whileHover={!answered?{x:4}:{}} whileTap={!answered?{scale:0.98}:{}}
                onClick={() => { if(!answered) setSelectedAnswer(opt.id); }}
                className={cn(
                  'w-full text-left flex items-center gap-3 p-4 rounded-2xl border transition-all font-bold text-sm',
                  !answered && !isSelected && 'bg-white/5 border-white/10 text-white hover:bg-white/9',
                  !answered && isSelected && 'bg-indigo-600/25 border-indigo-500/60 text-white',
                  isCorrectOpt   && 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
                  isWrongSelected && 'bg-red-500/15 border-red-500/40 text-red-400',
                  isNeutralUnselected && 'bg-white/3 border-white/6 text-white/30',
                )}>
                <span className={cn('w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0',
                  !answered&&isSelected?'bg-indigo-600 text-white':'bg-white/10 text-white/60')}>
                  {LETTERS[i]}
                </span>
                <span className="flex-1">{opt.text}</span>
                {isCorrectOpt   && <CheckCircle2 size={16} className="text-emerald-400 shrink-0"/>}
                {isWrongSelected && <XCircle size={16} className="text-red-400 shrink-0"/>}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Energy + powers */}
      <div className="rounded-[1.5rem] overflow-hidden" style={{background:'rgba(13,18,36,0.9)', border:'1px solid rgba(255,255,255,0.08)'}}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-yellow-400" strokeWidth={2.5}/>
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Energia</span>
            <span className="text-[10px] font-black text-white/30 ml-auto">{energy}/{MAX_ENERGY}</span>
            <button onClick={()=>setShowPowerPanel(p=>!p)}
              className={cn('text-[10px] font-black px-2.5 py-1 rounded-xl border transition-all',
                showPowerPanel?'bg-indigo-600/30 border-indigo-500/50 text-indigo-300':'bg-white/6 border-white/12 text-white/50')}>
              {showPowerPanel?'▲ Fechar':'⚡ Poderes'}
            </button>
          </div>
          <div className="flex gap-1.5">
            {Array.from({length:MAX_ENERGY}).map((_,i)=>(
              <motion.div key={i} className="flex-1 h-2.5 rounded-full"
                style={{background: i<energy?'linear-gradient(90deg,#eab308,#f59e0b)':'rgba(255,255,255,0.08)'}}
                animate={i<energy?{boxShadow:['0 0 4px rgba(234,179,8,0.4)','0 0 8px rgba(234,179,8,0.7)','0 0 4px rgba(234,179,8,0.4)']}:{}}
                transition={{duration:1.5,repeat:Infinity}}/>
            ))}
          </div>
        </div>
      </div>

      {/* 🔮 Power Selection Modal */}
      <AnimatePresence>
        {showPowerPanel && (
          <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowPowerPanel(false)} />
            <motion.div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-hide rounded-[2rem] p-6 border shadow-[0_0_50px_rgba(79,70,229,0.3)]"
              style={{background:'linear-gradient(145deg,#0f0a2e,#1a0533)',borderColor:'rgba(99,102,241,0.5)'}}
              initial={{scale:0.8,y:60}} animate={{scale:1,y:0}} exit={{scale:0.9,opacity:0,y:40}} transition={{type:'spring',bounce:0.6}}>
              <div className="text-center mb-6">
                <div className="text-5xl mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">⚡</div>
                <h3 className="text-2xl font-black text-white uppercase" style={{fontFamily:"'Orbitron',monospace"}}>Mochila de Poderes</h3>
                <p className="text-xs text-white/50 font-bold mt-1">Gaste suas energias e ganhe vantagem estratégica</p>
              </div>
              
              <div className="grid grid-cols-1 gap-3 pb-2">
                {(ALL_POWERS as readonly string[]).map(p => {
                  const info = POWERS_INFO[p];
                  const used = usedPowers.includes(p as DuelPowerType);
                  const canUse = !used && usedPowers.length < MAX_POWERS && energy >= (info?.cost??1) && !answered;
                  return (
                    <button key={p} onClick={()=>canUse&&handleActivatePower(p as DuelPowerType)}
                      disabled={!canUse}
                      className={cn('flex flex-col items-start gap-2 p-3 rounded-[1.5rem] border-2 transition-all relative overflow-hidden text-left',
                        used?'opacity-40 border-white/8 bg-white/5':
                        canUse?`border-indigo-500/40 bg-white/5 hover:scale-[1.03] cursor-pointer hover:bg-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.3)]`:
                        'border-white/8 bg-white/5 opacity-40 cursor-not-allowed')}>
                      {canUse && <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity" />}
                      <div className="flex items-center gap-2 w-full z-10">
                        <span className="text-3xl drop-shadow-lg" style={{textShadow:`0 0 15px ${info.glow}`}}>{info?.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <span className={cn('text-[11px] font-black leading-tight uppercase tracking-wider block', info?.color)}>{info?.label}</span>
                          <div className="text-[10px] font-bold text-yellow-400/90 flex items-center gap-1 mt-0.5">
                            <Zap size={9} fill="currentColor"/> {info?.cost} energia
                          </div>
                        </div>
                        {used && <span className="text-[9px] font-black text-white/30 bg-white/5 px-1.5 py-0.5 rounded-md">USADO</span>}
                      </div>
                      <p className="text-[10px] text-white/50 font-medium leading-snug z-10 pl-0">{info?.desc}</p>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowPowerPanel(false)} className="w-full mt-5 h-12 rounded-2xl bg-white/10 text-white font-black hover:bg-white/15 transition-all outline-none">
                FECHAR
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm answer button (before answering) */}
      {!answered && (
        <motion.button
          whileHover={selectedAnswer?{scale:1.02}:{}}
          whileTap={selectedAnswer?{scale:0.97}:{}}
          onClick={handleSelectAnswer}
          disabled={!selectedAnswer}
          className="w-full h-14 rounded-2xl font-black text-xl text-white disabled:opacity-40 transition-all"
          style={{
            background: selectedAnswer?'linear-gradient(135deg,#4f46e5,#7c3aed)':'rgba(255,255,255,0.08)',
            boxShadow: selectedAnswer?'0 8px 32px rgba(79,70,229,0.45)':'none',
            fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.07em',
          }}>
          {selectedAnswer ? '⚡ CONFIRMAR RESPOSTA' : 'Selecione uma alternativa'}
        </motion.button>
      )}

      {/* → Próxima Pergunta button (after feedback dismissed, before submitting) */}
      {answered && feedbackDismissed && !readyForNext && (
        <motion.button
          initial={{opacity:0, y:12, scale:0.95}}
          animate={{opacity:1, y:0, scale:1}}
          whileHover={{scale:1.03, y:-2}}
          whileTap={{scale:0.97}}
          onClick={handleGoNext}
          className="w-full h-14 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2.5 relative overflow-hidden"
          style={{
            background:'linear-gradient(135deg,#059669,#10b981)',
            boxShadow:'0 8px 32px rgba(16,185,129,0.45)',
            fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.06em',
          }}>
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{background:'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.2) 50%,transparent 60%)'}}
            initial={{x:'-100%'}} animate={{x:'200%'}}
            transition={{delay:0.3, duration:0.7, ease:'easeInOut'}}/>
          ➡️ PRÓXIMA PERGUNTA
        </motion.button>
      )}
    </div>
    </div>
  );
};
