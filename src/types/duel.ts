export type DuelStatus = 'pending' | 'active' | 'completed' | 'expired' | 'declined';

export type DuelTheme = 'historia' | 'geografia' | 'arte' | 'esportes' | 'ciencias' | 'entretenimento' | 'aleatorio' | 'quem_sou_eu' | 'logica';

export type DuelDifficulty = 'easy' | 'medium' | 'hard';

/** The 7 powers available during a duel */
export type DuelPowerType = 'shield' | 'freeze' | 'eliminate' | 'swap' | 'turbo' | 'segunda_chance' | 'dica' | 'queima';

/** Rich per-question data stored with each turn submission */
export interface DuelAnswerData {
  questionId: string;
  selectedOptionId: string;   // 'timeout_skip' if timed out
  isCorrect: boolean;
  timeUsed: number;           // seconds taken
  timeMax: number;            // effective time available
  pointsEarned: number;       // final points after all bonuses
  speedBonus: number;
  streakBonus: number;
  comboMultiplier: number;
  streakAtAnswer: number;     // streak BEFORE this answer
  powerUsed?: DuelPowerType;  // power activated on this question
  eliminatedOptionIds?: string[];
  shieldActivated?: boolean;  // shield absorbed a wrong answer
  secondChanceUsed?: boolean; // segunda_chance consumed on this question
  energyBurnBonus?: number;   // % bonus from queima power (e.g. 60 = +60%)
}

export interface Duel {
  id: string;
  challengerId: string;
  challengedId: string;
  theme: DuelTheme;
  difficulty: DuelDifficulty;
  questionCount: 5 | 8 | 10;
  status: DuelStatus;
  /** Legacy correct-answer count (kept for compatibility) */
  challengerScore: number;
  challengedScore: number;
  /** Point-based detailed score (new system) */
  challengerDetailedScore?: number;
  challengedDetailedScore?: number;
  /** Full per-question answer log */
  challengerAnswerData?: DuelAnswerData[];
  challengedAnswerData?: DuelAnswerData[];
  /** Whether challenger applied time pressure on opponent */
  challengerPressureUsed?: boolean;
  challengedPressureUsed?: boolean;
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
  hint?: string;              // short hint used by the Dica power
  challengerAnswerId?: string;
  challengedAnswerId?: string;
}
