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

const pageCache = { lerCache, salvarCache, limparCache };
export default pageCache;
