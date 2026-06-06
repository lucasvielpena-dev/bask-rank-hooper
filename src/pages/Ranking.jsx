import { useState, useEffect } from 'react';
import { supabase, rankingAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

function renderBadge(media) {
  if (media >= 4.5) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🏆 Elite</span>;
  if (media >= 4.0) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>⭐ Destaque</span>;
  if (media >= 3.5) return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>📈 Promessa</span>;
  return <span style={{ marginLeft: 6, padding: '2px 6px', background: 'rgba(148,163,184,0.15)', color: '#94a3b8', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🔄 Em Des.</span>;
}

export default function Ranking({ profile }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';

  useEffect(() => {
    loadRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.cidade_atual, profile?.cidade]);

  useEffect(() => {
    const channel = supabase
      .channel('ranking-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadRanking();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);


  async function loadRanking() {
    setLoading(true);
    const { data } = await rankingAPI.get(city, 50);
    setRanking(data || []);
    setLoading(false);
  }

  const getInitial = (nome) => nome ? nome.charAt(0).toUpperCase() : '?';

  const top3 = ranking.slice(0, 3);

  if (loading) return (
    <div className="page-content">
      <div className="loading"><div className="spinner" /><span>Carregando ranking...</span></div>
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ padding: '20px 20px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>🏀 Ranking de {city}</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{ranking.length} jogadores classificados</p>
          </div>
        </div>

        {ranking.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            <h3>Nenhum jogador classificado</h3>
            <p>Vá em "Avaliar Jogadores" para começar a pontuar!</p>
            <small style={{ color: '#475569', fontSize: 12, marginTop: 10 }}>Mínimo de 10 avaliações por jogador para aparecer no ranking</small>
          </div>
        ) : (
          <>
            {/* Pódio */}
            {top3.length >= 1 && (
              <div style={{ position: 'relative', marginBottom: 24 }}>
                {/* Pódio visual */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 0 }}>

                  {/* 2º lugar - esquerda */}
                  {top3[1] && (
                    <div onClick={() => setSelectedPlayer(top3[1])} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer' }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#94a3b8', marginBottom: 4 }}>
                        {getInitial(top3[1].nome)}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, textAlign: 'center' }}>{top3[1].nome.split(' ')[0]}</div>
                      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>★ {Number(top3[1].media_estrelas).toFixed(1)}</div>
                      <div style={{ marginTop: 2 }}>{renderBadge(top3[1].media_estrelas)}</div>
                      <div style={{ height: 56, width: '100%', background: 'var(--bg-secondary)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--text-muted)' }}>2</span>
                      </div>
                    </div>
                  )}

                  {/* 1º lugar - centro */}
                  {top3[0] && (
                    <div onClick={() => setSelectedPlayer(top3[0])} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer' }}>
                      <div style={{ fontSize: 20, marginBottom: 2 }}>👑</div>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elevated)', border: '3px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, color: '#f59e0b', marginBottom: 4 }}>
                        {getInitial(top3[0].nome)}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, textAlign: 'center' }}>{top3[0].nome.split(' ')[0]}</div>
                      <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>★ {Number(top3[0].media_estrelas).toFixed(1)}</div>
                      <div style={{ marginTop: 2 }}>{renderBadge(top3[0].media_estrelas)}</div>
                      <div style={{ height: 80, width: '100%', background: 'var(--bg-card-hover)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                        <span style={{ fontWeight: 900, fontSize: 26, color: '#cd7c2f' }}>1</span>
                      </div>
                    </div>
                  )}

                  {/* 3º lugar - direita */}
                  {top3[2] && (
                    <div onClick={() => setSelectedPlayer(top3[2])} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer' }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid #cd7c2f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#cd7c2f', marginBottom: 4 }}>
                        {getInitial(top3[2].nome)}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, textAlign: 'center' }}>{top3[2].nome.split(' ')[0]}</div>
                      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>★ {Number(top3[2].media_estrelas).toFixed(1)}</div>
                      <div style={{ marginTop: 2 }}>{renderBadge(top3[2].media_estrelas)}</div>
                      <div style={{ height: 40, width: '100%', background: 'var(--bg-secondary)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--text-muted)' }}>3</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Meu destaque (1º lugar em resumo) */}
            {top3[0] && (
              <div className="card" onClick={() => setSelectedPlayer(top3[0])} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🥇</div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#f59e0b', fontSize: 18 }}>{getInitial(top3[0].nome)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    {top3[0].nome}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{top3[0].total_votos} avaliações</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>★ {Number(top3[0].media_estrelas).toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>MÉDIA</div>
                </div>
              </div>
            )}

            {/* Lista completa */}
            {ranking.length > 0 && (
              <div>
                <div className="section-title" style={{ marginBottom: 10, paddingTop: 4 }}>
                  Classificação Geral
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {ranking.map((j, i) => (
                    <div key={j.id} className="card" onClick={() => setSelectedPlayer(j)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}>
                      <div style={{ width: 28, textAlign: 'center', fontWeight: 800, fontSize: 15, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c2f' : '#64748b' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                      </div>
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 15 }}>{getInitial(j.nome)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>{j.nome}</span>
                          {j.atual_campeao && <span style={{ fontSize: 12, color: '#f59e0b' }}>👑</span>}
                          {renderBadge(j.media_estrelas)}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{j.total_votos} avaliações</div>
                      </div>
                      <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 14 }}>
                        ★ {Number(j.media_estrelas).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedPlayer && (
        <PlayerProfileModal
          jogador={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
