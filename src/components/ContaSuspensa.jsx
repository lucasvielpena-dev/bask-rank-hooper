// Tela mostrada quando o Master suspende a conta (profiles.is_active = false).
//
// Antes desta tela, "Suspender" na aba Master não fazia efeito nenhum: o
// sistema não checava a flag em lugar algum e a pessoa continuava entrando,
// votando e criando rachão normalmente. Agora a conta fica travada aqui.

export default function ContaSuspensa({ onSair }) {
  return (
    <div
      className="page-content"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg-primary)',
      }}
    >
      <div
        className="premium-card"
        style={{
          width: '100%',
          maxWidth: 380,
          borderRadius: 18,
          padding: '28px 22px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M5.6 5.6l12.8 12.8" />
          </svg>
        </div>

        <h2
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 8,
          }}
        >
          Conta suspensa
        </h2>

        <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Seu acesso ao Ranking está bloqueado pelo organizador. Se você acha que
          foi um engano, fale com quem administra o app para liberar de novo.
        </p>

        <button
          type="button"
          onClick={onSair}
          className="btn btn-secondary"
          style={{ width: '100%', padding: '12px 0', fontWeight: 700 }}
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}
