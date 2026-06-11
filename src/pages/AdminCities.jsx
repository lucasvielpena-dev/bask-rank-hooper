import { useState, useEffect } from 'react';
import { masterAPI } from '../lib/supabase';
import { IconLocalizacao, IconVoltar } from '../components/Icons';

export default function AdminCities({ profile, onNavigate }) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCities();
  }, []);

  async function loadCities() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await masterAPI.getCityStats();
      if (err) throw err;
      const sorted = (data || []).sort((a, b) => (b.user_count || 0) - (a.user_count || 0));
      setCities(sorted);
    } catch (e) {
      setError(e.message || 'Erro ao carregar estatísticas das cidades.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-content" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="skeleton skeleton-avatar" style={{ width: 40, height: 40 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-bar" style={{ width: '60%', height: 16 }} />
            <div className="skeleton skeleton-bar" style={{ width: '40%', height: 12, marginTop: 6 }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(idx => (
            <div key={idx} className="skeleton" style={{ height: 110, borderRadius: '16px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: '20px 20px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => onNavigate?.('admin-dashboard')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '50px',
              fontFamily: 'inherit'
            }}
          >
            <IconVoltar size={16} color="var(--accent)" />
            Voltar
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(16, 185, 129, 0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconLocalizacao size={20} color="#10b981" />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>
              Cidades
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Estatísticas por região ({cities.length} cidades)
          </p>
        </div>

        {error && (
          <div style={{
            color: '#f87171',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            padding: 10,
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 14,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {cities.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <h3>Nenhuma cidade encontrada</h3>
            <p>Os dados aparecerão aqui quando houver usuários cadastrados.</p>
          </div>
        ) : (
          <div className="responsive-card-grid" style={{ paddingBottom: 24 }}>
            {cities.map((city, index) => (
              <div
                key={city.cidade || index}
                className="card card-enter"
                style={{
                  animationDelay: `${index * 30}ms`,
                  padding: '16px',
                  background: 'var(--bg-card)',
                  border: index < 3 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                  borderRadius: '16px',
                  boxShadow: 'var(--shadow)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: index < 3
                        ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                        : 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 900,
                      color: '#fff',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>
                        {city.cidade || 'Desconhecida'}
                      </h3>
                      {city.uf && (
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {city.uf}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8
                }}>
                  {[
                    { label: 'Usuários', value: city.user_count || 0, color: 'var(--accent)' },
                    { label: 'Jogadores', value: city.player_count || 0, color: 'var(--accent)' },
                    { label: 'Torneios', value: city.tournament_count || 0, color: '#8b5cf6' },
                    { label: 'Partidas', value: city.match_count || 0, color: '#10b981' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '10px 6px',
                        borderRadius: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        marginBottom: 4
                      }}>
                        {stat.label}
                      </span>
                      <span style={{
                        fontSize: '20px',
                        fontWeight: 900,
                        color: stat.color,
                        fontFamily: "'Bebas Neue', sans-serif"
                      }}>
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
