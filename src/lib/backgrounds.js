// src/lib/backgrounds.js
//
// Pre-carregamento das imagens de fundo do app (bg-1/bg-2).
// Cada uma passa de 1 MB, e o Layout só as mostra quando as DUAS terminam de
// carregar (com um fade de 1,2s). Se o download começar já no login — enquanto
// a animação de arremesso roda —, elas chegam prontas e o fundo aparece junto
// com a tela, sem aquele "atraso" depois de entrar.

const FONTES = ['/images/bg-1.png', '/images/bg-2.png'];

let iniciado = false;
let carregadas = 0;
const ouvintes = new Set();

export function preloadBackgrounds() {
  if (iniciado) return;
  iniciado = true;

  FONTES.forEach((src) => {
    const img = new Image();
    const concluir = () => {
      carregadas += 1;
      const prontas = carregadas >= FONTES.length;
      ouvintes.forEach((fn) => fn(prontas));
    };
    // onerror conta como "resolvido": nunca deixamos a tela presa esperando.
    img.onload = concluir;
    img.onerror = concluir;
    img.src = src;
  });
}

export function backgroundsProntos() {
  return carregadas >= FONTES.length;
}

export function aoTerminarBackgrounds(fn) {
  ouvintes.add(fn);
  if (backgroundsProntos()) fn(true);
  return () => ouvintes.delete(fn);
}
