import { db } from './dexie';
import { toast } from 'sonner';
import { updateGamificationStats } from './gamificationUtils';

/**
 * Increments progress for all active missions of a certain criteria for a student.
 */
export async function incrementMissionProgress(
  studentId: string, 
  criteria: 'activity_completed' | 'question_correct' | 'login' | 'streak' | 'path_started' | 'path_completed' | 'tutor_question' | 'diary_entry' | 'library_access' | 'store_visit' | 'ranking_visit' | 'duel_completed',
  amount: number = 1
) {
  if (!studentId) return;

  // Update stats (streak, lastStudyDate, etc.)
  try {
    await updateGamificationStats(studentId, {});
  } catch (e) {
    console.warn('Failed to update stats in missionUtils:', e);
  }

  // 1. Get all active missions that match this criteria
  const activeMissions = await db.missions.where('criteria').equals(criteria).toArray();
  if (activeMissions.length === 0) return;

  // 2. For each mission, update the student's progress
  for (const mission of activeMissions) {
    // Check if progress entry exists
    let progress = await db.studentMissions
      .where('[studentId+missionId]')
      .equals([studentId, mission.id])
      .first();

    if (!progress) {
      // Create new progress entry
      progress = {
        id: crypto.randomUUID(),
        studentId,
        missionId: mission.id,
        currentCount: 0
      };
      await db.studentMissions.add(progress);
    }

    // Skip if already completed
    if (progress.completedAt) continue;

    // Increment count
    const newCount = (progress.currentCount || 0) + amount;
    const isNowCompleted = newCount >= mission.targetCount;

    await db.studentMissions.update(progress.id, {
      currentCount: newCount,
      completedAt: isNowCompleted ? new Date().toISOString() : undefined
    });

    if (isNowCompleted) {
      toast.success(`Missão Concluída: ${mission.title}! 🎉`, {
        description: 'Vá até a página de missões para coletar sua recompensa.'
      });
    }
  }
}
