import { supabase } from './supabase';

// ============================================================
// Realtime do app: agrupamento + Broadcast
// ============================================================
// 1) criarAtualizador: agrupa eventos e limita a frequência das consultas.
// 2) assinarAviso: canal de Broadcast (aviso curto do banco -> cliente).
//
// Por que Broadcast e não `postgres_changes`:
//   - `postgres_changes` entrega a linha alterada e avalia RLS por cliente,
//     então 1 alteração custa N verificações + N mensagens (N = logados).
//   - Broadcast entrega um aviso curto para todos no mesmo WebSocket, sem
//     RLS por linha. O banco já manda no máximo 1 aviso a cada poucos
//     segundos por assunto, então rajadas não viram tempestade.
//   - O efeito para o usuário é o mesmo: a tela continua se atualizando
//     sozinha com a mesma latência.
// ============================================================

export const TOPICO_RANKING = 'ranking';
export const TOPICO_TORNEIOS = 'torneios';

const PADRAO = { debounce: 2500, minimo: 15000 };

export function criarAtualizador(fn, opcoes = {}) {
  const { debounce, minimo } = { ...PADRAO, ...opcoes };
  let timer = null;
  let ultimo = 0;
  let atrasado = false;

  const estaVisivel = () =>
    typeof document === 'undefined' || document.visibilityState === 'visible';

  function rodar() {
    timer = null;
    atrasado = false;
    ultimo = Date.now();
    try {
      const r = fn();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (_) {
      /* silencioso: atualização em background não deve derrubar a tela */
    }
  }

  function agendar() {
    // Aba em segundo plano não gasta consulta: fica pendente e roda ao voltar.
    if (!estaVisivel()) {
      atrasado = true;
      return;
    }
    if (timer) clearTimeout(timer);
    const espera = Math.max(debounce, minimo - (Date.now() - ultimo));
    timer = setTimeout(rodar, espera);
  }

  function aoVoltarParaAba() {
    if (document.visibilityState === 'visible' && atrasado) agendar();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', aoVoltarParaAba);
  }

  agendar.parar = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    }
  };

  return agendar;
}

/**
 * Assina um "assunto" via Broadcast. O banco publica no máximo 1 aviso a cada
 * poucos segundos por assunto (ver supabase/migration_realtime_broadcast.sql).
 * Retorna o canal, para o chamador remover no cleanup.
 */
export function assinarAviso(topico, handler) {
  return supabase
    .channel(topico, { config: { private: true } })
    .on('broadcast', { event: 'atualizacao' }, handler)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(
          `[realtime] canal "${topico}" falhou (${status}). ` +
          'Confira se supabase/migration_realtime_broadcast.sql foi aplicada.'
        );
      }
    });
}

export default criarAtualizador;
