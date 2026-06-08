import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, rankingAPI } from '../lib/supabase';
import { IconCrescimento, IconTrofeu, IconCalendario, IconAvaliar, IconBasquete, IconRanking } from '../components/Icons';

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
      <path d="M60 60 Q60 90 80 110" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
      <path d="M140 60 Q140 90 120 110" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
      <path d="M70 60 Q75 85 90 105" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
      <path d="M130 60 Q125 85 110 105" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
      <circle cx="90" cy="30" r="20" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function HighlightChartSVG() {
  return (
    <svg viewBox="0 0 120 80" fill="none" style={{ position: 'absolute', right: 10, bottom: 10, width: 100, opacity: 0.25, pointerEvents: 'none' }}>
      <polyline points="10,65 30,50 50,55 70,30 90,35 110,15" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="110" cy="15" r="3" fill="#2563EB" />
    </svg>
  );
}

function HighlightTrophySVG() {
  return (
    <svg viewBox="0 0 100 100" fill="none" style={{ position: 'absolute', right: 10, bottom: 5, width: 80, opacity: 0.12, pointerEvents: 'none' }}>
      <path d="M35 25h30v25a15 15 0 0 1-30 0V25z" stroke="#F97316" strokeWidth="2" fill="none" />
      <path d="M35 30H25a10 10 0 0 0 0 10h10" stroke="#F97316" strokeWidth="1.5" fill="none" />
      <path d="M65 30h10a10 10 0 0 1 0 10H65" stroke="#F97316" strokeWidth="1.5" fill="none" />
      <line x1="50" y1="55" x2="50" y2="70" stroke="#F97316" strokeWidth="2" />
      <rect x="38" y="70" width="24" height="4" rx="2" fill="#F97316" opacity="0.5" />
    </svg>
  );
}

function HighlightCalendarSVG() {
  return (
    <svg viewBox="0 0 100 100" fill="none" style={{ position: 'absolute', right: 10, bottom: 5, width: 75, opacity: 0.12, pointerEvents: 'none' }}>
      <rect x="15" y="20" width="70" height="60" rx="8" stroke="#2563EB" strokeWidth="2" fill="none" />
      <line x1="15" y1="40" x2="85" y2="40" stroke="#2563EB" strokeWidth="1.5" />
      <line x1="30" y1="15" x2="30" y2="30" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      <line x1="70" y1="15" x2="70" y2="30" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      <circle cx="38" cy="55" r="3" fill="#2563EB" opacity="0.5" />
      <circle cx="50" cy="55" r="3" fill="#2563EB" opacity="0.5" />
      <circle cx="62" cy="55" r="3" fill="#2563EB" opacity="0.5" />
      <circle cx="38" cy="68" r="3" fill="#2563EB" opacity="0.3" />
      <circle cx="50" cy="68" r="3" fill="#2563EB" opacity="0.3" />
    </svg>
  );
}

const ChevronArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

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

  const statsData = [
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, value: stats.jogadores, label: 'Jogadores' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, value: stats.mediaGeral.toFixed(1), label: 'Media geral' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/></svg>, value: stats.avaliacoes, label: 'Avaliacoes' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>, value: stats.torneios, label: 'Torneios' }
  ];

  return (
    <div className="page-content home-page">
      <div className="home-container">

        {/* Saudacao */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
            {getGreeting()}, <span style={{ color: '#2563EB' }}>{greetingName}</span> {'\u{1F44B}'}
          </div>
          <div style={{ color: '#94A3B8', fontSize: 'clamp(12px, 3vw, 14px)', marginTop: 4 }}>
            Voce esta entre os melhores jogadores de {city}.
          </div>
        </div>

        {/* Row: Posicao + Estatisticas lado a lado */}
        <div className="home-top-row">

          {/* Card Posicao */}
          <div style={{
            background: 'linear-gradient(135deg, #111827 0%, rgba(37,99,235,0.12) 100%)',
            border: '1px solid rgba(37,99,235,0.2)',
            borderRadius: '20px',
            padding: 'clamp(20px, 4vw, 28px)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            flex: 1,
            minWidth: 0
          }}>
            <BasketballHoopSVG />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: 'clamp(10px, 2vw, 12px)', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                SUA POSICAO
              </div>
              <div style={{ fontSize: 'clamp(52px, 14vw, 76px)', fontWeight: 900, color: '#F97316', lineHeight: 1, marginBottom: 6, letterSpacing: '-0.02em' }}>
                {myRank}
              </div>
              <div style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', color: '#94A3B8', marginBottom: 14 }}>
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
                fontSize: 'clamp(9px, 2vw, 11px)',
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

          {/* Card Estatisticas */}
          <div style={{
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px',
            padding: 'clamp(16px, 3vw, 22px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 'clamp(10px, 2vw, 12px)', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                ESTATISTICAS GERAIS
              </div>
              <button style={{ background: 'none', border: 0, color: '#2563EB', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>
                Ver todas
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, flex: 1 }}>
              {statsData.map((item, i) => (
                <div key={item.label} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: i % 2 === 0 ? 'rgba(37,99,235,0.1)' : 'rgba(249,115,22,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 800, color: '#FFFFFF' }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: '#64748B', fontWeight: 600, textAlign: 'center' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Destaques */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              DESTAQUES
            </div>
            <button style={{ background: 'none', border: 0, color: '#2563EB', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>
              Ver tudo
            </button>
          </div>

          <div className="destaques-row">
            {/* Evolucao semanal */}
            <div style={{
              background: 'linear-gradient(135deg, #111827 0%, rgba(37,99,235,0.06) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: 'clamp(14px, 3vw, 18px)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: 120
            }}>
              <HighlightChartSVG />
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconCrescimento size={20} color="#2563EB" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>Evolucao semanal</div>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 1.4 }}>
                  Voce subiu <span style={{ color: '#FFFFFF', fontWeight: 700 }}>3 posicoes</span> esta semana
                </div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(37,99,235,0.12)',
                  color: '#60A5FA',
                  border: '1px solid rgba(37,99,235,0.2)',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: 700
                }}>
                  +3 posicoes
                </span>
              </div>
            </div>

            {/* MVP da semana */}
            <div style={{
              background: 'linear-gradient(135deg, #111827 0%, rgba(249,115,22,0.06) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: 'clamp(14px, 3vw, 18px)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: 120
            }}>
              <HighlightTrophySVG />
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconTrofeu size={20} color="#F97316" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>MVP da semana</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F97316', marginBottom: 4 }}>
                  {lider ? lider.nome.split(' ')[0] + ' ' + (lider.nome.split(' ')[1] || '') : 'Lara Fabia'}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
                  {(lider?.media_estrelas || 5.0).toFixed(1)} estrelas
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ color: s <= Math.round(lider?.media_estrelas || 5) ? '#F97316' : '#64748B', fontSize: 14 }}>{'\u2605'}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Torneio municipal */}
            <div style={{
              background: 'linear-gradient(135deg, #111827 0%, rgba(37,99,235,0.06) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: 'clamp(14px, 3vw, 18px)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: 120
            }}>
              <HighlightCalendarSVG />
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconCalendario size={20} color="#2563EB" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>Torneio municipal</div>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 1.4 }}>
                  Inscricoes abertas para novas equipes
                </div>
                <button style={{
                  background: 'rgba(37,99,235,0.12)',
                  color: '#60A5FA',
                  border: '1px solid rgba(37,99,235,0.2)',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>
                  Inscreva-se
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Acoes Rapidas */}
        <div>
          <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
            ACOES RAPIDAS
          </div>

          <div className="acoes-rapidas-grid">
            {[
              { icon: <IconAvaliar size={24} color="#fff" />, label: 'Avaliar jogador', action: () => onNavigate('jogadores'), primary: true, iconBg: 'rgba(255,255,255,0.16)' },
              { icon: <IconBasquete size={24} color="#F97316" />, label: 'Meus jogos', action: () => onNavigate('jogos'), primary: false, iconBg: 'rgba(249,115,22,0.1)' },
              { icon: <IconRanking size={24} color="#2563EB" />, label: 'Ver ranking', action: () => onNavigate('ranking'), primary: false, iconBg: 'rgba(37,99,235,0.1)' },
              { icon: <IconTrofeu size={24} color="#F97316" />, label: 'Ver torneios', action: () => onNavigate('jogos', { aba: 'torneios' }), primary: false, iconBg: 'rgba(249,115,22,0.1)' }
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  background: item.primary ? 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)' : '#111827',
                  border: item.primary ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px',
                  padding: 'clamp(12px, 3vw, 16px)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 12,
                  minHeight: 90,
                  textAlign: 'left',
                  boxShadow: item.primary ? '0 4px 16px rgba(37,99,235,0.3)' : '0 4px 16px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: item.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {item.icon}
                  </div>
                  <ChevronArrow />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                  {item.label}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
