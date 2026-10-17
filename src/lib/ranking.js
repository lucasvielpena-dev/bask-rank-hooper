/** Score de confiança no frontend (fallback se RPC antiga não devolver score_confianca) */
export function scoreConfianca(media = 0, votos = 0, prior = 5, priorMedia = 3) {
  const v = Number(votos) || 0;
  const m = Number(media) || 0;
  return (m * v + priorMedia * prior) / (v + prior);
}

export function nivelConfianca(votos = 0) {
  const v = Number(votos) || 0;
  if (v < 5) return 'provisorio';
  if (v < 15) return 'em_evolucao';
  return 'consolidado';
}

export function labelConfianca(nivel) {
  if (nivel === 'provisorio') return 'Provisório';
  if (nivel === 'em_evolucao') return 'Em evolução';
  return 'Consolidado';
}

export function sortByConfianca(list = []) {
  // filter(Boolean): uma lista com item nulo (ex.: linha incompleta vinda do
  // banco) derrubava a tela inteira no comparador.
  return [...(list || [])].filter(Boolean).sort((a, b) => {
    const sa = a.score_confianca ?? scoreConfianca(a.media_estrelas, a.total_votos);
    const sb = b.score_confianca ?? scoreConfianca(b.media_estrelas, b.total_votos);
    if (sb !== sa) return sb - sa;
    return (b.total_votos || 0) - (a.total_votos || 0);
  });
}

/**
 * Descreve de onde vem a nota do atleta.
 * A nota junta duas fontes: votos de estrela (aba Atletas, 5 fundamentos) e
 * notas de jogo (rachão, competição e torneio). Chamar tudo de "votos" fica
 * impreciso — e o atleta não entende por que a nota mudou depois de um rachão.
 *
 * `compacto` devolve só "12 avaliações" (para listas apertadas).
 * Se as colunas de detalhe ainda não existirem no banco, cai no formato antigo.
 */
export function resumoAvaliacoes(jogador, { compacto = false } = {}) {
  // Atenção: o valor padrão `= {}` só cobre `undefined`. Passar `null` (o que
  // acontece enquanto o ranking ainda está carregando) estourava a tela.
  const j = jogador || {};
  const total = Number(j.total_votos) || 0;
  const estrelas = Number(j.total_votos_estrelas) || 0;
  const jogos = Number(j.total_notas_jogo) || 0;
  const temDetalhe =
    j.total_votos_estrelas !== undefined && j.total_votos_estrelas !== null &&
    j.total_notas_jogo !== undefined && j.total_notas_jogo !== null;

  if (compacto || !temDetalhe || total === 0) {
    return `${total} ${total === 1 ? 'avaliação' : 'avaliações'}`;
  }

  const partes = [];
  if (estrelas > 0) partes.push(`${estrelas} ${estrelas === 1 ? 'voto' : 'votos'} de estrela`);
  if (jogos > 0) partes.push(`${jogos} ${jogos === 1 ? 'nota' : 'notas'} de jogo`);

  if (!partes.length) return `${total} ${total === 1 ? 'avaliação' : 'avaliações'}`;
  return `${total} ${total === 1 ? 'avaliação' : 'avaliações'} · ${partes.join(' + ')}`;
}
