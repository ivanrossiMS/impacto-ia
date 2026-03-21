export type DuelStatus = 'pending' | 'active' | 'completed' | 'expired';

export type DuelTheme = 'historia' | 'geografia' | 'arte' | 'esportes' | 'ciencias' | 'entretenimento' | 'aleatorio';

export type DuelDifficulty = 'easy' | 'medium' | 'hard';

export interface Duel {
  id: string;
  challengerId: string;
  challengedId: string;
  theme: DuelTheme;
  difficulty: DuelDifficulty;
  questionCount: 5 | 8 | 10;
  status: DuelStatus;
  challengerScore: number;
  challengedScore: number;
  winnerId?: string | 'draw';
  challengerTurnCompleted: boolean;
  challengedTurnCompleted: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface DuelQuestion {
  id: string;
  duelId: string;
  questionText: string;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  explanation?: string;
  challengerAnswerId?: string;
  challengedAnswerId?: string;
}
