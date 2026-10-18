import { createPortal } from 'react-dom';

/** Desenha os filhos direto no <body>, fora da camada da página (evita modal cortado pela navegação). */
export default function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
