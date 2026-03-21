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
 * Centralized hook for the student topbar indicators.
 * 
 * KEY IMPROVEMENTS over the old fetchLayoutData pattern:
 * 1. Uses a SINGLE debounced fetch instead of multiple calls
 * 2. Queries run in PARALLEL via Promise.all (not sequentially)
 * 3. A single Supabase channel covers all 3 relevant tables
 * 4. 300ms debounce prevents avalanche of re-fetches on rapid DB events
 */
export function useStudentData(userId: string | undefined): StudentDataResult {
  const [stats, setStats] = useState<StudentDataResult['stats']>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

  // Use a ref to hold the debounce timer so it persists across renders
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    // Run all 3 queries in PARALLEL — not sequentially!
    const [statsResult, notifResult, supportResult] = await Promise.all([
      supabase.from('gamification_stats').select('xp, coins, streak, level').eq('id', userId).single(),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('userId', userId).eq('read', false),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('userId', userId).eq('isReadByParticipant', false),
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

  // Debounced version: prevents multiple rapid refetches from consecutive DB events
  const debouncedFetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchData();
    }, 300);
  }, [fetchData]);

  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchData();

    // Single channel watching all 3 relevant tables
    const channel = supabase
      .channel(`student_topbar_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gamification_stats',
        filter: `id=eq.${userId}`,
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `userId=eq.${userId}`,
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_tickets',
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
