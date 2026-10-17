-- ============================================================
-- REALTIME ESCALÁVEL — Broadcast no lugar de Postgres Changes
-- ============================================================
-- POR QUE
--   As telas de Início e Atletas assinavam `postgres_changes` na tabela
--   `jogadores` (e a lista de torneios na tabela `torneios`), sem filtro.
--   Nesse modelo o Supabase, a cada linha alterada, avalia RLS para CADA
--   cliente inscrito e envia a linha inteira. Com 100 pessoas logadas:
--       1 voto = 100 verificações de RLS + 100 mensagens
--   Isso estoura cota de Realtime e trava o banco.
--
-- SOLUÇÃO
--   Trocar por Broadcast: o banco publica um aviso CURTO ("ranking mudou")
--   no tópico, e todos os clientes inscritos recebem no mesmo WebSocket, sem
--   RLS por linha e sem trafegar dado de ninguém.
--
--   * Continua sendo push do banco -> cliente, no instante da mudança.
--     A latência na tela é a mesma de antes (quem decide o ritmo é o
--     agrupamento do app, não o transporte).
--   * Aqui também limitamos a frequência: no máximo 1 aviso a cada 8 segundos
--     por assunto. Uma rajada de 50 votos vira 1 aviso, não 50.
--   * O payload não tem dado nenhum (nem nome, nem nota, nem quem votou).
--
-- IDEMPOTENTE — pode rodar mais de uma vez. Rode no SQL Editor.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Autorização: usuário LOGADO pode receber avisos
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "rh_broadcast_receber" ON realtime.messages;
CREATE POLICY "rh_broadcast_receber"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);


-- ------------------------------------------------------------
-- 2) Controle de frequência (1 aviso a cada N segundos por assunto)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.realtime_pings (
  topico     TEXT PRIMARY KEY,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.realtime_pings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.realtime_pings FROM anon, authenticated;


-- ------------------------------------------------------------
-- 3) Publicador: com limite de frequência e à prova de falha
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar_realtime(
  p_topico    TEXT,
  p_intervalo INTERVAL DEFAULT '8 seconds'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE
  v_ultimo TIMESTAMPTZ;
BEGIN
  -- Leitura primeiro: se o último aviso é recente, sai sem nem tocar na linha
  -- (evita disputa/lock num registro quente durante uma rajada de votos).
  SELECT enviado_em INTO v_ultimo
  FROM public.realtime_pings
  WHERE topico = p_topico;

  IF v_ultimo IS NOT NULL AND v_ultimo > NOW() - p_intervalo THEN
    RETURN;
  END IF;

  INSERT INTO public.realtime_pings AS rp (topico, enviado_em)
  VALUES (p_topico, NOW())
  ON CONFLICT (topico) DO UPDATE SET enviado_em = NOW();

  -- Se o aviso falhar (ex.: nenhum app aberto para criar a partição do dia),
  -- a operação de negócio continua normalmente.
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('topico', p_topico, 'em', NOW()),
      'atualizacao',
      p_topico,
      TRUE               -- canal privado: só usuário logado recebe
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_realtime(TEXT, INTERVAL) FROM PUBLIC, anon;


-- ------------------------------------------------------------
-- 4) Gatilhos (o assunto vem por argumento)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_realtime_aviso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notificar_realtime(TG_ARGV[0]);
  RETURN NULL;
END;
$$;

-- 4a) Atletas/ranking — interessa "mudou algo", não cada linha.
--     FOR EACH STATEMENT: 1 chamada por comando, mesmo que altere 500 linhas.
DROP TRIGGER IF EXISTS trg_realtime_ranking ON public.jogadores;
CREATE TRIGGER trg_realtime_ranking
  AFTER INSERT OR UPDATE OR DELETE ON public.jogadores
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_realtime_aviso('ranking');

-- 4b) Lista de torneios
DROP TRIGGER IF EXISTS trg_realtime_torneios ON public.torneios;
CREATE TRIGGER trg_realtime_torneios
  AFTER INSERT OR UPDATE OR DELETE ON public.torneios
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_realtime_aviso('torneios');


-- ------------------------------------------------------------
-- 5) VERIFICAÇÃO
-- ------------------------------------------------------------
-- 5.1) Os gatilhos devem existir:
SELECT tgname AS gatilho, pg_get_triggerdef(oid) AS definicao
FROM pg_trigger
WHERE tgrelid IN ('public.jogadores'::regclass, 'public.torneios'::regclass)
  AND NOT tgisinternal;

-- 5.2) Teste de envio (abra o app em algum celular antes, para existir a
--      "partição" do dia; sem app aberto pode dar aviso, o que é normal):
DO $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object('teste', TRUE),
    'atualizacao',
    'ranking',
    TRUE
  );
  RAISE NOTICE 'OK: aviso de teste publicado no topico "ranking".';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Nao foi possivel publicar agora (normal sem app aberto): %', SQLERRM;
END $$;

-- ------------------------------------------------------------
-- COMO REVERTER (só se precisar voltar para o modelo antigo)
-- ------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_realtime_ranking ON public.jogadores;
-- DROP TRIGGER IF EXISTS trg_realtime_torneios ON public.torneios;
-- (o app também precisaria voltar a assinar `postgres_changes`)
