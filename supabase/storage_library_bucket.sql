-- =====================================================
-- SUPABASE STORAGE: bucket library-files
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================

-- 1. Criar o bucket público (se ainda não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('library-files', 'library-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: permitir upload por qualquer usuário (anon ou autenticado)
--    Isso segue o mesmo padrão do RLS desativado na tabela library_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'library-files: allow public uploads'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "library-files: allow public uploads"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'library-files');
    $policy$;
  END IF;
END $$;

-- 3. Política: permitir leitura pública dos arquivos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'library-files: allow public reads'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "library-files: allow public reads"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'library-files');
    $policy$;
  END IF;
END $$;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- SELECT id, name, public FROM storage.buckets WHERE id = 'library-files';
