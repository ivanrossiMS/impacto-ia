import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import type { Activity } from '../../types/learning';
import {
  BookOpen, CheckCircle, Clock, PlayCircle, Star,
  Zap, ChevronRight, X, Trophy, Flame, BarChart3,
  ArrowRight, Medal, Sparkles, Target, RotateCcw
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { REWARDS, updateGamificationStats } from '../../lib/gamificationUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { decodeActivityMeta } from '../../lib/activityStorage';
import { useSupabaseQuery } from '../../hooks/useSupabase';

// ── Subject configuration ───────────────────────────────────────────────────
const SUBJECT_CONFIG: Record<string, { emoji: string; gradient: string; badge: string; light: string; accent: string }> = {
  'Matemática':       { emoji: '📐', gradient: 'from-blue-600 to-indigo-700',    badge: 'bg-blue-100 text-blue-700',       light: 'bg-blue-50',     accent: '#3b82f6' },
  'Português':        { emoji: '📚', gradient: 'from-violet-600 to-purple-700',  badge: 'bg-violet-100 text-violet-700',   light: 'bg-violet-50',   accent: '#8b5cf6' },
  'Ciências':         { emoji: '🧪', gradient: 'from-emerald-500 to-teal-700',   badge: 'bg-emerald-100 text-emerald-700', light: 'bg-emerald-50',  accent: '#10b981' },
  'História':         { emoji: '🏺', gradient: 'from-amber-500 to-orange-600',   badge: 'bg-amber-100 text-amber-700',     light: 'bg-amber-50',    accent: '#f59e0b' },
  'Geografia':        { emoji: '🌍', gradient: 'from-cyan-500 to-sky-700',       badge: 'bg-cyan-100 text-cyan-700',       light: 'bg-cyan-50',     accent: '#06b6d4' },
  'Inglês':           { emoji: '🗣️', gradient: 'from-rose-500 to-pink-700',      badge: 'bg-rose-100 text-rose-700',       light: 'bg-rose-50',     accent: '#f43f5e' },
  'Artes':            { emoji: '🎨', gradient: 'from-fuchsia-500 to-pink-600',   badge: 'bg-fuchsia-100 text-fuchsia-700', light: 'bg-fuchsia-50',  accent: '#d946ef' },
  'Ed. Física':       { emoji: '⚽', gradient: 'from-lime-500 to-green-600',     badge: 'bg-lime-100 text-lime-700',       light: 'bg-lime-50',     accent: '#84cc16' },
  'Filosofia':        { emoji: '🧠', gradient: 'from-slate-600 to-gray-800',     badge: 'bg-slate-100 text-slate-700',     light: 'bg-slate-50',    accent: '#64748b' },
  'Sociologia':       { emoji: '🤝', gradient: 'from-orange-500 to-red-600',     badge: 'bg-orange-100 text-orange-700',   light: 'bg-orange-50',   accent: '#f97316' },
  'Educação Física':  { emoji: '⚽', gradient: 'from-lime-500 to-green-600',     badge: 'bg-lime-100 text-lime-700',       light: 'bg-lime-50',     accent: '#84cc16' },
};

const getSubjectConfig = (subject: string) =>
  SUBJECT_CONFIG[subject] || { emoji: '📖', gradient: 'from-primary-500 to-indigo-700', badge: 'bg-primary-100 text-primary-700', light: 'bg-primary-50', accent: '#6366f1' };

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  objetiva: 'Múltipla Escolha', quiz_divertido: 'Quiz Divertido',
  dissertativa: 'Dissertativa', simulado: 'Simulado',
  prova_mensal: 'Prova Mensal', prova_bimestral: 'Prova Bimestral',
  multiple_choice: 'Múltipla Escolha', true_false: 'V ou F', mixed: 'Mista',
};

// ── Letter labels for options ────────────────────────────────────────────────
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// ── Parse raw activity question format ──────────────────────────────────────
function parseActivity(ta: any): any {
  const decoded = decodeActivityMeta(ta);
  if (ta.questions && ta.questions.length > 0 && (ta.questions[0] as any).text) {
    return {
      ...decoded, type: 'mixed',
      questions: ta.questions.map((q: any, i: number) => ({
        id: q.id || String(i), questionText: q.text,
        type: q.type === 'objetiva' ? 'multiple_choice' : 'true_false',
        explanation: q.explanation || 'Muito bem!',
        options: q.type === 'objetiva'
          ? (q.options || []).map((opt: string, idx: number) => ({ id: String(idx), text: opt, isCorrect: String(idx) === q.answer }))
          : [{ id: 'true', text: 'Verdadeiro', isCorrect: q.answer === 'true' }, { id: 'false', text: 'Falso', isCorrect: q.answer === 'false' }]
      }))
    };
  }
  return decoded;
}

