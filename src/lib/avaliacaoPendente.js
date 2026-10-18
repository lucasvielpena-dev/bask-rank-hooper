// ============================================================
// AVALIAÇÕES PENDENTES — "quem ainda falta avaliar"
// ============================================================
// Apoio das telas que mostram pendência de avaliação:
//   - Home .......... cartão "Quem jogou com você" + aviso da cidade
//   - Atletas ....... filtro "Menos avaliados"
//   - Perfil ........ "Você avaliou N jogadores"
//
// Regra de ouro: NADA aqui pode atrapalhar o app. Se não houver internet,
// se a tabela não responder ou se o localStorage estiver bloqueado (WebView),
// a função devolve vazio e a tela segue exatamente como sempre foi.
//
// Nada aqui bloqueia avaliação: são só atalhos para chegar em quem falta.
import { supabase } from './supabase';

const DIAS_PARTIDA = 7;              // só partida recém-terminada vira cartão
const MAX_LEMBRADAS = 20;            // quantas partidas "fechadas" ficam guardadas
const CHAVE_DISPENSA = 'quem_jogou_dispensado';
const CHAVE_AVISO_DIA = 'aviso_cidade_visto';
const MAX_PARCEIROS = 5;             // cartão: primeiros N jogadores

export { MAX_PARCEIROS };

// ------------------------------------------------------------
// Cidade: mesma normalização usada na tela de Atletas
// (acentos, maiúsculas, espaços e sufixo "- PA" não contam)
// ------------------------------------------------------------
export function normalizarCidade(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*-\s*[a-z]{2}$/i, '')
    .replace(/\s+/g, ' ');
}

/** Nome da cidade pronto para aparecer na tela (sem o sufixo "- PA"). */
export function cidadeExibicao(v) {
  return String(v || '').replace(/\s*-\s*[a-z]{2}$/i, '').trim();
}

// ------------------------------------------------------------
// localStorage com rede de proteção
// ------------------------------------------------------------
function lerJSON(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return padrao;
    const valor = JSON.parse(bruto);
    return valor === null || valor === undefined ? padrao : valor;
  } catch (_) {
    return padrao;
  }
}

function gravarJSON(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (_) {
    /* sem localStorage: só não lembra entre sessões, nada quebra */
  }
}

function hojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Partidas que a pessoa já fechou no cartão "Quem jogou com você". */
export function partidasDispensadas() {
  const ids = lerJSON(CHAVE_DISPENSA, []);
  return Array.isArray(ids) ? ids : [];
}

/** Fecha o cartão de UMA partida — ela não volta mais (no aparelho). */
export function dispensarPartida(partidaId) {
  if (!partidaId) return;
  const ids = [partidaId, ...partidasDispensadas().filter((id) => id !== partidaId)];
  gravarJSON(CHAVE_DISPENSA, ids.slice(0, MAX_LEMBRADAS));
}

/** O aviso da cidade já apareceu hoje para esta pessoa? */
export function avisoCidadeVistoHoje(usuarioId) {
  if (!usuarioId) return true;
  let mapa = lerJSON(CHAVE_AVISO_DIA, {});
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) mapa = {};
  return mapa[usuarioId] === hojeISO();
}

/** Marca o aviso da cidade como mostrado hoje (no máximo 1x por dia). */
export function marcarAvisoCidadeVistoHoje(usuarioId) {
  if (!usuarioId) return;
  let mapa = lerJSON(CHAVE_AVISO_DIA, {});
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) mapa = {};
  mapa[usuarioId] = hojeISO();
  gravarJSON(CHAVE_AVISO_DIA, mapa);
}

// ------------------------------------------------------------
// Consultas
// ------------------------------------------------------------

/**
 * Quem EU já avaliei.
 * Sem filtro de esporte de propósito: a lista de atletas da tela já está
 * filtrada por esporte, então o cruzamento acontece lá.
 */
export async function meusAvaliados() {
  const vazio = { ids: new Set(), total: 0 };
  try {
    const uid = (await supabase.auth.getUser()).data?.user?.id;
    if (!uid) return vazio;
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('jogador_id')
      .eq('avaliador_id', uid);
    if (error) return vazio;
    const ids = new Set((data || []).map((a) => a.jogador_id).filter(Boolean));
    return { ids, total: ids.size };
  } catch (_) {
    return vazio;
  }
}

/**
 * Atletas da minha cidade que ainda não receberam avaliação minha.
 * (mesma ideia do "Você só avalia quem é da sua cidade")
 */
export async function atletasSemMinhaAvaliacao({ cidade, uf, esporte, avaliados, meuPlayerId }) {
  try {
    const cidadeNorm = normalizarCidade(cidade);
    if (!cidadeNorm) return [];
    let q = supabase
      .from('jogadores')
      .select('id, nome, apelido, cidade, uf, posicao, total_votos, media_estrelas, foto_url')
      .eq('ativo', true)
      .eq('esporte', esporte);
    if (uf) q = q.eq('uf', uf);
    // Ordena do menos avaliado para o mais avaliado: se a lista for cortada
    // pelo limite, o que sobra é justamente quem mais precisa de nota.
    const { data, error } = await q.order('total_votos', { ascending: true }).limit(300);
    if (error) return [];
    return (data || []).filter(
      (j) => j.id !== meuPlayerId && !avaliados.has(j.id) && normalizarCidade(j.cidade) === cidadeNorm
    );
  } catch (_) {
    return [];
  }
}

/**
 * A última partida finalizada em que eu joguei (dentro da janela de dias).
 * Devolve a partida "crua" do banco ou null.
 */
export async function ultimaPartidaJogada({ playerId, esporte, dias = DIAS_PARTIDA }) {
  if (!playerId) return null;
  try {
    const { data, error } = await supabase
      .from('partida_jogadores')
      .select('partida:partidas(id, status, esporte, created_at, updated_at, cidade, uf, time_a, time_b, placar_time_a, placar_time_b)')
      .eq('jogador_id', playerId);
    if (error) return null;
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    const finalizadas = (data || [])
      .map((r) => r.partida)
      .filter((p) => p && p.status === 'finalizado')
      .filter((p) => !p.esporte || p.esporte === esporte)
      .filter((p) => new Date(p.updated_at || p.created_at).getTime() >= limite)
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    return finalizadas[0] || null;
  } catch (_) {
    return null;
  }
}

/** Quem mais jogou aquela partida (sem mim). */
export async function parceirosDaPartida({ partidaId, meuPlayerId }) {
  if (!partidaId) return [];
  try {
    const { data, error } = await supabase
      .from('partida_jogadores')
      .select('jogador_id, time, jogador:jogadores(id, nome, apelido, foto_url, posicao, cidade, uf, media_estrelas, total_votos)')
      .eq('partida_id', partidaId);
    if (error) return [];
    return (data || []).filter((r) => r.jogador_id !== meuPlayerId && r.jogador);
  } catch (_) {
    return [];
  }
}
