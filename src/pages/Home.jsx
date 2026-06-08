import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';
import { IconCrescimento, IconTrofeu, IconCalendario, IconAvaliar, IconBasquete, IconRanking } from '../components/Icons';

// eslint-disable-next-line no-unused-vars
const getEvolucaoValue = (id) => {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 7) - 3;
};

function BasketballHoopSVG() {
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" fill="none" style={{ position: 'absolute', right: -10, top: -10, opacity: 0.12, pointerEvents: 'none' }}>
      <circle cx="70" cy="70" r="60" stroke="#F97316" strokeWidth="3" />
      <line x1="70" y1="10" x2="70" y2="130" stroke="#F97316" strokeWidth="1.5" opacity="0.5" />
      <line x1="10" y1="70" x2="130" y2="70" stroke="#F97316" strokeWidth="1.5" opacity="0.5" />
      <path d="M20 20 A70 70 0 0 0 120 20" stroke="#F97316" strokeWidth="1" opacity="0.3" />
      <path d="M20 120 A70 70 0 0 1 120 120" stroke="#F97316" strokeWidth="1" opacity="0.3" />
      <circle cx="70" cy="70" r="15" stroke="#F97316" strokeWidth="2" opacity="0.6" />
    </svg>
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
      .subscribe();
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

        {/* Saudacao */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, fontFamily: "'Poppins', 'Inter', sans-serif" }}>
            {getGreeting()}, <span style={{ color: '#2563EB' }}>{greetingName}</span> {'\u{1F44B}'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'clamp(12px, 3vw, 14px)', marginTop: 4 }}>
            Voce esta entre os melhores jogadores de {city}.
          </div>
        </div>

        {/* Card: Sua Posicao - Estilo premium */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(17,24,39,0.95) 0%, rgba(37,99,235,0.15) 100%)',
          border: '1px solid rgba(37,99,235,0.25)',
          borderRadius: '20px',
          padding: 'clamp(18px, 4vw, 24px)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <BasketballHoopSVG />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              SUA POSICAO
            </div>
            <div style={{ fontSize: 'clamp(52px, 15vw, 72px)', fontWeight: 900, color: '#F97316', lineHeight: 1, marginBottom: 6, fontFamily: "'Poppins', 'Inter', sans-serif" }}>
              {myRank}
            </div>
            <div style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Ranking de {city} - {uf}
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(37, 99, 235, 0.15)',
              color: '#60A5FA',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: '8px',
              padding: '4px 12px',
              fontSize: 'clamp(10px, 2.5vw, 12px)',
              fontWeight: 800,
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#60A5FA" stroke="none">
                <path d="M2.5 18.5l2-9 5 4.5L12 7l2.5 7 5-4.5 2 9h-19z"/>
              </svg>
              {myBadge}
            </span>
          </div>
        </div>

        {/* Estatisticas Gerais - 4 colunas com icones */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ESTATISTICAS GERAIS
            </div>
            <button
              style={{ background: 'none', border: 0, color: '#2563EB', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}
            >
              Ver todas
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'clamp(6px, 1.5vw, 10px)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: 'clamp(12px, 3vw, 18px) clamp(6px, 1.5vw, 10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            {[
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, value: stats.jogadores, label: 'Jogadores', color: '#2563EB' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#F97316" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, value: stats.mediaGeral.toFixed(1), label: 'Media geral', color: '#F97316' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>, value: stats.avaliacoes, label: 'Avaliacoes', color: '#2563EB' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>, value: stats.torneios, label: 'Torneios', color: '#F97316' }
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: `${item.color}12`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Poppins', 'Inter', sans-serif" }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 'clamp(9px, 2vw, 10px)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Destaques */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
            DESTAQUES
          </div>

          <div className="destaques-row">
            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(37, 99, 235, 0.08)' }}>
                <IconCrescimento size={24} color="#2563EB" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="home-highlight-label">Evolucao semanal</div>
                <div className="home-highlight-text" style={{ fontSize: 'clamp(12px, 3vw, 13px)' }}>
                  Voce subiu <span>3 posicoes</span> esta semana
                </div>
              </div>
            </div>

            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(249, 115, 22, 0.08)' }}>
                <IconTrofeu size={24} color="#F97316" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="home-highlight-label">MVP da semana</div>
                <div className="home-highlight-text" style={{ fontSize: 'clamp(12px, 3vw, 13px)' }}>
                  <span>{lider ? lider.nome.split(' ')[0] : 'Lara Fabia'}</span> {(lider?.media_estrelas || 5.0).toFixed(1)}{'\u2605'}
                </div>
              </div>
            </div>

            <div className="home-highlight-card">
              <div className="home-highlight-icon" style={{ background: 'rgba(37, 99, 235, 0.08)' }}>
                <IconCalendario size={24} color="#2563EB" />
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

        {/* Acoes Rapidas */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
            ACOES RAPIDAS
          </div>

          <div className="acoes-rapidas-grid">
            <button className="quick-action-card quick-action-card-primary" onClick={() => onNavigate('jogadores')}>
              <div className="quick-action-icon" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <IconAvaliar size={24} color="#fff" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className="quick-action-text">Avaliar jogador</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('jogos')}>
              <div className="quick-action-icon" style={{ background: 'rgba(249, 115, 22, 0.08)' }}>
                <IconBasquete size={24} color="#F97316" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className="quick-action-text">Meus jogos</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('ranking')}>
              <div className="quick-action-icon" style={{ background: 'rgba(37, 99, 235, 0.08)' }}>
                <IconRanking size={24} color="#2563EB" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className="quick-action-text">Ver ranking</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('jogos', { aba: 'torneios' })}>
              <div className="quick-action-icon" style={{ background: 'rgba(249, 115, 22, 0.08)' }}>
                <IconTrofeu size={24} color="#F97316" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className="quick-action-text">Ver torneios</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
