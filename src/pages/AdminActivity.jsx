import { useEffect, useMemo, useState } from 'react';
import { partidasAPI, racoesAPI, torneiosAPI, masterAPI } from '../lib/supabase';
import Portal from '../components/Portal';
import MasterNav from '../components/MasterNav';

const ABAS = [
  { id: 'partidas', label: 'Partidas' },
  { id: 'racoes', label: 'Rachões' },
  { id: 'torneios', label: 'Torneios' },
];

function fmtData(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function StatusPill({ label, tone = 'muted' }) {
  const colors = {
    ok: { bg: 'var(--success-soft)', fg: 'var(--success-text)' },
    warn: { bg: 'rgba(251,191,36,0.12)', fg: '#fbbf24' },
    info: { bg: 'rgba(96,165,250,0.12)', fg: '#93c5fd' },
    muted: { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8' },
  };
  const c = colors[tone] || colors.muted;
  return (
    <span
      className="text-sm"
      style={{
        fontWeight: 800,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        padding: '4px 8px',
        borderRadius: 99,
        background: c.bg,
        color: c.fg }}
    >
      {label}
    </span>
  );
}

function statusPartida(s) {
  if (s === 'ativo' || s === 'em_andamento') return { label: 'Ao vivo', tone: 'ok' };
  if (s === 'finalizado') return { label: 'Finalizado', tone: 'muted' };
  return { label: s || '—', tone: 'info' };
}

function statusRacao(s) {
  if (s === 'aberto') return { label: 'Aberto', tone: 'ok' };
  if (s === 'em_andamento') return { label: 'Rolando', tone: 'warn' };
  if (s === 'lotado') return { label: 'Lotado', tone: 'info' };
  if (s === 'finalizado') return { label: 'Fechado', tone: 'muted' };
  return { label: s || '—', tone: 'muted' };
}

function statusTorneio(s) {
  if (s === 'em_andamento') return { label: 'Em andamento', tone: 'ok' };
  if (s === 'inscricoes_abertas') return { label: 'Inscrições', tone: 'warn' };
  if (s === 'finalizado') return { label: 'Finalizado', tone: 'muted' };
  return { label: s || '—', tone: 'info' };
}

export default function AdminActivity({ profile, onNavigate }) {
  const [aba, setAba] = useState('partidas');
  const [cidade, setCidade] = useState('todas');
  const [partidas, setPartidas] = useState([]);
  const [racoes, setRacoes] = useState([]);
  const [torneios, setTorneios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [detalhe, setDetalhe] = useState(null); // { tipo, item }
  const [confirmacao, setConfirmacao] = useState(null); // { acao: 'fechar'|'excluir', item }
  const [executando, setExecutando] = useState(false);

  const isMaster = profile?.role === 'master' || profile?.role === 'admin';

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [pRes, rRes, tRes] = await Promise.all([
        partidasAPI.listar('basquete'),
        racoesAPI.listar({}), // sem filtro de cidade
        torneiosAPI.listar(),
      ]);
      // Rachões: API limita a 40; se houver erro, lista vazia
      setPartidas(Array.isArray(pRes.data) ? pRes.data : []);
      setRacoes(Array.isArray(rRes.data) ? rRes.data : []);
      setTorneios(Array.isArray(tRes.data) ? tRes.data : []);
      if (pRes.error || rRes.error || tRes.error) {
        const msg = pRes.error?.message || rRes.error?.message || tRes.error?.message;
        if (msg) setErro(msg);
      }
    } catch (e) {
      setErro(e.message || 'Erro ao carregar atividade');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isMaster) carregar();
  }, [isMaster]);

  const cidades = useMemo(() => {
    const set = new Set();
    [...partidas, ...racoes, ...torneios].forEach((x) => {
      const c = (x.cidade || '').trim();
      if (c) set.add(c);
    });
    return ['todas', ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [partidas, racoes, torneios]);

  const filtrarCidade = (list) => {
    if (cidade === 'todas') return list;
    return list.filter((x) => (x.cidade || '').trim() === cidade);
  };

  const partidasF = useMemo(() => filtrarCidade(partidas), [partidas, cidade]);
  const racoesF = useMemo(() => filtrarCidade(racoes), [racoes, cidade]);
  const torneiosF = useMemo(() => filtrarCidade(torneios), [torneios, cidade]);

  if (!isMaster) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <p className="page-sub">Acesso restrito ao Master.</p>
      </div>
    );
  }

  return (
    <div className="page-content home-page" style={{ background: 'var(--bg-primary)' }}>
      <div className="home-container" style={{ padding: '16px 16px 28px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div>
            <h1 className="page-title">Atividade</h1>
            <p className="page-sub">Partidas, rachões e torneios de todas as cidades</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={carregar}>
            Atualizar
          </button>
        </div>

        <MasterNav current="master-activity" onNavigate={onNavigate} />

        {/* Filtro cidade */}
        <div style={{ marginBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: 8, minWidth: 'min-content' }}>
            {cidades.map((c) => (
              <button
                key={c}
                type="button"
                className={`admin-chip ${cidade === c ? 'active' : ''}`}
                onClick={() => setCidade(c)}
              >
                {c === 'todas' ? 'Todas' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Abas */}
        <div className="tabs-row" style={{ marginBottom: 12 }}>
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`tab ${aba === a.id ? 'active' : ''}`}
              onClick={() => setAba(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>

        {erro && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
              fontSize: 'var(--fs-sm)' }}
          >
            {erro}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : aba === 'partidas' ? (
          <ListaPartidas list={partidasF} onOpen={(item) => setDetalhe({ tipo: 'partida', item })} />
        ) : aba === 'racoes' ? (
          <ListaRacoes list={racoesF} onOpen={(item) => setDetalhe({ tipo: 'racao', item })} />
        ) : (
          <ListaTorneios list={torneiosF} onOpen={(item) => setDetalhe({ tipo: 'torneio', item })} />
        )}

        {detalhe && (
          <Portal>
            <DetalheModal
              detalhe={detalhe}
              onClose={() => setDetalhe(null)}
              onFechar={(item) => setConfirmacao({ acao: 'fechar', item })}
              onExcluir={(item) => setConfirmacao({ acao: 'excluir', item })}
            />
          </Portal>
        )}

        {confirmacao && (
          <Portal>
            <ConfirmacaoTorneio
              confirmacao={confirmacao}
              executando={executando}
              onCancelar={() => setConfirmacao(null)}
              onConfirmar={async () => {
                setExecutando(true);
                try {
                  const id = confirmacao.item.id;
                  const { error } = confirmacao.acao === 'fechar'
                    ? await masterAPI.closeTournament(id)
                    : await masterAPI.deleteTournament(id);
                  if (error) throw error;
                  setConfirmacao(null);
                  setDetalhe(null);
                  carregar();
                } catch (err) {
                  alert('Erro: ' + (err.message || 'Erro desconhecido'));
                } finally {
                  setExecutando(false);
                }
              }}
            />
          </Portal>
        )}
      </div>
    </div>
  );
}

function ListaPartidas({ list, onOpen }) {
  if (!list.length) {
    return (
      <div className="premium-card" style={{ borderRadius: 14, padding: 24, textAlign: 'center' }}>
        <p className="page-sub" style={{ margin: 0 }}>Nenhuma partida nesta visão.</p>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((p) => {
        const st = statusPartida(p.status);
        return (
          <button
            key={p.id}
            type="button"
            className="premium-card"
            onClick={() => onOpen(p)}
            style={{
              borderRadius: 14,
              padding: '12px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <StatusPill {...st} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {p.cidade || 'Sem cidade'}{p.uf ? ` · ${p.uf}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.time_a || 'Time A'}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 72 }}>
                <div className="text-lg" style={{ margin: 0, color: 'var(--accent)', fontSize: 22 }}>
                  {p.placar_time_a ?? 0}–{p.placar_time_b ?? 0}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.time_b || 'Time B'}</div>
              </div>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              {fmtData(p.created_at)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ListaRacoes({ list, onOpen }) {
  if (!list.length) {
    return (
      <div className="premium-card" style={{ borderRadius: 14, padding: 24, textAlign: 'center' }}>
        <p className="page-sub" style={{ margin: 0 }}>Nenhum rachão nesta visão.</p>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((r) => {
        const st = statusRacao(r.status);
        const n = r.racao_participantes?.length ?? r.participantes_count ?? 0;
        return (
          <button
            key={r.id}
            type="button"
            className="premium-card"
            onClick={() => onOpen(r)}
            style={{
              borderRadius: 14,
              padding: '12px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <StatusPill {...st} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {r.cidade || '—'}{r.uf ? ` · ${r.uf}` : ''}
              </span>
            </div>
            <div className="text-md" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
              {r.titulo || r.local || 'Rachão'}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              {fmtData(r.data_hora || r.created_at)} · {n} participante{n !== 1 ? 's' : ''}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ListaTorneios({ list, onOpen }) {
  if (!list.length) {
    return (
      <div className="premium-card" style={{ borderRadius: 14, padding: 24, textAlign: 'center' }}>
        <p className="page-sub" style={{ margin: 0 }}>Nenhum torneio nesta visão.</p>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((t) => {
        const st = statusTorneio(t.status);
        return (
          <button
            key={t.id}
            type="button"
            className="premium-card"
            onClick={() => onOpen(t)}
            style={{
              borderRadius: 14,
              padding: '12px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <StatusPill {...st} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t.cidade || '—'}{t.uf ? ` · ${t.uf}` : ''}
              </span>
            </div>
            <div className="text-md" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t.nome}</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              {t.local_quadra || 'Local —'} · {fmtData(t.data_inicio || t.created_at)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DetalheModal({ detalhe, onClose, onFechar, onExcluir }) {
  const { tipo, item } = detalhe;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-handle" />
        <h3 className="page-title" style={{ fontSize: 17, marginBottom: 8 }}>
          {tipo === 'partida' ? 'Partida' : tipo === 'racao' ? 'Rachão' : 'Torneio'}
        </h3>

        {tipo === 'partida' && (
          <>
            <div className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              {item.cidade || 'Sem cidade'}{item.uf ? ` · ${item.uf}` : ''} · {fmtData(item.created_at)}
            </div>
            <div className="premium-card" style={{ borderRadius: 14, padding: 16, marginBottom: 12, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div className="text-sm" style={{ fontWeight: 700 }}>{item.time_a || 'Time A'}</div>
                  <div className="text-lg" style={{ color: 'var(--accent)', margin: '6px 0 0' }}>{item.placar_time_a ?? 0}</div>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 800 }}>X</div>
                <div style={{ flex: 1 }}>
                  <div className="text-sm" style={{ fontWeight: 700 }}>{item.time_b || 'Time B'}</div>
                  <div className="text-lg" style={{ color: '#4CC9F0', margin: '6px 0 0' }}>{item.placar_time_b ?? 0}</div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <StatusPill {...statusPartida(item.status)} />
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Status: <strong>{item.status || '—'}</strong>
              {item.periodo != null ? ` · Período ${item.periodo}` : ''}
            </p>
          </>
        )}

        {tipo === 'racao' && (
          <>
            <div className="text-md" style={{ fontWeight: 800, marginBottom: 8 }}>{item.titulo || item.local || 'Rachão'}</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              {item.cidade || '—'} · {fmtData(item.data_hora || item.created_at)}
            </div>
            <StatusPill {...statusRacao(item.status)} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.45 }}>
              {(item.racao_participantes || []).length} participante(s)
              {item.local ? ` · ${item.local}` : ''}
            </p>
            {(item.racao_participantes || []).slice(0, 12).map((pp) => (
              <div key={pp.id} className="text-sm" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {pp.jogador?.apelido || pp.jogador?.nome || pp.perfil?.apelido || pp.perfil?.nome_completo || 'Participante'}
              </div>
            ))}
          </>
        )}

        {tipo === 'torneio' && (
          <>
            <div className="text-md" style={{ fontWeight: 800, marginBottom: 8 }}>{item.nome}</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              {item.cidade || '—'} · {item.local_quadra || 'Local —'}
            </div>
            <StatusPill {...statusTorneio(item.status)} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.45 }}>
              Formato: {item.formato === 'eliminatoria_simples' ? 'Mata-mata' : item.formato || '—'}
              <br />
              Início: {fmtData(item.data_inicio || item.created_at)}
              <br />
              Organizador: {item.organizador?.nome_completo || '—'}
            </p>
          </>
        )}

        {tipo === 'torneio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {item.status !== 'finalizado' && (
              <button type="button" className="btn" style={{ width: '100%', background: '#f59e0b', color: '#000', fontWeight: 800 }} onClick={() => onFechar?.(item)}>
                Fechar torneio
              </button>
            )}
            <button type="button" className="btn" style={{ width: '100%', background: '#ef4444', color: '#fff', fontWeight: 800 }} onClick={() => onExcluir?.(item)}>
              Excluir torneio
            </button>
          </div>
        )}

        <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

function ConfirmacaoTorneio({ confirmacao, executando, onCancelar, onConfirmar }) {
  const excluir = confirmacao.acao === 'excluir';
  const nome = confirmacao.item?.nome || 'este torneio';
  return (
    <div className="modal-overlay" onClick={executando ? undefined : onCancelar} style={{ zIndex: 1300 }}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-handle" />
        <h3 className="page-title" style={{ fontSize: 17, marginBottom: 8, color: excluir ? '#ef4444' : 'var(--text-primary)' }}>
          {excluir ? 'Excluir torneio' : 'Fechar torneio'}
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
          {excluir
            ? <>Excluir <strong>{nome}</strong>? Isso apaga equipes, jogos e estatísticas e não pode ser desfeito.</>
            : <>Fechar <strong>{nome}</strong>? Ele será marcado como finalizado.</>}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} disabled={executando} onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            style={{ flex: 1, fontWeight: 800, background: excluir ? '#ef4444' : '#f59e0b', color: excluir ? '#fff' : '#000' }}
            disabled={executando}
            onClick={onConfirmar}
          >
            {executando ? <div className="spinner" /> : (excluir ? 'Excluir' : 'Fechar torneio')}
          </button>
        </div>
      </div>
    </div>
  );
}
