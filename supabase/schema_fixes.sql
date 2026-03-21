-- 1. Descobrir o nome exato das constraints
-- Geralmente o Supabase cria algo como student_avatar_profiles_selectedAvatarId_fkey
-- Se os seguintes comandos falharem dizendo que a constraint não existe, vc precisará olhar no painel e substituir o nome!
ALTER TABLE public.student_avatar_profiles
  DROP CONSTRAINT IF EXISTS "student_avatar_profiles_selectedAvatarId_fkey",
  DROP CONSTRAINT IF EXISTS "student_avatar_profiles_selectedBackgroundId_fkey",
  DROP CONSTRAINT IF EXISTS "student_avatar_profiles_selectedBorderId_fkey";

-- 2. Recriar apontando para o catálogo de avatares direto, pois o ID que passamos é o da loja (avatar_catalog)
ALTER TABLE public.student_avatar_profiles
  ADD CONSTRAINT "student_avatar_profiles_selectedAvatarId_fkey"
  FOREIGN KEY ("selectedAvatarId") REFERENCES public.avatar_catalog(id) ON DELETE SET NULL;

ALTER TABLE public.student_avatar_profiles
  ADD CONSTRAINT "student_avatar_profiles_selectedBackgroundId_fkey"
  FOREIGN KEY ("selectedBackgroundId") REFERENCES public.avatar_catalog(id) ON DELETE SET NULL;

ALTER TABLE public.student_avatar_profiles
  ADD CONSTRAINT "student_avatar_profiles_selectedBorderId_fkey"
  FOREIGN KEY ("selectedBorderId") REFERENCES public.avatar_catalog(id) ON DELETE SET NULL;

-- 3. Desativar RLS na tabela library_items, já que a migração de Auth do Supabase ainda não usa tokens JWT reais do auth.users, as requisições vêm como "anon".
ALTER TABLE public.library_items DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.library_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.library_items;
DROP POLICY IF EXISTS "Enable update for library_items based on teacherId" ON public.library_items;
DROP POLICY IF EXISTS "Enable delete for library_items based on teacherId" ON public.library_items;

-- 4. Garantir que as tabelas de avatar existem (Erro 406 no client indica que o cache do PostgREST não as encontrou ou não foram criadas)
CREATE TABLE IF NOT EXISTS public.avatar_catalog (
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

CREATE TABLE IF NOT EXISTS public.student_owned_avatars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "studentId" UUID REFERENCES public.users(id) ON DELETE CASCADE,
  "catalogItemId" UUID REFERENCES public.avatar_catalog(id) ON DELETE CASCADE,
  "acquiredAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "acquisitionType" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_avatar_profiles (
  "studentId" UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  "selectedAvatarId" UUID REFERENCES public.student_owned_avatars(id),
  "selectedBackgroundId" UUID REFERENCES public.student_owned_avatars(id),
  "selectedBorderId" UUID REFERENCES public.student_owned_avatars(id),
  "equippedStickerIds" JSONB DEFAULT '[]'::jsonb,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "equippedItems" JSONB,
  "skinTone" TEXT,
  "colorOverrides" JSONB
);

-- Recarregar cache do schema
NOTIFY pgrst, 'reload schema';

-- 5. Fix duplicate achievements and add unique constraint
DELETE FROM public.student_achievements a
USING public.student_achievements b
WHERE a.ctid > b.ctid 
  AND a."studentId" = b."studentId" 
  AND a."achievementId" = b."achievementId";

ALTER TABLE public.student_achievements 
ADD CONSTRAINT student_achievements_unique_student_achievement 
UNIQUE ("studentId", "achievementId");

-- 6. Disable RLS for support and notifications (temporary fix while auth migration is in progress)
ALTER TABLE public.support_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
