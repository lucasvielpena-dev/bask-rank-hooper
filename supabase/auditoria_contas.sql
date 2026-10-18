-- ============================================================================
-- AUDITORIA DE CONTAS + CONSERTO DO "SUSPENDER" E DO "EXCLUIR" (aba Master)
-- ----------------------------------------------------------------------------
-- Rode os blocos na ordem, no SQL Editor do Supabase. Cada bloco é
-- independente: se um der erro, os outros continuam valendo.
--
-- O QUE ESTAVA ERRADO (resumo):
--   1) "Suspender" na aba Master gravava profiles.is_active = false, mas o app
--      NUNCA lia essa coluna. Ou seja: suspender não bloqueava nada — a pessoa
--      continuava entrando, votando e criando rachão normalmente.
--      -> Isso já foi corrigido no app (aparece a tela "Conta suspensa").
--   2) O painel mostrava todo mundo como "Ativo" e o botão sempre "Suspender",
--      porque lia user.ativo, e o RPC devolve is_active. Corrigido no app.
--   3) Suspender a CONTA não tira o ATLETA do ranking (são coisas separadas:
--      profiles.is_active x jogadores.ativo). BLOCO 1 resolve.
--   4) "Excluir usuário" apagava só a linha de profiles. O login continua
--      existindo no auth.users, então no próximo acesso o app recriava um
--      perfil novo e a pessoa voltava — parecia que a exclusão não funcionou.
--      BLOCO 2 resolve.
-- ============================================================================


-- ============================================================================
-- BLOCO 0 — VER: quem tem mais de uma conta (possíveis duplicatas)
-- ----------------------------------------------------------------------------
-- Procura pessoas com o mesmo nome (ignorando maiúsculas/espaços) ou o mesmo
-- apelido. Também mostra se cada conta está ativa ou suspensa.
-- ============================================================================
WITH base AS (
  SELECT
    id,
    nome_completo,
    apelido,
    email,
    cidade,
    uf,
    role,
    COALESCE(is_active, TRUE) AS is_active,
    last_seen,
    created_at,
    lower(regexp_replace(coalesce(nome_completo, ''), '\s+', ' ', 'g')) AS nome_norm,
    lower(regexp_replace(coalesce(apelido, ''), '\s+', ' ', 'g'))       AS apelido_norm
  FROM public.profiles
)
SELECT
  b.nome_completo,
  b.apelido,
  b.email,
  b.cidade,
  CASE WHEN b.is_active THEN 'ativo' ELSE 'SUSPENSO' END AS status,
  b.role,
  b.created_at::date  AS criado_em,
  b.last_seen         AS ultimo_acesso,
  CASE
    WHEN b.nome_norm <> '' AND (SELECT count(*) FROM base x WHERE x.nome_norm = b.nome_norm) > 1
      THEN 'MESMO NOME'
    WHEN b.apelido_norm <> '' AND (SELECT count(*) FROM base x WHERE x.apelido_norm = b.apelido_norm) > 1
      THEN 'MESMO APELIDO'
    ELSE ''
  END AS suspeita
FROM base b
WHERE
  (b.nome_norm <> '' AND (SELECT count(*) FROM base x WHERE x.nome_norm = b.nome_norm) > 1)
  OR (b.apelido_norm <> '' AND (SELECT count(*) FROM base x WHERE x.apelido_norm = b.apelido_norm) > 1)
ORDER BY b.nome_norm, b.created_at;

-- Se este bloco voltar vazio, não há contas com nome/apelido repetido.
-- Lembrando: a mesma pessoa pode ter criado contas com e-mails diferentes
-- (aí o nome aparece repetido) — e é justamente o que o BLOCO 3 resolve.


-- ============================================================================
-- BLOCO 1 — CONSERTAR: suspender a conta também tira o atleta do ranking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_user_id UUID,
  p_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'master' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Apenas o master pode alterar status de usuários.');
  END IF;

  UPDATE public.profiles
     SET is_active = p_active
   WHERE id = p_user_id;

  -- O atleta da conta (na tabela jogadores) também sai/volta do ranking.
  -- Sem isto, a pessoa sumia do app mas continuava aparecendo na lista e nas
  -- médias do Ranking.
  UPDATE public.jogadores
     SET ativo = p_active
   WHERE criado_por = p_user_id
      OR id = (SELECT player_id FROM public.profiles
                WHERE id = p_user_id AND player_id IS NOT NULL);

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id, details)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          CASE WHEN p_active THEN 'activate_user' ELSE 'suspend_user' END,
          'user', p_user_id, NULL);

  RETURN jsonb_build_object('sucesso', TRUE);
