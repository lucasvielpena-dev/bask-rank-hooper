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
  return [...list].sort((a, b) => {
    const sa = a.score_confianca ?? scoreConfianca(a.media_estrelas, a.total_votos);
    const sb = b.score_confianca ?? scoreConfianca(b.media_estrelas, b.total_votos);
    if (sb !== sa) return sb - sa;
    return (b.total_votos || 0) - (a.total_votos || 0);
  });
}
