/**
 * Bandeira municipal só quando temos arquivo VERIFICADO no Commons.
 * MBI Simbolopedia (mbi.com.br) tem o acervo completo, mas as imagens
 * em alta resolução são produto comercial (marca d'água) — não usamos hotlink.
 * Caso contrário, bandeira do estado na hora (sem tentar nomes inventados —
 * isso era lento e às vezes puxava bandeira errada).
 */

import { useMemo, useState } from 'react';

/** Só entradas conferidas no Wikimedia Commons */
const CITY_FLAGS = {
  // Pará
  'altamira|pa': 'Bandeira_de_Altamira_Pará.jpg',
  'belem|pa': 'Bandeira_de_Belém_(Pará).png',
  'belém|pa': 'Bandeira_de_Belém_(Pará).png',
  'parauapebas|pa': 'Bandeira_de_Parauapebas_(Pará).svg',
  'ananindeua|pa': 'Flag_of_Ananindeua.svg',
  // se Flag_of_Ananindeua falhar, cai no estado
};

/** Bandeiras estaduais (SVG leves, carga rápida) */
const UF_FLAGS = {
  AC: 'Bandeira_do_Acre.svg',
  AL: 'Bandeira_de_Alagoas.svg',
  AP: 'Bandeira_do_Amapá.svg',
  AM: 'Bandeira_do_Amazonas.svg',
  BA: 'Bandeira_da_Bahia.svg',
  CE: 'Bandeira_do_Ceará.svg',
  DF: 'Bandeira_do_Distrito_Federal_(Brasil).svg',
  ES: 'Bandeira_do_Espírito_Santo.svg',
  GO: 'Bandeira_de_Goiás.svg',
  MA: 'Bandeira_do_Maranhão.svg',
  MT: 'Bandeira_de_Mato_Grosso.svg',
  MS: 'Bandeira_de_Mato_Grosso_do_Sul.svg',
  MG: 'Bandeira_de_Minas_Gerais.svg',
  PA: 'Bandeira_do_Pará.svg',
  PB: 'Bandeira_da_Paraíba.svg',
  PR: 'Bandeira_do_Paraná.svg',
  PE: 'Bandeira_de_Pernambuco.svg',
  PI: 'Bandeira_do_Piauí.svg',
  RJ: 'Bandeira_do_estado_do_Rio_de_Janeiro.svg',
  RN: 'Bandeira_do_Rio_Grande_do_Norte.svg',
  RS: 'Bandeira_do_Rio_Grande_do_Sul.svg',
  RO: 'Bandeira_de_Rondônia.svg',
  RR: 'Bandeira_de_Roraima.svg',
  SC: 'Bandeira_de_Santa_Catarina.svg',
  SP: 'Bandeira_do_estado_de_São_Paulo.svg',
  SE: 'Bandeira_de_Sergipe.svg',
  TO: 'Bandeira_do_Tocantins.svg',
};

function normalizar(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Thumb CDN do Commons — mais rápido que Special:FilePath em cadeia */
function thumbUrl(fileName, width = 96) {
  // Redirect estável do Commons para o ficheiro (1 hop)
  return `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(fileName)}&width=${width}`;
}

function chaveCidade(cidade, uf) {
  return `${normalizar(cidade)}|${normalizar(uf)}`;
}

export default function CityCrest({ cidade, uf, size = 42 }) {
  const u = String(uf || '').trim().toUpperCase();
  const cityFile = CITY_FLAGS[chaveCidade(cidade, uf)] || null;
  const ufFile = UF_FLAGS[u] || null;

  // Começa pela cidade se conhecida; senão já vai pro estado (sem atraso)
  const [fase, setFase] = useState(cityFile ? 'cidade' : ufFile ? 'uf' : 'vazio');

  const src = useMemo(() => {
    const w = Math.min(160, Math.round(size * 3));
    if (fase === 'cidade' && cityFile) return thumbUrl(cityFile, w);
    if (fase === 'uf' && ufFile) return thumbUrl(ufFile, w);
    return null;
  }, [fase, cityFile, ufFile, size]);

  function onError() {
    if (fase === 'cidade' && ufFile) {
      setFase('uf');
      return;
    }
    setFase('vazio');
  }

  const w = size;
  const h = Math.round(size * 0.7);

  if (!src) {
    const label = (u || String(cidade || '?').slice(0, 2)).toUpperCase();
    return (
      <div
        aria-hidden
        style={{
          width: w,
          height: h,
          borderRadius: 6,
          flexShrink: 0,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: Math.max(10, Math.round(size * 0.28)),
          color: 'var(--text-secondary)',
        }}
        title={cidade}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      aria-hidden
      title={
        fase === 'cidade'
          ? `Bandeira de ${cidade}`
          : `Bandeira do estado ${u}`
      }
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        overflow: 'hidden',
        flexShrink: 0,
        border: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}
    >
      <img
        key={src}
        src={src}
        alt=""
        onError={onError}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}
