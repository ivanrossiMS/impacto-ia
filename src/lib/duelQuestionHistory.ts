// ============================================================
// Duel Question History — Anti-Repetition System
// Stores the recent question texts seen by a student for a
// given theme so the AI can avoid regenerating them.
// ============================================================

import { db } from './dexie';

const MAX_HISTORY = 50;           // Max questions stored per student+theme
const RECENT_WINDOW = 30;          // How many recent texts to inject into the prompt

/**
 * Get the text of the most recent questions seen by a student for a theme.
 * Returns up to `limit` question texts (oldest first, newest last).
 */
export async function getRecentDuelQuestions(
  studentId: string,
  theme: string,
  limit = RECENT_WINDOW
): Promise<string[]> {
  try {
    const rows = await db.duelQuestionHistory
      .where('[studentId+theme]')
      .equals([studentId, theme])
      .sortBy('seenAt');

    // Return the tail (most recent N)
    const recent = rows.slice(-limit);
    return recent.map(r => r.questionText.slice(0, 120));
  } catch {
    return [];
  }
}

/**
 * Save a batch of question texts to the student's history for a theme.
 * Automatically prunes old entries to keep the table lean.
 */
export async function saveDuelQuestionsToHistory(
  studentId: string,
  theme: string,
  questionTexts: string[]
): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Bulk-insert new entries
    const entries = questionTexts.map(text => ({
      id: `${studentId}_${theme}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      studentId,
      theme,
      questionText: text.slice(0, 200),
      seenAt: now,
    }));
    await db.duelQuestionHistory.bulkPut(entries);

    // Prune: keep only the last MAX_HISTORY entries for this student+theme
    const all = await db.duelQuestionHistory
      .where('[studentId+theme]')
      .equals([studentId, theme])
      .sortBy('seenAt');

    if (all.length > MAX_HISTORY) {
      const toDelete = all.slice(0, all.length - MAX_HISTORY).map(r => r.id);
      await db.duelQuestionHistory.bulkDelete(toDelete);
    }
  } catch (err) {
    // Non-critical — silently fail so duels still work if history breaks
    console.warn('[DuelHistory] Failed to save question history:', err);
  }
}
