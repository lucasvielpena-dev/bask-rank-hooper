import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';
import { IconCrescimento, IconTrofeu, IconCalendario, IconAvaliar, IconBasquete, IconRanking, IconPlacar, IconRelogio } from '../components/Icons';

const getEvolucaoValue = (id) => {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 7) - 3;
};

function BasketballSVG({ style }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" style={style}>
      <circle cx="100" cy="100" r="90" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
      <path d="M100 10 A90 90 0 0 1 100 190" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <path d="M100 10 A90 90 0 0 0 100 190" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <path d="M30 40 A90 90 0 0 0 30 160" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <path d="M170 40 A90 90 0 0 1 170 160" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
    </svg>
  );
}

function StatsMiniCard({ icon, value, label, iconBg, iconColor }) {
  return (
    <div className="stats-mini-card">
      <div className="stat-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function Home({ profile, onNavigate }) {
  const [stats, setStats] = useState({ jogadores: 0, torneios: 0, avaliacoes: 0, mediaGeral: 0.0 });
  const [myPlayerInfo, setMyPlayerInfo] = useState(null);
  const [myRank, setMyRank] = useState('--');
  const [lider, setLider] = useState(null);
  const [loading, setLoading] = useState(true);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  useEffect(() => {
    if (profile) loadData(city, uf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogadores' }, () => loadData(city, uf))
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') console.warn('Realtime connection lost');
      });
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function loadData(cityVal = city, ufVal = uf) {
    setLoading(true);
    try {
      const [{ data: jogs }, { data: ranking }, { count: tCount }] = await Promise.all([
        jogadoresAPI.listarPorEstado(ufVal),
        rankingAPI.getTop5(cityVal, ufVal),
        supabase.from('torneios').select('*', { count: 'exact', head: true })
      ]);

      const total = jogs?.length || 0;
      const totalVotes = jogs?.reduce((acc, curr) => acc + (curr.total_votos || 0), 0) || 0;
      const averageStarsSum = jogs?.reduce((acc, curr) => acc + (curr.media_estrelas || 0), 0) || 0;
      const generalAvg = total > 0 ? (averageStarsSum / total) : 4.8;

      setStats({ jogadores: total, torneios: tCount || 0, avaliacoes: totalVotes, mediaGeral: generalAvg });
      setLider(ranking?.length > 0 ? ranking[0] : null);

      if (profile?.player_id) {
        const { data: pInfo } = await supabase.from('jogadores').select('*').eq('id', profile.player_id).maybeSingle();
        if (pInfo) setMyPlayerInfo(pInfo);

        const { data: rankList } = await rankingAPI.get(cityVal, ufVal, 200);
        if (rankList) {
          const myIndex = rankList.findIndex(j => j.id === profile.player_id);
          setMyRank(myIndex !== -1 ? `#${myIndex + 1}` : '--');
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const getBadgeText = (media) => {
    if (media >= 4.5) return 'ELITE';
    if (media >= 4.0) return 'DESTAQUE';
    if (media >= 3.5) return 'PROMESSA';
    return 'EM DEV.';
  };

  const myBadge = getBadgeText(myPlayerInfo?.media_estrelas || 0);
  const greetingName = profile?.apelido || profile?.nome_completo?.split(' ')[0] || 'Atleta';

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-content home-page">
      <div className="home-container">

        {/* HERO BANNER */}
        <div className="hero-banner">
          <BasketballSVG style={{ position: 'absolute', right: '-30px', top: '-20px', width: '220px', height: '220px', opacity: 0.08, zIndex: 1 }} />
          <div className="hero-content">
            <div>
              <div className="hero-greeting">
                {getGreeting()}, <span>{greetingName}</span>
              </div>
              <div className="hero-subtitle">
                Voce esta entre os melhores jogadores de {city}.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
              <div style={{
                background: 'rgba(255,138,0,0.15)',
                border: '1px solid rgba(255,138,0,0.3)',
                borderRadius: 16,
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ fontSize: 'clamp(28px, 7vw, 36px)', fontWeight: 900, color: '#FF8A00', lineHeight: 1 }}>
                  {myRank}
                </span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posicao</div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#FF8A00',
                    background: 'rgba(255,138,0,0.15)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em'
                  }}>
                    {myBadge}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS GRID - 4 mini cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
          <StatsMiniCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2F6BFF" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            value={stats.jogadores}
            label="Jogadores"
            iconBg="rgba(21,71,255,0.1)"
            iconColor="#2F6BFF"
          />
          <StatsMiniCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF8A00" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
            value={stats.mediaGeral.toFixed(1)}
            label="Media"
            iconBg="rgba(255,138,0,0.1)"
            iconColor="#FF8A00"
          />
          <StatsMiniCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2F6BFF" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12h20"/></svg>}
            value={stats.avaliacoes}
            label="Avaliacoes"
            iconBg="rgba(21,71,255,0.1)"
            iconColor="#2F6BFF"
          />
          <StatsMiniCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF8A00" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>}
            value={stats.torneios}
            label="Torneios"
            iconBg="rgba(255,138,0,0.1)"
            iconColor="#FF8A00"
          />
        </div>

        {/* DESTAQUES */}
        <div className="home-section">
          <div className="home-section-header">
            <div className="home-section-title">Destaques</div>
            <button className="home-section-link" onClick={() => onNavigate('jogos', { aba: 'torneios' })}>Ver tudo</button>
          </div>
          <div className="destaques-row">
            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(21, 71, 255, 0.08)' }}>
                <IconCrescimento size={24} color="#2F6BFF" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="home-highlight-label">Evolucao semanal</div>
                <div className="home-highlight-text" style={{ fontSize: 'clamp(12px, 3vw, 13px)' }}>
                  Voce subiu <span>3 posicoes</span> esta semana
                </div>
              </div>
            </div>

            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(255, 138, 0, 0.08)' }}>
                <IconTrofeu size={24} color="#FF8A00" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="home-highlight-label">MVP da semana</div>
                <div className="home-highlight-text" style={{ fontSize: 'clamp(12px, 3vw, 13px)' }}>
                  <span>{lider ? lider.nome.split(' ')[0] : 'Lara'}</span> {(lider?.media_estrelas || 5.0).toFixed(1)} estrelas
                </div>
              </div>
            </div>

            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(21, 71, 255, 0.08)' }}>
                <IconCalendario size={24} color="#2F6BFF" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="home-highlight-label">Torneio municipal</div>
                <div className="home-highlight-text" style={{ fontSize: 'clamp(12px, 3vw, 13px)' }}>
                  <span>Inscricoes abertas</span> para novas equipes
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PROXIMO JOGO */}
        <div className="home-section">
          <div className="home-section-header">
            <div className="home-section-title">Proximo Jogo</div>
          </div>
          <div className="proximo-jogo-card">
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(21,71,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconBasquete size={22} color="#2F6BFF" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Panteras</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Time A</div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255,138,0,0.15)',
                  border: '1px solid rgba(255,138,0,0.3)',
                  borderRadius: 12,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 900,
                  color: '#FF8A00',
                  letterSpacing: '0.05em'
                }}>VS</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Lobos</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Time B</div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,138,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconBasquete size={22} color="#FF8A00" />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>
                  <IconRelogio size={14} color="rgba(255,255,255,0.5)" />
                  Hoje 20:00
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>
                  <IconPlacar size={14} color="rgba(255,255,255,0.5)" />
                  Quadra 1
                </div>
              </div>

              <button
                onClick={() => onNavigate('jogos')}
                style={{
                  background: 'linear-gradient(135deg, #1547FF 0%, #2F6BFF 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                  boxShadow: '0 4px 16px rgba(21,71,255,0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(21,71,255,0.45)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(21,71,255,0.3)'; }}
              >
                Ver jogo
              </button>
            </div>
          </div>
        </div>

        {/* TORNEIOS EM DESTAQUE */}
        <div className="home-section">
          <div className="home-section-header">
            <div className="home-section-title">Torneios</div>
            <button className="home-section-link" onClick={() => onNavigate('jogos', { aba: 'torneios' })}>Ver todos</button>
          </div>
          <div className="torneio-card">
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <IconTrofeu size={20} color="#FF8A00" />
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#FF8A00', letterSpacing: '0.03em' }}>COPA ALTAMIRA</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4, fontWeight: 500 }}>
                  Inicio: 10/06/2026
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 8,
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#4ade80',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em'
                }}>
                  Inscricoes abertas
                </div>
              </div>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'rgba(255,138,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IconTrofeu size={28} color="#FF8A00" />
              </div>
            </div>
          </div>
        </div>

        {/* ACOES RAPIDAS */}
        <div className="home-section home-actions-section">
          <div className="home-section-title">Acoes Rapidas</div>
          <div className="acoes-rapidas-grid">
            <button className="quick-action-card quick-action-card-primary" onClick={() => onNavigate('jogadores')}>
              <div className="quick-action-icon" style={{ background: 'rgba(255, 255, 255, 0.16)' }}>
                <IconAvaliar size={24} color="#fff" />
              </div>
              <div className="quick-action-text">Avaliar jogador</div>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('jogos')}>
              <div className="quick-action-icon" style={{ background: 'rgba(255, 138, 0, 0.08)' }}>
                <IconBasquete size={24} color="#FF8A00" />
              </div>
              <div className="quick-action-text">Meus jogos</div>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('ranking')}>
              <div className="quick-action-icon" style={{ background: 'rgba(21, 71, 255, 0.08)' }}>
                <IconRanking size={24} color="#2F6BFF" />
              </div>
              <div className="quick-action-text">Ver ranking</div>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('jogos', { aba: 'torneios' })}>
              <div className="quick-action-icon" style={{ background: 'rgba(255, 138, 0, 0.08)' }}>
                <IconTrofeu size={24} color="#FF8A00" />
              </div>
              <div className="quick-action-text">Ver torneios</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
