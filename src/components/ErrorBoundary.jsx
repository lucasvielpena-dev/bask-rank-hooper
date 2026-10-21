// src/components/ErrorBoundary.jsx
//
// Sem isso, qualquer erro de renderização derruba a árvore inteira do React e
// sobra só o fundo escuro do app — sem aviso nenhum. Aconteceu de verdade: um
// `resumoAvaliacoes(null)` na Home deixou a tela toda preta depois do login.
//
// Aqui o erro fica contido: a casca do app continua de pé e o usuário vê o que
// houve, com opção de tentar de novo ou recarregar. A mensagem técnica também
// aparece, para facilitar o relato.

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('[ErrorBoundary]', erro, info?.componentStack);
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    // compacto = caiu só a área da página (header e menu seguem na tela)
    const compacto = !!this.props.compacto;

    return (
      <div
        style={{
          minHeight: compacto ? 260 : '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: compacto ? '32px 16px' : '24px',
          background: compacto ? 'transparent' : 'var(--bg-primary, #0B1220)' }}
      >
        <div
          className="premium-card"
          style={{ maxWidth: 380, width: '100%', padding: 16, textAlign: 'center' }}
        >
          <div
            style={{
              width: 52, height: 52, margin: '0 auto 14px',
              borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}
          >
            <span style={{ fontSize: 22 }}></span>
          </div>

          <h2
            style={{
              fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 22,
              color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em',
              marginBottom: 6 }}
          >
            A bola escapou
          </h2>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
            Algo deu errado ao montar esta tela. Nada do seu perfil foi perdido —
            só esta parte parou de carregar.
          </p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={() => this.setState({ erro: null })}
              style={{ borderRadius: 12, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                fontFamily: "'Inter',sans-serif" }}
            >
              Tentar de novo
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                fontFamily: "'Inter',sans-serif",
                background: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border)' }}
            >
              Recarregar
            </button>
          </div>

          <p
            style={{
              marginTop: 14, fontSize: 11, color: 'var(--text-muted)',
              fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word', opacity: 0.7 }}
          >
            {String(erro?.message || erro)}
          </p>
        </div>
      </div>
    );
  }
}