export const Activities: React.FC = () => {
  const user = useAuthStore(state => state.user);

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<{ questionId: string; correct: boolean; selectedOptionId: string }[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [viewingResult, setViewingResult] = useState<{ activity: any; result: any } | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // ── Reactive data via Dexie/SyncEngine — auto-updates without any manual refresh ──
  const allUsers              = useSupabaseQuery<any>('users');
  const allActivities         = useSupabaseQuery<any>('activities');
  const allResults            = useSupabaseQuery<any>('student_activity_results');
  const allStats              = useSupabaseQuery<any>('gamification_stats');

  // ── Derived data (recomputed automatically when the raw data changes) ─────
  const studentData = useMemo(() =>
    allUsers.find((u: any) => u.id === user?.id) || null,
    [allUsers, user?.id]
  );

  const classId = studentData?.classId;

  const activities: Activity[] = useMemo(() => {
    if (!classId) return [];
    const filtered = allActivities.filter((a: any) => a.classId === classId || a.classId == null);
    return filtered.map(parseActivity);
  }, [allActivities, classId]);

  const activityResults: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    allResults
      .filter((r: any) => r.studentId === user?.id)
      .forEach((r: any) => { map[r.activityId] = r; });
    return map;
  }, [allResults, user?.id]);

  const stats = useMemo(() =>
    allStats.find((s: any) => s.id === user?.id) || null,
    [allStats, user?.id]
  );

  const loading = allUsers.length === 0 && allActivities.length === 0;

  // ── Definitive real-time sync ─────────────────────────────────────────────
  // This is a DOUBLE SAFETY NET on top of the SyncEngine:
  // • Fetches fresh data from Supabase on mount (ensures page is never stale)
  // • Subscribes directly to postgres_changes (doesn't rely on SyncEngine alone)
  // • Re-fetches whenever the tab becomes visible
  // All writes go to Dexie → useLiveQuery reacts instantly.
  useEffect(() => {
    if (!user?.id) return;

    const syncActivities = async () => {
      const { data } = await supabase.from('activities').select('*');
      if (data?.length) {
        const { db } = await import('../../lib/dexie');
        await (db.activities as any).bulkPut(data);
      }
    };

    const syncResults = async () => {
      const { data } = await supabase
        .from('student_activity_results')
        .select('*')
        .eq('studentId', user.id);
      if (data?.length) {
        const { db } = await import('../../lib/dexie');
        await (db.studentActivityResults as any).bulkPut(data);
      }
    };

    // 1. Fetch fresh on mount
    syncActivities();
    syncResults();

    // 2. Subscribe directly as a fallback to SyncEngine
    const channel = supabase
      .channel(`student_activities_direct_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' },
        () => syncActivities())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_activity_results' },
        () => syncResults())
      .subscribe();

    // 3. Re-sync when the student returns to this tab
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        syncActivities();
        syncResults();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id]);


  useEffect(() => {
    let timer: any;
    if (activeActivity && timeLeft !== null && !isFinished) {
      if (timeLeft > 0) {
        timer = setInterval(() => setTimeLeft(prev => prev !== null ? prev - 1 : null), 1000);
      } else { handleTimeout(); }
    }
    return () => clearInterval(timer);
  }, [activeActivity, timeLeft, isFinished]);

  const handleTimeout = async () => { toast.error('O tempo acabou!'); handleGiveUp(); };

  // ── Persistent timer helpers ─────────────────────────────────────────────────
  const timerKeyFor = (activityId: string) => `impacto_timer_start_${activityId}`;

  const handleStartActivity = (activity: Activity) => {
    setActiveActivity(activity); setCurrentQuestionIndex(0);
    setSelectedAnswer(null); setAnswered(false); setResults([]);
    setIsFinished(false); setStartedAt(Date.now());

    const noExit = !!(activity as any).noExitAllowed;
    const durationStr = activity.duration || '';
    const minutes = durationStr !== 'Sem limite'
      ? parseInt(durationStr.replace(/\D/g, '')) || 0
      : 0;

    if (minutes > 0) {
      if (noExit) {
        // Strict mode: timer resets each time (because leaving = instant fail)
        setTimeLeft(minutes * 60);
        localStorage.removeItem(timerKeyFor(activity.id));
      } else {
        // Persistent mode: timer keeps running even if student closes the modal
        const key = timerKeyFor(activity.id);
        const stored = localStorage.getItem(key);
        if (stored) {
          const startedTs = parseInt(stored, 10);
          const elapsedSec = Math.floor((Date.now() - startedTs) / 1000);
          const remaining = minutes * 60 - elapsedSec;
          if (remaining <= 0) {
            // Time already expired while away — treat as timeout immediately
            setTimeLeft(0);
          } else {
            setTimeLeft(remaining);
          }
        } else {
          localStorage.setItem(key, String(Date.now()));
          setTimeLeft(minutes * 60);
        }
      }
    } else {
      setTimeLeft(null);
      localStorage.removeItem(timerKeyFor(activity.id));
    }
  };

  const currentQuestion = activeActivity?.questions
    ? activeActivity.questions[currentQuestionIndex]
    : activeActivity;

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion || !user) return;
    const correct = currentQuestion.options?.find((o: any) => o.id === selectedAnswer)?.isCorrect;
    setAnswered(true);
    setResults(prev => [...prev, { questionId: currentQuestion.id, correct: !!correct, selectedOptionId: selectedAnswer }]);
    if (correct) toast.success('Resposta correta! 🎉');
    else toast.error('Não foi dessa vez. Continue!');
  };

  const handleNext = async () => {
    if (!activeActivity || !user) return;
    const totalQuestions = activeActivity.questions?.length || 1;
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null); setAnswered(false);
    } else {
      setIsFinished(true);
      const correctCount = results.filter(r => r.correct).length;
      let xpEarned = (correctCount * REWARDS.QUESTION_CORRECT_XP) + REWARDS.ACTIVITY_COMPLETE_XP;
      if (correctCount === totalQuestions && totalQuestions > 0) xpEarned += REWARDS.ACTIVITY_PERFECT_BONUS;
      const coinsEarned = (correctCount * REWARDS.QUESTION_CORRECT_COINS) + REWARDS.ACTIVITY_COMPLETE_COINS;
      const timeSpent = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
      const existingResult = activityResults[activeActivity.id];
      const result: any = {
        activityId: activeActivity.id, studentId: user.id,
        status: correctCount > 0 ? 'passed' : 'failed',
        score: correctCount, totalQuestions, xpEarned, coinsEarned,
        completedAt: new Date().toISOString(), timeSpent,
        responses: results.map(r => ({ questionId: r.questionId, selectedOptionId: r.selectedOptionId, isCorrect: r.correct }))
      };
      if (existingResult?.id) result.id = existingResult.id;
      // Clear persistent timer on completion
      if (activeActivity.id) localStorage.removeItem(timerKeyFor(activeActivity.id));
      const { data: savedResult } = await supabase
        .from('student_activity_results')
        .upsert(result)
        .select()
        .single();
      // ── Optimistic Dexie write — triggers useLiveQuery immediately ──────────
      try {
        const { db } = await import('../../lib/dexie');
        await (db.studentActivityResults as any).put(savedResult || result);
      } catch {}
      try { await updateGamificationStats(user.id, { xpToAdd: xpEarned, coinsToAdd: coinsEarned }); } catch {}
      await incrementMissionProgress(user.id, 'activity_completed', 1);
      if (correctCount > 0) await incrementMissionProgress(user.id, 'question_correct', correctCount);
      toast.success(`Atividade concluída! +${xpEarned} XP 🚀`);
    }
  };

  // ── Refs: always hold latest state so event handlers / cleanup never go stale ─
  const activeActivityRef = React.useRef<Activity | null>(null);
  const isFinishedRef     = React.useRef(false);
  const resultsRef        = React.useRef<{ questionId: string; correct: boolean; selectedOptionId: string }[]>([]);
  const startedAtRef      = React.useRef<number | null>(null);
  const userRef           = React.useRef<any>(null);

  React.useEffect(() => { activeActivityRef.current = activeActivity; }, [activeActivity]);
  React.useEffect(() => { isFinishedRef.current     = isFinished; },     [isFinished]);
  React.useEffect(() => { resultsRef.current         = results; },        [results]);
  React.useEffect(() => { startedAtRef.current       = startedAt; },      [startedAt]);
  React.useEffect(() => { userRef.current            = user; },           [user]);

  // ── Pure fire-and-forget save — does NOT touch React state ───────────────────
  const saveAsGivenUp = React.useCallback((
    activity: any, userId: string, ts: number | null
  ) => {
    if (!activity || !userId) return;
    localStorage.removeItem(`impacto_timer_start_${activity.id}`);
    const totalQuestions = activity.questions?.length || 1;
    const timeSpent = ts ? Math.round((Date.now() - ts) / 1000) : 0;
    const resultPayload = {
      activityId: activity.id, studentId: userId, status: 'given_up',
      score: 0, totalQuestions, xpEarned: 0, coinsEarned: 0,
      completedAt: new Date().toISOString(), timeSpent,
    };
    // Save to Supabase and immediately write to Dexie for instant UI update
    supabase.from('student_activity_results').upsert(resultPayload)
      .select().single()
      .then(({ data }) => {
        import('../../lib/dexie').then(({ db }) => {
          (db.studentActivityResults as any).put(data || resultPayload);
        });
      });
  }, []);


  // ── closeModal: dismiss UI only, timer key stays in localStorage ─────────────
  const closeModal = React.useCallback(() => {
    setActiveActivity(null); setCurrentQuestionIndex(0); setSelectedAnswer(null);
    setAnswered(false); setResults([]); setIsFinished(false); setTimeLeft(null);
  }, []);

  // ── X button: save-and-fail if locked; just dismiss if not locked ─────────────
  const handleXButton = React.useCallback(() => {
    const act = activeActivityRef.current;
    const u   = userRef.current;
    if (act && (act as any).noExitAllowed && u && !isFinishedRef.current) {
      saveAsGivenUp(act, u.id, startedAtRef.current);

      toast.error('Atividade encerrada por saída.');
    }
    closeModal();
  }, [saveAsGivenUp, closeModal]);

  // ── handleGiveUp: called by timeout — always saves as given_up ───────────────
  const handleGiveUp = React.useCallback(async () => {
    const act = activeActivityRef.current;
    const u   = userRef.current;
    if (!act || !u) return;
    localStorage.removeItem(`impacto_timer_start_${act.id}`);
    const totalQuestions = act.questions?.length || 1;
    const timeSpent = startedAtRef.current
      ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
    await supabase.from('student_activity_results').upsert({
      activityId: act.id, studentId: u.id, status: 'given_up',
      score: 0, totalQuestions, xpEarned: 0, coinsEarned: 0,
      completedAt: new Date().toISOString(), timeSpent,
    });
    toast.error('Tempo esgotado!');
    closeModal();
  }, [closeModal]);

  // ── On component UNMOUNT (React Router navigation away) ──────────────────────
  React.useEffect(() => {
    return () => {
      const act = activeActivityRef.current;
      const u   = userRef.current;
      if (act && !isFinishedRef.current && (act as any).noExitAllowed && u) {
        saveAsGivenUp(act, u.id, startedAtRef.current);
      }
    };
  }, []); // empty deps = only fires on unmount

  // ── visibilitychange + beforeunload (tab switch, browser close) ───────────────
  React.useEffect(() => {
    const onHide = () => {
      const act = activeActivityRef.current;
      const u   = userRef.current;
      if (!act || isFinishedRef.current || !(act as any).noExitAllowed || !u) return;
      saveAsGivenUp(act, u.id, startedAtRef.current);

      closeModal();
    };

    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') onHide(); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const act = activeActivityRef.current;
      if (!act || !(act as any).noExitAllowed) return;
      e.preventDefault(); e.returnValue = '';
      saveAsGivenUp(act, userRef.current?.id, startedAtRef.current);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []); // empty deps = register once, use refs for latest state

  const closeActivity = closeModal; // alias for legacy callsites



  const handleViewResult = (activity: any) => {
    const result = activityResults[activity.id];
    if (result) setViewingResult({ activity, result });
  };

  const pending: any[] = activities.filter((a: any) => !activityResults[a.id]);
  const completed: any[] = activities.filter((a: any) => !!activityResults[a.id]);
  const baseShown: any[] = activeTab === 'pending' ? pending : completed;

  // Unique subjects present in current tab
  const availableSubjects: string[] = Array.from(new Set(baseShown.map((a: any) => a.subject).filter(Boolean)));
  // Reset subject filter if it no longer applies to current tab
  const shown: any[] = selectedSubject
    ? baseShown.filter((a: any) => a.subject === selectedSubject)
    : baseShown;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-14 h-14 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const correctNow = results.filter(r => r.correct).length;
  const totalQ = activeActivity?.questions?.length || 1;
  const progressPct = ((currentQuestionIndex + (answered ? 1 : 0)) / totalQ) * 100;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">

      {/* ── HERO HEADER ────────────────────────────────────────────────────── */}
      <section className="relative bg-slate-900 rounded-[2.5rem] overflow-hidden p-8 md:p-10">
        {/* bg decorators */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-primary-500/20 text-primary-300 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-primary-500/20">
                Aprendizado Ativo
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-none">
              Minhas <span className="text-primary-400">Atividades</span>
            </h1>
            <p className="text-slate-400 font-medium mt-2 text-sm">
              {activities.length === 0
                ? 'Aguardando atividades do professor...'
                : `${pending.length} pendente${pending.length !== 1 ? 's' : ''} · ${completed.length} concluída${completed.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Stats Pills */}
          {stats && (
            <div className="flex gap-3">
              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 backdrop-blur-sm px-5 py-3 rounded-2xl">
                <div className="w-8 h-8 bg-primary-500/20 rounded-xl flex items-center justify-center">
                  <Zap size={16} className="text-primary-400 fill-primary-400" />
                </div>
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">XP Total</div>
                  <div className="text-lg font-black text-white leading-none">{stats.xp}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 backdrop-blur-sm px-5 py-3 rounded-2xl">
                <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center text-lg">🪙</div>
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Moedas</div>
                  <div className="text-lg font-black text-amber-400 leading-none">{stats.coins}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── TABS ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem] w-fit">
        {[
          { id: 'pending', label: `Pendentes`, count: pending.length, icon: Flame },
          { id: 'completed', label: `Concluídas`, count: completed.length, icon: CheckCircle },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-sm font-black transition-all',
                activeTab === tab.id
                  ? 'bg-white text-primary-600 shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon size={15} />
              {tab.label}
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-black',
                activeTab === tab.id ? 'bg-primary-100 text-primary-600' : 'bg-slate-200 text-slate-500'
              )}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* ── SUBJECT FILTER CHIPS ─────────────────────────────────────────────── */}
      {availableSubjects.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Matéria:</span>
          <button
            onClick={() => setSelectedSubject(null)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black border-2 transition-all',
              !selectedSubject
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
            )}
          >
            📚 Todas
          </button>
          {availableSubjects.map(sub => {
            const cfg = getSubjectConfig(sub);
            const isActive = selectedSubject === sub;
            return (
              <button
                key={sub}
                onClick={() => setSelectedSubject(isActive ? null : sub)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black border-2 transition-all',
                  isActive
                    ? `bg-gradient-to-r ${cfg.gradient} text-white border-transparent shadow-md`
                    : `bg-white border-slate-100 hover:border-slate-300 ${cfg.badge}`
                )}
              >
                <span>{cfg.emoji}</span>
                {sub}
              </button>
            );
          })}
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="text-7xl mb-5 opacity-60">📚</div>
          <h3 className="text-2xl font-black text-slate-600 mb-2">Nenhuma atividade disponível</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium">
            Assim que o professor adicionar atividades para sua turma, elas aparecerão aqui.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-slate-50">
          <div className="text-6xl mb-4">{activeTab === 'pending' ? '🎉' : '📋'}</div>
          <h3 className="text-xl font-black text-slate-700">
            {activeTab === 'pending' ? 'Todas concluídas! Incrível!' : 'Nenhuma concluída ainda'}
          </h3>
          <p className="text-slate-400 text-sm mt-1 font-medium">
            {activeTab === 'pending' ? 'Continue assim, campeão!' : 'Comece uma atividade pendente!'}
          </p>
        </div>
      ) : (

        /* ── ACTIVITY CARDS GRID ──────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map(activity => {
            const result = activityResults[activity.id];
            const isDone = !!result;
            const cfg = getSubjectConfig(activity.subject);
            const qCount = activity.questions?.length || 1;
            const maxXp = (qCount * REWARDS.QUESTION_CORRECT_XP) + REWARDS.ACTIVITY_COMPLETE_XP;
            const scorePercent = isDone && result.totalQuestions > 0
              ? Math.round((result.score / result.totalQuestions) * 100) : 0;
            const typelabel = ACTIVITY_TYPE_LABEL[activity.type] || activity.type;
            const isPassed = result?.status === 'passed';
            const statusColor = isDone ? (isPassed ? '#10b981' : '#ef4444') : cfg.accent;

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => isDone && handleViewResult(activity)}
                whileHover={{ y: -5 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className={cn('bg-white rounded-2xl flex flex-col overflow-hidden select-none', isDone ? 'cursor-pointer' : '')}
                style={{
                  borderTop: `4px solid ${cfg.accent}`,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.07), 0 5px 0 0 rgba(0,0,0,0.06), 0 10px 20px -6px rgba(0,0,0,0.09)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(0,0,0,0.09), 0 8px 0 0 rgba(0,0,0,0.08), 0 18px 36px -8px rgba(0,0,0,0.16)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(0,0,0,0.07), 0 5px 0 0 rgba(0,0,0,0.06), 0 10px 20px -6px rgba(0,0,0,0.09)'; }}
              >
                {/* ══ HEADER — cinza claro ════════════════════════════════════ */}
                <div className="bg-gray-50 border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Emoji tile */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
                      style={{ background: `${cfg.accent}16`, border: `1.5px solid ${cfg.accent}26` }}
                    >
                      {cfg.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] truncate" style={{ color: cfg.accent }}>
                        {activity.subject || 'Geral'}
                      </div>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5 truncate">{typelabel}</div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className="flex items-center gap-1 text-xs font-black px-2.5 py-1.5 rounded-lg flex-shrink-0"
                    style={{ background: `${statusColor}13`, color: statusColor, border: `1.5px solid ${statusColor}22` }}
                  >
                    {isDone
                      ? (isPassed ? <CheckCircle size={11} /> : <X size={11} />)
                      : <Flame size={11} />}
                    {isDone ? (isPassed ? 'Aprovado' : 'Falhado') : 'Pendente'}
                  </span>
                </div>

                {/* ══ BODY — branco ══════════════════════════════════════════ */}
                <div className="flex flex-col flex-1 px-5 pt-4 pb-5 gap-3">
                  {/* Title + description */}
                  <div>
                    <h3 className={cn(
                      'text-base font-black leading-snug line-clamp-2',
                      isDone ? 'text-slate-500' : 'text-slate-900'
                    )}>
                      {activity.title}
                    </h3>
                    {activity.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1 font-medium">{activity.description}</p>
                    )}
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
                      <BookOpen size={10} /> {qCount} {qCount === 1 ? 'questão' : 'questões'}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md">
                      <Star size={10} fill="currentColor" /> +{isDone ? result.xpEarned : maxXp} XP
                    </span>
                    {activity.duration && activity.duration !== 'Sem limite' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
                        <Clock size={10} /> {activity.duration}
                      </span>
                    )}
                    {(activity as any).noExitAllowed ? (
                      <span className="flex items-center gap-1 text-[11px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-md">
                        🚫 Proibido Sair
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
                        ✅ Livre
                      </span>
                    )}
                  </div>

                  {/* Score bar */}
                  {isDone && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desempenho</span>
                        <span className="text-sm font-black" style={{ color: scorePercent >= 70 ? '#10b981' : scorePercent >= 40 ? '#f59e0b' : '#ef4444' }}>
                          {scorePercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${scorePercent}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: scorePercent >= 70 ? '#10b981' : scorePercent >= 40 ? '#f59e0b' : '#ef4444' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="mt-auto pt-1">
                    {!isDone ? (
                      <button
                        onClick={e => { e.stopPropagation(); handleStartActivity(activity); }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                        style={{ background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}bb)`, boxShadow: `0 3px 12px ${cfg.accent}3a` }}
                      >
                        <PlayCircle size={16} /> Começar Atividade
                      </button>
                    ) : (
                      <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-slate-500 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all">
                        <BarChart3 size={14} /> Ver Resultado <ChevronRight size={13} className="ml-auto" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>


      )}





      {/* ══════════════════════════════════════════════════════════════════════
          ACTIVITY MODAL (quiz in progress + finished state)
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {activeActivity && currentQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-6 sm:pt-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto"
          >

            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto my-auto"
            >
              <AnimatePresence mode="wait">
                {!isFinished ? (
                  <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {/* Modal Header */}
                    {(() => {
                      const cfg = getSubjectConfig(activeActivity.subject);
                      return (
                        <div className={cn('relative bg-gradient-to-br p-7 pb-10 text-white overflow-hidden', cfg.gradient)}>
                          {/* Progress bar */}
                          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/20">
                            <motion.div
                              className="h-full bg-white/60"
                              animate={{ width: `${progressPct}%` }}
                              transition={{ duration: 0.4 }}
                            />
                          </div>
                          <div className="absolute top-3 right-4 text-6xl opacity-10 select-none">{cfg.emoji}</div>

                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <span className="bg-white/20 border border-white/20 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl">
                                  {currentQuestionIndex + 1} / {activeActivity.questions?.length || 1}
                                </span>
                                {timeLeft !== null && (
                                  <span className={cn(
                                    'flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-xl border',
                                    timeLeft < 60 ? 'bg-red-500 border-red-400 animate-pulse' : 'bg-white/20 border-white/20'
                                  )}>
                                    <Clock size={11} />
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={handleXButton}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/10"
                              >
                                <X size={16} />
                              </button>

                            </div>

                            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/60">
                              {activeActivity.subject} · {activeActivity.title}
                            </div>

                            {/* Correct counter */}
                            <div className="flex items-center gap-1.5">
                              {Array.from({ length: activeActivity.questions?.length || 1 }).map((_, i) => (
                                <div key={i} className={cn(
                                  'h-1.5 flex-1 rounded-full transition-all duration-500',
                                  i < results.length
                                    ? results[i].correct ? 'bg-emerald-400' : 'bg-red-400'
                                    : i === currentQuestionIndex ? 'bg-white/60' : 'bg-white/20'
                                )} />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* noExitAllowed warning banner */}
                    {(activeActivity as any).noExitAllowed && (
                      <div className="flex items-center gap-2 bg-red-500 text-white text-[11px] font-black px-5 py-2.5">
                        <span>🚫</span>
                        <span>SAÍDA PROIBIDA — sair desta página encerrará a atividade como Falhada</span>
                      </div>
                    )}

                    {/* Question body */}
                    <div className="p-7 space-y-5">

                      <p className="text-slate-800 font-black text-lg leading-relaxed">
                        {currentQuestion.questionText}
                      </p>

                      <div className="space-y-2.5">
                        {currentQuestion.options?.map((opt: any, idx: number) => {
                          const isCorrect = opt.isCorrect;
                          const isSelected = selectedAnswer === opt.id;
                          let bg = 'bg-slate-50 border-slate-100 text-slate-700 hover:border-primary-200 hover:bg-primary-50/40';
                          if (answered) {
                            if (isCorrect) bg = 'bg-emerald-50 border-emerald-300 text-emerald-800';
                            else if (isSelected && !isCorrect) bg = 'bg-red-50 border-red-300 text-red-700';
                            else bg = 'bg-slate-50 border-slate-100 text-slate-400';
                          } else if (isSelected) {
                            bg = 'bg-primary-50 border-primary-400 text-primary-800 shadow-sm shadow-primary-100';
                          }

                          return (
                            <motion.button
                              key={opt.id}
                              disabled={answered}
                              onClick={() => setSelectedAnswer(opt.id)}
                              whileTap={!answered ? { scale: 0.98 } : {}}
                              className={cn('w-full text-left p-4 rounded-2xl border-2 font-bold transition-all flex items-center gap-3', bg)}
                            >
                              <span className={cn(
                                'w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black flex-shrink-0 transition-all',
                                answered && isCorrect ? 'bg-emerald-500 text-white' :
                                answered && isSelected && !isCorrect ? 'bg-red-500 text-white' :
                                isSelected && !answered ? 'bg-primary-500 text-white' :
                                'bg-white border-2 border-slate-200 text-slate-400'
                              )}>
                                {LETTERS[idx]}
                              </span>
                              <span className="flex-1 text-sm">{opt.text}</span>
                              {answered && isCorrect && <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />}
                              {answered && isSelected && !isCorrect && <X size={16} className="text-red-500 flex-shrink-0" />}
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      <AnimatePresence>
                        {answered && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              'p-4 rounded-2xl border text-sm font-medium',
                              currentQuestion.options?.find((o: any) => o.id === selectedAnswer)?.isCorrect
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : 'bg-red-50 border-red-100 text-red-700'
                            )}
                          >
                            <span className="font-black mr-1">
                              {currentQuestion.options?.find((o: any) => o.id === selectedAnswer)?.isCorrect ? '✅ Certo!' : '❌ Não foi dessa vez!'}
                            </span>
                            {currentQuestion.explanation}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Action buttons */}
                      <div className="flex gap-3 pt-1">
                        {!answered ? (
                          <button
                            disabled={!selectedAnswer}
                            onClick={handleSubmitAnswer}
                            className="flex-1 py-4 rounded-2xl bg-slate-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg hover:shadow-xl"
                          >
                            <Target size={16} /> Confirmar Resposta
                          </button>
                        ) : (
                          <button
                            onClick={handleNext}
                            className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-primary-500 to-indigo-600 text-white font-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg hover:shadow-primary-200 hover:shadow-xl"
                          >
                            {currentQuestionIndex < (activeActivity.questions?.length || 1) - 1 ? 'Próxima' : 'Ver Resultado'}
                            <ChevronRight size={17} />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* ── RESULT SCREEN ────────────────────────────────────── */
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-10 text-center space-y-7"
                  >
                    {/* Trophy */}
                    <div className="relative inline-block">
                      <div className="w-28 h-28 mx-auto bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-amber-200 ring-8 ring-amber-50">
                        <Trophy size={52} className="text-white" />
                      </div>
                      <div className="absolute -top-3 -right-3 w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <Sparkles size={18} className="text-white" />
                      </div>
                    </div>

                    <div>
                      <h2 className="text-3xl font-black text-slate-800">
                        {correctNow === totalQ ? '🏆 Perfeito!' : correctNow >= totalQ / 2 ? '🎉 Mandou Bem!' : '💪 Vai de novo!'}
                      </h2>
                      <p className="text-slate-500 font-medium mt-1 text-sm">
                        Você acertou {correctNow} de {totalQ} questões
                      </p>
                    </div>

                    {/* Score ring */}
                    <div className="flex items-center justify-center">
                      <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                          <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke={correctNow >= totalQ / 2 ? '#10b981' : '#ef4444'}
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 42}`}
                            strokeDashoffset={`${2 * Math.PI * 42 * (1 - correctNow / totalQ)}`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-black text-slate-800">
                            {Math.round((correctNow / totalQ) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* XP + Coins */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-primary-50 border-2 border-primary-100 rounded-[1.5rem] p-4">
                        <div className="text-primary-400 text-[9px] font-black uppercase tracking-widest mb-1">XP Ganho</div>
                        <div className="text-2xl font-black text-primary-700">
                          +{(correctNow * REWARDS.QUESTION_CORRECT_XP) + REWARDS.ACTIVITY_COMPLETE_XP + (correctNow === totalQ ? REWARDS.ACTIVITY_PERFECT_BONUS : 0)}
                        </div>
                      </div>
                      <div className="bg-amber-50 border-2 border-amber-100 rounded-[1.5rem] p-4">
                        <div className="text-amber-400 text-[9px] font-black uppercase tracking-widest mb-1">Moedas</div>
                        <div className="text-2xl font-black text-amber-600">
                          🪙 +{(correctNow * REWARDS.QUESTION_CORRECT_COINS) + REWARDS.ACTIVITY_COMPLETE_COINS}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={closeActivity}
                      className="w-full py-4 rounded-[1.5rem] bg-slate-900 hover:bg-black text-white font-black text-base transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                      <ArrowRight size={18} /> Continuar Jornada
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          ACTIVITY REVIEW MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {viewingResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Review header */}
              {(() => {
                const cfg = getSubjectConfig(viewingResult.activity.subject);
                const scorePercent = viewingResult.result.totalQuestions > 0
                  ? Math.round((viewingResult.result.score / viewingResult.result.totalQuestions) * 100) : 0;
                return (
                  <div className={cn('relative bg-gradient-to-br p-8 text-white overflow-hidden shrink-0', cfg.gradient)}>
                    <div className="absolute top-0 right-8 text-8xl opacity-10 select-none pointer-events-none">{cfg.emoji}</div>
                    <div className="absolute bottom-0 left-0 w-48 h-24 bg-black/10 rounded-tr-full blur-2xl" />

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <span className="bg-white/20 border border-white/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl">
                            {viewingResult.activity.subject}
                          </span>
                          <span className="bg-white/10 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl">
                            Revisão
                          </span>
                        </div>
                        <button onClick={() => setViewingResult(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/10">
                          <X size={18} />
                        </button>
                      </div>

                      <h2 className="text-2xl font-black leading-tight mb-3">{viewingResult.activity.title}</h2>

                      {/* ── Completion timestamp ─────────────────────────────── */}
                      {viewingResult.result.completedAt && (() => {
                        const completedDate = new Date(viewingResult.result.completedAt);
                        const now = new Date();
                        const diffMs = now.getTime() - completedDate.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMins / 60);
                        const diffDays = Math.floor(diffHours / 24);
                        const relativeLabel =
                          diffMins < 1 ? 'Agora mesmo' :
                          diffMins < 60 ? `Há ${diffMins} min` :
                          diffHours < 24 ? `Há ${diffHours}h` :
                          diffDays === 1 ? 'Ontem' :
                          `Há ${diffDays} dias`;
                        const formattedDate = completedDate.toLocaleString('pt-BR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });
                        const timeSpentSec = viewingResult.result.timeSpent || 0;
                        const tMins = Math.floor(timeSpentSec / 60);
                        const tSecs = timeSpentSec % 60;
                        const timeSpentLabel = tMins > 0 ? `${tMins}m ${tSecs}s` : `${tSecs}s`;
                        return (
                          <div className="flex flex-wrap items-center gap-2 mb-4">
                            <div className="flex items-center gap-1.5 bg-white/15 border border-white/20 backdrop-blur-sm px-3 py-1.5 rounded-xl" title={formattedDate}>
                              <CheckCircle size={12} className="text-emerald-300 flex-shrink-0" />
                              <span className="text-[11px] font-black text-white/90">{relativeLabel}</span>
                              <span className="text-[10px] text-white/50 font-medium">· {formattedDate}</span>
                            </div>
                            {timeSpentSec > 0 && (
                              <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl">
                                <Clock size={11} className="text-white/60 flex-shrink-0" />
                                <span className="text-[11px] font-black text-white/80">{timeSpentLabel}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
                          <div className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-0.5">Acertos</div>
                          <div className="text-xl font-black">{viewingResult.result.score}/{viewingResult.result.totalQuestions}</div>
                        </div>
                        <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
                          <div className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-0.5">Nota</div>
                          <div className={cn('text-xl font-black', scorePercent >= 70 ? 'text-emerald-300' : 'text-red-300')}>
                            {scorePercent}%
                          </div>
                        </div>
                        <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
                          <div className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-0.5">XP</div>
                          <div className="text-xl font-black text-amber-300">+{viewingResult.result.xpEarned}</div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* Review questions — scrollable */}
              <div className="overflow-y-auto flex-1 p-8 space-y-6">
                <h3 className="text-base font-black text-slate-700 flex items-center gap-2">
                  <Medal size={18} className="text-amber-500" /> Detalhes das Questões
                </h3>

                {viewingResult.activity.questions?.map((q: any, idx: number) => {
                  const studentResponse = viewingResult.result.responses?.find((r: any) => r.questionId === q.id);
                  const isCorrect = studentResponse?.isCorrect;

                  return (
                    <div key={q.id} className="bg-white border-2 border-slate-50 rounded-[1.5rem] overflow-hidden shadow-sm">
                      {/* Q header */}
                      <div className={cn('px-5 py-3 flex items-center gap-3 border-b', isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
                        <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black', isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white')}>
                          {idx + 1}
                        </span>
                        <p className={cn('font-bold text-sm flex-1 leading-snug', isCorrect ? 'text-emerald-800' : 'text-red-800')}>
                          {q.questionText}
                        </p>
                        {isCorrect
                          ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
                          : <X size={18} className="text-red-500 flex-shrink-0" />}
                      </div>

                      {/* Options */}
                      <div className="p-4 space-y-2">
                        {q.options?.map((opt: any) => {
                          const isChosen = studentResponse?.selectedOptionId === opt.id;
                          const isCorrOpt = opt.isCorrect;
                          let cls = 'bg-slate-50 border-slate-100 text-slate-500';
                          if (isCorrOpt) cls = 'bg-emerald-50 border-emerald-200 text-emerald-700';
                          else if (isChosen && !isCorrOpt) cls = 'bg-red-50 border-red-200 text-red-700';
                          return (
                            <div key={opt.id} className={cn('p-3 rounded-xl border-2 text-sm font-medium flex items-center justify-between', cls)}>
                              <span>{opt.text}</span>
                              <div className="flex items-center gap-1.5">
                                {isChosen && !isCorrOpt && (
                                  <span className="text-[9px] font-black uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Sua resposta</span>
                                )}
                                {isCorrOpt && (
                                  <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Correta</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      <div className="mx-4 mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                        <p className="text-xs text-indigo-700 leading-relaxed">
                          <span className="font-black mr-1">💡 Prof.:</span>
                          {isCorrect
                            ? (q.explanation || 'Excelente! Continue assim.')
                            : <>Não desanime! {q.explanation && <span className="block mt-1 opacity-75">{q.explanation}</span>}</>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Review footer */}
              <div className="p-6 border-t border-slate-100 shrink-0">
                <button
                  onClick={() => setViewingResult(null)}
                  className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} /> Voltar às Atividades
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
