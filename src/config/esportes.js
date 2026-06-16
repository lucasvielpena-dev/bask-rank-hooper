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
  handebol: {
    label: 'Handebol',
    divisionName: 'Handball League',
    divisionSlogan: 'A quadra oficial do handebol nacional',
    goalLabel: 'Artilheiro',
    scoreUnit: 'Gols',
    posicoes: ['Goleiro', 'Ponta-Esquerda', 'Ponta-Direita', 'Meia', 'Pivô', 'Armador'],
    habilidades: [
      { key: 'finalizacao',     label: 'Finalização' },
      { key: 'defesa',          label: 'Defesa' },
      { key: 'passes',          label: 'Passes' },
      { key: 'explosao_fisica', label: 'Explosão Física' },
      { key: 'visao_de_jogo',   label: 'Visão de Jogo' },
    ],
    statsPartida: [
      { key: 'gols',             label: 'Gols' },
      { key: 'defesas_goleiro',  label: 'Defesas (Goleiro)' },
      { key: 'assistencias',     label: 'Assistências' },
      { key: 'faltas_cometidas', label: 'Faltas Cometidas' },
    ],
    funcaoVoto: 'registrar_avaliacao_handebol',
  },
};

export const ESPORTE_PADRAO = 'basquete';
