-- Tabela para armazenar itens da biblioteca (materiais, vídeos, quizzes, textos, áudios)

CREATE TABLE IF NOT EXISTS public.library_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    "year" TEXT,
    "classId" UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    "teacherId" UUID REFERENCES public.users(id) ON DELETE CASCADE,
    downloads INTEGER DEFAULT 0,
    rating NUMERIC(3,1) DEFAULT 0,
    "isOwn" BOOLEAN DEFAULT false,
    description TEXT,
    url TEXT,
    "addedAt" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Configurações de RLS (Row Level Security)
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.library_items FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.library_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for library_items based on teacherId" ON public.library_items FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM auth.users WHERE auth.users.id = library_items."teacherId"
    )
);

CREATE POLICY "Enable delete for library_items based on teacherId" ON public.library_items FOR DELETE USING (
    auth.uid() IN (
        SELECT id FROM auth.users WHERE auth.users.id = library_items."teacherId"
    )
);

-- Ativar Realtime para a tabela library_items
ALTER PUBLICATION supabase_realtime ADD TABLE library_items;
