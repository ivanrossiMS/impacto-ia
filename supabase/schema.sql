-- =========================================
-- SCRIPT DE MIGRAÇÃO: DEXIE -> SUPABASE
-- Execute este script no SQL Editor do Supabase
-- =========================================

-- 1. Criação das Extensões Necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- TABELAS PRINCIPAIS
-- =========================================

-- Escolas
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  usersCount INTEGER DEFAULT 0,
  globalScore INTEGER DEFAULT 0,
  logo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Turmas
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT,
  year TEXT,
  schoolId UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacherId TEXT,
  studentIds JSONB DEFAULT '[]'::jsonb,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usuários (Extendendo a tabela nativa do auth se quiser futuramente, mas mantendo a lógica do Dexie por enquanto)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Pode ser substituído pelo id do auth.users depois
  role TEXT NOT NULL CHECK (role IN ('student', 'guardian', 'teacher', 'admin')),
  name TEXT NOT NULL,
  email TEXT,
  isRegistered BOOLEAN DEFAULT FALSE,
  schoolId UUID REFERENCES schools(id) ON DELETE SET NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  avatar TEXT,
  isMaster BOOLEAN DEFAULT FALSE,
  studentCode TEXT,
  guardianCode TEXT,
  passwordHash TEXT,
  birthDate TIMESTAMP WITH TIME ZONE,
  grade TEXT,
  classId UUID REFERENCES classes(id) ON DELETE SET NULL,
  guardianIds JSONB DEFAULT '[]'::jsonb,
  studentIds JSONB DEFAULT '[]'::jsonb,
  classIds JSONB DEFAULT '[]'::jsonb,
  subjects JSONB DEFAULT '[]'::jsonb
);

-- =========================================
-- GAMIFICAÇÃO & AVATAR
-- =========================================

-- Status de Gamificação por Aluno
CREATE TABLE gamification_stats (
  id UUID PRIMARY KEY, -- Normalmante ligado ao studentId (users.id)
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  lastStudyDate TIMESTAMP WITH TIME ZONE,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Catálogo de Avatares (Loja)
CREATE TABLE avatar_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  assetUrl TEXT NOT NULL,
  previewUrl TEXT,
  type TEXT NOT NULL,
  category TEXT,
  rarity TEXT NOT NULL,
  priceCoins INTEGER NOT NULL,
  isFree BOOLEAN DEFAULT FALSE,
  isFeatured BOOLEAN DEFAULT FALSE,
  isEventLimited BOOLEAN DEFAULT FALSE,
  isRecommended BOOLEAN DEFAULT FALSE,
  isActive INTEGER DEFAULT 1,
  sortOrder INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  imageUrl TEXT,
  isPremium BOOLEAN DEFAULT FALSE
);

-- Itens que o Aluno Comrpou/Ganhou
CREATE TABLE student_owned_avatars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studentId UUID REFERENCES users(id) ON DELETE CASCADE,
  catalogItemId UUID REFERENCES avatar_catalog(id) ON DELETE CASCADE,
  acquiredAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acquisitionType TEXT NOT NULL
);

-- Perfil de Avatar Ativo do Aluno
CREATE TABLE student_avatar_profiles (
  studentId UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  selectedAvatarId UUID REFERENCES student_owned_avatars(id),
  selectedBackgroundId UUID REFERENCES student_owned_avatars(id),
  selectedBorderId UUID REFERENCES student_owned_avatars(id),
  equippedStickerIds JSONB DEFAULT '[]'::jsonb,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  equippedItems JSONB,
  skinTone TEXT,
  colorOverrides JSONB
);

-- Coleções de Avatares
CREATE TABLE avatar_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  bannerUrl TEXT,
  isActive INTEGER DEFAULT 1,
  isEvent BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campanhas de Avatar
CREATE TABLE avatar_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  startDate TIMESTAMP WITH TIME ZONE NOT NULL,
  endDate TIMESTAMP WITH TIME ZONE NOT NULL,
  rewardType TEXT NOT NULL,
  relatedItemIds JSONB DEFAULT '[]'::jsonb,
  isActive INTEGER DEFAULT 1,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conquistas (Achievements Globais)
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  condition TEXT NOT NULL,
  rewardXp INTEGER NOT NULL,
  rewardCoins INTEGER NOT NULL
);

