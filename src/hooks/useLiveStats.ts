/**
 * useLiveStats — Reactive hook for student gamification stats.
 *
 * Uses Dexie's useLiveQuery to automatically re-render whenever
 * the local IndexedDB is updated by the SyncEngine (which listens
 * to Supabase Realtime). No manual fetching or polling needed.
 *
 * Usage:
 *   const stats = useLiveStats(user.id);
 *   // stats.xp, stats.coins, stats.level — always fresh, no refresh
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/dexie';
import type { GamificationStats } from '../types/gamification';

export function useLiveStats(studentId: string | undefined): GamificationStats | undefined {
  return useLiveQuery(
    () => studentId ? db.gamificationStats.get(studentId) : undefined,
    [studentId]
  );
}

/**
 * useLiveAchievements — Reactive hook for student achievements.
 * Automatically updates when a new achievement is unlocked.
 */
export function useLiveAchievements(studentId: string | undefined) {
  return useLiveQuery(
    () => studentId
      ? db.studentAchievements.where('studentId' as any).equals(studentId).toArray()
      : [],
    [studentId],
    []
  );
}

/**
 * useLiveMissions — Reactive hook for student mission progress.
 */
export function useLiveMissions(studentId: string | undefined) {
  return useLiveQuery(
    () => studentId
      ? db.studentMissions.where('studentId' as any).equals(studentId).toArray()
      : [],
    [studentId],
    []
  );
}

/**
 * useLiveNotifications — Reactive hook for unread notification count.
 */
export function useLiveUnreadCount(userId: string | undefined): number {
  const count = useLiveQuery(
    () => userId
      ? db.notifications.where('userId').equals(userId).and(n => !n.read).count()
      : 0,
    [userId],
    0
  );
  return count ?? 0;
}
