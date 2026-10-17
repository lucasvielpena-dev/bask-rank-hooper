-- ============================================================
-- PLACAR COMPARTILHADO — pedido + aceite de quem criou a partida
-- ============================================================
-- PROBLEMA
--   `partidas` so aceita UPDATE de quem criou a partida
--   (policy partidas_update_own, do migration_rls_hardening.sql).
--   Como o app adota automaticamente a partida ativa de qualquer pessoa
--   logada (Jogos.jsx), o segundo celular na quadra pode digitar o placar
--   e NADA e salvo — e o app engolia o erro em silencio
--   (sincronizarPlacarBanco nao conferia o retorno).
--
-- SOLUCAO (o desenho escolhido: pedido + aceite)
--   1. O segundo celular PEDE para operar o placar.
--   2. O criador recebe o pedido na tela da partida (aviso em tempo real)
--      e aceita ou recusa.
--   3. So depois de aceito o placar grava. Partida encerrada ninguem mais
--      mexe (nem operador autorizado) — apenas o criador.
--
-- PADRAO DO RESTO DO APP
--   Tabela fechada (nenhuma policy de escrita) + tudo por RPC
--   SECURITY DEFINER, e o anon sem privilegio algum.
--
-- IDEMPOTENTE — pode rodar mais de uma vez. Rode no SQL Editor.
-- ============================================================


