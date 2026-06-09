import { useState } from 'react';
import { masterAPI } from '../lib/supabase';

export default function AdminNotifications({ profile, onNavigate }) {
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [recipientCount, setRecipientCount] = useState(null);

  const isMaster = profile?.role === 'master';

  async function handleEnviar(e) {
    e.preventDefault();
    setFeedback(null);
    setRecipientCount(null);

    if (!titulo.trim()) {
      setFeedback({ type: 'error', msg: 'Informe o título da notificação.' });
      return;
    }
    if (!mensagem.trim()) {
      setFeedback({ type: 'error', msg: 'Informe a mensagem da notificação.' });
      return;
    }

    setEnviando(true);
    try {
      const { data, error } = await masterAPI.sendGlobalNotification(titulo.trim(), mensagem.trim());
      if (error) throw error;

      const count = typeof data === 'number' ? data : (data?.recipient_count ?? data?.count ?? null);
      setRecipientCount(count);
      setFeedback({ type: 'success', msg: 'Notificação enviada com sucesso!' });
      setTitulo('');
      setMensagem('');
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Erro ao enviar notificação.' });
    } finally {
      setEnviando(false);
    }
  }

  if (!isMaster) {
    return (
      <div className="page-content" style={{ background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 'clamp(40px, 10vw, 56px)', marginBottom: 12, opacity: 0.3 }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Acesso negado
          </h2>
          <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(12px, 3vw, 20px) 0', maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => onNavigate('master')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: 'clamp(11px, 2.5vw, 13px)',
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: '50px',
              fontFamily: 'inherit',
              flexShrink: 0
            }}
          >
            ← Voltar
          </button>
          <div>
            <h1 style={{
              fontSize: 'clamp(18px, 5vw, 24px)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em'
            }}>
              Enviar Notificação
            </h1>
            <p style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', color: 'var(--text-secondary)' }}>
              Notificação global para todos os usuários
            </p>
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={handleEnviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'clamp(12px, 2vw, 16px)',
            padding: 'clamp(16px, 4vw, 24px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,.15)'
          }}>
            <div>
              <label style={{
                fontSize: 'clamp(11px, 2.5vw, 13px)',
                color: 'var(--text-secondary)',
                fontWeight: 700,
                display: 'block',
                marginBottom: 8,
                letterSpacing: '0.02em'
              }}>
                Título da Notificação
              </label>
              <input
                type="text"
                placeholder="Ex: Atualização importante"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                maxLength={100}
                style={{
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{
                fontSize: 'clamp(11px, 2.5vw, 13px)',
                color: 'var(--text-secondary)',
                fontWeight: 700,
                display: 'block',
                marginBottom: 8,
                letterSpacing: '0.02em'
              }}>
                Mensagem
              </label>
              <textarea
                rows={4}
                placeholder="Digite a mensagem que será enviada para todos os usuários..."
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                maxLength={500}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: 100
                }}
              />
              <div style={{
                fontSize: 'clamp(10px, 2vw, 11px)',
                color: 'var(--text-muted)',
                textAlign: 'right',
                marginTop: 4
              }}>
                {mensagem.length}/500
              </div>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div style={{
              color: feedback.type === 'success' ? '#22c55e' : '#f87171',
              background: feedback.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: feedback.type === 'success' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
              padding: 14,
              borderRadius: 12,
              fontSize: 'clamp(12px, 3vw, 14px)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              {feedback.type === 'success' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              {feedback.msg}
            </div>
          )}

          {/* Recipient Count */}
          {recipientCount !== null && (
            <div className="card" style={{
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(37,99,235,0.06) 100%)',
              border: '1px solid rgba(37,99,235,0.12)',
              borderRadius: 'clamp(12px, 2vw, 16px)',
              padding: 'clamp(14px, 3vw, 20px)',
              display: 'flex',
              alignItems: 'center',
              gap: 14
            }}>
              <div style={{
                width: 'clamp(40px, 10vw, 48px)',
                height: 'clamp(40px, 10vw, 48px)',
                borderRadius: 12,
                background: 'var(--accent-blue-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <div style={{
                  fontSize: 'clamp(22px, 5vw, 28px)',
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  fontFamily: 'monospace'
                }}>
                  {recipientCount.toLocaleString('pt-BR')}
                </div>
                <div style={{
                  fontSize: 'clamp(10px, 2.5vw, 12px)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  marginTop: 4
                }}>
                  destinatários notificados
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={enviando}
            style={{
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              height: 'clamp(48px, 12vw, 56px)',
              borderRadius: 'clamp(12px, 2vw, 16px)',
              fontWeight: 800,
              fontSize: 'clamp(13px, 3vw, 15px)',
              cursor: enviando ? 'not-allowed' : 'pointer',
              opacity: enviando ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)',
              fontFamily: 'inherit',
              letterSpacing: '0.02em'
            }}
          >
            {enviando ? (
              <div className="spinner" style={{ width: 20, height: 20, borderColor: '#fff', borderTopColor: 'transparent' }} />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Enviar para todos os usuários
              </>
            )}
          </button>
        </form>

        {/* Info */}
        <div style={{
          marginTop: 20,
          padding: 'clamp(12px, 3vw, 16px)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'clamp(10px, 2vw, 14px)',
          fontSize: 'clamp(11px, 2.5vw, 13px)',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            A notificação será enviada para todos os usuários cadastrados na plataforma.
            Ela aparecerá no centro de notificações de cada usuário.
          </span>
        </div>

      </div>
    </div>
  );
}
