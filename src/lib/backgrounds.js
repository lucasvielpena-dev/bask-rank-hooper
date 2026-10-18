// Pre-carregamento das imagens de fundo do app (bg-1/bg-2).
//
// Formato: JPEG em vez de PNG. Eram dois PNGs de ~1,4 MB cada (2,8 MB de
// download e de decodificação antes da primeira pintura); convertidos para
// JPEG ficaram em ~85 KB cada, com a mesma aparência (elas aparecem
// escurecidas por cima). Se quiser gerar de novo:
//   ffmpeg -i bg-1.png -q:v 5 bg-1.jpg
//
// Cada uma é mostrada quando as DUAS terminam de carregar (com um fade de
// 1,2s). Se o download começar já no login — enquanto a animação de arremesso
// roda —, elas chegam prontas e o fundo aparece junto com a tela.

const FONTES = ['/images/bg-1.jpg', '/images/bg-2.jpg'];

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
