// src/contexts/EsporteContext.jsx
import { createContext, useContext } from 'react';
import { ESPORTES, ESPORTE_PADRAO } from '../config/esportes';

const EsporteContext = createContext(null);

export function EsporteProvider({ children }) {
  // App exclusivo de basquete — handebol removido
  const esporte = ESPORTE_PADRAO;
  const cfg = ESPORTES[esporte];

  function setEsporte() {
    // no-op: apenas basquete
  }

  return (
    <EsporteContext.Provider value={{ esporte, setEsporte, cfg }}>
      {children}
    </EsporteContext.Provider>
  );
}

export function useEsporte() {
  return useContext(EsporteContext);
}
