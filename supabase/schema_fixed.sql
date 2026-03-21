-- =========================================
-- SCRIPT DE CORREÇÃO (CASE-SENSITIVE)
-- Execute este script no SQL Editor do Supabase 
-- =========================================

-- Limpar as tabelas antigas que foram criadas com o nome errado (em lowercase)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS ticket_messages CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS duel_questions CASCADE;
DROP TABLE IF EXISTS duels CASCADE;
DROP TABLE IF EXISTS student_activity_results CASCADE;
DROP TABLE IF EXISTS student_progress CASCADE;
DROP TABLE IF EXISTS diary_entries CASCADE;
DROP TABLE IF EXISTS library_items CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS learning_paths CASCADE;
DROP TABLE IF EXISTS student_missions CASCADE;
DROP TABLE IF EXISTS missions CASCADE;
DROP TABLE IF EXISTS student_achievements CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS avatar_campaigns CASCADE;
DROP TABLE IF EXISTS avatar_collections CASCADE;
DROP TABLE IF EXISTS student_avatar_profiles CASCADE;
DROP TABLE IF EXISTS student_owned_avatars CASCADE;
DROP TABLE IF EXISTS avatar_catalog CASCADE;
DROP TABLE IF EXISTS gamification_stats CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS schools CASCADE;

-- 1. Criação das Extensões Necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- TABELAS PRINCIPAIS
-- =========================================

CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  "usersCount" INTEGER DEFAULT 0,
  "globalScore" INTEGER DEFAULT 0,
  logo TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT,
  year TEXT,
  "schoolId" UUID REFERENCES schools(id) ON DELETE SET NULL,
  "teacherId" TEXT,
  "studentIds" JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('student', 'guardian', 'teacher', 'admin')),
  name TEXT NOT NULL,
  email TEXT,
  "isRegistered" BOOLEAN DEFAULT FALSE,
  "schoolId" UUID REFERENCES schools(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  avatar TEXT,
  "isMaster" BOOLEAN DEFAULT FALSE,
  "studentCode" TEXT,
  "guardianCode" TEXT,
  "passwordHash" TEXT,
  "birthDate" TIMESTAMP WITH TIME ZONE,
  grade TEXT,
  "classId" UUID REFERENCES classes(id) ON DELETE SET NULL,
  "guardianIds" JSONB DEFAULT '[]'::jsonb,
  "studentIds" JSONB DEFAULT '[]'::jsonb,
  "classIds" JSONB DEFAULT '[]'::jsonb,
  subjects JSONB DEFAULT '[]'::jsonb
);

-- =========================================
-- GAMIFICAÇÃO & AVATAR
-- =========================================

CREATE TABLE gamification_stats (
  id UUID PRIMARY KEY,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  "lastStudyDate" TIMESTAMP WITH TIME ZONE,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE avatar_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  "assetUrl" TEXT NOT NULL,
  "previewUrl" TEXT,
  type TEXT NOT NULL,
  category TEXT,
  rarity TEXT NOT NULL,
  "priceCoins" INTEGER NOT NULL,
  "isFree" BOOLEAN DEFAULT FALSE,
  "isFeatured" BOOLEAN DEFAULT FALSE,
  "isEventLimited" BOOLEAN DEFAULT FALSE,
  "isRecommended" BOOLEAN DEFAULT FALSE,
  "isActive" INTEGER DEFAULT 1,
  "sortOrder" INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "imageUrl" TEXT,
  "isPremium" BOOLEAN DEFAULT FALSE
);

CREATE TABLE student_owned_avatars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "studentId" UUID REFERENCES users(id) ON DELETE CASCADE,
  "catalogItemId" UUID REFERENCES avatar_catalog(id) ON DELETE CASCADE,
  "acquiredAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "acquisitionType" TEXT NOT NULL
);

CREATE TABLE student_avatar_profiles (
  "studentId" UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  "selectedAvatarId" UUID REFERENCES student_owned_avatars(id),
  "selectedBackgroundId" UUID REFERENCES student_owned_avatars(id),
  "selectedBorderId" UUID REFERENCES student_owned_avatars(id),
  "equippedStickerIds" JSONB DEFAULT '[]'::jsonb,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "equippedItems" JSONB,
  "skinTone" TEXT,
  "colorOverrides" JSONB
);

CREATE TABLE avatar_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  "bannerUrl" TEXT,
  "isActive" INTEGER DEFAULT 1,
  "isEvent" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE avatar_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "rewardType" TEXT NOT NULL,
  "relatedItemIds" JSONB DEFAULT '[]'::jsonb,
  "isActive" INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  condition TEXT NOT NULL,
  "rewardXp" INTEGER NOT NULL,
  "rewardCoins" INTEGER NOT NULL
);

