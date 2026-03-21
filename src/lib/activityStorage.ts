import { db } from './dexie';

export const ACTIVITIES_STORAGE_KEY = 'teacher_activities'; // Kept for reference/migration if needed

export async function getStoredActivities(): Promise<any[]> {
  try {
    return await db.activities.toArray();
  } catch (error) {
    console.error('Error fetching activities from Dexie:', error);
    return [];
  }
}

export async function saveActivityToStorage(activity: any): Promise<void> {
  try {
    await db.activities.add(activity);
  } catch (error) {
    console.error('Error saving activity to Dexie:', error);
    throw error;
  }
}
