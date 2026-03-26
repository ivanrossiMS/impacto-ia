import { supabase } from './supabase';

export const ACTIVITIES_STORAGE_KEY = 'teacher_activities'; // Kept for reference/migration if needed

// Tag appended to description to survive the round-trip through Supabase
// without requiring a DB migration for extra fields.
const META_SEP = '||META:';

function encodeActivityMeta(activity: any): any {
  const { noExitAllowed, pinnedToClass, ...rest } = activity;
  const meta: Record<string, any> = {};
  if (noExitAllowed) meta.noExitAllowed = true;
  if (pinnedToClass) meta.pinnedToClass = true;
  if (Object.keys(meta).length > 0) {
    rest.description = (rest.description || '') + META_SEP + JSON.stringify(meta);
  }
  return rest;
}

export function decodeActivityMeta(activity: any): any {

  if (!activity?.description?.includes(META_SEP)) return activity;
  const [cleanDesc, rawMeta] = activity.description.split(META_SEP);
  try {
    const meta = JSON.parse(rawMeta);
    return { ...activity, description: cleanDesc, ...meta };
  } catch {
    return activity;
  }
}

export async function getStoredActivities(): Promise<any[]> {
  try {
    const { data, error } = await supabase.from('activities').select('*');
    if (error) throw error;
    return (data || []).map(decodeActivityMeta);
  } catch (error) {
    console.error('Error fetching activities from Supabase:', error);
    return [];
  }
}

export async function saveActivityToStorage(activity: any): Promise<void> {
  try {
    const encoded = encodeActivityMeta(activity);
    const { data: inserted, error } = await supabase
      .from('activities')
      .insert([encoded])
      .select()
      .single();
    if (error) throw error;

    // ── Optimistic Dexie write ───────────────────────────────────────────────
    // Write immediately to local cache so useLiveQuery re-renders without
    // waiting for the SyncEngine's postgres_changes event (which requires
    // Supabase Realtime to be enabled and may have latency).
    try {
      const { db } = await import('./dexie');
      await (db.activities as any).put(inserted || encoded);
    } catch (_) { /* local write failure is non-fatal */ }
  } catch (error) {
    console.error('Error saving activity to Supabase:', error);
    throw error;
  }
}

