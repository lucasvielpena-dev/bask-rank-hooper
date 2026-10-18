/**
 * Ranking com média bayesiana (confiança).
 *
 * Problema da média pura: 3 votos 5,0 passam na frente de 10 votos 4,5.
 * Solução: puxar a nota para a média da base até haver votos suficientes.
 *
 * score = (média × votos + prior_média × prior_votos) / (votos + prior_votos)
 *
 * prior_votos ≈ "peso de votos imaginários na média da base"
 * Com prior=8 e prior_média=3.0:
 *   - 3×5,0  → ~3,73
 *   - 4×4,0  → ~3,33
 *   - 8×4,5  → ~3,75  (já compete de igual)
 *   - 15×4,2 → ~3,78  (estável)
 */

export const RANKING_PRIOR_VOTOS = 8;
export const RANKING_PRIOR_MEDIA = 3.0;

export function scoreConfianca(
  media = 0,
  votos = 0,
  prior = RANKING_PRIOR_VOTOS,
  priorMedia = RANKING_PRIOR_MEDIA
) {
  const v = Math.max(0, Number(votos) || 0);
  const m = Number(media) || 0;
  if (v <= 0) return 0;
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
  return [...(list || [])].filter(Boolean).sort((a, b) => {
    const sa = a.score_confianca ?? scoreConfianca(a.media_estrelas, a.total_votos);
    const sb = b.score_confianca ?? scoreConfianca(b.media_estrelas, b.total_votos);
    if (sb !== sa) return sb - sa;
    // Empate: quem tem mais votos; depois média pura
    const va = Number(a.total_votos) || 0;
    const vb = Number(b.total_votos) || 0;
    if (vb !== va) return vb - va;
    return (Number(b.media_estrelas) || 0) - (Number(a.media_estrelas) || 0);
  });
}

export function resumoAvaliacoes(jogador, { compacto = false } = {}) {
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
