import { useState, useEffect, useRef } from 'react';
import { supabase, torneiosAPI, equipesAPI, torneioJogosAPI, profilesAPI } from '../lib/supabase';

// Formatos de Torneio Traduzidos
const FORMATOS = {
  eliminatoria_simples: 'Eliminatória Simples (Mata-Mata)',
  todos_contra_todos: 'Todos Contra Todos (Pontos Corridos)',
  fase_grupos: 'Fase de Grupos + Playoffs'
};

const STATUS_TORNEIO = {
  inscricoes_abertas: { label: 'Inscrições Abertas', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  inscricoes_encerradas: { label: 'Inscrições Encerradas', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  em_andamento: { label: 'Em Andamento', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  finalizado: { label: 'Finalizado', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
};

export default function Torneios({ profile }) {
  const [torneios, setTorneios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTorneio, setSelectedTorneio] = useState(null);
  
  // View states
  const [showCriar, setShowCriar] = useState(false);
  
  // Realtime subscriptions
  const city = profile?.cidade_atual || profile?.cidade || 'Altamira';

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
  }, [city]);

  async function carregarTorneios() {
    setLoading(true);
    const { data } = await torneiosAPI.listar(city);
    setTorneios(data || []);
    
    // Se um torneio estiver selecionado, recarrega seus dados em tempo real
    if (selectedTorneio) {
      const updated = data?.find(t => t.id === selectedTorneio.id);
      if (updated) setSelectedTorneio(updated);
    }
    setLoading(false);
  }

  return (
    <div className="page-content">
      {selectedTorneio ? (
        <TorneioDetalhes 
          torneio={selectedTorneio} 
          profile={profile} 
          onBack={() => { setSelectedTorneio(null); carregarTorneios(); }} 
        />
      ) : (
        <div style={{ padding: '20px 20px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                  <circle cx="12" cy="8" r="7"/>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 20 }}>Torneios Online</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Competições locais em {city}</p>
              </div>
            </div>
            
            <button className="btn btn-primary btn-sm" onClick={() => setShowCriar(true)}>
              Criar Torneio
            </button>
          </div>

          {/* Listagem */}
          {loading && torneios.length === 0 ? (
            <div className="loading"><div className="spinner" /> Carregando competições...</div>
          ) : torneios.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
              </svg>
              <h3>Nenhum torneio ativo</h3>
              <p>Crie o primeiro torneio da sua cidade e organize as equipes!</p>
              <button className="btn btn-primary" onClick={() => setShowCriar(true)} style={{ marginTop: 14 }}>
                Cadastrar Torneio
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
              {torneios.map(t => {
                const stat = STATUS_TORNEIO[t.status] || { label: t.status, color: '#94a3b8', bg: 'rgba(0,0,0,0.1)' };
                return (
                  <div 
                    key={t.id} 
                    className="card" 
                    onClick={() => setSelectedTorneio(t)}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s', borderLeft: `4px solid ${stat.color}` }}
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
                      <span>📍</span> {t.local_quadra}
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
    <div style={{ padding: '20px 20px 0', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header com botão voltar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, padding: 0 }}>
          ← Voltar
        </button>
        <span style={{ marginLeft: 'auto', background: STATUS_TORNEIO[torneio.status]?.bg, color: STATUS_TORNEIO[torneio.status]?.color, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
          {STATUS_TORNEIO[torneio.status]?.label.toUpperCase()}
        </span>
      </div>

      <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text-primary)', marginBottom: 2 }}>{torneio.nome}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14 }}>Organizado por: {torneio.organizador?.nome_completo}</p>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 14, overflowX: 'auto', flexShrink: 0 }}>
        <button className={`tab ${aba === 'info' ? 'active' : ''}`} onClick={() => setAba('info')}>Info</button>
        <button className={`tab ${aba === 'equipes' ? 'active' : ''}`} onClick={() => setAba('equipes')}>Equipes</button>
        {torneio.formato === 'todos_contra_todos' && (
          <button className={`tab ${aba === 'tabela' ? 'active' : ''}`} onClick={() => setAba('tabela')}>Classificação</button>
        )}
        {torneio.formato === 'eliminatoria_simples' && (
          <button className={`tab ${aba === 'tabela' ? 'active' : ''}`} onClick={() => setAba('tabela')}>Chaveamento</button>
        )}
        <button className={`tab ${aba === 'jogos' ? 'active' : ''}`} onClick={() => setAba('jogos')}>Confrontos</button>
        <button className={`tab ${aba === 'destaques' ? 'active' : ''}`} onClick={() => setAba('destaques')}>Estatísticas</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 60 }}>
        {/* TAB 1: INFORMAÇÕES */}
        {aba === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ opacity: 0.7 }}>📍</span> <strong>Quadra/Local:</strong> {torneio.local_quadra}</div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ opacity: 0.7 }}>📅</span> <strong>Início:</strong> {new Date(torneio.data_inicio).toLocaleDateString('pt-BR')} às {torneio.horario_inicio.substring(0,5)}</div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ opacity: 0.7 }}>🏆</span> <strong>Premiação:</strong> {torneio.premiacao || 'A definir'}</div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ opacity: 0.7 }}>💰</span> <strong>Taxa:</strong> {torneio.taxa_inscricao > 0 ? `R$ ${torneio.taxa_inscricao}` : 'Gratuito'}</div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ opacity: 0.7 }}>🏀</span> <strong>Formato:</strong> {FORMATOS[torneio.formato]}</div>
            </div>

            {torneio.descricao && (
              <div className="card">
                <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 6 }}>Descrição do Evento</h4>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>{torneio.descricao}</p>
              </div>
            )}

            {/* Ações do Organizador */}
            {isOrganizador && (
              <div className="card" style={{ border: '1px dashed var(--accent-blue)', background: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>Painel do Organizador</h4>
                {torneio.status === 'inscricoes_abertas' && (
                  <button className="btn btn-primary" onClick={handleIniciarTorneio}>
                    ▶ Iniciar Torneio e Gerar Chaves
                  </button>
                )}
                {torneio.status === 'em_andamento' && (
                  <button className="btn btn-secondary" onClick={handleFinalizarTorneio} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>
                    🛑 Finalizar Torneio Definitivamente
                  </button>
                )}
                <button className="btn btn-secondary" onClick={handleExcluirTorneio} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  🗑️ Excluir Torneio Definitivamente
                </button>
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Como organizador, você pode gerenciar jogos, placares, aprovar inscrições ou excluir este torneio.</small>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EQUIPES */}
        {aba === 'equipes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Equipes Inscritas ({equipes.length})</h3>
              {torneio.status === 'inscricoes_abertas' && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowInscricao(true)}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {equipes.map(e => {
                  const isExpanded = expandedTeamId === e.id;
                  const isCapitao = e.capitao_id === profile.id;
                  return (
                    <div key={e.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setExpandedTeamId(isExpanded ? null : e.id)}>
                          <h4 style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {e.nome} <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{isExpanded ? '▼' : '▶'}</span>
                          </h4>
                          <small style={{ color: 'var(--text-secondary)' }}>Capitão: {e.capitao?.nome_completo}</small>
                        </div>
                        <div>
                          {e.aprovado ? (
                            <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>✓ Confirmada</span>
                          ) : isOrganizador ? (
                            <button className="btn btn-primary btn-sm" onClick={async () => { await equipesAPI.aprovar(e.id, true); carregarDados(); }}>
                              Aprovar
                            </button>
                          ) : (
                            <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>Pendente</span>
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
          <div>
            {torneio.formato === 'todos_contra_todos' ? (
              <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>EQUIPE</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>P</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>V</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>D</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>SG</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>PRO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classificacao.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{i + 1}. {c.nome}</td>
                        <td style={{ padding: 10, textAlign: 'center', fontWeight: 700 }}>{c.pts}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{c.v}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{c.d}</td>
                        <td style={{ padding: 10, textAlign: 'center', color: c.sg >= 0 ? '#22c55e' : '#ef4444' }}>{c.sg >= 0 ? `+${c.sg}` : c.sg}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{c.pts_pro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Mata-Mata Visual Bracket
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700 }}>Árvore de Playoffs</h4>
                {jogos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>A chave será gerada quando o torneio for iniciado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {['Quartas de Final', 'Semifinal', 'Final'].map(fase => {
                      const faseMatches = jogos.filter(j => j.fase === fase);
                      if (faseMatches.length === 0) return null;
                      return (
                        <div key={fase}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, marginBottom: 8, letterSpacing: '0.05em' }}>{fase.toUpperCase()}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {faseMatches.map(j => (
                              <div key={j.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                                    <span style={{ fontWeight: j.placar_a > j.placar_b && j.status === 'finalizado' ? 800 : 500 }}>{j.equipe_a?.nome || 'A definir'}</span>
                                    <span style={{ fontWeight: 800 }}>{j.status === 'finalizado' || j.status === 'em_andamento' ? j.placar_a : '--'}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                                    <span style={{ fontWeight: j.placar_b > j.placar_a && j.status === 'finalizado' ? 800 : 500 }}>{j.equipe_b?.nome || 'A definir'}</span>
                                    <span style={{ fontWeight: 800 }}>{j.status === 'finalizado' || j.status === 'em_andamento' ? j.placar_b : '--'}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jogos.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Os confrontos estarão disponíveis após o início das partidas.</p>
            ) : (
              jogos.map(j => {
                const emProgresso = j.status === 'em_andamento';
                return (
                  <div key={j.id} className="card" style={{ borderLeft: emProgresso ? '4px solid #3b82f6' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      <span>{j.fase} {j.grupo ? `· ${j.grupo}` : ''}</span>
                      {emProgresso ? (
                        <span style={{ color: '#3b82f6', fontWeight: 800, animation: 'pulse 1.5s infinite' }}>AO VIVO ({j.tempo_total})</span>
                      ) : j.status === 'finalizado' ? (
                        <span style={{ color: '#94a3b8', fontWeight: 700 }}>FINALIZADO</span>
                      ) : (
                        <span>AGENDADO</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '6px 0' }}>
                      <div style={{ flex: 1, textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{j.equipe_a?.nome || 'A definir'}</div>
                      <div style={{ background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 8, fontWeight: 900, fontSize: 16 }}>
                        {j.status !== 'agendado' ? `${j.placar_a} x ${j.placar_b}` : 'VS'}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14 }}>{j.equipe_b?.nome || 'A definir'}</div>
                    </div>

                    {isOrganizador && j.equipe_a_id && j.equipe_b_id && j.status !== 'finalizado' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setActiveConsoleJogo(j)} style={{ width: '100%', marginTop: 10 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Líderes Individuais</h3>
            
            {statsAcumuladas.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>As estatísticas individuais serão geradas quando os jogos começarem.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lideres.cestinha && (
                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 24 }}>🏀</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: 14 }}>{lideres.cestinha.nome}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cestinha do Torneio</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{lideres.cestinha.pts} pts</div>
                  </div>
                )}

                {lideres.assistencias && (
                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 24 }}>🤝</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: 14 }}>{lideres.assistencias.nome}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Líder em Assistências</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{lideres.assistencias.ast} ast</div>
                  </div>
                )}

                {lideres.rebotes && (
                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 24 }}>💪</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: 14 }}>{lideres.rebotes.nome}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Líder em Rebotes</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{lideres.rebotes.reb} reb</div>
                  </div>
                )}

                {lideres.tocos && (
                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 24 }}>🚫</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: 14 }}>{lideres.tocos.nome}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Líder em Tocos (Blocks)</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#818cf8' }}>{lideres.tocos.tocos} blk</div>
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
  
  // Roster dos atletas para lançar estatísticas
  const [rosterA, setRosterA] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);

  // Stats formulário
  const [statsJogo, setStatsJogo] = useState({}); // { [jogadorId]: { pontos: 0, rebotes: 0, assistencias: 0, tocos: 0, roubos: 0 } }
  const [mvpId, setMvpId] = useState('');

  const timerRef = useRef(null);

  useEffect(() => {
    carregarRosters();
    
    // Parse tempo total do banco
    if (jogo.tempo_total) {
      const parts = jogo.tempo_total.split(':');
      if (parts.length === 2) {
        setTempo(parseInt(parts[0]) * 60 + parseInt(parts[1]));
      }
    }

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogo.id]);

  useEffect(() => {
    if (timerAtivo) {
      timerRef.current = setInterval(() => {
        setTempo(t => t + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
  }, [timerAtivo]);

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

  function ajustarPlacar(time, val) {
    if (time === 'A') {
      setPlacarA(p => Math.max(0, p + val));
    } else {
      setPlacarB(p => Math.max(0, p + val));
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
    if (!window.confirm('Tem certeza de que deseja encerrar e gravar o placar desta partida?')) return;
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

      onBack();
    } catch (e) {
      console.error(e);
      alert('Erro ao finalizar jogo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '20px 20px 0', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={{
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
          ← Sair do Console
        </button>
        <span style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
          CONSOLE DE MARCAÇÃO
        </span>
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

      {/* Placar Central e Controles de Pontuação (Side-by-Side) */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Team A Card */}
        <div className="card" style={{
          padding: '24px 14px',
          background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.06) 0%, rgba(26, 30, 40, 0.5) 100%)',
          border: '1.5px solid rgba(59, 130, 246, 0.25)',
          borderTop: '4px solid #3b82f6',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '235px',
          backdropFilter: 'blur(12px)',
          webkitBackdropFilter: 'blur(12px)'
        }}>
          <div style={{ width: '100%', textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{jogo.equipe_a?.nome}</span>
            <span style={{ fontSize: 96, fontWeight: 900, color: '#3b82f6', fontFamily: 'monospace', display: 'block', marginTop: 10, lineHeight: 1, letterSpacing: '-0.02em' }}>{String(placarA).padStart(2, '0')}</span>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 6, alignItems: 'center' }}>
              <button onClick={() => ajustarPlacar('A', 1)} style={{ border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)', color: '#93c5fd', borderRadius: '8px', padding: '10px 0', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+1</button>
              <button onClick={() => ajustarPlacar('A', 2)} style={{ border: 'none', background: '#3b82f6', color: '#ffffff', borderRadius: '8px', padding: '12px 0', fontSize: '18px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.08)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>+2</button>
              <button onClick={() => ajustarPlacar('A', 3)} style={{ border: '1.5px solid #fbbf24', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderRadius: '8px', padding: '10px 0', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+3</button>
            </div>
            <button onClick={() => ajustarPlacar('A', -1)} style={{ border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-secondary)', borderRadius: '8px', padding: '8px 0', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Corrigir (-1)</button>
          </div>
        </div>

        {/* VS Badge */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '30%',
          transform: 'translate(-50%, -50%)',
          background: '#0d0f14',
          border: '2.5px solid var(--border)',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          boxShadow: '0 0 15px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.05)'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>VS</span>
        </div>

        {/* Team B Card */}
        <div className="card" style={{
          padding: '24px 14px',
          background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.06) 0%, rgba(26, 30, 40, 0.5) 100%)',
          border: '1.5px solid rgba(239, 68, 68, 0.25)',
          borderTop: '4px solid #ef4444',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '235px',
          backdropFilter: 'blur(12px)',
          webkitBackdropFilter: 'blur(12px)'
        }}>
          <div style={{ width: '100%', textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{jogo.equipe_b?.nome}</span>
            <span style={{ fontSize: 96, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace', display: 'block', marginTop: 10, lineHeight: 1, letterSpacing: '-0.02em' }}>{String(placarB).padStart(2, '0')}</span>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 6, alignItems: 'center' }}>
              <button onClick={() => ajustarPlacar('B', 1)} style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: '#fca5a5', borderRadius: '8px', padding: '10px 0', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+1</button>
              <button onClick={() => ajustarPlacar('B', 2)} style={{ border: 'none', background: '#ef4444', color: '#ffffff', borderRadius: '8px', padding: '12px 0', fontSize: '18px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.08)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>+2</button>
              <button onClick={() => ajustarPlacar('B', 3)} style={{ border: '1.5px solid #fbbf24', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderRadius: '8px', padding: '10px 0', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+3</button>
            </div>
            <button onClick={() => ajustarPlacar('B', -1)} style={{ border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-secondary)', borderRadius: '8px', padding: '8px 0', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Corrigir (-1)</button>
          </div>
        </div>
      </div>

      {/* Cronômetro visor */}
      <div className={`card ${timerAtivo ? 'timer-active-pulse' : ''}`} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
        transition: 'all 0.3s ease',
        border: timerAtivo ? '1px solid #22c55e' : '1px solid var(--border)',
        padding: '24px',
        background: 'rgba(26, 30, 40, 0.5)',
        backdropFilter: 'blur(12px)',
        webkitBackdropFilter: 'blur(12px)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>TEMPO DE JOGO</span>
          <span style={{
            fontSize: '60px',
            fontFamily: 'monospace',
            fontWeight: 800,
            color: timerAtivo ? '#4ade80' : 'var(--text-primary)',
            textShadow: timerAtivo ? '0 0 12px rgba(74, 222, 128, 0.25)' : 'none',
            transition: 'color 0.3s ease, text-shadow 0.3s ease',
            lineHeight: 1
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
          <button onClick={() => setPeriodo(p => p + 1)} style={{ background: 'rgba(99, 102, 241, 0.08)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Período: {periodo}º
          </button>
        </div>
      </div>

      {/* Formulário de Estatísticas Individuais */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Estatísticas Individuais</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {allPlayers.map(p => {
            const st = statsJogo[p.jogador_id] || { pontos: 0, rebotes: 0, assistencias: 0, tocos: 0, roubos: 0 };
            return (
              <div key={p.id} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{p.jogador?.nome_completo}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4 }}>
                  {[
                    { label: 'PTS', key: 'pontos' },
                    { label: 'REB', key: 'rebotes' },
                    { label: 'AST', key: 'assistencias' },
                    { label: 'BLK', key: 'tocos' },
                    { label: 'STL', key: 'roubos' }
                  ].map(stat => (
                    <div key={stat.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 6, padding: '4px 0' }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800 }}>{stat.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
                        <button type="button" onClick={() => incrementarStat(p.jogador_id, stat.key, -1)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 900, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>-</button>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{st[stat.key]}</span>
                        <button type="button" onClick={() => incrementarStat(p.jogador_id, stat.key, 1)} style={{ background: 'none', border: 'none', color: '#22c55e', fontWeight: 900, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Eleger MVP e Encerrar */}
      <div className="card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>MVP da Partida</label>
          <select value={mvpId} onChange={e => setMvpId(e.target.value)}>
            <option value="">Selecione o destaque do jogo...</option>
            {allPlayers.map(p => (
              <option key={p.jogador_id} value={p.jogador_id}>{p.jogador?.nome_completo}</option>
            ))}
          </select>
        </div>

        <button onClick={handleFinalizarJogo} disabled={loading} style={{
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
          {loading ? 'Gravando...' : 'Finalizar Partida e Gravar Placar'}
        </button>
      </div>
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
    const city = profile.cidade_atual || profile.cidade || 'Altamira';
    const { data } = await profilesAPI.listarPorCidade(city);
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
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>
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
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Nenhum atleta encontrado na cidade.</div>
              ) : (
                filteredPlayers.map(p => (
                  <div key={p.id} onClick={() => handleAdicionarJogador(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: 'var(--bg-secondary)', cursor: 'pointer' }}>
                    {p.foto_perfil ? (
                      <img src={p.foto_perfil} alt="Avatar" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>
                        {p.nome_completo?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.nome_completo}</div>
                      {p.apelido && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>"{p.apelido}"</div>}
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
