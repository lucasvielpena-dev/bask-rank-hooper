// ============================================================
// Nome de exibição de um atleta
// ============================================================
// O apelido é o que a galera conhece, então ele tem prioridade.
// O cadastro antigo gravava e-mail ou a palavra "Jogador" em
// `nome_completo`/`nome`, e esses valores genéricos nunca devem aparecer.
const GENERICOS = ['jogador', 'jogadora', 'atleta', 'player', 'usuario', 'usuário', 'sem nome'];

function limpo(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function ehGenerico(v) {
  if (!v) return true;
  if (v.includes('@')) return true; // e-mail não é nome
  return GENERICOS.includes(v.toLowerCase());
}

/**
 * Nome ideal para mostrar na tela.
 * Prioriza `apelido`; cai para `nome_completo`/`nome` se o apelido for vazio
 * ou genérico ("Jogador", e-mail...).
 */
export function nomeAtleta(p) {
  if (!p) return 'Atleta';
  const apelido = limpo(p.apelido);
  const nome = limpo(p.nome_completo) || limpo(p.nome);

  if (!ehGenerico(apelido)) return apelido;
  if (!ehGenerico(nome)) return nome;
  return apelido || nome || 'Atleta';
}

/** Nome "de verdade" (o cadastro), útil como legenda secundária. */
export function nomeCompletoAtleta(p) {
  if (!p) return '';
  const nome = limpo(p.nome_completo) || limpo(p.nome);
  return ehGenerico(nome) ? '' : nome;
}

/** Iniciais para o avatar quando não há foto. */
export function iniciaisAtleta(p) {
  return nomeAtleta(p).slice(0, 2).toUpperCase();
}
