import { useState, useEffect, useRef } from 'react';
import { supabase, torneiosAPI, equipesAPI, torneioJogosAPI, profilesAPI } from '../lib/supabase';

// Formatos de Torneio Traduzidos
const FORMATOS = {
  eliminatoria_simples: 'Eliminatória Simples (Mata-Mata)',
  todos_contra_todos: 'Todos Contra Todos (Pontos Corridos)',
  fase_grupos: 'Fase de Grupos + Playoffs'
};

const STATUS_TORNEIO = {
  inscricoes_abertas: { label: '🟢 Inscrições Abertas', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  inscricoes_encerradas: { label: '🟡 Aguardando Início', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  em_andamento: { label: '🔵 Em Andamento', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  finalizado: { label: '🏆 Finalizado', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
};

export default function Torneios({ profile, isNested = false }) {
  const [torneios, setTorneios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTorneio, setSelectedTorneio] = useState(null);
  
  // View states
  const [showCriar, setShowCriar] = useState(false);
  // Realtime subscriptions


  useEffect(() => {
    carregarTorneios();

    const channel = supabase
      .channel('torneios-realtime-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'torneios' }, () => {
        carregarTorneios();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarTorneios() {
    setLoading(true);
    const { data } = await torneiosAPI.listar();
    setTorneios(data || []);
    
    // Se um torneio estiver selecionado, recarrega seus dados em tempo real
    if (selectedTorneio) {
      const updated = data?.find(t => t.id === selectedTorneio.id);
      if (updated) setSelectedTorneio(updated);
    }
    setLoading(false);
  }

  return (
    <div className={isNested ? "" : "page-content"} style={isNested ? { padding: 0 } : {}}>
      {selectedTorneio ? (
        <TorneioDetalhes 
          torneio={selectedTorneio} 
          profile={profile} 
          onBack={() => { setSelectedTorneio(null); carregarTorneios(); }} 
        />
      ) : (
        <div style={{ padding: isNested ? '0' : '20px 20px 0' }}>
          {/* Header */}
          {!isNested ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue-light)" strokeWidth="2">
                    <circle cx="12" cy="8" r="7"/>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontWeight: 800, fontSize: 20 }}>Torneios Online</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Competições e campeonatos ativos</p>
                </div>
              </div>
              
              <button className="btn btn-primary btn-sm" onClick={() => setShowCriar(true)}>
                Criar Torneio
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800, fontSize: 16 }}>Torneios Regionais</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCriar(true)}>
                Criar Torneio
              </button>
            </div>
          )}

          {/* Listagem */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
              {[1, 2, 3].map(idx => (
                <div key={idx} className="skeleton" style={{ height: 130, borderRadius: '16px' }} />
              ))}
            </div>
          ) : torneios.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
              </svg>
              <h3>Nenhum torneio ativo</h3>
              <p>Crie o primeiro torneio e organize as equipes!</p>
              <button className="btn btn-primary" onClick={() => setShowCriar(true)} style={{ marginTop: 14 }}>
                Cadastrar Torneio
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
              {torneios.map((t, i) => {
                const stat = STATUS_TORNEIO[t.status] || { label: t.status, color: '#94a3b8', bg: 'rgba(0,0,0,0.1)' };
                return (
                  <div 
                    key={t.id} 
                    className="card card-enter" 
                    onClick={() => setSelectedTorneio(t)}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s', borderLeft: `4px solid ${stat.color}`, animationDelay: `${i * 30}ms` }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, background: stat.bg, color: stat.color, padding: '3px 10px', borderRadius: 50, fontWeight: 700 }}>
                        {stat.label.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(t.data_inicio).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', marginBottom: 6 }}>{t.nome}</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {t.local_quadra} {t.cidade && `(${t.cidade})`}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <span>Formato: {t.formato === 'eliminatoria_simples' ? 'Mata-Mata' : 'Pontos Corridos'}</span>
                      <span>Organizador: {t.organizador?.nome_completo?.split(' ')[0]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Criar Torneio */}
      {showCriar && (
        <CriarTorneioModal 
          profile={profile} 
          onClose={() => setShowCriar(false)} 
          onSuccess={() => { setShowCriar(false); carregarTorneios(); }} 
        />
      )}
    </div>
  );
}

// ============================================================
// MODAL: CRIAR TORNEIO
// ============================================================
function CriarTorneioModal({ profile, onClose, onSuccess }) {
  const [form, setForm] = useState({
    nome: '',
    local_quadra: '',
    data_inicio: new Date().toISOString().split('T')[0],
    horario_inicio: '19:00',
    descricao: '',
    max_equipes: 8,
    max_jogadores_por_equipe: 10,
    taxa_inscricao: 0,
    premiacao: '',
    formato: 'eliminatoria_simples'
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      if (!form.nome.trim()) throw new Error('Informe o nome do torneio.');
      if (!form.local_quadra.trim()) throw new Error('Informe o local ou quadra.');

      const payload = {
        ...form,
        cidade: profile.cidade_atual || profile.cidade || 'Altamira',
        status: 'inscricoes_abertas'
      };

      const { error } = await torneiosAPI.criar(payload);
      if (error) throw error;
      onSuccess();
    } catch (err) {
      setErro(err.message || 'Erro ao criar competição.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-handle" />
        <h3 style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>🏆 Novo Torneio</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>
          Preencha as informações básicas para iniciar as inscrições na sua cidade.
        </p>

        {erro && <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>⚠️ {erro}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome do Torneio *</label>
            <input required type="text" placeholder="Ex: Copa Altamira 2026" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Data de Início *</label>
              <input required type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Horário de Início *</label>
              <input required type="time" value={form.horario_inicio} onChange={e => setForm(p => ({ ...p, horario_inicio: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Local / Quadra *</label>
            <input required type="text" placeholder="Ex: Ginásio Municipal" value={form.local_quadra} onChange={e => setForm(p => ({ ...p, local_quadra: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Max Equipes</label>
              <select value={form.max_equipes} onChange={e => setForm(p => ({ ...p, max_equipes: parseInt(e.target.value) }))}>
                <option value="4">4 Equipes</option>
                <option value="8">8 Equipes</option>
                <option value="16">16 Equipes</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Formato</label>
              <select value={form.formato} onChange={e => setForm(p => ({ ...p, formato: e.target.value }))}>
                <option value="eliminatoria_simples">Mata-Mata Direto</option>
                <option value="todos_contra_todos">Pontos Corridos</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Taxa (R$)</label>
              <input type="number" min="0" value={form.taxa_inscricao} onChange={e => setForm(p => ({ ...p, taxa_inscricao: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Premiação</label>
              <input type="text" placeholder="Ex: R$ 500 + Troféu" value={form.premiacao} onChange={e => setForm(p => ({ ...p, premiacao: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição</label>
            <textarea rows="2" style={{ resize: 'none' }} placeholder="Detalhes do evento..." value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={salvando} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={salvando} style={{ flex: 2 }}>
              {salvando ? <div className="spinner" /> : 'Criar Torneio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// PÁGINA: DETALHES DO TORNEIO (MAIN HUB)
// ============================================================
function TorneioDetalhes({ torneio, profile, onBack }) {
  const [aba, setAba] = useState('info');
  const [equipes, setEquipes] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [statsAcumuladas, setStatsAcumuladas] = useState([]);
  const [showInscricao, setShowInscricao] = useState(false);
  const [activeConsoleJogo, setActiveConsoleJogo] = useState(null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [totalJogadores, setTotalJogadores] = useState(0);

  const isOrganizador = profile.id === torneio.organizador_id;

  useEffect(() => {
    carregarDados();

    // Inscrição Realtime dos dados deste torneio
    const channel = supabase
      .channel(`torneio-hub-${torneio.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipes', filter: `torneio_id=eq.${torneio.id}` }, () => {
        carregarDados();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'torneio_jogos', filter: `torneio_id=eq.${torneio.id}` }, () => {
        carregarDados();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneio.id, aba]);

  async function carregarDados() {
    try {
      const [{ data: eqs }, { data: matches }] = await Promise.all([
        equipesAPI.listarPorTorneio(torneio.id),
        torneioJogosAPI.listarPorTorneio(torneio.id)
      ]);
      setEquipes(eqs || []);
      setJogos(matches || []);

      const ids = (eqs || []).map(e => e.id);
      if (ids.length > 0) {
        const { count } = await supabase
          .from('equipe_jogadores')
          .select('*', { count: 'exact', head: true })
          .in('equipe_id', ids)
          .eq('aprovado', true);
        setTotalJogadores(count || 0);
      } else {
        setTotalJogadores(0);
      }

      if (aba === 'destaques') {
        const { data: st } = await torneioJogosAPI.obterEstatisticasAcumuladas(torneio.id);
        const filtered = (st || []).filter(s => s.jogo?.torneio_id === torneio.id);
        setStatsAcumuladas(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleExcluirTorneio() {
    if (!window.confirm('Deseja realmente excluir este torneio? Essa ação é irreversível e apagará todas as equipes, jogos e estatísticas dele.')) return;
    try {
      const { error } = await torneiosAPI.excluir(torneio.id);
      if (error) {
        alert('Erro ao excluir torneio: ' + error.message);
      } else {
        onBack();
      }
    } catch (err) {
      alert('Erro ao excluir torneio: ' + err.message);
    }
  }

  // Gera chaveamento de Mata-Mata (Eliminatória Simples)
  async function handleIniciarTorneio() {
    const equipesAprovadas = equipes.filter(e => e.aprovado);
    const numEqs = equipesAprovadas.length;

    if (numEqs !== 4 && numEqs !== 8) {
      alert('Para o Mata-Mata, é necessário ter exatamente 4 ou 8 equipes aprovadas.');
      return;
    }

    if (!window.confirm('Deseja iniciar o torneio e gerar a tabela de jogos? Novas inscrições serão bloqueadas.')) return;

    try {
      // 1. Atualizar status para em_andamento
      await torneiosAPI.atualizarStatus(torneio.id, 'em_andamento');

      // 2. Embaralhar equipes
      const shuffled = [...equipesAprovadas].sort(() => Math.random() - 0.5);

      if (torneio.formato === 'eliminatoria_simples') {
        if (numEqs === 4) {
          // Criar Final (posicao 3)
          const { data: jogoFinal } = await torneioJogosAPI.criarJogo({
            torneio_id: torneio.id,
            fase: 'Final',
            posicao_chave: 3
          });

          // Semifinal 1 (posicao 1) -> Vencedor vai para final (A)
          await torneioJogosAPI.criarJogo({
            torneio_id: torneio.id,
            equipe_a_id: shuffled[0].id,
            equipe_b_id: shuffled[1].id,
            fase: 'Semifinal',
            posicao_chave: 1,
            proximo_jogo_id: jogoFinal.id
          });

          // Semifinal 2 (posicao 2) -> Vencedor vai para final (B)
          await torneioJogosAPI.criarJogo({
            torneio_id: torneio.id,
            equipe_a_id: shuffled[2].id,
            equipe_b_id: shuffled[3].id,
            fase: 'Semifinal',
            posicao_chave: 2,
            proximo_jogo_id: jogoFinal.id
          });
        } else if (numEqs === 8) {
          // Criar Final (pos 7)
          const { data: jogoFinal } = await torneioJogosAPI.criarJogo({
            torneio_id: torneio.id,
            fase: 'Final',
            posicao_chave: 7
          });

          // Semifinais (pos 5 e 6)
          const { data: semi1 } = await torneioJogosAPI.criarJogo({
            torneio_id: torneio.id,
            fase: 'Semifinal',
            posicao_chave: 5,
            proximo_jogo_id: jogoFinal.id
          });
          const { data: semi2 } = await torneioJogosAPI.criarJogo({
            torneio_id: torneio.id,
            fase: 'Semifinal',
            posicao_chave: 6,
            proximo_jogo_id: jogoFinal.id
          });

          // Quartas de Final (pos 1, 2, 3, 4)
          await torneioJogosAPI.criarJogo({ torneio_id: torneio.id, equipe_a_id: shuffled[0].id, equipe_b_id: shuffled[1].id, fase: 'Quartas de Final', posicao_chave: 1, proximo_jogo_id: semi1.id });
          await torneioJogosAPI.criarJogo({ torneio_id: torneio.id, equipe_a_id: shuffled[2].id, equipe_b_id: shuffled[3].id, fase: 'Quartas de Final', posicao_chave: 2, proximo_jogo_id: semi1.id });
          await torneioJogosAPI.criarJogo({ torneio_id: torneio.id, equipe_a_id: shuffled[4].id, equipe_b_id: shuffled[5].id, fase: 'Quartas de Final', posicao_chave: 3, proximo_jogo_id: semi2.id });
          await torneioJogosAPI.criarJogo({ torneio_id: torneio.id, equipe_a_id: shuffled[6].id, equipe_b_id: shuffled[7].id, fase: 'Quartas de Final', posicao_chave: 4, proximo_jogo_id: semi2.id });
        }
      } else if (torneio.formato === 'todos_contra_todos') {
        // Round Robin: Todas as equipes jogam contra todas
        for (let i = 0; i < numEqs; i++) {
          for (let j = i + 1; j < numEqs; j++) {
            await torneioJogosAPI.criarJogo({
              torneio_id: torneio.id,
              equipe_a_id: shuffled[i].id,
              equipe_b_id: shuffled[j].id,
              fase: 'Rodada Única'
            });
          }
        }
      }

      carregarDados();
    } catch (e) {
      console.error(e);
      alert('Erro ao iniciar chaves.');
    }
  }

  // Finalizar torneio completo
  async function handleFinalizarTorneio() {
    if (!window.confirm('Tem certeza de que deseja finalizar o torneio de forma definitiva?')) return;
    await torneiosAPI.atualizarStatus(torneio.id, 'finalizado');
    carregarDados();
  }

  // Gera classificação geral do Round Robin
  const calcularClassificacao = () => {
    const tabela = {};
    equipes.filter(e => e.aprovado).forEach(e => {
      tabela[e.id] = { id: e.id, nome: e.nome, v: 0, d: 0, pts_pro: 0, pts_contra: 0, sg: 0, pts: 0 };
    });

    jogos.filter(j => j.status === 'finalizado').forEach(j => {
      const tA = tabela[j.equipe_a_id];
      const tB = tabela[j.equipe_b_id];
      if (!tA || !tB) return;

      tA.pts_pro += j.placar_a;
      tA.pts_contra += j.placar_b;
      tB.pts_pro += j.placar_b;
      tB.pts_contra += j.placar_a;

      if (j.placar_a > j.placar_b) {
        tA.v += 1;
        tA.pts += 2; // Vitória padrão basquete
        tB.d += 1;
        tB.pts += 1; // Derrota padrão basquete
      } else {
        tB.v += 1;
        tB.pts += 2;
        tA.d += 1;
        tA.pts += 1;
      }
      tA.sg = tA.pts_pro - tA.pts_contra;
      tB.sg = tB.pts_pro - tB.pts_contra;
    });

    return Object.values(tabela).sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.pts_pro - a.pts_pro);
  };

  // Agrega líderes individuais de estatísticas
  const calcularLideres = () => {
    const sums = {};
    statsAcumuladas.forEach(s => {
      if (!sums[s.jogador_id]) {
        sums[s.jogador_id] = { nome: s.jogador?.nome_completo, apelido: s.jogador?.apelido, pts: 0, ast: 0, reb: 0, tocos: 0, roubos: 0 };
      }
      sums[s.jogador_id].pts += s.pontos || 0;
      sums[s.jogador_id].ast += s.assistencias || 0;
      sums[s.jogador_id].reb += s.rebotes || 0;
      sums[s.jogador_id].tocos += s.tocos || 0;
      sums[s.jogador_id].roubos += s.roubos_bola || 0;
    });

    const arr = Object.values(sums);
    return {
      cestinha: [...arr].sort((a, b) => b.pts - a.pts)[0] || null,
      assistencias: [...arr].sort((a, b) => b.ast - a.ast)[0] || null,
      rebotes: [...arr].sort((a, b) => b.reb - a.reb)[0] || null,
      tocos: [...arr].sort((a, b) => b.tocos - a.tocos)[0] || null,
    };
  };

  const lideres = calcularLideres();
  const classificacao = calcularClassificacao();

  if (activeConsoleJogo) {
    return (
      <ConsolePlacarJogo 
        jogo={activeConsoleJogo} 
        torneio={torneio}
        onBack={() => { setActiveConsoleJogo(null); carregarDados(); }} 
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0B0F14',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='800' viewBox='0 0 400 800'%3E%3Cpath d='M 30 30 L 370 30 L 370 770 L 30 770 Z' fill='none' stroke='%23ffffff' stroke-width='1.5' opacity='0.03'/%3E%3Ccircle cx='200' cy='400' r='55' fill='none' stroke='%23ffffff' stroke-width='1.5' opacity='0.03'/%3E%3Cline x1='30' y1='400' x2='370' y2='400' stroke='%23ffffff' stroke-width='1.5' opacity='0.03'/%3E%3Cpath d='M 30 160 A 170 170 0 0 0 370 160' fill='none' stroke='%23ffffff' stroke-width='1.5' opacity='0.03'/%3E%3Cpath d='M 30 640 A 170 170 0 0 1 370 640' fill='none' stroke='%23ffffff' stroke-width='1.5' opacity='0.03'/%3E%3Cpath d='M 50 100 Q 150 150 200 300 T 350 700' fill='none' stroke='%23ffffff' stroke-dasharray='4,4' stroke-width='1.2' opacity='0.03'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      overflow: 'hidden'
    }}>
      {/* Hero Header Section */}
      <div style={{
        height: '220px',
        background: 'linear-gradient(180deg, rgba(11,15,20,0.5) 0%, rgba(17,24,30,0.95) 100%)',
        padding: '16px 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        flexShrink: 0
      }}>
        {/* Row 1: Botão Voltar & Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
          <button onClick={onBack} style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: '#F8FAFC',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: '50px',
            fontFamily: 'inherit'
          }}>
            ← Voltar
          </button>
          
          <span style={{
            background: STATUS_TORNEIO[torneio.status]?.bg || 'rgba(0,0,0,0.2)',
            color: STATUS_TORNEIO[torneio.status]?.color || '#fff',
            padding: '4px 12px',
            borderRadius: '50px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.02em',
            textTransform: 'uppercase'
          }}>
            {STATUS_TORNEIO[torneio.status]?.label || torneio.status}
          </span>
        </div>

        {/* Row 2: Nome e Formato */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🏆</span>
            <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#F8FAFC', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              {torneio.nome}
            </h2>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
            {FORMATOS[torneio.formato] || torneio.formato}
          </p>
        </div>

        {/* Row 3: Meta local/data e organizador */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '10px'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94A3B8', fontSize: '11px' }}>
              {torneio.local_quadra}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94A3B8', fontSize: '11px' }}>
              <span>📅</span> {new Date(torneio.data_inicio).toLocaleDateString('pt-BR')} • {torneio.horario_inicio.substring(0,5)}
            </div>
          </div>
          <div style={{ color: '#94A3B8', fontSize: '11px' }}>
            Organizado por <strong style={{ color: '#F8FAFC' }}>{torneio.organizador?.nome_completo || 'Lucas Viel'}</strong>
          </div>
        </div>
      </div>

      {/* Resumo do Torneio / Métricas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: '8px',
        padding: '16px 20px 0',
        flexShrink: 0
      }}>
        {[
          { label: 'Equipes', value: equipes.length },
          { label: 'Jogadores', value: totalJogadores },
          { label: 'Jogos', value: jogos.length },
          { label: 'Prêmio', value: torneio.premiacao || 'R$0' }
        ].map((item, idx) => (
          <div key={idx} className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 6px',
            borderRadius: '20px',
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 4px 20px rgba(0,0,0,.15)'
          }}>
            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '4px' }}>
              {item.label}
            </span>
            <span style={{
              fontSize: item.label === 'Prêmio' ? '13px' : '22px',
              fontWeight: 900,
              color: item.label === 'Prêmio' ? '#F97316' : '#F8FAFC',
              fontFamily: "'Bebas Neue', sans-serif",
              textAlign: 'center',
              wordBreak: 'break-word',
              maxWidth: '100%'
            }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Abas Esportivas (Scroll Horizontal) */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '0 20px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        gap: '20px',
        marginTop: '12px',
        flexShrink: 0
      }}>
        {[
          { key: 'info', label: 'Informações' },
          { key: 'equipes', label: 'Equipes' },
          { key: 'tabela', label: torneio.formato === 'todos_contra_todos' ? 'Classificação' : 'Chaves' },
          { key: 'jogos', label: 'Jogos' },
          { key: 'destaques', label: 'Estatísticas' }
        ].map(t => {
          const isActive = aba === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '3px solid #2563EB' : '3px solid transparent',
                color: isActive ? '#F8FAFC' : '#94A3B8',
                fontWeight: isActive ? 800 : 600,
                fontSize: '13px',
                padding: '8px 4px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit'
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 60px' }}>
        {/* TAB 1: INFORMAÇÕES */}
        {aba === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              {[
                { label: 'LOCAL', value: torneio.local_quadra },
                { label: 'DATA', value: new Date(torneio.data_inicio).toLocaleDateString('pt-BR') },
                { label: 'HORÁRIO', value: torneio.horario_inicio.substring(0,5) },
                { label: 'FORMATO', value: FORMATOS[torneio.formato] || torneio.formato },
                { label: 'PREMIAÇÃO', value: torneio.premiacao || 'A definir', highlight: true },
                { label: 'INSCRIÇÃO', value: torneio.taxa_inscricao > 0 ? `R$ ${torneio.taxa_inscricao}` : 'Gratuito' }
              ].map((info, idx) => (
                <div key={idx} className="card" style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: '#111827',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: '0 4px 20px rgba(0,0,0,.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>
                    {info.label}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: info.highlight ? '#F97316' : '#F8FAFC'
                  }}>
                    {info.value}
                  </span>
                </div>
              ))}
            </div>

            {torneio.descricao && (
              <div className="card" style={{
                padding: '16px',
                borderRadius: '16px',
                background: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: '0 4px 20px rgba(0,0,0,.15)'
              }}>
                <h4 style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Descrição do Evento
                </h4>
                <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#F8FAFC' }}>
                  {torneio.descricao}
                </p>
              </div>
            )}

            {/* Painel do Organizador (Central de Controle) */}
            {isOrganizador && (
              <div className="card" style={{
                padding: '20px',
                borderRadius: '20px',
                background: '#1A2330',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,.15)'
              }}>
                <h4 style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  GERENCIAMENTO
                </h4>

                {torneio.status === 'inscricoes_abertas' && (
                  <button 
                    onClick={handleIniciarTorneio}
                    style={{
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      height: '56px',
                      borderRadius: '16px',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)',
                      fontFamily: 'inherit'
                    }}
                  >
                    ▶ Iniciar Torneio
                  </button>
                )}

                {torneio.status === 'em_andamento' && (
                  <button 
                    onClick={handleFinalizarTorneio}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      height: '50px',
                      borderRadius: '16px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      fontFamily: 'inherit'
                    }}
                  >
                    🛑 Finalizar Torneio
                  </button>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                  <button onClick={() => setAba('equipes')} style={{
                    background: '#111827',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontFamily: 'inherit'
                  }}>
                    ⚙️ Gerenciar Equipes
                  </button>
                  <button onClick={() => setAba('jogos')} style={{
                    background: '#111827',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontFamily: 'inherit'
                  }}>
                    🏀 Gerenciar Jogos
                  </button>
                  <button onClick={() => setAba('destaques')} style={{
                    background: '#111827',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontFamily: 'inherit'
                  }}>
                    📊 Estatísticas
                  </button>
                  <button onClick={() => setAba('equipes')} style={{
                    background: '#111827',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontFamily: 'inherit'
                  }}>
                    📋 Aprovar Inscrições
                  </button>
                </div>
              </div>
            )}

            {/* Botão Excluir (no final da aba info para organizadores) */}
            {isOrganizador && (
              <button 
                onClick={handleExcluirTorneio}
                style={{
                  background: 'none',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  borderRadius: '16px',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                  marginTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'inherit'
                }}
              >
                🗑️ Encerrar Torneio
              </button>
            )}
          </div>
        )}

        {/* TAB 2: EQUIPES */}
        {aba === 'equipes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#F8FAFC' }}>Equipes Inscritas ({equipes.length})</h3>
              {torneio.status === 'inscricoes_abertas' && (
                <button 
                  onClick={() => setShowInscricao(true)}
                  style={{
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Inscrever Equipe
                </button>
              )}
            </div>

            {equipes.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 10px' }}>
                <h3>Nenhuma equipe inscrita</h3>
                <p>Inscreva sua equipe e convide seus amigos para disputar!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {equipes.map(e => {
                  const isExpanded = expandedTeamId === e.id;
                  const isCapitao = e.capitao_id === profile.id;
                  return (
                    <div key={e.id} className="card" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '16px',
                      background: '#111827',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '16px',
                      boxShadow: '0 4px 20px rgba(0,0,0,.15)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setExpandedTeamId(isExpanded ? null : e.id)}>
                          <h4 style={{ fontWeight: 800, fontSize: '15px', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {e.nome} <span style={{ fontSize: '10px', color: '#94A3B8' }}>{isExpanded ? '▼' : '▶'}</span>
                          </h4>
                          <small style={{ color: '#94A3B8' }}>Capitão: {e.capitao?.nome_completo}</small>
                        </div>
                        <div>
                          {e.aprovado ? (
                            <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 800 }}>✓ Confirmada</span>
                          ) : isOrganizador ? (
                            <button 
                              onClick={async () => { await equipesAPI.aprovar(e.id, true); carregarDados(); }}
                              style={{
                                background: '#2563EB',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontFamily: 'inherit'
                              }}
                            >
                              Aprovar
                            </button>
                          ) : (
                            <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 700 }}>Pendente</span>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <TeamRosterSection 
                          team={e}
                          profile={profile}
                          isCapitao={isCapitao}
                          isOrganizador={isOrganizador}
                          torneioStatus={torneio.status}
                          onUpdate={carregarDados}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CLASSIFICAÇÃO / CHAVEAMENTO */}
        {aba === 'tabela' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {torneio.formato === 'todos_contra_todos' ? (
              <div className="card" style={{
                overflowX: 'auto',
                padding: 0,
                background: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,.15)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#F8FAFC' }}>
                  <thead>
                    <tr style={{ background: '#1A2330', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#94A3B8' }}>EQUIPE</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#94A3B8' }}>P</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#94A3B8' }}>V</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#94A3B8' }}>D</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#94A3B8' }}>SG</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#94A3B8' }}>PRO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classificacao.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 800 }}>{i + 1}. {c.nome}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 900, color: '#2563EB' }}>{c.pts}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>{c.v}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>{c.d}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: c.sg >= 0 ? '#22c55e' : '#ef4444' }}>
                          {c.sg >= 0 ? `+${c.sg}` : c.sg}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{c.pts_pro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Mata-Mata Visual Bracket
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#F8FAFC' }}>Árvore de Playoffs</h4>
                {jogos.length === 0 ? (
                  <p style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center' }}>A chave será gerada quando o torneio for iniciado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {['Quartas de Final', 'Semifinal', 'Final'].map(fase => {
                      const faseMatches = jogos.filter(j => j.fase === fase);
                      if (faseMatches.length === 0) return null;
                      return (
                        <div key={fase} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {fase}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {faseMatches.map(j => (
                              <div key={j.id} className="card" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                background: '#111827',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                boxShadow: '0 4px 20px rgba(0,0,0,.15)'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                                    <span style={{
                                      fontSize: '13px',
                                      fontWeight: j.placar_a > j.placar_b && j.status === 'finalizado' ? 800 : 500,
                                      color: j.placar_a > j.placar_b && j.status === 'finalizado' ? '#F8FAFC' : '#94A3B8'
                                    }}>{j.equipe_a?.nome || 'A definir'}</span>
                                    <span style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '13px' }}>
                                      {j.status === 'finalizado' || j.status === 'em_andamento' ? j.placar_a : '--'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                                    <span style={{
                                      fontSize: '13px',
                                      fontWeight: j.placar_b > j.placar_a && j.status === 'finalizado' ? 800 : 500,
                                      color: j.placar_b > j.placar_a && j.status === 'finalizado' ? '#F8FAFC' : '#94A3B8'
                                    }}>{j.equipe_b?.nome || 'A definir'}</span>
                                    <span style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '13px' }}>
                                      {j.status === 'finalizado' || j.status === 'em_andamento' ? j.placar_b : '--'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CONFRONTOS / JOGOS */}
        {aba === 'jogos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {jogos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '20px 0' }}>
                Os confrontos estarão disponíveis após o início das partidas.
              </p>
            ) : (
              jogos.map(j => {
                const emProgresso = j.status === 'em_andamento';
                return (
                  <div key={j.id} className="card" style={{
                    background: '#111827',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
                    padding: '16px',
                    borderLeft: emProgresso ? '4px solid #2563EB' : '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginBottom: '8px', fontWeight: 600 }}>
                      <span>{j.fase.toUpperCase()} {j.grupo ? `· ${j.grupo.toUpperCase()}` : ''}</span>
                      {emProgresso ? (
                        <span style={{ color: '#2563EB', fontWeight: 800 }}>AO VIVO ({j.tempo_total})</span>
                      ) : j.status === 'finalizado' ? (
                        <span style={{ color: '#94A3B8', fontWeight: 700 }}>FINALIZADO</span>
                      ) : (
                        <span>AGENDADO</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', margin: '8px 0' }}>
                      <div style={{ flex: 1, textAlign: 'right', fontWeight: 800, fontSize: '14px', color: '#F8FAFC' }}>
                        {j.equipe_a?.nome || 'A definir'}
                      </div>
                      <div style={{
                        background: '#1A2330',
                        padding: '6px 16px',
                        borderRadius: '10px',
                        fontWeight: 900,
                        fontSize: '15px',
                        color: '#F8FAFC',
                        letterSpacing: '0.05em'
                      }}>
                        {j.status !== 'agendado' ? `${j.placar_a} x ${j.placar_b}` : 'VS'}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left', fontWeight: 800, fontSize: '14px', color: '#F8FAFC' }}>
                        {j.equipe_b?.nome || 'A definir'}
                      </div>
                    </div>

                    {isOrganizador && j.equipe_a_id && j.equipe_b_id && j.status !== 'finalizado' && (
                      <button 
                        onClick={() => setActiveConsoleJogo(j)}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#F8FAFC',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        ⚙️ Console do Placar ao Vivo
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 5: ESTATÍSTICAS / LÍDERES */}
        {aba === 'destaques' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#F8FAFC' }}>Líderes Individuais</h3>
            
            {statsAcumuladas.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '20px 0' }}>
                As estatísticas individuais serão geradas quando os jogos começarem.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {lideres.cestinha && (
                  <div className="card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#111827',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
                    padding: '16px'
                  }}>
                    <div style={{ fontSize: '24px' }}>🏀</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#F8FAFC', fontWeight: 800 }}>{lideres.cestinha.nome}</strong>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Cestinha do Torneio</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#F97316', fontFamily: "'Bebas Neue', sans-serif" }}>
                      {lideres.cestinha.pts} PTS
                    </div>
                  </div>
                )}

                {lideres.assistencias && (
                  <div className="card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#111827',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
                    padding: '16px'
                  }}>
                    <div style={{ fontSize: '24px' }}>🤝</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#F8FAFC', fontWeight: 800 }}>{lideres.assistencias.nome}</strong>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Líder em Assistências</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#F97316', fontFamily: "'Bebas Neue', sans-serif" }}>
                      {lideres.assistencias.ast} AST
                    </div>
                  </div>
                )}

                {lideres.rebotes && (
                  <div className="card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#111827',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
                    padding: '16px'
                  }}>
                    <div style={{ fontSize: '24px' }}>💪</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#F8FAFC', fontWeight: 800 }}>{lideres.rebotes.nome}</strong>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Líder em Rebotes</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#F97316', fontFamily: "'Bebas Neue', sans-serif" }}>
                      {lideres.rebotes.reb} REB
                    </div>
                  </div>
                )}

                {lideres.tocos && (
                  <div className="card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#111827',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
                    padding: '16px'
                  }}>
                    <div style={{ fontSize: '24px' }}>🚫</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#F8FAFC', fontWeight: 800 }}>{lideres.tocos.nome}</strong>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Líder em Tocos (Blocks)</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#F97316', fontFamily: "'Bebas Neue', sans-serif" }}>
                      {lideres.tocos.tocos} BLK
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Inscrição de Equipe */}
      {showInscricao && (
        <InscricaoEquipeModal 
          torneio={torneio} 
          profile={profile} 
          onClose={() => setShowInscricao(false)} 
          onSuccess={() => { setShowInscricao(false); carregarDados(); }} 
        />
      )}
    </div>
  );
}

// ============================================================
// MODAL: INSCREVER EQUIPE
// ============================================================
function InscricaoEquipeModal({ torneio, profile, onClose, onSuccess }) {
  const [nomeEquipe, setNomeEquipe] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      if (!nomeEquipe.trim()) throw new Error('Informe o nome da equipe.');

      // Inscrever equipe
      const { data: novaEquipe, error } = await equipesAPI.criar({
        nome: nomeEquipe.trim(),
        torneio_id: torneio.id,
        aprovado: false // organizador aprova
      });

      if (error) throw error;

      // Auto-adiciona o capitão como jogador aprovado no roster do time
      if (novaEquipe) {
        await equipesAPI.adicionarJogador(novaEquipe.id, profile.id, true);
      }

      onSuccess();
    } catch (err) {
      setErro(err.message || 'Erro ao registrar inscrição da equipe.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-handle" />
        <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Inscrição de Equipe</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>Inscreva seu time. Você será definido automaticamente como o Capitão da equipe.</p>

        {erro && <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 12 }}>⚠️ {erro}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome da Equipe *</label>
            <input required type="text" placeholder="Ex: Bulls de Altamira" value={nomeEquipe} onChange={e => setNomeEquipe(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={salvando} style={{ flex: 1 }}>Voltar</button>
            <button type="submit" className="btn btn-primary" disabled={salvando} style={{ flex: 2 }}>Registrar Equipe</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// CONSOLE DO PLACAR: GERENCIADOR DE JOGO AO VIVO
// ============================================================
function ConsolePlacarJogo({ jogo, torneio, onBack }) {
  const [placarA, setPlacarA] = useState(jogo.placar_a || 0);
  const [placarB, setPlacarB] = useState(jogo.placar_b || 0);
  const [periodo, setPeriodo] = useState(jogo.periodos || 1);
  const [tempo, setTempo] = useState(0);
  const [timerAtivo, setTimerAtivo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [duracaoQuarto, setDuracaoQuarto] = useState(() => {
    const saved = localStorage.getItem(`duracao_torneio_jogo_${jogo.id}`);
    return saved ? parseInt(saved) : 10;
  });

  const [periodosScores, setPeriodosScores] = useState(() => {
    const saved = localStorage.getItem(`scores_torneio_jogo_${jogo.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(`scores_torneio_jogo_${jogo.id}`, JSON.stringify(periodosScores));
  }, [periodosScores, jogo.id]);
  
  // Roster dos atletas para lançar estatísticas
  const [rosterA, setRosterA] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);

  // Stats formulário
  const [statsJogo, setStatsJogo] = useState({}); // { [jogadorId]: { pontos: 0, rebotes: 0, assistencias: 0, tocos: 0, roubos: 0 } }
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

  const timerRef = useRef(null);

  useEffect(() => {
    carregarRosters();
    
    // Parse tempo total do banco
    let parsedTempo = 0;
    if (jogo.tempo_total) {
      const parts = jogo.tempo_total.split(':');
      if (parts.length === 2) {
        parsedTempo = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
    }

    // Determina a duração do quarto
    const savedDur = localStorage.getItem(`duracao_torneio_jogo_${jogo.id}`);
    let activeDur = 10;
    if (savedDur) {
      activeDur = parseInt(savedDur);
    } else {
      activeDur = parsedTempo > 600 ? 12 : 10;
    }
    setDuracaoQuarto(activeDur);

    // Restaura o cronômetro do localStorage se existir
    let restoredSuccess = false;
    try {
      const localStateStr = localStorage.getItem(`timer_torneio_jogo_${jogo.id}`);
      if (localStateStr) {
        const localState = JSON.parse(localStateStr);
        let currentTempo = localState.tempo;
        let currentTimerAtivo = localState.timerAtivo;
        
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
      if (jogo.tempo_total) {
        setTempo(parsedTempo);
      } else {
        setTempo(activeDur * 60);
      }
      setTimerAtivo(false);
    }

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogo.id]);

  useEffect(() => {
    if (timerAtivo) {
      timerRef.current = setInterval(() => {
        setTempo(t => Math.max(0, t - 1));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
  }, [timerAtivo]);

  // Salvar cronômetro no localStorage
  useEffect(() => {
    localStorage.setItem(`timer_torneio_jogo_${jogo.id}`, JSON.stringify({
      tempo,
      timerAtivo,
      lastUpdated: Date.now()
    }));
  }, [tempo, timerAtivo, jogo.id]);

  // Efeito para tratar o fim do período automaticamente
  useEffect(() => {
    if (tempo === 0 && timerAtivo) {
      setTimerAtivo(false);
    }
  }, [tempo, timerAtivo]);

  // Sincroniza o placar no Supabase conforme altera no console
  useEffect(() => {
    torneioJogosAPI.sincronizarJogo(jogo.id, {
      placar_a: placarA,
      placar_b: placarB,
      periodos: periodo,
      tempo_total: formatTempo(tempo)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placarA, placarB, periodo, tempo]);

  async function carregarRosters() {
    try {
      const [{ data: jA }, { data: jB }] = await Promise.all([
        equipesAPI.obterJogadores(jogo.equipe_a_id),
        equipesAPI.obterJogadores(jogo.equipe_b_id)
      ]);
      const activeA = (jA || []).filter(p => p.aprovado);
      const activeB = (jB || []).filter(p => p.aprovado);
      setRosterA(activeA);

      const combined = [...activeA, ...activeB];
      setAllPlayers(combined);

      // Inicializa objeto de estatísticas
      const st = {};
      combined.forEach(p => {
        st[p.jogador_id] = { pontos: 0, rebotes: 0, assistencias: 0, tocos: 0, roubos: 0 };
      });
      setStatsJogo(st);
    } catch (e) {
      console.error(e);
    }
  }

  const formatTempo = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const getQuarterScore = (q, time) => {
    if (q === periodo) {
      const somaAnteriores = periodosScores.reduce((acc, curr) => acc + (time === 'A' ? curr.a : curr.b), 0);
      return Math.max(0, (time === 'A' ? placarA : placarB) - somaAnteriores);
    }
    const found = periodosScores.find(item => item.periodo === q);
    if (found) {
      return time === 'A' ? found.a : found.b;
    }
    return '-';
  };

  function ajustarPlacar(time, val) {
    if (time === 'A') {
      setPlacarA(p => {
        const newVal = Math.max(0, p + val);
        const diff = newVal - p;
        if (diff !== 0) triggerFeedback('A', diff);
        return newVal;
      });
    } else {
      setPlacarB(p => {
        const newVal = Math.max(0, p + val);
        const diff = newVal - p;
        if (diff !== 0) triggerFeedback('B', diff);
        return newVal;
      });
    }
  }

  function incrementarStat(jogadorId, campo, val) {
    setStatsJogo(prev => {
      const pStats = prev[jogadorId] || { pontos: 0, rebotes: 0, assistencias: 0, tocos: 0, roubos: 0 };
      const newVal = Math.max(0, pStats[campo] + val);
      return {
        ...prev,
        [jogadorId]: {
          ...pStats,
          [campo]: newVal
        }
      };
    });
  }

  // Encerra a partida e grava estatísticas individuais no banco
  async function handleFinalizarJogo() {
    setLoading(true);
    try {
      // 1. Gravar estatísticas dos jogadores
      const statsPayload = [];
      Object.entries(statsJogo).forEach(([jogadorId, stats]) => {
        const eqId = rosterA.find(p => p.jogador_id === jogadorId) ? jogo.equipe_a_id : jogo.equipe_b_id;
        statsPayload.push({
          jogo_id: jogo.id,
          jogador_id: jogadorId,
          equipe_id: eqId,
          pontos: stats.pontos,
          rebotes: stats.rebotes,
          assistencias: stats.assistencias,
          tocos: stats.tocos,
          roubos_bola: stats.roubos
        });
      });

      if (statsPayload.length > 0) {
        await torneioJogosAPI.registrarEstatisticas(statsPayload);
      }

      // 2. Atualizar status do jogo para finalizado
      const finalUpdates = {
        placar_a: placarA,
        placar_b: placarB,
        status: 'finalizado',
        mvp_id: mvpId || null,
        tempo_total: formatTempo(tempo)
      };
      
      await torneioJogosAPI.sincronizarJogo(jogo.id, finalUpdates);

      // Limpar localStorage
      localStorage.removeItem(`timer_torneio_jogo_${jogo.id}`);
      localStorage.removeItem(`scores_torneio_jogo_${jogo.id}`);
      localStorage.removeItem(`duracao_torneio_jogo_${jogo.id}`);

      // 3. Se for Mata-Mata e tiver proximo_jogo_id, avança o vencedor automaticamente
      if (jogo.proximo_jogo_id) {
        const vencedorId = placarA > placarB ? jogo.equipe_a_id : jogo.equipe_b_id;
        
        // Verifica qual slot (A ou B) do próximo jogo está livre
        const { data: proximoJogo } = await supabase
          .from('torneio_jogos')
          .select('*')
          .eq('id', jogo.proximo_jogo_id)
          .single();

        if (proximoJogo) {
          const updatesProx = {};
          if (!proximoJogo.equipe_a_id) {
            updatesProx.equipe_a_id = vencedorId;
          } else {
            updatesProx.equipe_b_id = vencedorId;
          }
          await torneioJogosAPI.sincronizarJogo(jogo.proximo_jogo_id, updatesProx);
        }
      }

      setShowFinalizarModal(false);
      onBack();
    } catch (e) {
      console.error(e);
      alert('Erro ao finalizar jogo.');
    } finally {
      setLoading(false);
    }
  }

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
    const novoTempo = novoPeriodo >= 5 ? 300 : duracaoQuarto * 60;
    setTempo(novoTempo);
  }

  return (
    <div style={{ padding: '20px 20px 24px', height: '100%', display: 'flex', flexDirection: 'column', background: '#080F1A' }}>
      {/* Header Placar Ao Vivo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button 
          onClick={onBack} 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: '#60A5FA',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'inherit',
            padding: 0
          }}
        >
          ← VOLTAR AO TORNEIO
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8' }}>
            {periodo >= 5 ? 'PRORROGAÇÃO' : `${periodo}º QUARTO`}
          </span>
          <span style={{ background: '#EF4444', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800 }}>
            AO VIVO
          </span>
        </div>
      </div>

      {/* Duração do Quarto (Opcional - só mostra no início do jogo) */}
      {periodo === 1 && tempo === duracaoQuarto * 60 && !timerAtivo && (
        <div className="card" style={{
          padding: '12px 16px',
          background: '#111827',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Duração do Quarto:</span>
          <div style={{ display: 'flex', gap: 12 }}>
            {[10, 12].map(mins => (
              <label key={mins} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="duracaoQuartoConsole"
                  checked={duracaoQuarto === mins}
                  onChange={() => {
                    setDuracaoQuarto(mins);
                    setTempo(mins * 60);
                    localStorage.setItem(`duracao_torneio_jogo_${jogo.id}`, String(mins));
                  }}
                  style={{ accentColor: '#3b82f6' }}
                />
                {mins} minutos
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Cronômetro visor (Mockup style: Large and Centered at the top) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 20
      }}>
        <span className={timerAtivo ? 'timer-active-pulse-text' : ''} style={{
          fontSize: '84px',
          fontFamily: 'monospace',
          fontWeight: 800,
          color: '#FFFFFF',
          lineHeight: 1,
          letterSpacing: '-0.02em'
        }}>
          {formatTempo(tempo)}
        </span>
      </div>

      {/* Placar Central (Unified Scoreboard Card) */}
      <div className="card" style={{
        padding: '20px 16px',
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
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
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            border: '2px solid #2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 1 0 20" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
            {jogo.equipe_a?.nome}
          </span>
          <span key={placarA} className="number-animate" style={{
            fontSize: '48px',
            fontWeight: 900,
            color: '#F8FAFC',
            display: 'block',
            marginTop: 4,
            lineHeight: 1
          }}>
            {placarA}
          </span>
        </div>

        {/* Center VS */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748B', fontSize: '12px', fontWeight: 700 }}>
          VS
        </div>

        {/* Time B Name & Score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            border: '2px solid #F97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 1 0 20" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
            {jogo.equipe_b?.nome}
          </span>
          <span key={placarB} className="number-animate" style={{
            fontSize: '48px',
            fontWeight: 900,
            color: '#F8FAFC',
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
        background: '#111827',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '12px 14px',
        marginBottom: 20,
        overflowX: 'auto'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#64748B' }}>
              <th style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 600 }}>TIME</th>
              <th style={{ padding: '6px 4px', fontWeight: 600 }}>Q1</th>
              <th style={{ padding: '6px 4px', fontWeight: 600 }}>Q2</th>
              <th style={{ padding: '6px 4px', fontWeight: 600 }}>Q3</th>
              <th style={{ padding: '6px 4px', fontWeight: 600 }}>Q4</th>
              {periodo >= 5 && <th style={{ padding: '6px 4px', fontWeight: 600 }}>PR</th>}
              <th style={{ padding: '6px 4px', fontWeight: 800, color: '#F8FAFC' }}>T</th>
            </tr>
          </thead>
          <tbody>
            {/* Linha Time A */}
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#F8FAFC', fontWeight: 600 }}>
              <td style={{ padding: '8px 4px', textAlign: 'left', color: '#60A5FA', fontWeight: 700 }}>
                {(jogo.equipe_a?.nome || 'TMA').substring(0, 3).toUpperCase()}
              </td>
              <td style={{ padding: '8px 4px' }}>{getQuarterScore(1, 'A')}</td>
              <td style={{ padding: '8px 4px' }}>{getQuarterScore(2, 'A')}</td>
              <td style={{ padding: '8px 4px' }}>{getQuarterScore(3, 'A')}</td>
              <td style={{ padding: '8px 4px' }}>{getQuarterScore(4, 'A')}</td>
              {periodo >= 5 && <td style={{ padding: '8px 4px' }}>{getQuarterScore(5, 'A')}</td>}
              <td style={{ padding: '8px 4px', fontWeight: 800, color: '#3B82F6' }}>{placarA}</td>
            </tr>
            {/* Linha Time B */}
            <tr style={{ color: '#F8FAFC', fontWeight: 600 }}>
              <td style={{ padding: '8px 4px', textAlign: 'left', color: '#F87171', fontWeight: 700 }}>
                {(jogo.equipe_b?.nome || 'TMB').substring(0, 3).toUpperCase()}
              </td>
              <td style={{ padding: '8px 4px' }}>{getQuarterScore(1, 'B')}</td>
              <td style={{ padding: '8px 4px' }}>{getQuarterScore(2, 'B')}</td>
              <td style={{ padding: '8px 4px' }}>{getQuarterScore(3, 'B')}</td>
              <td style={{ padding: '8px 4px' }}>{getQuarterScore(4, 'B')}</td>
              {periodo >= 5 && <td style={{ padding: '8px 4px' }}>{getQuarterScore(5, 'B')}</td>}
              <td style={{ padding: '8px 4px', fontWeight: 800, color: '#EF4444' }}>{placarB}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Seção de Transição de Período Dinâmica */}
      {tempo === 0 && (
        <div style={{ marginBottom: 20 }}>
          {periodo < 4 ? (
            <div className="card" style={{
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(17, 24, 39, 0.8) 100%)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>
                Fim do {periodo}º Quarto
              </h3>
              <button onClick={comecarProximoPeriodo} style={{
                background: '#2563EB',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginTop: 8
              }}>
                ▶ Iniciar {periodo + 1}º Quarto
              </button>
            </div>
          ) : (placarA === placarB) ? (
            <div className="card" style={{
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(17, 24, 39, 0.8) 100%)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>
                Jogo Empatado!
              </h3>
              <button onClick={comecarProximoPeriodo} style={{
                background: '#F97316',
                color: '#080F1A',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginTop: 8
              }}>
                ▶ Iniciar Prorrogação (5 min)
              </button>
            </div>
          ) : (
            <div className="card" style={{
              padding: '14px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#EF4444', marginBottom: 2 }}>
                Partida Encerrada
              </h3>
              <p style={{ fontSize: '11px', color: '#94A3B8' }}>
                O tempo regulamentar acabou. Registre as estatísticas, o MVP e encerre.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Controles de Pontuação Rápidos (Botoes + / -) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {/* Controles Time A */}
        <div style={{
          padding: '12px',
          background: '#111827',
          border: '1px solid rgba(37, 99, 235, 0.2)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
            + Pontuar {(jogo.equipe_a?.nome || 'Time A').substring(0, 6)}
          </span>
          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
            <button onClick={() => ajustarPlacar('A', 1)} style={{ flex: 1, padding: '6px 0', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', color: '#60A5FA', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+1</button>
            <button onClick={() => ajustarPlacar('A', 2)} style={{ flex: 1.2, padding: '8px 0', background: '#2563EB', border: 'none', color: '#FFF', borderRadius: '6px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+2</button>
            <button onClick={() => ajustarPlacar('A', 3)} style={{ flex: 1, padding: '6px 0', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#F97316', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+3</button>
          </div>
          <div style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'center' }}>
            <button onClick={() => ajustarPlacar('A', -1)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', color: '#64748B', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>-1</button>
            <button onClick={() => ajustarPlacar('A', -2)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', color: '#64748B', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>-2</button>
          </div>
        </div>

        {/* Controles Time B */}
        <div style={{
          padding: '12px',
          background: '#111827',
          border: '1px solid rgba(249, 115, 22, 0.2)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
            + Pontuar {(jogo.equipe_b?.nome || 'Time B').substring(0, 6)}
          </span>
          <div style={{ display: 'flex', gap: 6, width: '100%' }}>
            <button onClick={() => ajustarPlacar('B', 1)} style={{ flex: 1, padding: '6px 0', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#F97316', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+1</button>
            <button onClick={() => ajustarPlacar('B', 2)} style={{ flex: 1.2, padding: '8px 0', background: '#F97316', border: 'none', color: '#080F1A', borderRadius: '6px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+2</button>
            <button onClick={() => ajustarPlacar('B', 3)} style={{ flex: 1, padding: '6px 0', background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', color: '#60A5FA', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+3</button>
          </div>
          <div style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'center' }}>
            <button onClick={() => ajustarPlacar('B', -1)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', color: '#64748B', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>-1</button>
            <button onClick={() => ajustarPlacar('B', -2)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', color: '#64748B', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>-2</button>
          </div>
        </div>
      </div>

      {/* Bottom Controls Row (Prev, Play/Pause circular, Next) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.06)',
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
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748B',
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
            background: '#2563EB',
            border: 'none',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            color: '#FFF',
            fontSize: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
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
            } else {
              setShowFinalizarModal(true);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748B',
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

      {/* Formulário de Estatísticas Individuais */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Estatísticas Individuais</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allPlayers.map(p => {
            const st = statsJogo[p.jogador_id] || { pontos: 0, rebotes: 0, assistencias: 0, tocos: 0, roubos: 0 };
            const isTeamA = rosterA.some(r => r.jogador_id === p.jogador_id);
            const teamBadgeColor = isTeamA ? '#2563EB' : '#F97316';
            return (
              <div key={p.id} className="card" style={{ padding: '12px 14px', background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#F8FAFC' }}>{p.jogador?.nome_completo}</div>
                  <span style={{ fontSize: 9, color: '#FFF', background: teamBadgeColor, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                    {isTeamA ? (jogo.equipe_a?.nome || 'Time A') : (jogo.equipe_b?.nome || 'Time B')}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 6 }}>
                  {[
                    { label: 'PTS', key: 'pontos' },
                    { label: 'REB', key: 'rebotes' },
                    { label: 'AST', key: 'assistencias' },
                    { label: 'BLK', key: 'tocos' },
                    { label: 'STL', key: 'roubos' }
                  ].map(stat => (
                    <div key={stat.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#0D1527', borderRadius: 6, padding: '4px 0', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ fontSize: 9, color: '#64748B', fontWeight: 800 }}>{stat.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
                        <button type="button" onClick={() => incrementarStat(p.jogador_id, stat.key, -1)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 900, cursor: 'pointer', fontSize: 14, padding: '0 4px', fontFamily: 'inherit' }}>-</button>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC' }}>{st[stat.key]}</span>
                        <button type="button" onClick={() => incrementarStat(p.jogador_id, stat.key, 1)} style={{ background: 'none', border: 'none', color: '#22c55e', fontWeight: 900, cursor: 'pointer', fontSize: 14, padding: '0 4px', fontFamily: 'inherit' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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

      {/* MODAL: SELECIONAR MVP E CONFIRMAR ENCERRAMENTO */}
      {showFinalizarModal && (
        <div className="modal-overlay" onClick={() => setShowFinalizarModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Finalizar Partida</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>Deseja mesmo encerrar a partida? O placar acumulado e estatísticas serão registrados de forma definitiva no torneio.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Eleger MVP da Partida (Opcional)</label>
                <select value={mvpId} onChange={e => setMvpId(e.target.value)} style={{ color: mvpId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  <option value="">Selecione o MVP...</option>
                  {allPlayers.map(p => {
                    const isTeamA = rosterA.some(r => r.jogador_id === p.jogador_id);
                    const teamName = isTeamA ? jogo.equipe_a?.nome : jogo.equipe_b?.nome;
                    return (
                      <option key={p.jogador_id} value={p.jogador_id}>
                        {p.jogador?.nome_completo} ({teamName})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowFinalizarModal(false)} style={{ flex: 1 }}>Voltar</button>
              <button className="btn btn-primary" onClick={handleFinalizarJogo} disabled={loading} style={{ flex: 2, background: '#22c55e', border: 'none' }}>
                {loading ? <><div className="spinner" /> Salvando...</> : 'Confirmar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE: ROSTER DA EQUIPE E GERENCIAMENTO DE ATLETAS
// ============================================================
function TeamRosterSection({ team, profile, isCapitao, isOrganizador, torneioStatus, onUpdate }) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    carregarRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  async function carregarRoster() {
    setLoading(true);
    const { data } = await equipesAPI.obterJogadores(team.id);
    setRoster(data || []);
    setLoading(false);
  }

  async function handleAprovarJogador(rowId) {
    await equipesAPI.aprovarJogador(rowId, true);
    carregarRoster();
    if (onUpdate) onUpdate();
  }

  async function handleRemoverJogador(jogadorId) {
    if (!window.confirm('Deseja realmente remover este jogador do time?')) return;
    await equipesAPI.removerJogador(team.id, jogadorId);
    carregarRoster();
    if (onUpdate) onUpdate();
  }

  async function handleSolicitarEntrada() {
    await equipesAPI.adicionarJogador(team.id, profile.id, false);
    carregarRoster();
    if (onUpdate) onUpdate();
  }

  async function openAddPlayer() {
    setShowAddModal(true);
    setLoadingPlayers(true);
    const stateUf = profile.uf || 'PA';
    const { data } = await profilesAPI.listarPorEstado(stateUf);
    // Filtrar jogadores que já estão no time
    const rosterIds = roster.map(r => r.jogador_id);
    const filtered = (data || []).filter(p => !rosterIds.includes(p.id));
    setAvailablePlayers(filtered);
    setLoadingPlayers(false);
  }

  async function handleAdicionarJogador(jogadorId) {
    await equipesAPI.adicionarJogador(team.id, jogadorId, true);
    setShowAddModal(false);
    carregarRoster();
    if (onUpdate) onUpdate();
  }

  const isNoTime = roster.some(r => r.jogador_id === profile.id);
  const myRosterRow = roster.find(r => r.jogador_id === profile.id);
  const canRequest = !isNoTime && torneioStatus === 'inscricoes_abertas';

  const filteredPlayers = availablePlayers.filter(p => 
    p.nome_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.apelido || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <h5 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Jogadores da Equipe</h5>
      
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando atletas...</div>
      ) : roster.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Nenhum jogador no time ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {roster.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {r.jogador?.foto_perfil ? (
                  <img src={r.jogador.foto_perfil} alt="Avatar" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent-blue-light)' }}>
                    {r.jogador?.nome_completo?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  {r.jogador?.nome_completo} {r.jogador?.apelido && `"${r.jogador.apelido}"`}
                </span>
                {!r.aprovado && (
                  <span style={{ fontSize: 9, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>PENDENTE</span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: 6 }}>
                {!r.aprovado && (isCapitao || isOrganizador) && (
                  <button type="button" className="btn btn-primary btn-xs" onClick={() => handleAprovarJogador(r.id)} style={{ padding: '2px 8px', fontSize: 10 }}>
                    Aprovar
                  </button>
                )}
                {(isCapitao || isOrganizador || r.jogador_id === profile.id) && (
                  <button type="button" className="btn btn-secondary btn-xs" onClick={() => handleRemoverJogador(r.jogador_id)} style={{ padding: '2px 8px', fontSize: 10, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>
                    {r.jogador_id === profile.id ? 'Sair' : 'Remover'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ações de inscrição / convite */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {(isCapitao || isOrganizador) && torneioStatus === 'inscricoes_abertas' && (
          <button type="button" className="btn btn-secondary btn-xs" onClick={openAddPlayer} style={{ fontSize: 11, padding: '4px 10px' }}>
            + Adicionar Jogador
          </button>
        )}
        
        {canRequest && (
          <button type="button" className="btn btn-primary btn-xs" onClick={handleSolicitarEntrada} style={{ fontSize: 11, padding: '4px 10px' }}>
            Solicitar Entrada no Time
          </button>
        )}

        {myRosterRow && !myRosterRow.aprovado && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            ⏳ Aguardando aprovação do Capitão
          </span>
        )}
      </div>

      {/* Modal Interno para Selecionar Jogador */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)} style={{ zIndex: 1000 }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-handle" />
            <h4 style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Adicionar Atleta</h4>
            
            <input 
              type="text" 
              placeholder="Buscar atleta pelo nome..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              style={{ marginBottom: 10 }}
            />

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 200 }}>
              {loadingPlayers ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Carregando atletas...</div>
              ) : filteredPlayers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Nenhum atleta encontrado no estado.</div>
              ) : (
                filteredPlayers.map(p => (
                  <div key={p.id} onClick={() => handleAdicionarJogador(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: 'var(--bg-secondary)', cursor: 'pointer' }}>
                    {p.foto_perfil ? (
                      <img src={p.foto_perfil} alt="Avatar" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-blue-light)' }}>
                        {p.nome_completo?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome_completo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {p.apelido && <span>"{p.apelido}"</span>}
                        {p.apelido && <span>•</span>}
                        <span>{p.cidade_atual || p.cidade || 'Altamira'} - {p.uf || 'PA'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)} style={{ marginTop: 12 }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
