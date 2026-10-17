import { memo } from 'react';

// ============================================================
// Game Grade — nota da PARTIDA por letra (A+ a F, com D/F unificados)
// Usado nos Rachões e nas Competições.
// ============================================================
export const GRADES = [
  { key: 'A+', titulo: 'MVP do Racha', desc: 'Dominou o jogo, decidiu nos momentos decisivos e carregou o time.', valor: 5, cor: '#C8F135' },
  { key: 'A', titulo: 'Ótima Atuação', desc: 'Jogou muito acima da média, eficiente no ataque e na defesa.', valor: 4, cor: '#A3E635' },
  { key: 'B', titulo: 'Sólido / Cumpriu o Papel', desc: 'Fez o feijão com arroz bem feito, ajudou o time a ser competitivo.', valor: 3, cor: '#38BDF8' },
  { key: 'C', titulo: 'Apagado / Discreto', desc: 'Jogou abaixo do seu potencial ou cometeu erros bobos, mas não comprometeu totalmente.', valor: 2, cor: '#FBBF24' },
  { key: 'D/F', titulo: 'Dia para Esquecer', desc: 'Forçou arremessos, não defendeu, prendeu a bola ou entregou o jogo.', valor: 1, cor: '#EF4444' },
];

export function gradePorValor(valor) {
  const v = Number(valor) || 0;
  if (v >= 5) return 'A+';
  if (v === 4) return 'A';
  if (v === 3) return 'B';
  if (v === 2) return 'C';
  return 'D/F';
}

export function gradeInfo(key) {
  return GRADES.find((g) => g.key === key) || null;
}

export const GradePicker = memo(function GradePicker({ value, onChange, disabled }) {
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
});

// ============================================================
// Semáforo de rendimento — mostra, de forma agregada e anônima,
// como o jogador foi no jogo: verde, amarelo ou vermelho.
// ============================================================
export const CORES_RENDIMENTO = {
  bem: '#22C55E',
  media: '#FACC15',
  mal: '#EF4444',
  neutro: '#64748B',
};

export function rendimento(media, total) {
  const t = Number(total) || 0;
  if (!t) return { cor: CORES_RENDIMENTO.neutro, label: 'Sem notas', pct: null, total: 0 };
  const m = Number(media) || 0;
  const pct = Math.max(0, Math.min(100, Math.round((m / 5) * 100)));
  if (m >= 3.5) return { cor: CORES_RENDIMENTO.bem, label: 'Foi bem', pct, total: t };
  if (m >= 2.5) return { cor: CORES_RENDIMENTO.media, label: 'Na média', pct, total: t };
  return { cor: CORES_RENDIMENTO.mal, label: 'Não foi bem', pct, total: t };
}

export const RendimentoPill = memo(function RendimentoPill({ media, total, showLabel = false }) {
  const r = rendimento(media, total);
  return (
    <span
      title={r.pct === null ? 'Sem avaliações ainda' : `${r.label} · ${r.total} avaliação(ões)`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 9px', borderRadius: 999,
        background: `${r.cor}22`, border: `1px solid ${r.cor}66`,
        color: r.cor, fontSize: 11, fontWeight: 800,
        fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.cor, display: 'inline-block' }} />
      {r.pct === null ? '—' : `${r.pct}%`}
      {showLabel && <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{r.label}</span>}
    </span>
  );
});

export const LegendaRendimento = memo(function LegendaRendimento() {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
        <span><span style={{ color: CORES_RENDIMENTO.bem }}>●</span> Verde = foi bem</span>
        <span><span style={{ color: CORES_RENDIMENTO.media }}>●</span> Amarelo = na média</span>
        <span><span style={{ color: CORES_RENDIMENTO.mal }}>●</span> Vermelho = não foi bem</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
        Anônimo: o atleta vê o resultado, mas nunca quem avaliou. Cada nota entra na{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>média do atleta</strong>, junto com os votos de estrela.
      </div>
    </div>
  );
});
