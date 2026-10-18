import { useState, useEffect } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import { nomeAtleta } from '../lib/nomes';
import { useEsporte } from '../contexts/EsporteContext';
import { IconVoltar, IconCalendario, IconRanking } from '../components/Icons';

function normalizarCidade(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*-\s*[a-z]{2}$/i, '')
    .replace(/\s+/g, ' ');
}

export default function Destaques({ profile, onNavigate }) {
  const { esporte, cfg } = useEsporte();
  const [stats, setStats] = useState({ jogadores: 0, mediaGeral: 0, avaliacoes: 0, torneios: 0 });
  const [topJogadores, setTopJogadores] = useState([]);
  const [loading, setLoading] = useState(true);

  const city = profile?.cidade_atual || profile?.cidade || '';
  const uf = (profile?.uf || '').toUpperCase();

  useEffect(() => {
    loadData();
  }, [profile, esporte]);

  async function loadData() {
    setLoading(true);
    try {
      const cityNorm = normalizarCidade(city);
      const rankingPromise = cityNorm
        ? rankingAPI.getTop5(city, uf || null, esporte)
        : Promise.resolve({ data: [] });

      let jogsQuery = supabase
        .from('jogadores')
        .select('*')
        .eq('ativo', true)
        .eq('esporte', esporte);
      if (uf) jogsQuery = jogsQuery.eq('uf', uf);

      let torneiosQuery = supabase.from('torneios').select('*', { count: 'exact', head: true });
      if (city) torneiosQuery = torneiosQuery.eq('cidade', city);
      if (uf) torneiosQuery = torneiosQuery.eq('uf', uf);

      const [{ data: jogsRaw }, { data: ranking }, torneiosRes] = await Promise.all([
        jogsQuery,
        rankingPromise,
        torneiosQuery,
      ]);

      const jogs = (jogsRaw || []).filter((j) => {
        if (!cityNorm) return false;
        return normalizarCidade(j.cidade) === cityNorm;
      });

      const total = jogs.length;
      const totalVotes = jogs.reduce((acc, curr) => acc + (curr.total_votos || 0), 0);
      const withMedia = jogs.filter((j) => (j.total_votos || 0) >= 1);
      const averageStarsSum = withMedia.reduce((acc, curr) => acc + (Number(curr.media_estrelas) || 0), 0);
      const generalAvg = withMedia.length > 0 ? averageStarsSum / withMedia.length : 0;

      let top = ranking || [];
      if (cityNorm && top.length) {
        const onlyCity = top.filter((j) => normalizarCidade(j.cidade) === cityNorm);
        if (onlyCity.length) top = onlyCity;
      }
      if ((!top || top.length === 0) && jogs.length) {
        top = [...jogs]
          .filter((j) => (j.total_votos || 0) >= 1)
          .sort((a, b) => (Number(b.media_estrelas) || 0) - (Number(a.media_estrelas) || 0))
          .slice(0, 5);
      }

      setStats({
        jogadores: total,
        mediaGeral: generalAvg,
        avaliacoes: totalVotes,
        torneios: torneiosRes?.count || 0,
      });
      setTopJogadores(top);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const cityLabel = city ? `${city}${uf ? ` · ${uf}` : ''}` : 'sua cidade';

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)', position: 'relative' }}>
      <div style={{ padding: '20px 16px 28px', position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto' }}>

        {/* Header — mesmo padrão Atletas */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => onNavigate?.('inicio')}
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
            Destaques
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: "'Inter', sans-serif", marginTop: 4 }}>
            O melhor de {cityLabel} esta semana
          </p>
        </div>

        {/* Stats em cards iguais ao resto */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 22 }}>
          {[
            { label: 'Jogadores', value: stats.jogadores },
            { label: 'Média geral', value: stats.mediaGeral > 0 ? stats.mediaGeral.toFixed(1) : '—' },
            { label: 'Avaliações', value: stats.avaliacoes },
            { label: 'Torneios', value: stats.torneios },
          ].map((s) => (
            <div
              key={s.label}
              className="premium-card"
              style={{ borderRadius: 14, padding: '14px 12px' }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  marginTop: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Top ranking */}
        <div className="home-section-label" style={{ marginBottom: 10 }}>
          Top da cidade
        </div>

        {topJogadores.length === 0 ? (
          <div
            className="premium-card"
            style={{ borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 20 }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, fontFamily: "'Inter', sans-serif" }}>
              Ainda não há ranking com avaliações em {cityLabel}.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 14, width: '100%' }}
              onClick={() => onNavigate?.('atletas')}
            >
              Ir para Atletas
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
            {topJogadores.map((jogador, i) => {
              const nome = nomeAtleta(jogador);
              const media =
                (jogador.total_votos || 0) >= 1
                  ? Number(jogador.media_estrelas).toFixed(1)
                  : '—';
              return (
                <div
                  key={jogador.id || i}
                  className="premium-card"
                  style={{
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
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
                      border: '1.5px solid rgba(200,241,53,0.3)',
                    }}
                  >
                    {jogador.foto_url ? (
                      <img
                        src={jogador.foto_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      (nome || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--text-primary)',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {nome}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginTop: 2,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {jogador.posicao || cfg?.posicoes?.[0] || '—'} · {jogador.total_votos || 0}{' '}
                      {(jogador.total_votos || 0) === 1 ? 'avaliação' : 'avaliações'}
                    </div>
                  </div>
                  <div
                    className="highlight-score"
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: 'var(--accent)',
                      fontFamily: "'Barlow Condensed', sans-serif",
                    }}
                  >
                    {media}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Torneios */}
        <div className="home-section-label" style={{ marginBottom: 10 }}>
          Torneios
        </div>
        <div className="premium-card" style={{ borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconCalendario size={18} color="var(--accent)" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {stats.torneios > 0
                  ? `${stats.torneios} torneio(s) na cidade`
                  : 'Nenhum torneio ativo'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {stats.torneios > 0 ? 'Participe dos torneios locais' : 'Novos torneios em breve'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => onNavigate?.('torneios')}
          >
            Ver torneios
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => onNavigate?.('atletas')}
        >
          <IconRanking size={16} color="currentColor" />
          Ver ranking completo
        </button>
      </div>
    </div>
  );
}
