-- ============================================================
-- FIX URGENTE: remover FK jogadores_criado_por_fkey
-- Rode isto no SQL Editor do Supabase (uma vez)
-- ============================================================

-- Remove a constraint que está bloqueando o cadastro
ALTER TABLE public.jogadores
  DROP CONSTRAINT IF EXISTS jogadores_criado_por_fkey;

-- Garante profile para todos os usuários de auth
INSERT INTO public.profiles (id, email, nome_completo, cadastro_completo)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'nome',
    u.email,
    'Jogador'
  ),
  false
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- (Opcional) Recriar FK suave depois que estiver estável:
-- ALTER TABLE public.jogadores
--   ADD CONSTRAINT jogadores_criado_por_fkey
--   FOREIGN KEY (criado_por) REFERENCES public.profiles(id)
--   ON DELETE SET NULL;
