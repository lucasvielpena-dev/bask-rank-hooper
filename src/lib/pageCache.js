// Cache em memória (por sessão) para as telas de lista.
//
// Problema que ele resolve: ao trocar de aba, o React desmonta a tela e, ao
// voltar, ela recomeça do zero (`useState([])` + `loading = true`) e refaz a
// consulta — o que mostra esqueleto/tela vazia ("pisca") toda vez.
//
// Aqui guardamos o último resultado. Ao voltar para a aba, a tela já pinta o
// que tinha na hora e só revalida por baixo (sem esqueleto).
//
// É de propósito "simples": vive só na memória da sessão e some ao fechar o
// app. Nada de dados sensíveis em disco.

const store = new Map();

export function lerCache(chave) {
  return store.get(chave) || null;
}

export function salvarCache(chave, valor) {
  try {
    store.set(chave, valor);
  } catch (_) {
    /* cache é só um atalho: se falhar, a tela carrega normalmente */
  }
}

export function limparCache(chave) {
  if (chave) store.delete(chave);
  else store.clear();
}

// Compara duas listas por conteúdo. Serve para o refresh silencioso (realtime /
// polling) não re-renderizar a tela quando o banco devolve exatamente os mesmos
// dados — era isso que dava aquela "engasgada" de tempo em tempo numa lista
// parada. Uso: setLista(prev => (igualLista(prev, novo) ? prev : novo)).
export function igualLista(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  // Comparação campo a campo (evita JSON.stringify na lista inteira — engasgo na aba Atletas)
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (!x || !y) return false;
    if (x.id !== y.id) return false;
    if (x.media_estrelas !== y.media_estrelas) return false;
    if (x.total_votos !== y.total_votos) return false;
    if (x.ja_votou_hoje !== y.ja_votou_hoje) return false;
    if (x.foto_url !== y.foto_url) return false;
    if ((x.apelido || x.nome) !== (y.apelido || y.nome)) return false;
  }
  return true;
}

const pageCache = { lerCache, salvarCache, limparCache, igualLista };
export default pageCache;