-- Conquistas do Aluno
CREATE TABLE student_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studentId UUID REFERENCES users(id) ON DELETE CASCADE,
  achievementId UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlockedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Missões
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  targetCount INTEGER NOT NULL,
  rewardXp INTEGER NOT NULL,
  rewardCoins INTEGER NOT NULL,
  criteria TEXT,
  expiresAt TIMESTAMP WITH TIME ZONE,
  requiredLevel INTEGER
);

-- Progresso do Aluno nas Missões
CREATE TABLE student_missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studentId UUID REFERENCES users(id) ON DELETE CASCADE,
  missionId UUID REFERENCES missions(id) ON DELETE CASCADE,
  currentCount INTEGER DEFAULT 0,
  completedAt TIMESTAMP WITH TIME ZONE,
  claimedAt TIMESTAMP WITH TIME ZONE
);

-- =========================================
-- APRENDIZAGEM & ATIVIDADES
-- =========================================

-- Trilhas de Aprendizagem
CREATE TABLE learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  description TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  rewardCoins INTEGER DEFAULT 0,
  rewardXp INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0,
  classId UUID REFERENCES classes(id) ON DELETE SET NULL,
  schoolYear TEXT,
  isAIGenerated BOOLEAN DEFAULT FALSE,
  schoolId UUID REFERENCES schools(id) ON DELETE SET NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Atividades (Aulas e Provas)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  questionText TEXT,
  options JSONB,
  explanation TEXT,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  questions JSONB DEFAULT '[]'::jsonb,
  rewardXp INTEGER DEFAULT 0,
  rewardCoins INTEGER DEFAULT 0,
  classId UUID REFERENCES classes(id) ON DELETE SET NULL,
  teacherId UUID REFERENCES users(id) ON DELETE SET NULL,
  aiAssisted BOOLEAN DEFAULT FALSE,
  duration TEXT,
  topic TEXT,
  description TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Itens da Biblioteca (E-books, Videos, etc)
CREATE TABLE library_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  year TEXT,
  classId UUID REFERENCES classes(id) ON DELETE SET NULL,
  teacherId UUID REFERENCES users(id) ON DELETE SET NULL,
  downloads INTEGER DEFAULT 0,
  rating FLOAT DEFAULT 0,
  isOwn BOOLEAN DEFAULT FALSE,
  description TEXT,
  url TEXT,
  addedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Diário (IA)
CREATE TABLE diary_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studentId UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  isAIGenerated BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progresso nas Trilhas (Quais passos já fez)
CREATE TABLE student_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studentId UUID REFERENCES users(id) ON DELETE CASCADE,
  pathId UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  completedStepIds JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  startedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completedAt TIMESTAMP WITH TIME ZONE
);

-- Resultados das Atividades/Provas (Feedback, Respostas)
CREATE TABLE student_activity_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activityId UUID REFERENCES activities(id) ON DELETE CASCADE,
  studentId UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  score INTEGER,
  totalQuestions INTEGER,
  xpEarned INTEGER,
  coinsEarned INTEGER,
  completedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timeSpent INTEGER,
  responses JSONB DEFAULT '[]'::jsonb
);

-- =========================================
-- DUELOS & SUPORTE
-- =========================================

-- Duelos entre Alunos
CREATE TABLE duels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challengerId UUID REFERENCES users(id) ON DELETE CASCADE,
  challengedId UUID REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  questionCount INTEGER NOT NULL,
  status TEXT NOT NULL,
  challengerScore INTEGER DEFAULT 0,
  challengedScore INTEGER DEFAULT 0,
  winnerId TEXT,
  challengerTurnCompleted BOOLEAN DEFAULT FALSE,
  challengedTurnCompleted BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completedAt TIMESTAMP WITH TIME ZONE
);

-- Perguntas dos Duelos
CREATE TABLE duel_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  duelId UUID REFERENCES duels(id) ON DELETE CASCADE,
  questionText TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  challengerAnswerId TEXT,
  challengedAnswerId TEXT
);

-- Tickets de Suporte
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID REFERENCES users(id) ON DELETE CASCADE,
  userName TEXT NOT NULL,
  userRole TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  schoolId UUID REFERENCES schools(id) ON DELETE SET NULL,
  lastMessage TEXT,
  isReadByParticipant BOOLEAN DEFAULT TRUE,
  isReadByAdmin BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mensagens dos Tickets
CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticketId UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  senderId UUID REFERENCES users(id) ON DELETE CASCADE,
  senderName TEXT NOT NULL,
  senderRole TEXT,
  content TEXT NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notificações do Sistema
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  actionUrl TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
