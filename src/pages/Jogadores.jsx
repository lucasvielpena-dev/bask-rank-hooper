import { useState, useEffect, memo } from 'react';
import { supabase, jogadoresAPI, votacaoAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { IconJogador, IconBuscar } from '../components/Icons';

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'avaliados', label: 'Mais Avaliados' },
  { key: 'votados', label: 'Mais Votados' },
  { key: 'elite', label: 'Elite' },
  { key: 'promessa', label: 'Promessa' },
  { key: 'mvp', label: 'MVP' }
];

const labelsNota = ['', 'Muito Fraco', 'Fraco', 'Regular', 'Bom', 'Excelente'];

function PlayerAvatar({ fotoUrl, nome, size = 44, border = 'none', hasCrown = false }) {
  const initial = nome ? nome.charAt(0).toUpperCase() : '?';
  
  const getGradientForName = (name) => {
    const colors = [
      ['var(--accent)', '#1d4ed8'],
      ['#f59e0b', '#d97706'],
      ['#10b981', '#047857'],
      ['#8b5cf6', '#6d28d9'],
      ['#ec4899', '#be185d'],
      ['#f43f5e', '#be123c'],
      ['#06b6d4', '#0891b2'],
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return `linear-gradient(135deg, ${colors[index][0]} 0%, ${colors[index][1]} 100%)`;
  };

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    border: border !== 'none' ? border : '1px solid var(--border)',
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.08)',
    flexShrink: 0
  };

  if (fotoUrl) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
        {hasCrown && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 18, zIndex: 5 }}>👑</div>}
        <img src={fotoUrl} alt={nome} style={avatarStyle} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      {hasCrown && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 18, zIndex: 5 }}>👑</div>}
      <div style={{
        ...avatarStyle,
        background: getGradientForName(nome),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: size * 0.44,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        {initial}
      </div>
    </div>
  );
}

const StarPicker = memo(function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '4px 0' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => !disabled && onChange(i)}
          onMouseEnter={() => !disabled && setHover(i)}
          onMouseLeave={() => !disabled && setHover(0)}
          disabled={disabled}
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            padding: '2px',
            transition: 'transform 0.1s',
            transform: (hover || value) >= i ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill={(hover || value) >= i ? 'var(--accent)' : 'none'} stroke={(hover || value) >= i ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
});

