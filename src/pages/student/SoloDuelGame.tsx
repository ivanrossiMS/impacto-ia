import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Timer, CheckCircle2, XCircle, ArrowLeft, Star,
  BrainCircuit, Shuffle, BookMarked, Globe, Atom, Palette,
  Dumbbell, User, Brain, Shield, Swords, Gamepad2, Tv, Target, Flame
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DuelService } from '../../services/duel.service';
import type { DuelTheme, DuelDifficulty, DuelQuestion, DuelAnswerData, DuelPowerType } from '../../types/duel';
import { toast } from 'sonner';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { AnswerFeedbackOverlay, type FeedbackType } from '../../components/ui/AnswerFeedbackOverlay';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';
import { cn } from '../../lib/utils';
import { TIME_PER_QUESTION, MAX_ENERGY, calcQuestionScore, calcTotalDetailed } from '../../lib/duelScoring';
import { callGenerateDuel } from '../../ai/client';

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
  { id: 'easy',   label: 'Iniciante', Icon: Shield, desc: 'Questões adaptadas.', xp: '+60 XP',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.35)',  glow: 'rgba(74,222,128,0.25)'  },
  { id: 'medium', label: 'Médio',     Icon: Zap,    desc: 'Balanço ideal.',       xp: '+75 XP',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.35)',  glow: 'rgba(251,191,36,0.25)'  },
  { id: 'hard',   label: 'Mestre',    Icon: Swords, desc: 'Alto desafio.',        xp: '+100 XP', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.35)', glow: 'rgba(248,113,113,0.25)' },
];

const LETTERS = ['A', 'B', 'C', 'D'];
const CARD = { background: 'linear-gradient(160deg,#080e24 0%,#0b1230 100%)', border: '1px solid rgba(255,255,255,0.07)' };

type PowerCat = 'defense' | 'control' | 'strategy' | 'boost';

const POWERS_INFO: Record<string, {
  emoji: string; label: string; desc: string; color: string; bg: string; border: string; glow: string; cat: PowerCat; cost: number;
}> = {
  shield:         { emoji:'🛡️', label:'Escudo',          desc:'Bloqueia 1 erro',          color:'text-cyan-300',    bg:'from-cyan-950 to-blue-950',        border:'border-cyan-500/50',    glow:'rgba(34,211,238,0.45)',   cat:'defense',  cost:1 },
  dica:           { emoji:'💡', label:'Dica',             desc:'Revela uma dica',            color:'text-amber-300',   bg:'from-amber-950 to-yellow-950',     border:'border-amber-500/50',   glow:'rgba(251,191,36,0.45)',   cat:'strategy', cost:2 },
  freeze:         { emoji:'❄️', label:'Congelar',         desc:'+10s no cronômetro',        color:'text-blue-200',    bg:'from-blue-950 to-indigo-950',      border:'border-blue-400/50',    glow:'rgba(96,165,250,0.45)',   cat:'control',  cost:2 },
  turbo:          { emoji:'⚡', label:'Turbo',             desc:'Próximos 3: 2x energia',    color:'text-yellow-300',  bg:'from-yellow-950 to-amber-950',     border:'border-yellow-500/50',  glow:'rgba(234,179,8,0.45)',    cat:'boost',    cost:1 },
  swap:           { emoji:'🔄', label:'Trocar Questão',   desc:'Nova pergunta com IA',      color:'text-teal-300',    bg:'from-teal-950 to-emerald-950',     border:'border-teal-500/50',    glow:'rgba(20,184,166,0.45)',   cat:'strategy', cost:3 },
  eliminate:      { emoji:'✂️', label:'Eliminar',         desc:'Remove 2 opções erradas',   color:'text-purple-300',  bg:'from-purple-950 to-fuchsia-950',   border:'border-purple-500/50',  glow:'rgba(168,85,247,0.45)',  cat:'strategy', cost:4 },
  segunda_chance: { emoji:'⏳', label:'Segunda Chance',   desc:'Tente de novo se errar',    color:'text-orange-300',  bg:'from-orange-950 to-red-950',       border:'border-orange-500/50',  glow:'rgba(251,146,60,0.45)',   cat:'defense',  cost:3 },
  queima:         { emoji:'🔥', label:'Supernova',        desc:'+20% pts próx. questão',    color:'text-yellow-300',  bg:'from-yellow-950 to-orange-950',  border:'border-yellow-500/60',  glow:'rgba(251,191,36,0.55)',   cat:'boost',    cost:1 },
};

const ALL_POWERS = ['shield','dica','freeze','turbo','swap','eliminate','segunda_chance','queima'] as const;

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CountUp: React.FC<{to:number;delay?:number;suffix?:string}> = ({to,delay=0,suffix=''}) => {
  const [val,setVal] = useState(0);
  useEffect(()=>{
    if(!to){setVal(0);return;}
    const t=setTimeout(()=>{
      const steps=28;let i=0;
      const timer=setInterval(()=>{
        i++; setVal(Math.round(to*i/steps));
        if(i>=steps){clearInterval(timer);setVal(to);}
      },1000/steps);
      return ()=>clearInterval(timer);
    },delay*1000);
    return ()=>clearTimeout(t);
  },[to,delay]);
  return <>{val}{suffix}</>;
};

