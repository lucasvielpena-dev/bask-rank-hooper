import { useEffect, useMemo, useState } from 'react';
import { racoesAPI } from '../lib/supabase';
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

export default function Racoes({ profile, onNavigate }) {
  const { cfg } = useEsporte();
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
      if (data) setSelected(data);
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
      // lotado check
      if (countParts(r) + 1 >= r.max_jogadores) {
        await racoesAPI.finalizar && null;
      }
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
      showMsg('Rachão finalizado! Avaliem-se em Atletas.');
      await load();
      setSelected(null);
    } catch (err) {
      showMsg(err.message || 'Erro ao finalizar', 'error');
    } finally {
      setBusy(false);
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
            No Supabase SQL Editor, rode o arquivo <code>migration_features_v2.sql</code>.
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
            <div className="section-title">Participantes ({countParts(selected)})</div>
            <div className="card" style={{ marginBottom: 12 }}>
              {(selected.racao_participantes || []).filter((p) => p.status === 'confirmado').length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ninguém ainda</div>
              ) : (
                (selected.racao_participantes || [])
                  .filter((p) => p.status === 'confirmado')
                  .map((p) => (
                    <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                        {(p.usuario_id || '?').toString().slice(0, 2)}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {p.usuario_id === profile?.id ? 'Você' : `Jogador ${String(p.usuario_id).slice(0, 6)}`}
                      </div>
                    </div>
                  ))
              )}
            </div>
            {selected.status === 'finalizado' && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Rachão finalizado. Vá em <strong>Atletas</strong> para avaliar quem jogou com você.
              </p>
            )}
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSelected(null)}>Fechar</button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`} style={{ display: 'block' }}>{toast.msg}</div>
      )}
    </div>
  );
}
