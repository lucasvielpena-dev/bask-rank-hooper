import { useEsporte } from '../contexts/EsporteContext';
import { ESPORTES } from '../config/esportes';

const DECOR = {
  basquete: {
    emoji: '🏀',
    cor: '#e85d04',
    fundo: 'linear-gradient(135deg, rgba(232,93,4,0.18) 0%, rgba(232,93,4,0.04) 100%)',
    itens: ['Arremesso', 'Rebote', 'Assistência'],
  },
  handebol: {
    emoji: '🤾',
    cor: '#0d9488',
    fundo: 'linear-gradient(135deg, rgba(13,148,136,0.18) 0%, rgba(13,148,136,0.04) 100%)',
    itens: ['Gols', 'Interceptação', 'Bloqueio'],
  },
};

export default function SelecionarEsporte() {
  const { setEsporte } = useEsporte();

  return (
    <div className="page-content" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420, margin: '0 auto', width: '100%' }}>
        {Object.entries(ESPORTES).map(([key, cfg]) => {
          const d = DECOR[key] || { emoji: '🏅', cor: 'var(--accent)', fundo: 'var(--bg-card)', itens: [] };
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
                background: d.fundo,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* faixa colorida lateral */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: d.cor }} />

              <div style={{ padding: '18px 16px 16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                  background: 'var(--bg-card)', border: `1px solid ${d.cor}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>
                  {d.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{cfg.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{cfg.divisionSlogan}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {d.itens.map((item) => (
                      <span key={item} style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 999,
                        background: 'var(--bg-card)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ color: d.cor, fontSize: 20, alignSelf: 'center' }}>→</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
