// src/contexts/EsporteContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { ESPORTES, ESPORTE_PADRAO } from '../config/esportes';

const EsporteContext = createContext(null);
const STORAGE_KEY = 'rank_hooper_esporte';

export function EsporteProvider({ children }) {
  const [esporte, setEsporteState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved && ESPORTES[saved] ? saved : null;
    } catch {
      return null;
    }
  });

  function setEsporte(novo) {
    if (!ESPORTES[novo]) return;
    setEsporteState(novo);
    try { localStorage.setItem(STORAGE_KEY, novo); } catch {}
  }

  function limparEsporte() {
    setEsporteState(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  const cfg = esporte ? ESPORTES[esporte] : null;

  return (
    <EsporteContext.Provider value={{ esporte, setEsporte, limparEsporte, cfg }}>
      {children}
    </EsporteContext.Provider>
  );
}

export function useEsporte() {
  return useContext(EsporteContext);
}
