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

export default function Home({ profile, onNavigate }) {
  const [stats, setStats] = useState({ jogadores: 0, avaliados: 0 });
  const [lider, setLider] = useState(null);
  const [jogadoresList, setJogadoresList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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
  }, []);


  async function loadData() {
    setLoading(true);
    try {
      const [{ data: jogs }, { data: ranking }] = await Promise.all([
        jogadoresAPI.listar(),
        rankingAPI.getTop5(),
      ]);

      const total = jogs?.length || 0;
      const avaliados = jogs?.filter(j => j.total_votos > 0).length || 0;
      setStats({ jogadores: total, avaliados });
      setJogadoresList(jogs || []);

      if (ranking?.length > 0) {
        setLider(ranking[0]);
      } else {
        setLider(null);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const getInitial = (nome) => nome ? nome.charAt(0).toUpperCase() : '?';

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
        {/* Badge localização (Pulsante) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '50px', background: 'rgba(59, 130, 246, 0.05)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', display: 'inline-block', animation: 'pulse-slow 2s infinite' }} />
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em', color: '#60a5fa', textTransform: 'uppercase', lineHeight: 1 }}>
              {`${profile?.cidade_atual || profile?.cidade || 'Altamira'} • ${profile?.uf || 'PA'} • AO VIVO`}
            </span>
          </div>
        </div>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'DM Sans', fontWeight: 900, fontSize: 44, lineHeight: 1, marginBottom: 10, letterSpacing: '-0.05em', textTransform: 'uppercase' }}>
            Ranks <span style={{ color: '#60a5fa' }}>Hoops</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>
            Os melhores jogadores da cidade, avaliados<br/>pelos próprios jogadores.
          </p>
        </div>

        {/* Botões principais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={() => onNavigate('votar')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 20px', borderRadius: '50px', fontWeight: 600, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', width: '100%', border: 'none', background: 'var(--accent-blue)', color: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Avaliar Jogadores
          </button>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(96, 165, 250, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stats.jogadores}</div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginTop: 4, textTransform: 'uppercase' }}>JOGADORES</div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(96, 165, 250, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stats.avaliados}</div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginTop: 4, textTransform: 'uppercase' }}>AVALIADOS</div>
          </div>
        </div>

        {/* Card Destaque do Ranking */}
        {lider && (
          <div className="card" style={{ marginBottom: 20, position: 'relative', overflow: 'hidden', padding: '24px 22px', border: '1px solid rgba(96, 165, 250, 0.15)', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(30, 41, 59, 0.2) 100%)' }}>
            {/* Elemento decorativo de fundo */}
            <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', opacity: 0.03, pointerEvents: 'none' }}>
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" /><path d="M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10" /><path d="M2 12h20" /></svg>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.05em', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                🔥 #1 Destaque da Cidade
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Avatar com badge de 1º */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {lider.foto_url ? (
                  <img src={lider.foto_url} alt={lider.nome} style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid #f59e0b', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>
                    {getInitial(lider.nome)}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: -4, right: -4, background: '#f59e0b', color: '#0d0f14', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, border: '2px solid var(--bg-card)' }}>
                  1º
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {lider.nome}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {jogadoresList?.find(j => j.id === lider.id)?.posicao || 'Ala-Armador'}
                  </span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {lider.total_votos} avaliações
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b', fontFamily: 'monospace' }}>
                  {Number(lider.media_estrelas).toFixed(1)}
                </div>
                <StarRating value={lider.media_estrelas} />
              </div>
            </div>
          </div>
        )}

        {/* Ver ranking completo (Secundário / Outline) */}
        <button onClick={() => onNavigate('ranking')} style={{ border: '2px solid #3b82f6', background: 'transparent', color: '#60a5fa', borderRadius: '50px', padding: '14px 20px', fontWeight: 600, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', marginBottom: '24px', fontFamily: 'inherit' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          Ver Ranking Completo
        </button>
      </div>
    </div>
  );
}
