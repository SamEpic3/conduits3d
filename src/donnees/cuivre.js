// Tube de cuivre et raccords à souder (wrot, ASME B16.22).
// Unités : pouces. Cotes des raccords : catalogue NIBCO (fourni par l'enseignant).
// Les cotes NIBCO « C », « D », « G » sont mesurées du centre jusqu'à l'arrêt du tube (fond de la douille).

// Tube de cuivre type L par diamètre nominal.
//   D : diamètre extérieur réel (toujours nominal + 1/8 po)
//   paroi : épaisseur de paroi (type L) ; profondeur : profondeur de la douille (B16.22)
export const TUBE_CUIVRE = {
  '1/2': { D: 0.625, paroi: 0.040, profondeur: 0.50 },
  '3/4': { D: 0.875, paroi: 0.045, profondeur: 0.75 },
};

// Jeu entre le tube et la douille (pour la soudure par capillarité).
export const JEU_SOUDURE = 0.004;

export const RACCORDS_CUIVRE = {
  tube: {
    nom: 'Tube de cuivre',
    nomAnglais: 'Copper tube, type L',
    tailles: { '1/2': { longueurs: [2, 3, 4, 6, 12] }, '3/4': { longueurs: [2, 3, 4, 6, 12] } },
  },
  coude90: {
    nom: 'Coude 90°',
    nomAnglais: '90° elbow C × C (NIBCO 607)',
    tailles: { '1/2': { centreArret: 11 / 32 }, '3/4': { centreArret: 1 / 2 } },
  },
  coude45: {
    nom: 'Coude 45°',
    nomAnglais: '45° elbow C × C (NIBCO 606)',
    tailles: { '1/2': { centreArret: 9 / 32 }, '3/4': { centreArret: 11 / 32 } },
  },
  te: {
    nom: 'Té',
    nomAnglais: 'Tee C × C × C (NIBCO 611)',
    tailles: { '1/2': { centreArret: 11 / 32 }, '3/4': { centreArret: 7 / 16 } },
  },
  manchon: {
    nom: 'Manchon',
    nomAnglais: 'Coupling with rolled tube stop C × C (NIBCO 600-RS)',
    // ecart : distance entre les deux arrêts du tube (« A »)
    tailles: { '1/2': { ecart: 3 / 32 }, '3/4': { ecart: 3 / 32 } },
  },
  union: {
    nom: 'Union',
    nomAnglais: 'Union C × C (NIBCO 633-W)',
    feminin: true,
    // ecart : distance entre les deux arrêts du tube (« A ») ; hexagone : écrou en laiton, sur plats (estimé)
    tailles: { '1/2': { ecart: 7 / 16, hexagone: 1.125 }, '3/4': { ecart: 7 / 16, hexagone: 1.375 } },
  },
  capuchon: {
    nom: 'Capuchon',
    nomAnglais: 'Tube cap C (NIBCO 617)',
    // bout : épaisseur du fond, au-delà de l'arrêt du tube (« N »)
    tailles: { '1/2': { bout: 1 / 8 }, '3/4': { bout: 3 / 16 } },
  },
  // Adaptateurs : clé « cuivre|NPT » (ex. '1/2|3/4' = cuivre 1/2 po × filet 3/4 po NPT).
  adaptF: {
    nom: 'Adaptateur femelle',
    nomAnglais: 'Adapter C × FPT (NIBCO 603)',
    // arretFace : de l'arrêt du tube à la face femelle (« A »)
    tailles: {
      '1/2|1/2': { arretFace: 27 / 32 }, '1/2|3/4': { arretFace: 1 },
      '3/4|1/2': { arretFace: 5 / 8 }, '3/4|3/4': { arretFace: 29 / 32 },
    },
  },
  adaptM: {
    nom: 'Adaptateur mâle',
    nomAnglais: 'Adapter C × MPT (NIBCO 604)',
    // filet : longueur filetée après l'hexagone (« B »)
    tailles: {
      '1/2|1/2': { filet: 5 / 8 }, '1/2|3/4': { filet: 31 / 32 },
      '3/4|1/2': { filet: 27 / 32 }, '3/4|3/4': { filet: 13 / 16 },
    },
  },
};

// Hexagone des adaptateurs (sur plats, estimé d'après les photos du catalogue), selon le filet NPT.
export const HEX_ADAPTATEUR = {
  femelle: { '1/2': 1.0625, '3/4': 1.3125 },
  male: { '1/2': 0.9375, '3/4': 1.125 },
};
