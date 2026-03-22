import { supabase } from './supabase';
import { createNotification } from './notificationUtils';
import { useGamificationStore } from '../store/gamification.store';

/**
 * Gamification Utilities — IMPACTO-IA
 * Rebalanced v2: Power-curve leveling, richer rewards, streak bonuses.
 */

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL CURVE  (Power Curve 1.8 — fast early, slow late)
// Formula: XP needed to START level L = round(80 * (L-1)^1.8)
//
// L2  →   80 XP  │ L5  →  ~916 XP  │ L10 → ~3,637 XP
// L20 → ~13,500  │ L30 → ~31,000   │ L50 → ~84,000
// ─────────────────────────────────────────────────────────────────────────────

export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(80 * Math.pow(level - 1, 1.8));
}

export function calculateLevel(xp: number): number {
  if (xp <= 0) return 1;
  let level = 1;
  while (getXPForLevel(level + 1) <= xp) {
    level++;
    if (level >= 200) break; // safety cap
  }
  return level;
}

export function getLevelProgress(xp: number) {
  const currentLevel = calculateLevel(xp);
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForLevel(currentLevel + 1);

  const progressXP = Math.max(0, xp - xpForCurrentLevel);
  const totalNeededForNext = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  const percentage = Math.min(Math.round((progressXP / totalNeededForNext) * 100), 100);

  return {
    level: currentLevel,
    xpInLevel: progressXP,
    xpNextLevel: totalNeededForNext,
    totalXPNext: xpForNextLevel,
    percentage,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAK BONUS TABLE
// Additional XP & Coins awarded on top of daily login reward based on streak.
// ─────────────────────────────────────────────────────────────────────────────
export const STREAK_BONUSES: { minDays: number; xp: number; coins: number; label: string }[] = [
  { minDays: 30, xp: 100, coins: 80,  label: '🏆 Mestre da Consistência' },
  { minDays: 14, xp:  60, coins: 50,  label: '💎 Duas Semanas Invicto'   },
  { minDays:  7, xp:  40, coins: 30,  label: '🔥 Uma Semana Consecutiva' },
  { minDays:  3, xp:  20, coins: 15,  label: '⚡ Sequência em Alta'       },
];

export function getStreakBonus(streak: number): { xp: number; coins: number; label: string } | null {
  for (const tier of STREAK_BONUSES) {
    if (streak >= tier.minDays) return tier;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAK — calculate new streak value
// ─────────────────────────────────────────────────────────────────────────────
export function calculateNewStreak(currentStreak: number, lastStudyDateStr: string | undefined): number {
  if (!lastStudyDateStr) return 1;

  const now = new Date();
  const lastDate = new Date(lastStudyDateStr);

  const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d2 = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

  const diffDays = Math.round((d1.getTime() - d2.getTime()) / 86400000);

  if (diffDays === 0)  return Math.max(1, currentStreak);
  if (diffDays === 1)  return currentStreak + 1;
  return 1; // streak broken
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL STATS UPDATER
// ─────────────────────────────────────────────────────────────────────────────
export async function updateGamificationStats(
  studentId: string,
  updates: { xpToAdd?: number; coinsToAdd?: number; applyStreakBonus?: boolean }
): Promise<{ newLevel: number; oldLevel: number } | void> {
  if (!studentId) return;

  const nowString = new Date().toISOString();

  try {
    const { data: stats, error: fetchError } = await supabase
      .from('gamification_stats')
      .select('*')
      .eq('id', studentId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching gamification stats:', fetchError);
      return;
    }

    if (stats) {
      const newStreak     = calculateNewStreak(stats.streak || 0, stats.lastStudyDate);
      const streakChanged = newStreak !== (stats.streak || 0);

      // Streak bonus (awarded once per day when streak increments)
      let streakXp    = 0;
      let streakCoins = 0;
      if (updates.applyStreakBonus && streakChanged && newStreak > 1) {
        const bonus = getStreakBonus(newStreak);
        if (bonus) { streakXp = bonus.xp; streakCoins = bonus.coins; }
      }

      const newXP    = (stats.xp    || 0) + (updates.xpToAdd    || 0) + streakXp;
      const newCoins = (stats.coins || 0) + (updates.coinsToAdd || 0) + streakCoins;
      const newLevel = calculateLevel(newXP);
      const oldLevel = stats.level || 1;

      // ✅ INSTANT: Push to Zustand store before DB call → top bar reacts immediately
      useGamificationStore.getState().setStats({
        xp: newXP, coins: newCoins, level: newLevel, streak: newStreak
      });

      const { error: updateError } = await supabase
        .from('gamification_stats')
        .update({
          xp: newXP, coins: newCoins, level: newLevel,
          streak: newStreak, lastStudyDate: nowString, updatedAt: nowString
        })
        .eq('id', studentId);

      if (updateError) throw updateError;

      if (newLevel > oldLevel) {
        await createNotification({
          userId: studentId, role: 'student',
          title: `🚀 Nível ${newLevel} Desbloqueado!`,
          message: `Incrível! Você evoluiu de Nível ${oldLevel} para Nível ${newLevel}. Continue assim!`,
          type: 'reward', priority: 'high'
        });
      }

      return { newLevel, oldLevel };

    } else {
      // First-time insert
      const startingXP    = updates.xpToAdd    || 0;
      const startingCoins = updates.coinsToAdd || REWARDS.FIRST_LOGIN_COINS;
      const startingLevel = calculateLevel(startingXP);

      useGamificationStore.getState().setStats({
        xp: startingXP, coins: startingCoins, level: startingLevel, streak: 1
      });

      const { error: insertError } = await supabase
        .from('gamification_stats')
        .insert({
          id: studentId, xp: startingXP, coins: startingCoins,
          level: startingLevel, streak: 1,
          lastStudyDate: nowString, updatedAt: nowString
        });

      if (insertError) throw insertError;

      return { newLevel: startingLevel, oldLevel: 1 };
    }
  } catch (error) {
    console.error('Error updating gamification stats:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REWARDS CONSTANTS  (Rebalanced v2)
// ─────────────────────────────────────────────────────────────────────────────
export const REWARDS = {
  // ── Activities ──────────────────────────────────────────────────────────────
  ACTIVITY_COMPLETE_XP:      200,   // +33% vs old 150 — completing an activity is meaningful
  QUESTION_CORRECT_XP:        50,   // +67% vs old 30 — every correct answer feels rewarding
  ACTIVITY_PERFECT_BONUS:    150,   // +50% vs old 100 — perfection deserves premium reward
  QUESTION_CORRECT_COINS:     10,   // ≈old 15 but slightly reduced to control inflation
  ACTIVITY_COMPLETE_COINS:    40,   // ≈old 50 slightly reduced to keep coins valuable
  ACTIVITY_PERFECT_COINS:     50,   // NEW — bonus coins for perfect score

  // ── Daily Login & Streak ─────────────────────────────────────────────────────
  DAILY_LOGIN_XP:             30,   // NEW — base XP for showing up each day
  DAILY_LOGIN_COINS:          15,   // NEW — small coin reward for daily presence
  FIRST_LOGIN_COINS:         200,   // Welcome bonus for new students

  // ── Tutor IA ────────────────────────────────────────────────────────────────
  TUTOR_QUESTION_XP:          25,   // 2.5× vs old 10 — using AI tutor has educational value
  TUTOR_QUESTION_COINS:        5,   // NEW — small incentive to use tutor

  // ── Content engagement ────────────────────────────────────────────────────────
  LIBRARY_STUDY_XP:           30,   // slight bump over old 25
  DIARY_ENTRY_XP:             50,   // slight bump over old 40
  DIARY_ENTRY_COINS:          10,   // NEW — reflection deserves a reward

  // ── Duels (base — final values come from calcDuelRewards) ────────────────────
  DUEL_WIN_XP:               120,   // Reference only; actual = calcDuelRewards output
  DUEL_DRAW_XP:               60,
  DUEL_LOSS_XP:               30,
  DUEL_QUESTION_XP:           25,   // per correct answer in duel
} as const;
