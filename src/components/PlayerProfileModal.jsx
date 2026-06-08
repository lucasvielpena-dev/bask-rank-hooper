import { useState, useEffect } from 'react';
import { supabase, denunciasAPI, votacaoAPI } from '../lib/supabase';

const fundamentos = [
  { key: 'arremesso', label: 'Arremesso' },
  { key: 'defesa', label: 'Defesa' },
  { key: 'passe', label: 'Passe' },
  { key: 'fisicalidade', label: 'Fisicalidade' },
  { key: 'mentalidade', label: 'Mentalidade' }
];

const labelsNota = ['', 'Muito Fraco', 'Fraco', 'Regular', 'Bom', 'Excelente'];

function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
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
            padding: '4px',
            transition: 'transform 0.1s',
            transform: (hover || value) >= i ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill={(hover || value) >= i ? '#F97316' : 'none'} stroke={(hover || value) >= i ? '#F97316' : 'var(--text-muted)'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function PlayerProfileModal({ jogador, rank, onClose }) {
  const [localJogador, setLocalJogador] = useState(jogador);
  const [profileData, setProfileData] = useState(null);
  const [communityStats, setCommunityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [perfilTab, setPerfilTab] = useState('sobre'); // 'sobre' | 'estatisticas' | 'historico'
  const [historicoJogos, setHistoricoJogos] = useState([]);
  
  // Denúncias
  const [showDenunciar, setShowDenunciar] = useState(false);
  const [tipoDenuncia, setTipoDenuncia] = useState('perfil_falso');
  const [descricao, setDescricao] = useState('');
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);
  const [toast, setToast] = useState(null);

  // Avaliação Direta
  const [minhaId, setMinhaId] = useState(null);
  const [showAvaliar, setShowAvaliar] = useState(false);
  const [estrelas, setEstrelas] = useState({ arremesso: 0, defesa: 0, passe: 0, fisicalidade: 0, mentalidade: 0 });
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [jaAvaliou, setJaAvaliou] = useState(false);

  useEffect(() => {
    loadPlayerDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogador?.id]);

  useEffect(() => {
    // Adiciona uma entrada no histórico para permitir fechar ao voltar no celular
    window.history.pushState({ modalOpen: 'profile' }, '');

    const handlePopState = (e) => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Limpa a entrada do histórico caso o modal seja fechado clicando no X
      if (window.history.state?.modalOpen === 'profile') {
        window.history.back();
      }
    };
  }, [onClose]);

  useEffect(() => {
    const channel = supabase
      .channel(`modal-realtime-${jogador.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jogadores', filter: `id=eq.${jogador.id}` },
        (payload) => {
          setLocalJogador(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jogador.id]);

  async function loadPlayerDetails() {
    setLoading(true);
    try {
      // 1. Obter informações de altura e idade do profile vinculado ao jogador
      const { data: prof } = await supabase
        .from('profiles')
        .select('altura, idade, id')
        .eq('player_id', jogador.id)
        .maybeSingle();

      if (prof) {
        setProfileData(prof);
      }

      // 2. Obter estatísticas de vitórias e derrotas
      const { data: myMatches } = await supabase
        .from('partida_jogadores')
        .select('time, partida:partidas(*)')
        .eq('jogador_id', jogador.id);
      
      let totalGames = 0;
      let wins = 0;
      let losses = 0;
      let winRate = 0;
      const historyList = [];
      
      if (myMatches) {
        const finishedMatches = myMatches.filter(m => m.partida?.status === 'finalizado');
        finishedMatches.forEach(m => {
          const p = m.partida;
          const myTeam = m.time;
          const scoreMyTeam = myTeam === 'A' ? p.placar_time_a : p.placar_time_b;
          const scoreOpponent = myTeam === 'A' ? p.placar_time_b : p.placar_time_a;
          const won = scoreMyTeam > scoreOpponent;
          
          if (won) {
            wins++;
          } else {
            losses++;
          }
          
          historyList.push({
            id: p.id,
            data: p.created_at,
            timeA: p.time_a,
            timeB: p.time_b,
            placarA: p.placar_time_a,
            placarB: p.placar_time_b,
            vencedor: won ? 'Ganhou' : 'Perdeu'
          });
        });
        
        totalGames = finishedMatches.length;
        winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        setHistoricoJogos(historyList);
      }

      // 3. Obter estatísticas acumuladas de partida (pontos, rebotes, assistências, roubos, tocos)
      const { data: myStats } = await supabase
        .from('estatisticas_partida')
        .select('pontos, rebotes, assistencias, tocos, roubos_bola')
        .eq('jogador_id', jogador.id);

      let totalPoints = 0;
      let totalRebounds = 0;
      let totalAssists = 0;
      let totalSteals = 0;
      let totalBlocks = 0;

      if (myStats) {
        myStats.forEach(s => {
          totalPoints += s.pontos || 0;
          totalRebounds += s.rebotes || 0;
          totalAssists += s.assistencias || 0;
          totalSteals += s.roubos_bola || 0;
          totalBlocks += s.tocos || 0;
        });
      }

      setCommunityStats({
        games: totalGames,
        wins,
        losses,
        winRate,
        points: totalPoints,
        rebounds: totalRebounds,
        assists: totalAssists,
        steals: totalSteals,
        blocks: totalBlocks
      });

      // 4. Obter dados de autenticação e avaliação existente
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        setMinhaId(user.id);
        const { data: av } = await supabase
          .from('avaliacoes')
          .select('*')
          .eq('avaliador_id', user.id)
          .eq('jogador_id', jogador.id)
          .maybeSingle();
        if (av) {
          setEstrelas({
            arremesso: av.arremesso,
            defesa: av.defesa,
            passe: av.passe,
            fisicalidade: av.fisicalidade,
            mentalidade: av.mentalidade
          });
          setJaAvaliou(true);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar detalhes do jogador:', e);
    }
    setLoading(false);
  }

  async function handleEnviarDenuncia(e) {
    e.preventDefault();
    if (!descricao.trim()) {
      showToast('Por favor, descreva o motivo da denúncia.', 'error');
      return;
    }

    setEnviandoDenuncia(true);
    const { error } = await denunciasAPI.criar({
      jogador_id: jogador.id,
      tipo: tipoDenuncia,
      descricao: descricao.trim()
    });

    if (error) {
      showToast(error.message || 'Erro ao registrar denúncia.', 'error');
    } else {
      showToast('✓ Denúncia enviada para análise!', 'success');
      setTimeout(() => {
        setShowDenunciar(false);
        setDescricao('');
      }, 1500);
    }
    setEnviandoDenuncia(false);
  }

  async function handleConfirmarAvaliacao() {
    const incompleto = fundamentos.some(f => !estrelas[f.key]);
    if (incompleto) {
      showToast('Selecione uma nota para todos os 5 fundamentos', 'error');
      return;
    }
    setEnviandoAvaliacao(true);
    const { data, error } = await votacaoAPI.votar(jogador.id, estrelas);
    if (error || !data?.sucesso) {
      showToast(data?.erro || error?.message || 'Erro ao registrar avaliação', 'error');
    } else {
      showToast(`✓ Avaliação registrada! Média: ★ ${Number(data.media_estrelas).toFixed(1)}`, 'success');
      setJaAvaliou(true);
      setShowAvaliar(false);
      const { data: updatedJ } = await supabase
        .from('jogadores')
        .select('*')
        .eq('id', jogador.id)
        .single();
      if (updatedJ) {
        setLocalJogador(updatedJ);
      }
    }
    setEnviandoAvaliacao(false);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const isMe = minhaId && (minhaId === localJogador.criado_por || (profileData && minhaId === profileData.id));

  // Cálculo das médias PPJ, REB, AST, STL, BLK
  const totalGamesNum = communityStats?.games || 0;
  const ppj = totalGamesNum > 0 ? (communityStats.points / totalGamesNum).toFixed(1) : '--';
  const reb = totalGamesNum > 0 ? (communityStats.rebounds / totalGamesNum).toFixed(1) : '--';
  const ast = totalGamesNum > 0 ? (communityStats.assists / totalGamesNum).toFixed(1) : '--';
  const stl = totalGamesNum > 0 ? (communityStats.steals / totalGamesNum).toFixed(1) : '--';
  const blk = totalGamesNum > 0 ? (communityStats.blocks / totalGamesNum).toFixed(1) : '--';

  const starsVal = localJogador.media_estrelas || 0;

  // Evolution index
  let evolutionIndex = 0;
  if (starsVal >= 4.5) {
    evolutionIndex = 3;
  } else if (starsVal >= 4.0) {
    evolutionIndex = 2;
  } else if (starsVal >= 3.0) {
    evolutionIndex = 1;
  }


  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-end', padding: 0 }}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: '24px 24px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
        <div className="modal-handle" />

        {loading ? (
          <div className="loading" style={{ padding: '40px 0' }}><div className="spinner" /> Carregando detalhes...</div>
        ) : showAvaliar ? (
          // Tela de Avaliação Direta
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h4 style={{ fontWeight: 700, fontSize: 16 }}>Avaliar Atleta</h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Dê uma nota de 1 a 5 estrelas para cada fundamento de <strong style={{ color: 'var(--text-primary)' }}>{localJogador.nome}</strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {fundamentos.map(f => {
                const val = estrelas[f.key] || 0;
                return (
                  <div key={f.key} style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{f.label}</span>
                      <span style={{ fontSize: 11, color: '#F97316', fontWeight: 600 }}>
                        {labelsNota[val]}
                      </span>
                    </div>
                    <StarPicker
                      value={val}
                      onChange={v => setEstrelas(p => ({ ...p, [f.key]: v }))}
                      disabled={enviandoAvaliacao}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowAvaliar(false)} 
                disabled={enviandoAvaliacao}
                style={{ flex: 1 }}
              >
                Voltar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleConfirmarAvaliacao} 
                disabled={enviandoAvaliacao || fundamentos.some(f => !estrelas[f.key])} 
                style={{ flex: 2, background: '#2563EB' }}
              >
                {enviandoAvaliacao ? 'Salvando...' : 'Salvar Avaliação'}
              </button>
            </div>
          </div>
        ) : (
          // Tela Principal de Perfil Estilo Mockup
          <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', overflowX: 'hidden', flex: 1 }}>
            
            {/* Header com Avatar e Dados */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px 16px 16px',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              flexShrink: 0,
              position: 'relative'
            }}>
              {/* Avatar circular */}
              {localJogador.foto_url ? (
                <div style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3px solid var(--accent-blue)',
                  boxShadow: '0 4px 20px rgba(37,99,235,0.25)',
                  marginBottom: 12,
                  flexShrink: 0
                }}>
                  <img 
                    src={localJogador.foto_url} 
                    alt={localJogador.nome} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(1.1) contrast(1.05)' }}
                  />
                </div>
              ) : (
                <div style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  fontWeight: 900,
                  color: '#fff',
                  boxShadow: '0 4px 20px rgba(37,99,235,0.25)',
                  marginBottom: 12,
                  flexShrink: 0
                }}>
                  {localJogador.nome?.charAt(0) || '?'}
                </div>
              )}

              {/* Nome - maior elemento */}
              <h3 style={{
                fontSize: 22,
                fontWeight: 900,
                color: 'var(--text-primary)',
                marginBottom: 4,
                textAlign: 'center',
                lineHeight: 1.2
              }}>
                {localJogador.nome}
              </h3>

              {/* Posição */}
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="m16 12-4-4-4 4"/>
                  <path d="M12 16V8"/>
                </svg>
                {localJogador.posicao || 'Ala'}
              </div>

              {/* Badge rating + Rank na mesma linha */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Rating badge */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(249, 115, 22, 0.12)',
                  color: '#F97316',
                  border: '1px solid rgba(249, 115, 22, 0.25)',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 800
                }}>
                  <span style={{ fontSize: 14 }}>{'\u2605'}</span>
                  {starsVal > 0 ? Number(starsVal).toFixed(1) : '--'}
                </span>

                {/* Rank badge */}
                {rank ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--accent-blue-dim)',
                    color: 'var(--accent-blue)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    borderRadius: 999,
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 800
                  }}>
                    #{rank} {localJogador.cidade}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Linha de Métricas (PPJ, REB, AST, STL, BLK) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 2,
              background: 'var(--bg-card)',
              padding: '14px 10px',
              borderRadius: '14px',
              border: '1px solid var(--border)',
              textAlign: 'center'
            }}>
              {[
                { label: 'PPJ', val: ppj },
                { label: 'REB', val: reb },
                { label: 'AST', val: ast },
                { label: 'STL', val: stl },
                { label: 'BLK', val: blk },
              ].map(item => (
                <div key={item.label} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>{item.val}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Linha de Evolução */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                LINHA DE EVOLUÇÃO
              </div>
              <div className="evolution-timeline" style={{ margin: '20px 0 8px' }}>
                <div className="evolution-progress-line" style={{ width: `${evolutionIndex * 33.3}%` }} />
                {[
                  { label: 'Rookie', val: 0 },
                  { label: 'Promessa', val: 1 },
                  { label: 'Elite', val: 2 },
                  { label: 'MVP', val: 3 },
                ].map(step => (
                  <div key={step.label} className={`evolution-step ${evolutionIndex >= step.val ? 'completed' : ''} ${evolutionIndex === step.val ? 'active' : ''}`}>
                    <div className="evolution-dot" style={{ width: '36px', height: '36px', fontSize: '12px' }}>
                      {step.val === 3 ? '★' : step.val + 1}
                    </div>
                    <div className="evolution-label" style={{ fontSize: '10px', marginTop: 6 }}>{step.label}</div>
                  </div>
                ))}
              </div>
            </div>


            {/* Tab Bar interna (SOBRE, ESTATÍSTICAS, HISTÓRICO) */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              borderRadius: '10px',
              padding: '3px',
              gap: 2
            }}>
              {[
                { key: 'sobre', label: 'SOBRE' },
                { key: 'estatisticas', label: 'ESTATÍSTICAS' },
                { key: 'historico', label: 'HISTÓRICO' }
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setPerfilTab(t.key)}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    borderRadius: '8px',
                    border: 'none',
                    background: perfilTab === t.key ? 'var(--bg-elevated)' : 'none',
                    color: perfilTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    minWidth: 0,
                    transition: 'all 0.2s'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Conteúdo das Tabs */}
            <div style={{ minHeight: '100px', paddingBottom: 8 }}>
              {perfilTab === 'sobre' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '13px' }}>
                  {[
                    { label: 'Cidade', val: `${localJogador.cidade} - ${localJogador.uf}` },
                    { label: 'Idade', val: profileData?.idade ? `${profileData.idade} anos` : '--' },
                    { label: 'Altura', val: profileData?.altura ? `${Number(profileData.altura).toFixed(2)} m` : '--' },
                    { label: 'Posição', val: localJogador.posicao || 'Ala' },
                    { label: 'Equipe', val: localJogador.equipe || `${localJogador.cidade} Hoops` },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.03)', gap: 16 }}>
                      <span style={{ color: 'var(--text-secondary)', flexShrink: 0, fontSize: '13px' }}>{item.label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', textAlign: 'right', wordBreak: 'break-word' }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              )}

              {perfilTab === 'estatisticas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {fundamentos.map(f => {
                    const mediaAspecto = localJogador[`media_${f.key}`] || 0;
                    const hasVotes = localJogador.total_votos >= 1;
                    return (
                      <div key={f.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 5 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
                          <span style={{ color: '#60A5FA', fontWeight: 700 }}>
                            {hasVotes ? `★ ${Number(mediaAspecto).toFixed(1)}` : '--'}
                          </span>
                        </div>
                        <div className="progress-bar" style={{ height: '6px', background: 'var(--bg-secondary)' }}>
                          <div 
                            className="progress-fill bar-grow-fill" 
                            style={{ width: hasVotes ? `${(mediaAspecto / 5) * 100}%` : '0%', background: '#2563EB' }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                  {localJogador.total_votos < 1 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                      Sem dados de avaliação ainda
                    </div>
                  )}
                </div>
              )}

              {perfilTab === 'historico' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historicoJogos.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                      Nenhuma partida finalizada
                    </div>
                  ) : (
                    historicoJogos.map(h => (
                      <div key={h.id} style={{
                        background: 'var(--bg-card)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {h.timeA} {h.placarA} x {h.placarB} {h.timeB}
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {new Date(h.data).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: h.vencedor === 'Ganhou' ? '#10B981' : '#EF4444',
                          background: h.vencedor === 'Ganhou' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {h.vencedor.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Botões fixos no rodapé do modal, FORA do scroll */}
          {!isMe && (
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              padding: '12px 0 4px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0
            }}>
              <button 
                type="button"
                onClick={() => setShowAvaliar(true)}
                style={{
                  flex: 2,
                  background: '#2563EB',
                  height: '44px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'inherit',
                  border: 'none',
                  color: '#FFFFFF'
                }}
              >
                {jaAvaliou ? 'Editar Voto' : 'Avaliar Atleta'}
              </button>
              <button 
                onClick={() => setShowDenunciar(true)}
                style={{
                  flex: 1,
                  color: '#EF4444',
                  border: '1px solid var(--border-danger)',
                  background: 'none',
                  height: '44px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'inherit'
                }}
              >
                Denunciar
              </button>
            </div>
          )}
          </>
        )}

        {/* Modal de Denúncias */}
        {showDenunciar && (
          <div className="modal-overlay" onClick={() => setShowDenunciar(false)} style={{ zIndex: 200, background: 'rgba(0,0,0,0.8)' }}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, marginBottom: 20 }}>
              <div className="modal-handle" />
              <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Denunciar Atleta</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>Nos ajude a manter a comunidade limpa e livre de fraudes.</p>

              <form onSubmit={handleEnviarDenuncia} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Motivo da Denúncia</label>
                  <select value={tipoDenuncia} onChange={e => setTipoDenuncia(e.target.value)}>
                    <option value="perfil_falso">Perfil Falso / Inexistente</option>
                    <option value="avaliacao_suspeita">Avaliação Suspeita / Manipulada</option>
                    <option value="comportamento_inadequado">Comportamento Inadequado</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição do Motivo *</label>
                  <textarea
                    required
                    rows="3"
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    placeholder="Descreva brevemente o motivo..."
                    style={{ resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDenunciar(false)} style={{ flex: 1 }} disabled={enviandoDenuncia}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2, background: '#ef4444' }} disabled={enviandoDenuncia}>
                    {enviandoDenuncia ? 'Enviando...' : 'Enviar Denúncia'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
