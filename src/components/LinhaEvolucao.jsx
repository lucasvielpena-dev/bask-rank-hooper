import { memo } from 'react';
import { CORES_RENDIMENTO } from './GameGrade';

// ============================================================
// Linha de Evolução do atleta
// ============================================================
// Mostra a média mensal das avaliações RECEBIDAS (notas de partida +
// votos de estrela), com honestidade estatística:
//   - mês sem avaliação: sem ponto (buraco na linha, não "linha reta")
//   - mês com 1 avaliação: ponto vazado = pouca confiança
//   - mês com 2+ avaliações: ponto cheio
//   - tendência só é afirmada com amostra mínima dos dois lados
// ============================================================

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const MINIMO_CONFIAVEL = 2;   // avaliações no mês para o ponto "valer"
const AMOSTRA_TENDENCIA = 3;  // avaliações em cada janela para afirmar tendência
const PASSO_TENDENCIA = 0.3;  // variação mínima da média para "subiu/caiu"

function mesCurto(mes) {
  const d = new Date(`${mes}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return MESES_CURTOS[d.getMonth()];
}

function formatarNota(v) {
  return Number(v).toFixed(1).replace('.', ',');
}

function composicaoMes(p) {
  const partes = [];
  if (p.jogos) partes.push(`${p.jogos} ${p.jogos === 1 ? 'nota de partida' : 'notas de partida'}`);
  if (p.votos) partes.push(`${p.votos} ${p.votos === 1 ? 'voto de estrela' : 'votos de estrela'}`);
  return partes.join(' + ');
}

function agregar(pontos) {
  const total = pontos.reduce((s, p) => s + (p.total || 0), 0);
  const soma = pontos.reduce((s, p) => s + (Number(p.media) || 0) * (p.total || 0), 0);
  return { total, media: total ? soma / total : null };
}

function calcularTendencia(serie) {
  const n = serie.length;
  if (n < 4) return { estado: 'indefinido' };
  const metade = Math.floor(n / 2);
  const antigos = agregar(serie.slice(0, metade));
  const recentes = agregar(serie.slice(n - metade));

  if (antigos.total < AMOSTRA_TENDENCIA || recentes.total < AMOSTRA_TENDENCIA) {
    return { estado: 'indefinido' };
  }

  const delta = recentes.media - antigos.media;
  if (delta >= PASSO_TENDENCIA) return { estado: 'subiu', delta };
  if (delta <= -PASSO_TENDENCIA) return { estado: 'caiu', delta };
  return { estado: 'estavel', delta };
}

function BadgeTendencia({ tendencia }) {
  if (!tendencia || tendencia.estado === 'indefinido') {
    return (
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
        Amostra pequena p/ tendência
      </span>
    );
  }
  if (tendencia.estado === 'estavel') {
    return (
      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>
        = Estável
      </span>
    );
  }
  const subiu = tendencia.estado === 'subiu';
  const cor = subiu ? CORES_RENDIMENTO.bem.cor : CORES_RENDIMENTO.mal.cor;
  return (
    <span style={{ fontSize: 11, color: cor, fontWeight: 800 }}>
      {subiu ? '▲' : '▼'} {subiu ? '+' : '−'}{formatarNota(Math.abs(tendencia.delta))} · {subiu ? 'em evolução' : 'em queda'}
    </span>
  );
}

function Grafico({ serie }) {
  const W = 320;
  const H = 130;
  const PAD = { top: 12, right: 8, bottom: 20, left: 22 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const n = serie.length;
  const x = (i) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => {
    const nota = Math.max(1, Math.min(5, Number(v) || 0));
    return PAD.top + plotH - ((nota - 1) / 4) * plotH;
  };

  // Só liga pontos consecutivos que têm dado (mês vazio quebra a linha)
  const segmentos = [];
  let atual = [];
  serie.forEach((p, i) => {
    if (p.total > 0 && p.media !== null) {
      atual.push(`${x(i)},${y(p.media)}`);
    } else if (atual.length) {
      segmentos.push(atual);
      atual = [];
    }
  });
  if (atual.length) segmentos.push(atual);

  const linhasGrade = [2, 3, 4, 5];

  // `height: auto` como ATRIBUTO é inválido em SVG: o React avisava no console
  // e o navegador caía na altura padrão (150px), encolhendo o gráfico. Como
  // estilo, o navegador calcula a altura pela proporção do viewBox.
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
      role="img"
      aria-label="Evolução mensal"
    >
      {/* grade */}
      {linhasGrade.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
            stroke="var(--border)" strokeWidth="0.8"
            strokeDasharray={v === 3 ? '3 3' : undefined}
          />
          <text x={PAD.left - 5} y={y(v) + 2.6} fontSize="7" textAnchor="end" fill="var(--text-muted)">
            {v}
          </text>
        </g>
      ))}

      {/* linha dos dados */}
      {segmentos.map((seg, i) => (
        <polyline
          key={i}
          points={seg.join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* pontos */}
      {serie.map((p, i) => {
        if (!p.total || p.media === null) return null;
        const confiavel = p.total >= MINIMO_CONFIAVEL;
        const cor = confiavel
          ? (p.media >= 3.5 ? CORES_RENDIMENTO.bem.cor : p.media >= 2.5 ? CORES_RENDIMENTO.media.cor : CORES_RENDIMENTO.mal.cor)
          : CORES_RENDIMENTO.neutro.cor;
        return (
          <g key={p.mes}>
            <title>
              {`${mesCurto(p.mes)}: ${formatarNota(p.media)}/5 · ${p.total} ${p.total === 1 ? 'avaliação' : 'avaliações'}${composicaoMes(p) ? ` (${composicaoMes(p)})` : ''}`}
            </title>
            <circle
              cx={x(i)} cy={y(p.media)} r={confiavel ? 4 : 3}
              fill={confiavel ? cor : 'var(--bg-card)'}
              stroke={cor}
              strokeWidth={confiavel ? 0 : 1.5}
            />
            {i === n - 1 && (
              <text x={x(i)} y={y(p.media) - 7} fontSize="8" textAnchor="middle" fill={cor} fontWeight="700">
                {formatarNota(p.media)}
              </text>
            )}
          </g>
        );
      })}

      {/* rótulos dos meses */}
      {serie.map((p, i) => (
        <text
          key={`m-${p.mes}`}
          x={x(i)} y={H - 6}
          fontSize="8"
          textAnchor="middle"
          fill={p.total > 0 ? 'var(--text-secondary)' : 'var(--text-muted)'}
          fontWeight={i === n - 1 ? 700 : 400}
        >
          {mesCurto(p.mes)}
        </text>
      ))}
    </svg>
  );
}

const LinhaEvolucao = memo(function LinhaEvolucao({ serie = [], loading = false, proprio = true }) {
  const temDados = serie.some((p) => p.total > 0);
  const totalPeriodo = serie.reduce((s, p) => s + (p.total || 0), 0);
  const periodo = agregar(serie);
  const tendencia = calcularTendencia(serie);

  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'Inter',sans-serif" }}>
          Evolução
        </div>
        {!loading && temDados && <BadgeTendencia tendencia={tendencia} />}
      </div>

      {loading ? (
        <div style={{ padding: '26px 0', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
          Carregando evolução...
        </div>
      ) : !temDados ? (
        <div style={{ padding: '16px 4px 10px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {proprio ? 'Ainda não há avaliações no seu histórico.' : 'Ainda não há avaliações no histórico deste atleta.'}
          <br />
          {proprio ? 'Sua linha aparece' : 'A linha aparece'} assim que {proprio ? 'você receber' : 'ele receber'} notas nos <strong style={{ color: 'var(--text-secondary)' }}>rachões</strong>, <strong style={{ color: 'var(--text-secondary)' }}>competições</strong>/<strong style={{ color: 'var(--text-secondary)' }}>torneios</strong> ou votos na aba <strong style={{ color: 'var(--text-secondary)' }}>Atletas</strong>.
        </div>
      ) : (
        <>
          <Grafico serie={serie} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Média do período:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {periodo.media === null ? '--' : `${formatarNota(periodo.media)} / 5`}
              </strong>
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {totalPeriodo} {totalPeriodo === 1 ? 'avaliação' : 'avaliações'}
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Notas de partida (rachões, competições e torneios) + votos da aba Atletas.
            {' '}Ponto vazado = mês com poucas avaliações. Sem ponto = mês sem avaliação.
          </div>
        </>
      )}
    </div>
  );
});

export default LinhaEvolucao;
