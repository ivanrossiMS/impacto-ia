-- ============================================================
-- MIGRAÇÃO: Banco Mestre de Questões
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Banco mestre de questões reutilizáveis entre duelos/atividades
CREATE TABLE IF NOT EXISTS question_bank (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theme        TEXT NOT NULL,          -- historia | matematica | ciencias | etc.
  subtopic     TEXT,                   -- subtema específico
  grade_min    INTEGER NOT NULL,       -- ano escolar mínimo (1=1ºEF, 9=9ºEF, 10-12=EM)
  grade_max    INTEGER NOT NULL,
  difficulty   TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  question_text TEXT NOT NULL,
  options      JSONB NOT NULL,         -- [{id,text,isCorrect}]
  explanation  TEXT,
  tags         JSONB DEFAULT '[]',
  bncc         TEXT,
  quality_score FLOAT DEFAULT 0.8,
  usage_count  INTEGER DEFAULT 0,
  is_active    BOOLEAN DEFAULT TRUE,
  origin       TEXT DEFAULT 'ai',      -- ai | manual | imported
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice principal da lookup de duelo: theme + grade + difficulty
CREATE INDEX IF NOT EXISTS idx_qb_theme_grade_diff
  ON question_bank(theme, grade_min, grade_max, difficulty)
  WHERE is_active = TRUE;

-- Índice secundário para priorizar menos usadas primeiro
CREATE INDEX IF NOT EXISTS idx_qb_usage
  ON question_bank(usage_count ASC)
  WHERE is_active = TRUE;

-- Histórico das questões vistas pelo aluno (anti-repetição)
CREATE TABLE IF NOT EXISTS student_question_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES question_bank(id) ON DELETE CASCADE,
  theme       TEXT NOT NULL,
  seen_at     TIMESTAMPTZ DEFAULT NOW(),
  match_id    TEXT,    -- id do duelo onde foi vista
  UNIQUE(student_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_sqh_student_theme
  ON student_question_history(student_id, theme, seen_at DESC);

-- Log de chamadas IA para observabilidade e custo
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature       TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  response_ms   INTEGER,
  cache_hit     BOOLEAN DEFAULT FALSE,
  success       BOOLEAN DEFAULT TRUE,
  error_msg     TEXT,
  user_id       UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acl_feature_date
  ON ai_call_logs(feature, created_at DESC);

-- Habilitar Realtime para question_bank (admin pode ver novas questões)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE question_bank;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Desabilitar RLS (leitura pública para alunos autenticados — sem dados sensíveis)
ALTER TABLE question_bank DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_question_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_logs DISABLE ROW LEVEL SECURITY;
