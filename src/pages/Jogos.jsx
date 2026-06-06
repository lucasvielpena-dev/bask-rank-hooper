import { useState, useEffect } from 'react';
import { partidasAPI, jogadoresAPI } from '../lib/supabase';

export default function Jogos() {
  const [tela, setTela] = useState('lista'); // 'lista' | 'novo' | 'partida'
  const [aba, setAba] = useState('jogos'); // 'jogos' | 'historico'
  
  // Lista de partidas e jogadores para seleção
  const [partidas, setPartidas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [jogadores, setJogadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  // States para criação de partida (Wizard)
  const [timeANome, setTimeANome] = useState('Time A');
  const [timeBNome, setTimeBNome] = useState('Time B');
  const [timeAJogadores, setTimeAJogadores] = useState([]); // Array de IDs
  const [timeBJogadores, setTimeBJogadores] = useState([]); // Array de IDs

  // States da Partida Ativa
  const [partidaAtiva, setPartidaAtiva] = useState(null);
  const [placarA, setPlacarA] = useState(0);
  const [placarB, setPlacarB] = useState(0);
  const [tempo, setTempo] = useState(0); // em segundos
  const [timerAtivo, setTimerAtivo] = useState(false);
  const [periodo, setPeriodo] = useState(1);
  const [periodosScores, setPeriodosScores] = useState([]); // Histórico de pontuações de cada período [{periodo, a, b}]

  // MVP e encerramento
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [mvpId, setMvpId] = useState('');

  // Feedbacks flutuantes da partida ao vivo
  const [feedbacksA, setFeedbacksA] = useState([]);
  const [feedbacksB, setFeedbacksB] = useState([]);

  function triggerFeedback(time, valor) {
    if (valor === 0) return;
    const text = valor > 0 ? `+${valor}` : `${valor}`;
    const id = Math.random().toString(36).substring(2, 9);
    const color = valor > 0 ? 'var(--accent-gold)' : '#f87171';
    const newFeedback = { id, text, color };
    if (time === 'A') {
      setFeedbacksA(prev => [...prev, newFeedback]);
      setTimeout(() => {
        setFeedbacksA(prev => prev.filter(f => f.id !== id));
      }, 700);
    } else {
      setFeedbacksB(prev => [...prev, newFeedback]);
      setTimeout(() => {
        setFeedbacksB(prev => prev.filter(f => f.id !== id));
      }, 700);
    }
  }

  // Efeito para carregar partidas e jogadores
  useEffect(() => {
    loadDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efeito do cronômetro
  useEffect(() => {
    let interval = null;
    if (timerAtivo) {
      interval = setInterval(() => {
        setTempo(t => t + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerAtivo]);

  // Salvar estado do cronômetro no localStorage para suportar reloads, troca de tela e abas fechadas
  useEffect(() => {
    if (partidaAtiva?.id) {
      localStorage.setItem(`timer_${partidaAtiva.id}`, JSON.stringify({
        tempo,
        timerAtivo,
        lastUpdated: Date.now()
      }));
    }
  }, [tempo, timerAtivo, partidaAtiva?.id]);

  async function loadDados() {
    setLoading(true);
    try {
      // 1. Carregar jogadores para o formulário de times
      const { data: jogs } = await jogadoresAPI.listar();
      setJogadores(jogs || []);

      // 2. Carregar partidas
      const { data: parts } = await partidasAPI.listar();
      const todas = parts || [];
      
      const ativas = todas.filter(p => p.status === 'ativo');
      const finalizadas = todas.filter(p => p.status === 'finalizado');

      setPartidas(ativas);
      setHistorico(finalizadas);

      // Se existir uma partida ativa no banco, carrega ela automaticamente
      if (ativas.length > 0) {
        const active = ativas[0];
        setPartidaAtiva(active);
        setPlacarA(active.placar_time_a || 0);
        setPlacarB(active.placar_time_b || 0);
        setPeriodo(active.periodos || 1);
        
        // Carrega tempo a partir do local storage se existir, senão a partir do banco
        let restoredSuccess = false;
        try {
          const localStateStr = localStorage.getItem(`timer_${active.id}`);
          if (localStateStr) {
            const localState = JSON.parse(localStateStr);
            let currentTempo = localState.tempo;
            let currentTimerAtivo = localState.timerAtivo;
            
            // Se o timer estava rodando, calcula o tempo que passou desde que o navegador foi fechado/atualizado
            if (currentTimerAtivo && localState.lastUpdated) {
              const elapsedSeconds = Math.floor((Date.now() - localState.lastUpdated) / 1000);
              currentTempo += elapsedSeconds;
            }
            
            setTempo(currentTempo);
            setTimerAtivo(currentTimerAtivo);
            restoredSuccess = true;
          }
        } catch (e) {
          console.warn('Erro ao restaurar cronômetro do localStorage:', e);
        }

        if (!restoredSuccess) {
          if (active.tempo_total) {
            const parts = active.tempo_total.split(':');
            if (parts.length === 2) {
              setTempo(parseInt(parts[0]) * 60 + parseInt(parts[1]));
            }
          }
          setTimerAtivo(false);
        }

        // Carrega escalação do banco
        const { data: roster } = await partidasAPI.obterJogadoresDaPartida(active.id);
        if (roster) {
          setTimeAJogadores(roster.filter(r => r.time === 'A').map(r => r.jogador_id));
          setTimeBJogadores(roster.filter(r => r.time === 'B').map(r => r.jogador_id));
        }

        setTimeANome(active.time_a);
        setTimeBNome(active.time_b);
        setTela('partida');
      }
    } catch (e) {
      console.error(e);
      showToast('Erro ao carregar dados do Supabase', 'error');
    }
    setLoading(false);
  }

  // Controle de seleção de jogadores no formulário
  function togglePlayer(jogadorId, time) {
    if (time === 'A') {
      if (timeAJogadores.includes(jogadorId)) {
        setTimeAJogadores(prev => prev.filter(id => id !== jogadorId));
      } else {
        setTimeAJogadores(prev => [...prev, jogadorId]);
        setTimeBJogadores(prev => prev.filter(id => id !== jogadorId)); // remove do outro time
      }
    } else {
      if (timeBJogadores.includes(jogadorId)) {
        setTimeBJogadores(prev => prev.filter(id => id !== jogadorId));
      } else {
        setTimeBJogadores(prev => [...prev, jogadorId]);
        setTimeAJogadores(prev => prev.filter(id => id !== jogadorId)); // remove do outro time
      }
    }
  }

  // Criação e início de um novo jogo
  async function handleIniciarJogo() {
    if (!timeANome.trim() || !timeBNome.trim()) {
      showToast('Por favor, informe os nomes dos dois times', 'error');
      return;
    }
    if (timeAJogadores.length === 0) {
      showToast(`Adicione pelo menos 1 jogador ao ${timeANome}`, 'error');
      return;
    }
    if (timeBJogadores.length === 0) {
      showToast(`Adicione pelo menos 1 jogador ao ${timeBNome}`, 'error');
      return;
    }

    setSalvando(true);
    try {
      const novaPartida = {
        time_a: timeANome.trim(),
        time_b: timeBNome.trim(),
        placar_time_a: 0,
        placar_time_b: 0,
        tempo_total: '00:00',
        periodos: 1,
        status: 'ativo',
        cidade: 'Altamira',
        uf: 'PA'
      };

      const { data, error } = await partidasAPI.criar(novaPartida);
      if (error) throw error;

      // Adicionar jogadores no banco
      const rosterA = timeAJogadores.map(id => ({
        partida_id: data.id,
        jogador_id: id,
        time: 'A'
      }));
      const rosterB = timeBJogadores.map(id => ({
        partida_id: data.id,
        jogador_id: id,
        time: 'B'
      }));

      const { error: errorRoster } = await partidasAPI.adicionarJogadores([...rosterA, ...rosterB]);
      if (errorRoster) throw errorRoster;

      setPartidaAtiva(data);
      setPlacarA(0);
      setPlacarB(0);
      setTempo(0);
      setTimerAtivo(false);
      setPeriodo(1);
      setPeriodosScores([]);
      setTela('partida');
      showToast('Partida iniciada!', 'success');
    } catch (e) {
      console.error(e);
      showToast(e.message || 'Erro ao iniciar partida', 'error');
    } finally {
      setSalvando(false);
    }
  }

  // Controles de pontuação
  function ajustarPlacar(time, valor) {
    if (time === 'A') {
      setPlacarA(prev => {
        const novoVal = prev + valor;
        const finalVal = novoVal < 0 ? 0 : novoVal;
        const realDiff = finalVal - prev;
        if (realDiff !== 0) triggerFeedback('A', realDiff);
        return finalVal;
      });
    } else {
      setPlacarB(prev => {
        const novoVal = prev + valor;
        const finalVal = novoVal < 0 ? 0 : novoVal;
        const realDiff = finalVal - prev;
        if (realDiff !== 0) triggerFeedback('B', realDiff);
        return finalVal;
      });
    }
  }

  // Salva o placar atualizado no Supabase em segundo plano
  async function sincronizarPlacarBanco(finalScore = {}) {
    if (!partidaAtiva) return;
    const pA = finalScore.placar_time_a ?? placarA;
    const pB = finalScore.placar_time_b ?? placarB;
    const currentPeriod = finalScore.periodos ?? periodo;
    const timeFormatted = finalScore.tempo_total ?? formatTempo(tempo);

    await partidasAPI.atualizar(partidaAtiva.id, {
      placar_time_a: pA,
      placar_time_b: pB,
      periodos: currentPeriod,
      tempo_total: timeFormatted
    });
  }

  // Controle do Período
  function avancarPeriodo() {
    // Calcular a pontuação acumulada deste período
    const somaAAnteriores = periodosScores.reduce((acc, curr) => acc + curr.a, 0);
    const somaBAnteriores = periodosScores.reduce((acc, curr) => acc + curr.b, 0);
    
    const pontosEstePeriodoA = placarA - somaAAnteriores;
    const pontosEstePeriodoB = placarB - somaBAnteriores;

    const novoHistorico = [
      ...periodosScores,
      { periodo: periodo, a: pontosEstePeriodoA, b: pontosEstePeriodoB }
    ];

    setPeriodosScores(novoHistorico);
    const novoPeriodo = periodo + 1;
    setPeriodo(novoPeriodo);
    showToast(`Iniciado o Período ${novoPeriodo}!`, 'success');

    // Sincronizar período no banco
    sincronizarPlacarBanco({ periodos: novoPeriodo });
  }

  // Encerramento da Partida
  async function handleFinalizarJogo() {
    if (!partidaAtiva) return;
    setSalvando(true);
    setTimerAtivo(false); // garante que o timer pare

    try {
      const finalScore = {
        placar_time_a: placarA,
        placar_time_b: placarB,
        tempo_total: formatTempo(tempo),
        periodos: periodo,
        status: 'finalizado',
        mvp_id: mvpId || null
      };

      const { error } = await partidasAPI.atualizar(partidaAtiva.id, finalScore);
      if (error) throw error;

      // Limpar estado do localStorage
      localStorage.removeItem(`timer_${partidaAtiva.id}`);

      showToast('Partida finalizada com sucesso e salva no histórico!', 'success');
      setShowFinalizarModal(false);
      setPartidaAtiva(null);
      
      // Limpa dados e volta para listagem
      setTimeANome('Time A');
      setTimeBNome('Time B');
      setTimeAJogadores([]);
      setTimeBJogadores([]);
      setMvpId('');
      setTela('lista');
      setAba('historico');
      loadDados(); // recarrega histórico
    } catch (e) {
      console.error(e);
      showToast('Erro ao finalizar jogo', 'error');
    } finally {
      setSalvando(false);
    }
  }

  // Helpers de formatação e visualização
  const formatTempo = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Jogadores escalados para exibição do MVP
  const getEscalados = () => {
    return jogadores.filter(j => timeAJogadores.includes(j.id) || timeBJogadores.includes(j.id));
  };

  // Se o carregamento estiver ativo
  // (Removido o early return para permitir renderizar o shell da lista com esqueletos shimmer)

  return (
    <div className="page-content">
      {/* TELA 1: LISTAGEM DE PARTIDAS / HISTÓRICO */}
      {tela === 'lista' && (
        <div style={{ padding: '20px 20px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, background: 'rgba(99,102,241,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue-light)" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 20 }}>Jogos da Noite</h2>
                <p style={{ color: '#64748b', fontSize: 13 }}>Gerenciador de partidas</p>
              </div>
            </div>
            
            {partidas.length === 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => setTela('novo')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Novo Jogo
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={`tab ${aba === 'jogos' ? 'active' : ''}`} onClick={() => setAba('jogos')}>
              Partida Ativa
            </button>
            <button className={`tab ${aba === 'historico' ? 'active' : ''}`} onClick={() => setAba('historico')}>
              Histórico
              {historico.length > 0 && (
                <span style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{historico.length}</span>
              )}
            </button>
          </div>

          {/* Renderização conforme Aba */}
          {loading ? (
            aba === 'jogos' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="skeleton" style={{ height: 170, borderRadius: '16px' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(idx => (
                  <div key={idx} className="skeleton" style={{ height: 96, borderRadius: '16px' }} />
                ))}
              </div>
            )
          ) : aba === 'jogos' ? (
            <>
              {partidas.length === 0 ? (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  <h3>Nenhuma partida ativa</h3>
                  <p>Cadastre os times e comece a partida da noite!</p>
                  <button className="btn btn-primary" onClick={() => setTela('novo')} style={{ marginTop: 16 }}>
                    Iniciar Novo Jogo
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {partidas.map((p, i) => (
                    <div key={p.id} className="card card-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12, animationDelay: `${i * 30}ms` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>EM ANDAMENTO</span>
                        <span style={{ color: '#64748b', fontSize: 13 }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'center', gap: 24, margin: '10px 0' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 18 }}>{p.time_a}</div>
                          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{p.placar_time_a}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: '#64748b', fontWeight: 800 }}>x</div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 18 }}>{p.time_b}</div>
                          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{p.placar_time_b}</div>
                        </div>
                      </div>
                      <button className="btn btn-primary" onClick={() => {
                        setPartidaAtiva(p);
                        setPlacarA(p.placar_time_a);
                        setPlacarB(p.placar_time_b);
                        setPeriodo(p.periodos);
                        setTela('partida');
                      }}>
                        Retomar Partida
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {historico.length === 0 ? (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <h3>Histórico vazio</h3>
                  <p>Partidas finalizadas aparecerão aqui.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
                  {historico.map((p, i) => {
                    const venceA = p.placar_time_a > p.placar_time_b;
                    const venceB = p.placar_time_b > p.placar_time_a;
                    return (
                      <div key={p.id} className="card card-enter" style={{ borderLeft: `4px solid ${venceA ? '#4ade80' : venceB ? '#f87171' : '#64748b'}`, animationDelay: `${i * 30}ms` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                          <span>{p.cidade} • {p.uf}</span>
                          <span>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: venceA ? 800 : 500, color: venceA ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.time_a}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 8, fontWeight: 800, fontSize: 15 }}>
                            <span style={{ color: venceA ? '#22c55e' : 'var(--text-primary)' }}>{p.placar_time_a}</span>
                            <span style={{ color: 'var(--text-muted)' }}>x</span>
                            <span style={{ color: venceB ? '#22c55e' : 'var(--text-primary)' }}>{p.placar_time_b}</span>
                          </div>
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <span style={{ fontWeight: venceB ? 800 : 500, color: venceB ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.time_b}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6 }}>
                          <span>Duração: {p.tempo_total}</span>
                          <span>Períodos: {p.periodos}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TELA 2: WIZARD / CADASTRO DE TIMES */}
      {tela === 'novo' && (
        <div style={{ padding: '20px' }}>
          <h3 style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Configurar Partida</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>Configure as equipes e a lista de atletas antes de iniciar o cronômetro.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Input nomes dos times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome Time A *</label>
                <input
                  value={timeANome}
                  onChange={e => setTimeANome(e.target.value)}
                  placeholder="Ex: Time Azul"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome Time B *</label>
                <input
                  value={timeBNome}
                  onChange={e => setTimeBNome(e.target.value)}
                  placeholder="Ex: Time Branco"
                />
              </div>
            </div>

            {/* Listagem de jogadores e seleção rápida */}
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Escalar Jogadores</label>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Distribua os jogadores entre as duas equipes:</p>
              
              <div style={{ maxHeight: '50vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px' }}>
                {jogadores.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Cadastre jogadores na aba Jogadores antes.</p>
                ) : (
                  jogadores.map(j => {
                    const noA = timeAJogadores.includes(j.id);
                    const noB = timeBJogadores.includes(j.id);
                    return (
                      <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{j.nome}</div>
                          {j.apelido && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>"{j.apelido}" • {j.posicao}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => togglePlayer(j.id, 'A')}
                            className={`btn btn-sm ${noA ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '4px 10px', background: noA ? '#3b82f6' : 'transparent', color: noA ? '#fff' : 'var(--text-secondary)', border: noA ? '1px solid #3b82f6' : '1px solid var(--border)' }}
                          >
                            Time A
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePlayer(j.id, 'B')}
                            className={`btn btn-sm ${noB ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '4px 10px', background: noB ? '#ef4444' : 'transparent', color: noB ? '#fff' : 'var(--text-secondary)', border: noB ? '1px solid #ef4444' : '1px solid var(--border)' }}
                          >
                            Time B
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Contadores da Roster */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', padding: '0 4px' }}>
              <span>{timeANome}: <strong>{timeAJogadores.length} jogadores</strong></span>
              <span>{timeBNome}: <strong>{timeBJogadores.length} jogadores</strong></span>
            </div>

            {/* Botões do Wizard */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn btn-secondary" onClick={() => setTela('lista')} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleIniciarJogo} disabled={salvando} style={{ flex: 2 }}>
                {salvando ? <><div className="spinner" /> Salvando...</> : 'Iniciar Partida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TELA 3: PAINEL DA PARTIDA ATIVA */}
      {tela === 'partida' && partidaAtiva && (
        <div style={{ padding: '20px' }}>
          {/* Header Jogo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button onClick={() => { setTimerAtivo(false); sincronizarPlacarBanco(); setTela('lista'); }} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}>
              ← Sair do Jogo
            </button>
            <div style={{ textAlign: 'right' }}>
              <span style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                AO VIVO
              </span>
            </div>
          </div>

          {/* Indicador de Período Pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 20px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '30px',
              backdropFilter: 'blur(12px)',
              webkitBackdropFilter: 'blur(12px)'
            }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#60a5fa', lineHeight: 1 }}>{periodo}º</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>PERÍODO</span>
            </div>
          </div>

          {/* Placar Centralizado (Unified Scoreboard Card) */}
          <div className="card" style={{
            padding: '20px 16px',
            background: 'rgba(26, 30, 40, 0.65)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24,
            backdropFilter: 'blur(12px)',
            webkitBackdropFilter: 'blur(12px)',
            position: 'relative'
          }}>
            {/* Floating Feedbacks Time A */}
            <div style={{ position: 'absolute', left: '25%', top: '35%', pointerEvents: 'none' }}>
              {feedbacksA.map(f => (
                <div key={f.id} className="floating-feedback" style={{ color: f.color, fontSize: '32px' }}>
                  {f.text}
                </div>
              ))}
            </div>

            {/* Floating Feedbacks Time B */}
            <div style={{ position: 'absolute', right: '25%', top: '35%', pointerEvents: 'none' }}>
              {feedbacksB.map(f => (
                <div key={f.id} className="floating-feedback" style={{ color: f.color, fontSize: '32px' }}>
                  {f.text}
                </div>
              ))}
            </div>

            {/* Time A Name & Score */}
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {timeANome}
              </span>
              <span key={placarA} className="number-animate" style={{
                fontSize: '90px',
                fontWeight: 'bold',
                color: '#3b82f6',
                fontFamily: "'Bebas Neue', 'Oswald', sans-serif",
                display: 'block',
                marginTop: 6,
                lineHeight: 1
              }}>
                {String(placarA).padStart(2, '0')}
              </span>
            </div>

            {/* Vertical Line Separator */}
            <div style={{
              width: '1px',
              height: '80px',
              background: 'rgba(255, 255, 255, 0.15)',
              alignSelf: 'center',
              margin: '0 8px'
            }} />

            {/* Time B Name & Score */}
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {timeBNome}
              </span>
              <span key={placarB} className="number-animate" style={{
                fontSize: '90px',
                fontWeight: 'bold',
                color: '#ef4444',
                fontFamily: "'Bebas Neue', 'Oswald', sans-serif",
                display: 'block',
                marginTop: 6,
                lineHeight: 1
              }}>
                {String(placarB).padStart(2, '0')}
              </span>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '20px 0' }} />

          {/* Controles de Pontuação (Side-by-Side) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Controles Time A */}
            <div className="card" style={{
              padding: '16px 12px',
              background: 'var(--card-team-a-bg)',
              border: 'var(--card-team-a-border)',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pontuar {timeANome}</span>
              
              {/* Botões Positivos */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, width: '100%', justifyContent: 'center' }}>
                <button className="btn-counter" onClick={() => ajustarPlacar('A', 1)} style={{
                  flex: 1.0,
                  height: '38px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#60a5fa',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>+1</button>
                <button className="btn-counter" onClick={() => ajustarPlacar('A', 2)} style={{
                  flex: 1.2,
                  height: '44px',
                  background: '#3b82f6',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}>+2</button>
                <button className="btn-counter" onClick={() => ajustarPlacar('A', 3)} style={{
                  flex: 1.4,
                  height: '50px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '2px solid #f59e0b',
                  color: '#f59e0b',
                  borderRadius: '8px',
                  fontSize: '22px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)'
                }}>+3</button>
              </div>

              {/* Botões Negativos */}
              <div style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'center', marginTop: 4 }}>
                <button className="btn-counter" onClick={() => ajustarPlacar('A', -1)} style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>-1</button>
                <button className="btn-counter" onClick={() => ajustarPlacar('A', -2)} style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>-2</button>
                <button className="btn-counter" onClick={() => ajustarPlacar('A', -3)} style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>-3</button>
              </div>
            </div>

            {/* Controles Time B */}
            <div className="card" style={{
              padding: '16px 12px',
              background: 'var(--card-team-b-bg)',
              border: 'var(--card-team-b-border)',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pontuar {timeBNome}</span>
              
              {/* Botões Positivos */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, width: '100%', justifyContent: 'center' }}>
                <button className="btn-counter" onClick={() => ajustarPlacar('B', 1)} style={{
                  flex: 1.0,
                  height: '38px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>+1</button>
                <button className="btn-counter" onClick={() => ajustarPlacar('B', 2)} style={{
                  flex: 1.2,
                  height: '44px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}>+2</button>
                <button className="btn-counter" onClick={() => ajustarPlacar('B', 3)} style={{
                  flex: 1.4,
                  height: '50px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '2px solid #f59e0b',
                  color: '#f59e0b',
                  borderRadius: '8px',
                  fontSize: '22px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)'
                }}>+3</button>
              </div>

              {/* Botões Negativos */}
              <div style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'center', marginTop: 4 }}>
                <button className="btn-counter" onClick={() => ajustarPlacar('B', -1)} style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>-1</button>
                <button className="btn-counter" onClick={() => ajustarPlacar('B', -2)} style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>-2</button>
                <button className="btn-counter" onClick={() => ajustarPlacar('B', -3)} style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}>-3</button>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '20px 0' }} />

          {/* Cronômetro visor */}
          <div className={`card ${timerAtivo ? 'timer-active-pulse' : ''}`} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            marginBottom: 20,
            transition: 'all 0.3s ease',
            border: timerAtivo ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid var(--border)',
            padding: '24px',
            background: 'var(--timer-bg)',
            backdropFilter: 'blur(12px)',
            webkitBackdropFilter: 'blur(12px)',
            width: '100%',
            minWidth: '40%'
          }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>TEMPO DE JOGO</span>
              <span className={timerAtivo ? 'timer-active-pulse-text' : ''} style={{
                fontSize: '72px',
                fontFamily: 'monospace',
                fontWeight: 800,
                color: '#ffffff',
                textShadow: timerAtivo ? '0 0 16px rgba(255, 255, 255, 0.4)' : 'none',
                transition: 'color 0.3s ease, text-shadow 0.3s ease',
                lineHeight: 1,
                display: 'inline-block'
              }}>{formatTempo(tempo)}</span>
            </div>
            
            {/* Botões do Timer */}
            <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center' }}>
              {!timerAtivo ? (
                <button onClick={() => setTimerAtivo(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'rgba(34, 197, 94, 0.08)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ▶ Iniciar
                </button>
              ) : (
                <button onClick={() => setTimerAtivo(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ⏸ Pausar
                </button>
              )}
              <button onClick={() => { setTimerAtivo(false); setTempo(0); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'rgba(100, 116, 139, 0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                🔄 Reiniciar
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '20px 0' }} />

          {/* Seção Próximo Período Isolada e Destacada */}
          <div className="card" style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(26, 30, 40, 0.4) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245, 158, 11, 0.85)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Controle de Período</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Fim do {periodo}º período da partida</span>
            </div>
            <button onClick={avancarPeriodo} style={{
              background: '#f59e0b',
              color: '#0d0f14',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              transition: 'all 0.2s'
            }}>
              Próximo Período
            </button>
          </div>

          {/* Botão de Ação Inferior (Isolado e Crítico) */}
          <div style={{ marginTop: 24, paddingBottom: 20 }}>
            <button onClick={() => { setTimerAtivo(false); setShowFinalizarModal(true); }} style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 20px',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
              transition: 'all 0.2s'
            }}>
              Finalizar Jogo
            </button>
          </div>
        </div>
      )}

      {/* MODAL: SELECIONAR MVP E CONFIRMAR ENCERRAMENTO */}
      {showFinalizarModal && (
        <div className="modal-overlay" onClick={() => setShowFinalizarModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Finalizar Jogo</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>Deseja mesmo encerrar a partida? O placar acumulado e estatísticas serão registrados de forma definitiva.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Eleger MVP da Partida (Opcional)</label>
                <select value={mvpId} onChange={e => setMvpId(e.target.value)} style={{ color: mvpId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <option value="">Selecione o MVP...</option>
                  {getEscalados().map(j => (
                    <option key={j.id} value={j.id}>{j.nome} ({timeAJogadores.includes(j.id) ? timeANome : timeBNome})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowFinalizarModal(false)} style={{ flex: 1 }}>Voltar</button>
              <button className="btn btn-primary" onClick={handleFinalizarJogo} disabled={salvando} style={{ flex: 2, background: '#22c55e', border: 'none' }}>
                {salvando ? <><div className="spinner" /> Salvando...</> : 'Confirmar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