-- ------------------------------------------------------------
-- 0) Defesa: o publicador de avisos precisa existir
--    (migration_realtime_broadcast.sql cria os dois; se por algum
--     motivo a tabela de controle nao estiver no banco, criamos aqui.
--     Assim o gatilho novo nunca quebra por causa disso.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.realtime_pings (
  topico     TEXT PRIMARY KEY,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.realtime_pings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.realtime_pings FROM anon, authenticated;


-- ------------------------------------------------------------
-- 1) TABELA DE OPERADORES
--    aprovado = FALSE  -> pedido esperando resposta do criador
--    aprovado = TRUE   -> liberado para gravar o placar
--    recusa            -> a linha e apagada (pode pedir de novo depois)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partida_operadores (
  partida_id    UUID NOT NULL REFERENCES public.partidas(id)  ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  nome          TEXT,                       -- rotulo de quem pediu (evita join na tela)
  aprovado      BOOLEAN NOT NULL DEFAULT FALSE,
  pedido_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondido_em TIMESTAMPTZ,
  PRIMARY KEY (partida_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_partida_operadores_usuario
  ON public.partida_operadores(usuario_id);

ALTER TABLE public.partida_operadores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partida_operadores FROM anon;
GRANT SELECT ON public.partida_operadores TO authenticated;

-- Leitura: eu vejo o meu proprio pedido; o criador ve todos os da partida dele.
DROP POLICY IF EXISTS partida_operadores_select ON public.partida_operadores;
CREATE POLICY partida_operadores_select ON public.partida_operadores
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.partidas p
      WHERE p.id = partida_id
        AND p.criado_por = auth.uid()
    )
  );

-- Nenhuma policy de INSERT/UPDATE/DELETE de proposito: quem escreve sao
-- apenas as RPCs SECURITY DEFINER abaixo.


-- ------------------------------------------------------------
-- 2) QUEM PODE GRAVAR O PLACAR?
--    Usada dentro da policy da tabela `partidas` (SECURITY DEFINER para
--    nao depender de RLS dentro de RLS).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_operar_partida(p_partida_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.partida_operadores o
    WHERE o.partida_id = p_partida_id
      AND o.usuario_id = auth.uid()
      AND o.aprovado IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.pode_operar_partida(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_operar_partida(UUID) TO authenticated;


-- ------------------------------------------------------------
-- 3) POLICY DA PARTIDA
--    USING      -> o que a pessoa pode enxergar para editar agora
--    WITH CHECK -> o que ela pode deixar gravado depois da edicao
--
--    Antes:  criado_por = auth.uid() OR criado_por IS NULL
--    Agora:  dono, ou operador aceito enquanto a partida esta em andamento
--    (o operador consegue ENCERRAR a partida, mas nao editar depois disso)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS partidas_update_own ON public.partidas;
CREATE POLICY partidas_update_own ON public.partidas
  FOR UPDATE TO authenticated
  USING (
    criado_por = auth.uid()
    OR (status = 'ativo' AND public.pode_operar_partida(id))
  )
  WITH CHECK (
    criado_por = auth.uid()
    OR (status IN ('ativo', 'finalizado') AND public.pode_operar_partida(id))
  );


-- ------------------------------------------------------------
-- 4) RPC: PEDIR PARA OPERAR
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedir_operar_partida(p_partida_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_partida public.partidas%ROWTYPE;
  v_pedido  public.partida_operadores%ROWTYPE;
  v_nome    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Voce precisa estar logado.');
  END IF;

  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Partida nao encontrada.');
  END IF;

  IF v_partida.status <> 'ativo' THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Esta partida ja foi encerrada.');
  END IF;

  -- Quem criou nao precisa de permissao.
  IF v_partida.criado_por = v_uid THEN
    RETURN jsonb_build_object('sucesso', TRUE, 'dono', TRUE);
  END IF;

  SELECT * INTO v_pedido
  FROM public.partida_operadores
  WHERE partida_id = p_partida_id AND usuario_id = v_uid;

  IF FOUND THEN
    IF v_pedido.aprovado IS TRUE THEN
      RETURN jsonb_build_object('sucesso', TRUE, 'ja_autorizado', TRUE);
    END IF;
    -- Ja existe pedido esperando: nao gera aviso de novo (evita spam).
    RETURN jsonb_build_object('sucesso', TRUE, 'pendente', TRUE);
  END IF;

  -- Nome de quem pede, so para o criador saber quem e.
  SELECT COALESCE(NULLIF(j.apelido, ''), j.nome, NULLIF(p.apelido, ''), p.nome_completo)
    INTO v_nome
    FROM public.profiles p
    LEFT JOIN public.jogadores j ON j.id = p.player_id
   WHERE p.id = v_uid;
  v_nome := COALESCE(v_nome, 'Um atleta');

  INSERT INTO public.partida_operadores (partida_id, usuario_id, nome, aprovado, pedido_em)
  VALUES (p_partida_id, v_uid, v_nome, FALSE, NOW());

  -- Aviso duradouro (aparece na lista de notificacoes do criador).
  IF v_partida.criado_por IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, titulo, mensagem)
    VALUES (
      v_partida.criado_por,
      'Placar compartilhado',
      v_nome || ' pediu para operar o placar de ' || v_partida.time_a || ' x ' || v_partida.time_b || '.'
    );
  END IF;

  RETURN jsonb_build_object('sucesso', TRUE);
END $$;

REVOKE ALL ON FUNCTION public.pedir_operar_partida(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_operar_partida(UUID) TO authenticated;


-- ------------------------------------------------------------
-- 5) RPC: ACEITAR / RECUSAR (so quem criou a partida)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.responder_pedido_operador(
  p_partida_id UUID,
  p_usuario_id UUID,
  p_aceitar    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_partida public.partidas%ROWTYPE;
  v_pedido  public.partida_operadores%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Voce precisa estar logado.');
  END IF;

  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Partida nao encontrada.');
  END IF;

  IF v_partida.criado_por IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'So quem criou a partida pode responder ao pedido.');
  END IF;

  SELECT * INTO v_pedido
  FROM public.partida_operadores
  WHERE partida_id = p_partida_id AND usuario_id = p_usuario_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', FALSE, 'erro', 'Pedido nao encontrado.');
  END IF;

  IF p_aceitar THEN
    UPDATE public.partida_operadores
       SET aprovado = TRUE, respondido_em = NOW()
     WHERE partida_id = p_partida_id AND usuario_id = p_usuario_id;
  ELSE
    DELETE FROM public.partida_operadores
     WHERE partida_id = p_partida_id AND usuario_id = p_usuario_id;
  END IF;

  INSERT INTO public.notificacoes (usuario_id, titulo, mensagem)
  VALUES (
    p_usuario_id,
    'Placar compartilhado',
    CASE WHEN p_aceitar
         THEN 'Pedido aceito! Voce ja pode operar o placar de ' || v_partida.time_a || ' x ' || v_partida.time_b || '.'
         ELSE 'Seu pedido para operar o placar de ' || v_partida.time_a || ' x ' || v_partida.time_b || ' nao foi aceito.'
    END
  );

  RETURN jsonb_build_object('sucesso', TRUE, 'aprovado', p_aceitar);
