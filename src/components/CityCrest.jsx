/**
 * Escudo visual por cidade — cores e iniciais estáveis a partir do nome.
 * Não usa brasão oficial (copyright); cada cidade fica visualmente distinta.
 */

const PALETTES = [
  ['#C8F135', '#1a2e05'], // limão
  ['#4CC9F0', '#0a2540'], // ciano
  ['#f472b6', '#3b0a2e'], // rosa
  ['#a78bfa', '#1e1035'], // roxo
  ['#fb923c', '#3b1a05'], // laranja
  ['#34d399', '#06281c'], // verde
  ['#fbbf24', '#3b2a05'], // âmbar
  ['#60a5fa', '#0c1e3d'], // azul
  ['#e879f9', '#2e0a3b'], // magenta
  ['#2dd4bf', '#042f2e'], // teal
  ['#f87171', '#3b0a0a'], // vermelho
  ['#94a3b8', '#0f172a'], // slate
];

function hashStr(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function iniciais(cidade, uf) {
  const parts = String(cidade || '')
    .trim()
    .split(/\s+/)
    .filter((p) => p && !/^(de|da|do|das|dos|e)$/i.test(p));
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (uf) return String(uf).slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

export function cidadePalette(cidade, uf) {
  const h = hashStr(`${cidade}|${uf || ''}`);
  return PALETTES[h % PALETTES.length];
}

export default function CityCrest({ cidade, uf, size = 42 }) {
  const [fg, bg] = cidadePalette(cidade, uf);
  const label = iniciais(cidade, uf);
  const r = Math.round(size * 0.28);

  return (
    <div
      aria-hidden
      title={cidade ? `${cidade}${uf ? ` · ${uf}` : ''}` : ''}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Formato de escudo */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <linearGradient id={`crest-${hashStr(cidade + uf)}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={fg} stopOpacity="0.95" />
            <stop offset="100%" stopColor={bg} stopOpacity="1" />
          </linearGradient>
        </defs>
        <path
          d="M24 2 L42 8 L42 22 C42 34 33 42 24 46 C15 42 6 34 6 22 L6 8 Z"
          fill={`url(#crest-${hashStr(cidade + uf)})`}
          stroke={fg}
          strokeWidth="1.5"
          strokeOpacity="0.5"
        />
        <path
          d="M24 6 L38 11 L38 22 C38 31 31 38 24 41 C17 38 10 31 10 22 L10 11 Z"
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
      </svg>
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: Math.max(11, Math.round(size * 0.34)),
          color: '#fff',
          letterSpacing: '0.02em',
          textShadow: '0 1px 2px rgba(0,0,0,0.45)',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}
