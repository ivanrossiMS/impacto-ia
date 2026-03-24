import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { Sword, CheckCircle2, XCircle, Flame, Zap, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DuelService } from '../../services/duel.service';
import type { Duel, DuelQuestion, DuelAnswerData } from '../../types/duel';
import { toast } from 'sonner';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';
import { AnswerFeedbackOverlay, type FeedbackType } from '../../components/ui/AnswerFeedbackOverlay';
import {
  TIME_PER_QUESTION, ACCELERATION_TIME_MULT, MAX_ENERGY,
  calcQuestionScore, calcTotalDetailed, calcComboMultiplier,
} from '../../lib/duelScoring';
import { calcDuelRewards } from '../../lib/duelRewards';
import { callGenerateDuel } from '../../ai/client';

type GamePhase = 'lobby' | 'cinematic' | 'playing' | 'finished';

const LETTERS = ['A', 'B', 'C', 'D'];
const BATTLE_PHRASES = [
  'Que vença o mais inteligente! 🧠',
  'Batalha do Conhecimento! ⚔️',
  'Duelo iniciado! O melhor ganha! 🔥',
  'Prove o que você sabe! 🎲',
  'Que comece a batalha! ⚔️',
];

type PowerCat = 'defense' | 'control' | 'strategy' | 'boost';

const POWERS_INFO: Record<string, {
  emoji: string; label: string; desc: string;
  color: string; bg: string; border: string; glow: string;
  cat: PowerCat; cost: number;
}> = {
  shield:         { emoji:'🛡️', label:'Escudo',          desc:'Bloqueia 1 erro — mantém streak e energia',    color:'text-cyan-300',    bg:'from-cyan-950 to-blue-950',        border:'border-cyan-500/50',    glow:'rgba(34,211,238,0.45)',   cat:'defense',  cost:1 },
  dica:           { emoji:'💡', label:'Dica',             desc:'Revela uma dica da questão atual',              color:'text-amber-300',   bg:'from-amber-950 to-yellow-950',     border:'border-amber-500/50',   glow:'rgba(251,191,36,0.45)',   cat:'strategy', cost:2 },
  freeze:         { emoji:'❄️', label:'Congelar',         desc:'+10 segundos no cronômetro desta questão',      color:'text-blue-200',    bg:'from-blue-950 to-indigo-950',      border:'border-blue-400/50',    glow:'rgba(96,165,250,0.45)',   cat:'control',  cost:2 },
  turbo:          { emoji:'⚡', label:'Turbo',             desc:'Próximos 3 acertos dão energia em dobro',       color:'text-yellow-300',  bg:'from-yellow-950 to-amber-950',     border:'border-yellow-500/50',  glow:'rgba(234,179,8,0.45)',    cat:'boost',    cost:1 },
  swap:           { emoji:'🔄', label:'Trocar Questão',   desc:'Substitui a pergunta atual por outra',          color:'text-teal-300',    bg:'from-teal-950 to-emerald-950',     border:'border-teal-500/50',    glow:'rgba(20,184,166,0.45)',   cat:'strategy', cost:3 },
  eliminate:      { emoji:'✂️', label:'Eliminar',         desc:'Remove 2 alternativas erradas da questão',      color:'text-purple-300',  bg:'from-purple-950 to-fuchsia-950',   border:'border-purple-500/50',  glow:'rgba(168,85,247,0.45)',  cat:'strategy', cost:4 },
  segunda_chance: { emoji:'⏳', label:'Segunda Chance',   desc:'Permite responder novamente se errar',          color:'text-orange-300',  bg:'from-orange-950 to-red-950',       border:'border-orange-500/50',  glow:'rgba(251,146,60,0.45)',   cat:'defense',  cost:3 },
  queima:         { emoji:'🔥', label:'Queima de Energia',desc:'Cada energia gasta = +20% de pontos na próxima questão', color:'text-yellow-300',  bg:'from-yellow-950 to-orange-950',  border:'border-yellow-500/60',  glow:'rgba(251,191,36,0.55)',   cat:'boost',    cost:1 },
};

const ALL_POWERS = ['shield','dica','freeze','turbo','swap','eliminate','segunda_chance','queima'] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Animated number count-up */
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


// �"?�"? Duel theme map �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
const DUEL_THEMES: Record<string, { emoji: string; label: string; color: string }> = {
  aleatorio:       { emoji: '🎲', label: 'Aleatório',   color: '#a78bfa' },
  historia:        { emoji: '📜', label: 'História',    color: '#fb923c' },
  geografia:       { emoji: '🌍', label: 'Geografia',   color: '#34d399' },
  ciencias:        { emoji: '🧬', label: 'Ciências',    color: '#60a5fa' },
  arte:            { emoji: '🎨', label: 'Arte',        color: '#f472b6' },
  esportes:        { emoji: '⚽', label: 'Esportes',    color: '#4ade80' },
  entretenimento:  { emoji: '🎬', label: 'Cultura Pop', color: '#facc15' },
  quem_sou_eu:     { emoji: '🧐', label: 'Quem Sou Eu?',color: '#c084fc' },
  logica:          { emoji: '🧩', label: 'Lógica',      color: '#38bdf8' },
};

