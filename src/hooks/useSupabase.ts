import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/dexie';
import { supabase } from '../lib/supabase';

// Map Supabase table names to Dexie collection names (they differ in some cases like snake_case vs camelCase)
const TABLE_MAP: Record<string, keyof typeof db> = {
  'users': 'users',
  'schools': 'schools',
  'classes': 'classes',
  'avatar_catalog': 'avatarCatalog',
  'student_owned_avatars': 'studentOwnedAvatars',
  'student_avatar_profiles': 'studentAvatarProfiles',
  'avatar_collections': 'avatarCollections',
  'avatar_campaigns': 'avatarCampaigns',
  'gamification_stats': 'gamificationStats',
  'achievements': 'achievements',
  'student_achievements': 'studentAchievements',
  'missions': 'missions',
  'student_missions': 'studentMissions',
  'learning_paths': 'learningPaths',
  'activities': 'activities',
  'student_progress': 'studentProgress',
  'support_tickets': 'supportTickets',
  'ticket_messages': 'ticketMessages',
  'library_items': 'libraryItems',
  'diary_entries': 'diaryEntries',
  'student_activity_results': 'studentActivityResults',
  'notifications': 'notifications',
  'duels': 'duels',
  'duel_questions': 'duelQuestions'
};

/**
 * Enhanced Supabase query hook.
 * Now detects if a table is mirrored in Dexie and uses useLiveQuery for instant, reactive local data.
 * Falls back to Supabase network fetch + Realtime for un-mirrored tables.
 */
export function useSupabaseQuery<T>(table: string, dependencies: any[] = []): T[] {
  const dexieTable = TABLE_MAP[table];
  
  // 1. IF TABLE IS MIRRORED IN DEXIE
  const localData = useLiveQuery(
    async () => {
      if (!dexieTable) return null;
      const collection = db[dexieTable] as any;
      
      // Default ordering for better UX
      const tablesWithSort = ['users', 'classes', 'activities', 'notifications', 'supportTickets'];
      if (tablesWithSort.includes(dexieTable as string)) {
        return collection.reverse().toArray();
      }
      return collection.toArray();
    }, 
    [table, ...dependencies]
  );

  // 2. FALLBACK TO SUPABASE FOR NON-MIRRORED TABLES
  const [supabaseData, setSupabaseData] = useState<T[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dexieTable) return; // Skip if using Dexie

    let isMounted = true;
    const fetchData = async () => {
      let query = supabase.from(table).select('*');
      if (['users', 'classes', 'activities'].includes(table)) {
        query = query.order('createdAt', { ascending: false });
      }
      const { data: result, error } = await query;
      if (!error && result && isMounted) setSupabaseData(result as T[]);
    };

    const debouncedFetch = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => { if (isMounted) fetchData(); }, 300);
    };

    fetchData();
    const sub = supabase.channel(`${table}_changes`).on('postgres_changes', { event: '*', schema: 'public', table }, debouncedFetch).subscribe();

    return () => {
      isMounted = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(sub);
    };
  }, [table, dexieTable, ...dependencies]);

  return (dexieTable ? (localData || []) : supabaseData) as T[];
}
