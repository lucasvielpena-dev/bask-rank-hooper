import { useState, useEffect } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import { nomeAtleta } from '../lib/nomes';
import { criarAtualizador, assinarAviso, TOPICO_RANKING } from '../lib/realtime';
import { lerCache, salvarCache } from '../lib/pageCache';
import { useEsporte } from '../contexts/EsporteContext';
import { IconSportDynamic } from '../components/Icons';
import PendenciasAvaliacao from '../components/PendenciasAvaliacao';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { labelConfianca, nivelConfianca, resumoAvaliacoes, sortByConfianca, scoreConfianca } from '../lib/ranking';

export default function Home({ profile, onNavigate }) {
  const { esporte, cfg } = useEsporte();
  const _cache = lerCache('home');
  const [topPlayers, setTopPlayers] = useState(_cache?.topPlayers || []);
  const [myPlayerInfo, setMyPlayerInfo] = useState(_cache?.myPlayerInfo || null);
  const [myRank, setMyRank] = useState(_cache?.myRank || '--');
  const [loading, setLoading] = useState(!_cache);
  // Perfil aberto direto da Home (Destaques da Semana): o modal aparece aqui
  // mesmo, sem trocar de aba, e ao fechar a Home continua no lugar.
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [heroTransform, setHeroTransform] = useState('rotateX(4deg) rotateY(-4deg) translateZ(0px)');
  const [heroShadow, setHeroShadow] = useState('0 16px 40px rgba(0,0,0,0.4)');

  const city = profile?.cidade_atual || profile?.cidade || '';
  const uf = profile?.uf || 'PA';

  useEffect(() => {
    if (profile) loadData(city, uf, !!lerCache('home'));
  }, [profile, city, uf, esporte]);

  useEffect(() => {
    if (!profile) return;
    // Aviso curto do banco ("ranking mudou") + consulta agrupada.
    // Nada roda com a aba em segundo plano.
    const atualizar = criarAtualizador(() => loadData(city, uf, true), { debounce: 2000, minimo: 10000 });
    const channel = assinarAviso(TOPICO_RANKING, atualizar);
    return () => { atualizar.parar(); supabase.removeChannel(channel); };
  }, [profile, city, uf, esporte]);

  async function loadData(cityVal = city, ufVal = uf, silencioso = false) {
    if (!silencioso) setLoading(true);
    try {
      const { data: rankList } = await rankingAPI.get(cityVal || null, ufVal || null, 50, esporte);
      if (rankList) {
        const norm = (v) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s*-\s*[a-z]{2}$/i, '');
        const cityN = norm(cityVal);
        let list = rankList;
        if (cityN) {
          const only = rankList.filter((j) => norm(j.cidade) === cityN);
          if (only.length) list = only;
        }
        const sorted = sortByConfianca(list);
        const top = sorted.slice(0, 5);
        setTopPlayers(top);

        let rank = myRank;
        let info = myPlayerInfo;
        if (profile?.player_id) {
          const myIndex = sorted.findIndex(j => j.id === profile.player_id);
          rank = myIndex !== -1 ? `#${myIndex + 1}` : '--';
          if (myIndex !== -1) {
            info = sorted[myIndex];
            setMyPlayerInfo(info);
          }
          setMyRank(rank);
        }
        salvarCache('home', { topPlayers: top, myRank: rank, myPlayerInfo: info });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const handleHeroMove = (e) => {
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate relative position (0 to 1)
    const posX = (clientX - rect.left) / rect.width;
    const posY = (clientY - rect.top) / rect.height;
    
    // rotateX = (0.5 - posY) * 16 -> max ±8deg
    // rotateY = (posX - 0.5) * 16 -> max ±8deg
    const rotateX = (0.5 - posY) * 16;
    const rotateY = (posX - 0.5) * 16;
    
    setHeroTransform(`rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0px)`);
    
    // box-shadow
    const offsetX = rotateY * -2;
    const offsetY = rotateX * 2;
    const blur = 40 + Math.abs(rotateX + rotateY) * 2;
    setHeroShadow(`${offsetX}px ${offsetY}px ${blur}px rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.3)`);
  };

  const handleHeroLeave = () => {
    setHeroTransform('rotateX(4deg) rotateY(-4deg) translateZ(0px)');
    setHeroShadow('0 20px 60px rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.3)');
  };

  const greetingName = profile?.apelido || profile?.nome_completo?.split(' ')[0] || 'Atleta';

  // Esqueleto só na PRIMEIRA carga. Depois disso o conteúdo antigo permanece na
  // tela enquanto o novo chega — assim nada "pisca" nem pula de lugar.
  const carregandoDestaques = loading && topPlayers.length === 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getPositionColor = (pos) => {
    return '#6A6A82';
  };

  return (
    <div className="page-content home-page" style={{ position: 'relative' }}>
      <div className="home-container" style={{ paddingBottom: 80, position: 'relative', zIndex: 1 }}>

        <div className="home-greeting" style={{ marginBottom: 12 }}>
          <div className="home-greeting-title" style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif", fontWeight: 400, textTransform: 'uppercase', letterSpacing: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {getGreeting()}, <span className="home-greeting-name" style={{ fontSize: 24, color: 'var(--accent-text)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 'bold', letterSpacing: '1px' }}>{greetingName}</span>
          </div>
          <div className="home-greeting-sub" style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            {cfg.divisionName} — {cfg.divisionSlogan}
          </div>
        </div>

        <div style={{ perspective: '1200px', marginBottom: 20 }}>
          <div 
            className="premium-card premium-card-border-green stagger-enter stagger-1" 
            onMouseMove={handleHeroMove}
            onMouseLeave={handleHeroLeave}
            style={{
              padding: '16px', 
              transform: heroTransform,
              boxShadow: heroShadow,
              transformStyle: 'preserve-3d',
              transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
              willChange: 'transform, box-shadow'
            }}
          >
          {/* Top badge */}
          <div className="premium-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', marginBottom: 12,
            transform: 'translateZ(20px)',
            transition: 'transform 0.4s ease'
          }}>
            <span className="hero-badge-text" style={{
              fontSize: 11, fontWeight: 700,
              fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {myRank !== '--' ? '👑 Melhor da Cidade' : 'Sem Posição'}
            </span>
          </div>

          {/* Main row: info + photo */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Rank + Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  fontSize: 32, fontWeight: 800, color: 'var(--accent-text)',
                  fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1,
                }}>
                  {myRank}
                </span>
              </div>
              <div className="hero-name" style={{
                fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
                fontFamily: "'Inter',sans-serif", lineHeight: 1.2, marginBottom: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {myPlayerInfo?.nome || greetingName}
              </div>
              <div className="hero-position" style={{
                fontSize: 12, color: getPositionColor(myPlayerInfo?.posicao), fontWeight: 600,
                fontFamily: "'Inter',sans-serif", marginBottom: 8,
              }}>
                {myPlayerInfo?.posicao || 'Atleta'}
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent-text)" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <span style={{
                    fontSize: 15, fontWeight: 800, color: 'var(--text-primary)',
                    fontFamily: "'Barlow Condensed',sans-serif",
                  }}>
                    {myPlayerInfo?.media_estrelas ? Number(myPlayerInfo.media_estrelas).toFixed(1) : '--'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconSportDynamic sport={esporte} size={13} color="var(--text-secondary)" />
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                    fontFamily: "'Inter',sans-serif",
                  }}>
                    {myPlayerInfo ? resumoAvaliacoes(myPlayerInfo, { compacto: true }) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Photo */}
            {myPlayerInfo?.foto_url ? (
              <img
                src={myPlayerInfo.foto_url}
                alt={greetingName}
                className="premium-photo"
                style={{
                  width: 'clamp(96px, 27vw, 112px)', height: 'clamp(96px, 27vw, 112px)',
                  borderRadius: 18, objectFit: 'cover',
                  border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
                }}
              />
            ) : (
              <div className="premium-photo" style={{
                width: 'clamp(96px, 27vw, 112px)', height: 'clamp(96px, 27vw, 112px)',
                borderRadius: 18, flexShrink: 0,
                background: 'var(--accent-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{
                  fontSize: 40, fontWeight: 800, color: 'var(--accent)',
                  fontFamily: "'Barlow Condensed',sans-serif",
                }}>
                  {greetingName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Location + Top % */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderTop: '1px solid var(--border)', paddingTop: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Inter',sans-serif" }}>
                {city} - {uf}
              </span>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
              fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Top {myRank !== '--' ? `${Math.max(1, Math.round((parseInt(myRank.replace('#','')) || 1) / (topPlayers.length || 1) * 100))}%` : '--'} da cidade
            </span>
          </div>

          {/* Button */}
          <button
            className="hero-btn btn-primary"
            onClick={() => onNavigate('atletas')}
            style={{
              width: '100%', height: 40, borderRadius: 12, marginTop: 10,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            Ver Ranking Completo
          </button>
        </div>
        </div>

        {/* Pendências de avaliação: cartão "Quem jogou com você" e o aviso da
            cidade. Os dois são opcionais e discretos — se não houver nada (ou
            se a consulta falhar), não aparece nada aqui. */}
        <PendenciasAvaliacao profile={profile} onNavigate={onNavigate} />

        <div className="home-highlights-section">
          <div className="home-highlights-header">
            <div className="home-section-label">Destaques da Semana</div>
            <button onClick={() => onNavigate('destaques')} className="home-section-link">
              Ver todos
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {carregandoDestaques
              ? [0, 1, 2, 3, 4].map((i) => (
                <div key={`destaque-skeleton-${i}`} className="premium-card" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14, minHeight: 64 }}>
                  <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ height: 13, width: '62%', borderRadius: 6 }} />
                    <div className="skeleton" style={{ height: 11, width: '38%', borderRadius: 6 }} />
                  </div>
                  <div className="skeleton" style={{ width: 54, height: 34, borderRadius: 8, flexShrink: 0 }} />
                </div>
              ))
              : topPlayers.map((player, i) => (
              <div
                key={player.id}
                className={i === 0 ? `premium-card premium-card-border-green stagger-enter stagger-${i + 2}` : `premium-card stagger-enter stagger-${i + 2}`}
                onClick={() => setSelectedPlayer({ ...player, rank: i + 1 })}
                style={{
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  minHeight: 64,
                  cursor: 'pointer',
                }}
              >
                {player.foto_url ? (
                  <img
                    src={player.foto_url}
                    alt={nomeAtleta(player)}
                    className="premium-photo"
                    style={{
                      width: 48, height: 48, borderRadius: 12, objectFit: 'cover',
                      border: '1px solid var(--accent-line)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div className="premium-photo" style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--accent-line)',
                  }}>
                    <span style={{
                      fontSize: 20, fontWeight: 800, color: 'var(--text-muted)',
                      fontFamily: "'Barlow Condensed',sans-serif",
                    }}>
                      {nomeAtleta(player) ? nomeAtleta(player).charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', marginRight: 2 }}>
                  <span className="premium-name" style={{
                    fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)',
                    fontFamily: "'Inter',sans-serif", lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'inline-block'
                  }}>
                    {nomeAtleta(player)}
                  </span>
                  <span style={{
                    fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500,
                    fontFamily: "'Inter',sans-serif", marginTop: 2,
                  }}>
                    {player.posicao || cfg.posicoes[0]}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: "'Barlow Condensed',sans-serif" }}>
                    <span>★</span>
                    <span>{Number(player.media_estrelas || 0).toFixed(1)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {resumoAvaliacoes(player, { compacto: true })} · {labelConfianca(player.nivel_confianca || nivelConfianca(player.total_votos))}
                  </div>
                  <div style={{ width: 80, height: 4, background: 'var(--bg-secondary)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(Number(player.media_estrelas || 0) / 5) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedPlayer && (
          <PlayerProfileModal
            jogador={selectedPlayer}
            rank={selectedPlayer.rank}
            onClose={() => {
              setSelectedPlayer(null);
              // Revalida em silêncio: se o atleta recebeu voto agora, a lista
              // da Home já volta atualizada.
              loadData(city, uf, true);
            }}
          />
        )}

      </div>
    </div>
  );
}
