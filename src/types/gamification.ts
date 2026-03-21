export interface GamificationStats {
  id: string; // usually studentId
  level: number;
  xp: number;
  coins: number;
  streak: number;
  lastStudyDate?: string;
  updatedAt?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name or image path
  condition: string;
  rewardXp: number;
  rewardCoins: number;
}

export interface StudentAchievement {
  id: string; // UUID
  studentId: string;
  achievementId: string;
  unlockedAt: string;
}

export interface Mission {
  id: string;
  type: 'daily' | 'weekly' | 'flash' | 'epic';
  title: string;
  description: string;
  targetCount: number;
  rewardXp: number;
  rewardCoins: number;
  criteria?: 'activity_completed' | 'question_correct' | 'login' | 'streak' | 'path_started' | 'path_completed' | 'tutor_question' | 'diary_entry' | 'library_access' | 'store_visit' | 'ranking_visit' | 'activity_feedback' | 'avatar_customized' | 'duel_completed';
  expiresAt?: string;

  requiredLevel?: number;
}

export interface StudentMissionProgress {
  id: string; // User-Mission relation ID
  studentId: string;
  missionId: string;
  currentCount: number;
  completedAt?: string;
  claimedAt?: string; // When the user collected the reward
}

export interface StudentResponse {
  questionId: string;
  selectedOptionId?: string;
  dissertativeAnswer?: string;
  isCorrect: boolean;
}

export interface StudentActivityResult {
  id: string;
  activityId: string;
  studentId: string;
  status: 'passed' | 'failed' | 'given_up';
  score?: number;
  totalQuestions?: number;
  xpEarned?: number;
  coinsEarned?: number;
  completedAt?: string;
  timeSpent?: number; // in seconds
  responses?: StudentResponse[];
}



