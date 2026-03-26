-- ============================================================
-- MIGRAÇÃO: Duelo em Tempo Real
-- Cole este script no SQL Editor do Supabase e clique RUN
-- ============================================================

-- Extensão UUID (necessária se não foi criada antes)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Salas de duelo em tempo real
CREATE TABLE IF NOT EXISTS realtime_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  "hostId" UUID REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT '1v1' CHECK (mode IN ('1v1','2v2')),
  "isPrivate" BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','starting','playing','finished')),
  "currentQuestion" INTEGER DEFAULT 0,
  "totalQuestions" INTEGER DEFAULT 8,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jogadores em cada sala
CREATE TABLE IF NOT EXISTS realtime_room_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "roomId" UUID REFERENCES realtime_rooms(id) ON DELETE CASCADE,
  "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  "detailedScore" INTEGER DEFAULT 0,
  "isReady" BOOLEAN DEFAULT FALSE,
  "hasAnsweredCurrent" BOOLEAN DEFAULT FALSE,
  "answerData" JSONB DEFAULT '[]'::jsonb,
  "joinedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("roomId", "userId")
);

-- Questões da sala (geradas pelo host via IA)
CREATE TABLE IF NOT EXISTS realtime_room_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "roomId" UUID REFERENCES realtime_rooms(id) ON DELETE CASCADE,
  "questionText" TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  "sortOrder" INTEGER NOT NULL
);

-- Habilitar Realtime para as novas tabelas
-- (Execute apenas uma vez. Se já foi feito, estas linhas podem ser ignoradas.)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE realtime_rooms;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE realtime_room_players;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CRÍTICO: sem REPLICA IDENTITY FULL, eventos DELETE não carregam dados antigos
-- e o filtro roomId=eq.xxx não funciona → guest some do BD mas host não vê atualizar
ALTER TABLE realtime_room_players REPLICA IDENTITY FULL;
ALTER TABLE realtime_rooms REPLICA IDENTITY FULL;

-- =====================================================
-- MIGRAÇÕES ADICIONAIS (Execute separadamente se a
-- tabela já existia antes dessas colunas serem criadas)
-- =====================================================

-- Balanceamento automático por série
ALTER TABLE realtime_rooms
  ADD COLUMN IF NOT EXISTS "autoBalance" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "autoBalanceGrade" TEXT;

-- Forfeit permanente para jogadores ausentes
ALTER TABLE realtime_room_players
  ADD COLUMN IF NOT EXISTS "hasForfeit" BOOLEAN DEFAULT FALSE;

-- =====================================================
-- RLS (ROW LEVEL SECURITY)
-- Cole este bloco separadamente no SQL Editor do Supabase
-- se as salas privadas não aparecem ou o código não funciona
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE realtime_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_room_questions ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode VER todas as salas (públicas e privadas)
-- A lógica de acesso privado é feita via código no app
DROP POLICY IF EXISTS "realtime_rooms_select" ON realtime_rooms;
CREATE POLICY "realtime_rooms_select"
  ON realtime_rooms FOR SELECT
  TO authenticated
  USING (true);

-- Qualquer usuário autenticado pode criar salas
DROP POLICY IF EXISTS "realtime_rooms_insert" ON realtime_rooms;
CREATE POLICY "realtime_rooms_insert"
  ON realtime_rooms FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Qualquer usuário autenticado pode atualizar salas (host altera status, etc.)
DROP POLICY IF EXISTS "realtime_rooms_update" ON realtime_rooms;
CREATE POLICY "realtime_rooms_update"
  ON realtime_rooms FOR UPDATE
  TO authenticated
  USING (true);

-- Qualquer usuário autenticado pode deletar salas (cleanup de host)
DROP POLICY IF EXISTS "realtime_rooms_delete" ON realtime_rooms;
CREATE POLICY "realtime_rooms_delete"
  ON realtime_rooms FOR DELETE
  TO authenticated
  USING (true);

-- Jogadores: leitura total (para ver outros jogadores na sala)
DROP POLICY IF EXISTS "realtime_room_players_select" ON realtime_room_players;
CREATE POLICY "realtime_room_players_select"
  ON realtime_room_players FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "realtime_room_players_insert" ON realtime_room_players;
CREATE POLICY "realtime_room_players_insert"
  ON realtime_room_players FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "realtime_room_players_update" ON realtime_room_players;
CREATE POLICY "realtime_room_players_update"
  ON realtime_room_players FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "realtime_room_players_delete" ON realtime_room_players;
CREATE POLICY "realtime_room_players_delete"
  ON realtime_room_players FOR DELETE
  TO authenticated
  USING (true);

-- Questões: leitura total (necessário para todos os jogadores verem as questões)
DROP POLICY IF EXISTS "realtime_room_questions_select" ON realtime_room_questions;
CREATE POLICY "realtime_room_questions_select"
  ON realtime_room_questions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "realtime_room_questions_insert" ON realtime_room_questions;
CREATE POLICY "realtime_room_questions_insert"
  ON realtime_room_questions FOR INSERT
  TO authenticated
  WITH CHECK (true);
