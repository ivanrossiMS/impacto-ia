import { supabase } from './supabase';
import { toast } from 'sonner';
import { updateGamificationStats } from './gamificationUtils';
import { createNotification } from './notificationUtils';


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
  const { data: activeMissions, error: missionsError } = await supabase
    .from('missions')
    .select('*')
    .eq('criteria', criteria);

  if (missionsError || !activeMissions || activeMissions.length === 0) return;

  // 2. For each mission, update the student's progress
  for (const mission of activeMissions) {
    // Check if progress entry exists
    let { data: progressArray } = await supabase
      .from('student_missions')
      .select('*')
      .eq('studentId', studentId)
      .eq('missionId', mission.id)
      .limit(1);

    let progress = progressArray && progressArray.length > 0 ? progressArray[0] : null;

    if (!progress) {
      // Create new progress entry
      const newProgress = {
        id: crypto.randomUUID(),
        studentId,
        missionId: mission.id,
        currentCount: 0
      };
      
      const { data: insertedProgress, error: insertError } = await supabase
        .from('student_missions')
        .insert(newProgress)
        .select()
        .single();
        
      if (insertError) continue;
      progress = insertedProgress;
    }

    // Skip if already completed
    if (progress?.completedAt) continue;

    // Increment count
    const newCount = (progress.currentCount || 0) + amount;
    const isNowCompleted = newCount >= mission.targetCount;

    await supabase
      .from('student_missions')
      .update({
        currentCount: newCount,
        completedAt: isNowCompleted ? new Date().toISOString() : null
      })
      .eq('id', progress.id);

    if (isNowCompleted) {
      toast.success(`Missão Concluída: ${mission.title}! 🎉`, {
        description: 'Vá até a página de missões para coletar sua recompensa.'
      });
    }
  }
}
