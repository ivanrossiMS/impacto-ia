/**
 * Content Cache Service — Phase 4
 * Finds existing trails/activities before calling AI to generate new ones.
 *
 * Before generating a trail, call findSimilarTrail().
 * If a compatible trail exists, reuse or clone it instead of calling AI.
 */
import { supabase } from '../lib/supabase';
import { db } from '../lib/dexie';

export interface CachedTrail {
  id: string;
  title: string;
  subject: string;
  grade: string;
  difficulty: string;
  topic?: string;
  description: string;
  steps: any[];
  rewardXp: number;
  rewardCoins: number;
  isAIGenerated: boolean;
}

/**
 * Build a normalized cache key for deduplication.
 * Normalizes text: lowercase, remove accents, trim.
 */
function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim();
}

function cacheKey(subject: string, grade: string, difficulty: string, topic: string): string {
  return `${normalize(subject)}|${normalize(grade)}|${normalize(difficulty)}|${normalize(topic)}`;
}

/**
 * Find a similar trail in the local Dexie cache or Supabase.
 * Returns the first match, or null if none exists.
 *
 * Matching logic: same subject + grade + difficulty + topic (normalized).
 */
export async function findSimilarTrail(
  subject: string,
  grade: string,
  difficulty: string,
  topic: string
): Promise<CachedTrail | null> {
  const key = cacheKey(subject, grade, difficulty, topic);

  // 1. Check local Dexie first (fast, offline-capable)
  const localTrails = await db.learningPaths.toArray();
  const localMatch = localTrails.find(t => {
    const tKey = cacheKey(
      (t as any).subject || '',
      (t as any).grade || '',
      (t as any).difficulty || '',
      (t as any).topic || (t as any).title || ''
    );
    return tKey === key && Array.isArray((t as any).steps) && (t as any).steps.length >= 5;
  });

  if (localMatch) {
    console.log(`[ContentCache] Cache HIT (local) for "${topic}" — ${subject} ${grade} ${difficulty}`);
    return localMatch as unknown as CachedTrail;
  }

  // 2. Check Supabase for a match not yet synced locally
  const { data } = await supabase
    .from('learning_paths')
    .select('*')
    .eq('subject', subject)
    .eq('grade', grade)
    .eq('difficulty', difficulty)
    .eq('isAIGenerated', true)
    .not('steps', 'eq', '[]')
    .limit(1)
    .maybeSingle();

  if (data) {
    const steps = Array.isArray(data.steps) ? data.steps : [];
    if (steps.length >= 5) {
      console.log(`[ContentCache] Cache HIT (remote) for "${topic}" — ${subject} ${grade} ${difficulty}`);
      return data as CachedTrail;
    }
  }

  console.log(`[ContentCache] Cache MISS for "${topic}" — ${subject} ${grade} ${difficulty}`);
  return null;
}

/**
 * Save a newly generated trail to Supabase AND local Dexie.
 * Adds topic field for future cache lookups.
 */
export async function cacheTrail(trail: Omit<CachedTrail, 'id'> & { id?: string }): Promise<string | null> {
  const { data, error } = await supabase
    .from('learning_paths')
    .upsert({
      ...trail,
      isAIGenerated: true,
      createdAt: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false })
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.warn('[ContentCache] Failed to cache trail:', error?.message);
    return null;
  }

  // Mirror to local Dexie so it's available without Supabase on next session
  await db.learningPaths.put({ ...trail, id: data.id } as any).catch(() => {});

  return data.id;
}

/**
 * Find a similar activity before generating a new one.
 * Matches on subject + grade + topic (normalized).
 */
export async function findSimilarActivity(
  subject: string,
  grade: string,
  topic: string
): Promise<any | null> {
  const subjectN = normalize(subject);
  const gradeN = normalize(grade);
  const topicN = normalize(topic);

  // Check local cache
  const local = await db.activities.toArray();
  const match = local.find(a => {
    return normalize((a as any).subject || '') === subjectN
      && normalize((a as any).grade || '') === gradeN
      && (normalize((a as any).topic || '') === topicN || normalize((a as any).title || '').includes(topicN))
      && Array.isArray((a as any).questions) && (a as any).questions.length > 0;
  });

  if (match) {
    console.log(`[ContentCache] Activity cache HIT for "${topic}"`);
    return match;
  }

  // Check Supabase
  const { data } = await supabase
    .from('activities')
    .select('*')
    .ilike('topic', `%${topic}%`)
    .eq('subject', subject)
    .eq('grade', grade)
    .not('questions', 'eq', '[]')
    .limit(1)
    .maybeSingle();

  if (data && Array.isArray(data.questions) && data.questions.length > 0) {
    console.log(`[ContentCache] Activity remote cache HIT for "${topic}"`);
    return data;
  }

  return null;
}
