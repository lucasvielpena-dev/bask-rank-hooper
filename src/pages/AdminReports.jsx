import { useState, useEffect } from 'react';
import { masterAPI } from '../lib/supabase';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function BarChart({ data, labelKey, valueKey, color = 'blue', horizontal = false }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);

  if (horizontal) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 100,
              fontSize: 'clamp(11px, 2.5vw, 13px)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textAlign: 'right',
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {item[labelKey]}
            </span>
            <div style={{ flex: 1, height: 20, background: 'var(--bg-secondary)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${(item[valueKey] / max) * 100}%`,
                height: '100%',
                background: color === 'blue'
                  ? 'var(--accent-blue-gradient-h)'
                  : 'var(--accent-gold-gradient-h)',
                borderRadius: 6,
                transition: 'width 0.6s ease'
              }} />
            </div>
            <span style={{
              fontSize: 'clamp(11px, 2.5vw, 13px)',
              fontWeight: 800,
              color: 'var(--text-primary)',
              minWidth: 30,
              textAlign: 'right',
              fontFamily: 'monospace'
            }}>
              {item[valueKey]}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(4px, 1vw, 8px)', height: 140, padding: '0 4px' }}>
      {data.map((item, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--text-primary)',
            fontFamily: 'monospace'
          }}>
            {item[valueKey]}
          </span>
          <div style={{
            width: '100%',
            maxWidth: 32,
            height: `${(item[valueKey] / max) * 100}%`,
            minHeight: item[valueKey] > 0 ? 4 : 0,
            background: color === 'blue'
              ? 'var(--accent-blue-gradient)'
              : 'var(--accent-gold-gradient)',
            borderRadius: '4px 4px 2px 2px',
            transition: 'height 0.6s ease'
          }} />
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            textAlign: 'center'
          }}>
            {item[labelKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'clamp(12px, 2vw, 16px)',
      padding: 'clamp(14px, 3vw, 20px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: 'var(--accent-blue-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {icon}
        </div>
        <h3 style={{
          fontSize: 'clamp(12px, 3vw, 14px)',
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '0.02em'
        }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

export default function AdminReports({ profile, onNavigate }) {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  const isMaster = profile?.role === 'master';

  useEffect(() => {
    if (isMaster) loadReports();
  }, [isMaster]);

  async function loadReports() {
    setLoading(true);
    try {
      const { data, error } = await masterAPI.getReports();
      if (error) throw error;
      setReports(data);
    } catch (e) {
      console.error('Erro ao carregar relatórios:', e);
    }
    setLoading(false);
  }

  if (!isMaster) {
    return (
      <div className="page-content" style={{ background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.3 }}>
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h2 style={{ fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Acesso negado
          </h2>
          <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Você não tem permissão para acessar os relatórios.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const usersPerMonth = reports?.usuarios_por_mes || [];
  const playersByCity = reports?.jogadores_por_cidade || [];
  const matchesPerMonth = reports?.partidas_por_mes || [];
  const ratingsPerMonth = reports?.avaliacoes_por_mes || [];
  const activeTournaments = reports?.torneios_mais_ativos || [];
  const topPlayers = reports?.jogadores_mais_ativos || [];

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(12px, 3vw, 20px) 24px', maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'clamp(16px, 4vw, 24px)' }}>
          <button
            onClick={() => onNavigate('master')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 style={{
              fontSize: 'clamp(18px, 5vw, 24px)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em'
            }}>
              Relatórios
            </h1>
            <p style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', color: 'var(--text-secondary)' }}>
              Dados analíticos da plataforma
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 3vw, 16px)' }}>

          {/* 1. Crescimento de Usuários */}
          <SectionCard
            title="Crescimento de Usuários"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          >
            {usersPerMonth.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Sem dados disponíveis</p>
            ) : (
              <BarChart data={usersPerMonth} labelKey="mes" valueKey="total" color="blue" />
            )}
          </SectionCard>

          {/* 2. Jogadores por Cidade */}
          <SectionCard
            title="Jogadores por Cidade"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>}
          >
            {playersByCity.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Sem dados disponíveis</p>
            ) : (
              <BarChart data={playersByCity.slice(0, 10)} labelKey="cidade" valueKey="total" color="gold" horizontal />
            )}
          </SectionCard>

          {/* 3. Partidas por Mês */}
          <SectionCard
            title="Partidas por Mês"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>}
          >
            {matchesPerMonth.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Sem dados disponíveis</p>
            ) : (
              <BarChart data={matchesPerMonth} labelKey="mes" valueKey="total" color="blue" />
            )}
          </SectionCard>

          {/* 4. Avaliações por Mês */}
          <SectionCard
            title="Avaliações por Mês"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
          >
            {ratingsPerMonth.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Sem dados disponíveis</p>
            ) : (
              <BarChart data={ratingsPerMonth} labelKey="mes" valueKey="total" color="gold" />
            )}
          </SectionCard>

          {/* 5. Torneios Mais Ativos */}
          <SectionCard
            title="Torneios Mais Ativos"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>}
          >
            {activeTournaments.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Sem dados disponíveis</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeTournaments.map((t, i) => {
                  const maxTeams = Math.max(...activeTournaments.map(x => x.total_equipes || 1));
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 10
                    }}>
                      <span style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: i === 0 ? 'rgba(249,115,22,0.15)' : i === 1 ? 'rgba(148,163,184,0.12)' : i === 2 ? 'rgba(205,124,47,0.12)' : 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 800,
                        color: i === 0 ? '#F97316' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7C2F' : 'var(--text-muted)',
                        flexShrink: 0
                      }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 'clamp(12px, 3vw, 13px)',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {t.nome || 'Torneio'}
                        </div>
                        <div style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginTop: 2
                        }}>
                          {t.total_equipes || 0} equipes
                        </div>
                      </div>
                      <div style={{
                        width: 60,
                        height: 6,
                        background: 'var(--bg-card)',
                        borderRadius: 3,
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        <div style={{
                          width: `${((t.total_equipes || 0) / maxTeams) * 100}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #2563EB, #60A5FA)',
                          borderRadius: 3
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* 6. Jogadores Mais Ativos */}
          <SectionCard
            title="Jogadores Mais Ativos"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          >
            {topPlayers.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Sem dados disponíveis</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topPlayers.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 10
                  }}>
                    <span style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: i === 0 ? 'rgba(249,115,22,0.15)' : i === 1 ? 'rgba(148,163,184,0.12)' : i === 2 ? 'rgba(205,124,47,0.12)' : 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 800,
                      color: i === 0 ? '#F97316' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7C2F' : 'var(--text-muted)',
                      flexShrink: 0
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'clamp(12px, 3vw, 13px)',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {p.nome || 'Jogador'}
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: 12,
                        marginTop: 2
                      }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{p.total_votos || 0}</span> votos
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: 700, color: '#F97316' }}>{Number(p.media_estrelas || 0).toFixed(1)}</span> ★
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
