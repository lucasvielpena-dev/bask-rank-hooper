import { useEffect, useMemo, useState } from 'react';
import { jogadoresAPI } from '../lib/supabase';
import { nomeAtleta } from '../lib/nomes';
import {
  sortByConfianca,
  nivelConfianca,
  labelConfianca,
  resumoAvaliacoes,
} from '../lib/ranking';
import { useEsporte } from '../contexts/EsporteContext';
import { IconBuscar, IconVoltar, IconRanking } from '../components/Icons';
import CityCrest from '../components/CityCrest';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { lerCache, salvarCache } from '../lib/pageCache';

function normalizar(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function nivelAtividade(city) {
  const n = city?.player_count || 0;
  const votos = city?.total_votos || 0;
  const comNota = city?.with_votes || 0;
  if (n >= 8 && votos >= 20) return { label: 'Quente', color: '#f87171' };
  if (n >= 4 && (votos >= 5 || comNota >= 3)) return { label: 'Moderado', color: '#fbbf24' };
  if (n >= 1) return { label: 'Em formação', color: '#93c5fd' };
  return { label: 'Sem dados', color: 'var(--text-muted)' };
}

function confBadge(votos) {
  const nivel = nivelConfianca(votos);
  const label = labelConfianca(nivel);
  const colors = {
    provisorio: { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
    em_evolucao: { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24' },
    consolidado: { bg: 'var(--success-soft)', fg: 'var(--success-text)' },
  };
  return { label, ...(colors[nivel] || colors.provisorio) };
}

export default function Explorar({ profile, onNavigate }) {
  const { esporte } = useEsporte();
  const _cache = lerCache('explorar');
  const [cidades, setCidades] = useState(_cache?.cidades || []);
  const [busca, setBusca] = useState('');
  const [loadingCities, setLoadingCities] = useState(!_cache);
  const [selected, setSelected] = useState(null);
  const [atletas, setAtletas] = useState([]);
  const [loadingAtletas, setLoadingAtletas] = useState(false);
  const [erro, setErro] = useState(null);
  const [playerModal, setPlayerModal] = useState(null);

  const minhaCidade = profile?.cidade_atual || profile?.cidade || '';
  const minhaUf = (profile?.uf || '').toUpperCase();

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoadingCities(true);
      setErro(null);
      try {
        const { data, error } = await jogadoresAPI.listarCidades(esporte);
        if (error) throw error;
        if (vivo) {
          setCidades(data || []);
          salvarCache('explorar', { cidades: data || [] });
        }
      } catch (e) {
        if (vivo) setErro(e.message || 'Erro ao carregar cidades');
      } finally {
        if (vivo) setLoadingCities(false);
      }
    })();
    return () => { vivo = false; };
  }, [esporte]);

  useEffect(() => {
    if (!selected) {
      setAtletas([]);
      return;
    }
    let vivo = true;
    (async () => {
      setLoadingAtletas(true);
      setErro(null);
      try {
        const { data, error } = await jogadoresAPI.listarPorCidade(
          selected.cidade,
          selected.uf || null,
          esporte
        );
        if (error) throw error;
        if (vivo) setAtletas(sortByConfianca(data || []));
      } catch (e) {
        if (vivo) {
          setAtletas([]);
          setErro(e.message || 'Erro ao carregar atletas');
        }
      } finally {
        if (vivo) setLoadingAtletas(false);
      }
    })();
    return () => { vivo = false; };
  }, [selected, esporte]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return cidades;
    return cidades.filter(
      (c) =>
        normalizar(c.cidade).includes(q) ||
        normalizar(c.uf).includes(q)
    );
  }, [cidades, busca]);

  const topConsolidado = useMemo(
    () => atletas.filter((a) => (Number(a.total_votos) || 0) >= 5).slice(0, 10),
    [atletas]
  );
  const topGeral = useMemo(() => atletas.slice(0, 15), [atletas]);

  const shell = {
    padding: '20px 16px 28px',
    position: 'relative',
    zIndex: 1,
    maxWidth: 560,
    margin: '0 auto',
  };

  // ---------- Detalhe da cidade ----------
  if (selected) {
    const ativ = nivelAtividade(selected);
    const isMinha =
      normalizar(selected.cidade) === normalizar(minhaCidade) &&
      (!minhaUf || !selected.uf || selected.uf === minhaUf);

    return (
      <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
        <div style={shell}>
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              padding: 0,
              marginBottom: 10,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <IconVoltar size={16} color="var(--accent)" />
            Voltar
          </button>

          <h1
            style={{
              color: 'var(--text-primary)',
              fontSize: 24,
              fontWeight: 900,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '0.02em',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {selected.cidade}
            {selected.uf ? ` · ${selected.uf}` : ''}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
            Só consulta · sem votar de fora
          </p>

          {/* Cartão resumo */}
          <div className="premium-card" style={{ borderRadius: 14, padding: 16, marginTop: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <CityCrest cidade={selected.cidade} uf={selected.uf} size={44} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Radar da cidade</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    {selected.player_count} atletas · {selected.total_votos} avaliações · {selected.with_votes} com nota
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '5px 8px',
                  borderRadius: 8,
                  background: `${ativ.color}22`,
                  color: ativ.color,
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {ativ.label}
              </span>
            </div>
            {isMinha && (
              <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Esta é a sua cidade. Para votar, use a aba <strong>Atletas</strong>.
              </p>
            )}
          </div>

          {erro && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{erro}</p>}

          {loadingAtletas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : topGeral.length === 0 ? (
            <div className="premium-card" style={{ borderRadius: 14, padding: 24, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
                Ainda não há atletas ativos listados nesta cidade.
              </p>
            </div>
          ) : (
            <>
              {topConsolidado.length > 0 && (
                <>
                  <div className="home-section-label" style={{ marginBottom: 10 }}>
                    Top consolidado
                  </div>
                  <PlayerList list={topConsolidado} onOpen={setPlayerModal} />
                </>
              )}
              <div className="home-section-label" style={{ margin: '20px 0 10px' }}>
                Todos · por confiança
              </div>
              <PlayerList list={topGeral} onOpen={setPlayerModal} />
            </>
          )}

          {playerModal && (
            <PlayerProfileModal jogador={playerModal} onClose={() => setPlayerModal(null)} />
          )}
        </div>
      </div>
    );
  }

  // ---------- Lista de cidades ----------
  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={shell}>
        <button
          type="button"
          onClick={() => onNavigate?.('atletas')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            padding: 0,
            marginBottom: 10,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <IconVoltar size={16} color="var(--accent)" />
          Voltar
        </button>

        <h1
          style={{
            color: 'var(--text-primary)',
            fontSize: 24,
            fontWeight: 900,
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: '0.02em',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          Explorar
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
          Veja o ranking de atletas em outra cidade
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 14,
            marginBottom: 4,
          }}
        >
          <button
            type="button"
            onClick={() => onNavigate?.('atletas')}
            style={{
              padding: '12px 10px',
              borderRadius: 12,
              border: '1.5px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            MINHA CIDADE
          </button>
          <button
            type="button"
            style={{
              padding: '12px 10px',
              borderRadius: 12,
              border: '1.5px solid rgba(200,241,53,0.55)',
              background: 'var(--accent)',
              color: '#0C0C14',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '0.04em',
              cursor: 'default',
              fontFamily: "'Inter', sans-serif",
              boxShadow: '0 4px 14px rgba(200,241,53,0.2)',
            }}
          >
            CIDADES
          </button>
        </div>

        {/* Busca — mesmo estilo Atletas */}
        <div style={{ position: 'relative', marginTop: 16, marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <IconBuscar size={18} color="var(--text-muted)" />
          </div>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cidade ou UF…"
            className="search-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '12px 12px 12px 42px',
              fontSize: 15,
              color: 'var(--text-primary)',
              fontFamily: "'Inter', sans-serif",
              outline: 'none',
            }}
          />
        </div>

        {erro && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{erro}</p>}

        {loadingCities && cidades.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="premium-card" style={{ borderRadius: 14, padding: 24, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
              {busca.trim()
                ? 'Nenhuma cidade encontrada.'
                : 'Ainda não há cidades com atletas cadastrados.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtradas.map((c) => {
              const ativ = nivelAtividade(c);
              const isMinha =
                normalizar(c.cidade) === normalizar(minhaCidade) &&
                (!minhaUf || !c.uf || c.uf === minhaUf);
              return (
                <button
                  key={`${c.cidade}|${c.uf}`}
                  type="button"
                  onClick={() => setSelected(c)}
                  className="premium-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: isMinha ? '1px solid var(--accent-line)' : undefined,
                    width: '100%',
                  }}
                >
                  <CityCrest cidade={c.cidade} uf={c.uf} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {c.cidade}
                        {c.uf ? ` · ${c.uf}` : ''}
                      </span>
                      {isMinha && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: 'var(--accent)',
                            background: 'var(--accent-dim)',
                            padding: '2px 6px',
                            borderRadius: 6,
                            letterSpacing: '0.04em',
                          }}
                        >
                          SUA CIDADE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {c.player_count} atleta{c.player_count !== 1 ? 's' : ''} · {c.total_votos} avaliações
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: ativ.color, textTransform: 'uppercase' }}>
                    {ativ.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerList({ list, onOpen }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
      {list.map((j, i) => {
        const votos = Number(j.total_votos) || 0;
        const media = votos >= 1 ? Number(j.media_estrelas).toFixed(1) : '—';
        const badge = confBadge(votos);
        const nome = nomeAtleta(j);
        return (
          <button
            key={j.id}
            type="button"
            onClick={() => onOpen?.(j)}
            className="premium-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 14,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: '100%',
            }}
          >
            <span
              style={{
                width: 22,
                fontWeight: 900,
                fontSize: 15,
                color: i < 3 ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >
              {i + 1}
            </span>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: 'var(--accent)',
                fontSize: 16,
                overflow: 'hidden',
                flexShrink: 0,
                border: '1.5px solid var(--accent-line)',
              }}
            >
              {j.foto_url ? (
                <img src={j.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (nome || '?').charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{nome}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {j.posicao || '—'} · {resumoAvaliacoes(j, { compacto: true })}
              </div>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: badge.bg,
                  color: badge.fg,
                }}
              >
                {badge.label}
              </span>
            </div>
            <div
              style={{
                fontWeight: 900,
                fontSize: 18,
                color: 'var(--accent)',
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >
              {media}
            </div>
          </button>
        );
      })}
    </div>
  );
}
