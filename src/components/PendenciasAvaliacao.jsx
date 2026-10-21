import { useEffect, useMemo, useState } from 'react';
import { useEsporte } from '../contexts/EsporteContext';
import { nomeAtleta } from '../lib/nomes';
import PlayerProfileModal from './PlayerProfileModal';
import {
  MAX_PARCEIROS,
  meusAvaliados,
  atletasSemMinhaAvaliacao,
  ultimaPartidaJogada,
  parceirosDaPartida,
  partidasDispensadas,
  dispensarPartida,
  avisoCidadeVistoHoje,
  marcarAvisoCidadeVistoHoje,
  normalizarCidade,
  cidadeExibicao,
} from '../lib/avaliacaoPendente';

// ============================================================
// PENDÊNCIAS DE AVALIAÇÃO NA HOME (opcional, nunca bloqueia)
// ============================================================
// Duas coisas discretas, na ordem:
//   1) "Quem jogou com você" — cartão da última partida finalizada em que a
//      pessoa jogou, com um botão de avaliar para cada colega que ainda está
//      sem a nota dela. Fechar o cartão não o traz de volta.
//   2) Aviso da cidade — uma linha só, no máximo uma vez por dia, quando
//      ainda houver gente da cidade sem avaliação da pessoa.
//
// Se não houver nada (ou se algo falhar), não aparece absolutamente nada.

function dataCurta(p) {
  const d = new Date(p?.updated_at || p?.created_at);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function BotaoFechar({ onClick, titulo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={titulo}
      title={titulo}
      style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontSize: 17, lineHeight: 1, cursor: 'pointer', padding: '2px 4px',
        flexShrink: 0, fontFamily: "'Inter',sans-serif" }}
    >
      ×
    </button>
  );
}

