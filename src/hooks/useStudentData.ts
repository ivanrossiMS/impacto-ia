import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface StudentDataResult {
  stats: {
    xp: number;
    coins: number;
    streak: number;
    level: number;
  } | null;
  unreadCount: number;
  unreadSupportCount: number;
  refresh: () => void;
}

/**
 * Hook for the student topbar indicators.
 * Reads directly from Supabase with realtime subscriptions for guaranteed accuracy.
 * Each individual user's gamification data changes frequently and must be fresh.
 */
export function useStudentData(userId: string | undefined): StudentDataResult {
  const [stats, setStats] = useState<StudentDataResult['stats']>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    // Run all queries in PARALLEL
    const [statsResult, notifResult, supportResult] = await Promise.all([
      supabase.from('gamification_stats').select('xp, coins, streak, level').eq('id', userId).single(),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('userId', userId).eq('read', false),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('userId', userId).eq('isReadByParticipant', false),
    ]);

    if (statsResult.data) {
      setStats({
        xp: statsResult.data.xp ?? 0,
        coins: statsResult.data.coins ?? 0,
        streak: statsResult.data.streak ?? 0,
        level: statsResult.data.level ?? 1,
      });
    }

    setUnreadCount(notifResult.count ?? 0);
    setUnreadSupportCount(supportResult.count ?? 0);
  }, [userId]);

  const debouncedFetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchData, 200);
  }, [fetchData]);

  useEffect(() => {
    if (!userId) return;

    fetchData();

    const channel = supabase
      .channel(`student_topbar_${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'gamification_stats',
        filter: `id=eq.${userId}`,
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `userId=eq.${userId}`,
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'support_tickets',
        filter: `userId=eq.${userId}`,
      }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData, debouncedFetch]);

  return { stats, unreadCount, unreadSupportCount, refresh: fetchData };
}
