import { useEffect, useMemo, useState } from 'react';
import { supabase, racoesAPI, votacaoAPI, votacaoHandebolAPI } from '../lib/supabase';
import { resolveAuthUserId } from '../lib/authUser';
import { useEsporte } from '../contexts/EsporteContext';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function countParts(r) {
  return (r.racao_participantes || []).filter((p) => p.status === 'confirmado').length;
}

// Modelo 1: Game Grade — nota da partida por letra (A+ a F, com D/F unificados)
const GRADES = [
  { key: 'A+', titulo: 'MVP do Racha', desc: 'Dominou o jogo, decidiu nos momentos decisivos e carregou o time.', valor: 5, cor: '#C8F135' },
  { key: 'A', titulo: 'Ótima Atuação', desc: 'Jogou muito acima da média, eficiente no ataque e na defesa.', valor: 4, cor: '#A3E635' },
  { key: 'B', titulo: 'Sólido / Cumpriu o Papel', desc: 'Fez o feijão com arroz bem feito, ajudou o time a ser competitivo.', valor: 3, cor: '#38BDF8' },
  { key: 'C', titulo: 'Apagado / Discreto', desc: 'Jogou abaixo do seu potencial ou cometeu erros bobos, mas não comprometeu totalmente.', valor: 2, cor: '#FBBF24' },
  { key: 'D/F', titulo: 'Dia para Esquecer', desc: 'Forçou arremessos, não defendeu, prendeu a bola ou entregou o jogo.', valor: 1, cor: '#EF4444' },
];

function gradePorValor(valor) {
  const v = Number(valor) || 0;
  if (v >= 5) return 'A+';
  if (v === 4) return 'A';
  if (v === 3) return 'B';
  if (v === 2) return 'C';
  return 'D/F';
}

function GradePicker({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {GRADES.map((g) => {
        const sel = value === g.key;
        return (
          <button
            key={g.key}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(g.key)}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12,
              border: sel ? `2px solid ${g.cor}` : '1px solid var(--border)',
              background: sel ? `${g.cor}22` : 'var(--bg-card)',
              color: sel ? g.cor : 'var(--text-primary)',
              fontWeight: 900, fontSize: g.key.length > 1 ? 15 : 17,
              fontFamily: "'Barlow Condensed', sans-serif",
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {g.key}
          </button>
        );
      })}
    </div>
  );
}

