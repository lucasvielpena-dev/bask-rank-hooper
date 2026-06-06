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
          <svg width="28" height="28" viewBox="0 0 24 24" fill={(hover || value) >= i ? 'var(--accent-gold)' : 'none'} stroke={(hover || value) >= i ? 'var(--accent-gold)' : 'var(--text-muted)'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function PlayerProfileModal({ jogador, onClose }) {
  const [localJogador, setLocalJogador] = useState(jogador);
  const [profileData, setProfileData] = useState(null);
  const [communityStats, setCommunityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
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
      
      if (myMatches) {
        const finishedMatches = myMatches.filter(m => m.partida?.status === 'finalizado');
        let wins = 0;
        let losses = 0;
        
        finishedMatches.forEach(m => {
          const p = m.partida;
          const myTeam = m.time;
          const scoreMyTeam = myTeam === 'A' ? p.placar_time_a : p.placar_time_b;
          const scoreOpponent = myTeam === 'A' ? p.placar_time_b : p.placar_time_a;
          
          if (scoreMyTeam > scoreOpponent) {
            wins++;
          } else if (scoreMyTeam < scoreOpponent) {
            losses++;
          }
        });
        
        const totalGames = finishedMatches.length;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        setCommunityStats({ games: totalGames, wins, losses, winRate });
      }

      // 3. Obter dados de autenticação e avaliação existente
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

  const getInitial = (nome) => nome ? nome.charAt(0).toUpperCase() : '?';

  const isMe = minhaId && (minhaId === localJogador.criado_por || (profileData && minhaId === profileData.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-handle" />
        
        {/* Profile Card Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
          <div className="avatar avatar-lg" style={{ marginBottom: 12 }}>
            {getInitial(localJogador.nome)}
          </div>
          <h3 style={{ fontWeight: 800, fontSize: 22, color: 'var(--text-primary)' }}>
            {localJogador.nome}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
            {localJogador.apelido ? `"${localJogador.apelido}"` : ''} {localJogador.posicao ? `· ${localJogador.posicao}` : ''}
          </p>
          <div className="badge" style={{ marginTop: 8 }}>
            <span>📍</span> {localJogador.cidade} • {localJogador.uf}
          </div>
        </div>

        {loading ? (
          <div className="loading" style={{ padding: '20px 0' }}><div className="spinner" /> Carregando detalhes...</div>
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
                      <span style={{ fontSize: 11, color: 'var(--accent-gold)', fontWeight: 600 }}>
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
                style={{ flex: 2 }}
              >
                {enviandoAvaliacao ? 'Salvando...' : 'Salvar Avaliação'}
              </button>
            </div>
          </div>
        ) : (
          // Tela Principal de Detalhes
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Informações Físicas */}
            {profileData && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="card" style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-elevated)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>ALTURA</div>
                  <div style={{ fontWeight: 800, color: 'var(--accent-blue-light)', fontSize: 15 }}>
                    {profileData.altura ? `${Number(profileData.altura).toFixed(2)}m` : '--'}
                  </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-elevated)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>IDADE</div>
                  <div style={{ fontWeight: 800, color: 'var(--accent-gold)', fontSize: 15 }}>
                    {profileData.idade ? `${profileData.idade} anos` : '--'}
                  </div>
                </div>
              </div>
            )}

            {/* Avaliação Geral */}
            <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>MEDIA DO ATLETA</span>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 800, fontSize: 18 }}>
                  ★ {localJogador.total_votos >= 1 ? Number(localJogador.media_estrelas).toFixed(1) : 'S/N'}
                </span>
              </div>
              
              {/* Aspectos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fundamentos.map(f => {
                  const mediaAspecto = localJogador[`media_${f.key}`] || 0;
                  return (
                    <div key={f.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
                        <span style={{ color: 'var(--accent-blue-light)', fontWeight: 700 }}>
                          {localJogador.total_votos >= 1 ? `★ ${Number(mediaAspecto).toFixed(1)}` : '--'}
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 6 }}>
                        <div 
                          className="progress-fill blue bar-grow-fill" 
                          style={{ width: localJogador.total_votos >= 1 ? `${(mediaAspecto / 5) * 100}%` : '0%' }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {localJogador.total_votos < 1 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
                  * Avaliações detalhadas ocultas até atingir 1 voto (Atual: {localJogador.total_votos}/1)
                </div>
              )}
            </div>

            {/* Aproveitamento Comunidade */}
            {communityStats && communityStats.games > 0 && (
              <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue-light)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue-light)', letterSpacing: '0.05em' }}>JOGOS DA NOITE</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>VITÓRIAS - DERROTAS</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{communityStats.wins}V - {communityStats.losses}D</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>WIN RATE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{communityStats.winRate}%</div>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill bar-grow-fill" style={{ width: `${communityStats.winRate}%`, background: '#22c55e' }} />
                </div>
              </div>
            )}

            {/* Botoes de Acao */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {!isMe && (
                <button 
                  type="button"
                  className="btn btn-primary" 
                  onClick={() => setShowAvaliar(true)}
                  style={{ flex: 1 }}
                >
                  {jaAvaliou ? '⚙️ Editar Voto' : '⭐ Avaliar Atleta'}
                </button>
              )}
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowDenunciar(true)}
                style={{ flex: 1, color: 'var(--text-danger)', borderColor: 'var(--border-danger)' }}
              >
                ⚠️ Denunciar
              </button>
            </div>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 2 }}>
              Fechar
            </button>
          </div>
        )}

        {/* Modal interno para envio de denúncia */}
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