export const SoloDuelGame: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [phase, setPhase] = useState<Phase>('setup');
  const [theme, setTheme] = useState<DuelTheme>('aleatorio');
  const [diff, setDiff]   = useState<DuelDifficulty>('medium');
  const count = 8;
  
  // Profile
  const [myAvatarUrl, setMyAvatarUrl] = useState('/avatars/default-impacto.png');
  const [myAvatarCompose, setMyAvatarCompose] = useState<{avatarUrl:string;backgroundUrl?:string;borderUrl?:string}|null>(null);
  const [myLevel, setMyLevel] = useState<number>(1);
  const [myGrade, setMyGrade] = useState<string>('');
  
  // Game state
  const [duelId, setDuelId] = useState('');
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [optMap, setOptMap] = useState<Record<string, any[]>>({});
  const [qIdx, setQIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [_timedOut, setTimedOut] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  
  const [answerData, setAnswerData] = useState<DuelAnswerData[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [xpEarned, setXp] = useState(0);
  const [coins, setCoins] = useState(0);

  const [soloFeedback, setSoloFeedback] = useState<{ type: FeedbackType; correctText?: string; pointsEarned?: number; explanation?: string } | null>(null);
  const pendingSoloNext = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Powers
  const MAX_POWERS_PER_DUEL = 3;
  const [energy, setEnergy] = useState(0); 
  const [usedPowers, setUsedPowers] = useState<DuelPowerType[]>([]);
  const [activePowerPerQ, setActivePowerPerQ] = useState<DuelPowerType|null>(null);
  const [shieldActive, setShieldActive] = useState(false);
  const [freezeActive, setFreezeActive] = useState(false);
  const [turboRemaining, setTurboRemaining] = useState(0);
  const [eliminatedOptionIds, setEliminatedOptionIds] = useState<string[]>([]);
  const [secondChanceAvailable, setSecondChanceAvailable] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [reserveQuestion, setReserveQuestion] = useState<DuelQuestion|null>(null);
  const [swappedQuestions, setSwappedQuestions] = useState<Record<number,DuelQuestion>>({});
  const [_generatingSwap, setGeneratingSwap] = useState(false);
  const [_showPowerFlash, setShowPowerFlash] = useState<DuelPowerType|null>(null);
  const [showBonusFlash, setShowBonusFlash] = useState<string|null>(null);
  const [powerActivationAnim, setPowerActivationAnim] = useState<DuelPowerType|null>(null);
  const [energyBurnBonus, setEnergyBurnBonus] = useState(0);
  const [energyBurnTargetQuestion, setEnergyBurnTargetQuestion] = useState(-1);
  const [powerModal, setPowerModal] = useState<DuelPowerType|null>(null);

  const clearT = () => { if (timerRef.current) clearInterval(timerRef.current); };

  // Profile Data Fetch
  useEffect(() => {
    if (!user) return;
    if (user.avatar) setMyAvatarUrl(user.avatar);
    supabase.from('gamification_stats').select('level').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.level) setMyLevel(data.level); });
    const classId = (user as any).classId;
    if (classId) {
      supabase.from('classes').select('grade').eq('id', classId).maybeSingle()
        .then(({ data }) => { if (data?.grade) setMyGrade(data.grade); });
    }
    const buildAvatar = async () => {
      const { data: prof } = await supabase.from('student_avatar_profiles').select('*').eq('studentId', user.id).maybeSingle();
      if (!prof?.selectedAvatarId) return;
      const ids = [prof.selectedAvatarId, prof.selectedBackgroundId, prof.selectedBorderId].filter(Boolean) as string[];
      const { data: items } = await supabase.from('avatar_catalog').select('id,assetUrl,imageUrl').in('id', ids);
      const map: Record<string,any> = {};
      (items||[]).forEach((i:any) => { map[i.id]=i; });
      const av = map[prof.selectedAvatarId];
      if (av) {
        setMyAvatarCompose({
          avatarUrl: av.assetUrl||av.imageUrl||'',
          backgroundUrl: map[prof.selectedBackgroundId]?.assetUrl||map[prof.selectedBackgroundId]?.imageUrl,
          borderUrl: map[prof.selectedBorderId]?.assetUrl||map[prof.selectedBorderId]?.imageUrl
        });
      }
    };
    buildAvatar();
  }, [user?.id]);

  // Timer Handlers
  const handleTimeout = useCallback(() => {
    if (answered) return;
    clearT();
    const q = questions[qIdx];
    if (!q) return;
    const entry: DuelAnswerData = {
      questionId: q.id, selectedOptionId: 'timeout_skip', isCorrect: false,
      timeUsed: TIME_PER_QUESTION, timeMax: TIME_PER_QUESTION, pointsEarned: 0,
      speedBonus: 0, streakBonus: 0, comboMultiplier: 1, streakAtAnswer: currentStreak,
    };
    setAnswerData(p => [...p, entry]);
    if (shieldActive) setShieldActive(false);
    setCurrentStreak(0); setTimedOut(true); setAnswered(true);
    const correctOptOnTimeout = q.options.find((o: any) => o.isCorrect);
    setSoloFeedback({ type: 'timeout', correctText: correctOptOnTimeout?.text, explanation: q.explanation });
    pendingSoloNext.current = () => handleNext();
  }, [answered, questions, qIdx, currentStreak, shieldActive]);

  useEffect(() => {
    if (phase !== 'game' || answered || freezeActive) return;
    clearT();
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { handleTimeout(); return 0; }
        return p - 1;
      });
    }, 1000);
    return clearT;
  }, [qIdx, phase, answered, freezeActive, handleTimeout]);

  // Starts Duel
  const handleStart = async () => {
    if (!user) return;
    setPhase('loading');
    try {
      const duel = await DuelService.createSoloDuel(user.id, theme, diff, count, myGrade);
      const { data } = await supabase.from('duel_questions').select('*').eq('duelId', duel.id);
      const qs: DuelQuestion[] = data || [];
      const map: Record<string, any[]> = {};
      qs.slice(0, count).forEach(q => { map[q.id] = shuffleArr(q.options); });
      setDuelId(duel.id); 
      setQuestions(qs.slice(0, count)); 
      if (qs.length > count) setReserveQuestion(qs[count]);
      setOptMap(map);
      setQIdx(0); setAnswerData([]); setChosen(null); setAnswered(false); setTimedOut(false);
      setEnergy(0); setUsedPowers([]); setShieldActive(false); setTurboRemaining(0);
      setPhase('game');
    } catch (e) {
      toast.error('Erro ao gerar questões. Tente novamente.');
      setPhase('setup');
    }
  };

  // Powers Logic
  const canActivatePower = (p: DuelPowerType) => !usedPowers.includes(p) && usedPowers.length < MAX_POWERS_PER_DUEL && energy >= POWERS_INFO[p].cost && !answered && timeLeft > 2 && !activePowerPerQ;

  const handleActivatePower = async (chosen: DuelPowerType) => {
    if (!canActivatePower(chosen)) return;
    const cost = POWERS_INFO[chosen].cost;
    setEnergy(e => e - cost);
    setUsedPowers(prev => [...prev, chosen]);
    setActivePowerPerQ(chosen);
    setPowerActivationAnim(chosen);
    setTimeout(() => setPowerActivationAnim(null), 1800);
    setShowPowerFlash(chosen);
    setTimeout(() => setShowPowerFlash(null), 1200);

    if (chosen === 'shield') setShieldActive(true);
    else if (chosen === 'freeze') {
      setFreezeActive(true);
      clearT();
      freezeTimerRef.current = setTimeout(() => {
        setFreezeActive(false);
        setTimeLeft(t => Math.min(TIME_PER_QUESTION, t + 10));
      }, 10000);
    } else if (chosen === 'eliminate') {
      const currentQ = swappedQuestions[qIdx] ?? questions[qIdx];
      const availableOpts = (optMap[currentQ?.id]||[]).filter((o:any) => !eliminatedOptionIds.includes(o.id));
      const wrongAvail = availableOpts.filter((o:any) => !o.isCorrect);
      if (wrongAvail.length < 2) {
        setEnergy(e => Math.min(MAX_ENERGY, e + cost));
        setUsedPowers(prev => prev.filter(p => p !== chosen));
        setActivePowerPerQ(null);
        toast.error('Alternativas insuficientes. Energia devolvida.');
        return;
      }
      setEliminatedOptionIds(wrongAvail.slice(0,2).map((o:any)=>o.id));
    } else if (chosen === 'swap') {
      const applySwap = (newQ: DuelQuestion) => {
        setSwappedQuestions(prev => ({ ...prev, [qIdx]: newQ }));
        if (!optMap[newQ.id]) setOptMap(prev => ({ ...prev, [newQ.id]: shuffleArr(newQ.options) }));
        setReserveQuestion(null); setChosen(null); setEliminatedOptionIds([]);
        setTimeLeft(TIME_PER_QUESTION);
      };
      if (reserveQuestion) applySwap(reserveQuestion);
      else {
        setGeneratingSwap(true);
        clearT();
        try {
          const data = await callGenerateDuel({ theme, difficulty: diff, count: 1, grade: myGrade });
          const raw = data.questions?.[0];
          if (!raw) throw new Error('empty');
          applySwap({ id: window.crypto.randomUUID(), duelId, questionText: raw.questionText, options: raw.options||[], explanation: raw.explanation||'' });
          toast.success('Nova questão gerada! 🔄');
        } catch {
          setEnergy(e => Math.min(MAX_ENERGY, e + cost));
          setUsedPowers(prev => prev.filter(p => p !== 'swap'));
          setActivePowerPerQ(null);
          toast.error('Falha ao gerar questão. Energia devolvida.');
        } finally {
          setGeneratingSwap(false);
        }
      }
    } else if (chosen === 'turbo') setTurboRemaining(3);
    else if (chosen === 'segunda_chance') setSecondChanceAvailable(true);
    else if (chosen === 'dica') setShowHint(true);
    else if (chosen === 'queima') {
      // In solo, we simplify queima: costs 1 energy, gives +20% next turn.
      setEnergyBurnBonus(20);
      setEnergyBurnTargetQuestion(qIdx + 1);
      setShowBonusFlash(`🔥 +20% na próxima questão!`);
      setTimeout(() => setShowBonusFlash(null), 2000);
      toast.success(`🔥 Queima ativa! +20% na próxima questão`);
    }
  };

  const handleConfirm = () => {
    if (freezeActive) return;
    const currentQ = swappedQuestions[qIdx] ?? questions[qIdx];
    if (!chosen || !currentQ) return;
    clearT(); setAnswered(true);
    if (freezeTimerRef.current) { clearTimeout(freezeTimerRef.current); setFreezeActive(false); }
    
    const rawCorrect = currentQ.options.find((o:any) => o.id === chosen)?.isCorrect ?? false;
    const correctOpt = currentQ.options.find((o: any) => o.isCorrect);
    const shieldAbsorbed = !rawCorrect && shieldActive;
    if (shieldAbsorbed) setShieldActive(false);

    const timeUsed = Math.max(1, TIME_PER_QUESTION - timeLeft);
    const scored = calcQuestionScore({ isCorrect: rawCorrect, timeUsed, streakBefore: currentStreak, shieldAbsorbed, wasSkipped: false });
    
    const newStreak = scored.newStreak;
    setCurrentStreak(newStreak);
    setMaxStreak(Math.max(maxStreak, newStreak));

    let appliedBurnBonus = 0;
    if (energyBurnBonus > 0 && qIdx === energyBurnTargetQuestion) {
      appliedBurnBonus = energyBurnBonus;
      setEnergyBurnBonus(0); setEnergyBurnTargetQuestion(-1);
    }

    if (rawCorrect || shieldAbsorbed) {
      const eGain = turboRemaining > 0 ? 2 : 1;
      setEnergy(e => Math.min(MAX_ENERGY, e + eGain));
      if (turboRemaining > 0) {
        setShowBonusFlash('+2 ⚡ TURBO!');
        setTurboRemaining(r => r - 1);
        setTimeout(() => setShowBonusFlash(null), 1400);
      }
    }

    const entry: DuelAnswerData = {
      questionId: currentQ.id, selectedOptionId: chosen, isCorrect: rawCorrect,
      timeUsed, timeMax: TIME_PER_QUESTION,
      pointsEarned: rawCorrect && appliedBurnBonus > 0 ? Math.round(scored.points * (1 + appliedBurnBonus/100)) : scored.points,
      speedBonus: scored.speedBonus, streakBonus: scored.streakBonus,
      comboMultiplier: scored.comboMultiplier, streakAtAnswer: currentStreak,
      shieldActivated: shieldAbsorbed || undefined,
      eliminatedOptionIds: eliminatedOptionIds.length > 0 ? eliminatedOptionIds : undefined,
      powerUsed: activePowerPerQ ?? undefined, energyBurnBonus: appliedBurnBonus > 0 ? appliedBurnBonus : undefined,
    };
    setAnswerData(p => [...p, entry]);

    if (!rawCorrect && !shieldAbsorbed && secondChanceAvailable) {
      setSecondChanceAvailable(false); setAnswered(false); setChosen(null);
      setShowBonusFlash('⏳ Segunda Chance! Tente novamente!');
      setTimeout(() => setShowBonusFlash(null), 2200);
      return;
    }

    setSoloFeedback({
      type: rawCorrect ? 'correct' : 'wrong',
      correctText: !rawCorrect ? correctOpt?.text : undefined,
      pointsEarned: entry.pointsEarned,
      explanation: currentQ.explanation,
    });
    pendingSoloNext.current = () => handleNext();
  };

  const handleNext = async () => {
    setEliminatedOptionIds([]); setActivePowerPerQ(null); setFreezeActive(false); setSecondChanceAvailable(false); setShowHint(false);
    if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    
    if (qIdx < questions.length - 1) {
      setQIdx(p => p + 1); setChosen(null); setAnswered(false); setTimedOut(false); setTimeLeft(TIME_PER_QUESTION);
    } else {
      if (!user || submitting) return;
      setSubmitting(true);
      try {
        const payload = answerData.map(a => ({ questionId: a.questionId, selectedOptionId: a.selectedOptionId }));
        const { xpEarned: xp, coinsEarned: c } = await DuelService.submitSoloTurn(duelId, user.id, payload);
        const totals = calcTotalDetailed(answerData);
        setXp(xp + totals.correctCount * 5); // Add minor base reward
        setCoins(c + totals.correctCount * 2);
        await incrementMissionProgress(user.id, 'duel_completed');
        await incrementMissionProgress(user.id, 'duel_solo_completed');
        setPhase('result');
      } catch { toast.error('Erro ao salvar resultado.'); }
      finally { setSubmitting(false); }
    }
  };

  const resetToSetup = () => {
    setPhase('setup'); setAnswerData([]); setQIdx(0); setChosen(null);
    setAnswered(false); setTimedOut(false); setXp(0); setCoins(0); setEnergy(0);
    setUsedPowers([]); setCurrentStreak(0); setMaxStreak(0);
  };

  const cq = swappedQuestions[qIdx] ?? questions[qIdx];
  const opts = cq ? (optMap[cq.id] || cq.options).filter((o:any)=>!eliminatedOptionIds.includes(o.id)) : [];
  const activeTheme = THEMES.find(t => t.id === theme)!;

  const MyAvatar = ({ size = 100 }: { size?: number }) => myAvatarCompose?.avatarUrl
    ? <AvatarComposer avatarUrl={myAvatarCompose.avatarUrl} backgroundUrl={myAvatarCompose.backgroundUrl} borderUrl={myAvatarCompose.borderUrl} size="md" animate={false} isFloating={false} className={`w-[${size}px] h-[${size}px]`}/>
    : <div className={`w-[${size}px] h-[${size}px] rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-600`}><img src={myAvatarUrl} className="w-full h-full object-cover" onError={e=>{(e.target as any).src='/avatars/default-impacto.png'}} /></div>;

  return (
    <div style={{ maxWidth: phase === 'game' ? 1100 : 800, margin: '0 auto', padding: phase === 'game' ? '0 8px 32px' : '0 16px 96px', position: 'relative' }}>
      
      {powerActivationAnim && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.5, rotate: -20, opacity: 0 }} animate={{ scale: [1.2, 1], rotate: 0, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            className="flex flex-col items-center">
            <span style={{ fontSize: 100, filter: `drop-shadow(0 0 30px ${POWERS_INFO[powerActivationAnim].glow})` }}>{POWERS_INFO[powerActivationAnim].emoji}</span>
            <span className="text-4xl font-black mt-4 uppercase text-white tracking-widest" style={{ fontFamily: "'Rajdhani', sans-serif", textShadow: `0 0 20px ${POWERS_INFO[powerActivationAnim].glow}` }}>
              {POWERS_INFO[powerActivationAnim].label} ATIVADO!
            </span>
          </motion.div>
        </div>
      )}

      {showBonusFlash && (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-6 py-3 rounded-full font-black text-xl text-white shadow-2xl tracking-widest"
          style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', fontFamily: "'Rajdhani', sans-serif" }}>
          {showBonusFlash}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {/* \u2500\u2500\u2500 SETUP \u2500\u2500\u2500 */}
        {phase === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="flex flex-col gap-5">
            <button onClick={() => navigate('/student/duels')} className="flex items-center gap-2 text-xs font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors">
              <ArrowLeft size={16} /> Voltar para Duelos
            </button>
            <div className="relative overflow-hidden rounded-[2rem] p-8 shadow-2xl" style={{ ...CARD }}>
              <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#2e1065] pointer-events-none" />
              <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-indigo-500/20 blur-[80px] pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-purple-500/20 blur-[80px] pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0 relative group flex flex-col items-center">
                  <div className="w-[120px] h-[120px]"><MyAvatar size={120} /></div>
                  <div className="mt-4 text-center">
                    <div className="text-lg font-black text-white uppercase tracking-widest" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{user?.name?.split(' ')[0] || 'Aluno'}</div>
                    <div className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-lg whitespace-nowrap mt-1">Nív. {myLevel} {myGrade ? `\u2022 ${myGrade}` : ''}</div>
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <h1 className="text-4xl font-black text-white mb-2 uppercase" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    Modo <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Treinamento</span>
                  </h1>
                  <p className="text-white/50 text-sm font-bold">Teste seus conhecimentos, ative poderes e não perca pontos. Uma arena solo perfeita para dominar as matérias!</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-6 rounded-[2rem]" style={{ ...CARD }}>
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2"><Star size={14} className="text-amber-400"/> Tema do Treino</h3>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map(t => {
                    const active = theme === t.id;
                    return (
                      <motion.button key={t.id} whileTap={{ scale: 0.94 }} onClick={() => setTheme(t.id)}
                        className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all", active ? `bg-[${t.bg}] shadow-[0_0_15px_${t.bg}]` : "bg-white/5 border-white/5 hover:bg-white/10")} style={{ borderColor: active ? t.color : 'transparent' }}>
                        <t.Icon size={24} style={{ color: active ? t.color : 'rgba(255,255,255,0.4)', filter: active ? `drop-shadow(0 0 8px ${t.color})` : 'none' }} />
                        <span className="text-[10px] font-black uppercase text-center" style={{ color: active ? t.color : 'rgba(255,255,255,0.4)' }}>{t.label}</span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
              <div className="p-6 rounded-[2rem]" style={{ ...CARD }}>
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2"><Target size={14} className="text-red-400"/> Dificuldade</h3>
                <div className="flex flex-col gap-3">
                  {DIFFS.map(d => {
                    const active = diff === d.id;
                    return (
                      <motion.button key={d.id} whileTap={{ scale: 0.97 }} onClick={() => setDiff(d.id)}
                        className={cn("flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left", active ? `bg-[${d.bg}] shadow-[0_0_15px_${d.glow}]` : "bg-white/5 border-white/5 hover:bg-white/10")} style={{ borderColor: active ? d.border : 'transparent' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: active ? d.bg : 'rgba(255,255,255,0.05)' }}><d.Icon size={20} color={d.color} /></div>
                        <div className="flex-1">
                          <p className="font-black text-sm text-white uppercase" style={{ fontFamily: "'Rajdhani', sans-serif", color: active ? d.color : '#fff' }}>{d.label}</p>
                          <p className="text-xs text-white/40 font-bold">{d.desc}</p>
                        </div>
                        {active && <CheckCircle2 size={20} color={d.color} />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleStart}
              className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest mt-2"
              style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)', fontFamily: "'Rajdhani', sans-serif" }}>
              <Gamepad2 size={24} /> Iniciar Batalha Solo
            </motion.button>
          </motion.div>
        )}

        {/* \u2500\u2500\u2500 LOADING \u2500\u2500\u2500 */}
        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 gap-8">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-400 border-r-purple-400 animate-spin" />
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 flex items-center justify-center">
                <BrainCircuit size={48} className="text-indigo-400" />
              </motion.div>
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-white uppercase mb-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Gerando Arena</h2>
              <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-indigo-400 font-bold tracking-widest text-sm uppercase">Preparando os desafios...</motion.p>
            </div>
          </motion.div>
        )}

        {/* \u2500\u2500\u2500 GAME \u2500\u2500\u2500 */}
        {/* ─── GAME ─── Ultra-Premium ─── */}
        {phase === 'game' && cq && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative rounded-[2rem] overflow-hidden"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 60% 10%, #1a0a4a 0%, #050d1f 55%, #000510 100%)', minHeight: '90vh' }}>

            {/* Ambient orbs */}
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-[130px] pointer-events-none" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
            <div className="absolute top-1/2 -right-24 w-72 h-72 rounded-full opacity-15 blur-[100px] pointer-events-none" style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }} />
            <div className="absolute -bottom-24 left-1/3 w-64 h-64 rounded-full opacity-10 blur-[80px] pointer-events-none" style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, transparent 1px, transparent 40px)', backgroundSize: '100% 40px' }} />

            <div className="relative z-10 flex flex-col lg:flex-row min-h-[90vh]">

              {/* ══ LEFT SIDEBAR ══ */}
              <div className="lg:w-[260px] flex-shrink-0 flex flex-col items-center py-8 px-5 border-b lg:border-b-0 lg:border-r border-white/[0.07]">
                <button onClick={resetToSetup} className="self-start flex items-center gap-1.5 text-[10px] font-black text-white/30 uppercase tracking-widest hover:text-white/70 transition-colors mb-6">
                  <ArrowLeft size={13} /> Sair
                </button>

                {/* Big Avatar */}
                <div className="relative mb-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute -inset-[6px] rounded-full pointer-events-none"
                    style={{ background: 'conic-gradient(from 0deg, #6366f1 0%, #a855f7 33%, #ec4899 66%, #6366f1 100%)', WebkitMask: 'radial-gradient(circle at center, transparent 64%, black 65%)' }} />
                  <motion.div animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 2.5, repeat: Infinity }}
                    className="absolute -inset-5 rounded-full blur-2xl opacity-40 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
                  <div className="relative w-[160px] h-[160px] rounded-full overflow-hidden border-2 border-indigo-500/40 shadow-2xl">
                    <MyAvatar size={160} />
                  </div>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[11px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-xl border border-indigo-400/30 whitespace-nowrap">
                    Nív. {myLevel}{myGrade ? ` · ${myGrade}` : ''}
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <div className="text-xl font-black text-white uppercase tracking-widest" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{user?.name?.split(' ')[0] || 'Aluno'}</div>
                  <div className="text-[11px] font-bold text-indigo-300/50 uppercase tracking-wider mt-1">{activeTheme.label} · Solo</div>
                </div>

                {/* Stats */}
                <div className="mt-6 w-full flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-black text-white/35 uppercase tracking-widest">Progresso</span>
                    <span className="text-[10px] font-black text-indigo-300">{qIdx + 1}/{questions.length}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div animate={{ width: `${((qIdx + 1) / Math.max(1, questions.length)) * 100}%` }} transition={{ type: 'spring' }}
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                  </div>
                  <div className="mt-2 flex items-center justify-between bg-white/[0.04] rounded-2xl px-4 py-2.5 border border-white/[0.06]">
                    <span className="text-[11px] font-black text-white/45 uppercase tracking-widest">Streak</span>
                    <div className="flex items-center gap-1.5"><span className="text-lg font-black text-orange-400">{currentStreak}</span><Flame size={15} className="text-orange-400" /></div>
                  </div>
                  <div className="flex items-center justify-between bg-white/[0.04] rounded-2xl px-4 py-2.5 border border-white/[0.06]">
                    <span className="text-[11px] font-black text-white/45 uppercase tracking-widest">Energia</span>
                    <div className="flex items-center gap-1.5">
                      {Array.from({length: MAX_ENERGY}).map((_,i) => (
                        <motion.div key={i} animate={i < energy ? { scale: [1, 1.3, 1] } : {}} transition={{ delay: i * 0.06 }}
                          className={`w-3 h-3 rounded-full border ${i < energy ? 'bg-yellow-400 border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'bg-transparent border-white/20'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1 min-h-[24px]">
                    {shieldActive && <div className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30 flex items-center gap-1"><Shield size={9}/> Escudo</div>}
                    {turboRemaining > 0 && <div className="text-[10px] font-black text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-full border border-yellow-500/30 flex items-center gap-1"><Zap size={9}/> ×{turboRemaining}</div>}
                    {freezeActive && <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/30">❄️ Freeze</div>}
                    {energyBurnTargetQuestion === qIdx && <div className="text-[10px] font-black text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/30">🔥 +{energyBurnBonus}%</div>}
                  </div>
                </div>

                {/* Powers mini-grid */}
                <div className="mt-auto pt-6 w-full">
                  <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3 text-center">Poderes — clique para ativar</div>
                  <div className="grid grid-cols-4 gap-2">
                    {(ALL_POWERS as readonly DuelPowerType[]).map(p => {
                      const info = POWERS_INFO[p];
                      const canUse = canActivatePower(p);
                      const used = usedPowers.includes(p);
                      return (
                        <motion.button key={p} whileHover={canUse ? { scale: 1.12, y: -2 } : {}} whileTap={canUse ? { scale: 0.9 } : {}}
                          onClick={() => setPowerModal(p)} title={info.label}
                          className={cn('flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 relative overflow-hidden aspect-square cursor-pointer',
                            canUse ? `bg-gradient-to-b ${info.bg} ${info.border} shadow-lg` : used ? 'bg-white/3 border-white/5 opacity-20' : 'bg-white/5 border-white/10 opacity-35')}>
                          {canUse && <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.8, repeat: Infinity }} className="absolute inset-0 bg-white/10 pointer-events-none" />}
                          <span className="text-xl relative z-10">{info.emoji}</span>
                          <span className="text-[8px] font-black text-yellow-400 flex items-center gap-0.5 mt-0.5 relative z-10">{info.cost}<Zap size={6}/></span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ══ RIGHT — Question Area ══ */}
              <div className="flex-1 flex flex-col p-6 lg:p-8 gap-5">

                {/* Giant Timer Pill */}
                <motion.div animate={timeLeft <= 5 ? { scale: [1, 1.03, 1] } : {}} transition={{ duration: 0.45, repeat: timeLeft <= 5 ? Infinity : 0 }}
                  className={cn('flex items-center gap-4 px-7 py-4 rounded-[2rem] border-2 shadow-2xl w-full',
                    freezeActive ? 'bg-blue-950/80 border-blue-400/60' : timeLeft > 15 ? 'bg-emerald-950/80 border-emerald-500/50' : timeLeft > 7 ? 'bg-amber-950/80 border-amber-500/60' : 'bg-red-950/90 border-red-500/80')}
                  style={{ boxShadow: freezeActive ? '0 0 30px rgba(96,165,250,0.3)' : timeLeft > 15 ? '0 0 24px rgba(16,185,129,0.2)' : timeLeft > 7 ? '0 0 28px rgba(245,158,11,0.35)' : '0 0 40px rgba(239,68,68,0.55)' }}>
                  <motion.div animate={timeLeft <= 7 && !freezeActive ? { rotate: [0,-18,18,0] } : {}} transition={{ duration: 0.35, repeat: Infinity }}>
                    <Timer size={30} className={cn(freezeActive ? 'text-blue-400' : timeLeft > 15 ? 'text-emerald-400' : timeLeft > 7 ? 'text-amber-400' : 'text-red-400')} />
                  </motion.div>
                  <span className={cn('text-5xl font-black tabular-nums', freezeActive ? 'text-blue-300' : timeLeft > 15 ? 'text-emerald-300' : timeLeft > 7 ? 'text-amber-300' : 'text-red-300')} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    {String(timeLeft).padStart(2,'0')}<span className="text-2xl opacity-50">s</span>
                  </span>
                  {freezeActive && <span className="text-blue-300 text-xs font-black uppercase tracking-widest ml-1">❄️ Congelado</span>}
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden ml-2">
                    <motion.div animate={{ width: `${(timeLeft / TIME_PER_QUESTION) * 100}%` }} transition={{ duration: 0.9, ease: 'linear' }}
                      className={cn('h-full rounded-full', freezeActive ? 'bg-blue-400' : timeLeft > 15 ? 'bg-emerald-400' : timeLeft > 7 ? 'bg-amber-400' : 'bg-red-500')} />
                  </div>
                </motion.div>

                {/* Question + Answers */}
                <AnimatePresence mode="wait">
                  <motion.div key={qIdx} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.3, type: 'spring', stiffness: 220 }}
                    className="flex flex-col gap-4 flex-1">

                    <div className="bg-white/[0.04] border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-xl">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                          <span className="text-indigo-300 font-black text-sm">{qIdx + 1}</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white leading-snug flex-1">{cq.questionText}</h2>
                      </div>
                    </div>

                    {showHint && cq.explanation && !answered && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                        <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">💡 DICA</p>
                        <p className="text-sm text-amber-200/80 font-bold">{cq.explanation.substring(0, Math.floor(cq.explanation.length / 2))}...</p>
                      </motion.div>
                    )}

                    <div className="flex flex-col gap-3">
                      {opts.map((opt, idx) => {
                        const sel = chosen === opt.id;
                        const show = answered;
                        let bg=''; let border=''; let textCol=''; let badgeBg='';
                        if (!show && !sel) { bg='bg-white/[0.05] hover:bg-white/[0.1]'; border='border-white/10'; textCol='text-white/85'; badgeBg='bg-white/10 text-white/50'; }
                        else if (!show && sel) { bg='bg-indigo-500/20'; border='border-indigo-500'; textCol='text-white'; badgeBg='bg-indigo-500 text-white'; }
                        else if (show && opt.isCorrect) { bg='bg-emerald-500/20'; border='border-emerald-500/60'; textCol='text-emerald-300'; badgeBg='bg-emerald-500/30 text-emerald-300'; }
                        else if (show && sel && !opt.isCorrect) { bg='bg-red-500/20'; border='border-red-500/60'; textCol='text-red-300'; badgeBg='bg-red-500/30 text-red-300'; }
                        else { bg='bg-white/[0.03] opacity-40'; border='border-transparent'; textCol='text-white/20'; badgeBg='bg-white/5 text-white/20'; }
                        return (
                          <motion.button key={opt.id} whileHover={!answered ? { scale: 1.015, x: 5 } : {}} whileTap={!answered ? { scale: 0.985 } : {}}
                            disabled={answered} onClick={() => setChosen(opt.id)}
                            className={cn('w-full text-left p-5 rounded-2xl border-2 flex items-center gap-4 transition-all duration-200', bg, border)}
                            style={{ boxShadow: !show && sel ? '0 0 22px rgba(99,102,241,0.28)' : show && opt.isCorrect ? '0 0 22px rgba(16,185,129,0.22)' : 'none' }}>
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0', badgeBg)}>{LETTERS[idx]}</div>
                            <span className={cn('flex-1 text-lg font-bold', textCol)}>{opt.text}</span>
                            {show && opt.isCorrect && <CheckCircle2 size={26} className="text-emerald-400 shrink-0" />}
                            {show && sel && !opt.isCorrect && <XCircle size={26} className="text-red-400 shrink-0" />}
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="mt-2">
                      {!answered ? (
                        <motion.button whileHover={{ scale: chosen ? 1.02 : 1 }} whileTap={{ scale: chosen ? 0.97 : 1 }}
                          disabled={!chosen} onClick={handleConfirm}
                          className={cn('w-full py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all', chosen ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.45)]' : 'bg-white/5 text-white/20 cursor-not-allowed')}
                          style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                          Confirmar Resposta
                        </motion.button>
                      ) : (
                        <motion.button initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          disabled={submitting} onClick={handleNext}
                          className="w-full py-5 rounded-2xl font-black text-xl text-white uppercase tracking-widest bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                          style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                          {submitting ? 'Salvando...' : qIdx < questions.length - 1 ? 'Próxima Questão ⚡' : 'Ver Resultados 🏆'}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* ── POWER MODAL ── */}
            <AnimatePresence>
              {powerModal && (() => {
                const info = POWERS_INFO[powerModal];
                const canUse = canActivatePower(powerModal);
                return (
                  <motion.div key="power-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-6"
                    style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(14px)' }}
                    onClick={() => setPowerModal(null)}>
                    <motion.div initial={{ scale: 0.75, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.75, y: 50 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                      onClick={e => e.stopPropagation()}
                      className={`relative flex flex-col items-center gap-6 p-10 rounded-[2.5rem] border-2 w-full max-w-sm overflow-hidden shadow-2xl bg-gradient-to-b ${info.bg} ${info.border}`}
                      style={{ boxShadow: `0 0 80px ${info.glow}, 0 25px 70px rgba(0,0,0,0.7)` }}>
                      <div className="absolute inset-0 pointer-events-none opacity-25" style={{ background: `radial-gradient(circle at 50% 0%, ${info.glow}, transparent 70%)` }} />
                      <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ fontSize: 96, filter: `drop-shadow(0 0 28px ${info.glow})`, position: 'relative', zIndex: 1 }}>
                        {info.emoji}
                      </motion.span>
                      <div className="text-center relative z-10">
                        <div className={`text-4xl font-black uppercase tracking-widest ${info.color}`} style={{ fontFamily: "'Rajdhani', sans-serif", textShadow: `0 0 20px ${info.glow}` }}>{info.label}</div>
                        <div className="text-white/55 text-base font-bold mt-2">{info.desc}</div>
                      </div>
                      <div className="flex items-center gap-2 bg-black/40 px-6 py-2.5 rounded-full border border-yellow-400/20 relative z-10">
                        <span className="text-yellow-400 text-2xl font-black">{info.cost}</span>
                        <Zap size={17} className="text-yellow-400" />
                        <span className="text-white/45 text-sm font-bold uppercase tracking-widest">de Energia</span>
                      </div>
                      {!canUse && (
                        <div className="text-red-400 text-sm font-bold uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20 relative z-10">
                          {usedPowers.includes(powerModal) ? '✓ Já Utilizado' : energy < info.cost ? `⚡ Energia: ${energy}/${info.cost}` : usedPowers.length >= MAX_POWERS_PER_DUEL ? 'Limite: 3 Poderes' : 'Indisponível'}
                        </div>
                      )}
                      <div className="flex w-full gap-3 relative z-10">
                        <button onClick={() => setPowerModal(null)}
                          className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white/55 font-black uppercase tracking-widest hover:bg-white/15 transition-all">
                          Cancelar
                        </button>
                        {canUse && (
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            onClick={() => { setPowerModal(null); handleActivatePower(powerModal); }}
                            className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-white border ${info.border} bg-gradient-to-r from-white/20 to-white/10 hover:from-white/28 transition-all`}
                            style={{ boxShadow: `0 0 25px ${info.glow}` }}>
                            ⚡ Ativar!
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </motion.div>
        )}


        {/* \u2500\u2500\u2500 RESULT \u2500\u2500\u2500 */}
        {phase === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-[2.5rem] p-8 md:p-12 text-center" style={{ ...CARD, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/40 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.3),transparent_70%)] pointer-events-none" />

              {/* Stars animation based on accuracy */}
              <div className="flex justify-center gap-4 mb-8">
                {Array.from({ length: 5 }).map((_, i) => {
                  const accuracy = calcTotalDetailed(answerData).accuracy;
                  const earned = (i + 1) * 20 <= accuracy * 100;
                  return (
                    <motion.div key={i} initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2 + i * 0.1, type: 'spring' }} className="relative z-10">
                      <Star size={48} className={earned ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'text-white/10'} fill={earned ? 'currentColor' : 'transparent'} />
                    </motion.div>
                  )
                })}
              </div>

              <h2 className="text-5xl md:text-6xl font-black text-white uppercase tracking-widest mb-4 relative z-10" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                TREINO CONCLUÍDO
              </h2>
              <p className="text-indigo-300 font-bold uppercase tracking-widest relative z-10 mb-10">
                Resumo da Batalha Solo
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                  <div className="text-3xl font-black text-white mb-1"><CountUp to={calcTotalDetailed(answerData).correctCount} /></div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Acertos</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                  <div className="text-3xl font-black text-orange-400 mb-1"><CountUp to={maxStreak} />🔥</div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Maior Streak</div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl">
                  <div className="text-3xl font-black text-emerald-400 mb-1">+<CountUp to={xpEarned} /></div>
                  <div className="text-[10px] font-black text-emerald-400/50 uppercase tracking-widest">XP Ganho</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-5 rounded-3xl">
                  <div className="text-3xl font-black text-yellow-400 mb-1">+<CountUp to={coins} /></div>
                  <div className="text-[10px] font-black text-yellow-400/50 uppercase tracking-widest">Moedas</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={resetToSetup}
                className="py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-white font-black text-lg uppercase tracking-widest transition-all" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                <Shuffle size={20} /> Jogar Novamente
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/student/duels')}
                className="py-5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center gap-3 text-white font-black text-lg uppercase tracking-widest shadow-xl shadow-indigo-500/25 transition-all" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                <Swords size={20} /> Arena Multiplayer
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
