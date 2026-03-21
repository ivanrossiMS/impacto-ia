-- 1. Adicionar coluna difficulty em activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS difficulty TEXT;

-- 2. Adicionar coluna createdAt em gamification_stats e student_activity_results
ALTER TABLE public.gamification_stats ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.student_activity_results ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Desativar RLS na tabela library_items, já que a migração de Auth do Supabase ainda não usa tokens JWT reais do auth.users, as requisições vêm como "anon".
ALTER TABLE public.library_items DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.library_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.library_items;
DROP POLICY IF EXISTS "Enable update for library_items based on teacherId" ON public.library_items;
DROP POLICY IF EXISTS "Enable delete for library_items based on teacherId" ON public.library_items;
