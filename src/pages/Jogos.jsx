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
        return novoVal < 0 ? 0 : novoVal;
      });
    } else {
      setPlacarB(prev => {
        const novoVal = prev + valor;
        return novoVal < 0 ? 0 : novoVal;
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
  if (loading && tela === 'lista') {
    return (
      <div className="page-content">
        <div className="loading"><div className="spinner" />Carregando partidas...</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* TELA 1: LISTAGEM DE PARTIDAS / HISTÓRICO */}
      {tela === 'lista' && (
        <div style={{ padding: '20px 20px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, background: 'rgba(99,102,241,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
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
          {aba === 'jogos' ? (
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
                  {partidas.map(p => (
                    <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  {historico.map(p => {
                    const venceA = p.placar_time_a > p.placar_time_b;
                    const venceB = p.placar_time_b > p.placar_time_a;
                    return (
                      <div key={p.id} className="card" style={{ borderLeft: `4px solid ${venceA ? '#4ade80' : venceB ? '#f87171' : '#64748b'}` }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>JOGO EM ANDAMENTO</span>
              <h4 style={{ fontWeight: 800, fontSize: 15, marginTop: 4, color: 'var(--text-secondary)' }}>Período Atual: {periodo}º Volta</h4>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Altamira - PA</span>
            </div>
          </div>

          {/* Placar Central Gigante */}
          <div className="card" style={{ padding: '24px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, textBreak: 'break-word', textAlign: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>{timeANome}</span>
                <span style={{ fontSize: 56, fontWeight: 900, color: '#3b82f6', display: 'block', marginTop: 4 }}>{String(placarA).padStart(2, '0')}</span>
              </div>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#475569' }}>x</span>
              <div style={{ flex: 1, textBreak: 'break-word', textAlign: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>{timeBNome}</span>
                <span style={{ fontSize: 56, fontWeight: 900, color: '#ef4444', display: 'block', marginTop: 4 }}>{String(placarB).padStart(2, '0')}</span>
              </div>
            </div>
          </div>

          {/* Controles de Pontuação Otimizados */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Time A */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <button className="btn btn-primary" onClick={() => ajustarPlacar('A', 1)} style={{ padding: '16px 0', fontSize: 18, fontWeight: 800, background: '#3b82f6' }}>+1</button>
                <button className="btn btn-primary" onClick={() => ajustarPlacar('A', 2)} style={{ padding: '16px 0', fontSize: 18, fontWeight: 800, background: '#3b82f6' }}>+2</button>
                <button className="btn btn-primary" onClick={() => ajustarPlacar('A', 3)} style={{ padding: '16px 0', fontSize: 18, fontWeight: 800, background: '#3b82f6' }}>+3</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <button className="btn btn-secondary" onClick={() => ajustarPlacar('A', -1)} style={{ padding: '12px 0', fontSize: 14, fontWeight: 700 }}>-1</button>
                <button className="btn btn-secondary" onClick={() => ajustarPlacar('A', -2)} style={{ padding: '12px 0', fontSize: 14, fontWeight: 700 }}>-2</button>
                <button className="btn btn-secondary" onClick={() => ajustarPlacar('A', -3)} style={{ padding: '12px 0', fontSize: 14, fontWeight: 700 }}>-3</button>
              </div>
            </div>

            {/* Time B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <button className="btn btn-primary" onClick={() => ajustarPlacar('B', 1)} style={{ padding: '16px 0', fontSize: 18, fontWeight: 800, background: '#ef4444' }}>+1</button>
                <button className="btn btn-primary" onClick={() => ajustarPlacar('B', 2)} style={{ padding: '16px 0', fontSize: 18, fontWeight: 800, background: '#ef4444' }}>+2</button>
                <button className="btn btn-primary" onClick={() => ajustarPlacar('B', 3)} style={{ padding: '16px 0', fontSize: 18, fontWeight: 800, background: '#ef4444' }}>+3</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <button className="btn btn-secondary" onClick={() => ajustarPlacar('B', -1)} style={{ padding: '12px 0', fontSize: 14, fontWeight: 700 }}>-1</button>
                <button className="btn btn-secondary" onClick={() => ajustarPlacar('B', -2)} style={{ padding: '12px 0', fontSize: 14, fontWeight: 700 }}>-2</button>
                <button className="btn btn-secondary" onClick={() => ajustarPlacar('B', -3)} style={{ padding: '12px 0', fontSize: 14, fontWeight: 700 }}>-3</button>
              </div>
            </div>
          </div>

          {/* Cronômetro e Controle Período */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            {/* Cronômetro visor */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>TEMPO DE JOGO</span>
                <span style={{ fontSize: 36, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{formatTempo(tempo)}</span>
              </div>
              {/* Botões do Timer */}
              <div style={{ display: 'flex', gap: 8 }}>
                {!timerAtivo ? (
                  <button className="btn btn-primary" onClick={() => setTimerAtivo(true)} style={{ padding: '8px 16px', background: '#22c55e', border: 'none' }}>
                    ▶ Iniciar
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => setTimerAtivo(false)} style={{ padding: '8px 16px', background: '#f59e0b', border: 'none' }}>
                    ⏸ Pausar
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => { setTimerAtivo(false); setTempo(0); }} style={{ padding: '8px 12px' }}>
                  🔄 Reiniciar
                </button>
              </div>
            </div>

            {/* Divisor */}
            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Controle de períodos */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Voltas jogadas: <strong>{periodo}</strong></span>
              <button className="btn btn-secondary btn-sm" onClick={avancarPeriodo}>
                Próximo Período
              </button>
            </div>
          </div>

          {/* Botões de Ação Inferiores */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => {
              setTimerAtivo(false);
              sincronizarPlacarBanco();
              setTela('lista');
            }} style={{ flex: 1 }}>
              Sair da Tela
            </button>
            <button className="btn btn-primary" onClick={() => {
              setTimerAtivo(false);
              setShowFinalizarModal(true);
            }} style={{ flex: 2, background: '#e11d48', border: 'none' }}>
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
