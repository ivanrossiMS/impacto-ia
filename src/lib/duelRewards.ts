// ============================================================
// duelRewards.ts — Single source of truth for duel reward calc
// Rebalanced v2: Duels are now meaningfully rewarding
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

// Difficulty bonuses — significantly increased to make difficulty choices matter
const DIFFICULTY_BONUSES: Record<string, { xp: number; coins: number }> = {
  easy:   { xp:  20, coins: 10 },
  medium: { xp:  45, coins: 20 },
  hard:   { xp:  80, coins: 40 },
};

// Question count bonuses — reward commitment to longer duels
const QUESTION_COUNT_BONUSES: Record<number, { xp: number; coins: number }> = {
  5:  { xp:   0, coins:  0 },
  8:  { xp:  25, coins: 10 },
  10: { xp:  50, coins: 20 },
};

// Base rewards — significantly rebalanced for better duel engagement
const BASE = {
  winXP:         120,  // was 50  — winning a duel should feel really good
  loseXP:         30,  // was 10  — even losing deserves recognition
  drawXP:         60,  // was 20  — a draw is still a strong performance
  winCoins:       25,  // was 10  — meaningful coin reward for victories
  loseCoins:      10,  // was  0  — players should never feel zero reward
  drawCoins:      15,  // was  3  — draw is competitive, should reward equally
  xpPerCorrect:   25,  // was 15  — each correct answer in duel has real XP value
  coinsPerCorrect: 5,  // was  2  — small but visible coin reward per correct
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