END;
$$;


-- ============================================================================
-- BLOCO 2 — CONSERTAR: "Excluir" bloqueia de verdade e apaga os dados
-- ----------------------------------------------------------------------------
-- O que ele faz agora:
--   * marca a conta como suspensa (a pessoa cai na tela "Conta suspensa");
--   * apaga os dados pessoais (nome, apelido, foto, cidade, posição...);
--   * tira os atletas dela do ranking;
--   * MANTÉM o login cadastrado — é isso que impede a pessoa de criar outra
--     conta com o mesmo e-mail e voltar como se nada tivesse acontecido.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
  v_target_name TEXT;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();
  IF v_admin_role != 'master' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Apenas o master pode excluir usuários.');
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Você não pode excluir sua própria conta.');
  END IF;

  SELECT nome_completo INTO v_target_name FROM public.profiles WHERE id = p_user_id;

  UPDATE public.profiles
     SET is_active         = FALSE,
         cadastro_completo = FALSE,   -- impede o gatilho de recriar o atleta
         nome_completo     = 'Conta suspensa',
         apelido           = NULL,
         foto_perfil       = NULL,
         cidade            = NULL,
         uf                = NULL,
         cidade_atual      = NULL,
         posicao           = NULL,
         altura            = NULL,
         idade             = NULL,
         player_id         = NULL,
         is_player         = FALSE
   WHERE id = p_user_id;

  UPDATE public.jogadores
     SET ativo = FALSE
   WHERE criado_por = p_user_id;

  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id, target_name)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          'delete_user', 'user', p_user_id, v_target_name);

  RETURN jsonb_build_object('sucesso', TRUE);
END;
$$;


-- ============================================================================
-- BLOCO 3 — SUSPENDER AGORA uma conta específica (por e-mail)
-- ----------------------------------------------------------------------------
-- Troque o e-mail na primeira linha e rode. Depois disso a pessoa, ao abrir o
-- app, cai na tela "Conta suspensa" — e o atleta dela sai do ranking.
-- ============================================================================
DO $$
DECLARE
  v_email   TEXT := 'email-da-conta-duplicada@exemplo.com';
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE lower(email) = lower(v_email);

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Nenhuma conta encontrada com o e-mail %', v_email;
    RETURN;
  END IF;

  UPDATE public.profiles SET is_active = FALSE WHERE id = v_user_id;

  UPDATE public.jogadores SET ativo = FALSE
   WHERE criado_por = v_user_id
      OR id = (SELECT player_id FROM public.profiles WHERE id = v_user_id AND player_id IS NOT NULL);

  RAISE NOTICE 'Conta % suspensa e atleta(s) fora do ranking.', v_email;
END $$;

-- Para REATIVAR depois (mesma ideia, só descomentar e trocar o e-mail):
-- DO $$
-- DECLARE v_user_id UUID;
-- BEGIN
--   SELECT id INTO v_user_id FROM public.profiles WHERE lower(email) = lower('email@exemplo.com');
--   UPDATE public.profiles SET is_active = TRUE WHERE id = v_user_id;
--   UPDATE public.jogadores SET ativo = TRUE WHERE id = (SELECT player_id FROM public.profiles WHERE id = v_user_id);
-- END $$;


-- ============================================================================
-- BLOCO 4 — EXCLUIR DE VEZ uma conta (por e-mail) — direto no SQL Editor
-- ----------------------------------------------------------------------------
-- Isto apaga o LOGIN (auth.users). É irreversível e só dá para fazer aqui (o
-- app não tem permissão para isso). Só use quando tiver certeza de que é uma
-- conta duplicada/lixo. Se o banco tiver dependências, o DELETE pode dar erro
-- de chave estrangeira — nesse caso use o BLOCO 3 (suspender) que resolve.
-- ============================================================================
-- DELETE FROM auth.users WHERE lower(email) = lower('email-da-conta-duplicada@exemplo.com');
