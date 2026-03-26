// ============================================================
// duelRewards.ts — Single source of truth for duel reward calc
// Rebalanced v5: competitive rewards ×1.3 vs v4
// ============================================================

export interface DuelRewards {
  winXP: number;
  loseXP: number;
  drawXP: number;
  winCoins: number;
  loseCoins: number;
  drawCoins: number;
  /** XP per correct answer */
  xpPerCorrect: number;
  /** Coins per correct answer */
  coinsPerCorrect: number;
  /** Maximum possible XP (win + all correct) */
  maxXP: number;
  /** Maximum possible coins (win + all correct) */
  maxCoins: number;
}

// Difficulty bonuses — v4 × 1.3 (rounded)
const DIFFICULTY_BONUSES: Record<string, { xp: number; coins: number }> = {
  easy:   { xp:  28, coins: 12 },   // v4 22/9   × 1.3
  medium: { xp:  58, coins: 27 },   // v4 45/21  × 1.3
  hard:   { xp: 117, coins: 55 },   // v4 90/42  × 1.3
};

// Question count bonuses — v4 × 1.3
const QUESTION_COUNT_BONUSES: Record<number, { xp: number; coins: number }> = {
  5:  { xp:  0, coins:  0 },
  8:  { xp: 28, coins: 12 },   // v4 22/9  × 1.3
  10: { xp: 58, coins: 23 },   // v4 45/18 × 1.3
};

// Base rewards — v4 × 1.3 (rounded)
const BASE = {
  winXP:         156,  // v4  120 × 1.3
  loseXP:         49,  // v4   38 × 1.3
  drawXP:         88,  // v4   68 × 1.3
  winCoins:       35,  // v4   27 × 1.3
  loseCoins:      16,  // v4   12 × 1.3
  drawCoins:      23,  // v4   18 × 1.3
  xpPerCorrect:   35,  // v4   27 × 1.3
  coinsPerCorrect: 6,  // v4    5 × 1.2
};

export function calcDuelRewards(
  difficulty: string,
  questionCount: number
): DuelRewards {
  const diff   = DIFFICULTY_BONUSES[difficulty]   ?? DIFFICULTY_BONUSES.medium;
  const qBonus = QUESTION_COUNT_BONUSES[questionCount] ?? QUESTION_COUNT_BONUSES[5];

  const winXP         = BASE.winXP  + diff.xp  + qBonus.xp;
  const loseXP        = BASE.loseXP + Math.floor(diff.xp  / 4);
  const drawXP        = BASE.drawXP + Math.floor(diff.xp  / 2);
  const winCoins      = BASE.winCoins  + diff.coins + qBonus.coins;
  const loseCoins     = BASE.loseCoins;
  const drawCoins     = BASE.drawCoins + Math.floor(diff.coins / 3);
  const xpPerCorrect  = BASE.xpPerCorrect;
  const coinsPerCorrect = BASE.coinsPerCorrect;

  const maxXP    = winXP  + xpPerCorrect    * questionCount;
  const maxCoins = winCoins + coinsPerCorrect * questionCount;

  return {
    winXP, loseXP, drawXP,
    winCoins, loseCoins, drawCoins,
    xpPerCorrect, coinsPerCorrect,
    maxXP, maxCoins,
  };
}
