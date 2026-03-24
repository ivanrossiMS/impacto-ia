// ============================================================
// duelScoring.ts — Single source of truth for duel scoring
// Layered formula: base + speed bonus + streak bonus × combo
// ============================================================

import type { DuelAnswerData, DuelPowerType } from '../types/duel';

// ─── Constants ────────────────────────────────────────────────
export const TIME_PER_QUESTION      = 30;
export const ACCELERATION_TIME_MULT = 0.80;   // kept for legacy compat
export const INITIAL_ENERGY         = 0;       // players start with 0 energy
export const MAX_ENERGY             = 5;

/** Energy cost per power — each power has its own cost */
export const POWER_COSTS: Record<string, number> = {
  shield:   1,
  freeze:   2,
  turbo:    3,
  eliminate: 3,
  swap:     3,
};

/** Legacy flat-cost export — kept so any remaining references compile */
export const POWER_ENERGY_COST = 2;

export function getMaxPowerUses(questionCount: number): number {
  return questionCount <= 5 ? 2 : 3;
}

// ─── Speed bonus ──────────────────────────────────────────────
export function calcSpeedBonus(timeUsed: number): number {
  if (timeUsed <= 5)  return 40;
  if (timeUsed <= 10) return 25;
  if (timeUsed <= 15) return 10;
  return 0;
}

// ─── Streak bonus (added after combo multiplication) ──────────
export function calcStreakBonus(streak: number): number {
  if (streak >= 5) return 40;
  if (streak >= 3) return 20;
  if (streak >= 2) return 10;
  return 0;
}

// ─── Combo multiplier (applied to base 100 pts) ───────────────
export function calcComboMultiplier(streak: number): number {
  if (streak >= 7) return 1.3;
  if (streak >= 5) return 1.2;
  if (streak >= 3) return 1.1;
  return 1.0;
}

// ─── Per-question score ───────────────────────────────────────
export interface QuestionScoreResult {
  points: number;
  speedBonus: number;
  streakBonus: number;
  comboMultiplier: number;
  newStreak: number;
}

export function calcQuestionScore(params: {
  isCorrect: boolean;
  timeUsed: number;
  streakBefore: number;     // streak BEFORE this answer
  shieldAbsorbed?: boolean; // shield consumed a wrong answer
  wasSkipped: boolean;      // timed out without answering
}): QuestionScoreResult {
  const { isCorrect, timeUsed, streakBefore, shieldAbsorbed, wasSkipped } = params;

  if (wasSkipped) {
    return { points: 0, speedBonus: 0, streakBonus: 0, comboMultiplier: 1, newStreak: 0 };
  }

  // Streak: increments on correct OR shield-absorbed wrong answer
  const effectivelyCorrect = isCorrect || !!shieldAbsorbed;
  const newStreak = effectivelyCorrect ? streakBefore + 1 : 0;

  if (!isCorrect) {
    // Wrong (even if shield absorbed) → 0 points but streak maintained
    return { points: 0, speedBonus: 0, streakBonus: 0, comboMultiplier: 1, newStreak };
  }

  const speedBonus  = calcSpeedBonus(timeUsed);
  const comboMult   = calcComboMultiplier(newStreak);
  const streakBonus = calcStreakBonus(newStreak);
  const points      = Math.round((100 * comboMult) + speedBonus + streakBonus);

  return { points, speedBonus, streakBonus, comboMultiplier: comboMult, newStreak };
}

// ─── Energy recovery per correct answer ───────────────────────
/** Base energy gain per correct answer. Caller multiplies by 2 if Turbo active. */
export function calcEnergyGain(newStreak: number): number {
  return newStreak >= 2 ? 2 : 1;
}

// ─── Aggregated totals from full answer log ───────────────────
export interface DuelTotals {
  totalPoints: number;
  correctCount: number;
  accuracy: number;       // 0-100
  avgTimeUsed: number;    // seconds
  maxStreak: number;
  powersUsed: DuelPowerType[];
}

export function calcTotalDetailed(data: DuelAnswerData[]): DuelTotals {
  if (!data.length) return { totalPoints: 0, correctCount: 0, accuracy: 0, avgTimeUsed: 0, maxStreak: 0, powersUsed: [] };

  const totalPoints  = data.reduce((s, d) => s + d.pointsEarned, 0);
  const correctCount = data.filter(d => d.isCorrect).length;
  const accuracy     = Math.round((correctCount / data.length) * 100);
  const avgTimeUsed  = Math.round(data.reduce((s, d) => s + d.timeUsed, 0) / data.length);

  let maxStreak = 0, cur = 0;
  for (const d of data) {
    if (d.isCorrect || d.shieldActivated) { cur++; maxStreak = Math.max(maxStreak, cur); }
    else { cur = 0; }
  }

  const powersUsed: DuelPowerType[] = data
    .filter(d => !!d.powerUsed)
    .map(d => d.powerUsed!);

  return { totalPoints, correctCount, accuracy, avgTimeUsed, maxStreak, powersUsed };
}
