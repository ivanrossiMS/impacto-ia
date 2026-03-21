import { supabase } from './supabase';

export const ACTIVITIES_STORAGE_KEY = 'teacher_activities'; // Kept for reference/migration if needed

export async function getStoredActivities(): Promise<any[]> {
  try {
    const { data, error } = await supabase.from('activities').select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching activities from Supabase:', error);
    return [];
  }
}

export async function saveActivityToStorage(activity: any): Promise<void> {
  try {
    const { error } = await supabase.from('activities').insert([activity]);
    if (error) throw error;
  } catch (error) {
    console.error('Error saving activity to Supabase:', error);
    throw error;
  }
}
