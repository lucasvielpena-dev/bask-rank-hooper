import { useState, useEffect } from 'react';
import { masterAPI, torneiosAPI } from '../lib/supabase';
import { IconCalendario, IconVoltar, IconTrofeu } from '../components/Icons';

const STATUS_TORNEIO = {
  inscricoes_abertas: { label: 'Inscrições Abertas', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  inscricoes_encerradas: { label: 'Aguardando Início', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  em_andamento: { label: 'Em Andamento', color: 'var(--accent)', bg: 'rgba(249,115,22,0.12)' },
  finalizado: { label: 'Finalizado', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
};

export default function AdminTournaments({ profile, onNavigate }) {
  const [torneios, setTorneios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmClose, setConfirmClose] = useState(null);

  useEffect(() => {
    carregarTorneios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarTorneios() {
    setLoading(true);
    const { data } = await torneiosAPI.listar();
    setTorneios(data || []);
    setLoading(false);
  }

  async function handleClose(torneio) {
    setActionLoading(torneio.id);
    try {
      const { error } = await masterAPI.closeTournament(torneio.id);
      if (error) throw error;
      setConfirmClose(null);
      carregarTorneios();
    } catch (err) {
      alert('Erro ao fechar torneio: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(torneio) {
    setActionLoading(torneio.id);
    try {
      const { error } = await masterAPI.deleteTournament(torneio.id);
      if (error) throw error;
      setConfirmDelete(null);
      carregarTorneios();
    } catch (err) {
      alert('Erro ao excluir torneio: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="page-content" style={{ padding: '20px 20px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => onNavigate('master')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 10,
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            <IconVoltar size={18} color="var(--text-primary)" />
          </button>
          <div style={{ width: 40, height: 40, background: 'rgba(249,115,22,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconCalendario size={20} color="var(--accent)" />
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>Gerenciar Torneios</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{torneios.length} torneio(s) encontrado(s)</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(idx => (
            <div key={idx} className="skeleton" style={{ height: 110, borderRadius: '16px' }} />
          ))}
        </div>
      ) : torneios.length === 0 ? (
        <div className="empty-state">
          <IconCalendario size={48} color="var(--text-muted)" />
          <h3>Nenhum torneio encontrado</h3>
          <p>Não existem torneios cadastrados na plataforma.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
          {torneios.map((t, i) => {
            const stat = STATUS_TORNEIO[t.status] || { label: t.status, color: '#94a3b8', bg: 'rgba(0,0,0,0.1)' };
            const isDeleting = actionLoading === t.id;
            return (
              <div
                key={t.id}
                className="card card-enter"
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${stat.color}`,
                  boxShadow: 'var(--shadow)',
                  animationDelay: `${i * 30}ms`
                }}
              >
                {/* Top row: badge + date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11,
                    background: stat.bg,
                    color: stat.color,
                    padding: '3px 10px',
                    borderRadius: 50,
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    {stat.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(t.data_inicio).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                {/* Name and details */}
                <h3 style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {t.nome}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t.local_quadra} {t.cidade && `(${t.cidade})`}
                </p>

                {/* Meta row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--text-muted)'
                }}>
                  <span>Organizador: <strong style={{ color: 'var(--text-secondary)' }}>{t.organizador?.nome_completo || '—'}</strong></span>
                  <span>{t.equipes?.length ?? '—'} equipe(s)</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {t.status !== 'finalizado' && (
                    <button
                      onClick={() => setConfirmClose(t)}
                      disabled={isDeleting}
                      style={{
                        flex: 1,
                        background: 'rgba(245,158,11,0.1)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: 12,
                        padding: '10px 0',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        opacity: isDeleting ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontFamily: 'inherit',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={e => !isDeleting && (e.currentTarget.style.background = 'rgba(245,158,11,0.18)')}
                      onMouseOut={e => !isDeleting && (e.currentTarget.style.background = 'rgba(245,158,11,0.1)')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <rect width="4" height="16" x="6" y="4" />
                        <rect width="4" height="16" x="14" y="4" />
                      </svg>
                      Fechar
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(t)}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 12,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      opacity: isDeleting ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontFamily: 'inherit',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={e => !isDeleting && (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
                    onMouseOut={e => !isDeleting && (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Confirmar Fechar */}
      {confirmClose && (
        <div className="modal-overlay" onClick={() => setConfirmClose(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-handle" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: 'rgba(245,158,11,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <IconTrofeu size={24} color="#f59e0b" />
              </div>
              <h3 style={{ fontWeight: 900, fontSize: 18, marginBottom: 6, color: 'var(--text-primary)' }}>Fechar Torneio</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                Deseja fechar o torneio <strong style={{ color: 'var(--text-primary)' }}>{confirmClose.nome}</strong>?
                Esta ação encerrará o torneio e o marcará como <strong style={{ color: 'var(--text-primary)' }}>Finalizado</strong>.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmClose(null)}
                  disabled={actionLoading === confirmClose.id}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  className="btn"
                  onClick={() => handleClose(confirmClose)}
                  disabled={actionLoading === confirmClose.id}
                  style={{
                    flex: 1,
                    background: '#f59e0b',
                    color: '#000',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {actionLoading === confirmClose.id ? <div className="spinner" /> : 'Fechar Torneio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Excluir */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-handle" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: 'rgba(239,68,68,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              </div>
              <h3 style={{ fontWeight: 900, fontSize: 18, marginBottom: 6, color: '#ef4444' }}>Excluir Torneio</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                Tem certeza que deseja excluir <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.nome}</strong>?
                Esta ação é <strong style={{ color: '#ef4444' }}>irreversível</strong> e apagará todas as equipes, jogos e estatísticas.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmDelete(null)}
                  disabled={actionLoading === confirmDelete.id}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  className="btn"
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={actionLoading === confirmDelete.id}
                  style={{
                    flex: 1,
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {actionLoading === confirmDelete.id ? <div className="spinner" /> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
