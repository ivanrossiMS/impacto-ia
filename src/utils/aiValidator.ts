/**
 * AI Output Validator
 * Validates and sanitizes AI-generated content before it reaches the student.
 * All validators return true if valid, false if not.
 */

export interface AIQuestion {
  id?: string;
  questionText?: string;
  text?: string;   // some features use text instead of questionText
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
  explanation?: string;
}

export interface AITrailStep {
  id: string;
  title: string;
  type: string;
  content: string;
  theory: string;
  questions: AIQuestion[];
}

/** Validates a single question has exactly 4 options and exactly 1 correct answer. */
export function validateQuestion(q: AIQuestion): boolean {
  if (!q) return false;
  const text = q.questionText || q.text || '';
  if (!text.trim()) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  const correctCount = q.options.filter(o => o.isCorrect === true).length;
  if (correctCount !== 1) return false;
  return true;
}

/**
 * Sanitizes a question by:
 * 1. Ensuring exactly 1 correct option (forces first if ambiguous)
 * 2. Ensuring 4 options exist (pads with placeholders if needed)
 */
export function sanitizeQuestion(q: AIQuestion): AIQuestion {
  if (!Array.isArray(q.options)) q.options = [];

  // Pad to 4 options if somehow short
  while (q.options.length < 4) {
    q.options.push({ id: String.fromCharCode(97 + q.options.length), text: '—', isCorrect: false });
  }
  q.options = q.options.slice(0, 4);

  // Ensure exactly 1 correct
  const correctCount = q.options.filter(o => o.isCorrect).length;
  if (correctCount === 0) {
    q.options[0].isCorrect = true; // fallback: first is correct
  } else if (correctCount > 1) {
    let found = false;
    q.options = q.options.map(o => {
      if (o.isCorrect && !found) { found = true; return o; }
      return { ...o, isCorrect: false };
    });
  }

  return q;
}

/** Validates an array of questions, returns only valid ones (sanitized). */
export function validateAndSanitizeQuestions(questions: AIQuestion[]): AIQuestion[] {
  return questions
    .map(sanitizeQuestion)
    .filter(validateQuestion);
}

/** Validates a trail step has all required fields and valid questions. */
export function validateTrailStep(step: AITrailStep): boolean {
  if (!step?.id || !step?.title || !step?.type) return false;
  if (!step.content?.trim() || !step.theory?.trim()) return false;
  if (!Array.isArray(step.questions) || step.questions.length < 1) return false;
  return true;
}

/** Validates the full set of duel questions returned by AI. */
export function validateDuelQuestions(data: { questions?: any[] }): {
  valid: boolean;
  questions: AIQuestion[];
  errors: string[];
} {
  const errors: string[] = [];

  if (!data?.questions || !Array.isArray(data.questions)) {
    return { valid: false, questions: [], errors: ['No questions array in AI response'] };
  }

  const sanitized = validateAndSanitizeQuestions(data.questions);

  if (sanitized.length < data.questions.length) {
    errors.push(`${data.questions.length - sanitized.length} questions dropped (malformed)`);
  }

  if (sanitized.length === 0) {
    return { valid: false, questions: [], errors: [...errors, 'No valid questions after sanitization'] };
  }

  return { valid: true, questions: sanitized, errors };
}
