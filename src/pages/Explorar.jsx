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
import { IconBuscar, IconLocalizacao, IconVoltar, IconRanking } from '../components/Icons';
import PlayerProfileModal from '../components/PlayerProfileModal';

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
  if (n >= 8 && votos >= 20) return { key: 'quente', label: 'Quente', color: '#f87171' };
  if (n >= 4 && (votos >= 5 || comNota >= 3)) return { key: 'moderado', label: 'Moderado', color: '#fbbf24' };
  if (n >= 1) return { key: 'fraco', label: 'Em formação', color: '#93c5fd' };
  return { key: 'vazio', label: 'Sem dados', color: 'var(--text-muted)' };
}

function confBadge(votos) {
  const nivel = nivelConfianca(votos);
  const label = labelConfianca(nivel);
  const colors = {
    provisorio: { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
    em_evolucao: { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24' },
    consolidado: { bg: 'rgba(74,222,128,0.15)', fg: '#4ade80' },
  };
  const c = colors[nivel] || colors.provisorio;
  return { label, ...c };
}

export default function Explorar({ profile, onNavigate }) {
  const { esporte } = useEsporte();
  const [cidades, setCidades] = useState([]);
  const [busca, setBusca] = useState('');
  const [loadingCities, setLoadingCities] = useState(true);
  const [selected, setSelected] = useState(null); // { cidade, uf, ... }
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
        if (vivo) setCidades(data || []);
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
    let list = cidades;
    if (q) {
      list = list.filter(
        (c) =>
          normalizar(c.cidade).includes(q) ||
          normalizar(c.uf).includes(q) ||
          `${normalizar(c.cidade)} ${normalizar(c.uf)}`.includes(q)
      );
    }
    return list;
  }, [cidades, busca]);

  const topConsolidado = useMemo(
    () => atletas.filter((a) => (Number(a.total_votos) || 0) >= 5).slice(0, 10),
    [atletas]
  );
  const topGeral = useMemo(() => atletas.slice(0, 15), [atletas]);

  function abrirCidade(c) {
    setSelected(c);
    setBusca('');
  }

  // ---------- Detalhe da cidade ----------
  if (selected) {
    const ativ = nivelAtividade(selected);
    const isMinha =
      normalizar(selected.cidade) === normalizar(minhaCidade) &&
      (!minhaUf || !selected.uf || selected.uf === minhaUf);

    return (
      <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ padding: '16px 16px 28px', maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Voltar"
            >
              <IconVoltar size={18} color="var(--accent)" />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 900,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color: 'var(--text-primary)',
                }}
              >
                {selected.cidade}
                {selected.uf ? ` · ${selected.uf}` : ''}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Modo consulta · sem votar de fora
              </p>
            </div>
          </div>

          {/* Cartão da cidade */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <IconLocalizacao size={18} color="var(--accent)" />
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                    Radar da cidade
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selected.player_count}</strong> atletas
                  </span>
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selected.total_votos}</strong> avaliações
                  </span>
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selected.with_votes}</strong> com nota
                  </span>
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '6px 10px',
                  borderRadius: 99,
                  background: `${ativ.color}22`,
                  color: ativ.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {ativ.label}
              </span>
            </div>
            {isMinha && (
              <div
                style={{
                  marginTop: 12,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(200,241,53,0.08)',
                  border: '1px solid rgba(200,241,53,0.2)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                Esta é a sua cidade. Para votar, use a aba <strong>Atletas</strong>.
              </div>
            )}
          </div>

          {erro && (
            <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{erro}</div>
          )}

          {loadingAtletas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : topGeral.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
              Ainda não há atletas ativos listados nesta cidade.
            </div>
          ) : (
            <>
              {topConsolidado.length > 0 && (
                <>
                  <h2
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      margin: '0 0 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <IconRanking size={16} color="var(--accent)" />
                    Top consolidado
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>
                      (≥ 5 avaliações)
                    </span>
                  </h2>
                  <PlayerList
                    list={topConsolidado}
                    onOpen={setPlayerModal}
                    ranked
                  />
                </>
              )}

              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: '18px 0 10px',
                }}
              >
                Todos · por confiança
              </h2>
              <PlayerList list={topGeral} onOpen={setPlayerModal} ranked />
            </>
          )}

          {playerModal && (
            <PlayerProfileModal
              jogador={playerModal}
              onClose={() => setPlayerModal(null)}
            />
          )}
        </div>
      </div>
    );
  }

  // ---------- Busca de cidades ----------
  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: '16px 16px 28px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('atletas')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Voltar"
            >
              <IconVoltar size={18} color="var(--accent)" />
            </button>
          )}
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 900,
                fontFamily: "'Barlow Condensed', sans-serif",
                color: 'var(--text-primary)',
                letterSpacing: '0.02em',
              }}
            >
              EXPLORAR
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Veja o ranking de outra cidade antes de viajar
            </p>
          </div>
        </div>

        <div
          style={{
            margin: '14px 0 16px',
            padding: 12,
            borderRadius: 12,
            background: 'rgba(200,241,53,0.06)',
            border: '1px solid rgba(200,241,53,0.18)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          Aqui é <strong>só consulta</strong>. O ranking da sua cidade e as votações continuam na aba Atletas.
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <IconBuscar size={18} color="var(--text-muted)" />
          </div>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cidade ou UF… ex: Marabá"
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

        {erro && (
          <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{erro}</div>
        )}

        {loadingCities ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
            {busca.trim()
              ? 'Nenhuma cidade encontrada com esse nome.'
              : 'Ainda não há cidades com atletas cadastrados.'}
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
                  onClick={() => abrirCidade(c)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 14px',
                    borderRadius: 14,
                    border: isMinha ? '1px solid rgba(200,241,53,0.35)' : '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'var(--accent-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconLocalizacao size={18} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
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
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: ativ.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
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

function PlayerList({ list, onOpen, ranked }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 12px',
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {ranked && (
              <span
                style={{
                  width: 24,
                  fontWeight: 900,
                  fontSize: 14,
                  color: i < 3 ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}
              >
                {i + 1}
              </span>
            )}
            <div
              style={{
                width: 40,
                height: 40,
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
              }}
            >
              {j.foto_url ? (
                <img src={j.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (nome || '?').charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>{nome}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
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
                color: 'var(--text-primary)',
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
