import { useEsporte } from '../contexts/EsporteContext';
import { ESPORTES } from '../config/esportes';

export default function SelecionarEsporte() {
  const { setEsporte } = useEsporte();

  return (
    <div className="page-content" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
          Rank Hooper
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, fontFamily: "'Barlow Condensed', sans-serif" }}>
          Escolha o esporte
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
          Ranking, jogos e avaliações separados por modalidade.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, margin: '0 auto', width: '100%' }}>
        {Object.entries(ESPORTES).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => setEsporte(key)}
            className="card"
            style={{
              padding: '20px 18px',
              textAlign: 'left',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'var(--accent-dim)', border: '1px solid var(--accent-line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 18, color: 'var(--accent)',
            }}>
              {cfg.label.slice(0, 1)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{cfg.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{cfg.divisionSlogan}</div>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 18 }}>→</div>
          </button>
        ))}
      </div>
    </div>
  );
}
