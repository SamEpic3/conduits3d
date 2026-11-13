// Raccords de tube en laiton : SAE 45° (flare), inverted flare et compression.
// Unités : pouces. Cotes : catalogue Boston Weatherhead (fourni par l'enseignant).
// Clé des connecteurs : « tube|NPT » (ex. '3/8|1/4' = tube 3/8 po × filet 1/4 po NPT).

// Tube (cuivre recuit, comme pour la réfrigération et les lignes d'huile).
export const TUBE = {
  '5/16': { D: 0.3125, paroi: 0.032 },
  '3/8': { D: 0.375, paroi: 0.032 },
};

// Filets droits (UNF) des écrous selon le type de raccord : diamètre majeur et filets par pouce.
// SAE 45° et inverted flare : SAE J512 ; compression : écrous Weatherhead (p. 49).
export const FILETS_TUBE = {
  sae: { '5/16': { maj: 0.5, tpi: 20 }, '3/8': { maj: 0.625, tpi: 18 } },
  if: { '5/16': { maj: 0.5, tpi: 20 }, '3/8': { maj: 0.625, tpi: 18 } },
  comp: { '5/16': { maj: 0.5, tpi: 24 }, '3/8': { maj: 0.5625, tpi: 24 } },
};

// Écrous : hexagone (sur plats), longueur, alésage.
export const ECROUS = {
  sae: { '5/16': { hex: 5 / 8, L: 0.88, D: 0.320 }, '3/8': { hex: 3 / 4, L: 1.00, D: 0.383 } },        // 1110
  if: { '5/16': { hex: 1 / 2, L: 0.62, D: 0.321 }, '3/8': { hex: 5 / 8, L: 0.66, D: 0.384 } },         // 105 (acier)
  comp: { '5/16': { hex: 9 / 16, L: 0.44, D: 0.32 }, '3/8': { hex: 5 / 8, L: 0.47, D: 0.38 } },       // 61
};

// Compression : bague (sleeve) et profondeur de l'arrêt du tube (E).
export const BAGUES = { '5/16': { D: 0.32, F: 0.41, L: 0.25 }, '3/8': { D: 0.38, F: 0.47, L: 0.25 } }; // 60
export const ARRET_COMPRESSION = { '5/16': 0.28, '3/8': 0.31 };

// Connecteurs : hexagone (C), alésage (D), longueur (L).
export const CONNECTEURS = {
  'sae-m': {   // 48 : mâle (sans écrou)
    '5/16|1/4': { hex: 9 / 16, D: 0.219, L: 1.34 },
    '3/8|1/4': { hex: 5 / 8, D: 0.281, L: 1.44 },
    '3/8|3/8': { hex: 11 / 16, D: 0.281, L: 1.44 },
  },
  'sae-f': {   // 46 : femelle (sans écrou)
    '5/16|1/4': { hex: 11 / 16, D: 0.219, L: 1.28 },
    '3/8|1/4': { hex: 11 / 16, D: 0.281, L: 1.31 },
    '3/8|3/8': { hex: 13 / 16, D: 0.281, L: 1.38 },
  },
  'if-m': {    // 202 : mâle
    '5/16|1/4': { hex: 19 / 32, D: 0.220, L: 0.98 },
    '3/8|1/4': { hex: 3 / 4, D: 0.281, L: 1.03 },
    '3/8|3/8': { hex: 3 / 4, D: 0.281, L: 1.01 },
  },
  'if-f': {    // 252 : femelle
    '3/8|1/4': { hex: 3 / 4, D: 0.281, L: 1.03 },
  },
  'comp-m': {  // 68 : mâle (longueur avec l'écrou)
    '5/16|1/4': { hex: 9 / 16, D: 0.250, L: 1.09 },
    '3/8|1/4': { hex: 9 / 16, D: 0.312, L: 1.17 },
    '3/8|3/8': { hex: 11 / 16, D: 0.312, L: 1.16 },
  },
  'comp-f': {  // 66 : femelle (longueur avec l'écrou)
    '5/16|1/4': { hex: 11 / 16, D: 0.250, L: 1.03 },
    '3/8|1/4': { hex: 11 / 16, D: 0.312, L: 1.06 },
  },
};

export const NOMS_TUBE = {
  sae: 'SAE 45°', if: 'inverted flare', comp: 'compression',
};
