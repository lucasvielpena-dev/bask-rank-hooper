import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';
import { IconAvaliar, IconBasquete, IconRanking, IconTrofeu } from '../components/Icons';

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
    <svg viewBox="0 0 200 220" fill="none" style={{
      position: 'absolute',
      right: -20,
      top: -30,
      width: 'clamp(140px, 35vw, 200px)',
      height: 'auto',
      opacity: 0.18,
      pointerEvents: 'none'
    }}>
      <circle cx="100" cy="110" r="50" stroke="#F97316" strokeWidth="4" />
      <line x1="100" y1="60" x2="100" y2="10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="60" x2="140" y2="60" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 60 Q60 90 80 110" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
      <path d="M140 60 Q140 90 120 110" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
      <path d="M70 60 Q75 85 90 105" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
      <path d="M130 60 Q125 85 110 105" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
      <path d="M80 60 Q82 80 95 100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
      <path d="M120 60 Q118 80 105 100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
      <circle cx="90" cy="30" r="20" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
      <path d="M70 30 Q90 20 110 30" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
      <line x1="90" y1="10" x2="90" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
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
          <div style={{
            fontSize: 'clamp(22px, 6vw, 28px)',
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.2
          }}>
            {getGreeting()}, <span style={{ color: '#2563EB' }}>{greetingName}</span> {'\u{1F44B}'}
          </div>
          <div style={{ color: '#94A3B8', fontSize: 'clamp(12px, 3vw, 14px)', marginTop: 6 }}>
            Voce esta entre os melhores jogadores de {city}.
          </div>
        </div>

        {/* Card Sua Posicao */}
        <div style={{
          background: 'linear-gradient(135deg, #111827 0%, rgba(37,99,235,0.12) 100%)',
          border: '1px solid rgba(37,99,235,0.2)',
          borderRadius: '20px',
          padding: 'clamp(20px, 5vw, 28px)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 28,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)'
        }}>
          <BasketballHoopSVG />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{
              fontSize: 'clamp(10px, 2.5vw, 12px)',
              fontWeight: 700,
              color: '#94A3B8',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8
            }}>
              SUA POSICAO
            </div>
            <div style={{
              fontSize: 'clamp(56px, 16vw, 80px)',
              fontWeight: 900,
              color: '#F97316',
              lineHeight: 1,
              marginBottom: 6,
              letterSpacing: '-0.02em'
            }}>
              {myRank}
            </div>
            <div style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: '#94A3B8', marginBottom: 14 }}>
              Ranking de {city} - {uf}
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(37, 99, 235, 0.15)',
              color: '#60A5FA',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              borderRadius: '8px',
              padding: '5px 12px',
              fontSize: 'clamp(10px, 2.5vw, 11px)',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#60A5FA" stroke="none">
                <path d="M2.5 18.5l2-9 5 4.5L12 7l2.5 7 5-4.5 2 9h-19z"/>
              </svg>
              {myBadge}
            </span>
          </div>
        </div>

        {/* Estatisticas Gerais */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ESTATISTICAS GERAIS
            </div>
            <button style={{ background: 'none', border: 0, color: '#2563EB', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>
              Ver todas
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0,
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
          }}>
            {[
              { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, value: stats.jogadores, label: 'Jogadores' },
              { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="#F97316" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, value: stats.mediaGeral.toFixed(1), label: 'Media geral' },
              { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>, value: stats.avaliacoes, label: 'Avaliacoes' },
              { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>, value: stats.torneios, label: 'Torneios' }
            ].map((item, i) => (
              <div key={item.label} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 'clamp(14px, 3vw, 20px) clamp(6px, 1.5vw, 10px)',
                borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none'
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: i % 2 === 0 ? 'rgba(37,99,235,0.1)' : 'rgba(249,115,22,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {item.icon}
                </div>
                <div style={{
                  fontSize: 'clamp(20px, 5vw, 28px)',
                  fontWeight: 800,
                  color: '#FFFFFF'
                }}>
                  {item.value}
                </div>
                <div style={{
                  fontSize: 'clamp(10px, 2.5vw, 11px)',
                  color: '#64748B',
                  fontWeight: 600,
                  textAlign: 'center'
                }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acoes Rapidas */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
            ACOES RAPIDAS
          </div>

          <div className="acoes-rapidas-grid">
            <button className="quick-action-card quick-action-card-primary" onClick={() => onNavigate('jogadores')}>
              <div className="quick-action-icon" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <IconAvaliar size={24} color="#fff" />
              </div>
              <div className="quick-action-text">Avaliar jogador</div>
              <svg style={{ marginTop: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('jogos')}>
              <div className="quick-action-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>
                <IconBasquete size={24} color="#F97316" />
              </div>
              <div className="quick-action-text">Meus jogos</div>
              <svg style={{ marginTop: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('ranking')}>
              <div className="quick-action-icon" style={{ background: 'rgba(37,99,235,0.1)' }}>
                <IconRanking size={24} color="#2563EB" />
              </div>
              <div className="quick-action-text">Ver ranking</div>
              <svg style={{ marginTop: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button className="quick-action-card" onClick={() => onNavigate('jogos', { aba: 'torneios' })}>
              <div className="quick-action-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>
                <IconTrofeu size={24} color="#F97316" />
              </div>
              <div className="quick-action-text">Ver torneios</div>
              <svg style={{ marginTop: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Frase motivacional */}
        <div style={{
          background: 'linear-gradient(135deg, #111827 0%, rgba(37,99,235,0.08) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '20px',
          padding: 'clamp(18px, 4vw, 24px)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.4 }}>
              <span style={{ color: '#94A3B8', fontSize: '1.5em', lineHeight: 0 }}>"</span>{' '}
              Disciplina hoje, <span style={{ color: '#2563EB' }}>vitoria</span> amanha.{' '}
              <span style={{ color: '#94A3B8', fontSize: '1.5em', lineHeight: 0 }}>"</span>
            </div>
            <div style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', color: '#64748B', marginTop: 8 }}>
              Mantenha o foco e siga evoluindo!
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
