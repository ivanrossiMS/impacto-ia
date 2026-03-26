/**
 * Question Bank Service — v2 (AI Overhaul)
 * - DB-first question selection with 100-question history per student
 * - Accuracy tracking for adaptive difficulty
 * - Anti-repetition: no question repeats within 10 matches
 */
import { supabase } from '../lib/supabase';

export interface BankQuestion {
  id: string;
  theme: string;
  subtopic?: string;
  grade_min: number;
  grade_max: number;
  difficulty: string;
  question_text: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation?: string;
  tags?: string[];
  quality_score: number;
  usage_count: number;
}

/** Convert a grade string like "6º Ano" or "2EM" to a year integer (1-12). */
export function gradeToYear(grade: string): number {
  const g = (grade || '').toLowerCase();
  const isEM = g.includes('em') || g.includes('médio') || g.includes('medio');
  const m = g.match(/(\d+)/);
  const y = m ? parseInt(m[1]) : 6;
  return isEM ? y + 9 : y;
}

/**
 * Fetch questions from the bank for a duel.
 * ─ Excludes questions seen in the last 100 entries (≈ 10 full matches).
 * ─ Returns least-used first (rotating the bank evenly).
 */
export async function getQuestionsForDuel(
  theme: string,
  gradeYear: number,
  difficulty: string,
  studentId: string,
  count: number
): Promise<BankQuestion[]> {
  // 1. Get the last 100 question IDs the student has seen (any theme)
  //    This equates to ≈ 10 full 9-question matches
  const { data: history } = await supabase
    .from('student_question_history')
    .select('question_id')
    .eq('student_id', studentId)
    .eq('theme', theme)
    .order('seen_at', { ascending: false })
    .limit(100); // expanded from count*10 → fixed 100

  const seenIds = (history || []).map((r: any) => r.question_id);

  // 2. Query bank: matching theme + grade range + difficulty, excluding seen
  let query = supabase
    .from('question_bank')
    .select('*')
    .eq('theme', theme)
    .eq('difficulty', difficulty)
    .eq('is_active', true)
    .lte('grade_min', gradeYear)
    .gte('grade_max', gradeYear)
    .order('usage_count', { ascending: true }) // least-used first
    .limit(count);

  if (seenIds.length > 0) {
    query = query.not('id', 'in', `(${seenIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[QuestionBank] Failed to fetch questions:', error.message);
    return [];
  }

  return (data || []) as BankQuestion[];
}

/**
 * Save new AI-generated questions to the master bank.
 * Deduplicates by question_text (exact match guard via upsert).
 */
export async function saveQuestionsToBank(
  questions: Array<{
    questionText: string;
    options: any[];
    explanation?: string;
  }>,
  theme: string,
  gradeYear: number,
  difficulty: string
): Promise<string[]> {
  if (!questions.length) return [];

  const rows = questions.map(q => ({
    theme,
    grade_min: Math.max(1, gradeYear - 1),
    grade_max: Math.min(12, gradeYear + 1),
    difficulty,
    question_text: q.questionText,
    options: q.options,
    explanation: q.explanation || '',
    origin: 'ai',
    quality_score: 0.8,
    usage_count: 0,
  }));

  const { data, error } = await supabase
    .from('question_bank')
    .upsert(rows, { onConflict: 'question_text', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.warn('[QuestionBank] Failed to save questions:', error.message);
    return [];
  }

  return (data || []).map((r: any) => r.id);
}

/**
 * Record that a student has seen these question IDs in a given match.
 * Optionally records whether each was answered correctly (for adaptive difficulty).
 */
export async function recordQuestionsSeen(
  studentId: string,
  questionIds: string[],
  theme: string,
  matchId: string,
  correctIds?: string[]  // IDs the student answered correctly
): Promise<void> {
  if (!questionIds.length) return;

  const correctSet = new Set(correctIds || []);
  const rows = questionIds.map(question_id => ({
    student_id: studentId,
    question_id,
    theme,
    match_id: matchId,
    was_correct: correctIds ? correctSet.has(question_id) : null,
  }));

  await supabase
    .from('student_question_history')
    .upsert(rows, { onConflict: 'student_id,question_id', ignoreDuplicates: true });
}

/**
 * Get a student's accuracy rate for the last N questions answered.
 * Returns a value between 0.0 (all wrong) and 1.0 (all correct).
 * Returns 0.5 (default neutral) when no history exists.
 *
 * Used by the adaptive difficulty system before duel generation.
 */
export async function getStudentAccuracy(
  studentId: string,
  lastN = 20
): Promise<number> {
  // Try dedicated RPC if it exists (requires ai_overhaul_migration.sql)
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('get_student_accuracy', { p_student_id: studentId, p_last_n: lastN });

  if (!rpcError && rpcResult !== null) {
    return Number(rpcResult);
  }

  // Fallback: manual query
  const { data } = await supabase
    .from('student_question_history')
    .select('was_correct')
    .eq('student_id', studentId)
    .not('was_correct', 'is', null)
    .order('seen_at', { ascending: false })
    .limit(lastN);

  if (!data || data.length === 0) return 0.5;

  const correct = (data as any[]).filter(r => r.was_correct === true).length;
  return correct / data.length;
}

/**
 * Compute adaptive difficulty adjustment based on student accuracy.
 * Returns: 'lower' | 'same' | 'higher'
 *
 * Rules:
 * - accuracy < 0.35 → lower difficulty 1 level
 * - accuracy > 0.80 → raise difficulty 1 level
 * - else → keep configured difficulty
 */
export function computeAdaptiveDifficulty(
  baseDifficulty: string,
  accuracy: number
): string {
  const levels = ['easy', 'medium', 'hard'];
  const idx = levels.indexOf(baseDifficulty) !== -1
    ? levels.indexOf(baseDifficulty)
    : 1; // default medium

  if (accuracy < 0.35 && idx > 0) return levels[idx - 1]; // lower
  if (accuracy > 0.80 && idx < 2) return levels[idx + 1]; // higher
  return baseDifficulty; // same
}

/**
 * Increment usage_count for questions that were used in a match.
 */
export async function incrementQuestionUsage(questionIds: string[]): Promise<void> {
  if (!questionIds.length) return;
  // Fire-and-forget for performance
  Promise.all(
    questionIds.map(id =>
      Promise.resolve(supabase.rpc('increment_question_usage', { question_id: id })).catch(() => {})
    )
  );
}

/**
 * Log an AI call for observability.
 */
export async function logAICall(params: {
  feature: string;
  model: string;
  responseMs: number;
  cacheHit: boolean;
  success: boolean;
  errorMsg?: string;
  userId?: string;
}): Promise<void> {
  try {
    await supabase.from('ai_call_logs').insert({
      feature: params.feature,
      model: params.model,
      response_ms: params.responseMs,
      cache_hit: params.cacheHit,
      success: params.success,
      error_msg: params.errorMsg,
      user_id: params.userId,
    });
  } catch { /* fire-and-forget, never block on logging */ }
}
