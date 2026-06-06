import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';

function StarRating({ value }) {
  return (
    <div className="stars">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`star${i <= Math.round(value) ? '' : ' empty'}`}>★</span>
      ))}
    </div>
  );
}

function renderBadge(media, totalVotos) {
  if (!totalVotos || totalVotos < 10) return null;
  if (media >= 4.5) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🏆 Elite</span>;
  if (media >= 4.0) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>⭐ Destaque</span>;
  if (media >= 3.5) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>📈 Promessa</span>;
  return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(148,163,184,0.15)', color: '#94a3b8', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🔄 Em Des.</span>;
}

export default function Home({ profile, onNavigate }) {
  const [stats, setStats] = useState({ jogadores: 0, avaliados: 0 });
  const [lider, setLider] = useState(null);
  const [top5, setTop5] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.cidade_atual, profile?.cidade]);

  useEffect(() => {
    const channel = supabase
      .channel('home-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.cidade_atual, profile?.cidade]);


  async function loadData() {
    setLoading(true);
    const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
    try {
      const [{ data: jogadores }, { data: ranking }] = await Promise.all([
        jogadoresAPI.listar(city),
        rankingAPI.getTop5(city),
      ]);

      const total = jogadores?.length || 0;
      const avaliados = jogadores?.filter(j => j.total_votos > 0).length || 0;
      setStats({ jogadores: total, avaliados });

      if (ranking?.length > 0) {
        setLider(ranking[0]);
        setTop5(ranking);
      } else {
        setLider(null);
        setTop5([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const getInitial = (nome) => nome ? nome.charAt(0).toUpperCase() : '?';

  const getMedalIcon = (pos) => {
    if (pos === 0) return '🥇';
    if (pos === 1) return '🥈';
    return '🥉';
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ padding: '24px 20px 0' }}>
        {/* Badge localização */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div className="badge">
            <span>⚡</span>
            {`${profile?.cidade_atual || profile?.cidade || 'Altamira'} • ${profile?.uf || 'PA'} • BRASIL`.toUpperCase()}
          </div>
        </div>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'DM Sans', fontWeight: 900, fontSize: 36, lineHeight: 1.1, marginBottom: 10 }}>
            Ranks <span style={{ color: '#60a5fa' }}>Hoops</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>
            Os melhores jogadores da cidade, avaliados<br/>pelos próprios jogadores.
          </p>
        </div>

        {/* Botões principais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={() => onNavigate('votar')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Avaliar Jogadores
          </button>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" style={{ display: 'block', margin: '0 auto 6px' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{stats.jogadores}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.05em' }}>JOGADORES</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" style={{ display: 'block', margin: '0 auto 6px' }}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{stats.avaliados}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.05em' }}>AVALIADOS</div>
          </div>
        </div>

        {/* Líder do ranking */}
        {lider && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.05em' }}>LÍDER DO RANKING</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="avatar avatar-lg">{getInitial(lider.nome)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {lider.nome}
                  {renderBadge(lider.media_estrelas, lider.total_votos)}
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{lider.total_votos} avaliações</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#60a5fa' }}>{Number(lider.media_estrelas).toFixed(1)}</div>
                <StarRating value={lider.media_estrelas} />
              </div>
            </div>
          </div>
        )}

        {/* Top 5 */}
        {top5.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              Top {top5.length} Jogadores
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {top5.map((j, i) => (
                <div key={j.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16 }}>{getMedalIcon(i)}</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{j.nome}</span>
                      {renderBadge(j.media_estrelas, j.total_votos)}
                    </div>
                    <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 14 }}>★ {Number(j.media_estrelas).toFixed(1)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(j.media_estrelas / 5) * 100}%`, background: i === 0 ? '#f59e0b' : '#3b82f6' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ver ranking completo */}
        <button className="btn btn-primary" onClick={() => onNavigate('ranking')} style={{ marginBottom: 24 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          Ver Ranking Completo
        </button>
      </div>
    </div>
  );
}
