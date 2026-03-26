-- ============================================================
-- AI Overhaul Migration — v2
-- Adds accuracy tracking to student question history
-- and an RPC for computing accuracy
-- ============================================================

-- 1. Add was_correct column to track per-question accuracy
ALTER TABLE student_question_history
  ADD COLUMN IF NOT EXISTS was_correct BOOLEAN DEFAULT NULL;

-- 2. Index for fast accuracy queries
CREATE INDEX IF NOT EXISTS idx_sqh_accuracy
  ON student_question_history(student_id, seen_at DESC);

-- 3. Composite index to speed up anti-repetition queries
CREATE INDEX IF NOT EXISTS idx_sqh_student_theme_recent
  ON student_question_history(student_id, theme, seen_at DESC);

-- 4. RPC to get student accuracy for last N questions
CREATE OR REPLACE FUNCTION get_student_accuracy(
  p_student_id UUID,
  p_last_n     INTEGER DEFAULT 20
)
RETURNS FLOAT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END),
    0.5  -- default 50% when no history
  )
  FROM (
    SELECT was_correct
    FROM student_question_history
    WHERE student_id = p_student_id
      AND was_correct IS NOT NULL
    ORDER BY seen_at DESC
    LIMIT p_last_n
  ) sub;
$$;

-- 5. RPC to increment question usage (used in questionBank.service.ts)
CREATE OR REPLACE FUNCTION increment_question_usage(question_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE question_bank
  SET usage_count = usage_count + 1
  WHERE id = question_id;
$$;
