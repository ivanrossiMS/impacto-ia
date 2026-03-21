import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Generic Supabase query hook with real-time subscription.
 *
 * IMPROVEMENTS over the original:
 * 1. debounce on realtime events (300ms) — prevents rapid avalanche of re-fetches
 * 2. proper cleanup of both channel and timer
 * 3. isMounted guard to skip setState after unmount
 */
export function useSupabaseQuery<T>(table: string, dependencies: any[] = []): T[] {
  const [data, setData] = useState<T[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      let query = supabase.from(table).select('*');
      
      const tablesWithCreatedAt = ['users', 'classes', 'activities', 'support_tickets', 'notifications', 'avatar_catalog', 'gamification_stats', 'student_activity_results'];
      if (tablesWithCreatedAt.includes(table)) {
        query = query.order('createdAt', { ascending: false });
      }

      const { data: result, error } = await query;
      if (!error && result && isMounted) {
        setData(result as T[]);
      } else if (error) {
        console.error(`Supabase fetch error for ${table}:`, error);
      }
    };

    // Debounced refetch to avoid hammering the DB on rapid events
    const debouncedFetch = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        if (isMounted) fetchData();
      }, 300);
    };

    fetchData();

    const sub = supabase
      .channel(`${table}_all_changes_v2`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, debouncedFetch)
      .subscribe();

    return () => {
      isMounted = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(sub);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return data;
}
