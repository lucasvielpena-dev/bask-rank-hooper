// src/config/esportes.js
export const ESPORTES = {
  basquete: {
    label: 'Basquete',
    divisionName: 'Hoops Division',
    divisionSlogan: 'A quadra oficial do basquete nacional',
    goalLabel: 'Cestinha',
    scoreUnit: 'PTS',
    posicoes: ['Armador', 'Ala-Armador', 'Ala', 'Ala-Pivô', 'Pivô'],
    habilidades: [
      { key: 'arremesso',        label: 'Arremesso' },
      { key: 'controle_de_bola', label: 'Controle de Bola' },
      { key: 'defesa',           label: 'Defesa' },
      { key: 'visao_de_jogo',    label: 'Visão de Jogo' },
      { key: 'explosao_fisica',  label: 'Explosão Física' },
    ],
    statsPartida: [
      { key: 'arremessos_tentados',    label: 'Arremessos Tentados' },
      { key: 'arremessos_convertidos', label: 'Arremessos Convertidos' },
    ],
    funcaoVoto: 'registrar_avaliacao',
  },
};

export const ESPORTE_PADRAO = 'basquete';
