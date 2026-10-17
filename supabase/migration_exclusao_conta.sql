-- ============================================================
--  EXCLUSAO DE CONTA PELO PROPRIO USUARIO
-- ============================================================
--  A Google Play exige (politica "Account Deletion") que todo app
--  que permite criar conta ofereca:
--    1) um caminho DENTRO do app para excluir a conta e os dados; e
--    2) um link na web para pedir a exclusao.
--
--  Esta RPC resolve o item (1). O item (2) e a pagina
--  /privacidade.html (secao "Excluir sua conta").
--
--  COMO RODAR: cole tudo isto no SQL Editor do Supabase e execute.
--  Seguro rodar mais de uma vez (CREATE OR REPLACE).
--
--  O QUE A FUNCAO FAZ, nesta ordem:
--    1. So age sobre auth.uid() -> ninguem apaga a conta de outro.
--    2. Desvincula (criado_por = NULL) os registros que o usuario
--       criou mas que pertencem a comunidade: atletas (jogadores),
--       partidas, jogos, racoes, torneios. NAO apaga os dados
--       compartilhados, apenas o vinculo com quem saiu.
--    3. Apaga o profile -> o ON DELETE CASCADE limpa o que e dele:
--       votos, avaliacoes, avaliacoes_jogo, racoes_participantes,
--       notificacoes, torneio_jogadores, denuncias.
--    4. Apaga o usuario do auth (auth.users).
--  Tudo roda em uma transacao: se algo falhar, nada e aplicado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.excluir_minha_conta()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_email  TEXT;
  v_tabela TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Usuario nao autenticado.');
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;

  -- (2) desvincula o que o usuario criou para a comunidade
  FOR v_tabela IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name  = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name  = 'criado_por'
      AND t.table_type   = 'BASE TABLE'
  LOOP
    EXECUTE format('UPDATE public.%I SET criado_por = NULL WHERE criado_por = $1', v_tabela)
      USING v_uid;
  END LOOP;

  -- registra a saida (o log fica, o vinculo vira NULL automaticamente)
  INSERT INTO public.admin_logs (admin_id, admin_email, action, target_type, target_id, target_name)
  VALUES (v_uid, v_email, 'self_delete_account', 'user', v_uid, v_email);

  -- (3) apaga o perfil (cascata limpa os dados pessoais)
  DELETE FROM public.profiles WHERE id = v_uid;

  -- (4) apaga o login
  DELETE FROM auth.users WHERE id = v_uid;

  RETURN jsonb_build_object('sucesso', TRUE, 'email', v_email);

EXCEPTION WHEN others THEN
  -- qualquer erro cancela tudo (transacao atomica) e volta legivel
  RETURN jsonb_build_object('sucesso', FALSE, 'erro', SQLERRM);
END;
$$;

-- Somente usuario logado pode chamar; nunca o anonimo.
REVOKE ALL ON FUNCTION public.excluir_minha_conta() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_minha_conta() FROM anon;
GRANT EXECUTE ON FUNCTION public.excluir_minha_conta() TO authenticated;

-- ============================================================
--  CONFERENCIA (opcional) - mostra o que ainda aponta para o usuario
--  Troque o e-mail e rode para ver se sobrou algum vinculo.
-- ============================================================
-- SELECT 'jogadores' AS tabela, count(*) FROM public.jogadores WHERE criado_por = (SELECT id FROM auth.users WHERE email = 'seu@email.com')
-- UNION ALL SELECT 'partidas', count(*) FROM public.partidas WHERE criado_por = (SELECT id FROM auth.users WHERE email = 'seu@email.com');
