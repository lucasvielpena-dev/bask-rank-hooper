-- ============================================================
-- migration_realtime_ranking_cidade.sql
-- Aviso de atualização do ranking POR CIDADE (em vez de um tópico global).
--
-- Antes: qualquer mudança em `jogadores` em qualquer cidade avisava o tópico
--        'ranking', e TODO app recarregava a lista.
-- Depois: cada cidade tem o seu tópico, `ranking_<cidade>_<uf>`; o app só
--         assina o da cidade da pessoa.
--
-- Pré-requisito: migration_realtime_broadcast.sql (notificar_realtime e a
-- política de leitura de realtime.messages já existem).
-- Rode UMA vez no SQL Editor. Idempotente.
-- ============================================================
BEGIN;

-- 1) Mesmo nome de tópico que o app calcula (src/lib/realtime.js: slugCidade).
CREATE OR REPLACE FUNCTION public.slug_cidade(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '_' from
           regexp_replace(
             translate(lower(coalesce(p_texto, '')),
               'áàâãäéèêëíìîïóòôõöúùûüçñ',
               'aaaaaeeeeiiiiooooouuuucn'),
             '[^a-z0-9]+', '_', 'g'));
$$;

-- 2) Publica o aviso de UMA cidade (com limite de frequência já embutido).
CREATE OR REPLACE FUNCTION public.avisar_ranking_cidade(p_cidade TEXT, p_uf TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
BEGIN
  IF public.slug_cidade(p_cidade) = '' THEN
    RETURN;
  END IF;
  PERFORM public.notificar_realtime(
    'ranking_' || public.slug_cidade(p_cidade) || '_' || lower(coalesce(p_uf, ''))
  );
END;
$$;

-- 3) Gatilhos de statement (1 chamada por comando), com tabelas de transição.
--    INSERT: avisa as cidades novas.
CREATE OR REPLACE FUNCTION public.trg_ranking_cidade_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT cidade, uf FROM novas WHERE cidade IS NOT NULL LOOP
    PERFORM public.avisar_ranking_cidade(r.cidade, r.uf);
  END LOOP;
  RETURN NULL;
END;
$$;

--    UPDATE: avisa a cidade antiga E a nova (se o jogador mudou de cidade).
CREATE OR REPLACE FUNCTION public.trg_ranking_cidade_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT cidade, uf FROM velhas WHERE cidade IS NOT NULL
    UNION
    SELECT DISTINCT cidade, uf FROM novas WHERE cidade IS NOT NULL
  LOOP
    PERFORM public.avisar_ranking_cidade(r.cidade, r.uf);
  END LOOP;
  RETURN NULL;
END;
$$;

--    DELETE: avisa as cidades das linhas apagadas.
CREATE OR REPLACE FUNCTION public.trg_ranking_cidade_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT cidade, uf FROM velhas WHERE cidade IS NOT NULL LOOP
    PERFORM public.avisar_ranking_cidade(r.cidade, r.uf);
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.avisar_ranking_cidade(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_ranking_cidade_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_ranking_cidade_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_ranking_cidade_delete() FROM PUBLIC, anon, authenticated;

-- 4) Troca o gatilho global pelos gatilhos por cidade.
DROP TRIGGER IF EXISTS trg_realtime_ranking ON public.jogadores;

DROP TRIGGER IF EXISTS trg_ranking_cidade_ins ON public.jogadores;
CREATE TRIGGER trg_ranking_cidade_ins
  AFTER INSERT ON public.jogadores
  REFERENCING NEW TABLE AS novas
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_ranking_cidade_insert();

DROP TRIGGER IF EXISTS trg_ranking_cidade_upd ON public.jogadores;
CREATE TRIGGER trg_ranking_cidade_upd
  AFTER UPDATE ON public.jogadores
  REFERENCING OLD TABLE AS velhas NEW TABLE AS novas
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_ranking_cidade_update();

DROP TRIGGER IF EXISTS trg_ranking_cidade_del ON public.jogadores;
CREATE TRIGGER trg_ranking_cidade_del
  AFTER DELETE ON public.jogadores
  REFERENCING OLD TABLE AS velhas
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_ranking_cidade_delete();

COMMIT;

-- CONFERÊNCIA (esperado: 3 linhas e o slug de "Pacajá" = pacaja)
-- SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_ranking_cidade%';
-- SELECT public.slug_cidade('Pacajá');
