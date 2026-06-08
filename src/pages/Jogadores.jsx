import { useState, useEffect } from 'react';
import { supabase, jogadoresAPI, votacaoAPI } from '../lib/supabase';
import PlayerProfileModal from '../components/PlayerProfileModal';

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
      ['#3b82f6', '#1d4ed8'],
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
    border: border,
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

function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '10px 0' }}>
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
            padding: '6px',
            transition: 'transform 0.1s',
            transform: (hover || value) >= i ? 'scale(1.22)' : 'scale(1)',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill={(hover || value) >= i ? 'var(--accent-gold)' : 'none'} stroke={(hover || value) >= i ? 'var(--accent-gold)' : 'var(--text-muted)'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function Jogadores({ profile }) {
  const [jogadores, setJogadores] = useState([]);
  const [filtrados, setFiltrados] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Filtros geográficos
  const [selectedCity, setSelectedCity] = useState(profile?.cidade_atual || profile?.cidade || 'Altamira');

  // Ranks e MVPs
  const [ranks, setRanks] = useState({});
  const [mvpPlayerIds, setMvpPlayerIds] = useState(new Set());

  // Voto rápido modal
  const [votingPlayer, setVotingPlayer] = useState(null);
  const [notaVoto, setNotaVoto] = useState(0);
  const [comentarioVoto, setComentarioVoto] = useState('');
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  const [votosStatus, setVotosStatus] = useState(null);

  // Toast feedback
  const [toast, setToast] = useState(null);



  useEffect(() => {
    if (profile) {
      loadJogadores();
      const userCity = profile.cidade_atual || profile.cidade || 'Altamira';
      setSelectedCity(userCity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Aplicar busca e filtros combinados
  useEffect(() => {
    let result = [...jogadores];

    // 1. Filtrar por termo de busca
    if (busca.trim() !== '') {
      result = result.filter(j =>
        j.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (j.apelido || '').toLowerCase().includes(busca.toLowerCase())
      );
    }

    // 1.5. Filtrar por município selecionado
    if (selectedCity !== 'todos') {
      result = result.filter(j => j.cidade === selectedCity);
    }

    // 2. Filtrar por categoria ativa
    if (filtroAtivo === 'elite') {
      result = result.filter(j => j.media_estrelas >= 4.5 && j.total_votos >= 1);
    } else if (filtroAtivo === 'promessa') {
      result = result.filter(j => j.media_estrelas >= 3.5 && j.media_estrelas < 4.5 && j.total_votos >= 1);
    } else if (filtroAtivo === 'mvp') {
      result = result.filter(j => j.atual_campeao || mvpPlayerIds.has(j.id));
    }

    // 3. Aplicar ordenação baseada no filtro selecionado
    if (filtroAtivo === 'votados') {
      result.sort((a, b) => b.total_votos - a.total_votos || b.media_estrelas - a.media_estrelas);
    } else {
      // Filtros 'todos', 'avaliados', 'elite', 'promessa', 'mvp' ordenam por média de estrelas
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
        // Buscar avaliações já feitas pelo usuário logado para marcar como "já avaliado"
        userId
          ? supabase.from('avaliacoes').select('jogador_id').eq('avaliador_id', userId)
          : Promise.resolve({ data: [] })
      ]);

      // Criar Set de jogadores já avaliados pelo usuário
      const avaliadosSet = new Set((minhasAvaliacoes || []).map(a => a.jogador_id));

      // Marcar ja_votou_hoje em cada jogador
      const players = (jogs || []).map(j => ({
        ...j,
        ja_votou_hoje: avaliadosSet.has(j.id)
      }));
      
      setJogadores(players);
      setVotosStatus(votesStatus);



      // Calcular Ranks locais para os jogadores de cada cidade
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

      // Mapear MVPs da cidade
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
    // 1. Impedir votar em si mesmo
    if (profile?.player_id === player.id) {
      showToast('Você não pode avaliar a si mesmo!', 'error');
      return;
    }

    // 2. Verificar limite diário de votos
    if (votosStatus && votosStatus.restantes <= 0) {
      showToast('Você atingiu o limite de 20 avaliações por dia!', 'error');
      return;
    }

    setVotingPlayer(player);
    setNotaVoto(0);
    setComentarioVoto('');
  }

  async function handleSubmitVote(e) {
    e.preventDefault();
    if (notaVoto < 1 || notaVoto > 5) {
      showToast('Por favor, escolha uma nota de 1 a 5 estrelas.', 'error');
      return;
    }

    setEnviandoVoto(true);
    try {
      // Executa a avaliação rápida atribuindo a mesma nota aos 5 fundamentos
      const { data, error } = await votacaoAPI.votar(votingPlayer.id, {
        arremesso: notaVoto,
        defesa: notaVoto,
        passe: notaVoto,
        fisicalidade: notaVoto,
        mentalidade: notaVoto,
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
    <div className="page-content">
      <div style={{ padding: 'clamp(12px, 3vw, 20px) clamp(14px, 3vw, 20px) 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue-light)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 20 }}>Jogadores</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{filtrados.length} atletas em {selectedCity} - {profile?.uf || 'PA'}</p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar jogador..."
            style={{ paddingLeft: 40, width: '100%' }}
          />
        </div>

        {/* Filtros Pílulas Deslizantes */}
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
                  border: active ? '1.5px solid var(--accent-blue)' : '1.5px solid var(--border)',
                  background: active ? 'var(--accent-blue-dim)' : 'var(--bg-card)',
                  color: active ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
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

        {/* Lista de Jogadores */}
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
                  {/* Informações Principais */}
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

                    {/* Média de Estrelas */}
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent-gold)' }}>
                          {j.total_votos >= 1 ? Number(j.media_estrelas).toFixed(1) : 'S/N'}
                        </span>
                        <span style={{ color: 'var(--accent-gold)', fontSize: '14px' }}>★</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {j.total_votos} {j.total_votos === 1 ? 'voto' : 'votos'}
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação Rápida */}
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
                        background: hasVoted ? 'rgba(255, 255, 255, 0.05)' : '#2563EB',
                        color: hasVoted ? 'var(--text-muted)' : '#ffffff',
                        border: hasVoted ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
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

      {/* MODAL SHEET: AVALIAÇÃO RÁPIDA */}
      {votingPlayer && (
        <div className="modal-overlay" onClick={() => { if (!enviandoVoto) setVotingPlayer(null); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, fontSize: 20, marginBottom: 4, textAlign: 'center' }}>
              Avaliar {votingPlayer.nome}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              Selecione uma nota de 1 a 5 estrelas e adicione um comentário opcional.
            </p>

            <form onSubmit={handleSubmitVote} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Star Picker */}
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Qual sua nota? *</span>
                  <span style={{ fontSize: 12, color: 'var(--accent-gold)', fontWeight: 700 }}>
                    {labelsNota[notaVoto]}
                  </span>
                </div>
                <StarPicker value={notaVoto} onChange={setNotaVoto} disabled={enviandoVoto} />
              </div>

              {/* Comentário Opcional */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Comentário (opcional)
                </label>
                <textarea
                  rows="3"
                  maxLength="200"
                  value={comentarioVoto}
                  onChange={e => setComentarioVoto(e.target.value)}
                  placeholder="Ex: Joga muito coletivo, excelente arremesso..."
                  style={{ resize: 'none' }}
                  disabled={enviandoVoto}
                />
              </div>

              {/* Status de Votos Diários */}
              {votosStatus && (
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                  Você já avaliou <strong>{votosStatus.votos_hoje}/20</strong> jogadores hoje.
                </div>
              )}

              {/* Botões do Modal */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setVotingPlayer(null)} 
                  disabled={enviandoVoto}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={enviandoVoto || notaVoto < 1}
                  style={{ flex: 2 }}
                >
                  {enviandoVoto ? <div className="spinner" /> : 'Confirmar Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SHEET: DETALHES DO JOGADOR */}
      {selectedPlayer && (
        <PlayerProfileModal
          jogador={selectedPlayer}
          onClose={() => { setSelectedPlayer(null); loadJogadores(); }}
        />
      )}

      {/* Toast Feedback */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