END $$;

REVOKE ALL ON FUNCTION public.responder_pedido_operador(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_pedido_operador(UUID, UUID, BOOLEAN) TO authenticated;


-- ------------------------------------------------------------
-- 6) AVISO EM TEMPO REAL (topico por partida: "partida_<id>")
--    Melhor esforco: se o aviso falhar, o pedido continua valendo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_aviso_partida_operadores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partida UUID;
BEGIN
  v_partida := COALESCE(NEW.partida_id, OLD.partida_id);
  BEGIN
    PERFORM public.notificar_realtime('partida_' || v_partida::text);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_realtime_partida_operadores ON public.partida_operadores;
CREATE TRIGGER trg_realtime_partida_operadores
  AFTER INSERT OR UPDATE OR DELETE ON public.partida_operadores
  FOR EACH ROW EXECUTE FUNCTION public.trg_aviso_partida_operadores();


-- ============================================================
-- 7) VERIFICACAO (rode depois; confira os comentarios)
-- ============================================================

-- 7.1) A policy nova da tabela partidas
SELECT polname                                  AS politica,
       pg_get_expr(polqual, polrelid)           AS usando,
       pg_get_expr(polwithcheck, polrelid)      AS com_check
FROM pg_policy
WHERE polrelid = 'public.partidas'::regclass
  AND polname = 'partidas_update_own';
-- Esperado: usando  = (criado_por = auth.uid() OR ... pode_operar_partida(id))
--           com_check = idem, aceitando tambem 'finalizado'

-- 7.2) O anon NAO pode rodar nada disso (tudo false)
SELECT has_function_privilege('anon', 'public.pedir_operar_partida(uuid)', 'EXECUTE')                 AS anon_pede,
       has_function_privilege('anon', 'public.responder_pedido_operador(uuid,uuid,boolean)', 'EXECUTE') AS anon_responde,
       has_function_privilege('anon', 'public.pode_operar_partida(uuid)', 'EXECUTE')                  AS anon_pode_operar,
       has_table_privilege('anon', 'public.partida_operadores', 'SELECT')                             AS anon_le_operadores;

-- 7.3) O publicador de avisos existe? (false = avisos em tempo real nao vao funcionar)
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notificar_realtime') AS tem_notificar_realtime,
       EXISTS (SELECT 1 FROM pg_trigger
                WHERE tgname = 'trg_realtime_partida_operadores')          AS tem_gatilho_aviso;

-- 7.4) Estado atual (comeca vazio: a limpeza de 17/10 zerou o esporte)
SELECT count(*) AS pedidos_ou_operadores FROM public.partida_operadores;


-- ============================================================
-- COMO REVERTER (voltar ao comportamento antigo, se precisar)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_realtime_partida_operadores ON public.partida_operadores;
-- DROP POLICY IF EXISTS partidas_update_own ON public.partidas;
-- CREATE POLICY partidas_update_own ON public.partidas
--   FOR UPDATE TO authenticated
--   USING (criado_por = auth.uid() OR criado_por IS NULL)
--   WITH CHECK (criado_por = auth.uid() OR criado_por IS NULL);
