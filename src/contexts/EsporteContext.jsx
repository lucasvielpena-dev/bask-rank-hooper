// src/contexts/EsporteContext.jsx
import { createContext, useContext, useState } from 'react';
import { ESPORTES, ESPORTE_PADRAO } from '../config/esportes';

const EsporteContext = createContext(null);

export function EsporteProvider({ children }) {
  const [esporte, setEsporteState] = useState(() => {
    const saved = localStorage.getItem('rh_esporte');
    return saved && ESPORTES[saved] ? saved : ESPORTE_PADRAO;
  });

  function setEsporte(novo) {
    if (ESPORTES[novo]) {
      setEsporteState(novo);
      localStorage.setItem('rh_esporte', novo);
    }
  }

  const cfg = ESPORTES[esporte];

  return (
    <EsporteContext.Provider value={{ esporte, setEsporte, cfg }}>
      {children}
    </EsporteContext.Provider>
  );
}

export function useEsporte() {
  return useContext(EsporteContext);
}
