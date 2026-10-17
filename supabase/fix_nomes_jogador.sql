-- ============================================================
-- CORREÇÃO DOS NOMES GENÉRICOS ("Jogador", "Atleta" e e-mail)
-- ============================================================
-- PROBLEMA
--   O cadastro antigo gravava o e-mail (ou a palavra "Jogador") em
--   `profiles.nome_completo` e replicava em `jogadores.nome`. Resultado:
--   no ranking / na home o atleta aparecia como "Jogador" mesmo tendo apelido.
--
-- O QUE ESTE SCRIPT FAZ
--   Troca SÓ os valores genéricos pelo apelido real do perfil.
--   Quem já tem nome certo NÃO é tocado.
--
-- Segurança dos dados:
--   * O e-mail continua salvo em `profiles.email` (esta correção não apaga nada).
--   * Desativamos o trigger de sincronização durante o UPDATE de `profiles`
--     para não sobrescrever cidade/foto/posição dos atletas.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

-- ------------------------------------------------------------
-- 1) profiles.nome_completo  ->  apelido
-- ------------------------------------------------------------
ALTER TABLE public.profiles DISABLE TRIGGER trg_sincronizar_dados_jogador;

UPDATE public.profiles
SET nome_completo = TRIM(apelido)
WHERE apelido IS NOT NULL
  AND TRIM(apelido) <> ''
  AND LOWER(TRIM(apelido)) NOT IN ('jogador', 'jogadora', 'atleta', 'player', 'sem nome')
  AND (
    TRIM(nome_completo) = ''
    OR LOWER(TRIM(nome_completo)) IN ('jogador', 'jogadora', 'atleta', 'player', 'sem nome')
    OR nome_completo LIKE '%@%'
  );

ALTER TABLE public.profiles ENABLE TRIGGER trg_sincronizar_dados_jogador;

-- ------------------------------------------------------------
-- 2) jogadores.nome  ->  nome do perfil
-- ------------------------------------------------------------
UPDATE public.jogadores j
SET nome = TRIM(p.nome_completo)
FROM public.profiles p
WHERE (p.player_id = j.id OR (p.player_id IS NULL AND p.id = j.criado_por))
  AND p.nome_completo IS NOT NULL
  AND TRIM(p.nome_completo) <> ''
  AND (
    j.nome IS NULL
    OR TRIM(j.nome) = ''
    OR LOWER(TRIM(j.nome)) IN ('jogador', 'jogadora', 'atleta', 'player', 'sem nome')
    OR j.nome LIKE '%@%'
  );

-- ------------------------------------------------------------
-- 3) jogadores.apelido  ->  apelido do perfil
-- ------------------------------------------------------------
UPDATE public.jogadores j
SET apelido = TRIM(p.apelido)
FROM public.profiles p
WHERE (p.player_id = j.id OR (p.player_id IS NULL AND p.id = j.criado_por))
  AND p.apelido IS NOT NULL
  AND TRIM(p.apelido) <> ''
  AND (
    j.apelido IS NULL
    OR TRIM(j.apelido) = ''
    OR LOWER(TRIM(j.apelido)) IN ('jogador', 'jogadora', 'atleta', 'player', 'sem nome')
  );

-- ------------------------------------------------------------
-- 4) VERIFICAÇÃO
-- ------------------------------------------------------------
-- Atletas que ainda ficariam sem nome utilizável (devem ser poucos/zero):
SELECT COUNT(*) AS atletas_ainda_genericos
FROM public.jogadores
WHERE nome IS NULL
   OR TRIM(nome) = ''
   OR LOWER(TRIM(nome)) IN ('jogador', 'jogadora', 'atleta', 'player', 'sem nome')
   OR nome LIKE '%@%';

-- Prévia de como os nomes vão aparecer agora:
SELECT
  COALESCE(NULLIF(TRIM(apelido), ''), TRIM(nome)) AS nome_exibido,
  nome AS nome_cadastro,
  apelido
FROM public.jogadores
WHERE ativo = TRUE
ORDER BY created_at DESC
LIMIT 20;
