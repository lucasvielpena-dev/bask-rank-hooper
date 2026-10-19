/**
 * Bandeira do município (Wikimedia Commons) quando existir.
 * Se não carregar, usa a bandeira do estado (UF).
 * Arquivos oficiais em domínio público / PD-BrazilGov no Commons.
 */

import { useMemo, useState } from 'react';

/** Arquivos conhecidos no Wikimedia Commons (nome exato do File:) */
const FLAG_FILES = {
  'altamira|pa': ['Bandeira_de_Altamira_Pará.jpg', 'Bandeira_de_Altamira.jpg'],
  'belém|pa': ['Bandeira_de_Belém_(Pará).png', 'Bandeira_de_Belém.png'],
  'belem|pa': ['Bandeira_de_Belém_(Pará).png'],
  'parauapebas|pa': ['Bandeira_de_Parauapebas_(Pará).svg', 'Band_peba_p.png'],
  'ananindeua|pa': ['Bandeira_de_Ananindeua.svg', 'Bandeira_de_Ananindeua.png'],
  'castanhal|pa': ['Bandeira_de_Castanhal.svg', 'Bandeira_de_Castanhal.png'],
  'marabá|pa': ['Bandeira_de_Marabá.svg', 'Bandeira_de_Marabá.png', 'Bandeira_de_Maraba.png'],
  'maraba|pa': ['Bandeira_de_Marabá.svg', 'Bandeira_de_Maraba.png'],
  'santarém|pa': ['Bandeira_de_Santarém_(Pará).svg', 'Bandeira_de_Santarem_PA.png'],
  'santarem|pa': ['Bandeira_de_Santarém_(Pará).svg'],
  'tucuruí|pa': ['Bandeira_de_Tucuruí.svg', 'Bandeira_de_Tucurui.png'],
  'tucurui|pa': ['Bandeira_de_Tucuruí.svg'],
  'redenção|pa': ['Bandeira_de_Redenção_(Pará).svg'],
  'redencao|pa': ['Bandeira_de_Redenção_(Pará).svg'],
  'paragominas|pa': ['Bandeira_de_Paragominas.svg'],
  'itaítuba|pa': ['Bandeira_de_Itaituba.svg', 'Bandeira_de_Itaituba.png'],
  'itaituba|pa': ['Bandeira_de_Itaituba.svg'],
  'bragança|pa': ['Bandeira_de_Bragança_(Pará).svg'],
  'braganca|pa': ['Bandeira_de_Bragança_(Pará).svg'],
  'abaetetuba|pa': ['Bandeira_de_Abaetetuba.svg'],
  'cametá|pa': ['Bandeira_de_Cametá.svg'],
  'cameta|pa': ['Bandeira_de_Cametá.svg'],
  'barcarena|pa': ['Bandeira_de_Barcarena.svg'],
  'marituba|pa': ['Bandeira_de_Marituba.svg'],
  'canaã dos carajás|pa': ['Bandeira_de_Canaã_dos_Carajás.svg'],
  'canaa dos carajas|pa': ['Bandeira_de_Canaã_dos_Carajás.svg'],
  'xinguara|pa': ['Bandeira_de_Xinguara.svg'],
  'dom eliseu|pa': ['Bandeira_de_Dom_Eliseu.svg'],
  'ulianópolis|pa': ['Bandeira_de_Ulianópolis.svg'],
  'tailândia|pa': ['Bandeira_de_Tailândia.svg'],
  'tailandia|pa': ['Bandeira_de_Tailândia.svg'],
};

/** Bandeiras dos estados (fallback) */
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

function commonsUrl(fileName, width = 128) {
  // Special:FilePath redireciona para o upload correto
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}

function candidatosCidade(cidade, uf) {
  const c = String(cidade || '').trim();
  const u = String(uf || '').trim().toUpperCase();
  const key = `${normalizar(c)}|${normalizar(u)}`;
  const known = FLAG_FILES[key] || [];
  const gen = [];
  if (c) {
    gen.push(`Bandeira_de_${c}.svg`);
    gen.push(`Bandeira_de_${c}.png`);
    gen.push(`Bandeira_de_${c}.jpg`);
    if (u === 'PA') {
      gen.push(`Bandeira_de_${c}_(Pará).svg`);
      gen.push(`Bandeira_de_${c}_Pará.jpg`);
      gen.push(`Bandeira_de_${c}_(Pará).png`);
    }
  }
  // únicos
  const seen = new Set();
  return [...known, ...gen].filter((f) => {
    if (seen.has(f)) return false;
    seen.add(f);
    return true;
  });
}

export default function CityCrest({ cidade, uf, size = 42 }) {
  const lista = useMemo(() => candidatosCidade(cidade, uf), [cidade, uf]);
  const ufFile = UF_FLAGS[String(uf || '').toUpperCase()] || null;
  const [idx, setIdx] = useState(0);
  const [usouUf, setUsouUf] = useState(false);
  const [falhouTudo, setFalhouTudo] = useState(false);

  const src = useMemo(() => {
    if (falhouTudo) return null;
    if (usouUf && ufFile) return commonsUrl(ufFile, Math.round(size * 2.5));
    if (idx < lista.length) return commonsUrl(lista[idx], Math.round(size * 2.5));
    if (ufFile) return commonsUrl(ufFile, Math.round(size * 2.5));
    return null;
  }, [idx, lista, usouUf, ufFile, falhouTudo, size]);

  function onError() {
    if (!usouUf && idx + 1 < lista.length) {
      setIdx((i) => i + 1);
      return;
    }
    if (!usouUf && ufFile) {
      setUsouUf(true);
      return;
    }
    setFalhouTudo(true);
  }

  const w = size;
  const h = Math.round(size * 0.72);

  if (!src || falhouTudo) {
    // Fallback limpo: retângulo com UF / iniciais
    const label = (String(uf || '').toUpperCase() || String(cidade || '?').slice(0, 2)).toUpperCase();
    return (
      <div
        aria-hidden
        style={{
          width: w,
          height: h,
          borderRadius: 6,
          flexShrink: 0,
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: Math.max(10, Math.round(size * 0.28)),
          color: '#E2E8F0',
          letterSpacing: '0.04em',
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
      title={cidade ? `Bandeira · ${cidade}${uf ? `-${uf}` : ''}` : ''}
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        overflow: 'hidden',
        flexShrink: 0,
        border: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      <img
        src={src}
        alt=""
        onError={onError}
        loading="lazy"
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
