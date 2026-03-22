import { supabase } from './supabase';
import { db } from './dexie';

// Maps Supabase snake_case table names to Dexie camelCase collection names
const TABLE_TO_DEXIE: Record<string, keyof typeof db> = {
  'users': 'users',
  'schools': 'schools',
  'classes': 'classes',
  'gamification_stats': 'gamificationStats',
  'activities': 'activities',
  'support_tickets': 'supportTickets',
  'notifications': 'notifications',
  'avatar_catalog': 'avatarCatalog',
  'student_activity_results': 'studentActivityResults',
  'student_achievements': 'studentAchievements',
  'student_missions': 'studentMissions',
  'library_items': 'libraryItems',
  'learning_paths': 'learningPaths',
};

const SYNC_TABLES = Object.keys(TABLE_TO_DEXIE);

/**
 * SyncEngine: The brain of the Local-First architecture.
 * It ensures that the local Dexie database is a mirror of the Supabase data,
 * providing ultra-fast reads and real-time updates.
 */
export const syncEngine = {
  isSubscribed: false,
  
  /**
   * Performs an initial pull of all data from Supabase to Dexie.
   */
  async pullData() {
    console.log('[SyncEngine] Pulling data from Supabase...');
    for (const table of SYNC_TABLES) {
      const dexieKey = TABLE_TO_DEXIE[table];
      if (!dexieKey) continue;
      
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        
        if (data && data.length > 0) {
          await (db[dexieKey] as any).bulkPut(data);
          console.log(`[SyncEngine] Synced ${data.length} records for ${table} => db.${dexieKey}`);
        }
      } catch (err) {
        console.error(`[SyncEngine] Failed to sync table ${table}:`, err);
      }
    }
  },

  /**
   * Initializes the engine: pulls data AND sets up subscriptions.
   * Safe to call multiple times.
   */
  async initialize() {
    console.log('[SyncEngine] Initializing sync engine...');
    await this.pullData();
    this.setupSubscriptions();
  },

  /**
   * Subscribes to Supabase Realtime for all relevant tables.
   */
  setupSubscriptions() {
    if (this.isSubscribed) return;
    this.isSubscribed = true;
    SYNC_TABLES.forEach((table) => {
      const dexieKey = TABLE_TO_DEXIE[table];
      if (!dexieKey) return;

      supabase
        .channel(`sync_${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          async (payload) => {
            console.log(`[SyncEngine] Realtime change in ${table} => db.${dexieKey}:`, payload.eventType);
            
            const dexieTable = db[dexieKey] as any;
            
            switch (payload.eventType) {
              case 'INSERT':
              case 'UPDATE':
                await dexieTable.put(payload.new);
                break;
              case 'DELETE': {
                const oldId = payload.old?.id;
                if (oldId) {
                  await dexieTable.delete(oldId);
                } else {
                  // Supabase only sends payload.old when table has REPLICA IDENTITY FULL.
                  // As a safe fallback, refetch the whole table to keep Dexie in sync.
                  const { data } = await supabase.from(table).select('*');
                  if (data) {
                    await dexieTable.clear();
                    await dexieTable.bulkPut(data);
                  }
                }
                break;
              }

            }
          }
        )
        .subscribe();
    });
    
    console.log('[SyncEngine] Realtime subscriptions active.');
  }
};
