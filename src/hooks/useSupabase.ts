import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseQuery<T>(table: string, dependencies: any[] = []): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    let sub: any;
    let isMounted = true;

    const fetchData = async () => {
      // Basic fetch, can be extended for complex queries if needed
      let query = supabase.from(table).select('*');
      
      // Only order by createdAt for tables that we know have it, or avoid default ordering
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

    fetchData();

    sub = supabase
      .channel(`${table}_all_changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        // Simple reactivity: refetch on any table change
        fetchData();
      })
      .subscribe();

    return () => {
      isMounted = false;
      if (sub) supabase.removeChannel(sub);
    };
  }, dependencies);

  return data;
}