export const DuelGame: React.FC = () => {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  // �"?�"?�"? Core �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [duel, setDuel] = useState<Duel | null>(null);
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [shuffledOptionsMap, setShuffledOptionsMap] = useState<Record<string, any[]>>({});
  const [opponent, setOpponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [battlePhrase] = useState(() => BATTLE_PHRASES[Math.floor(Math.random() * BATTLE_PHRASES.length)]);

  // �"?�"?�"? Avatars �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const [myAvatarUrl, setMyAvatarUrl] = useState('/avatars/default-impacto.png');
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState('/avatars/default-impacto.png');
  const [myAvatarCompose, setMyAvatarCompose] = useState<{avatarUrl:string;backgroundUrl?:string;borderUrl?:string}|null>(null);
  const [oppAvatarCompose, setOppAvatarCompose] = useState<{avatarUrl:string;backgroundUrl?:string;borderUrl?:string}|null>(null);

  // �"?�"?�"? Player info �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const [myLevel, setMyLevel] = useState<number>(1);
  const [myGrade, setMyGrade] = useState<string>('');
  const [oppLevel, setOppLevel] = useState<number>(1);
  const [oppGrade, setOppGrade] = useState<string>('');

  // �"?�"?�"? Playing state �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string|null>(null);
  const [answered, setAnswered] = useState(false);
  const [_timedOut, setTimedOut] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [isPressureApplied, setIsPressureApplied] = useState(false);

  // �"?�"?�"? Scoring �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const [answerData, setAnswerData] = useState<DuelAnswerData[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [earnedXP, setEarnedXP] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);

  // �"?�"?�"? Powers & Energy �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const [energy, setEnergy] = useState(0);                    // always starts at 0
  const [usedPowers, setUsedPowers] = useState<import('../../types/duel').DuelPowerType[]>([]);
  const [activePowerPerQ, setActivePowerPerQ] = useState<import('../../types/duel').DuelPowerType|null>(null);
  const [shieldActive, setShieldActive] = useState(false);
  const [freezeActive, setFreezeActive] = useState(false);    // timer frozen
  const [turboRemaining, setTurboRemaining] = useState(0);    // acertos restantes com 2x energia
  const [eliminatedOptionIds, setEliminatedOptionIds] = useState<string[]>([]);
  const [reserveQuestion, setReserveQuestion] = useState<DuelQuestion|null>(null); // Trocar Questão reserve
  const [swappedQuestions, setSwappedQuestions] = useState<Record<number,DuelQuestion>>({});
  const [, setGeneratingSwap] = useState(false);
  const [showPowerPanel, setShowPowerPanel] = useState(false);
  const [secondChanceAvailable, setSecondChanceAvailable] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showPowerFlash, setShowPowerFlash] = useState<import('../../types/duel').DuelPowerType|null>(null);
  const [showBonusFlash, setShowBonusFlash] = useState<string|null>(null);
  const [powerActivationAnim, setPowerActivationAnim] = useState<import('../../types/duel').DuelPowerType|null>(null);
  // Queima de Energia state
  const [showQueimModal, setShowQueimModal] = useState(false);
  const [queimAmount, setQueimAmount] = useState(1);
  const [energyBurnBonus, setEnergyBurnBonus] = useState(0); // active % bonus (0 = inactive)
  const [energyBurnTargetQuestion, setEnergyBurnTargetQuestion] = useState(-1); // question index the burn applies to (-1 = none)

  // �"?�"?�"? UI �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const deadlineKey   = `duel_deadline_${duelId}_q${currentQuestionIndex}`;
  const answeredKey   = `duel_answered_${duelId}_q${currentQuestionIndex}`;
  const answerDataKey = `duel_answerdata_${duelId}`;
  const qIndexKey     = `duel_qindex_${duelId}_${user?.id}`;  // persist current question # across navigation

  // �"?�"? Answer feedback overlay �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const [duelFeedback, setDuelFeedback] = useState<{ type: FeedbackType; correctText?: string; pointsEarned?: number; explanation?: string } | null>(null);
  const pendingDuelNext = useRef<(() => void) | null>(null);

  const clearTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };
  const saveDeadline = (d: number) => localStorage.setItem(deadlineKey, String(d));
  const clearDeadline = () => localStorage.removeItem(deadlineKey);
  const getSecsFromDeadline = (key: string) => {
    const s = localStorage.getItem(key);
    return s ? Math.max(0, Math.ceil((Number(s) - Date.now()) / 1000)) : null;
  };
  const saveAnswerData = (d: DuelAnswerData[]) => localStorage.setItem(answerDataKey, JSON.stringify(d));
  const loadAnswerData = (): DuelAnswerData[] => { try { return JSON.parse(localStorage.getItem(answerDataKey)||'[]'); } catch { return []; } };
  const saveQIndex = (i: number) => localStorage.setItem(qIndexKey, String(i));
  const loadQIndex = (): number | null => { const s = localStorage.getItem(qIndexKey); return s !== null ? Number(s) : null; };
  const clearAllDeadlines = () => {
    for (let i = 0; i < Math.max(questions.length, 10); i++) {
      localStorage.removeItem(`duel_deadline_${duelId}_q${i}`);
      localStorage.removeItem(`duel_answered_${duelId}_q${i}`);
    }
    localStorage.removeItem(answerDataKey);
    localStorage.removeItem(qIndexKey);  // clear resume checkpoint on duel finish
  };

  // �"?�"?�"? Avatar builder �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const buildAvatarData = async (uid: string) => {
    const { data: prof } = await supabase.from('student_avatar_profiles').select('selectedAvatarId,selectedBackgroundId,selectedBorderId').eq('studentId', uid).maybeSingle();
    if (!prof?.selectedAvatarId) return null;
    const ids = [prof.selectedAvatarId, prof.selectedBackgroundId, prof.selectedBorderId].filter(Boolean) as string[];
    const { data: items } = await supabase.from('avatar_catalog').select('id,assetUrl,imageUrl').in('id', ids);
    const map: Record<string,any> = {};
    (items||[]).forEach((i:any) => { map[i.id]=i; });
    const av = map[prof.selectedAvatarId]; const bg = prof.selectedBackgroundId?map[prof.selectedBackgroundId]:null; const bd = prof.selectedBorderId?map[prof.selectedBorderId]:null;
    return { avatarUrl: av?.assetUrl||av?.imageUrl||'', backgroundUrl: bg?.assetUrl||bg?.imageUrl, borderUrl: bd?.assetUrl||bd?.imageUrl };
  };

  // �"?�"?�"? Fetch data �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const fetchData = async () => {
    if (!duelId || !user) return;
    try {
      const { data: d } = await supabase.from('duels').select('*').eq('id', duelId).single();
      setDuel(d);
      if (d) {
        const { data: q } = await supabase.from('duel_questions').select('*').eq('duelId', duelId);
        const allQs = q || [];
        // Last question (index questionCount) is the reserve for Swap power
        const mainQs = allQs.slice(0, d.questionCount);
        const reserve = allQs.length > d.questionCount ? allQs[d.questionCount] : null;
        setQuestions(mainQs);
        setReserveQuestion(reserve);
        const map: Record<string,any[]> = {};
        allQs.forEach((question: DuelQuestion) => { map[question.id] = shuffle(question.options); });
        setShuffledOptionsMap(map);
        const oppId = d.challengerId === user.id ? d.challengedId : d.challengerId;
        const { data: opp } = await supabase.from('users').select('*').eq('id', oppId).single();
        setOpponent(opp);
        if (user.avatar) setMyAvatarUrl(user.avatar);
        if (opp?.avatar) setOpponentAvatarUrl(opp.avatar);
        buildAvatarData(user.id).then(data => { if (data?.avatarUrl) setMyAvatarCompose(data); });
        buildAvatarData(oppId).then(data => { if (data?.avatarUrl) setOppAvatarCompose(data); });
        // Fetch opponent level and grade
        supabase.from('gamification_stats').select('level').eq('id', oppId).maybeSingle()
          .then(({ data }) => { if (data?.level) setOppLevel(data.level); });
        const oppClassId = (opp as any)?.classId;
        if (oppClassId) {
          supabase.from('classes').select('grade').eq('id', oppClassId).maybeSingle()
            .then(({ data }) => { if (data?.grade) setOppGrade(data.grade); });
        }
        const isChallenger = d.challengerId === user.id;
        if (isChallenger && d.challengedPressureUsed) setIsPressureApplied(true);
        if (!isChallenger && d.challengerPressureUsed) setIsPressureApplied(true);
      }
    } catch(e){ console.error(e); }
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel(`duel_game_${duelId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'duels', filter:`id=eq.${duelId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [duelId, user?.id]);

  // Fetch player level and class
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('gamification_stats').select('level').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.level) setMyLevel(data.level); });
    const classId = (user as any).classId;
    if (classId) {
      supabase.from('classes').select('grade').eq('id', classId).maybeSingle()
        .then(({ data }) => { if (data?.grade) setMyGrade(data.grade); });
    }
  }, [user?.id]);

  useEffect(() => {
    if (duel && questions.length > 0) {
      const isAm = duel.challengerId === user?.id;
      const alreadyPlayed = (isAm && duel.challengerTurnCompleted) || (!isAm && duel.challengedTurnCompleted);
      if (alreadyPlayed) {
        const stored = loadAnswerData();
        if (stored.length > 0) setAnswerData(stored);
        setPhase('finished');
      } else {
        // Check if the student was mid-game (left during a turn)
        const savedIdx = loadQIndex();
        if (savedIdx !== null && savedIdx > 0 && savedIdx < questions.length) {
          // Resume: restore answer history + jump to the saved question, skip lobby
          const storedAnswers = loadAnswerData();
          if (storedAnswers.length > 0) setAnswerData(storedAnswers);
          setCurrentQuestionIndex(savedIdx);
          setPhase('playing');
          import('sonner').then(({ toast }) => toast.info('⏱️ Retomando onde você parou...', { duration: 2500 }));
        } else {
          setPhase('lobby');
        }
      }
      setIsLoading(false);
    }
  }, [duel, questions, user?.id]);

  // �"?�"?�"? Timer �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const effectiveTime = isPressureApplied ? Math.round(TIME_PER_QUESTION * ACCELERATION_TIME_MULT) : TIME_PER_QUESTION;

  const handleTimeout = useCallback(() => {
    if (answered) return;
    clearTimer(); clearDeadline();
    const q = questions[currentQuestionIndex];
    const entry: DuelAnswerData = {
      questionId: q.id, selectedOptionId: 'timeout_skip', isCorrect: false,
      timeUsed: effectiveTime, timeMax: effectiveTime, pointsEarned: 0,
      speedBonus: 0, streakBonus: 0, comboMultiplier: 1, streakAtAnswer: currentStreak,
    };
    const newData = [...answerData, entry];
    saveAnswerData(newData); setAnswerData(newData);
    if (shieldActive) { setShieldActive(false); }
    setCurrentStreak(0); setTimedOut(true); setAnswered(true);
    localStorage.setItem(answeredKey, JSON.stringify({ questionId: q.id, selectedOptionId: 'timeout_skip' }));
    // Timeout: show correct answer + explanation (same as wrong answer)
    const correctOptOnTimeout = q.options.find((o: any) => o.isCorrect);
    setDuelFeedback({ type: 'timeout', correctText: correctOptOnTimeout?.text, explanation: q.explanation ?? undefined });
    pendingDuelNext.current = () => {};
  }, [answered, questions, currentQuestionIndex, answerData, effectiveTime, currentStreak, shieldActive]);

  useEffect(() => {
    if (isLoading || phase !== 'playing') return;
    saveQIndex(currentQuestionIndex);  // persist position — timer counts even if user navigates away
    const savedAnswer = localStorage.getItem(answeredKey);
    if (savedAnswer) { setAnswered(true); setTimedOut(true); setTimeLeft(0); clearTimer(); return; }
    if (answered) return;
    const existing = getSecsFromDeadline(deadlineKey);
    if (existing === null) {
      const dl = Date.now() + effectiveTime * 1000;
      saveDeadline(dl); setTimeLeft(effectiveTime);
    } else if (existing === 0) {
      setTimeLeft(0); handleTimeout(); return;
    } else {
      setTimeLeft(existing);
    }
    clearTimer();
    timerRef.current = setInterval(() => {
      const secs = getSecsFromDeadline(deadlineKey);
      if (secs === null || secs <= 0) { clearTimer(); setTimeLeft(0); handleTimeout(); }
      else setTimeLeft(secs);
    }, 500);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const s = getSecsFromDeadline(deadlineKey);
        if (s === null) return;
        if (s <= 0) { clearTimer(); setTimeLeft(0); handleTimeout(); }
        else setTimeLeft(s);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearTimer(); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [currentQuestionIndex, isLoading, phase, answered]);

  // �"?�"?�"? Timer freeze ref �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // �"?�"?�"? Power activation �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
const MAX_POWERS_PER_DUEL = 3; // Maximum power activations per duel

  // Power activation
  const canActivatePower = (p: import('../../types/duel').DuelPowerType) =>
    !usedPowers.includes(p) &&
    usedPowers.length < MAX_POWERS_PER_DUEL &&
    energy >= (POWERS_INFO[p]?.cost ?? 1) &&
    !answered && timeLeft > 2 && !activePowerPerQ;

  const handleActivatePower = async (chosen: import('../../types/duel').DuelPowerType) => {
    if (!canActivatePower(chosen)) return;
    const cost = POWERS_INFO[chosen]?.cost ?? 1;
    setEnergy(e => e - cost);
    setUsedPowers(prev => [...prev, chosen]);
    setActivePowerPerQ(chosen);
    setShowPowerPanel(false);
    setPowerActivationAnim(chosen);
    setTimeout(() => setPowerActivationAnim(null), 1800);
    setShowPowerFlash(chosen);
    setTimeout(() => setShowPowerFlash(null), 1200);

    if (chosen === 'shield') {
      setShieldActive(true);
    } else if (chosen === 'freeze') {
      // �"?�"? Real timer freeze: pause interval, extend deadline, resume after 5s �"?�"?
      setFreezeActive(true);
      clearTimer();  // stop the running interval
      const FREEZE_SECS = 10;
      // Extend stored deadline by freeze duration
      const stored = localStorage.getItem(deadlineKey);
      if (stored) {
        const extended = Number(stored) + FREEZE_SECS * 1000;
        localStorage.setItem(deadlineKey, String(extended));
        setTimeLeft(t => Math.min(effectiveTime, t + FREEZE_SECS));
      }
      freezeTimerRef.current = setTimeout(() => {
        setFreezeActive(false);
        // Restart the ticker
        timerRef.current = setInterval(() => {
          const secs = getSecsFromDeadline(deadlineKey);
          if (secs === null || secs <= 0) { clearTimer(); setTimeLeft(0); handleTimeout(); }
          else setTimeLeft(secs);
        }, 500);
      }, FREEZE_SECS * 1000);
    } else if (chosen === 'eliminate') {
      const currentQ = swappedQuestions[currentQuestionIndex] ?? questions[currentQuestionIndex];
      const availableOpts = (shuffledOptionsMap[currentQ?.id]||[]).filter((o:any) => !eliminatedOptionIds.includes(o.id));
      const wrongAvail = availableOpts.filter((o:any) => !o.isCorrect);
      if (wrongAvail.length < 2) {
        // Not enough wrong options — refund and cancel
        setEnergy(e => Math.min(MAX_ENERGY, e + cost));
        setUsedPowers(prev => prev.filter(p => p !== chosen));
        setActivePowerPerQ(null);
        toast.error('Alternativas insuficientes para eliminar! Energia devolvida.');
        return;
      }
      const toElim = wrongAvail.slice(0,2).map((o:any)=>o.id);
      setEliminatedOptionIds(toElim);
    } else if (chosen === 'swap') {
      // Helper: apply swapped question + restart timer
      const applySwap = (newQ: DuelQuestion) => {
        setSwappedQuestions(prev => ({ ...prev, [currentQuestionIndex]: newQ }));
        if (!shuffledOptionsMap[newQ.id]) {
          setShuffledOptionsMap(prev => ({ ...prev, [newQ.id]: shuffle(newQ.options) }));
        }
        setReserveQuestion(null);
        setSelectedAnswer(null);
        setEliminatedOptionIds([]);
        clearTimer(); clearDeadline();
        const dl = Date.now() + effectiveTime * 1000;
        localStorage.setItem(deadlineKey, String(dl));
        setTimeLeft(effectiveTime);
        timerRef.current = setInterval(() => {
          const secs = getSecsFromDeadline(deadlineKey);
          if (secs === null || secs <= 0) { clearTimer(); setTimeLeft(0); handleTimeout(); }
          else setTimeLeft(secs);
        }, 500);
      };

      if (reserveQuestion) {
        applySwap(reserveQuestion);
      } else {
        // No pre-generated reserve — generate one on-demand via AI
        setGeneratingSwap(true);
        clearTimer(); // pause timer while generating
        try {
          const data = await callGenerateDuel({
            theme: duel?.theme || 'aleatorio',
            difficulty: duel?.difficulty || 'medium',
            count: 1,
            grade: myGrade || '',
          });
          const raw = data.questions?.[0];
          if (!raw) throw new Error('empty');
          const newQ: DuelQuestion = {
            id: window.crypto.randomUUID(),
            duelId: duelId || '',
            questionText: raw.questionText,
            options: raw.options || [],
            explanation: raw.explanation || '',
          };
          applySwap(newQ);
          toast.success('Nova questão gerada! 🔄');
        } catch {
          // Refund cost on failure
          setEnergy(e => Math.min(MAX_ENERGY, e + cost));
          setUsedPowers(prev => prev.filter(p => p !== 'swap'));
          setActivePowerPerQ(null);
          // Resume the timer
          const s = getSecsFromDeadline(deadlineKey);
          if (s && s > 0) {
            setTimeLeft(s);
            timerRef.current = setInterval(() => {
              const ss = getSecsFromDeadline(deadlineKey);
              if (ss === null || ss <= 0) { clearTimer(); setTimeLeft(0); handleTimeout(); }
              else setTimeLeft(ss);
            }, 500);
          }
          toast.error('Falha ao gerar questão. Energia devolvida.');
        } finally {
          setGeneratingSwap(false);
        }
        return; // skip the old else block below
      }
    } else if (chosen === 'turbo') {
      setTurboRemaining(3);
    } else if (chosen === 'segunda_chance') {
      setSecondChanceAvailable(true);
    } else if (chosen === 'dica') {
      setShowHint(true);
    }
    // 'queima' is intercepted in the power panel button onClick before calling this function
  };

  // Confirm Energy Burn from the modal
  const handleConfirmQueima = () => {
    const amt = Math.max(1, Math.min(queimAmount, Math.min(energy, 5)));
    setEnergy(e => Math.max(0, e - amt));
    setEnergyBurnBonus(amt * 20);
    setEnergyBurnTargetQuestion(currentQuestionIndex + 1); // applies to NEXT question
    // Fully activate the power (mark as used, set as active for this question)
    setUsedPowers(prev => [...prev, 'queima']);
    setActivePowerPerQ('queima');
    setShowQueimModal(false);
    setShowBonusFlash(`🔥 +${amt * 20}% na próxima questão!`);
    setTimeout(() => setShowBonusFlash(null), 2000);
    toast.success(`🔥 Queima ativa! +${amt * 20}% na próxima questão`);
  };

  // �"?�"?�"? Submit answer �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const handleSubmitAnswer = () => {
    if (freezeActive) return;  // wait for freeze to be set up before actions
    const currentQ = swappedQuestions[currentQuestionIndex] ?? questions[currentQuestionIndex];
    if (!selectedAnswer || !currentQ) return;
    clearTimer(); clearDeadline(); setAnswered(true);
    if (freezeTimerRef.current) { clearTimeout(freezeTimerRef.current); setFreezeActive(false); }
    const rawCorrect = currentQ.options.find((o:any) => o.id === selectedAnswer)?.isCorrect ?? false;
    const correctOpt = currentQ.options.find((o: any) => o.isCorrect);
    const shieldAbsorbed = !rawCorrect && shieldActive;
    if (shieldAbsorbed) setShieldActive(false);
    const timeUsed = Math.max(1, effectiveTime - timeLeft);
    const scored = calcQuestionScore({ isCorrect: rawCorrect, timeUsed, streakBefore: currentStreak, shieldAbsorbed, wasSkipped: false });
    const newStreak = scored.newStreak;
    setCurrentStreak(newStreak);
    setMaxStreak(ms => Math.max(ms, newStreak));
    // Queima: apply bonus only when current question is the target question
    const isQueimTargetQ = energyBurnBonus > 0 && currentQuestionIndex === energyBurnTargetQuestion;
    const appliedBurnBonus = isQueimTargetQ ? energyBurnBonus : 0;
    if (isQueimTargetQ) { setEnergyBurnBonus(0); setEnergyBurnTargetQuestion(-1); }

    if (rawCorrect || shieldAbsorbed) {
      // Gain energy on correct OR shield-absorbed answers
      const baseGain = 1;
      const actualGain = turboRemaining > 0 ? 2 : baseGain;
      setEnergy(e => Math.min(MAX_ENERGY, e + actualGain));
      if (turboRemaining > 0) {
        setShowBonusFlash('+2 ⚡ TURBO!');
        setTurboRemaining(r => r - 1);
        setTimeout(() => setShowBonusFlash(null), 1400);
      }
    }
    const entry: DuelAnswerData = {
      questionId: currentQ.id, selectedOptionId: selectedAnswer, isCorrect: rawCorrect,
      timeUsed, timeMax: effectiveTime,
      pointsEarned: rawCorrect && appliedBurnBonus > 0
        ? Math.round(scored.points * (1 + appliedBurnBonus / 100))
        : scored.points,
      speedBonus: scored.speedBonus, streakBonus: scored.streakBonus,
      comboMultiplier: scored.comboMultiplier, streakAtAnswer: currentStreak,
      shieldActivated: shieldAbsorbed || undefined,
      eliminatedOptionIds: eliminatedOptionIds.length > 0 ? eliminatedOptionIds : undefined,
      powerUsed: activePowerPerQ ?? undefined,
      energyBurnBonus: appliedBurnBonus > 0 ? appliedBurnBonus : undefined,
    };
    const newData = [...answerData, entry];
    setAnswerData(newData); saveAnswerData(newData);
    localStorage.setItem(answeredKey, JSON.stringify({ questionId: currentQ.id, selectedOptionId: selectedAnswer }));
    // Segunda Chance: if wrong and available, allow retry
    if (!rawCorrect && !shieldAbsorbed && secondChanceAvailable) {
      setSecondChanceAvailable(false);
      setAnswered(false);
      setSelectedAnswer(null);
      setShowBonusFlash('⏳ Segunda Chance! Tente novamente!');
      setTimeout(() => setShowBonusFlash(null), 2200);
      clearTimer(); clearDeadline();
      const dlSC = Date.now() + effectiveTime * 1000;
      localStorage.setItem(deadlineKey, String(dlSC));
      setTimeLeft(effectiveTime);
      timerRef.current = setInterval(() => {
        const secs = getSecsFromDeadline(deadlineKey);
        if (secs === null || secs <= 0) { clearTimer(); setTimeLeft(0); handleTimeout(); }
        else setTimeLeft(secs);
      }, 500);
      return;
    }
    // Shield shows error animation even when absorbed (streak is still maintained in scoring)
    setDuelFeedback({
      type: rawCorrect ? 'correct' : 'wrong',
      correctText: !rawCorrect ? correctOpt?.text : undefined,
      pointsEarned: rawCorrect && appliedBurnBonus > 0
        ? Math.round(scored.points * (1 + appliedBurnBonus / 100))
        : scored.points,
      explanation: currentQ.explanation ?? undefined,
    });
    pendingDuelNext.current = () => {};
  };

  // �"?�"?�"? Next question / finish �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const handleNext = async () => {
    localStorage.removeItem(answeredKey);
    setEliminatedOptionIds([]);
    setActivePowerPerQ(null);
    setFreezeActive(false);
    setSecondChanceAvailable(false);
    setShowHint(false);
    if (freezeTimerRef.current) { clearTimeout(freezeTimerRef.current); }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(p => p+1);
      setSelectedAnswer(null); setAnswered(false); setTimedOut(false);
    } else {
      if (!user || !duelId) return;
      clearAllDeadlines();
      try {
        const finalDuel = await DuelService.submitTurn(duelId, user.id, answerData, false);
        setDuel(finalDuel);
        const totals = calcTotalDetailed(answerData);
        const rewards = calcDuelRewards(finalDuel.difficulty, finalDuel.questionCount);
        const isWinner = finalDuel.winnerId === user.id;
        const isDraw = finalDuel.winnerId === 'draw';
        setEarnedXP((isWinner?rewards.winXP:isDraw?rewards.drawXP:rewards.loseXP) + totals.correctCount * rewards.xpPerCorrect);
        setEarnedCoins((isWinner?rewards.winCoins:isDraw?rewards.drawCoins:rewards.loseCoins) + totals.correctCount * rewards.coinsPerCorrect);
        setPhase('finished');
        await incrementMissionProgress(user.id, 'duel_completed');
        if (finalDuel.status==='completed') toast.success('🏆 Duelo finalizado!');
        else toast.success('⚔️ Turno enviado! Aguardando o oponente...');
      } catch(e) { toast.error('Erro ao salvar resultado.'); }
    }
  };

  const handleForfeit = async () => {
    if (!user || !duelId) return;
    setIsForfeiting(true); clearAllDeadlines();
    try {
      await DuelService.forfeit(duelId, user.id);
      toast.error('🏳️ Você desistiu. Derrota registrada.');
      setPhase('finished'); setShowForfeitModal(false);
    } catch(e) { toast.error('Erro ao registrar desistência.'); }
    finally { setIsForfeiting(false); }
  };

  // �"?�"?�"? Derived �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  const isAmChallenger = duel?.challengerId === user?.id;
  const alreadyActivatedThisQ = !!activePowerPerQ;
  const timerPercent = (timeLeft / effectiveTime) * 100;
  const myScore = isAmChallenger ? duel?.challengerScore??0 : duel?.challengedScore??0;
  const oppScore = isAmChallenger ? duel?.challengedScore??0 : duel?.challengerScore??0;
  const isDuelWon = duel?.status==='completed' && duel?.winnerId===user?.id;
  const isDuelDraw = duel?.status==='completed' && (duel?.winnerId==='draw' || duel?.challengerScore===duel?.challengedScore);

  // �"?�"?�"? Cinematic auto-advance �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
  useEffect(() => {
    if (phase !== 'cinematic') return;
    const t = setTimeout(() => setPhase('playing'), 3500);
    return () => clearTimeout(t);
  }, [phase]);

  const MyAvatar = () => myAvatarCompose?.avatarUrl
    ? <AvatarComposer avatarUrl={myAvatarCompose.avatarUrl} backgroundUrl={myAvatarCompose.backgroundUrl} borderUrl={myAvatarCompose.borderUrl} size="md" animate={false} isFloating={false} className="w-[147px] h-[147px]"/>
    : <div className="w-[147px] h-[147px] rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-600"><img src={myAvatarUrl} className="w-full h-full object-cover" onError={e=>{(e.target as any).src='/avatars/default-impacto.png'}} /></div>;

  const OppAvatar = () => oppAvatarCompose?.avatarUrl
    ? <AvatarComposer avatarUrl={oppAvatarCompose.avatarUrl} backgroundUrl={oppAvatarCompose.backgroundUrl} borderUrl={oppAvatarCompose.borderUrl} size="md" animate={false} isFloating={false} className="w-[147px] h-[147px]"/>
    : <div className="w-[147px] h-[147px] rounded-2xl overflow-hidden bg-gradient-to-br from-red-400 to-orange-500"><img src={opponentAvatarUrl} className="w-full h-full object-cover" onError={e=>{(e.target as any).src='/avatars/default-impacto.png'}} /></div>;

  if (isLoading || !duel || !questions.length) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Carregando duelo...</p>
      </div>
    </div>
  );

  const rewards = calcDuelRewards(duel.difficulty, duel.questionCount);
  const totals = calcTotalDetailed(answerData);
  const currentQuestion = swappedQuestions[currentQuestionIndex] ?? questions[currentQuestionIndex];
  const shuffledOptions = (shuffledOptionsMap[currentQuestion?.id]||currentQuestion?.options||[]).filter((o:any)=>!eliminatedOptionIds.includes(o.id));


  // \u2500\u2500\u2500\u2500 LOBBY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (phase === 'lobby') return (
    <div className="max-w-2xl mx-auto pb-24 pt-2 space-y-4">
      <motion.div initial={{opacity:0,y:-16}} animate={{opacity:1,y:0}} transition={{duration:0.5}}
        className="relative overflow-hidden rounded-[2.5rem] shadow-2xl"
        style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)'}}>

        {/* Background glow blobs */}
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none" style={{background:'radial-gradient(circle,#6366f1,transparent)'}} />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none" style={{background:'radial-gradient(circle,#ef4444,transparent)'}} />

        <div className="relative z-10 p-7">
          {/* Theme badge */}
          {duel?.theme && (() => {
            const t = DUEL_THEMES[duel.theme] ?? { emoji:'\ud83c\udfb2', label: duel.theme, color:'#a78bfa' };
            return (
              <div className="flex justify-center mb-5">
                <div className="flex items-center gap-2 px-5 py-2 rounded-2xl border"
                  style={{background:`${t.color}18`, borderColor:`${t.color}44`}}>
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-base font-black uppercase tracking-[0.15em]"
                    style={{color:t.color, fontFamily:"'Rajdhani', sans-serif"}}>{t.label}</span>
                </div>
              </div>
            );
          })()}

          {/* Players */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <motion.div initial={{x:-30,opacity:0}} animate={{x:0,opacity:1}} transition={{delay:0.15}}
              className="flex-1 flex flex-col items-center gap-2">
              <div className="rounded-[1.5rem] overflow-hidden shadow-xl"><MyAvatar /></div>
              <span className="text-xs font-black text-indigo-300 uppercase tracking-widest">Você</span>
              <span className="text-base font-black text-white text-center leading-tight" style={{fontFamily:"'Rajdhani', sans-serif"}}>
                {(() => { const p = (user?.name||'').split(' '); return p.length>=2?`${p[0]} ${p[1]}`:p[0]||'—'; })()}
              </span>
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {myGrade && <span className="text-[13px] font-bold text-white/50 bg-white/5 px-2 py-1 rounded-lg">{myGrade}</span>}
                <span className="text-[13px] font-black text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded-lg">Nív. {myLevel}</span>
              </div>
            </motion.div>

            <motion.div initial={{scale:0}} animate={{scale:1}} transition={{delay:0.3,type:'spring',bounce:0.6}}
              className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-12 h-12 bg-red-500/20 border-2 border-red-400/40 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/30">
                <Sword size={22} className="text-red-400" />
              </div>
              <span className="text-base font-black text-red-400 uppercase tracking-widest" style={{fontFamily:"'Rajdhani', sans-serif"}}>VS</span>
            </motion.div>

            <motion.div initial={{x:30,opacity:0}} animate={{x:0,opacity:1}} transition={{delay:0.15}}
              className="flex-1 flex flex-col items-center gap-2">
              <OppAvatar />
              <span className="text-xs font-black text-red-300 uppercase tracking-widest">Rival</span>
              <span className="text-base font-black text-white text-center leading-tight" style={{fontFamily:"'Rajdhani', sans-serif"}}>
                {(() => { const p = (opponent?.name||'').split(' '); return p.length>=2?`${p[0]} ${p[1]}`:p[0]||'...'; })()}
              </span>
            </motion.div>
          </div>

          {/* Info pills */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { icon: DUEL_THEMES[duel.theme]?.emoji||'🎲', label:'Tema', val:(DUEL_THEMES[duel.theme]?.label||duel.theme) },
              { icon: duel.difficulty==='hard'?'🔥':duel.difficulty==='medium'?'⚡':'🌱', label:'Dificuldade', val:duel.difficulty==='hard'?'Difícil':duel.difficulty==='medium'?'Médio':'Fácil' },
              { icon:'❓', label:'Questões', val:`${duel.questionCount}` },
            ].map(item=>(
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-[11px] font-black text-white/40 uppercase tracking-wide">{item.label}</div>
                <div className="text-sm font-black text-white mt-1">{item.val}</div>
              </div>
            ))}
          </div>

          {/* Energy starts at 0 */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Zap size={22} className="text-yellow-400 shrink-0" />
              <span className="text-sm font-black text-yellow-400 uppercase tracking-widest">Energia</span>
              <span className="text-xs font-bold text-white/30 ml-auto">Começa em 0</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              {Array.from({length:MAX_ENERGY}).map((_,i)=>(
                <div key={i} className="flex-1 h-5 rounded-xl bg-white/10 border border-white/15" />
              ))}
            </div>
            <p className="text-xs text-white/40">Acerte questões para ganhar ⚡ e ativar poderes durante a batalha.</p>
          </div>

          {/* Powers grid - 3 per row */}
          <div className="mb-5">
            <div className="text-xs font-black text-white/40 uppercase tracking-widest mb-3">Poderes Disponíveis</div>
            <div className="grid grid-cols-3 gap-2">
              {(ALL_POWERS as readonly string[]).map((p) => {
                const info = POWERS_INFO[p as keyof typeof POWERS_INFO];
                return (
                  <div key={p} className="flex flex-col items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-4 text-center">
                    <span className="text-5xl">{info.emoji}</span>
                    <span className={cn('text-sm font-black leading-tight', info.color)} style={{fontFamily:"'Rajdhani', sans-serif"}}>{info.label}</span>
                    <span className="text-[11px] text-white/35 leading-snug">{info.desc}</span>
                    <span className="text-sm font-black text-yellow-400/80">⚡{info.cost}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rewards */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-4">
            <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2 text-center">Recompensa 🏆</div>
            <div className="flex justify-center gap-8">
              <div className="text-center"><div className="text-lg font-black text-white">+{rewards.winXP} XP</div><div className="text-[9px] text-white/40">vitória</div></div>
              <div className="text-center"><div className="text-lg font-black text-amber-300">+{rewards.winCoins} 💰</div><div className="text-[9px] text-white/40">moedas</div></div>
            </div>
          </div>

          {isPressureApplied && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 mb-4 text-center">
              <p className="text-xs font-black text-red-400">⚡ Rival acelerou! Seu tempo: {Math.round(TIME_PER_QUESTION*ACCELERATION_TIME_MULT)}s/questão</p>
            </div>
          )}

          {/* CTA */}
          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.96}}
            onClick={() => setPhase('cinematic')}
            className="relative w-full h-16 rounded-2xl font-black text-xl text-white overflow-hidden shadow-xl shadow-red-900/30"
            style={{background:'linear-gradient(90deg,#ef4444,#f97316,#eab308)',fontFamily:"'Rajdhani', sans-serif",letterSpacing:'0.06em'}}>
            <motion.div className="absolute inset-0 pointer-events-none"
              animate={{x:['-100%','200%']}} transition={{duration:2,repeat:Infinity,ease:'linear',repeatDelay:0.8}}
              style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)',width:'40%'}} />
            ⚔️ ENTRAR NA BATALHA!
          </motion.button>
        </div>
      </motion.div>
    </div>
  );

  // �."�.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.-
  // �.'  CINEMATIC                                     �.'
  // �.s�.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
  if (phase === 'cinematic') return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{background:'linear-gradient(135deg,#020617 0%,#0f0a2e 40%,#1a0533 70%,#020617 100%)'}}>
      {/* Animated grid */}
      <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage:'linear-gradient(rgba(99,102,241,1) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,1) 1px,transparent 1px)',backgroundSize:'40px 40px'}} />
      {/* Center glow orb */}
      <motion.div className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{opacity:0}} animate={{opacity:1}} transition={{duration:2,delay:0.4}}>
        <div className="w-96 h-96 rounded-full blur-[120px]" style={{background:'radial-gradient(circle,rgba(239,68,68,0.35),rgba(99,102,241,0.25),transparent)'}} />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Battle phrase */}
        <motion.p initial={{opacity:0,y:-30,scale:0.85}} animate={{opacity:1,y:0,scale:1}}
          transition={{delay:0.2,type:'spring',stiffness:200}}
          className="text-2xl font-black text-white/70 text-center mb-10 uppercase tracking-[0.10em]"
          style={{fontFamily:"'Rajdhani',sans-serif"}}>{battlePhrase}</motion.p>

        {/* Players row */}
        <div className="flex items-end justify-center gap-6 w-full max-w-md mb-10">
          {/* Me */}
          <motion.div initial={{x:-160,opacity:0}} animate={{x:0,opacity:1}}
            transition={{type:'spring',stiffness:160,damping:18,delay:0.1}}
            className="flex-1 flex flex-col items-center gap-3">
            <motion.div
              animate={{y:[0,-10,0]}} transition={{duration:2.2,repeat:Infinity,ease:'easeInOut',delay:0.5}}
              className="rounded-[2.5rem] overflow-hidden border-2 border-indigo-400/70 shadow-[0_0_40px_rgba(99,102,241,0.4)]"
              style={{width:200,height:200}}>
              {myAvatarCompose?.avatarUrl
                ? <AvatarComposer avatarUrl={myAvatarCompose.avatarUrl} backgroundUrl={myAvatarCompose.backgroundUrl} borderUrl={myAvatarCompose.borderUrl} size="md" animate={false} isFloating={false} className="w-[200px] h-[200px]"/>
                : <div className="w-[200px] h-[200px] overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-600"><img src={myAvatarUrl} className="w-full h-full object-cover" onError={e=>{(e.target as any).src='/avatars/default-impacto.png'}}/></div>}
            </motion.div>
            <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.55}} className="text-center">
              <div className="text-[13px] font-black text-indigo-400 uppercase tracking-widest mb-1">Você</div>
              <div className="font-black text-white text-xl leading-tight" style={{fontFamily:"'Rajdhani',sans-serif"}}>
                {(()=>{ const p=(user?.name||'').split(' '); return p.length>=2?`${p[0]} ${p[1]}`:p[0]||'—'; })()}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                {myGrade&&<span className="text-[13px] font-bold text-white/50 bg-white/8 px-2.5 py-1 rounded-lg">{myGrade}</span>}
                <span className="text-[13px] font-black text-indigo-300 bg-indigo-500/25 px-2.5 py-1 rounded-lg">Nív. {myLevel}</span>
              </div>
            </motion.div>
          </motion.div>

          {/* VS center */}
          <motion.div initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1,rotate:[0,12,-12,0]}}
            transition={{delay:0.65,duration:0.6,type:'spring'}}
            className="flex flex-col items-center gap-2 shrink-0 pb-12">
            <motion.span
              animate={{textShadow:['0 0 10px rgba(239,68,68,0.3)','0 0 50px rgba(239,68,68,1)','0 0 10px rgba(239,68,68,0.3)']}}
              transition={{duration:1.6,repeat:Infinity}}
              className="font-black text-red-400"
              style={{fontFamily:"'Rajdhani',sans-serif",fontSize:'4.8rem',lineHeight:1}}>VS</motion.span>
            <motion.div animate={{rotate:[0,360]}} transition={{duration:3.5,repeat:Infinity,ease:'linear'}}>
              <Sword size={38} className="text-orange-400/80" />
            </motion.div>
          </motion.div>

          {/* Opponent */}
          <motion.div initial={{x:160,opacity:0}} animate={{x:0,opacity:1}}
            transition={{type:'spring',stiffness:160,damping:18,delay:0.1}}
            className="flex-1 flex flex-col items-center gap-3">
            <motion.div
              animate={{y:[0,-10,0]}} transition={{duration:2.2,repeat:Infinity,ease:'easeInOut',delay:1.1}}
              className="rounded-[2.5rem] overflow-hidden border-2 border-red-400/70 shadow-[0_0_40px_rgba(239,68,68,0.4)]"
              style={{width:200,height:200}}>
              {oppAvatarCompose?.avatarUrl
                ? <AvatarComposer avatarUrl={oppAvatarCompose.avatarUrl} backgroundUrl={oppAvatarCompose.backgroundUrl} borderUrl={oppAvatarCompose.borderUrl} size="md" animate={false} isFloating={false} className="w-[200px] h-[200px]"/>
                : <div className="w-[200px] h-[200px] overflow-hidden bg-gradient-to-br from-red-400 to-orange-500"><img src={opponentAvatarUrl} className="w-full h-full object-cover" onError={e=>{(e.target as any).src='/avatars/default-impacto.png'}}/></div>}
            </motion.div>
            <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.55}} className="text-center">
              <div className="text-[13px] font-black text-red-400 uppercase tracking-widest mb-1">Rival</div>
              <div className="font-black text-white text-xl leading-tight" style={{fontFamily:"'Rajdhani',sans-serif"}}>
                {(()=>{ const p=(opponent?.name||'').split(' '); return p.length>=2?`${p[0]} ${p[1]}`:p[0]||'Rival'; })()}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                {oppGrade&&<span className="text-[13px] font-bold text-white/50 bg-white/8 px-2.5 py-1 rounded-lg">{oppGrade}</span>}
                <span className="text-[13px] font-black text-red-300 bg-red-500/25 px-2.5 py-1 rounded-lg">Nív. {oppLevel}</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Preparing label */}
        <motion.div initial={{opacity:0}} animate={{opacity:[0,1,0.6,1]}}
          transition={{delay:2.3,duration:1.1}}
          className="text-[16px] font-black text-indigo-400/80 uppercase tracking-[0.2em]">
          Preparando questões...
        </motion.div>
      </div>
    </div>
  );

  // �."�.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.-
  // �.'  PLAYING                                       �.'
  // �.s�.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
  if (phase === 'playing') return (
    <div className="min-h-screen pb-6" style={{background:'linear-gradient(160deg,#060b18 0%,#0f172a 40%,#0d1535 70%,#060b18 100%)'}}>

      {/* �"?�"? Global overlays �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */}
      <AnimatePresence>
        {showPowerFlash && (
          <motion.div key={showPowerFlash} initial={{opacity:0}} animate={{opacity:[0,0.55,0]}} transition={{duration:0.9}}
            className={cn('fixed inset-0 pointer-events-none z-50',
              showPowerFlash==='shield'?'bg-cyan-400/25':showPowerFlash==='freeze'?'bg-blue-400/20':showPowerFlash==='eliminate'?'bg-purple-500/20':showPowerFlash==='swap'?'bg-teal-400/20':'bg-yellow-400/25')} />
        )}
        {showBonusFlash && (
          <motion.div key="bonus" initial={{opacity:0,y:20,scale:0.6}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-50,scale:1.4}} transition={{type:'spring',bounce:0.5}}
            className="fixed top-[28%] left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            style={{filter:'drop-shadow(0 0 24px rgba(251,191,36,0.9))'}}>
            <div className="bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-900 font-black text-xl px-8 py-3 rounded-full shadow-2xl">
              {showBonusFlash}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* �"?�"? Freeze overlay �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */}
      <AnimatePresence>
        {freezeActive && (
          <motion.div key="freeze" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.5}}
            className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
            style={{background:'linear-gradient(180deg,rgba(147,197,253,0.07) 0%,rgba(59,130,246,0.05) 100%)'}}>
            {/* Corner ice crystals */}
            {['-top-4 -left-4','-top-4 -right-4','-bottom-4 -left-4','-bottom-4 -right-4'].map((pos,i)=>(
              <motion.div key={i} className={`absolute ${pos} text-6xl opacity-30`}
                animate={{rotate:[0,15,-15,0],scale:[1,1.1,1]}} transition={{duration:3,repeat:Infinity,delay:i*0.4}}>❄️</motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* �"?�"? Power activation dramatic popup �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */}
      <AnimatePresence>
        {powerActivationAnim && (() => {
          const p = POWERS_INFO[powerActivationAnim];
          const glowColor = p?.cat==='defense'?'rgba(34,211,238,0.6)':p?.cat==='control'?'rgba(96,165,250,0.6)':p?.cat==='strategy'?'rgba(168,85,247,0.6)':'rgba(234,179,8,0.6)';
          const ringCls = p?.cat==='defense'?'border-cyan-400/80':p?.cat==='control'?'border-blue-400/80':p?.cat==='strategy'?'border-purple-400/80':'border-yellow-400/80';
          return (
            <motion.div key={`pact-${powerActivationAnim}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}
              className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none">
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

      {/* �"?�"? Forfeit modal �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */}
      {showForfeitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <motion.div initial={{scale:0.85,opacity:0}} animate={{scale:1,opacity:1}}
            className="rounded-[2rem] p-8 max-w-sm w-full mx-4 shadow-2xl text-center border border-white/10"
            style={{background:'linear-gradient(135deg,#1e1035,#0f1729)'}}>
            <div className="text-6xl mb-4">🏳️</div>
            <h3 className="text-2xl font-black text-white mb-2" style={{fontFamily:"'Rajdhani',sans-serif"}}>Desistir do Duelo?</h3>
            <p className="text-white/50 font-bold mb-6 text-sm">Isso conta como <span className="text-red-400 font-black">derrota</span>. Você receberá apenas metade das recompensas.</p>
            <div className="flex gap-3">
              <button onClick={()=>setShowForfeitModal(false)} className="flex-1 h-12 rounded-2xl bg-white/10 text-white font-black hover:bg-white/15 transition-all">Continuar</button>
              <button onClick={handleForfeit} disabled={isForfeiting} className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-black hover:bg-red-500 disabled:opacity-50 transition-all">{isForfeiting?'Saindo...':'Desistir 🏳️'}</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� ARENA HUD �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */}
      <div className="relative overflow-hidden" style={{background:'linear-gradient(180deg,#0a0f2e 0%,#0c1240 60%,transparent 100%)'}}>
        {/* Animated background grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{backgroundImage:'linear-gradient(rgba(99,102,241,1) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,1) 1px,transparent 1px)',backgroundSize:'32px 32px'}} />

        {/* Theme badge */}
        {duel?.theme && (() => {
          const t = DUEL_THEMES[duel.theme] ?? { emoji:'🎲', label: duel.theme, color:'#a78bfa' };
          return (
            <div className="flex justify-center pt-4 pb-2">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl border text-xs font-black uppercase tracking-widest"
                style={{background:`${t.color}15`,borderColor:`${t.color}40`,color:t.color}}>
                <span>{t.emoji}</span><span>{t.label}</span>
              </div>
            </div>
          );
        })()}

        {/* Players + VS */}
        <div className="flex items-center justify-between px-4 pb-4 gap-2 max-w-lg mx-auto">

          {/* Me */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={cn('relative rounded-[1.5rem] overflow-hidden shadow-2xl border-2 transition-all',
              shieldActive?'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]':'border-indigo-500/40 shadow-indigo-900/50')}>
              <MyAvatar />
              {shieldActive && (
                <motion.div className="absolute inset-0 bg-cyan-400/10 pointer-events-none" animate={{opacity:[0.1,0.3,0.1]}} transition={{duration:1.5,repeat:Infinity}} />
              )}
            </div>
            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Você</span>
            <span className="text-[11px] font-black text-white text-center leading-tight" style={{fontFamily:"'Rajdhani',sans-serif"}}>
              {(()=>{ const p=(user?.name||'').split(' '); return p.length>=2?`${p[0]} ${p[1]}`:p[0]||'—'; })()}
            </span>
            <div className="flex items-center gap-1">
              {myGrade&&<span className="text-[12px] font-bold text-white/30 bg-white/5 px-1.5 py-0.5 rounded-md">{myGrade}</span>}
              <span className="text-[12px] font-black text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-md">Nív.{myLevel}</span>
            </div>
          </div>

          {/* Center �?" timer + VS */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            {/* Big animated timer */}
            <motion.div className="relative flex items-center justify-center w-20 h-20"
              animate={timeLeft<=5&&!answered?{scale:[1,1.04,1]}:{}} transition={{duration:0.4,repeat:timeLeft<=5?Infinity:0}}>
              <svg className="absolute inset-0 -rotate-90" width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" strokeWidth="4" stroke="rgba(255,255,255,0.06)" />
                <motion.circle cx="40" cy="40" r="34" fill="none" strokeWidth="4" strokeLinecap="round"
                  stroke={timeLeft<=5?'#ef4444':timeLeft<=10?'#f97316':'#818cf8'}
                  strokeDasharray={213.6}
                  animate={{strokeDashoffset: 213.6 - (timerPercent/100)*213.6}}
                  transition={{duration:0.8,ease:'linear'}}
                  style={{filter:`drop-shadow(0 0 6px ${timeLeft<=5?'rgba(239,68,68,0.8)':timeLeft<=10?'rgba(249,115,22,0.8)':'rgba(129,140,248,0.6))'})`}} />
              </svg>
              <div className="flex flex-col items-center">
                <span className={cn('text-xl font-black tabular-nums leading-none',timeLeft<=5?'text-red-400':timeLeft<=10?'text-orange-400':'text-indigo-300')}
                  style={{fontFamily:"'Orbitron',monospace"}}>
                  {String(timeLeft).padStart(2,'0')}
                </span>
                <span className="text-[7px] text-white/30 font-bold">seg</span>
              </div>
            </motion.div>
            {/* VS badge */}
            <div className="flex flex-col items-center gap-0.5">
              <Sword size={14} className="text-red-400/70" />
              <span className="text-[10px] font-black text-red-400 tracking-widest" style={{fontFamily:"'Rajdhani',sans-serif"}}>VS</span>
            </div>
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="rounded-[1.5rem] overflow-hidden shadow-2xl border-2 border-red-500/40 shadow-red-900/50">
              <OppAvatar />
            </div>
            <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">Rival</span>
            <span className="text-[11px] font-black text-white text-center leading-tight" style={{fontFamily:"'Rajdhani',sans-serif"}}>
              {(()=>{ const p=(opponent?.name||'').split(' '); return p.length>=2?`${p[0]} ${p[1]}`:p[0]||'...'; })()}
            </span>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {oppGrade&&<span className="text-[12px] font-bold text-white/40 bg-white/5 px-1.5 py-0.5 rounded-lg">{oppGrade}</span>}
              <span className="text-[12px] font-black text-red-300 bg-red-500/20 px-1.5 py-0.5 rounded-lg">Nív.{oppLevel}</span>
            </div>
          </div>
        </div>

        {/* Energy + Stats bar */}
        <div className="mx-4 mb-4 max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-3 bg-white/5 backdrop-blur-sm border border-white/8 rounded-2xl px-4 py-2.5">
            {/* Energy */}
            <div className="flex items-center gap-1.5">
              <Zap size={11} className="text-yellow-400 shrink-0" />
              <div className="flex gap-1">
                {Array.from({length:MAX_ENERGY}).map((_,i)=>(
                  <motion.div key={i}
                    animate={i<energy?{scaleY:[1,1.3,1],opacity:[1,0.7,1]}:{}}
                    transition={{duration:0.6,repeat:i<energy?Infinity:0,delay:i*0.1,repeatDelay:2}}
                    className={cn('w-4 h-3 rounded-sm border transition-all',
                      i<energy?'bg-yellow-400 border-yellow-300 shadow-[0_0_6px_rgba(251,191,36,0.8)]':'bg-white/8 border-white/15')} />
                ))}
              </div>
              <span className="text-[9px] font-black text-yellow-400 ml-0.5">{energy}</span>
            </div>

            {/* Streak */}
            {currentStreak>=2?(
              <motion.div initial={{scale:0}} animate={{scale:1}} className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/30 rounded-xl px-2 py-0.5">
                <Flame size={10} className="text-orange-400" />
                <span className="text-[10px] font-black text-orange-400">{currentStreak}×</span>
                {calcComboMultiplier(currentStreak)>1&&<span className="text-[9px] font-black text-yellow-400">×{calcComboMultiplier(currentStreak).toFixed(1)}</span>}
              </motion.div>
            ):<div/>}

            {/* Burn bonus badge — only on the queima target question */}
            {energyBurnBonus > 0 && currentQuestionIndex === energyBurnTargetQuestion && (
              <motion.div initial={{scale:0}} animate={{scale:[1,1.08,1]}} transition={{duration:0.9,repeat:Infinity}}
                className="flex items-center gap-1 border rounded-xl px-2 py-0.5"
                style={{background:'rgba(251,146,60,0.18)',borderColor:'rgba(251,191,36,0.50)'}}>
                <motion.span className="text-[10px]" animate={{rotate:[-8,8,-8]}} transition={{duration:0.5,repeat:Infinity}}>🔥</motion.span>
                <span className="text-[10px] font-black" style={{color:'#fde68a'}}>+{energyBurnBonus}%</span>
              </motion.div>
            )}

            {/* Q counter + forfeit */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-white/30">Q{currentQuestionIndex+1}/{questions.length}</span>
              <button onClick={()=>setShowForfeitModal(true)} className="text-[9px] font-black text-red-400/50 hover:text-red-400 px-1.5 py-1 bg-red-500/10 rounded-lg transition-all">🏳️</button>
            </div>
          </div>

          {/* Shield active — pulsing aura banner */}
          {shieldActive&&(
            <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl py-2 px-4 relative overflow-hidden"
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
          {/* Segunda Chance active banner */}
          {secondChanceAvailable&&(
            <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className="mt-2 flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl py-1.5 px-3">
              <span className="text-sm">⏳</span>
              <span className="text-[10px] font-black text-orange-400">SEGUNDA CHANCE ATIVA — Se errar, poderá tentar novamente!</span>
            </motion.div>
          )}
          {/* Turbo active banner — 2/2 counter */}
          {turboRemaining>0&&(
            <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl py-2 px-4 relative overflow-hidden"
              style={{background:'linear-gradient(135deg,rgba(161,98,7,0.18),rgba(120,65,0,0.12))',border:'1px solid rgba(234,179,8,0.40)'}}>
              <motion.div className="absolute inset-0 pointer-events-none"
                animate={{x:['-100%','200%']}} transition={{duration:1.2,repeat:Infinity,ease:'linear'}}
                style={{background:'linear-gradient(90deg,transparent,rgba(251,191,36,0.12),transparent)',width:'40%'}} />
              <motion.div animate={{scale:[1,1.3,1],rotate:[0,15,-15,0]}} transition={{duration:0.8,repeat:Infinity}}>
                <Zap size={13} className="text-yellow-400" />
              </motion.div>
              <span className="text-[10px] font-black text-yellow-300">⚡ TURBO {turboRemaining}/3 — energia em dobro!</span>
              <div className="flex gap-0.5 ml-1">
                {[0,1,2].map(i=>(
                  <div key={i} className={`w-2 h-2 rounded-full ${i<turboRemaining?'bg-yellow-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]':'bg-white/15'}`} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� QUESTION ZONE �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */}
      <AnimatePresence mode="wait">
        <motion.div key={currentQuestionIndex} initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-24}} transition={{duration:0.28}}
          className="mx-3 mt-3 max-w-lg mx-auto">

          {/* Question card */}
          <div className={cn("relative rounded-[2rem] overflow-hidden shadow-2xl border-2 transition-all",
            shieldActive ? "border-cyan-400/60" : "border-white/10"
          )}
            style={{
              background:'linear-gradient(145deg,rgba(15,23,42,0.98) 0%,rgba(17,24,60,0.98) 100%)',
              backdropFilter:'blur(16px)',
              ...(shieldActive ? {boxShadow:'0 0 0 2px rgba(34,211,238,0.15),0 0 50px rgba(34,211,238,0.12)'} : {})
            }}>
          {/* Shield outer pulse ring */}
          {shieldActive&&(
            <motion.div className="absolute -inset-1 rounded-[2.2rem] pointer-events-none z-20"
              animate={{opacity:[0,0.4,0],scale:[1,1.01,1]}} transition={{duration:2,repeat:Infinity}}
              style={{background:'linear-gradient(135deg,rgba(34,211,238,0.08),rgba(99,102,241,0.06))',boxShadow:'0 0 30px rgba(34,211,238,0.20)'}} />
          )}
          {/* Freeze icy overlay — snowflakes falling, NO blur */}
          {freezeActive&&(
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-[2rem]">
              {/* Subtle icy tint, no blur */}
              <div className="absolute inset-0" style={{background:'linear-gradient(180deg,rgba(30,64,175,0.12) 0%,rgba(7,89,133,0.08) 100%)',borderRadius:'inherit'}} />
              {/* Prominent falling snowflakes */}
              {[0,1,2,3,4,5,6].map(i=>(
                <motion.div key={i} className="absolute text-blue-200 select-none"
                  style={{fontSize:`${20+i*6}px`,left:`${6+i*13}%`,textShadow:'0 0 12px rgba(147,197,253,0.9)'}}
                  initial={{y:'-40px',opacity:0,rotate:0}} animate={{y:'115%',opacity:[0,1,1,0.8,0],rotate:360*((i%2===0)?1:-1)}}
                  transition={{duration:1.5+i*0.3,delay:i*0.25,repeat:Infinity,ease:'linear'}}>❄</motion.div>
              ))}
              {/* Frozen banner */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                <motion.div animate={{opacity:[0.9,1,0.9],scale:[1,1.03,1]}} transition={{duration:0.8,repeat:Infinity}}
                  className="flex items-center gap-2 border rounded-2xl px-5 py-2 shadow-2xl"
                  style={{background:'linear-gradient(135deg,rgba(7,89,133,0.85),rgba(30,64,175,0.80))',borderColor:'rgba(147,197,253,0.5)',boxShadow:'0 0 24px rgba(96,165,250,0.4)'}}>
                  <span className="text-lg">❄️</span>
                  <span className="text-xs font-black text-blue-100 tracking-widest uppercase">+10s — Tempo Congelado</span>
                </motion.div>
              </div>
            </div>
          )}

          {/* Fire spark overlay — shown on the queima target question */}
          {energyBurnBonus > 0 && currentQuestionIndex === energyBurnTargetQuestion && !answered && (
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-[2rem]">
              <div className="absolute inset-0" style={{background:'linear-gradient(180deg,rgba(234,88,12,0.07) 0%,rgba(251,191,36,0.05) 100%)'}} />
              {[0,1,2,3,4,5].map(i=>(
                <motion.div key={i} className="absolute select-none"
                  style={{fontSize:`${14+i*4}px`,left:`${5+i*17}%`,textShadow:'0 0 10px rgba(251,191,36,0.9)'}}
                  initial={{y:'110%',opacity:0}} animate={{y:'-20px',opacity:[0,1,0.9,0]}}
                  transition={{duration:1.2+i*0.2,delay:i*0.18,repeat:Infinity,ease:'easeOut'}}>🔥</motion.div>
              ))}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                <motion.div animate={{opacity:[0.9,1,0.9],scale:[1,1.04,1]}} transition={{duration:0.7,repeat:Infinity}}
                  className="flex items-center gap-2 border rounded-2xl px-5 py-2 shadow-2xl"
                  style={{background:'linear-gradient(135deg,rgba(120,53,15,0.88),rgba(161,98,7,0.80))',borderColor:'rgba(251,191,36,0.5)',boxShadow:'0 0 24px rgba(251,146,60,0.45)'}}>
                  <motion.span className="text-lg" animate={{rotate:[-8,8,-8]}} transition={{duration:0.5,repeat:Infinity}}>🔥</motion.span>
                  <span className="text-xs font-black tracking-widest uppercase" style={{color:'#fde68a'}}>QUEIMA +{energyBurnBonus}% Ativa!</span>
                </motion.div>
              </div>
            </div>
          )}

            {/* Big watermark question number */}
            <div className="absolute top-4 right-6 text-[7rem] font-black text-white/[0.03] leading-none select-none pointer-events-none"
              style={{fontFamily:"'Rajdhani',sans-serif"}}>{currentQuestionIndex+1}</div>

            {/* Thin progress bar */}
            <div className="h-1 w-full bg-white/5">
              <motion.div className="h-full rounded-full"
                animate={{width:`${timerPercent}%`}} transition={{duration:0.8,ease:'linear'}}
                style={{background: timeLeft<=5?'linear-gradient(90deg,#dc2626,#ef4444)':timeLeft<=10?'linear-gradient(90deg,#ea580c,#f97316)':'linear-gradient(90deg,#4f46e5,#818cf8)'}} />
            </div>

            <div className="p-5">
              {/* Eliminate notice */}
              {eliminatedOptionIds.length>0&&(
                <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} className="mb-3 flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-1.5">
                  <span className="text-sm">✂️</span>
                  <span className="text-[10px] font-black text-purple-400">2 alternativas erradas eliminadas</span>
                </motion.div>
              )}

              {/* Question text */}
              <div className="flex items-start gap-3 mb-5">
                <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-indigo-400 border border-indigo-500/30 bg-indigo-500/10">
                  {currentQuestionIndex+1}
                </div>
                <p className="text-[17px] font-black text-white leading-snug pt-0.5">{currentQuestion?.questionText}</p>
              </div>

              {/* Answer options */}
              <div className="space-y-2.5">
                {shuffledOptions.map((opt:any,idx:number)=>{
                  const isSelected=selectedAnswer===opt.id;
                  const showResult=answered;
                  const isCorrectOpt=opt.isCorrect;

                  let containerStyle='border-white/10 bg-white/4 hover:border-indigo-400/50 hover:bg-indigo-500/10';
                  let badgeStyle='bg-white/8 text-white/40';
                  let textStyle='text-white/70';
                  let glowStyle:React.CSSProperties={};

                  if(showResult){
                    if(isCorrectOpt){
                      containerStyle='border-emerald-400/60 bg-emerald-500/10';
                      badgeStyle='bg-emerald-500 text-white';
                      textStyle='text-emerald-300 font-black';
                      glowStyle={boxShadow:'0 0 20px rgba(52,211,153,0.3)',borderColor:'rgba(52,211,153,0.6)'};
                    } else if(isSelected&&!isCorrectOpt){
                      containerStyle='border-red-400/60 bg-red-500/10';
                      badgeStyle='bg-red-500 text-white';
                      textStyle='text-red-300';
                      glowStyle={boxShadow:'0 0 20px rgba(239,68,68,0.25)'};
                    } else {
                      containerStyle='border-white/5 bg-white/2 opacity-40';
                      badgeStyle='bg-white/5 text-white/20';
                      textStyle='text-white/30';
                    }
                  } else if(isSelected){
                    containerStyle='border-indigo-400/70 bg-indigo-500/15';
                    badgeStyle='bg-indigo-500 text-white';
                    textStyle='text-white font-black';
                    glowStyle={boxShadow:'0 0 20px rgba(99,102,241,0.35)',borderColor:'rgba(99,102,241,0.7)'};
                  }

                  return (
                    <motion.button key={opt.id} disabled={answered} onClick={()=>setSelectedAnswer(opt.id)}
                      whileHover={!answered?{x:3}:{}} whileTap={!answered?{scale:0.98}:{}}
                      className={cn('w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 relative overflow-hidden',containerStyle)}
                      style={glowStyle}>
                      {/* Selected/correct shimmer */}
                      {(isSelected||isCorrectOpt)&&showResult&&isCorrectOpt&&(
                        <motion.div className="absolute inset-0 pointer-events-none"
                          animate={{x:['-100%','200%']}} transition={{duration:1.5,repeat:Infinity,ease:'linear',repeatDelay:0.5}}
                          style={{background:'linear-gradient(90deg,transparent,rgba(52,211,153,0.08),transparent)',width:'40%'}} />
                      )}
                      <span className={cn('shrink-0 w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center transition-colors',badgeStyle)}>
                        {LETTERS[idx]}
                      </span>
                      <span className={cn('flex-1 text-[15px] leading-snug transition-colors',textStyle)}>{opt.text}</span>
                      {showResult&&isCorrectOpt&&(
                        <motion.div initial={{scale:0,rotate:-90}} animate={{scale:1,rotate:0}} transition={{type:'spring',bounce:0.6}}>
                          <CheckCircle2 size={20} className="text-emerald-400 shrink-0"/>
                        </motion.div>
                      )}
                      {showResult&&isSelected&&!isCorrectOpt&&<XCircle size={20} className="text-red-400 shrink-0"/>}
                    </motion.button>
                  );
                })}
              </div>

              {/* Dica tooltip */}
              {showHint&&(currentQuestion?.hint||currentQuestion?.explanation)&&!answered&&(
                <motion.div initial={{opacity:0,y:-8,scale:0.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0}}
                  className="mt-3 p-3.5 rounded-2xl border relative overflow-hidden"
                  style={{background:'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(245,158,11,0.04))',borderColor:'rgba(251,191,36,0.25)'}}>
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl shrink-0 mt-0.5">💡</span>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Dica</p>
                      <p className="text-sm font-semibold text-amber-200/90 leading-snug">{currentQuestion?.hint||currentQuestion?.explanation||'Revise o enunciado com atenção.'}</p>
                    </div>
                    <button onClick={()=>setShowHint(false)} className="text-amber-400/40 hover:text-amber-400 text-lg leading-none shrink-0">×</button>
                  </div>
                </motion.div>
              )}

              {/* Explanation */}
              {answered&&currentQuestion?.explanation&&(
                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">💡 Explicação</p>
                  <p className="text-sm font-semibold text-indigo-200 leading-snug">{currentQuestion.explanation}</p>
                </motion.div>
              )}
            </div>

            {/* Power panel modal — compact 3-col */}
            {/* ⚡ PREMIUM Power Arsenal */}
            <AnimatePresence>
              {showPowerPanel&&(
                <motion.div key="powerpanel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                  className="fixed inset-0 z-[60] flex items-end justify-center" onClick={()=>setShowPowerPanel(false)}>
                  <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-lg" initial={{opacity:0}} animate={{opacity:1}} />
                  <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
                    transition={{type:'spring',damping:30,stiffness:340}}
                    className="relative w-full max-w-lg overflow-hidden rounded-t-[2rem] shadow-2xl"
                    style={{background:'linear-gradient(160deg,#05091f 0%,#0a1230 60%,#0d0620 100%)',border:'1px solid rgba(255,255,255,0.1)'}}
                    onClick={e=>e.stopPropagation()}>
                    {/* Drag handle */}
                    <div className="flex justify-center pt-2.5 pb-1"><div className="w-8 h-1 rounded-full bg-white/20" /></div>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-1.5 pb-2.5 border-b border-white/6">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-yellow-400 shrink-0" />
                        <span className="text-xs font-black text-white uppercase tracking-widest" style={{fontFamily:"'Rajdhani',sans-serif"}}>Arsenal</span>
                        {/* X/3 limit counter */}
                        <div className="flex items-center gap-1 ml-1 bg-white/8 border border-white/10 rounded-full px-2 py-0.5">
                          {Array.from({length:MAX_POWERS_PER_DUEL}).map((_,i)=>(
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i<usedPowers.length?'bg-yellow-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]':'bg-white/20'}`} />
                          ))}
                          <span className="text-[9px] font-black ml-0.5" style={{color:usedPowers.length>=MAX_POWERS_PER_DUEL?'#f87171':'#a3a3a3'}}>{usedPowers.length}/{MAX_POWERS_PER_DUEL}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Energy */}
                        <div className="flex items-center gap-0.5">
                          {Array.from({length:MAX_ENERGY}).map((_,i)=>(
                            <div key={i} className={cn('w-2.5 h-2.5 rounded-full border transition-all',
                              i<energy?'bg-yellow-400 border-yellow-300 shadow-[0_0_4px_rgba(251,191,36,0.8)]':'bg-white/8 border-white/15')} />
                          ))}
                          <span className="text-[10px] font-black text-yellow-400 ml-0.5">⚡{energy}</span>
                        </div>
                        <button onClick={()=>setShowPowerPanel(false)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all text-lg leading-none">×</button>
                      </div>
                    </div>
                    {/* Limit warning */}
                    {usedPowers.length >= MAX_POWERS_PER_DUEL && (
                      <div className="mx-3 mt-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                        <span className="text-sm">🚫</span>
                        <span className="text-[10px] font-black text-red-400">Limite de {MAX_POWERS_PER_DUEL} poderes por partida atingido.</span>
                      </div>
                    )}
                    {/* 3-col compact grid */}
                    <div className="p-3 pb-5">
                      <div className="grid grid-cols-3 gap-2">
                        {(ALL_POWERS as unknown as string[]).map((p)=>{
                          const pKey=p as import('../../types/duel').DuelPowerType;
                          const info=POWERS_INFO[pKey];
                          if(!info) return null;
                          const isUsed=usedPowers.includes(pKey);
                          const hasEnergy=energy>=info.cost;
                          const isActive=activePowerPerQ===pKey;
                          const limitReached=usedPowers.length>=MAX_POWERS_PER_DUEL;
                          const canUse=!isUsed&&hasEnergy&&!alreadyActivatedThisQ&&timeLeft>2&&!limitReached;
                          const cardCn = isUsed||limitReached
                            ? 'bg-white/3 border-white/5 opacity-25 cursor-not-allowed'
                            : isActive
                            ? `bg-gradient-to-br ${info.bg} ${info.border}`
                            : !hasEnergy
                            ? 'bg-slate-900/60 border-red-900/20 opacity-40 cursor-not-allowed'
                            : alreadyActivatedThisQ
                            ? 'bg-white/3 border-white/5 opacity-30 cursor-not-allowed'
                            : `bg-gradient-to-br ${info.bg} ${info.border}`;
                          return (
                            <motion.button key={pKey}
                              whileHover={canUse?{scale:1.04}:{}}
                              whileTap={canUse?{scale:0.95}:{}}
                              onClick={()=>{
                                if(limitReached){toast.error(`Limite de ${MAX_POWERS_PER_DUEL} poderes por partida atingido!`);return;}
                                if(isUsed){toast.error('Poder já utilizado!');return;}
                                if(!hasEnergy){toast.error(`Precisa de ⚡${info.cost}. Você tem ⚡${energy}.`);return;}
                                if(alreadyActivatedThisQ){toast.error('Um poder por questão.');return;}
                                if (pKey === 'queima') {
                                  setQueimAmount(Math.min(energy, 5));
                                  setShowQueimModal(true);
                                  setShowPowerPanel(false);
                                  return;
                                }
                                handleActivatePower(pKey);
                                setShowPowerPanel(false);
                              }}
                              className={cn('relative flex flex-col items-start gap-1 px-2.5 py-3 rounded-2xl border-2 transition-all overflow-hidden text-left', cardCn)}>
                              {canUse&&!isActive&&(
                                <motion.div className="absolute inset-0 pointer-events-none"
                                  animate={{x:['-100%','200%']}} transition={{duration:2.5,repeat:Infinity,ease:'linear',repeatDelay:1.5}}
                                  style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)',width:'50%'}} />
                              )}
                              {/* Cost badge */}
                              <div className="absolute top-2 right-2">
                                <span className={cn('text-[10px] font-black',hasEnergy&&!isUsed&&!limitReached?'text-yellow-400':'text-red-400/40')}>⚡{info.cost}</span>
                              </div>
                              <span className="text-2xl leading-none">{info.emoji}</span>
                              <span className={cn('text-[11px] font-black leading-tight pr-4',canUse||isActive?info.color:'text-white/30')} style={{fontFamily:"'Rajdhani',sans-serif"}}>{info.label}</span>
                              <span className="text-[9px] text-white/30 leading-snug">{info.desc}</span>
                              {isUsed&&<span className="text-[8px] font-black text-white/20 bg-white/5 px-1 py-0.5 rounded-md mt-0.5">Usado</span>}
                              {isActive&&<span className={cn('text-[8px] font-black px-1 py-0.5 rounded-md bg-white/10 mt-0.5',info.color)}>Ativo ✓</span>}
                              {!isUsed&&!hasEnergy&&!limitReached&&<span className="text-[8px] font-black text-red-400/50 bg-red-500/10 px-1 py-0.5 rounded-md mt-0.5">Sem ⚡</span>}
                            </motion.button>
                          );
                        })}
                      </div>
                      <p className="text-center text-[9px] text-white/20 mt-2.5">
                        {alreadyActivatedThisQ?'Um poder por questão. ':''}{usedPowers.length}/{MAX_POWERS_PER_DUEL} poderes usados nesta partida.
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* �"?�"? Bottom actions �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */}
            <div className="px-5 pb-5 space-y-2.5">
              {/* Power button */}
              {!answered&&(
                <motion.button
                  whileHover={!activePowerPerQ&&energy>0&&usedPowers.length<MAX_POWERS_PER_DUEL?{scale:1.02}:{}}
                  whileTap={!activePowerPerQ&&usedPowers.length<MAX_POWERS_PER_DUEL?{scale:0.97}:{}}
                  onClick={()=>{
                    if(usedPowers.length>=MAX_POWERS_PER_DUEL){toast.error(`Limite de ${MAX_POWERS_PER_DUEL} poderes por partida atingido!`);return;}
                    setShowPowerPanel(true);
                  }}
                  disabled={!!activePowerPerQ}
                  className={cn('w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border transition-all relative overflow-hidden',
                    activePowerPerQ?'bg-white/5 border-white/8 text-white/25 cursor-not-allowed':
                    usedPowers.length>=MAX_POWERS_PER_DUEL?'bg-white/3 border-white/6 text-white/20 cursor-not-allowed':
                    energy>0?'border-yellow-500/50 text-yellow-300':'border-white/8 bg-white/3 text-white/20 cursor-not-allowed'
                  )}
                  style={energy>0&&!activePowerPerQ&&usedPowers.length<MAX_POWERS_PER_DUEL?{background:'linear-gradient(135deg,rgba(120,53,15,0.6),rgba(92,45,0,0.6))',boxShadow:'0 0 20px rgba(234,179,8,0.15)'}:undefined}>
                  {activePowerPerQ?(
                    <><span className="text-base">{POWERS_INFO[activePowerPerQ]?.emoji}</span><span style={{fontFamily:"'Rajdhani',sans-serif"}}>{POWERS_INFO[activePowerPerQ]?.label} ativado</span></>
                  ):usedPowers.length>=MAX_POWERS_PER_DUEL?(
                    <><span>🚫</span><span style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:'0.06em'}}>PODERES ESGOTADOS ({MAX_POWERS_PER_DUEL}/{MAX_POWERS_PER_DUEL})</span></>
                  ):energy>0?(
                    <>
                      <Zap size={14} className="text-yellow-400"/>
                      <span style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:'0.08em'}}>⚡ ATIVAR PODER ({usedPowers.length}/{MAX_POWERS_PER_DUEL})</span>
                    </>
                  ):(
                    <><Zap size={14} className="text-white/20"/><span style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:'0.08em'}}>SEM ENERGIA — acerte para ganhar ⚡</span></>
                  )}
                  {energy>0&&!activePowerPerQ&&usedPowers.length<MAX_POWERS_PER_DUEL&&(
                    <motion.div className="absolute inset-0 pointer-events-none"
                      animate={{x:['-100%','200%']}} transition={{duration:2.5,repeat:Infinity,ease:'linear',repeatDelay:1}}
                      style={{background:'linear-gradient(90deg,transparent,rgba(251,191,36,0.12),transparent)',width:'40%'}} />
                  )}
                </motion.button>
              )}

              {/* Confirm / Next */}
              {!answered?(
                <motion.button whileTap={{scale:0.97}} disabled={!selectedAnswer} onClick={handleSubmitAnswer}
                  className={cn('w-full h-14 rounded-2xl font-black text-base transition-all relative overflow-hidden',
                    selectedAnswer
                      ?'text-white shadow-xl'
                      :'bg-white/5 border border-white/8 text-white/20 cursor-not-allowed'
                  )}
                  style={selectedAnswer?{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',boxShadow:'0 0 30px rgba(99,102,241,0.4)'}:undefined}>
                  {selectedAnswer&&(
                    <motion.div className="absolute inset-0 pointer-events-none"
                      animate={{x:['-100%','200%']}} transition={{duration:2,repeat:Infinity,ease:'linear',repeatDelay:1.5}}
                      style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)',width:'40%'}} />
                  )}
                  <span style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:'0.06em',position:'relative',zIndex:1}}>
                    {selectedAnswer?'✅ CONFIRMAR RESPOSTA':'Selecione uma alternativa'}
                  </span>
                </motion.button>
              ):(!duelFeedback && currentQuestionIndex < questions.length - 1)?(
                <motion.button initial={{scale:0.92,opacity:0}} animate={{scale:1,opacity:1}} whileTap={{scale:0.97}} onClick={handleNext}
                  className="w-full h-14 rounded-2xl font-black text-base text-white transition-all relative overflow-hidden shadow-xl"
                  style={{background:'linear-gradient(135deg,#1e293b,#334155)',boxShadow:'0 0 20px rgba(51,65,85,0.6)'}}>
                  <motion.div className="absolute inset-0 pointer-events-none"
                    animate={{x:['-100%','200%']}} transition={{duration:2,repeat:Infinity,ease:'linear',repeatDelay:1}}
                    style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)',width:'40%'}} />
                  <span style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:'0.06em'}}>⚡ PRÓXIMA QUESTÃO</span>
                </motion.button>
              ):(!duelFeedback && currentQuestionIndex >= questions.length - 1 && answered)?(
                <motion.button initial={{scale:0.92,opacity:0}} animate={{scale:1,opacity:1}} whileTap={{scale:0.97}} onClick={handleNext}
                  className="w-full h-14 rounded-2xl font-black text-base text-white relative overflow-hidden shadow-xl"
                  style={{background:'linear-gradient(135deg,#7c3aed,#4f46e5)',boxShadow:'0 0 30px rgba(124,58,237,0.5)'}}>
                  <motion.div className="absolute inset-0 pointer-events-none"
                    animate={{x:['-100%','200%']}} transition={{duration:2,repeat:Infinity,ease:'linear',repeatDelay:1}}
                    style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)',width:'40%'}} />
                  <span style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:'0.06em'}}>🏁 VER RESULTADO</span>
                </motion.button>
              ):null}
            </div>

            {/* Answer Feedback Overlay */}
            <AnswerFeedbackOverlay
              feedback={duelFeedback?.type??null}
              correctAnswerText={duelFeedback?.correctText}
              explanation={duelFeedback?.explanation}
              points={duelFeedback?.pointsEarned}
              manualAdvance
              nextLabel={currentQuestionIndex>=questions.length-1?'Ver Resultado':'Próxima Pergunta'}
              onDismiss={()=>{ setDuelFeedback(null); pendingDuelNext.current=null; if(currentQuestionIndex < questions.length - 1) handleNext(); }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ============================================================ */}
      {/* Queima de Energia Modal */}
      <AnimatePresence>
        {showQueimModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{background:'rgba(0,0,0,0.88)',backdropFilter:'blur(10px)'}}>
            <motion.div initial={{scale:0.85,opacity:0,y:30}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.9,opacity:0}}
              transition={{type:'spring',stiffness:300,damping:22}}
              className="w-full max-w-sm rounded-[2rem] p-7 relative overflow-hidden"
              style={{background:'linear-gradient(145deg,#1a0a00,#261200)',border:'1px solid rgba(251,191,36,0.35)',boxShadow:'0 0 80px rgba(251,146,60,0.25)'}}>
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full pointer-events-none"
                style={{background:'radial-gradient(circle,rgba(251,191,36,0.3) 0%,transparent 70%)',filter:'blur(24px)'}} />
              <div className="text-center mb-5 relative z-10">
                <motion.div className="text-5xl mb-2" animate={{rotate:[-6,6,-6]}} transition={{duration:1.2,repeat:Infinity}}>🔥</motion.div>
                <h3 className="text-xl font-black text-white" style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:'0.06em'}}>Queima de Energia</h3>
                <p className="text-xs text-white/45 mt-1">Cada energia consumida vale +20% de pontos na próxima questão</p>
              </div>
              <div className="flex justify-center gap-3 mb-4 relative z-10">
                {Array.from({length:5}).map((_,i) => {
                  const lit = i < queimAmount;
                  const avail = i < Math.min(energy,5);
                  return (
                    <motion.button key={i} disabled={!avail}
                      onClick={() => setQueimAmount(i+1)}
                      animate={lit ? {scale:[1,1.18,1],opacity:1} : {scale:1,opacity:avail?0.5:0.18}}
                      transition={{duration:0.6,repeat:lit?Infinity:0,delay:i*0.08}}
                      className="w-11 h-11 rounded-full text-lg font-black border-2"
                      style={{
                        background:lit?'radial-gradient(circle at 40% 35%,#fde68a,#f59e0b)':'rgba(255,255,255,0.05)',
                        borderColor:lit?'#fbbf24':'rgba(255,255,255,0.12)',
                        boxShadow:lit?'0 0 18px rgba(251,191,36,0.75)':'none',
                        cursor:avail?'pointer':'not-allowed',
                      }}>⚡</motion.button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 mb-5 relative z-10">
                <button onClick={() => setQueimAmount(a => Math.max(1,a-1))}
                  className="w-10 h-10 rounded-xl font-black text-xl bg-white/10 hover:bg-white/20 text-white transition-all">−</button>
                <div className="text-center min-w-[80px]">
                  <motion.div key={queimAmount} initial={{scale:0.6,opacity:0}} animate={{scale:1,opacity:1}}
                    className="text-3xl font-black" style={{color:'#fbbf24',fontFamily:"'Orbitron',monospace"}}>
                    +{queimAmount * 20}%
                  </motion.div>
                  <div className="text-[10px] text-white/35 mt-0.5">bônus de pontos</div>
                </div>
                <button onClick={() => setQueimAmount(a => Math.min(Math.min(energy,5),a+1))}
                  className="w-10 h-10 rounded-xl font-black text-xl bg-white/10 hover:bg-white/20 text-white transition-all">+</button>
              </div>
              <div className="flex justify-between text-xs text-white/35 mb-5 px-1 relative z-10">
                <span>⚡ Energia atual: <span className="text-yellow-400 font-black">{energy}</span></span>
                <span>Custo: <span className="text-red-400 font-black">−{queimAmount}</span></span>
              </div>
              <div className="flex gap-3 relative z-10">
                <button onClick={() => setShowQueimModal(false)}
                  className="flex-1 h-12 rounded-2xl font-black text-sm bg-white/10 text-white/55 hover:bg-white/15 transition-all">
                  Cancelar
                </button>
                <motion.button onClick={handleConfirmQueima} whileTap={{scale:0.96}}
                  className="flex-1 h-12 rounded-2xl font-black text-sm text-black"
                  style={{background:'linear-gradient(135deg,#fde68a,#f59e0b)',boxShadow:'0 0 24px rgba(251,191,36,0.55)'}}>
                  🔥 Confirmar Queima
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );




  // �."�.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.-
  // �.'  CINEMATIC RESULT SCREEN                       �.'
  // �.s�.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
  const isPending = duel.status !== 'completed';
  const resultCfg = isDuelWon
    ? {emoji:'🏆',label:'VITÓRIA!',    sub:'Você dominou o duelo!',  grad:'from-emerald-950 via-teal-950 to-slate-950', glow:'bg-emerald-400', accent:'text-emerald-400', ring:'ring-emerald-400 shadow-emerald-400/40'}
    : isDuelDraw
    ? {emoji:'🤝',label:'EMPATE!',     sub:'Uma batalha equilibrada!', grad:'from-indigo-950 via-purple-950 to-slate-950', glow:'bg-indigo-400',  accent:'text-indigo-400',  ring:'ring-indigo-400'}
    : duel.status==='completed'
    ? {emoji:'😔',label:'DERROTA',    sub:'Da próxima você vai melhor!',grad:'from-slate-950 via-slate-900 to-slate-950',  glow:'bg-slate-600',   accent:'text-slate-400',   ring:'ring-white/20'}
    : {emoji:'⚔️',label:'Enviado!',  sub:'Aguardando oponente...',   grad:'from-indigo-950 via-slate-950 to-slate-950',  glow:'bg-indigo-500',  accent:'text-indigo-300',  ring:'ring-indigo-400'};

  return (
    <div className="max-w-xl mx-auto pb-20 space-y-4 animate-in fade-in duration-500">

      {/* �"?�"?�"? Hero �"?�"?�"? */}
      <div className={cn('relative bg-gradient-to-br rounded-[2.5rem] overflow-hidden shadow-2xl', resultCfg.grad)}>
        {/* glow orb */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={cn('absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-15 blur-3xl', resultCfg.glow)} />
          {/* confetti for win */}
          {isDuelWon && Array.from({length:20}).map((_,i)=>(
            <motion.div key={i}
              initial={{y:-10,opacity:1,x:0}}
              animate={{y:300,opacity:0,rotate:Math.random()*720}}
              transition={{duration:2.5+Math.random()*1.5,delay:Math.random()*0.6,ease:'easeIn'}}
              className="absolute top-0 rounded-sm"
              style={{left:`${4+i*5}%`,width:7,height:11,backgroundColor:['#34d399','#60a5fa','#fbbf24','#f87171','#a78bfa','#fb7185'][i%6]}}
            />
          ))}
        </div>

        <div className="relative p-6 pt-7">
          {/* Avatars row */}
          <div className="flex items-center justify-between mb-4">
            {/* Me */}
            <motion.div initial={{x:-60,opacity:0}} animate={{x:0,opacity:1}} transition={{type:'spring',delay:0.15}} className="flex flex-col items-center gap-2">
              <div className={cn('rounded-[2rem] overflow-hidden ring-4 w-36 h-36 shadow-2xl', isDuelWon?resultCfg.ring:'ring-white/20')}>
                {myAvatarCompose?.avatarUrl
                  ? <AvatarComposer avatarUrl={myAvatarCompose.avatarUrl} backgroundUrl={myAvatarCompose.backgroundUrl} borderUrl={myAvatarCompose.borderUrl} size="md" animate={false} isFloating={false} className="w-36 h-36"/>
                  : <div className="w-36 h-36 overflow-hidden bg-white/10"><img src={myAvatarUrl} className="w-full h-full object-cover" onError={e=>{(e.target as any).src='/avatars/default-impacto.png'}}/></div>}
              </div>
              <span className="text-sm font-black text-white/90 uppercase truncate max-w-[90px]" style={{fontFamily:"'Rajdhani', sans-serif"}}>{user?.name?.split(' ')[0]}</span>
            </motion.div>

            {/* Centre */}
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <motion.div initial={{scale:0,rotate:-180}} animate={{scale:1,rotate:0}} transition={{type:'spring',delay:0.6,bounce:0.55}} className="text-7xl mb-0.5">
                {resultCfg.emoji}
              </motion.div>
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.9}}>
                <p className={cn('text-3xl font-black text-center tracking-tight', resultCfg.accent)} style={{fontFamily:"'Rajdhani', sans-serif"}}>{resultCfg.label}</p>
              </motion.div>
              {duel.status==='completed' && (
                <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} transition={{delay:1.1}} className="flex items-center gap-2 mt-2">
                  <span className="text-5xl font-black text-white tabular-nums drop-shadow-lg" style={{fontFamily:"'Orbitron', monospace"}}><CountUp to={myScore} delay={1.1}/></span>
                  <span className="text-white/30 text-lg font-black" style={{fontFamily:"'Rajdhani', sans-serif"}}>vs</span>
                  <span className="text-5xl font-black text-white/40 tabular-nums" style={{fontFamily:"'Orbitron', monospace"}}><CountUp to={oppScore} delay={1.2}/></span>
                </motion.div>
              )}
              {duel.status==='completed' && <div className="text-[10px] text-white/35 font-bold mt-0.5">acertos de {duel.questionCount}</div>}
            </div>

            {/* Opponent */}
            <motion.div initial={{x:60,opacity:0}} animate={{x:0,opacity:1}} transition={{type:'spring',delay:0.15}} className="flex flex-col items-center gap-2">
              <div className={cn('rounded-[2rem] overflow-hidden ring-4 w-36 h-36 shadow-2xl', !isDuelWon&&duel.status==='completed'?resultCfg.ring:'ring-white/20')}>
                {oppAvatarCompose?.avatarUrl
                  ? <AvatarComposer avatarUrl={oppAvatarCompose.avatarUrl} backgroundUrl={oppAvatarCompose.backgroundUrl} borderUrl={oppAvatarCompose.borderUrl} size="md" animate={false} isFloating={false} className="w-36 h-36"/>
                  : <div className="w-36 h-36 overflow-hidden bg-white/10"><img src={opponentAvatarUrl} className="w-full h-full object-cover" onError={e=>{(e.target as any).src='/avatars/default-impacto.png'}}/></div>}
              </div>
              <span className="text-sm font-black text-white/90 uppercase truncate max-w-[90px]" style={{fontFamily:"'Rajdhani', sans-serif"}}>{opponent?.name?.split(' ')[0]||'Rival'}</span>
            </motion.div>
          </div>

          {/* Sub label */}
          <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.4}} className="text-center text-xs font-bold text-white/55 mt-1">
            {resultCfg.sub}
          </motion.p>
        </div>
      </div>

      {/* �"?�"?�"? Stats grid �"?�"?�"? */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {val:`${totals.correctCount}/${questions.length}`,label:'Acertos',   icon:'✅',color:'border-l-emerald-500', d:0.1},
          {val:`${totals.accuracy}%`,                       label:'Precisão',  icon:'🎯',color:'border-l-indigo-500',  d:0.15},
          {val:`${totals.avgTimeUsed}s`,                    label:'Tempo Méd.', icon:'⏱',color:'border-l-amber-500',   d:0.2},
          {val:`${totals.maxStreak||maxStreak}x`,           label:'Melhor Seq.',icon:'🔥',color:'border-l-rose-500',    d:0.25},
        ].map(s=>(
          <motion.div key={s.label} initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:s.d+1.3}}
            className={cn('bg-slate-900 border border-white/10 border-l-4 rounded-2xl p-4 flex items-center gap-3', s.color)}>
            <span className="text-2xl shrink-0">{s.icon}</span>
            <div>
              <div className="text-2xl font-black text-white">{s.val}</div>
              <div className="text-[9px] font-black text-white/40 uppercase tracking-wider">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* �"?�"?�"? Rewards �"?�"?�"? */}
      {duel.status==='completed' && (
        <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:1.8}} className="grid grid-cols-2 gap-3">
          <div className="bg-indigo-950 border border-indigo-500/30 rounded-2xl p-5 text-center">
            <div className="text-3xl font-black text-indigo-300">+<CountUp to={earnedXP||totals.correctCount*25} delay={1.9}/> XP</div>
            <div className="text-[9px] text-indigo-400/40 uppercase mt-1">⚡ XP Ganho</div>
          </div>
          <div className="bg-amber-950 border border-amber-500/30 rounded-2xl p-5 text-center">
            <div className="text-3xl font-black text-amber-300">+<CountUp to={earnedCoins||totals.correctCount*5} delay={2.0}/> 💰</div>
            <div className="text-[9px] text-amber-400/40 uppercase mt-1">Moedas</div>
          </div>
        </motion.div>
      )}



      {/* �"?�"?�"? Waiting �"?�"?�"? */}
      {isPending && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5}}
          className="bg-indigo-950 border border-indigo-500/30 rounded-2xl p-5 text-center">
          <div className="flex justify-center gap-1.5 mb-2">
            {[0,150,300].map(d=>(
              <div key={d} className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}}/>
            ))}
          </div>
          <p className="text-indigo-300 font-bold text-sm">Aguardando {opponent?.name?.split(' ')[0]||'rival'}...</p>
          <p className="text-indigo-400/40 text-[9px] mt-1">Você receberá uma notificação quando ele jogar</p>
        </motion.div>
      )}

      {/* �"?�"?�"? Relatório �"?�"?�"? */}
      {answerData.length>0 && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:2.2}} className="space-y-2">
          <motion.button whileTap={{scale:0.98}} onClick={()=>setShowDetails(s=>!s)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 rounded-2xl text-white font-black text-sm transition-all shadow-lg shadow-indigo-900/40"
            style={{fontFamily:"'Rajdhani', sans-serif",letterSpacing:'0.05em'}}>
            <span className="flex items-center gap-2">📊 RELATÓRIO DA PARTIDA</span>
            <motion.span animate={{rotate:showDetails?180:0}} transition={{duration:0.25}} className="opacity-70">▾</motion.span>
          </motion.button>
          <AnimatePresence>
            {showDetails && (
              <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                {/* Powers used summary */}
                {totals.powersUsed.length > 0 && (
                  <div className="mb-3 p-4 bg-slate-900 rounded-2xl border border-white/10">
                    <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">⚡ Poderes Usados</div>
                    <div className="flex flex-wrap gap-2">
                      {[...new Set(totals.powersUsed)].map(p => {
                        const info = POWERS_INFO[p];
                        return info ? (
                          <span key={p} className={`text-[10px] font-black px-3 py-1 rounded-full bg-white/10 ${info.color}`}>
                            {info.emoji} {info.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2 pt-1">
                  {answerData.map((ad,i)=>(
                    <motion.div key={i} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                      className={cn('flex items-center justify-between px-4 py-3.5 rounded-2xl border-l-4',
                        ad.isCorrect
                          ?'bg-emerald-950/70 border-l-emerald-500 border border-emerald-500/20'
                          :'bg-red-950/60 border-l-red-500 border border-red-500/20')}>
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0',
                          ad.isCorrect?'bg-emerald-500/20 text-emerald-400':'bg-red-500/20 text-red-400')}>
                          {i+1}
                        </div>
                        <div>
                          <div className="text-xs font-black text-white">Questão {i+1}</div>
                          <div className="text-[9px] text-white/40">{ad.timeUsed}s · seq. {ad.streakAtAnswer}x</div>
                          {ad.powerUsed && (
                            <div className="text-[9px] mt-0.5 flex items-center gap-1">
                              <span>{POWERS_INFO[ad.powerUsed]?.emoji ?? '⚡'}</span>
                              <span className={POWERS_INFO[ad.powerUsed]?.color ?? 'text-white/50'}>
                                {POWERS_INFO[ad.powerUsed]?.label ?? ad.powerUsed}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn('text-sm font-black',ad.isCorrect?'text-emerald-400':'text-red-400/60')}>
                          {ad.isCorrect?`+${ad.pointsEarned} pts`:'Errou'}
                        </div>
                        {ad.speedBonus>0&&<div className="text-[9px] text-yellow-400">+{ad.speedBonus} vel. ⚡</div>}
                        {ad.shieldActivated&&<div className="text-[9px] text-cyan-400">🛡️ Absorvido!</div>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* �"?�"?�"? Action buttons �"?�"?�"? */}
      <motion.button initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:2.3}}
        onClick={()=>navigate('/student/duels')}
        className="w-full h-14 rounded-2xl font-black text-slate-400 hover:text-slate-600 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all text-sm uppercase tracking-widest">
        ⚔️ Voltar para Duelos
      </motion.button>
    </div>
  );
};