export default function Jogadores({ profile }) {
  const [jogadores, setJogadores] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const [selectedCity, setSelectedCity] = useState(profile?.cidade_atual || profile?.cidade || 'Altamira');

  const [ranks, setRanks] = useState({});
  const [mvpPlayerIds, setMvpPlayerIds] = useState(new Set());

  const fundamentos = [
    { key: 'arremesso', label: 'Arremesso' },
    { key: 'controle_de_bola', label: 'Controle de Bola' },
    { key: 'defesa', label: 'Defesa' },
    { key: 'visao_de_jogo', label: 'Visão de Jogo' },
    { key: 'explosao_fisica', label: 'Explosão Física' }
  ];

  const [votingPlayer, setVotingPlayer] = useState(null);
  const [estrelasVoto, setEstrelasVoto] = useState({ arremesso: 0, controle_de_bola: 0, defesa: 0, visao_de_jogo: 0, explosao_fisica: 0 });
  const [comentarioVoto, setComentarioVoto] = useState('');
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  const [votosStatus, setVotosStatus] = useState(null);

  const [toast, setToast] = useState(null);



  useEffect(() => {
    if (profile) {
      loadJogadores();
      const userCity = profile.cidade_atual || profile.cidade || 'Altamira';
      setSelectedCity(userCity);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('jogadores-global-realtime-unified')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jogadores' },
        () => {
          loadJogadores();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'avaliacoes' },
        () => {
          loadJogadores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  useEffect(() => {
    let result = [...jogadores];

    if (busca.trim() !== '') {
      result = result.filter(j =>
        j.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (j.apelido || '').toLowerCase().includes(busca.toLowerCase())
      );
    }

    if (selectedCity !== 'todos') {
      result = result.filter(j => j.cidade === selectedCity);
    }

    if (filtroAtivo === 'elite') {
      result = result.filter(j => j.media_estrelas >= 4.5 && j.total_votos >= 1);
    } else if (filtroAtivo === 'promessa') {
      result = result.filter(j => j.media_estrelas >= 3.5 && j.media_estrelas < 4.5 && j.total_votos >= 1);
    } else if (filtroAtivo === 'mvp') {
      result = result.filter(j => j.atual_campeao || mvpPlayerIds.has(j.id));
    }

    if (filtroAtivo === 'votados') {
      result.sort((a, b) => b.total_votos - a.total_votos || b.media_estrelas - a.media_estrelas);
    } else {
      result.sort((a, b) => b.media_estrelas - a.media_estrelas || b.total_votos - a.total_votos);
    }

    setFiltrados(result);
  }, [busca, jogadores, filtroAtivo, selectedCity, mvpPlayerIds]);

  async function loadJogadores() {
    setLoading(true);
    try {
      const stateUfVal = profile?.uf || 'PA';
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const [{ data: jogs }, { data: partidasData }, { data: votesStatus }, { data: minhasAvaliacoes }] = await Promise.all([
        jogadoresAPI.listarPorEstado(stateUfVal),
        supabase.from('partidas').select('mvp_id'),
        votacaoAPI.getStatusHoje(),
        userId
          ? supabase.from('avaliacoes').select('jogador_id').eq('avaliador_id', userId)
          : Promise.resolve({ data: [] })
      ]);

      const avaliadosSet = new Set((minhasAvaliacoes || []).map(a => a.jogador_id));

      const players = (jogs || []).map(j => ({
        ...j,
        ja_votou_hoje: avaliadosSet.has(j.id)
      }));
      
      setJogadores(players);
      setVotosStatus(votesStatus);



      const playerRanks = {};
      const playersByCity = {};
      players.forEach(j => {
        const cityKey = j.cidade || 'Altamira';
        if (!playersByCity[cityKey]) playersByCity[cityKey] = [];
        playersByCity[cityKey].push(j);
      });
      Object.keys(playersByCity).forEach(cityKey => {
        const sorted = [...playersByCity[cityKey]].sort((a, b) => b.media_estrelas - a.media_estrelas || b.total_votos - a.total_votos);
        sorted.forEach((j, index) => {
          playerRanks[j.id] = index + 1;
        });
      });
      setRanks(playerRanks);

      const mvps = new Set(partidasData?.map(p => p.mvp_id).filter(Boolean) || []);
      setMvpPlayerIds(mvps);

    } catch (e) {
      console.error('Erro ao carregar atletas:', e);
    }
    setLoading(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleOpenVote(player) {
    if (profile?.player_id === player.id) {
      showToast('Você não pode avaliar a si mesmo!', 'error');
      return;
    }

    if (votosStatus && votosStatus.restantes <= 0) {
      showToast('Você atingiu o limite de 20 avaliações por dia!', 'error');
      return;
    }

    setVotingPlayer(player);
    setEstrelasVoto({ arremesso: 0, controle_de_bola: 0, defesa: 0, visao_de_jogo: 0, explosao_fisica: 0 });
    setComentarioVoto('');
  }

  async function handleSubmitVote(e) {
    e.preventDefault();
    const faltando = fundamentos.some(f => !estrelasVoto[f.key]);
    if (faltando) {
      showToast('Selecione uma nota para todos os 5 fundamentos', 'error');
      return;
    }

    setEnviandoVoto(true);
    try {
      const { data, error } = await votacaoAPI.votar(votingPlayer.id, {
        ...estrelasVoto,
        comentario: comentarioVoto.trim() || null
      });

      if (error || !data?.sucesso) {
        showToast(data?.erro || error?.message || 'Erro ao registrar avaliação.', 'error');
      } else {
        showToast(`✓ Avaliação computada! Nova média: ★ ${Number(data.media_estrelas).toFixed(1)}`, 'success');
        setVotingPlayer(null);
        loadJogadores();
      }
    } catch (err) {
      showToast('Erro de conexão ao salvar avaliação.', 'error');
    } finally {
      setEnviandoVoto(false);
    }
  }

  return (
    <div className="page-content" style={{ position: 'relative' }}>
      <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(12px, 3vw, 20px) clamp(14px, 3vw, 20px) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(249,115,22,0.12)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconJogador size={20} color="var(--accent)" />
            </div>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 20, fontFamily:"'Oswald',sans-serif", textTransform:'uppercase', letterSpacing:'0.04em' }}>Jogadores</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{filtrados.length} atletas em {selectedCity} - {profile?.uf || 'PA'}</p>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <IconBuscar size={16} color="var(--text-muted)" />
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar jogador..."
            style={{ paddingLeft: 40, width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, scrollbarWidth: 'none', webkitOverflowScrolling: 'touch' }} className="hide-scrollbar">
          {FILTROS.map(f => {
            const active = filtroAtivo === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFiltroAtivo(f.key)}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  borderRadius: '30px',
                  border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  background: active ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="responsive-card-grid" style={{ paddingBottom: 20 }}>
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="skeleton" style={{ height: 120, borderRadius: '16px' }} />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3>Nenhum jogador encontrado</h3>
            <p>Selecione outro filtro ou altere sua busca por nome/apelido.</p>
          </div>
        ) : (
          <div className="responsive-card-grid" style={{ paddingBottom: 30 }}>
            {filtrados.map((j, i) => {
              const rankVal = ranks[j.id] || 0;
              const hasVoted = j.ja_votou_hoje;
              return (
                <div 
                  key={j.id} 
                  className="card card-enter" 
                  style={{ animationDelay: `${i * 25}ms`, padding: '16px 18px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <PlayerAvatar fotoUrl={j.foto_url} nome={j.nome} size={44} hasCrown={j.atual_campeao} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j.nome}
                        </span>
                        {j.apelido && <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>"{j.apelido}"</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        {rankVal > 0 && (
                          <>
                            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                              #{rankVal}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                          </>
                        )}
                        <span>{j.posicao || 'Ala'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span>{j.cidade} - {j.uf}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent)' }}>
                          {j.total_votos >= 1 ? Number(j.media_estrelas).toFixed(1) : 'S/N'}
                        </span>
                        <span style={{ color: 'var(--accent)', fontSize: '14px' }}>★</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {j.total_votos} {j.total_votos === 1 ? 'voto' : 'votos'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setSelectedPlayer({ ...j, rank: rankVal })} 
                      style={{ 
                        flex: 1, 
                        margin: 0, 
                        padding: '8px 14px',
                        border: '1px solid var(--border)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      Ver Perfil
                    </button>
                    <button 
                      className="btn btn-sm"
                      onClick={() => handleOpenVote(j)}
                      style={{ 
                        flex: 1, 
                        margin: 0, 
                        padding: '8px 14px',
                        background: hasVoted ? 'var(--bg-secondary)' : 'var(--accent)',
                        color: hasVoted ? 'var(--text-muted)' : '#ffffff',
                        border: hasVoted ? '1px solid var(--border)' : 'none',
                        fontWeight: 700
                      }}
                    >
                      {hasVoted ? '✓ Avaliado' : 'Avaliar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {votingPlayer && (
        <div className="modal-overlay" onClick={() => { if (!enviandoVoto) setVotingPlayer(null); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, fontSize: 18, marginBottom: 2, textAlign: 'center' }}>
              Avaliar {votingPlayer.apelido || votingPlayer.nome}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 14, textAlign: 'center' }}>
              Dê uma nota de 1 a 5 estrelas para cada habilidade:
            </p>

            <form onSubmit={handleSubmitVote} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fundamentos.map((f, i) => {
                const val = estrelasVoto[f.key] || 0;
                return (
                  <div key={f.key} style={{
                    background: val > 0 ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                    padding: '8px 12px', borderRadius: 10,
                    border: val > 0 ? '1.5px solid var(--border)' : '1px solid var(--border)',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 5,
                          background: val > 0 ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: val > 0 ? '#fff' : 'var(--text-muted)', fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: val > 0 ? 'none' : '1px solid var(--border)'
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{f.label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: val > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {val > 0 ? `★ ${val}.0` : labelsNota[val] || 'Nota'}
                      </span>
                    </div>
                    <StarPicker value={val} onChange={v => setEstrelasVoto(p => ({ ...p, [f.key]: v }))} disabled={enviandoVoto} />
                  </div>
                );
              })}

              <div style={{ marginTop: 2 }}>
                <input
                  type="text"
                  maxLength="200"
                  value={comentarioVoto}
                  onChange={e => setComentarioVoto(e.target.value)}
                  placeholder="Comentário (opcional)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  disabled={enviandoVoto}
                />
              </div>

              {votosStatus && (
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                  Avaliações hoje: <strong>{votosStatus.votos_hoje}/20</strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setVotingPlayer(null)} disabled={enviandoVoto} style={{ flex: 1, padding: '10px 0' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={enviandoVoto || fundamentos.some(f => !estrelasVoto[f.key])} style={{ flex: 2, padding: '10px 0' }}>
                  {enviandoVoto ? <div className="spinner" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <PlayerProfileModal
          jogador={selectedPlayer}
          onClose={() => { setSelectedPlayer(null); loadJogadores(); }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