CREATE TABLE student_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "studentId" UUID REFERENCES users(id) ON DELETE CASCADE,
  "achievementId" UUID REFERENCES achievements(id) ON DELETE CASCADE,
  "unlockedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "rewardXp" INTEGER NOT NULL,
  "rewardCoins" INTEGER NOT NULL,
  criteria TEXT,
  "expiresAt" TIMESTAMP WITH TIME ZONE,
  "requiredLevel" INTEGER
);

CREATE TABLE student_missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "studentId" UUID REFERENCES users(id) ON DELETE CASCADE,
  "missionId" UUID REFERENCES missions(id) ON DELETE CASCADE,
  "currentCount" INTEGER DEFAULT 0,
  "completedAt" TIMESTAMP WITH TIME ZONE,
  "claimedAt" TIMESTAMP WITH TIME ZONE
);

-- =========================================
-- APRENDIZAGEM & ATIVIDADES
-- =========================================

CREATE TABLE learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  description TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  "rewardCoins" INTEGER DEFAULT 0,
  "rewardXp" INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0,
  "classId" UUID REFERENCES classes(id) ON DELETE SET NULL,
  "schoolYear" TEXT,
  "isAIGenerated" BOOLEAN DEFAULT FALSE,
  "schoolId" UUID REFERENCES schools(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  "questionText" TEXT,
  options JSONB,
  explanation TEXT,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  questions JSONB DEFAULT '[]'::jsonb,
  "rewardXp" INTEGER DEFAULT 0,
  "rewardCoins" INTEGER DEFAULT 0,
  "classId" UUID REFERENCES classes(id) ON DELETE SET NULL,
  "teacherId" UUID REFERENCES users(id) ON DELETE SET NULL,
  "aiAssisted" BOOLEAN DEFAULT FALSE,
  duration TEXT,
  topic TEXT,
  description TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE library_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  year TEXT,
  "classId" UUID REFERENCES classes(id) ON DELETE SET NULL,
  "teacherId" UUID REFERENCES users(id) ON DELETE SET NULL,
  downloads INTEGER DEFAULT 0,
  rating FLOAT DEFAULT 0,
  "isOwn" BOOLEAN DEFAULT FALSE,
  description TEXT,
  url TEXT,
  "addedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE diary_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "studentId" UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  "isAIGenerated" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE student_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "studentId" UUID REFERENCES users(id) ON DELETE CASCADE,
  "pathId" UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  "completedStepIds" JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "completedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE student_activity_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "activityId" UUID REFERENCES activities(id) ON DELETE CASCADE,
  "studentId" UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  score INTEGER,
  "totalQuestions" INTEGER,
  "xpEarned" INTEGER,
  "coinsEarned" INTEGER,
  "completedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "timeSpent" INTEGER,
  responses JSONB DEFAULT '[]'::jsonb
);

-- =========================================
-- DUELOS & SUPORTE
-- =========================================

CREATE TABLE duels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "challengerId" UUID REFERENCES users(id) ON DELETE CASCADE,
  "challengedId" UUID REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  "questionCount" INTEGER NOT NULL,
  status TEXT NOT NULL,
  "challengerScore" INTEGER DEFAULT 0,
  "challengedScore" INTEGER DEFAULT 0,
  "winnerId" TEXT,
  "challengerTurnCompleted" BOOLEAN DEFAULT FALSE,
  "challengedTurnCompleted" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "completedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE duel_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "duelId" UUID REFERENCES duels(id) ON DELETE CASCADE,
  "questionText" TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  "challengerAnswerId" TEXT,
  "challengedAnswerId" TEXT
);

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
  "userName" TEXT NOT NULL,
  "userRole" TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  "schoolId" UUID REFERENCES schools(id) ON DELETE SET NULL,
  "lastMessage" TEXT,
  "isReadByParticipant" BOOLEAN DEFAULT TRUE,
  "isReadByAdmin" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "ticketId" UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  "senderId" UUID REFERENCES users(id) ON DELETE CASCADE,
  "senderName" TEXT NOT NULL,
  "senderRole" TEXT,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  "actionUrl" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- INSERÇÃO DO PRIMEIRO ADMINISTRADOR
-- =========================================

INSERT INTO users (
  id, 
  role, 
  name, 
  email, 
  "isRegistered", 
  "isMaster", 
  "passwordHash",
  status
) 
VALUES (
  uuid_generate_v4(), 
  'admin', 
  'Ivan Rossi Master', 
  'ivanrossi@outlook.com', 
  true, 
  true, 
  'ivanrossi',
  'active'
);