export default function Racoes({ profile, onNavigate }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    local: '',
    data_hora: '',
    max_jogadores: 10,
    nivel: 'Todos',
  });

  const cidade = profile?.cidade_atual || profile?.cidade || 'Altamira';
  const uf = profile?.uf || 'PA';

  const { esporte, cfg } = useEsporte();
  const apiVoto = esporte === 'handebol' ? votacaoHandebolAPI : votacaoAPI;

  const [votingPlayer, setVotingPlayer] = useState(null);
  const [notaGrade, setNotaGrade] = useState(null);
  const [comentarioVoto, setComentarioVoto] = useState('');
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  const [avaliados, setAvaliados] = useState({});

  async function load() {
    setLoading(true);
    setErro(null);
    const { data, error } = await racoesAPI.listar({ cidade, uf });
    if (error) {
      setErro(error.message || 'Erro ao carregar rachões. Rode a migration SQL no Supabase.');
      setLista([]);
    } else {
      setLista(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [cidade, uf]);

  function showMsg(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  const abertos = useMemo(
    () => lista.filter((r) => r.status === 'aberto' || r.status === 'lotado'),
    [lista]
  );
  const finalizados = useMemo(
    () => lista.filter((r) => r.status === 'finalizado').slice(0, 10),
    [lista]
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.data_hora) {
      showMsg('Preencha título e data/hora', 'error');
      return;
    }
    setBusy(true);
    try {
      const uid = await resolveAuthUserId();
      if (!uid) throw new Error('Faça login novamente');
      const { data, error } = await racoesAPI.criar({
        titulo: form.titulo.trim(),
        local: form.local.trim() || null,
        cidade,
        uf,
        data_hora: new Date(form.data_hora).toISOString(),
        max_jogadores: Number(form.max_jogadores) || 10,
        nivel: form.nivel,
        criado_por: uid,
        jogador_id: profile?.player_id || null,
        esporte: 'basquete',
        status: 'aberto',
      });
      if (error) throw error;
      showMsg('Rachão criado!');
      setShowCreate(false);
      setForm({ titulo: '', local: '', data_hora: '', max_jogadores: 10, nivel: 'Todos' });
      await load();
      if (data?.id) {
        const { data: full } = await racoesAPI.obter(data.id);
        setSelected(full || data);
      }
    } catch (err) {
      showMsg(err.message || 'Erro ao criar', 'error');
    } finally {
      setBusy(false);
    }
  }

  function isIn(r) {
    const uid = profile?.id;
    return (r.racao_participantes || []).some(
      (p) => p.usuario_id === uid && p.status === 'confirmado'
    );
  }

  async function handleJoin(r) {
    setBusy(true);
    try {
      const uid = await resolveAuthUserId();
      if (!uid) throw new Error('Faça login novamente');
      if (countParts(r) >= r.max_jogadores) throw new Error('Rachão lotado');
      const { error } = await racoesAPI.entrar({
        racaoId: r.id,
        usuarioId: uid,
        jogadorId: profile?.player_id || null,
      });
      if (error) throw error;
      showMsg('Você entrou no rachão!');
      await load();
    } catch (err) {
      showMsg(err.message || 'Erro ao entrar', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave(r) {
    setBusy(true);
    try {
      const uid = await resolveAuthUserId();
      const { error } = await racoesAPI.sair({ racaoId: r.id, usuarioId: uid });
      if (error) throw error;
      showMsg('Você saiu do rachão');
      await load();
    } catch (err) {
      showMsg(err.message || 'Erro ao sair', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish(r) {
    if (!window.confirm('Finalizar rachão e liberar avaliações entre participantes?')) return;
    setBusy(true);
    try {
      const { error } = await racoesAPI.finalizar(r.id);
      if (error) throw error;
      showMsg('Rachão finalizado! Avalie quem jogou.');
      await load();
      const { data } = await racoesAPI.obter(r.id);
      setSelected(data || { ...r, status: 'finalizado' });
    } catch (err) {
      showMsg(err.message || 'Erro ao finalizar', 'error');
    } finally {
      setBusy(false);
    }
  }

  function jogadorIdDe(p) {
    return p.jogador_id || p.perfil?.player_id || null;
  }

  function nomeParticipante(p) {
    if (p.usuario_id === profile?.id) return 'Você';
    return p.perfil?.apelido || p.perfil?.nome_completo || p.jogador?.apelido || p.jogador?.nome
      || `Jogador ${String(p.usuario_id).slice(0, 6)}`;
  }

  function fotoParticipante(p) {
    return p.perfil?.foto_perfil || p.jogador?.foto_url || null;
  }

  function abrirAvaliacao(p) {
    const jid = jogadorIdDe(p);
    if (!jid) return;
    const anterior = avaliados[jid];
    setVotingPlayer({
      id: jid,
      nome: p.jogador?.nome || p.perfil?.nome_completo || 'Atleta',
      apelido: p.jogador?.apelido || p.perfil?.apelido || null,
      foto_url: fotoParticipante(p),
    });
    setNotaGrade(anterior && typeof anterior === 'object'
      ? gradePorValor(anterior[cfg.habilidades[0].key])
      : null);
    setComentarioVoto((anterior && anterior.comentario) || '');
  }

  async function carregarMeusVotos(ids) {
    if (!ids.length) { setAvaliados({}); return; }
    try {
      const uid = await resolveAuthUserId();
      if (!uid) return;
      const { data } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('avaliador_id', uid)
        .in('jogador_id', ids);
      setAvaliados(Object.fromEntries((data || []).map((a) => [a.jogador_id, a])));
    } catch (e) {
      setAvaliados({});
    }
  }

  useEffect(() => {
    if (!selected || selected.status !== 'finalizado') { setAvaliados({}); return; }
    const ids = (selected.racao_participantes || [])
      .filter((p) => p.status === 'confirmado' && p.usuario_id !== profile?.id)
      .map(jogadorIdDe)
      .filter(Boolean);
    carregarMeusVotos(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function handleSubmitVoto(e) {
    e.preventDefault();
    const grade = GRADES.find((g) => g.key === notaGrade);
    if (!grade) {
      showMsg('Escolha a nota da partida (A+ a F)', 'error');
      return;
    }
    setEnviandoVoto(true);
    try {
      // Cada letra vale uma nota equivalente em todos os fundamentos,
      // mantendo o mesmo cálculo de média do ranking.
      const payload = Object.fromEntries(cfg.habilidades.map((h) => [h.key, grade.valor]));
      const { data, error } = await apiVoto.votar(votingPlayer.id, {
        ...payload,
        comentario: comentarioVoto.trim() || null,
      });
      if (error || !data?.sucesso) {
        throw new Error(data?.erro || error?.message || 'Erro ao registrar avaliação.');
      }
      setAvaliados((prev) => ({ ...prev, [votingPlayer.id]: { [cfg.habilidades[0].key]: grade.valor, comentario: comentarioVoto.trim() || null } }));
      showMsg(`✓ Nota ${grade.key} registrada! Nova média: ★ ${Number(data.media_estrelas || 0).toFixed(1)}`);
      setVotingPlayer(null);
    } catch (err) {
      showMsg(err.message || 'Erro ao avaliar', 'error');
    } finally {
      setEnviandoVoto(false);
    }
  }

  function Card({ r }) {
    const n = countParts(r);
    const mine = isIn(r);
    const isCreator = r.criado_por === profile?.id;
    return (
      <div className="card racao-card" onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{r.titulo}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {r.local || 'Local a definir'} · {r.cidade}
            </div>
          </div>
          <span className={`badge ${r.status === 'aberto' ? 'badge-elite' : r.status === 'finalizado' ? 'badge-desenvolvimento' : 'badge-destaque'}`}>
            {r.status}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span className="badge">{formatWhen(r.data_hora)}</span>
          <span className="badge">{n}/{r.max_jogadores} jogadores</span>
          <span className="badge">{r.nivel}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
          {r.status === 'aberto' && !mine && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleJoin(r)}>Entrar</button>
          )}
          {r.status === 'aberto' && mine && !isCreator && (
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleLeave(r)}>Sair</button>
          )}
          {isCreator && r.status !== 'finalizado' && r.status !== 'cancelado' && (
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleFinish(r)}>Finalizar</button>
          )}
        </div>
      </div>
    );
  }

  const gradeAtual = GRADES.find((g) => g.key === notaGrade) || null;

  return (
    <div className="page-content" style={{ padding: '16px 14px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif" }}>RACHÕES</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Pickup em {cidade} · entre, jogue e avalie
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Criar</button>
      </div>

      {erro && (
        <div className="card" style={{ borderColor: 'var(--border-danger)', marginBottom: 12, fontSize: 13, color: 'var(--text-danger)' }}>
          {erro}
          <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12 }}>
            No Supabase SQL Editor, rode o arquivo <code>migration_racoes.sql</code>.
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /> Carregando...</div>
      ) : (
        <>
          <div className="section-title">Abertos</div>
          {abertos.length === 0 ? (
            <div className="empty-state">
              <h3>Nenhum rachão aberto</h3>
              <p>Crie o primeiro e chame a galera.</p>
              <button className="btn btn-primary" style={{ marginTop: 12, width: 'auto' }} onClick={() => setShowCreate(true)}>
                Criar rachão
              </button>
            </div>
          ) : abertos.map((r) => <Card key={r.id} r={r} />)}

          {finalizados.length > 0 && (
            <>
              <div className="section-title">Finalizados</div>
              {finalizados.map((r) => <Card key={r.id} r={r} />)}
            </>
          )}
        </>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ marginBottom: 14, fontWeight: 800 }}>Novo rachão</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Título</label>
                <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Rachão sexta 19h" required />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Local</label>
                <input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Quadra / ginásio" />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Data e hora</label>
                <input type="datetime-local" value={form.data_hora} onChange={(e) => setForm({ ...form, data_hora: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Vagas</label>
                  <select value={form.max_jogadores} onChange={(e) => setForm({ ...form, max_jogadores: e.target.value })}>
                    {[6, 8, 10, 12, 14].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nível</label>
                  <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })}>
                    {['Todos', 'Iniciante', 'Intermediário', 'Avançado'].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Criando...' : 'Criar rachão'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, marginBottom: 6 }}>{selected.titulo}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              {selected.local || 'Local a definir'} · {formatWhen(selected.data_hora)}
            </p>
            <div className="section-title">
              {selected.status === 'finalizado'
                ? `Quem jogou — avalie agora`
                : `Participantes (${countParts(selected)})`}
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              {(selected.racao_participantes || []).filter((p) => p.status === 'confirmado').length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ninguém ainda</div>
              ) : (
                (selected.racao_participantes || [])
                  .filter((p) => p.status === 'confirmado')
                  .map((p) => {
                    const nome = nomeParticipante(p);
                    const foto = fotoParticipante(p);
                    const jid = jogadorIdDe(p);
                    const souEu = p.usuario_id === profile?.id;
                    const podeAvaliar = selected.status === 'finalizado' && !souEu;
                    return (
                      <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        {foto ? (
                          <img src={foto} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                            {nome.toString().slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                          {nome}
                        </div>
                        {podeAvaliar && (
                          jid ? (
                            <button
                              className={`btn ${avaliados[jid] ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                              disabled={busy || enviandoVoto}
                              onClick={() => abrirAvaliacao(p)}
                            >
                              {avaliados[jid] ? '✓ Avaliado' : 'Avaliar'}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>sem perfil de atleta</span>
                          )
                        )}
                      </div>
                    );
                  })
              )}
            </div>
            {selected.status === 'finalizado' && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Dê sua nota para quem jogou neste rachão — isso alimenta o ranking.
              </p>
            )}
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSelected(null)}>Fechar</button>
          </div>
        </div>
      )}

      {votingPlayer && (
        <div className="modal-overlay" onClick={() => { if (!enviandoVoto) setVotingPlayer(null); }}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 800, textAlign: 'center', marginBottom: 2 }}>
              Nota da partida de {votingPlayer.apelido || votingPlayer.nome}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
              Como ele jogou neste racha?
            </p>
            <form onSubmit={handleSubmitVoto} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <GradePicker value={notaGrade} onChange={setNotaGrade} disabled={enviandoVoto} />

              {gradeAtual ? (
                <div style={{
                  marginTop: 12, padding: '12px 14px', borderRadius: 12,
                  background: 'var(--bg-card)', border: `1px solid ${gradeAtual.cor}66`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontSize: 36, fontWeight: 900, lineHeight: 1,
                      fontFamily: "'Barlow Condensed', sans-serif", color: gradeAtual.cor,
                    }}>
                      {gradeAtual.key}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{gradeAtual.titulo}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{gradeAtual.desc}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
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
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setVotingPlayer(null)}
                  disabled={enviandoVoto}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  disabled={enviandoVoto || !notaGrade}
                >
                  {enviandoVoto ? 'Enviando...' : 'Confirmar nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`} style={{ display: 'block' }}>{toast.msg}</div>
      )}
    </div>
  );
}
