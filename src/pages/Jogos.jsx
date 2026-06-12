import { useState, useEffect } from 'react';
import { partidasAPI, jogadoresAPI } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import Torneios from './Torneios';
import { IconJogo, IconMais, IconCalendario } from '../components/Icons';

export default function Jogos({ profile, initialAba = 'jogos' }) {
  const [tela, setTela] = useState('lista'); // 'lista' | 'novo' | 'partida'
  const [aba, setAba] = useState(initialAba); // 'jogos' | 'historico' | 'torneios'
  
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
  const [duracaoQuarto, setDuracaoQuarto] = useState(10); // 10 | 12

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
    const color = valor > 0 ? 'var(--accent)' : '#f87171';
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
        setTempo(t => Math.max(0, t - 1));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerAtivo]);

  // Efeito para tratar o fim do período automaticamente
  useEffect(() => {
    if (tempo === 0 && timerAtivo) {
      setTimerAtivo(false);
      showToast('Fim de Período!', 'warning');
      sincronizarPlacarBanco({ tempo_total: '00:00' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo, timerAtivo]);

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
      // 1. Carregar jogadores para o formulário de times (filtrar pela cidade do usuário)
      const { data: jogs } = await jogadoresAPI.listar();
      const userCity = profile.cidade_atual || profile.cidade || 'Altamira';
      const userUf = profile.uf || '';
      setJogadores((jogs || []).filter(j => {
        if (!j.cidade) return true;
        return j.cidade.toLowerCase() === userCity.toLowerCase() &&
               (!userUf || !j.uf || j.uf.toLowerCase() === userUf.toLowerCase());
      }));

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
        
        // Carrega a duração do quarto salva no localStorage ou infere a partir do tempo inicial
        let savedDur = localStorage.getItem(`duracao_${active.id}`);
        let parsedDur = 10;
        if (savedDur) {
          parsedDur = parseInt(savedDur);
        } else {
          if (active.tempo_total) {
            const parts = active.tempo_total.split(':');
            if (parts.length === 2) {
              const totalSecs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
              if (totalSecs > 600) parsedDur = 12;
            }
          }
        }
        setDuracaoQuarto(parsedDur);

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
              currentTempo = Math.max(0, currentTempo - elapsedSeconds);
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
          } else {
            setTempo(parsedDur * 60);
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
      showToast('Erro ao carregar dados. Tente novamente.', 'error');
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
      const tempoTotalInicial = `${duracaoQuarto}:00`;
      const novaPartida = {
        time_a: timeANome.trim(),
        time_b: timeBNome.trim(),
        placar_time_a: 0,
        placar_time_b: 0,
        tempo_total: tempoTotalInicial,
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

      // Salva a duração no localStorage
      localStorage.setItem(`duracao_${data.id}`, String(duracaoQuarto));

      setPartidaAtiva(data);
      setPlacarA(0);
      setPlacarB(0);
      setTempo(duracaoQuarto * 60);
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

  // Controle do Período (Transição oficial)
  function comecarProximoPeriodo() {
    setTimerAtivo(false);

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

    // Duração do próximo período: 5 min para Prorrogação (>= 5), caso contrário a duração padrão
    const novoTempo = novoPeriodo >= 5 ? 300 : duracaoQuarto * 60;
    setTempo(novoTempo);

    const labelPeriodo = novoPeriodo >= 5 ? 'Prorrogação' : `${novoPeriodo}º Quarto`;
    showToast(`Iniciado o ${labelPeriodo}!`, 'success');

    // Sincronizar período no banco
    sincronizarPlacarBanco({
      periodos: novoPeriodo,
      tempo_total: formatTempo(novoTempo)
    });
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

  const getQuarterScore = (q, time) => {
    // Se o período pedido é o período atual ativo
    if (q === periodo) {
      const somaAnteriores = periodosScores.reduce((acc, curr) => acc + (time === 'A' ? curr.a : curr.b), 0);
      return Math.max(0, (time === 'A' ? placarA : placarB) - somaAnteriores);
    }
    // Se já está gravado no histórico
    const found = periodosScores.find(item => item.periodo === q);
    if (found) {
      return time === 'A' ? found.a : found.b;
    }
    // Se ainda não começou
    return '-';
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
    <div className="page-content home-page">
      {/* TELA 1: LISTAGEM DE PARTIDAS / HISTÓRICO */}
      {tela === 'lista' && (
        <div className="home-container" style={{ padding: '12px 12px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 34, height: 34, background: 'rgba(200,241,53,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {aba === 'torneios' ? (
                  <IconCalendario size={20} color="var(--accent)" />
                ) : (
                  <IconJogo size={20} color="var(--accent)" />
                )}
              </div>
              <div>
                <h2 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: 17 }}>
                  {aba === 'torneios' ? 'Torneios Regionais' : 'Jogos da Noite'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {aba === 'torneios' ? 'Competições e campeonatos ativos' : 'Gerenciador de partidas'}
                </p>
              </div>
            </div>
            
            {partidas.length === 0 && aba !== 'torneios' && (
              <button className="btn btn-primary btn-sm" onClick={() => setTela('novo')}>
                <IconMais size={14} color="currentColor" />
                Novo Jogo
              </button>
            )}
          </div>
 
          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 10 }}>
            <button className={`tab ${aba === 'jogos' ? 'active' : ''}`} onClick={() => setAba('jogos')}>
              Partida Ativa
            </button>
            <button className={`tab ${aba === 'historico' ? 'active' : ''}`} onClick={() => setAba('historico')}>
              Histórico
              {historico.length > 0 && (
                <span style={{ background: 'var(--accent)', color: '#111111', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{historico.length}</span>
              )}
            </button>
            <button className={`tab ${aba === 'torneios' ? 'active' : ''}`} onClick={() => setAba('torneios')}>
              Torneios
            </button>
          </div>

          {/* Renderização conforme Aba */}
          {aba === 'torneios' ? (
            <Torneios profile={profile} isNested={true} />
          ) : loading ? (
            aba === 'jogos' ? (
              <div className="responsive-card-grid">
                <div className="skeleton" style={{ height: 130, borderRadius: '12px' }} />
              </div>
            ) : (
              <div className="responsive-card-grid">
                {[1, 2, 3].map(idx => (
                  <div key={idx} className="skeleton" style={{ height: 72, borderRadius: '12px' }} />
                ))}
              </div>
            )
          ) : aba === 'jogos' ? (
            <>
              {partidas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto' }}>
                    <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M2 12h20"/>
                  </svg>
                  <h3 style={{ color: 'var(--text-primary)', marginTop: 16, fontFamily: "'Inter',sans-serif", fontSize: 18, fontWeight: 700 }}>Nenhuma partida ativa</h3>
                  <p style={{ fontSize: 12, margin: '8px 0', fontFamily: "'Inter',sans-serif" }}>Comece uma partida para ver aqui</p>
                  <button onClick={() => setTela('novo')} className="btn-primary" style={{ marginTop: 16, border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontFamily: "'Inter',sans-serif", cursor: 'pointer' }}>
                    + Novo Jogo
                  </button>
                </div>
              ) : (
                <div className="responsive-card-grid">
                  {partidas.map((p, i) => (
                    <div key={p.id} className="card card-enter" style={{ display: 'flex', flexDirection: 'column', gap: 8, animationDelay: `${i * 30}ms` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>EM ANDAMENTO</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'center', gap: 16, margin: '6px 0' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 18 }}>{p.time_a}</div>
                          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{p.placar_time_a}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: 'var(--text-muted)', fontWeight: 800 }}>x</div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 18 }}>{p.time_b}</div>
                          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{p.placar_time_b}</div>
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
                <div className="responsive-card-grid" style={{ paddingBottom: 12 }}>
                  {historico.map((p, i) => {
                    const venceA = p.placar_time_a > p.placar_time_b;
                    const venceB = p.placar_time_b > p.placar_time_a;
                    return (
                      <div key={p.id} className="card card-enter" style={{ borderLeft: `4px solid ${venceA ? '#4ade80' : venceB ? '#f87171' : '#64748b'}`, animationDelay: `${i * 30}ms` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span>{p.cidade} • {p.uf}</span>
                          <span>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: venceA ? 800 : 500, color: venceA ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.time_a}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, padding: '3px 8px', background: 'var(--bg-secondary)', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>
                            <span style={{ color: venceA ? '#22c55e' : 'var(--text-primary)' }}>{p.placar_time_a}</span>
                            <span style={{ color: 'var(--text-muted)' }}>x</span>
                            <span style={{ color: venceB ? '#22c55e' : 'var(--text-primary)' }}>{p.placar_time_b}</span>
                          </div>
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <span style={{ fontWeight: venceB ? 800 : 500, color: venceB ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.time_b}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6 }}>
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
        <div style={{ padding: '12px' }}>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: 18, marginBottom: 2 }}>Configurar Partida</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>Configure as equipes e a lista de atletas antes de iniciar o cronômetro.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Input nomes dos times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome Time A *</label>
                <input
                  value={timeANome}
                  onChange={e => setTimeANome(e.target.value)}
                  placeholder="Ex: Time Azul"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome Time B *</label>
                <input
                  value={timeBNome}
                  onChange={e => setTimeBNome(e.target.value)}
                  placeholder="Ex: Time Branco"
                />
              </div>
            </div>

            {/* Duração do Quarto */}
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Duração do Quarto</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="duracaoQuarto"
                    checked={duracaoQuarto === 10}
                    onChange={() => setDuracaoQuarto(10)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                  />
                  10 minutos
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="duracaoQuarto"
                    checked={duracaoQuarto === 12}
                    onChange={() => setDuracaoQuarto(12)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                  />
                  12 minutos
                </label>
              </div>
            </div>

            {/* Listagem de jogadores e seleção rápida */}
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, display: 'block', marginBottom: 2 }}>Escalar Jogadores</label>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Distribua os jogadores entre as duas equipes:</p>
              
              <div style={{ maxHeight: '50vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px' }}>
                {jogadores.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Cadastre jogadores na aba Jogadores antes.</p>
                ) : (
                  jogadores.map(j => {
                    const noA = timeAJogadores.includes(j.id);
                    const noB = timeBJogadores.includes(j.id);
                    return (
                      <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{j.nome}</div>
                          {j.apelido && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>"{j.apelido}" • {j.posicao}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => togglePlayer(j.id, 'A')}
                            className={`btn btn-sm ${noA ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '4px 10px', background: noA ? 'var(--accent)' : 'transparent', color: noA ? '#0C0C14' : 'var(--text-secondary)', border: noA ? '1px solid var(--accent)' : '1px solid var(--border)' }}
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
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
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
        <div style={{ padding: '12px' }}>
          {/* Header Placar Ao Vivo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button 
              onClick={() => { setTimerAtivo(false); sincronizarPlacarBanco(); setTela('lista'); }} 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'inherit',
                padding: 0
              }}
            >
              ← PLACAR AO VIVO
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {periodo >= 5 ? 'PRORROGAÇÃO' : `${periodo}º QUARTO`}
              </span>
              <span style={{ background: '#EF4444', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800 }}>
                AO VIVO
              </span>
            </div>
          </div>

          {/* Cronômetro visor (Mockup style: Large and Centered at the top) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 10
          }}>
            <span className={timerAtivo ? 'timer-active-pulse-text' : ''} style={{
              fontSize: 'clamp(44px, 12vw, 72px)',
              fontFamily: 'monospace',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1,
              letterSpacing: '-0.02em'
            }}>
              {formatTempo(tempo)}
            </span>
          </div>

          {/* Placar Central (Unified Scoreboard Card) */}
          <div className="card live-scoreboard-card" style={{
            padding: '14px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 8,
            position: 'relative'
          }}>
            {/* Floating Feedbacks Time A */}
            <div style={{ position: 'absolute', left: '22%', top: '35%', pointerEvents: 'none' }}>
              {feedbacksA.map(f => (
                <div key={f.id} className="floating-feedback" style={{ color: f.color, fontSize: '32px' }}>
                  {f.text}
                </div>
              ))}
            </div>

            {/* Floating Feedbacks Time B */}
            <div style={{ position: 'absolute', right: '22%', top: '35%', pointerEvents: 'none' }}>
              {feedbacksB.map(f => (
                <div key={f.id} className="floating-feedback" style={{ color: f.color, fontSize: '32px' }}>
                  {f.text}
                </div>
              ))}
            </div>

            {/* Time A Name & Score */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
              <div style={{
                width: 'clamp(32px, 8vw, 40px)',
                height: 'clamp(32px, 8vw, 40px)',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.03)',
                border: '2px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 1 0 20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <span style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                {timeANome}
              </span>
              <span key={placarA} className="number-animate" style={{
                fontSize: 'clamp(32px, 10vw, 48px)',
                fontWeight: 900,
                color: 'var(--text-primary)',
                display: 'block',
                marginTop: 4,
                lineHeight: 1
              }}>
                {placarA}
              </span>
            </div>

            {/* Center VS */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 }}>
              VS
            </div>

            {/* Time B Name & Score */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
              <div style={{
                width: 'clamp(32px, 8vw, 40px)',
                height: 'clamp(32px, 8vw, 40px)',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.03)',
                border: '2px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 1 0 20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <span style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                {timeBNome}
              </span>
              <span key={placarB} className="number-animate" style={{
                fontSize: 'clamp(32px, 10vw, 48px)',
                fontWeight: 900,
                color: 'var(--text-primary)',
                display: 'block',
                marginTop: 4,
                lineHeight: 1
              }}>
                {placarB}
              </span>
            </div>
          </div>

          {/* Tabela de Parciais por Quarto */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 10px',
            marginBottom: 12,
            overflowX: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 600 }}>TIME</th>
                  <th style={{ padding: '6px 4px', fontWeight: 600 }}>Q1</th>
                  <th style={{ padding: '6px 4px', fontWeight: 600 }}>Q2</th>
                  <th style={{ padding: '6px 4px', fontWeight: 600 }}>Q3</th>
                  <th style={{ padding: '6px 4px', fontWeight: 600 }}>Q4</th>
                  {periodo >= 5 && <th style={{ padding: '6px 4px', fontWeight: 600 }}>PR</th>}
                  <th style={{ padding: '6px 4px', fontWeight: 800, color: 'var(--text-primary)' }}>T</th>
                </tr>
              </thead>
              <tbody>
                {/* Linha Time A */}
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <td style={{ padding: '8px 4px', textAlign: 'left', color: 'var(--counter-btn-a-color)', fontWeight: 700 }}>
                    {timeANome.substring(0, 3).toUpperCase()}
                  </td>
                  <td style={{ padding: '8px 4px' }}>{getQuarterScore(1, 'A')}</td>
                  <td style={{ padding: '8px 4px' }}>{getQuarterScore(2, 'A')}</td>
                  <td style={{ padding: '8px 4px' }}>{getQuarterScore(3, 'A')}</td>
                  <td style={{ padding: '8px 4px' }}>{getQuarterScore(4, 'A')}</td>
                  {periodo >= 5 && <td style={{ padding: '8px 4px' }}>{getQuarterScore(5, 'A')}</td>}
                  <td style={{ padding: '8px 4px', fontWeight: 800, color: 'var(--counter-btn-a-color)' }}>{placarA}</td>
                </tr>
                {/* Linha Time B */}
                <tr style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  <td style={{ padding: '8px 4px', textAlign: 'left', color: 'var(--counter-btn-b-color)', fontWeight: 700 }}>
                    {timeBNome.substring(0, 3).toUpperCase()}
                  </td>
                  <td style={{ padding: '8px 4px' }}>{getQuarterScore(1, 'B')}</td>
                  <td style={{ padding: '8px 4px' }}>{getQuarterScore(2, 'B')}</td>
                  <td style={{ padding: '8px 4px' }}>{getQuarterScore(3, 'B')}</td>
                  <td style={{ padding: '8px 4px' }}>{getQuarterScore(4, 'B')}</td>
                  {periodo >= 5 && <td style={{ padding: '8px 4px' }}>{getQuarterScore(5, 'B')}</td>}
                  <td style={{ padding: '8px 4px', fontWeight: 800, color: 'var(--counter-btn-b-color)' }}>{placarB}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Seção de Transição de Período Dinâmica (Ao zerar o cronômetro) */}
          {tempo === 0 && (
            <div style={{ marginBottom: 12 }}>
              {periodo < 4 ? (
                <div className="card" style={{
                  padding: '10px',
                  background: 'var(--card-team-a-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Fim do {periodo}º Quarto
                  </h3>
                  <button onClick={comecarProximoPeriodo} style={{
                    background: 'var(--accent)',
                    color: '#0C0C14',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginTop: 4
                  }}>
                    ▶ Iniciar {periodo + 1}º Quarto
                  </button>
                </div>
              ) : (placarA === placarB) ? (
                <div className="card" style={{
                  padding: '10px',
                  background: 'var(--card-team-b-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Jogo Empatado!
                  </h3>
                  <button onClick={comecarProximoPeriodo} style={{
                    background: 'var(--accent)',
                    color: '#0C0C14',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginTop: 4
                  }}>
                    ▶ Iniciar Prorrogação (5 min)
                  </button>
                </div>
              ) : (
                <div className="card" style={{
                  padding: '14px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#EF4444', marginBottom: 2 }}>
                    Partida Encerrada
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    O tempo regulamentar acabou. Registre o MVP e encerre no botão abaixo.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Controles de Pontuação Rápidos (Botoes + / -) */}
          <div className="live-game-controls-grid">
            {/* Controles Time A */}
            <div style={{
              padding: '8px',
              background: 'var(--bg-card)',
              border: '1px solid rgba(200,241,53,0.12)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6
            }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                + Pontuar {timeANome.substring(0,6)}
              </span>
              <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                <button onClick={() => ajustarPlacar('A', 1)} style={{ flex: 1, padding: '6px 0', background: 'var(--time-a-bg-1)', border: '1px solid var(--time-a-border-1)', color: 'var(--time-a-color-1)', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+1</button>
                <button onClick={() => ajustarPlacar('A', 2)} style={{ flex: 1.2, padding: '6px 0', background: 'var(--time-a-bg-2)', border: 'var(--time-a-border-2)', color: 'var(--time-a-color-2)', borderRadius: '6px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+2</button>
                <button onClick={() => ajustarPlacar('A', 3)} style={{ flex: 1, padding: '6px 0', background: 'var(--time-a-bg-3)', border: '1px solid var(--time-a-border-3)', color: 'var(--time-a-color-3)', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+3</button>
              </div>
              <div style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'center' }}>
                <button onClick={() => ajustarPlacar('A', -1)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', color: 'var(--time-a-color-neg)', background: 'var(--time-a-bg-neg)', border: 'var(--time-a-border-neg)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>-1</button>
                <button onClick={() => ajustarPlacar('A', -2)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', color: 'var(--time-a-color-neg)', background: 'var(--time-a-bg-neg)', border: 'var(--time-a-border-neg)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>-2</button>
              </div>
            </div>

            {/* Controles Time B */}
            <div style={{
              padding: '8px',
              background: 'var(--bg-card)',
              border: '1px solid rgba(200, 241, 53, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6
            }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                + Pontuar {timeBNome.substring(0,6)}
              </span>
              <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                <button onClick={() => ajustarPlacar('B', 1)} style={{ flex: 1, padding: '6px 0', background: 'var(--time-b-bg-1)', border: '1px solid var(--time-b-border-1)', color: 'var(--time-b-color-1)', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+1</button>
                <button onClick={() => ajustarPlacar('B', 2)} style={{ flex: 1.2, padding: '6px 0', background: 'var(--time-b-bg-2)', border: 'var(--time-b-border-2)', color: 'var(--time-b-color-2)', borderRadius: '6px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+2</button>
                <button onClick={() => ajustarPlacar('B', 3)} style={{ flex: 1, padding: '6px 0', background: 'var(--time-b-bg-3)', border: '1px solid var(--time-b-border-3)', color: 'var(--time-b-color-3)', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+3</button>
              </div>
              <div style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'center' }}>
                <button onClick={() => ajustarPlacar('B', -1)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', color: 'var(--time-a-color-neg)', background: 'var(--time-a-bg-neg)', border: 'var(--time-a-border-neg)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>-1</button>
                <button onClick={() => ajustarPlacar('B', -2)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', color: 'var(--time-a-color-neg)', background: 'var(--time-a-bg-neg)', border: 'var(--time-a-border-neg)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>-2</button>
              </div>
            </div>
          </div>

          {/* Bottom Controls Row (Prev, Play/Pause circular, Next) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '12px 20px',
            marginBottom: 20
          }}>
            {/* Prev/Reset Button */}
            <button 
              onClick={() => {
                setTimerAtivo(false);
                const resetTempo = periodo >= 5 ? 300 : duracaoQuarto * 60;
                setTempo(resetTempo);
                sincronizarPlacarBanco({ tempo_total: formatTempo(resetTempo) });
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Reiniciar Quarto"
            >
              ⏮
            </button>

            {/* Play/Pause Button */}
            <button 
              onClick={() => setTimerAtivo(!timerAtivo)}
              style={{
                background: 'var(--accent)',
                border: 'none',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                color: '#0C0C14',
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px var(--accent-dim)',
                transition: 'transform 0.1s'
              }}
            >
              {timerAtivo ? '⏸' : '▶'}
            </button>

            {/* Next/Finish Button */}
            <button 
              onClick={() => {
                setTimerAtivo(false);
                if (tempo > 0 && (periodo < 4 || (periodo === 4 && placarA === placarB) || (periodo >= 5 && placarA === placarB))) {
                  setTempo(0);
                  sincronizarPlacarBanco({ tempo_total: '00:00' });
                } else {
                  setShowFinalizarModal(true);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Próximo Quarto"
            >
              ⏭
            </button>
          </div>

          {/* Botão de Finalizar Partida */}
          <button 
            onClick={() => { setTimerAtivo(false); setShowFinalizarModal(true); }} 
            style={{
              width: '100%',
              padding: '14px',
              background: '#EF4444',
              color: '#FFF',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(239,68,68,0.2)'
            }}
          >
            Finalizar Partida
          </button>
        </div>
      )}

      {/* MODAL: SELECIONAR MVP E CONFIRMAR ENCERRAMENTO */}
      {showFinalizarModal && (
        <div className="modal-overlay" onClick={() => setShowFinalizarModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Finalizar Jogo</h3>
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

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`toast ${toast.type}`} 
            style={{ zIndex: 9999 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
