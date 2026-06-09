-- ============================================================
-- MIGRAÇÃO DE LIMPEZA - Rank Hooper
-- Etapa 3-6: Limpeza do banco, FKs, Índices, RLS
-- ============================================================

-- =============================================
-- ETAPA 3: REMOVER TABELAS MORTAS
-- =============================================

-- 1. Tabela votos (legado, substituída por avaliacoes)
DROP TABLE IF EXISTS public.votos CASCADE;

-- 2. Tabela auditoria_votos (escrita apenas por registrar_avaliacao, nenhum frontend lê)
DROP TABLE IF EXISTS public.auditoria_votos CASCADE;

-- =============================================
-- ETAPA 4: CORRIGIR FOREIGN KEYS
-- =============================================

-- 3. Adicionar FK em profiles.player_id -> jogadores(id)
-- (atualmente não tem constraint)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_player_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.jogadores(id) ON DELETE SET NULL;

-- 4. Adicionar ON DELETE nos FKs que estão sem
-- estatisticas_partida.jogador_id
ALTER TABLE public.estatisticas_partida
  DROP CONSTRAINT IF EXISTS estatisticas_partida_jogador_id_fkey;

ALTER TABLE public.estatisticas_partida
  ADD CONSTRAINT estatisticas_partida_jogador_id_fkey
  FOREIGN KEY (jogador_id) REFERENCES public.jogadores(id) ON DELETE CASCADE;

-- campeoes_semana.jogador_id
ALTER TABLE public.campeoes_semana
  DROP CONSTRAINT IF EXISTS campeoes_semana_jogador_id_fkey;

ALTER TABLE public.campeoes_semana
  ADD CONSTRAINT campeoes_semana_jogador_id_fkey
  FOREIGN KEY (jogador_id) REFERENCES public.jogadores(id) ON DELETE CASCADE;

-- torneio_jogos.mvp_id (references profiles)
ALTER TABLE public.torneio_jogos
  DROP CONSTRAINT IF EXISTS torneio_jogos_mvp_id_fkey;

ALTER TABLE public.torneio_jogos
  ADD CONSTRAINT torneio_jogos_mvp_id_fkey
  FOREIGN KEY (mvp_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- =============================================
-- ETAPA 5: ÍNDICES PARA PERFORMANCE
-- =============================================

-- Players
CREATE INDEX IF NOT EXISTS idx_jogadores_uf ON public.jogadores(uf);
CREATE INDEX IF NOT EXISTS idx_jogadores_cidade ON public.jogadores(cidade);
CREATE INDEX IF NOT EXISTS idx_jogadores_criado_por ON public.jogadores(criado_por);
CREATE INDEX IF NOT EXISTS idx_jogadores_ativo ON public.jogadores(ativo);
CREATE INDEX IF NOT EXISTS idx_jogadores_media_estrelas ON public.jogadores(media_estrelas DESC);

-- Avaliacoes
CREATE INDEX IF NOT EXISTS idx_avaliacoes_jogador ON public.avaliacoes(jogador_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_avaliador ON public.avaliacoes(avaliador_id);

-- Votos diarios
CREATE INDEX IF NOT EXISTS idx_votos_diarios_votante ON public.votos_diarios(votante_id);
CREATE INDEX IF NOT EXISTS idx_votos_diarios_data ON public.votos_diarios(data);

-- Partidas
CREATE INDEX IF NOT EXISTS idx_partidas_status ON public.partidas(status);
CREATE INDEX IF NOT EXISTS idx_partidas_cidade ON public.partidas(cidade);
CREATE INDEX IF NOT EXISTS idx_partida_jogadores_partida ON public.partida_jogadores(partida_id);
CREATE INDEX IF NOT EXISTS idx_partida_jogadores_jogador ON public.partida_jogadores(jogador_id);

-- Jogos
CREATE INDEX IF NOT EXISTS idx_jogos_status ON public.jogos(status);
CREATE INDEX IF NOT EXISTS idx_jogos_criado_por ON public.jogos(criado_por);

-- Estatisticas partida
CREATE INDEX IF NOT EXISTS idx_estatisticas_partida_jogo ON public.estatisticas_partida(jogo_id);
CREATE INDEX IF NOT EXISTS idx_estatisticas_partida_jogador ON public.estatisticas_partida(jogador_id);

-- Estatisticas pessoais
CREATE INDEX IF NOT EXISTS idx_estatisticas_pessoais_usuario ON public.estatisticas_pessoais(usuario_id);
CREATE INDEX IF NOT EXISTS idx_estatisticas_pessoais_data ON public.estatisticas_pessoais(data_partida);

-- Notificacoes
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON public.notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(lida);

-- Torneios
CREATE INDEX IF NOT EXISTS idx_torneios_cidade ON public.torneios(cidade);
CREATE INDEX IF NOT EXISTS idx_torneios_status ON public.torneios(status);
CREATE INDEX IF NOT EXISTS idx_torneios_organizador ON public.torneios(organizador_id);

-- Equipes
CREATE INDEX IF NOT EXISTS idx_equipes_torneio ON public.equipes(torneio_id);

-- Torneio jogos
CREATE INDEX IF NOT EXISTS idx_torneio_jogos_torneio ON public.torneio_jogos(torneio_id);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_uf ON public.profiles(uf);
CREATE INDEX IF NOT EXISTS idx_profiles_cidade_atual ON public.profiles(cidade_atual);
CREATE INDEX IF NOT EXISTS idx_profiles_player_id ON public.profiles(player_id);

-- Denuncias
CREATE INDEX IF NOT EXISTS idx_denuncias_jogador ON public.denuncias(jogador_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_status ON public.denuncias(status);

-- =============================================
-- ETAPA 6: POLÍTICAS RLS CORRIGIDAS
-- =============================================

-- Jogadores: adicionar política de DELETE para o dono
DROP POLICY IF EXISTS jogadores_delete_own ON public.jogadores;
CREATE POLICY jogadores_delete_own ON public.jogadores
  FOR DELETE USING (criado_por = auth.uid());

-- Jogadores: restringir UPDATE para dono ou admin
DROP POLICY IF EXISTS jogadores_update_auth ON public.jogadores;
CREATE POLICY jogadores_update_own ON public.jogadores
  FOR UPDATE USING (criado_por = auth.uid() OR auth.role() = 'service_role');

-- Avaliacoes: garantir que só o dono pode DELETAR
DROP POLICY IF EXISTS avaliacoes_delete_own ON public.avaliacoes;
CREATE POLICY avaliacoes_delete_own ON public.avaliacoes
  FOR DELETE USING (avaliador_id = auth.uid());

-- Notificacoes: garantir que só o dono pode DELETAR
-- (já existe notificacoes_delete_owner, verificar se está correta)

-- Profiles: garantir que só o próprio usuário pode ver dados sensíveis
-- profiles_select_all já existe e é público (ok para dados públicos)

-- =============================================
-- LIMPEZA: remover política duplicada de profiles
-- =============================================
-- A política profiles_select_all é pública (TRUE) o que é correto
-- para dados de perfil públicos. Manter como está.

-- =============================================
-- RESUMO
-- =============================================
-- Tabelas removidas: votos, auditoria_votos
-- FKs adicionadas: profiles.player_id, estatisticas_partida.jogador_id,
--   campeoes_semana.jogador_id, torneio_jogos.mvp_id
-- Índices criados: 25 índices nas tabelas mais consultadas
-- RLS corrigido: DELETE policy para jogadores, UPDATE restrito, DELETE em avaliacoes
