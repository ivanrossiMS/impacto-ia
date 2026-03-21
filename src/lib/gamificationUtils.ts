import { supabase } from './supabase';

/**
 * Gamification Utilities
 * Centralizes leveling logic and reward constants.
 */

/**
 * Calculates current level based on total XP.
 */
export function calculateLevel(xp: number): number {
  if (xp < 100) return 1;
  // Solving 50L^2 - 50L - XP = 0 for L
  // L = (50 + sqrt(2500 + 200*XP)) / 100
  const level = Math.floor((50 + Math.sqrt(2500 + 200 * xp)) / 100);
  return Math.max(1, level);
}

/**
 * Gets total XP required to reach a specific level.
 */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * level * (level - 1);
}

/**
 * Gets progress information for current XP within its level.
 */
export function getLevelProgress(xp: number) {
  const currentLevel = calculateLevel(xp);
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForLevel(currentLevel + 1);
  
  const progressXP = Math.max(0, xp - xpForCurrentLevel);
  const totalNeededForNext = xpForNextLevel - xpForCurrentLevel;
  const percentage = Math.min(Math.round((progressXP / totalNeededForNext) * 100), 100);

  return {
    level: currentLevel,
    xpInLevel: progressXP,
    xpNextLevel: totalNeededForNext,
    totalXPNext: xpForNextLevel,
    percentage
  };
}

/**
 * Calculates the new streak value based on student activity.
 */
export function calculateNewStreak(currentStreak: number, lastStudyDateStr: string | undefined): number {
  if (!lastStudyDateStr) {
    console.log('[Streak] No last study date, returning 1');
    return 1;
  }
  
  const now = new Date();
  const lastDate = new Date(lastStudyDateStr);

  // Normalize to local midnight for comparison
  const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d2 = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  
  const diffTime = d1.getTime() - d2.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  console.log(`[Streak] Current: ${currentStreak}, Last: ${lastStudyDateStr}, DiffDays: ${diffDays}`);

  if (diffDays === 0) {
    // Already studied today, keep current streak (min 1)
    return Math.max(1, currentStreak);
  } else if (diffDays === 1) {
    // Yesterday was the last study day, increment streak
    return currentStreak + 1;
  } else {
    // Gap larger than 1 day or weird clock jump, reset to 1
    return 1;
  }
}

/**
 * Centrally updates gamification stats (XP, Coins, Level, Streak)
 */
export async function updateGamificationStats(
  studentId: string, 
  updates: { xpToAdd?: number; coinsToAdd?: number }
): Promise<{ newLevel: number, oldLevel: number } | void> {
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
      const newXP = (stats.xp || 0) + (updates.xpToAdd || 0);
      const newCoins = (stats.coins || 0) + (updates.coinsToAdd || 0);
      const newLevel = calculateLevel(newXP);
      const newStreak = calculateNewStreak(stats.streak || 0, stats.lastStudyDate);

      const oldLevel = stats.level || 1;

      const { error: updateError } = await supabase
        .from('gamification_stats')
        .update({
          xp: newXP,
          coins: newCoins,
          level: newLevel,
          streak: newStreak,
          lastStudyDate: nowString,
          updatedAt: nowString
        })
        .eq('id', studentId);
        
      if (updateError) throw updateError;
      console.log(`[Stats] Updated student ${studentId}: Streak ${newStreak}, XP ${newXP}`);
      return { newLevel, oldLevel };
    } else {
      const startingXP = updates.xpToAdd || 0;
      const startingLevel = calculateLevel(startingXP);
      
      const { error: insertError } = await supabase
        .from('gamification_stats')
        .insert({
          id: studentId,
          xp: startingXP,
          coins: updates.coinsToAdd || 500, // Matching initial user seeds
          level: startingLevel,
          streak: 1,
          lastStudyDate: nowString,
          updatedAt: nowString
        });
        
      if (insertError) throw insertError;
      console.log(`[Stats] Initialized student ${studentId}: Streak 1`);
      return { newLevel: startingLevel, oldLevel: 1 };
    }
  } catch (error) {
    console.error('Error updating gamification stats:', error);
  }
}

/**
 * Enhanced Rewards Constants
 * Increased to be more attractive and "gamified".
 */
export const REWARDS = {
  // Activity Rewards
  ACTIVITY_COMPLETE_XP: 150,    // Bonus for finishing
  QUESTION_CORRECT_XP: 30,      // Per question
  ACTIVITY_PERFECT_BONUS: 100,  // Bonus for 100% correct
  
  // Coin Rewards
  QUESTION_CORRECT_COINS: 15,
  ACTIVITY_COMPLETE_COINS: 50,
  
  // Interaction Rewards
  TUTOR_QUESTION_XP: 10,
  LIBRARY_STUDY_XP: 25,
  DIARY_ENTRY_XP: 40,
  
  // Duel Rewards
  DUEL_WIN_XP: 100,
  DUEL_DRAW_XP: 40,
  DUEL_LOSS_XP: 15,
  DUEL_QUESTION_XP: 20
};
