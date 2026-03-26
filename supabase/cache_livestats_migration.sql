-- ============================================================
-- MIGRAÇÃO: Cache de Trilhas e Live Stats
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Adiciona campo topic em learning_paths para cache lookup
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS topic TEXT;

-- Índice para busca rápida de trilhas por combinação cache
CREATE INDEX IF NOT EXISTS idx_lp_cache
  ON learning_paths(subject, grade, difficulty, "isAIGenerated")
  WHERE "isAIGenerated" = TRUE;

-- Atualiza trilhas existentes: topic = title se topic for null
UPDATE learning_paths SET topic = title WHERE topic IS NULL;

-- Habilitar REPLICA IDENTITY FULL em tabelas de gamificação
-- (necessário para que DELETE events contenham dados de linha para filtros Realtime)
ALTER TABLE gamification_stats REPLICA IDENTITY FULL;
ALTER TABLE student_achievements REPLICA IDENTITY FULL;
ALTER TABLE student_missions REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
