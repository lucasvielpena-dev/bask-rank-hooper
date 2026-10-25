import { useEsporte } from '../contexts/EsporteContext';
import { ESPORTES } from '../config/esportes';

const VISUAL = {
  basquete: {
    imagem: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
    tags: ['Arremesso', 'Rebote', 'Assistência'],
  },
  handebol: {
    imagem: '/images/handebol.jpg',
    tags: ['Gols', 'Interceptação', 'Bloqueio'],
  },
};

export default function SelecionarEsporte() {
  const { setEsporte } = useEsporte();

  return (
    <div className="page-content" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Rank Hooper
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Escolha o esporte
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6, lineHeight: 1.4 }}>
          Ranking, jogos e avaliações separados por modalidade.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400, margin: '0 auto', width: '100%' }}>
        {Object.entries(ESPORTES).map(([key, cfg]) => {
          const v = VISUAL[key] || {};
          return (
            <button
              key={key}
              type="button"
              onClick={() => setEsporte(key)}
              className="card"
              style={{
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                overflow: 'hidden',
                borderRadius: 16,
              }}
            >
              {/* imagem de capa */}
              <div style={{
                height: 100,
                backgroundImage: `url(${v.imagem})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, var(--bg-card) 0%, transparent 60%)',
                }} />
              </div>

              <div style={{ padding: '4px 16px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{cfg.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{cfg.divisionSlogan}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {(v.tags || []).map((item) => (
                    <span key={item} style={{
                      fontSize: 11, fontWeight: 500,
                      padding: '4px 10px', borderRadius: 6,
                      background: 'var(--bg-elevated, rgba(255,255,255,0.06))',
                      color: 'var(--text-secondary)',
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
