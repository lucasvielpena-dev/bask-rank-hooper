// ============================================================
// Agrupador de atualizações disparadas por Realtime
// ============================================================
// Por que existe:
//   As páginas assinam `postgres_changes` em tabelas muito movimentadas
//   (jogadores / avaliacoes). Sem controle, CADA evento gerado por qualquer
//   atleta logado refazia as consultas pesadas de ranking em TODOS os clientes
//   conectados. Com 100 atletas isso vira uma tempestade e ninguém consegue usar.
//
// Regras aplicadas:
//   - debounce: uma rajada de eventos vira UMA atualização (espera a poeira baixar)
//   - minimo:   nunca atualiza mais de 1x a cada X ms por cliente
//   - aba oculta: não consulta nada; ao voltar pra aba, atualiza 1x
// ============================================================

const PADRAO = { debounce: 2500, minimo: 20000 };

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
    // Aba em segundo plano não faz sentido gastar consulta: deixa pendente.
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

export default criarAtualizador;
