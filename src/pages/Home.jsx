import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';
import { IconTrofeu, IconAvaliar, IconBasquete, IconRanking } from '../components/Icons';

function BasketballHoopSVG() {
  return (
    <svg viewBox="0 0 200 220" fill="none" style={{
      position: 'absolute',
      right: -15,
      top: -20,
      width: 'clamp(120px, 30vw, 180px)',
      height: 'auto',
      opacity: 0.2,
      pointerEvents: 'none'
    }}>
      <circle cx="100" cy="110" r="50" stroke="#F97316" strokeWidth="4" />
      <line x1="100" y1="60" x2="100" y2="10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="60" x2="140" y2="60" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 60 Q60 90 80 110" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.15" />
      <path d="M140 60 Q140 90 120 110" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.15" />
      <circle cx="90" cy="30" r="20" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.08" />
    </svg>
  );
}

const ChevronArrow = () => (
  <svg className="home-quick-action-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

export default function Home({ profile, onNavigate }) {
  const [stats, setStats] = useState({ jogadores: 0, torneios: 0, avaliacoes: 0, mediaGeral: 0.0 });
  const [myPlayerInfo, setMyPlayerInfo] = useState(null);
  const [myRank, setMyRank] = useState('--');
  const [loading, setLoading] = useState(true);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  useEffect(() => {
    if (profile) loadData(city, uf);
  }, [profile, city, uf]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jogadores' }, () => loadData(city, uf))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, city, uf]);

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

  const statsData = [
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, value: stats.jogadores, label: 'Jogadores', color: 'blue' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, value: stats.mediaGeral.toFixed(1), label: 'Média geral', color: 'gold' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>, value: stats.avaliacoes, label: 'Avaliações', color: 'blue' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>, value: stats.torneios, label: 'Torneios', color: 'gold' }
  ];

  return (
    <div className="page-content home-page">
      <div className="home-container">

        {/* Saudacao */}
        <div className="home-greeting">
          <div className="home-greeting-title">
            {getGreeting()}, <span className="home-greeting-name">{greetingName}</span> {'\u{1F44B}'}
          </div>
          <div className="home-greeting-sub">
            Você está entre os melhores jogadores de {city}.
          </div>
        </div>

        {/* Row: Posicao + Estatisticas lado a lado */}
        <div className="home-top-row">

          {/* Card Posicao */}
          <div className="home-position-card">
            <BasketballHoopSVG />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="home-position-label">SUA POSIÇÃO</div>
              <div className="home-position-number">{myRank}</div>
              <div className="home-position-city">Ranking de {city} - {uf}</div>
              <span className="home-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M2.5 18.5l2-9 5 4.5L12 7l2.5 7 5-4.5 2 9h-19z"/>
                </svg>
                {myBadge}
              </span>
            </div>
          </div>

          {/* Card Estatisticas */}
          <div className="home-stats-card">
            <div className="home-stats-header">
              <div className="home-section-label">ESTATÍSTICAS GERAIS</div>
              <button className="home-section-link">Ver todas</button>
            </div>
            <div className="home-stats-grid">
              {statsData.map((item, i) => (
                <div key={item.label} className={`home-stat-item ${i < 3 ? 'home-stat-divider' : ''}`}>
                  <div className={`home-stat-icon ${item.color === 'blue' ? 'home-stat-icon-blue' : 'home-stat-icon-gold'}`}>
                    {item.icon}
                  </div>
                  <div className="home-stat-value">{item.value}</div>
                  <div className="home-stat-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Acoes Rapidas */}
        <div>
          <div className="home-section-label" style={{ marginBottom: 14 }}>
            AÇÕES RÁPIDAS
          </div>

          <div className="acoes-rapidas-grid">
            {[
              { icon: <IconAvaliar size={24} color="#fff" />, label: 'Avaliar jogador', action: () => onNavigate('jogadores'), primary: true },
              { icon: <IconBasquete size={24} color="#F97316" />, label: 'Meus jogos', action: () => onNavigate('jogos'), primary: false },
              { icon: <IconRanking size={24} color="#2563EB" />, label: 'Ver ranking', action: () => onNavigate('ranking'), primary: false },
              { icon: <IconTrofeu size={24} color="#F97316" />, label: 'Ver torneios', action: () => onNavigate('jogos', { aba: 'torneios' }), primary: false }
            ].map((item) => (
              <button
                key={item.label}
                className={`home-quick-action ${item.primary ? 'home-quick-action-primary' : ''}`}
                onClick={item.action}
              >
                <div className="home-quick-action-header">
                  <div
                    className="home-quick-action-icon"
                    style={{ background: item.primary ? 'rgba(255,255,255,0.16)' : (item.icon.props.color === '#F97316' ? 'var(--accent-gold-dim)' : 'var(--accent-blue-dim)') }}
                  >
                    {item.icon}
                  </div>
                  <ChevronArrow />
                </div>
                <div className="home-quick-action-label">{item.label}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
