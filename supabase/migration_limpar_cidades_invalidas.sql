-- ============================================================
-- Remove "cidades" que NÃO existem no IBGE (erro de localização)
-- Confirmado: "Leste" e "Betel" NÃO são municípios do Pará.
-- "Betel" aparece como rua em Tucuruí; "Leste" é região/avenida.
-- ============================================================

-- 1) Ver o que existe (rode e confira antes)
-- SELECT id, nome, cidade, uf FROM public.jogadores
-- WHERE cidade ILIKE '%leste%' OR cidade ILIKE '%betel%';
-- SELECT id, nome_completo, cidade, cidade_atual, uf FROM public.profiles
-- WHERE cidade ILIKE '%leste%' OR cidade ILIKE '%betel%'
--    OR cidade_atual ILIKE '%leste%' OR cidade_atual ILIKE '%betel%';

-- 2) Zera cidade inválida nos atletas (perfil de jogador)
UPDATE public.jogadores
SET
  cidade = NULL,
  uf = CASE
    WHEN cidade ILIKE '%leste%' OR cidade ILIKE '%betel%' THEN NULL
    ELSE uf
  END
WHERE
  cidade ILIKE '%leste%'
  OR cidade ILIKE '%betel%'
  OR lower(trim(cidade)) IN ('leste', 'betel');

-- 3) Zera cidade inválida nos perfis de usuário
UPDATE public.profiles
SET
  cidade = CASE
    WHEN cidade ILIKE '%leste%' OR cidade ILIKE '%betel%' OR lower(trim(coalesce(cidade,''))) IN ('leste','betel')
    THEN NULL ELSE cidade END,
  cidade_atual = CASE
    WHEN cidade_atual ILIKE '%leste%' OR cidade_atual ILIKE '%betel%' OR lower(trim(coalesce(cidade_atual,''))) IN ('leste','betel')
    THEN NULL ELSE cidade_atual END
WHERE
  cidade ILIKE '%leste%' OR cidade ILIKE '%betel%'
  OR cidade_atual ILIKE '%leste%' OR cidade_atual ILIKE '%betel%'
  OR lower(trim(coalesce(cidade,''))) IN ('leste','betel')
  OR lower(trim(coalesce(cidade_atual,''))) IN ('leste','betel');

-- 4) (Opcional) desativar atletas que ficaram sem nenhuma cidade legítima
-- UPDATE public.jogadores SET ativo = false
-- WHERE (cidade IS NULL OR trim(cidade) = '') AND ativo = true;

SELECT 'migration_limpar_cidades_invalidas aplicada' AS status;
