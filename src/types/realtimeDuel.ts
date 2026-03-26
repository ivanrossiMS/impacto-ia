import type { DuelTheme, DuelDifficulty, DuelAnswerData } from './duel';

export type RoomStatus = 'waiting' | 'starting' | 'playing' | 'finished';
export type RoomMode = '1v1' | '2v2';

export interface RealtimeRoom {
  id: string;
  code: string;
  hostId: string;
  theme: DuelTheme;
  difficulty: DuelDifficulty;
  mode: RoomMode;
  isPrivate: boolean;
  autoBalance: boolean;
  autoBalanceGrade?: string; // lowest grade among players, resolved at start
  status: RoomStatus;
  currentQuestion: number;
  totalQuestions: number;
  createdAt: string;
}

export interface RealtimeRoomPlayer {
  id: string;
  roomId: string;
  userId: string;
  score: number;
  detailedScore: number;
  isReady: boolean;
  hasAnsweredCurrent: boolean;
  answerData: DuelAnswerData[];
  joinedAt: string;
  // Joined from users table (client-side enrichment)
  name?: string;
  avatar?: string;
  level?: number;
  grade?: string;
  className?: string;
  avatarCompose?: { avatarUrl: string; backgroundUrl?: string; borderUrl?: string; stickerUrls?: string[] } | null;
  hasForfeit?: boolean;
}

export interface RealtimeRoomQuestion {
  id: string;
  roomId: string;
  questionText: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation?: string;
  sortOrder: number;
}
