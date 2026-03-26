import { supabase } from './supabase';
import { createNotification } from './notificationUtils';
import { useGamificationStore } from '../store/gamification.store';

/**
 * Gamification Utilities — IMPACTO-IA
 * Rebalanced v5: 100% easier — parabolic level curve + doubled rewards.
 * Level curve: 40 × (L-1)²  →  L1-30 muito rápido, L31-100 progressivo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL CURVE  (Quadratic / Parabola) — FAST EARLY, PROGRESSIVELY HARDER
// Formula: XP to reach level L = round(40 × (L-1)²)
//
// Typical rates: Casual ~500 XP/day | Médio ~1.400 XP/day | Ativo ~3.000 XP/day
//
// Level │ XP Total  │ Casual (500/d) │ Médio (1400/d) │ Ativo (3000/d)
// ──────┼───────────┼────────────────┼────────────────┼───────────────
// L 5   │     640   │   1.3 dias     │  < 1 dia       │  < 1 dia
// L10   │   3.240   │   6.5 dias     │  2.3 dias      │  1.1 dia
// L15   │   7.840   │  15.7 dias     │  5.6 dias      │  2.6 dias
// L20   │  14.440   │  29 dias       │  10 dias       │  4.8 dias
// L30   │  33.640   │  67 dias       │  24 dias       │  11 dias
// L50   │  96.040   │  6.4 meses     │  69 dias       │  32 dias
// L75   │ 219.040   │  1.5 anos      │  5.2 meses     │  2.4 meses
// L100  │ 392.040   │  2.6 anos      │  9.3 meses     │  4.4 meses
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_LEVEL = 100;

export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return getXPForLevel(MAX_LEVEL);
  return Math.round(40 * Math.pow(level - 1, 2));  // pure quadratic — fast early, hard late
}

export function calculateLevel(xp: number): number {
  if (xp <= 0) return 1;
  let level = 1;
  while (getXPForLevel(level + 1) <= xp) {
    level++;
    if (level >= MAX_LEVEL) break;
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
// STREAK BONUS TABLE  (v5 — doubled vs v4)
// ─────────────────────────────────────────────────────────────────────────────
export const STREAK_BONUSES: { minDays: number; xp: number; coins: number; label: string }[] = [
  { minDays: 30, xp: 360, coins: 180, label: '🏆 Mestre da Consistência' },
  { minDays: 14, xp: 240, coins: 120, label: '💎 Duas Semanas Invicto'   },
  { minDays:  7, xp: 150, coins:  75, label: '🔥 Uma Semana Consecutiva' },
  { minDays:  3, xp:  76, coins:  36, label: '⚡ Sequência em Alta'       },
  { minDays:  1, xp:  20, coins:  10, label: '🌱 Mantendo o Ritmo'       },
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

      let streakXp    = 0;
      let streakCoins = 0;
      if (updates.applyStreakBonus && streakChanged) {
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
// REWARDS CONSTANTS  (Rebalanced v5 — 100% easier, front-loaded progression)
// ─────────────────────────────────────────────────────────────────────────────
export const REWARDS = {
  // ── Activities ──────────────────────────────────────────────────────────────
  ACTIVITY_COMPLETE_XP:      240,   // v4 120 × 2 = 240
  QUESTION_CORRECT_XP:        44,   // v4  22 × 2 = 44
  ACTIVITY_PERFECT_BONUS:    180,   // v4  90 × 2 = 180 — perfection is celebrated
  QUESTION_CORRECT_COINS:     10,   // v4   5 × 2 = 10
  ACTIVITY_COMPLETE_COINS:    60,   // v4  30 × 2 = 60
  ACTIVITY_PERFECT_COINS:     60,   // v4  30 × 2 = 60

  // ── Daily Login & Streak ─────────────────────────────────────────────────────
  DAILY_LOGIN_XP:             60,   // v4  30 × 2 = 60
  DAILY_LOGIN_COINS:          25,   // v4  15 × 1.7 ≈ 25
  FIRST_LOGIN_COINS:         200,   // Welcome bonus for new students

  // ── Tutor IA ────────────────────────────────────────────────────────────────
  TUTOR_QUESTION_XP:          60,   // v4  30 × 2 = 60
  TUTOR_QUESTION_COINS:       12,   // v4   6 × 2 = 12
  TUTOR_DAILY_LIMIT:          15,   // cap: 15 questions rewarded/day

  // ── Content engagement ────────────────────────────────────────────────────────
  LIBRARY_STUDY_XP:           50,   // v4  30 × 1.7 ≈ 50
  DIARY_ENTRY_XP:             90,   // v4  45 × 2 = 90
  DIARY_ENTRY_COINS:          24,   // v4  12 × 2 = 24
  DIARY_DAILY_LIMIT:           5,   // cap: 5 diary entries rewarded/day

  // ── Solo Duel daily cap ──────────────────────────────────────────────────────
  DUEL_SOLO_DAILY_LIMIT:      15,   // cap: 15 solo duels rewarded/day

  // ── Duels (reference only — calcDuelRewards is the source of truth) ──────────
  DUEL_WIN_XP:               156,   // v4 120 × 1.3 = 156
  DUEL_DRAW_XP:               88,   // v4  68 × 1.3 = 88
  DUEL_LOSS_XP:               49,   // v4  38 × 1.3 = 49
  DUEL_QUESTION_XP:           35,   // v4  27 × 1.3 = 35
} as const;
