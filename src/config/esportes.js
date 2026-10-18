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
      { key: 'arremesso',            label: 'Arremesso' },
      { key: 'finalizacao',          label: 'Infiltração e Finalização' },
      { key: 'controle_de_bola',     label: 'Controle de Bola' },
      { key: 'passe_visao',          label: 'Passe e Visão de Jogo' },
      { key: 'defesa_perimetral',    label: 'Defesa Perimetral' },
      { key: 'defesa_garrafao',      label: 'Defesa de Garrafão' },
      { key: 'rebote',               label: 'Rebote' },
      { key: 'velocidade_agilidade', label: 'Velocidade e Agilidade' },
      { key: 'explosao_forca',       label: 'Explosão e Força' },
      { key: 'hustle_equipe',        label: 'Trabalho em Equipe e Garra' },
    ],
    statsPartida: [
      { key: 'arremessos_tentados',    label: 'Arremessos Tentados' },
      { key: 'arremessos_convertidos', label: 'Arremessos Convertidos' },
    ],
    funcaoVoto: 'registrar_avaliacao',
  },
};

export const ESPORTE_PADRAO = 'basquete';
