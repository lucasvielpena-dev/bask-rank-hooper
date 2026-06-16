import { useState, useEffect } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import { useEsporte } from '../contexts/EsporteContext';
import { IconRanking, IconCalendario, IconBasquete } from '../components/Icons';

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }}>
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        background: 'var(--accent-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function HighlightSection({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10
      }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 8,
              background: 'var(--accent-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

export default function Destaques({ profile, onNavigate }) {
  const { esporte, cfg } = useEsporte();
  const [stats, setStats] = useState({ jogadores: 0, mediaGeral: 0, avaliacoes: 0, torneios: 0 });
  const [topJogadores, setTopJogadores] = useState([]);
  const [loading, setLoading] = useState(true);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  useEffect(() => {
    loadData();
  }, [profile, esporte]);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: jogs }, { data: ranking }, { count: tCount }] = await Promise.all([
        supabase.from('jogadores').select('*').eq('uf', uf).eq('esporte', esporte),
        rankingAPI.getTop5(city, uf, esporte),
        supabase.from('torneios').select('*', { count: 'exact', head: true })
      ]);

      const total = jogs?.length || 0;
      const totalVotes = jogs?.reduce((acc, curr) => acc + (curr.total_votos || 0), 0) || 0;
      const averageStarsSum = jogs?.reduce((acc, curr) => acc + (curr.media_estrelas || 0), 0) || 0;
      const generalAvg = total > 0 ? (averageStarsSum / total) : 0;

      setStats({ jogadores: total, mediaGeral: generalAvg, avaliacoes: totalVotes, torneios: tCount || 0 });
      setTopJogadores(ranking || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '30vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-content home-page">
      <div className="home-container">

        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => onNavigate('inicio')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
              marginBottom: 4,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Voltar
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2, fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Destaques
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
            O melhor de {city} - {uf} esta semana
          </p>
        </div>

        {/* Resumo Geral */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 16
        }}>
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            label="Jogadores ativos"
            value={stats.jogadores}
            color="blue"
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
            label="Média geral"
            value={stats.mediaGeral > 0 ? stats.mediaGeral.toFixed(1) : '--'}
            color="gold"
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>}
            label="Avaliações"
            value={stats.avaliacoes}
            color="blue"
          />
          <StatCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>}
            label="Torneios"
            value={stats.torneios}
            color="gold"
          />
        </div>

        {/* Top Ranking */}
        <HighlightSection
          title="Top Ranking"
          icon={<IconRanking size={18} color="var(--accent)" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topJogadores.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                Nenhum jogador no ranking ainda
              </div>
            ) : (
              topJogadores.slice(0, 5).map((jogador, i) => (
                <div key={jogador.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '8px 10px'
                }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: i === 0 ? 'rgba(200,241,53,0.12)' : i === 1 ? 'rgba(148,163,184,0.12)' : i === 2 ? 'rgba(205,124,47,0.12)' : 'var(--accent-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: i === 0 ? 'var(--accent)' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7C2F' : 'var(--accent)',
                    flexShrink: 0
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {jogador.nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {jogador.posicao || cfg.posicoes[0]} · {jogador.cidade}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ color: 'var(--accent)', fontSize: 12 }}>{'\u2605'}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {jogador.media_estrelas ? Number(jogador.media_estrelas).toFixed(1) : '--'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </HighlightSection>

        {/* Torneios Ativos */}
        <HighlightSection
          title="Torneios"
          icon={<IconCalendario size={18} color="var(--accent)" />}
        >
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
          background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px'
            }}>
              <IconCalendario size={24} color="var(--accent)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              {stats.torneios > 0 ? `${stats.torneios} torneio(s) ativo(s)` : 'Nenhum torneio ativo'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {stats.torneios > 0
                ? 'Participe dos torneios da sua cidade'
                : 'Novos torneios em breve'}
            </div>
            <button
              onClick={() => onNavigate('jogos', { aba: 'torneios' })}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Ver Torneios
            </button>
          </div>
        </HighlightSection>

        {/* Ação Rápida */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(200,241,53,0.15) 0%, rgba(200,241,53,0.05) 100%)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 16px rgba(200,241,53,0.15)'
        }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <IconBasquete size={24} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 1 }}>
              Avalie um jogador
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              Contribua para o ranking da comunidade
            </div>
          </div>
          <button
            onClick={() => onNavigate('atletas')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0
            }}
          >
            Avaliar
          </button>
        </div>

      </div>
    </div>
  );
}
