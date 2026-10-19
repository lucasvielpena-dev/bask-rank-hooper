-- ============================================================
-- v2: quem ficou sem cidade NÃO pode "aparecer" em Altamira
-- Zera também UF se a cidade era inválida; desativa atleta até
-- ele escolher localização de novo (opcional mas recomendado).
-- ============================================================

UPDATE public.jogadores
SET
  cidade = NULL,
  uf = NULL
WHERE
  cidade IS NULL
  OR trim(cidade) = ''
  OR cidade ILIKE '%leste%'
  OR cidade ILIKE '%betel%'
  OR lower(trim(cidade)) IN ('leste', 'betel');

-- Perfis: cidade e cidade_atual inválidas/vazias não herdam ranking alheio
UPDATE public.profiles
SET
  cidade = CASE
    WHEN cidade IS NULL OR trim(cidade) = ''
      OR cidade ILIKE '%leste%' OR cidade ILIKE '%betel%'
      OR lower(trim(cidade)) IN ('leste','betel')
    THEN NULL ELSE cidade END,
  cidade_atual = CASE
    WHEN cidade_atual IS NULL OR trim(cidade_atual) = ''
      OR cidade_atual ILIKE '%leste%' OR cidade_atual ILIKE '%betel%'
      OR lower(trim(cidade_atual)) IN ('leste','betel')
    THEN NULL ELSE cidade_atual END,
  uf = CASE
    WHEN (cidade_atual IS NULL OR trim(coalesce(cidade_atual,'')) = ''
          OR cidade_atual ILIKE '%leste%' OR cidade_atual ILIKE '%betel%'
          OR lower(trim(coalesce(cidade_atual,''))) IN ('leste','betel'))
     AND (cidade IS NULL OR trim(coalesce(cidade,'')) = ''
          OR cidade ILIKE '%leste%' OR cidade ILIKE '%betel%'
          OR lower(trim(coalesce(cidade,''))) IN ('leste','betel'))
    THEN NULL
    ELSE uf
  END
WHERE
  cidade ILIKE '%leste%' OR cidade ILIKE '%betel%'
  OR cidade_atual ILIKE '%leste%' OR cidade_atual ILIKE '%betel%'
  OR lower(trim(coalesce(cidade,''))) IN ('leste','betel')
  OR lower(trim(coalesce(cidade_atual,''))) IN ('leste','betel')
  OR cidade IS NULL OR trim(coalesce(cidade,'')) = ''
  OR cidade_atual IS NULL OR trim(coalesce(cidade_atual,'')) = '';

SELECT 'migration_limpar_cidades_invalidas_v2 aplicada' AS status;
