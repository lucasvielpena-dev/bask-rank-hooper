import { useState, useEffect, useRef } from 'react';
import { supabase, partidasAPI, jogadoresAPI, notasJogoAPI } from '../lib/supabase';
import { GRADES, GradePicker, gradePorValor, gradeInfo, RendimentoPill, LegendaRendimento } from '../components/GameGrade';
import { nomeAtleta, nomeCompletoAtleta } from '../lib/nomes';
import { motion, AnimatePresence } from 'framer-motion';
import Torneios from './Torneios';
import { IconMais } from '../components/Icons';
import { useEsporte } from '../contexts/EsporteContext';
import { assinarAviso } from '../lib/realtime';
import { lerCache, salvarCache, igualLista } from '../lib/pageCache';

function normalizarCidade(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*-\s*[a-z]{2}$/i, '')
    .replace(/\s+/g, ' ');
}

export default function Jogos({ profile, initialAba = 'jogos' }) {
  const { esporte } = useEsporte();
  const [tela, setTela] = useState('lista'); // 'lista' | 'novo' | 'partida'
  const [aba, setAba] = useState(initialAba); // 'jogos' | 'historico' | 'torneios'
  const [showCriarTorneio, setShowCriarTorneio] = useState(false);
  
  // Lista de partidas e jogadores para seleção
  const _cache = lerCache('jogos');
  const [partidas, setPartidas] = useState(_cache?.partidas || []);
  const [historico, setHistorico] = useState(_cache?.historico || []);
  const [jogadores, setJogadores] = useState([]);
  const [loading, setLoading] = useState(!_cache);
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
  // Modo mesa — box score individual (PTS AST REB TO faltas)
  const [modoMesa, setModoMesa] = useState(false);
  const [boxScore, setBoxScore] = useState({}); // jogador_id -> stats
  const [mesaUndo, setMesaUndo] = useState([]); // [{jogadorId, campo, delta}]
  const [mesaBusy, setMesaBusy] = useState(false);
  const [mesaFlash, setMesaFlash] = useState(null); // { jid, campo, id }
  const [tempo, setTempo] = useState(0); // em segundos
  const [timerAtivo, setTimerAtivo] = useState(false);
  const [periodo, setPeriodo] = useState(1);
  const [periodosScores, setPeriodosScores] = useState([]); // Histórico de pontuações de cada período [{periodo, a, b}]
  const [duracaoQuarto, setDuracaoQuarto] = useState(10); // 10 | 12

  // MVP e encerramento
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [mvpId, setMvpId] = useState('');

  // Placar compartilhado: pedido + aceite de quem criou a partida
  const [operadores, setOperadores] = useState([]);
  const [pedidosCriador, setPedidosCriador] = useState([]);
  const [pedindoOperar, setPedindoOperar] = useState(false);
  const souCriadorPartida = !!partidaAtiva && !!profile?.id && partidaAtiva.criado_por === profile.id;
  const meuPedido = operadores.find(o => o.usuario_id === profile?.id);
  const possoOperarPlacar = souCriadorPartida || !!meuPedido?.aprovado;
  const pedidosPendentes = operadores.filter(o => !o.aprovado);
  const operadoresAprovados = operadores.filter(o => o.aprovado);

  async function carregarOperadores(partidaId) {
    if (!partidaId) return;
    const { data } = await partidasAPI.listarOperadores(partidaId);
    setOperadores(data || []);
  }

  // Pedidos que EU (criador) preciso responder — vale em qualquer tela.
  async function carregarPedidosCriador() {
    const { data } = await partidasAPI.listarPedidosPendentes();
    const lista = (data || []).filter(p => p.usuario_id !== profile?.id);
    setPedidosCriador(prev => (igualLista(prev, lista) ? prev : lista));
  }

  // Recarrega a lista SEM abrir o placar (diferente do loadDados) — a lista
  // nunca deve mentir sobre o que está em andamento.
  async function recarregarPartidas() {
    try {
      const { data } = await partidasAPI.listar(esporte);
      const todas = data || [];
      // Só troca o estado (e re-renderiza a lista) se algo mudou de verdade.
      // Antes, este ciclo de 5s criava arrays novos com os mesmos dados e a
      // lista inteira redesenhava no meio da rolagem — a "engasgada".
      const ativas = todas.filter(p => p.status === 'ativo');
      const finalizadas = todas.filter(p => p.status === 'finalizado');
      setPartidas(prev => (igualLista(prev, ativas) ? prev : ativas));
      setHistorico(prev => (igualLista(prev, finalizadas) ? prev : finalizadas));
    } catch (e) {
      console.warn('Falha ao recarregar partidas:', e);
    }
  }

  // Se a partida foi encerrada em OUTRO celular, este placar não pode fingir
  // que continua valendo. `finalizandoRef` marca quem encerrou foi este aparelho.
  const finalizandoRef = useRef(false);
  const ultimoToqueLocalRef = useRef(0);   // quando EU marquei ponto por último
  const ultimoUpdatedAtRef = useRef(null); // versão da partida que já vi no banco
  const primeiroSyncRef = useRef(true);    // evita devolver ao banco o que acabou de chegar
  const timerEndAtRef = useRef(null);      // timestamp de quando o cronômetro chega a 0
  const timerAtivoPrevRef = useRef(false); // detecta play/pause local (não confunde com sync remoto)
  const ignorarProximoWriteTimerRef = useRef(false); // não sobrescrever o banco ao aplicar timer remoto
  const timerEndAtIsoRef = useRef(null);   // último timer_end_at visto (evita setState em loop)

  async function sairPorPartidaEncerrada() {
    if (finalizandoRef.current) return;
    finalizandoRef.current = true; // não repetir o aviso
    setTimerAtivo(false);
    setPartidaAtiva(null);
    setAba('historico');
    setTela('lista');
    showToast('Esta partida foi encerrada em outro celular. Confira o histórico.', 'warning');
    await recarregarPartidas();
  }

  // Busca a verdade no banco: o placar que o OUTRO celular marcou e/ou o
  // encerramento da partida. É o que faz os dois placares acompanharem.
  async function puxarPlacarDoBanco(partidaId) {
    const id = partidaId || partidaAtiva?.id;
    if (!id || finalizandoRef.current) return;
    try {
      const { data } = await partidasAPI.buscar(id);
      if (!data) return;
      if (data.status === 'finalizado') { await sairPorPartidaEncerrada(); return; }
      // Enquanto EU estou pontuando, o banco não "desfaz" o toque (o envio sai logo
      // depois — o envio é rápido, então a janela aqui pode ser curta).
      if (Date.now() - ultimoToqueLocalRef.current < 1500) return;
      if (data.updated_at && data.updated_at === ultimoUpdatedAtRef.current) return;
      ultimoUpdatedAtRef.current = data.updated_at || null;
      const a = data.placar_time_a ?? 0;
      const b = data.placar_time_b ?? 0;
      setPlacarA(prev => (prev !== a ? a : prev));
      setPlacarB(prev => (prev !== b ? b : prev));
      if (data.periodos) setPeriodo(prev => (prev !== data.periodos ? data.periodos : prev));

      // Cronômetro compartilhado: aplica timer_end_at do banco neste celular.
      // Sem isso o placar atualiza e o tempo fica zerado no segundo aparelho.
      aplicarTimerDoBanco(data.timer_end_at);
    } catch (e) {
      /* silencioso: é só uma conferência */
    }
  }

  // Lê timer_end_at e alinha tempo + play/pause locais (sem reescrever o banco).
  function aplicarTimerDoBanco(timerEndAt) {
    const iso = timerEndAt || null;
    if (iso === timerEndAtIsoRef.current) return;
    timerEndAtIsoRef.current = iso;

    if (iso) {
      const restante = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
      timerEndAtRef.current = new Date(iso).getTime();
      ignorarProximoWriteTimerRef.current = true;
      setTempo(restante);
      setTimerAtivo(restante > 0);
      if (restante <= 0) {
        timerEndAtIsoRef.current = null;
      }
    } else {
      // Outro celular pausou (ou ainda não iniciou). Só para se este aparelho
      // estava rodando por causa do remoto — não zera o tempo exibido.
      timerEndAtRef.current = null;
      ignorarProximoWriteTimerRef.current = true;
      setTimerAtivo(false);
    }
  }

  // Abre uma partida da lista no placar (nomes, escalação e cronômetro certos).
  // É o caminho do segundo celular operar a partida: "Retomar Partida".
  async function abrirPartida(p) {
    if (!p) return;
    setPartidaAtiva(p);
    setPlacarA(p.placar_time_a || 0);
    setPlacarB(p.placar_time_b || 0);
    setPeriodo(p.periodos || 1);
    setTimeANome(p.time_a);
    setTimeBNome(p.time_b);
    ultimoUpdatedAtRef.current = p.updated_at || null;
    primeiroSyncRef.current = true;
    ultimoToqueLocalRef.current = 0;
    let parsedDur = 10;
    const savedDur = localStorage.getItem(`duracao_${p.id}`);
    if (savedDur) parsedDur = parseInt(savedDur);
    else if (p.tempo_total) {
      const partes = p.tempo_total.split(':');
      if (partes.length === 2 && parseInt(partes[0]) * 60 + parseInt(partes[1]) > 600) parsedDur = 12;
    }
    setDuracaoQuarto(parsedDur);
    try {
      const { data: roster } = await partidasAPI.obterJogadoresDaPartida(p.id);
      if (roster) {
        setTimeAJogadores(roster.filter(r => r.time === 'A').map(r => r.jogador_id));
        setTimeBJogadores(roster.filter(r => r.time === 'B').map(r => r.jogador_id));
        const map = {};
        roster.forEach((r) => {
          map[r.jogador_id] = {
            time: r.time,
            pontos: r.pontos || 0,
            assistencias: r.assistencias || 0,
            rebotes: r.rebotes || 0,
            turnovers: r.turnovers || 0,
            faltas: r.faltas || 0,
          };
        });
        setBoxScore(map);
      }
      setModoMesa(false);
      setMesaUndo([]);
    } catch (e) {
      /* silencioso */
    }
    // Cronômetro compartilhado: se o outro celular deixou o timer rodando,
    // este aparelho continua de onde parou (sem precisar lembrar de apertar ▶).
    if (p.timer_end_at) {
      const endMs = new Date(p.timer_end_at).getTime();
      const restante = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
      timerEndAtRef.current = endMs;
      timerEndAtIsoRef.current = p.timer_end_at;
      ignorarProximoWriteTimerRef.current = true;
      if (restante > 0) {
        setTempo(restante);
        setTimerAtivo(true);
      } else {
        setTempo(0);
        setTimerAtivo(false);
      }
    } else {
      const localStateStr = localStorage.getItem(`timer_${p.id}`);
      if (localStateStr) {
        try {
          const localState = JSON.parse(localStateStr);
          let t = localState.tempo;
          const ativo = localState.timerAtivo;
          if (ativo && localState.lastUpdated) {
            t = Math.max(0, t - Math.floor((Date.now() - localState.lastUpdated) / 1000));
          }
          setTempo(t);
          setTimerAtivo(ativo);
        } catch (e) {
          setTempo(parsedDur * 60);
          setTimerAtivo(false);
        }
      } else if (p.tempo_total) {
        const partes = p.tempo_total.split(':');
        if (partes.length === 2) setTempo(parseInt(partes[0]) * 60 + parseInt(partes[1]));
        setTimerAtivo(false);
      } else {
        setTempo(parsedDur * 60);
        setTimerAtivo(false);
      }
    }
    setTela('partida');
  }

  // Reabrir partida encerrada por engano (só quem criou).
  async function handleReabrirPartida(p) {
    if (!p) return;
    if (!window.confirm('Reabrir esta partida? Ela volta para "Em andamento" com o mesmo placar e você continua de onde parou.')) return;
    setSalvando(true);
    const { error } = await partidasAPI.atualizar(p.id, { status: 'ativo' });
    setSalvando(false);
    if (error) {
      showToast(error.message || 'Não foi possível reabrir a partida.', 'error');
      return;
    }
    setDetalhe(null);
    showToast('Partida reaberta! Ela está de volta em "Em andamento".', 'success');
    await recarregarPartidas();
    setAba('jogos');
    setTela('lista');
  }

  useEffect(() => {
    if (tela !== 'partida' || !partidaAtiva?.id) {
      setOperadores([]);
      return;
    }
    const id = partidaAtiva.id;
    carregarOperadores(id);
    // Aviso do banco quando alguém pede / o criador responde / a partida é encerrada.
    const channel = assinarAviso(`partida_${id}`, () => {
      carregarOperadores(id);
      puxarPlacarDoBanco(id);
    });
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela, partidaAtiva?.id]);

  // Sem depender do aviso do banco: confere no banco o que o OUTRO celular fez.
  // O placar é conferido de 2 em 2 segundos (é o que o usuário vê mudando);
  // o aceite de operador, de 6 em 6 (não precisa ser tão rápido).
  useEffect(() => {
    if (tela !== 'partida' || !partidaAtiva?.id) return;
    finalizandoRef.current = false; // partida nova em tela: libera o marcador
    const id = partidaAtiva.id;
    const intervaloPlacar = setInterval(() => { if (!document.hidden) puxarPlacarDoBanco(id); }, 2000);
    const intervaloOperadores = setInterval(() => { if (!document.hidden) carregarOperadores(id); }, 6000);
    // Voltou para o app: confere na hora, sem esperar o próximo ciclo.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') {
        puxarPlacarDoBanco(id);
        carregarOperadores(id);
      }
    };
    document.addEventListener('visibilitychange', aoVoltar);
    // Caminho instantâneo: se as tabelas estiverem ligadas no Realtime
    // (`alter publication supabase_realtime add table ...`), o placar e o
    // aceite chegam na hora. Sem isso, a conferência acima cobre.
    const canalLinha = supabase
      .channel(`partida_linha_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidas', filter: `id=eq.${id}` }, () => puxarPlacarDoBanco(id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partida_operadores', filter: `partida_id=eq.${id}` }, () => carregarOperadores(id))
      .subscribe();
    return () => {
      clearInterval(intervaloPlacar);
      clearInterval(intervaloOperadores);
      document.removeEventListener('visibilitychange', aoVoltar);
      supabase.removeChannel(canalLinha);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela, partidaAtiva?.id]);

  // Na lista de Rachões: os pedidos que EU (criador) preciso responder.
  // Sem isso o aviso só aparecia dentro da tela da partida — e quem não
  // estava nela via a notificação sem ter onde aceitar.
  useEffect(() => {
    if (tela !== 'lista' || aba !== 'jogos') return;
    carregarPedidosCriador();
    const recarregarTudo = () => { recarregarPartidas(); carregarPedidosCriador(); };
    const meus = partidas.filter(p => p.criado_por === profile?.id);
    const canais = meus.map(p => assinarAviso(`partida_${p.id}`, recarregarTudo));
    // E, para não depender de aviso nenhum: a lista se atualiza sozinha.
    // 5s quando existe partida em andamento na lista (é quando o pedido de
    // operador precisa chegar logo e o placar do outro precisa aparecer);
    // 30s quando não há nada em andamento, para não gastar à toa.
    const intervalo = setInterval(() => { if (!document.hidden) recarregarTudo(); }, partidas.length > 0 ? 5000 : 30000);
    const aoVoltarVisivel = () => { if (document.visibilityState === 'visible') recarregarTudo(); };
    document.addEventListener('visibilitychange', aoVoltarVisivel);
    // Caminho instantâneo para o pedido de operador (se a tabela estiver
    // ligada no Realtime). Sem isso, a conferência de 5s cobre.
    const canalPedidos = supabase
      .channel('pedidos_operador_lista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partida_operadores' }, recarregarTudo)
      .subscribe();
    return () => {
      canais.forEach(c => supabase.removeChannel(c));
      supabase.removeChannel(canalPedidos);
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltarVisivel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela, aba, partidas.length]);

  async function handlePedirOperar() {
    if (!partidaAtiva) return;
    setPedindoOperar(true);
    const { data, error } = await partidasAPI.pedirOperar(partidaAtiva.id);
    setPedindoOperar(false);
    if (error || !data?.sucesso) {
      showToast(data?.erro || error?.message || 'Não foi possível enviar o pedido.', 'error');
      return;
    }
    if (data.dono) showToast('Você criou esta partida — já pode pontuar.', 'success');
    else if (data.ja_autorizado) showToast('Você já está autorizado a operar o placar.', 'success');
    else if (data.pendente) showToast('Seu pedido já está aguardando o criador aceitar.', 'success');
    else showToast('Pedido enviado! Aguardando o criador da partida aceitar.', 'success');
    carregarOperadores(partidaAtiva.id);
  }

  async function handleResponderPedido(partidaId, usuarioId, aceitar) {
    if (!partidaId) return;
    const { data, error } = await partidasAPI.responderPedidoOperador(partidaId, usuarioId, aceitar);
    if (error || !data?.sucesso) {
      showToast(data?.erro || error?.message || 'Não foi possível responder ao pedido.', 'error');
      return;
    }
    showToast(aceitar ? 'Placar liberado para ele.' : 'Autorização removida.', 'success');
    carregarPedidosCriador();
    if (partidaAtiva?.id === partidaId) carregarOperadores(partidaId);
  }

  // Avaliação anônima da partida (Competições)
  const [detalhe, setDetalhe] = useState(null);
  const [detalheJogadores, setDetalheJogadores] = useState([]);
  const [detalheResumo, setDetalheResumo] = useState({});
  const [minhasNotas, setMinhasNotas] = useState({});
  const [votingPlayer, setVotingPlayer] = useState(null);
  const [notaGrade, setNotaGrade] = useState(null);
  const [comentarioVoto, setComentarioVoto] = useState('');
  const [enviandoVoto, setEnviandoVoto] = useState(false);

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
  }, [esporte]);

  // Efeito do cronômetro — baseado em timestamp (não em decremento), para não
  // atrasar quando o intervalo dispara tarde ou a aba fica em segundo plano.
  // Também salva o estado no banco para o outro celular sincronizar.
  useEffect(() => {
    let interval = null;
    const eraAtivo = timerAtivoPrevRef.current;
    timerAtivoPrevRef.current = timerAtivo;

    // Sync remoto mudou timerAtivo: não reescreve o banco (senão o 2º celular
    // apagava timer_end_at ao abrir a partida com timer parado).
    if (ignorarProximoWriteTimerRef.current) {
      ignorarProximoWriteTimerRef.current = false;
      if (timerAtivo && timerEndAtRef.current) {
        interval = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));
          setTempo(remaining);
          if (remaining <= 0) setTimerAtivo(false);
        }, 1000);
      }
      return () => clearInterval(interval);
    }

    if (timerAtivo) {
      // Se já temos um fim absoluto do banco, usa ele; senão calcula a partir do tempo local.
      if (!timerEndAtRef.current || Math.abs(timerEndAtRef.current - (Date.now() + tempo * 1000)) > 2000) {
        timerEndAtRef.current = Date.now() + tempo * 1000;
      }
      const iso = new Date(timerEndAtRef.current).toISOString();
      timerEndAtIsoRef.current = iso;
      if (partidaAtiva?.id) {
        partidasAPI.atualizar(partidaAtiva.id, { timer_end_at: iso }).catch(() => {});
      }
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));
        setTempo(remaining);
        // Reafirma o fim absoluto a cada 5s (rede instável / outro aparelho)
        if (remaining > 0 && remaining % 5 === 0 && partidaAtiva?.id) {
          partidasAPI.atualizar(partidaAtiva.id, {
            timer_end_at: new Date(timerEndAtRef.current).toISOString(),
          }).catch(() => {});
        }
      }, 1000);
    } else {
      // Só grava NULL se ESTE celular pausou de verdade (play → pause).
      // Evita o 2º celular zerar o cronômetro do 1º ao montar a tela.
      if (eraAtivo && partidaAtiva?.id) {
        timerEndAtRef.current = null;
        timerEndAtIsoRef.current = null;
        partidasAPI.atualizar(partidaAtiva.id, { timer_end_at: null }).catch(() => {});
      }
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Envia o placar para o banco logo depois de cada mudança (agrupando toques
  // seguidos). Antes só salvava ao sair da tela ou no fim do quarto — por isso
  // o placar marcado num celular não aparecia no outro.
  useEffect(() => {
    if (tela !== 'partida' || !partidaAtiva?.id) return;
    if (primeiroSyncRef.current) { primeiroSyncRef.current = false; return; }
    const t = setTimeout(() => { sincronizarPlacarBanco(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placarA, placarB, tela, partidaAtiva?.id]);

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
      // 1. Jogadores só da mesma cidade do perfil (escalação da partida)
      const userCity = profile?.cidade_atual || profile?.cidade || '';
      const userUf = (profile?.uf || '').trim().toUpperCase();
      const cityNorm = normalizarCidade(userCity);

      let jogs = [];
      if (userUf) {
        const { data } = await jogadoresAPI.listarPorEstado(userUf, esporte);
        jogs = data || [];
      } else {
        const { data } = await jogadoresAPI.listar(esporte);
        jogs = data || [];
      }

      setJogadores(
        (jogs || []).filter((j) => {
          if (!cityNorm) return false; // sem cidade no perfil: não lista ninguém de fora
          const jc = normalizarCidade(j.cidade);
          if (!jc) return false; // atleta sem cidade não entra na escalação local
          if (jc !== cityNorm) return false;
          const jUf = (j.uf || '').trim().toUpperCase();
          if (userUf && jUf && jUf !== userUf) return false;
          return true;
        })
      );

      // 2. Carregar partidas
      const { data: parts } = await partidasAPI.listar(esporte);
      const todas = parts || [];
      
      const ativas = todas.filter(p => p.status === 'ativo');
      const finalizadas = todas.filter(p => p.status === 'finalizado');

      setPartidas(ativas);
      setHistorico(finalizadas);
      salvarCache('jogos', { partidas: ativas, historico: finalizadas });

      // Se EU tenho partida ativa, entra nela. Antes o app entrava na partida
      // ativa de QUALQUER pessoa — inclusive ao encerrar a sua: encerrava uma
      // e caía no placar de outra ("finalizou e não sai da página").
      const minhaAtiva = ativas.find(p => p.criado_por === profile?.id);
      if (minhaAtiva) {
        const active = minhaAtiva;
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
        cidade: profile?.cidade_atual || profile?.cidade || null,
        uf: 'PA',
        esporte: esporte
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
    if (!possoOperarPlacar) {
      showToast(
        meuPedido
          ? 'Aguardando o criador da partida aceitar seu pedido para operar o placar.'
          : 'Só quem criou a partida pontua aqui. Toque em "Pedir para operar o placar".',
        'error'
      );
      return;
    }
    ultimoToqueLocalRef.current = Date.now(); // segura o "puxar do banco" por alguns segundos
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

  // ---- Modo mesa: estatística individual ----
  async function registrarStatMesa(jogadorId, campo, delta) {
    if (!partidaAtiva || !possoOperarPlacar) {
      showToast('Só a mesa (criador ou operador) pode anotar estatísticas.', 'error');
      return;
    }
    if (mesaBusy) return;
    setMesaBusy(true);
    ultimoToqueLocalRef.current = Date.now();
    try {
      const { data, error } = await partidasAPI.ajustarStat(partidaAtiva.id, jogadorId, campo, delta);
      if (error) throw error;
      if (!data) throw new Error('Resposta vazia ao salvar estatistica');
      if (data) {
        setBoxScore((prev) => {
          const lado = data.lado_time || data.time || prev[jogadorId]?.time;
          return {
            ...prev,
            [jogadorId]: {
              time: lado,
              pontos: data.pontos ?? 0,
              assistencias: data.assistencias ?? 0,
              rebotes: data.rebotes ?? 0,
              turnovers: data.turnovers ?? 0,
              faltas: data.faltas ?? 0,
            },
          };
        });
        // Feedback visual: número da stat pisca em verde
        const flashId = Date.now();
        setMesaFlash({ jid: jogadorId, campo, id: flashId });
        setTimeout(() => {
          setMesaFlash((cur) => (cur && cur.id === flashId ? null : cur));
        }, 600);
        if (campo === 'pontos') {
          await puxarPlacarDoBanco(partidaAtiva.id);
        }
        setMesaUndo((u) => [...u.slice(-19), { jogadorId, campo, delta }]);
      }
    } catch (e) {
      console.warn(e);
      const msg = e?.message || e?.error_description || e?.hint || (typeof e === 'string' ? e : JSON.stringify(e));
      showToast(msg || 'Falha ao anotar estatistica', 'error');
    } finally {
      setMesaBusy(false);
    }
  }

  async function desfazerUltimaStatMesa() {
    const last = mesaUndo[mesaUndo.length - 1];
    if (!last) return;
    setMesaUndo((u) => u.slice(0, -1));
    await registrarStatMesa(last.jogadorId, last.campo, -last.delta);
    // registrarStatMesa adds to undo again — pop the reverse
    setMesaUndo((u) => u.slice(0, -1));
  }

  function statsDoJogador(id) {
    return boxScore[id] || { pontos: 0, assistencias: 0, rebotes: 0, turnovers: 0, faltas: 0 };
  }

  // Salva o placar atualizado no Supabase em segundo plano
  async function sincronizarPlacarBanco(finalScore = {}) {
    if (!partidaAtiva) return;
    const pA = finalScore.placar_time_a ?? placarA;
    const pB = finalScore.placar_time_b ?? placarB;
    const currentPeriod = finalScore.periodos ?? periodo;
    const timeFormatted = finalScore.tempo_total ?? formatTempo(tempo);

    const { data, error } = await partidasAPI.atualizar(partidaAtiva.id, {
      placar_time_a: pA,
      placar_time_b: pB,
      periodos: currentPeriod,
      tempo_total: timeFormatted
    });
    if (error) {
      console.warn('Placar não salvou:', error.message);
      showToast('O placar não está sendo salvo. Confira sua autorização nesta partida.', 'error');
      return;
    }
    // Guarda a versão que EU acabei de gravar, para não reprocessar o meu próprio envio.
    if (data?.updated_at) ultimoUpdatedAtRef.current = data.updated_at;
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
    finalizandoRef.current = true; // quem encerrou foi este aparelho

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
      recarregarPartidas(); // recarrega as listas SEM abrir outra partida
    } catch (e) {
      console.error(e);
      showToast('Erro ao finalizar jogo', 'error');
    } finally {
      setSalvando(false);
    }
  }

  // ============================================================
  // Avaliação anônima da partida (Competições)
  // ============================================================
  async function abrirDetalhe(p) {
    setDetalhe(p);
    setDetalheJogadores([]);
    setDetalheResumo({});
    setMinhasNotas({});
    try {
      const { data: roster } = await supabase
        .from('partida_jogadores')
        .select('id, jogador_id, time, pontos, assistencias, rebotes, turnovers, faltas, jogador:jogadores(nome, apelido, foto_url, posicao)')
        .eq('partida_id', p.id);
      setDetalheJogadores(roster || []);

      const [{ data: resumo }, { data: minhas }] = await Promise.all([
        notasJogoAPI.resumo({ partidaId: p.id }),
        notasJogoAPI.minhas({ partidaId: p.id }),
      ]);
      setDetalheResumo(Object.fromEntries((resumo || []).map((r) => [r.jogador_id, r])));
      setMinhasNotas(Object.fromEntries((minhas || []).map((m) => [m.jogador_id, m])));
    } catch (e) {
      console.error('Erro ao abrir partida:', e);
    }
  }

  function abrirAvaliacao(j) {
    const anterior = minhasNotas[j.jogador_id];
    setVotingPlayer({
      id: j.jogador_id,
      nome: j.jogador?.nome || 'Atleta',
      apelido: j.jogador?.apelido || null,
    });
    setNotaGrade(anterior ? gradePorValor(anterior.nota) : null);
    setComentarioVoto(anterior?.comentario || '');
  }

  async function handleSubmitNota(e) {
    e.preventDefault();
    const grade = GRADES.find((g) => g.key === notaGrade);
    if (!grade) {
      showToast('Escolha a nota da partida (A+ a D/F)', 'error');
      return;
    }
    setEnviandoVoto(true);
    try {
      const { data, error } = await notasJogoAPI.salvar({
        jogadorId: votingPlayer.id,
        nota: grade.valor,
        partidaId: detalhe.id,
        comentario: comentarioVoto.trim() || null,
      });
      if (error || !data?.sucesso) {
        throw new Error(data?.erro || error?.message || 'Erro ao registrar nota.');
      }
      setMinhasNotas((prev) => ({
        ...prev,
        [votingPlayer.id]: { jogador_id: votingPlayer.id, nota: grade.valor, comentario: comentarioVoto.trim() || null },
      }));
      const { data: resumo } = await notasJogoAPI.resumo({ partidaId: detalhe.id });
      setDetalheResumo(Object.fromEntries((resumo || []).map((r) => [r.jogador_id, r])));
      showToast(`Nota ${grade.key} registrada (anônima)`);
      setVotingPlayer(null);
    } catch (err) {
      showToast(err.message || 'Erro ao avaliar', 'error');
    } finally {
      setEnviandoVoto(false);
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

  const gradeAtual = gradeInfo(notaGrade);

  return (
    <div className="page-content home-page" style={{ position: 'relative' }}>
      {/* TELA 1: LISTAGEM DE PARTIDAS / HISTÓRICO */}
      {tela === 'lista' && (
        <div className="home-container" style={{ padding: '16px 16px 0', position: 'relative', zIndex: 1 }}>
          {/* Header + tabs na mesma lógica visual */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 className="page-title" style={{ fontSize: 'var(--fs-lg)' }}>
                  Competições
                </h2>
                <p className="page-sub">
                  {aba === 'torneios' ? 'Torneios da região' : aba === 'historico' ? 'Partidas finalizadas' : 'Partidas em andamento'}
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (aba === 'torneios') setShowCriarTorneio(true);
                  else setTela('novo');
                }}
                style={{ flexShrink: 0 }}
              >
                <IconMais size={16} color="currentColor" />
                {aba === 'torneios' ? 'Novo torneio' : 'Novo jogo'}
              </button>
            </div>

            <div className="tabs-row">
              <button type="button" className={`tab ${aba === 'jogos' ? 'active' : ''}`} onClick={() => setAba('jogos')}>
                Partidas
              </button>
              <button type="button" className={`tab ${aba === 'historico' ? 'active' : ''}`} onClick={() => setAba('historico')}>
                Histórico
                {historico.length > 0 && <span className="tab-badge">{historico.length}</span>}
              </button>
              <button type="button" className={`tab ${aba === 'torneios' ? 'active' : ''}`} onClick={() => setAba('torneios')}>
                Torneios
              </button>
            </div>
          </div>

          {/* Renderização conforme Aba */}
          {aba === 'torneios' ? (
            <Torneios profile={profile} isNested={true} openCriar={showCriarTorneio} onOpenCriarChange={setShowCriarTorneio} />
          ) : loading && partidas.length === 0 && historico.length === 0 ? (
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
              {/* Pedidos de placar compartilhado que EU (criador) preciso responder */}
              {pedidosCriador.length > 0 && (
                <div className="card" style={{ padding: '8px 12px', marginBottom: 12, border: '1px solid var(--accent-line)', background: 'var(--accent-soft)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pedidos para operar o placar
                  </div>
                  {pedidosCriador.map(p => {
                    const pv = partidas.find(x => x.id === p.partida_id);
                    return (
                      <div key={`${p.partida_id}-${p.usuario_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.nome || 'Um atleta'}{pv ? ` · ${pv.time_a} x ${pv.time_b}` : ''}
                        </span>
                        <button onClick={() => handleResponderPedido(p.partida_id, p.usuario_id, true)} style={{ background: 'var(--accent)', color: 'var(--accent-on)', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Aceitar
                        </button>
                        <button onClick={() => handleResponderPedido(p.partida_id, p.usuario_id, false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Recusar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {partidas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--text-secondary)' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginTop: 8, fontFamily: "'Inter',sans-serif", fontSize: 17, fontWeight: 700 }}>Nenhuma partida ativa</h3>
                  <p style={{ fontSize: 13, margin: '8px 0 0', fontFamily: "'Inter',sans-serif", color: 'var(--text-muted)' }}>
                    Toque em <strong style={{ color: 'var(--accent)' }}>Novo Jogo</strong> acima para começar
                  </p>
                </div>
              ) : (
                <div className="responsive-card-grid">
                  {partidas.map((p, i) => (
                    <div key={p.id} className="card card-enter" style={{ display: 'flex', flexDirection: 'column', gap: 8, animationDelay: `${i * 30}ms` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ background: 'var(--success-soft)', color: 'var(--success-text)', padding: '4px 8px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>EM ANDAMENTO</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'center', gap: 16, margin: '6px 0' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 17 }}>{p.time_a}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{p.placar_time_a}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: 17, color: 'var(--text-muted)', fontWeight: 800 }}>x</div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 17 }}>{p.time_b}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{p.placar_time_b}</div>
                        </div>
                      </div>
                      <button className="btn btn-primary" onClick={() => abrirPartida(p)}>
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
                      <div key={p.id} className="card card-enter" onClick={() => abrirDetalhe(p)} style={{ borderLeft: `4px solid ${venceA ? 'var(--success-text)' : venceB ? '#f87171' : '#64748b'}`, animationDelay: `${i * 30}ms`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span>{p.cidade} • {p.uf}</span>
                          <span>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: venceA ? 800 : 500, color: venceA ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.time_a}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>
                            <span style={{ color: venceA ? 'var(--success-text)' : 'var(--text-primary)' }}>{p.placar_time_a}</span>
                            <span style={{ color: 'var(--text-muted)' }}>x</span>
                            <span style={{ color: venceB ? 'var(--success-text)' : 'var(--text-primary)' }}>{p.placar_time_b}</span>
                          </div>
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <span style={{ fontWeight: venceB ? 800 : 500, color: venceB ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.time_b}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
                          <span>Duração: {p.tempo_total} · {p.periodos} períodos</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Avaliar quem jogou →</span>
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
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Configurar Partida</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>Configure as equipes e a lista de atletas antes de iniciar o cronômetro.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Input nomes dos times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome Time A *</label>
                <input
                  value={timeANome}
                  onChange={e => setTimeANome(e.target.value)}
                  placeholder="Ex: Time Azul"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome Time B *</label>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 15, color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="duracaoQuarto"
                    checked={duracaoQuarto === 10}
                    onChange={() => setDuracaoQuarto(10)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                  />
                  10 minutos
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 15, color: 'var(--text-primary)' }}>
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
              <label style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, display: 'block', marginBottom: 4 }}>Escalar Jogadores</label>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Distribua os jogadores entre as duas equipes:</p>
              
              <div style={{ maxHeight: '50vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px' }}>
                {jogadores.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Cadastre jogadores na aba Jogadores antes.</p>
                ) : (
                  jogadores.map(j => {
                    const noA = timeAJogadores.includes(j.id);
                    const noB = timeBJogadores.includes(j.id);
                    return (
                      <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{nomeAtleta(j)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {[
                              nomeCompletoAtleta(j) && nomeCompletoAtleta(j) !== nomeAtleta(j) ? nomeCompletoAtleta(j) : null,
                              j.posicao,
                            ].filter(Boolean).join(' • ')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => togglePlayer(j.id, 'A')}
                            className={`btn btn-sm ${noA ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ background: noA ? 'var(--accent)' : 'transparent', color: noA ? 'var(--accent-on)' : 'var(--text-secondary)', border: noA ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                          >
                            Time A
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePlayer(j.id, 'B')}
                            className={`btn btn-sm ${noB ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ background: noB ? '#ef4444' : 'transparent', color: noB ? '#fff' : 'var(--text-secondary)', border: noB ? '1px solid #ef4444' : '1px solid var(--border)' }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', padding: '0 4px' }}>
              <span>{timeANome}: <strong>{timeAJogadores.length} jogadores</strong></span>
              <span>{timeBNome}: <strong>{timeBJogadores.length} jogadores</strong></span>
            </div>

            {/* Botões do Wizard */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: 'inherit',
                padding: 0
              }}
            >
              ← PLACAR AO VIVO
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {periodo >= 5 ? 'PRORROGAÇÃO' : `${periodo}º QUARTO`}
              </span>
              <span style={{ background: '#EF4444', color: '#FFF', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                AO VIVO
              </span>
            </div>
          </div>

          {/* Placar compartilhado: quem pode pontuar (pedido + aceite) */}
          {partidaAtiva.status === 'ativo' && (
            <div className="card" style={{
              padding: '8px 12px',
              marginBottom: 12,
              background: possoOperarPlacar ? 'var(--bg-card)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${possoOperarPlacar ? 'var(--border)' : 'rgba(239,68,68,0.35)'}`,
              borderRadius: 10
            }}>
              {souCriadorPartida ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Placar compartilhado · {operadoresAprovados.length > 0 ? `${operadoresAprovados.length} autorizado${operadoresAprovados.length > 1 ? 's' : ''}` : 'só você pontua'}
                  </div>

                  {pedidosPendentes.map(p => (
                    <div key={p.usuario_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nome || 'Um atleta'} quer operar o placar
                      </span>
                      <button onClick={() => handleResponderPedido(partidaAtiva.id, p.usuario_id, true)} style={{ background: 'var(--accent)', color: 'var(--accent-on)', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Aceitar
                      </button>
                      <button onClick={() => handleResponderPedido(partidaAtiva.id, p.usuario_id, false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Recusar
                      </button>
                    </div>
                  ))}

                  {pedidosPendentes.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                      Quem quiser ajudar a pontuar pede pelo app e você decide aqui.
                    </div>
                  )}

                  {operadoresAprovados.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {operadoresAprovados.map(o => (
                        <button key={o.usuario_id} onClick={() => handleResponderPedido(partidaAtiva.id, o.usuario_id, false)} title="Remover autorização" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-line)', borderRadius: 20, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {o.nome || 'Um atleta'} ✕
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : possoOperarPlacar ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success-text)' }}>
                  O criador liberou: você pode pontuar neste placar
                </div>
              ) : meuPedido ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Pedido enviado — aguardando o criador da partida aceitar
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
                    Só quem criou a partida pontua neste placar.
                  </span>
                  <button onClick={handlePedirOperar} disabled={pedindoOperar} style={{ background: 'var(--accent)', color: 'var(--accent-on)', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 800, cursor: pedindoOperar ? 'default' : 'pointer', fontFamily: 'inherit', opacity: pedindoOperar ? 0.6 : 1 }}>
                    {pedindoOperar ? 'Enviando...' : 'Pedir para operar'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cronômetro visor (Mockup style: Large and Centered at the top) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 12
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
            padding: '12px 12px',
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
                background: 'var(--accent-soft)',
                border: '2px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 1 0 20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <span style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: 800, color: 'var(--counter-btn-a-color)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700 }}>
              VS
            </div>

            {/* Time B Name & Score */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
              <div style={{
                width: 'clamp(32px, 8vw, 40px)',
                height: 'clamp(32px, 8vw, 40px)',
                borderRadius: '50%',
                background: 'rgba(76,201,240,0.07)',
                border: '2px solid var(--counter-btn-b-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--counter-btn-b-color)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 1 0 20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <span style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: 800, color: 'var(--counter-btn-b-color)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
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
            padding: '8px 8px',
            marginBottom: 12,
            overflowX: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 600 }}>TIME</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Q1</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Q2</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Q3</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>Q4</th>
                  {periodo >= 5 && <th style={{ padding: '8px 4px', fontWeight: 600 }}>PR</th>}
                  <th style={{ padding: '8px 4px', fontWeight: 800, color: 'var(--text-primary)' }}>T</th>
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
                  padding: '8px',
                  background: 'var(--card-team-a-bg)',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Fim do {periodo}º Quarto
                  </h3>
                  <button onClick={comecarProximoPeriodo} style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-on)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
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
                  padding: '8px',
                  background: 'var(--card-team-b-bg)',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Jogo Empatado!
                  </h3>
                  <button onClick={comecarProximoPeriodo} style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-on)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
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
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#EF4444', marginBottom: 4 }}>
                    Partida Encerrada
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    O tempo regulamentar acabou. Registre o MVP e encerre no botão abaixo.
                  </p>
                </div>
              )}
            </div>
          )}

          
          {/* ===== MODO MESA — box score ===== */}
          <div className="mesa-panel">
            <div className="mesa-panel-head" style={{ marginBottom: modoMesa ? 4 : 0 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Modo mesa</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Marque por jogador · pontos separados das outras stats
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModoMesa((v) => !v)}
                style={{
                  border: 'none', borderRadius: 999, padding: '8px 12px', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: modoMesa ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: modoMesa ? 'var(--accent-on)' : 'var(--text-primary)' }}
              >
                {modoMesa ? 'Mesa ativa' : 'Abrir mesa'}
              </button>
            </div>

            {modoMesa && (
              <>
                {!possoOperarPlacar && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Você pode ver o box score. Para anotar, peça para operar o placar.
                  </p>
                )}
                {possoOperarPlacar && mesaUndo.length > 0 && (
                  <button
                    type="button"
                    onClick={desfazerUltimaStatMesa}
                    disabled={mesaBusy}
                    style={{
                      marginBottom: 12, width: '100%', padding: '8px 0', borderRadius: 999,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Desfazer última anotação
                  </button>
                )}

                {['A', 'B'].map((tm) => {
                  const ids = tm === 'A' ? timeAJogadores : timeBJogadores;
                  const nomeTime = tm === 'A' ? timeANome : timeBNome;
                  return (
                    <div key={tm} style={{ marginBottom: 12 }}>
                      <div className="mesa-team-label">{nomeTime}</div>
                      {ids.length === 0 && (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhum jogador neste time</p>
                      )}
                      {ids.map((jid) => {
                        const j = jogadores.find((x) => x.id === jid);
                        const st = statsDoJogador(jid);
                        const nome = j ? (j.apelido || j.nome || 'Atleta') : 'Atleta';
                        const foto = j?.foto_url || null;
                        const inicial = (nome || '?').charAt(0).toUpperCase();
                        const chips = [
                          { campo: 'pontos', label: 'PTS', val: st.pontos },
                          { campo: 'assistencias', label: 'AST', val: st.assistencias },
                          { campo: 'rebotes', label: 'REB', val: st.rebotes },
                          { campo: 'turnovers', label: 'TO', val: st.turnovers },
                          { campo: 'faltas', label: 'F', val: st.faltas },
                        ];
                        return (
                          <div key={jid} className="mesa-player">
                            <div className="mesa-player-top">
                              {foto ? (
                                <img
                                  src={foto}
                                  alt=""
                                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
                                />
                              ) : (
                                <div style={{
                                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                  background: 'var(--accent-soft)', color: 'var(--accent-text)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 800, fontSize: 15, border: '1px solid var(--accent-line)' }}>
                                  {inicial}
                                </div>
                              )}
                              <div className="mesa-player-name">{nome}</div>
                            </div>

                            <div className="mesa-chips">
                              {chips.map((s) => {
                                const flash = mesaFlash && mesaFlash.jid === jid && mesaFlash.campo === s.campo;
                                return (
                                  <span
                                    key={flash ? `${s.campo}-${mesaFlash.id}` : s.campo}
                                    className={`mesa-chip${flash ? ' is-flash' : ''}`}
                                  >
                                    <strong>{s.val}</strong> {s.label}
                                  </span>
                                );
                              })}
                            </div>

                            {possoOperarPlacar && (
                              <div className="mesa-actions">
                                <div className="mesa-actions-label">Pontos</div>
                                <div className="mesa-actions-row">
                                  {[
                                    { label: '+1', campo: 'pontos', d: 1 },
                                    { label: '+2', campo: 'pontos', d: 2 },
                                    { label: '+3', campo: 'pontos', d: 3 },
                                  ].map((b) => (
                                    <button
                                      key={b.label}
                                      type="button"
                                      className="mesa-btn"
                                      disabled={mesaBusy}
                                      onClick={() => registrarStatMesa(jid, b.campo, b.d)}
                                    >
                                      {b.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="mesa-actions-label">Outras</div>
                                <div className="mesa-actions-row">
                                  {[
                                    { label: 'AST', campo: 'assistencias', d: 1 },
                                    { label: 'REB', campo: 'rebotes', d: 1 },
                                    { label: 'TO', campo: 'turnovers', d: 1 },
                                    { label: 'F', campo: 'faltas', d: 1 },
                                  ].map((b) => (
                                    <button
                                      key={b.label}
                                      type="button"
                                      className="mesa-btn mesa-btn--muted"
                                      disabled={mesaBusy}
                                      onClick={() => registrarStatMesa(jid, b.campo, b.d)}
                                    >
                                      {b.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>


          {/* Controles de Pontuação Rápidos (Botoes + / -) */}
          <div className="live-game-controls-grid">
            {/* Controles Time A */}
            <div style={{
              padding: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--accent-line)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                + Pontuar {timeANome.substring(0,6)}
              </span>
              <div className="score-btns">
                <button type="button" className="score-btn score-btn--a1" onClick={() => ajustarPlacar('A', 1)}>+1</button>
                <button type="button" className="score-btn score-btn--a2" onClick={() => ajustarPlacar('A', 2)}>+2</button>
                <button type="button" className="score-btn score-btn--a3" onClick={() => ajustarPlacar('A', 3)}>+3</button>
              </div>
              <div className="score-btns">
                <button type="button" className="score-btn score-btn--neg" onClick={() => ajustarPlacar('A', -1)}>-1</button>
                <button type="button" className="score-btn score-btn--neg" onClick={() => ajustarPlacar('A', -2)}>-2</button>
              </div>
            </div>

            {/* Controles Time B */}
            <div style={{
              padding: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--accent-line)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                + Pontuar {timeBNome.substring(0,6)}
              </span>
              <div className="score-btns">
                <button type="button" className="score-btn score-btn--b1" onClick={() => ajustarPlacar('B', 1)}>+1</button>
                <button type="button" className="score-btn score-btn--b2" onClick={() => ajustarPlacar('B', 2)}>+2</button>
                <button type="button" className="score-btn score-btn--b3" onClick={() => ajustarPlacar('B', 3)}>+3</button>
              </div>
              <div className="score-btns">
                <button type="button" className="score-btn score-btn--neg" onClick={() => ajustarPlacar('B', -1)}>-1</button>
                <button type="button" className="score-btn score-btn--neg" onClick={() => ajustarPlacar('B', -2)}>-2</button>
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
            padding: '12px 16px',
            marginBottom: 16
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
                fontSize: '17px',
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
                color: 'var(--accent-on)',
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
            >
              {timerAtivo ? '⏸' : '▶'}
            </button>

            {/* Next/Finish Button */}
            <button 
              onClick={() => {
                setTimerAtivo(false);
                // Enquanto o jogo PODE continuar (1º ao 4º quarto, ou empate),
                // ⏭ só pula o tempo do quarto. Antes, quando o cronômetro já
                // estava em 00:00 (fim de quarto), este botão abria o modal de
                // ENCERRAR a partida — e era fácil encerrar sem querer.
                if (periodo < 4 || placarA === placarB) {
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
                fontSize: '17px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Pular o tempo do quarto"
            >
              ⏭
            </button>
          </div>

          {/* Botão de Finalizar Partida */}
          <button 
            onClick={() => { setTimerAtivo(false); setShowFinalizarModal(true); }} 
            style={{
              width: '100%',
              padding: '12px',
              background: '#EF4444',
              color: '#FFF',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '15px',
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
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Finalizar Jogo</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>Deseja mesmo encerrar a partida? O placar acumulado e estatísticas serão registrados de forma definitiva. Se encerrar por engano, dá para reabrir depois (histórico → Reabrir partida).</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Eleger MVP da Partida (Opcional)</label>
                <select value={mvpId} onChange={e => setMvpId(e.target.value)} style={{ color: mvpId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <option value="">Selecione o MVP...</option>
                  {getEscalados().map(j => (
                    <option key={j.id} value={j.id}>{nomeAtleta(j)} ({timeAJogadores.includes(j.id) ? timeANome : timeBNome})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowFinalizarModal(false)} style={{ flex: 1 }}>Voltar</button>
              <button className="btn btn-primary" onClick={handleFinalizarJogo} disabled={salvando} style={{ flex: 2, background: 'var(--success)', border: 'none' }}>
                {salvando ? <><div className="spinner" /> Salvando...</> : 'Confirmar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalhe && (
        <div className="modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 900, textAlign: 'center', marginBottom: 4 }}>
              {detalhe.time_a} {detalhe.placar_time_a} <span style={{ color: 'var(--text-muted)' }}>x</span> {detalhe.placar_time_b} {detalhe.time_b}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
              {new Date(detalhe.created_at).toLocaleDateString('pt-BR')} · {detalhe.cidade}
            </p>

            {/* Encerrou por engano? Só quem criou a partida pode reabrir. */}
            {detalhe.criado_por === profile?.id && (
              <button
                className="btn btn-secondary"
                onClick={() => handleReabrirPartida(detalhe)}
                disabled={salvando}
                style={{ width: '100%', marginBottom: 12 }}
              >
                ↺ Reabrir partida (encerrada por engano)
              </button>
            )}

            {/* Box score da mesa (se houver anotação) */}
            {detalheJogadores.some(j => (j.pontos || j.assistencias || j.rebotes || j.turnovers || j.faltas)) && (
              <div className="card" style={{ marginBottom: 12, padding: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Box score
                </div>
                {['A', 'B'].map((tm) => {
                  const rows = detalheJogadores.filter((j) => j.time === tm);
                  if (!rows.length) return null;
                  const nomeT = tm === 'A' ? detalhe.time_a : detalhe.time_b;
                  return (
                    <div key={tm} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>{nomeT}</div>
                      {rows
                        .slice()
                        .sort((a, b) => (b.pontos || 0) - (a.pontos || 0))
                        .map((j) => (
                          <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 600 }}>{nomeAtleta(j.jogador)}</span>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                              {j.pontos || 0}/{j.assistencias || 0}/{j.rebotes || 0}
                            </span>
                          </div>
                        ))}
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>PTS / AST / REB</div>
              </div>
            )}

            <div className="section-title">Quem jogou — avaliar</div>
            <LegendaRendimento />
            <div className="card" style={{ marginBottom: 12 }}>
              {detalheJogadores.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhum jogador escalado nesta partida.</div>
              ) : (
                detalheJogadores.map((j) => {
                  const nome = nomeAtleta(j.jogador);
                  const resumo = detalheResumo[j.jogador_id];
                  const minha = minhasNotas[j.jogador_id];
                  const souEu = profile?.player_id === j.jogador_id;
                  const temBox = (j.pontos || j.assistencias || j.rebotes || j.turnovers || j.faltas);
                  return (
                    <div key={j.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span className="badge" style={{ minWidth: 20, textAlign: 'center' }}>{j.time}</span>
                      {j.jogador?.foto_url ? (
                        <img src={j.jogador.foto_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{nome.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div>
                        {temBox ? (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>
                            {j.pontos || 0} PTS · {j.assistencias || 0} AST · {j.rebotes || 0} REB · {j.turnovers || 0} TO · {j.faltas || 0} F
                          </div>
                        ) : null}
                        <div style={{ marginTop: 4 }}>
                          <RendimentoPill media={resumo?.media} total={resumo?.total} showLabel />
                        </div>
                      </div>
                      {!souEu && (
                        <button
                          className={`btn ${minha ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                          disabled={enviandoVoto}
                          onClick={() => abrirAvaliacao(j)}
                        >
                          {minha ? `${gradePorValor(minha.nota)}` : 'Avaliar'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              As notas são <strong>anônimas</strong>: ninguém vê quem avaliou quem. O <strong>semáforo</strong> mostra só o resultado do grupo.
            </p>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setDetalhe(null)}>Fechar</button>
          </div>
        </div>
      )}

      {votingPlayer && (
        <div className="modal-overlay" onClick={() => { if (!enviandoVoto) setVotingPlayer(null); }}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>
              Nota da partida de {votingPlayer.apelido || votingPlayer.nome}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
              Como ele jogou? Sua resposta é anônima.
            </p>
            <form onSubmit={handleSubmitNota} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <GradePicker value={notaGrade} onChange={setNotaGrade} disabled={enviandoVoto} />

              {gradeAtual ? (
                <div style={{
                  marginTop: 12, padding: '12px 12px', borderRadius: 12,
                  background: 'var(--bg-card)', border: `1px solid ${gradeAtual.line}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontSize: 36, fontWeight: 900, lineHeight: 1,
                      fontFamily: "'Barlow Condensed', sans-serif", color: gradeAtual.cor }}>
                      {gradeAtual.key}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{gradeAtual.titulo}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{gradeAtual.desc}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                  Toque em uma letra para ver o que ela significa.
                </p>
              )}

              <input
                type="text"
                maxLength="200"
                value={comentarioVoto}
                onChange={(e) => setComentarioVoto(e.target.value)}
                placeholder="Comentário (opcional)"
                disabled={enviandoVoto}
                style={{ marginTop: 4 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setVotingPlayer(null)} disabled={enviandoVoto}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={enviandoVoto || !notaGrade}>
                  {enviandoVoto ? 'Enviando...' : 'Confirmar nota'}
                </button>
              </div>
            </form>
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
