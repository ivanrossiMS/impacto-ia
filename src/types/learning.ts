// Trilha (Learning Path)
export interface LearningPath {
  id: string;
  title: string;
  subject: string;
  grade: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  steps: PathStep[];
  rewardCoins: number;
  rewardXp: number;
  order: number;
  classId?: string;
  schoolYear?: string;
  isAIGenerated?: boolean;
  schoolId?: string;
  createdAt?: string;
}

export interface PathStep {
  id: string;
  title: string;
  type: 'intro' | 'theory' | 'practice' | 'quiz' | 'boss';
  activityId?: string; // Reference to a detailed activity
}

export interface Activity {
  id: string;
  title: string;
  type: 'multiple_choice' | 'true_false' | 'matching' | 'mixed' | 'objetiva' | 'dissertativa' | 'simulado' | 'quiz_divertido' | 'prova_bimestral' | 'prova_mensal';
  questionText?: string;
  options?: any[]; // Flexible for now
  explanation?: string;
  subject: string;
  grade: string;
  questions?: any[]; // Was ActivityQuestion[], making flexible for teacher activities
  rewardXp?: number;
  rewardCoins?: number;
  classId?: string;
  teacherId?: string;
  createdAt?: string;
  updatedAt?: string;
  aiAssisted?: boolean;
  duration?: string;
  topic?: string;
  description?: string;
}

export interface ActivityQuestion {
  id: string;
  questionText?: string;
  text?: string; // Support for teacher 'text' field
  type: 'multiple_choice' | 'true_false' | 'matching' | 'objetiva' | 'dissertativa';
  options?: any[];
  explanation?: string;
  subject?: string;
  answer?: string; // Support for teacher 'answer' field
}


export interface ActivityOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

// Student Progress Tracking
export interface StudentProgress {
  id: string; // Typically Path ID + Student ID
  studentId: string;
  pathId: string;
  completedStepIds: string[];
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt: string;
  completedAt?: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  type: 'text' | 'video' | 'quiz' | 'audio';
  subject: string;
  grade: string;
  year?: string;
  classId?: string;
  teacherId?: string;
  downloads: number;
  rating: number;
  isOwn?: boolean;
  description?: string;
  url?: string;
  addedAt?: string;
}
