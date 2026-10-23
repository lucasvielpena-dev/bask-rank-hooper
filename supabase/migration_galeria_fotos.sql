-- Fase 1: galeria de fotos no perfil (max 5)
-- Cole no SQL Editor do Supabase (arquivo / Raw GitHub).

CREATE TABLE IF NOT EXISTS public.midia_jogador (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jogador_id UUID REFERENCES public.jogadores(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  storage_path TEXT,
  tipo TEXT NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'video')),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_midia_usuario ON public.midia_jogador(usuario_id);
CREATE INDEX IF NOT EXISTS idx_midia_tipo ON public.midia_jogador(tipo);

ALTER TABLE public.midia_jogador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "midia_select_all" ON public.midia_jogador;
CREATE POLICY "midia_select_all" ON public.midia_jogador
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "midia_insert_own" ON public.midia_jogador;
CREATE POLICY "midia_insert_own" ON public.midia_jogador
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "midia_update_own" ON public.midia_jogador;
CREATE POLICY "midia_update_own" ON public.midia_jogador
  FOR UPDATE USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "midia_delete_own" ON public.midia_jogador;
CREATE POLICY "midia_delete_own" ON public.midia_jogador
  FOR DELETE USING (auth.uid() = usuario_id);

-- Storage: usa o bucket avatars (ja existente), pasta galeria/{userId}/
-- Se as policies do bucket so permitem path avatars/, ajuste no painel:
-- Storage > avatars > Policies > permitir upload quando
-- (storage.foldername(name))[1] = 'galeria' AND (storage.foldername(name))[2] = auth.uid()::text

SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='midia_jogador') AS tabela_ok,
  (SELECT count(*) FROM pg_policies WHERE tablename='midia_jogador') AS policies;
