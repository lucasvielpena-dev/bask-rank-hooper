-- ============================================================
-- FIX: jogadores_criado_por_fkey
-- Erro: insert/update violates foreign key "jogadores_criado_por_fkey"
-- ============================================================
-- Causa: criado_por deve existir em auth.users(id).
-- Às vezes o profile.id não bate com o usuário logado, ou o FK
-- está mais rígido do que o app precisa.
-- ============================================================

-- 1) Ver diagnósticos (rode e confira o resultado)
-- SELECT j.id, j.nome, j.criado_por,
--   EXISTS (SELECT 1 FROM auth.users u WHERE u.id = j.criado_por) AS em_auth,
--   EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = j.criado_por) AS em_profiles
-- FROM public.jogadores j
-- WHERE j.criado_por IS NOT NULL
-- LIMIT 50;

-- 2) Limpar criado_por órfãos (apontam para quem não existe em auth.users)
UPDATE public.jogadores j
SET criado_por = NULL
WHERE j.criado_por IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = j.criado_por);

-- 3) Recriar a FK de forma mais segura:
--    referencia profiles (que por sua vez referencia auth.users)
--    e permite NULL + ON DELETE SET NULL
ALTER TABLE public.jogadores
  DROP CONSTRAINT IF EXISTS jogadores_criado_por_fkey;

ALTER TABLE public.jogadores
  ADD CONSTRAINT jogadores_criado_por_fkey
  FOREIGN KEY (criado_por)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- 4) Garantir que todo usuário autenticado tenha profile
-- (evita o mesmo erro no futuro)
INSERT INTO public.profiles (id, email, nome_completo, cadastro_completo)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'nome', u.email, 'Jogador'),
  false
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Pronto. Tente cadastrar o jogador de novo no app.