export default function PendenciasAvaliacao({ profile, onNavigate }) {
  const { esporte } = useEsporte();

  const [avaliados, setAvaliados] = useState(null);
  const [semAvaliacao, setSemAvaliacao] = useState([]);
  const [partida, setPartida] = useState(null);
  const [parceiros, setParceiros] = useState([]);
  const [dispensadas, setDispensadas] = useState(() => partidasDispensadas());
  const [avisoNaTela, setAvisoNaTela] = useState(false);
  const [avaliarAgora, setAvaliarAgora] = useState(null);
  const [carregou, setCarregou] = useState(false);

  const cidade = profile?.cidade_atual || profile?.cidade || '';
  const uf = profile?.uf || 'PA';
  const usuarioId = profile?.id || null;
  const playerId = profile?.player_id || null;

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!usuarioId) return;
      try {
        const { ids } = await meusAvaliados();
        if (!vivo) return;
        setAvaliados(ids);

        const [listaCidade, ultima] = await Promise.all([
          atletasSemMinhaAvaliacao({ cidade, uf, esporte, avaliados: ids, meuPlayerId: playerId }),
          ultimaPartidaJogada({ playerId, esporte }),
        ]);
        if (!vivo) return;
        setSemAvaliacao(listaCidade);

        if (ultima) {
          const lista = await parceirosDaPartida({ partidaId: ultima.id, meuPlayerId: playerId });
          if (!vivo) return;
          setPartida(ultima);
          setParceiros(lista);
        }
      } catch (_) {
        /* silencioso: pendência é um extra, não pode virar tela de erro */
      }
      if (vivo) setCarregou(true);
    })();
    return () => { vivo = false; };
  }, [usuarioId, playerId, cidade, uf, esporte]);

  // Quem eu ainda posso avaliar daquela partida: mesma cidade e sem nota minha.
  const pendentesPartida = useMemo(() => {
    if (!avaliados || !partida) return [];
    const minha = normalizarCidade(cidade);
    return parceiros.filter((p) => {
      if (avaliados.has(p.jogador_id)) return false;
      const dele = normalizarCidade(p.jogador?.cidade);
      if (minha && dele && dele !== minha) return false;
      return true;
    });
  }, [avaliados, partida, parceiros, cidade]);

  const mostrarCartao = !!partida
    && !dispensadas.includes(partida.id)
    && pendentesPartida.length > 0;
  const parceirosVisiveis = pendentesPartida.slice(0, MAX_PARCEIROS);
  const restantes = pendentesPartida.length - parceirosVisiveis.length;

  const totalCidade = semAvaliacao.length;

  // Aviso da cidade: no máximo uma vez por dia (marca assim que aparece).
  useEffect(() => {
    if (!carregou || !usuarioId) return;
    if (totalCidade <= 0 || avisoCidadeVistoHoje(usuarioId)) return;
    marcarAvisoCidadeVistoHoje(usuarioId);
    setAvisoNaTela(true);
  }, [carregou, usuarioId, totalCidade]);

  function fecharCartao() {
    if (partida) dispensarPartida(partida.id);
    setDispensadas(partidasDispensadas());
  }

  async function fecharAvaliacao() {
    setAvaliarAgora(null);
    try {
      const { ids } = await meusAvaliados();
      setAvaliados(ids);
    } catch (_) {
      /* silencioso */
    }
  }

  if (!carregou) return null;

  const mostrarAviso = avisoNaTela && totalCidade > 0;

  if (!mostrarCartao && !mostrarAviso) return null;

  return (
    <>
      {mostrarCartao && (
        <div className="premium-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 800, color: 'var(--text-primary)',
                fontFamily: "'Barlow Condensed',sans-serif",
                textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1 }}>
                Quem jogou com você
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, fontFamily: "'Inter',sans-serif" }}>
                {partida.time_a} {partida.placar_time_a ?? 0} x {partida.placar_time_b ?? 0} {partida.time_b}
                {dataCurta(partida) ? ` · ${dataCurta(partida)}` : ''}
              </div>
            </div>
            <BotaoFechar onClick={fecharCartao} titulo="Fechar" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {parceirosVisiveis.map((p) => (
              <div
                key={p.jogador_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '8px 10px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    fontFamily: "'Inter',sans-serif" }}>
                    {nomeAtleta(p.jogador)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>
                    {p.jogador?.posicao || 'Atleta'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAvaliarAgora(p.jogador)}
                  style={{
                    flexShrink: 0, padding: '0 14px', minHeight: 34, lineHeight: 1.2,
                    borderRadius: 999,
                    background: 'transparent', border: '1px solid var(--accent-line)',
                    color: 'var(--accent-text)', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}
                >
                  Avaliar
                </button>
              </div>
            ))}
          </div>

          {restantes > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontFamily: "'Inter',sans-serif" }}>
              e mais {restantes} {restantes === 1 ? 'jogador' : 'jogadores'} desta partida
            </div>
          )}
        </div>
      )}

      {mostrarAviso && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '10px 12px', marginBottom: 20 }}>
          <div style={{
            flex: 1, fontSize: 13, color: 'var(--text-secondary)',
            fontFamily: "'Inter',sans-serif", lineHeight: 1.45 }}>
            Ainda há <strong style={{ color: 'var(--text-primary)' }}>{totalCidade}</strong>{' '}
            {totalCidade === 1 ? 'jogador' : 'jogadores'} de {cidadeExibicao(cidade)} sem avaliação. Quer conferir?
          </div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('atletas', { filtro: 'menos' })}
            style={{
              flexShrink: 0, background: 'none', border: 'none',
              color: 'var(--accent-text)', fontSize: 13, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              cursor: 'pointer', padding: '4px 2px', fontFamily: "'Inter',sans-serif" }}
          >
            Conferir
          </button>
          <BotaoFechar onClick={() => setAvisoNaTela(false)} titulo="Fechar aviso" />
        </div>
      )}

      {avaliarAgora && (
        <PlayerProfileModal
          jogador={avaliarAgora}
          iniciarAvaliando
          onClose={fecharAvaliacao}
        />
      )}
    </>
  );
}
