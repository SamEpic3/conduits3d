// Tuyau d'acier et raccords en fonte malléable noire, classe 150.
// Unités : pouces.
// Filets : ASME B1.20.1 (NPT). Raccords : ASME B16.3, cotes vérifiées sur les plans McMaster-Carr.

// Filets NPT par diamètre nominal.
//   tpi : filets par pouce
//   D   : diamètre extérieur du tuyau
//   E0  : diamètre sur flancs au bout du tuyau
//   E1  : diamètre sur flancs à l'entrée du raccord (serrage à la main)
//   L1  : engagement serré à la main
//   L2  : longueur des filets utiles du tuyau
//   L4  : longueur filetée totale du tuyau (filets incomplets compris)
//   diInt : diamètre intérieur du tuyau schedule 40
//   engagement : longueur du tuyau qui entre dans le raccord une fois serré à la clé
export const FILETS_NPT = {
  '1/2': { tpi: 14, D: 0.840, E0: 0.75843, E1: 0.77843, L1: 0.320, L2: 0.5337, L4: 0.7815, diInt: 0.622, engagement: 0.50 },
  '3/4': { tpi: 14, D: 1.050, E0: 0.96768, E1: 0.98887, L1: 0.339, L2: 0.5457, L4: 0.7935, diInt: 0.824, engagement: 0.5625 },
};

// Hauteur d'un filet NPT (profil à 60°, tronqué) : 0,8 × pas.
export const hauteurFilet = tpi => 0.8 / tpi;

// Conicité NPT : 1/16 po par pouce sur le diamètre.
export const CONICITE = 1 / 16;

// Formes communes à tous les raccords d'une même grosseur.
//   bourrelet    : Ø et longueur de l'anneau renforcé à chaque bout
//   corps        : Ø du corps entre les bourrelets
//   longFiletee  : longueur filetée dans chaque bout du raccord (B16.3, « B »)
export const FONTE_150 = {
  '1/2': { bourrelet: { d: 1.20, l: 0.25 }, corps: 1.06, longFiletee: 0.43 },
  '3/4': { bourrelet: { d: 1.46, l: 0.27 }, corps: 1.32, longFiletee: 0.50 },
};

// Raccords. Les ports donnent la position de la face et la direction de sortie,
// dans le repère du raccord (centre du raccord à l'origine).
//   centreFace : distance du centre à la face (« A » dans B16.3)
export const RACCORDS_NPT = {
  manchon: {
    nom: 'Manchon',
    nomAnglais: 'Coupling',
    tailles: {
      '1/2': { longueur: 1.34, mcmaster: '44605K184' },
      '3/4': { longueur: 1.52, mcmaster: '44605K185' },
    },
  },
  coude90: {
    nom: 'Coude 90°',
    nomAnglais: '90° elbow',
    tailles: {
      '1/2': { centreFace: 1.12, mcmaster: '44605K114' },
      '3/4': { centreFace: 1.31, mcmaster: '44605K115' },
    },
  },
  coude45: {
    nom: 'Coude 45°',
    nomAnglais: '45° elbow',
    tailles: {
      '1/2': { centreFace: 0.88, mcmaster: '44605K123' },
      '3/4': { centreFace: 0.98, mcmaster: '44605K124' },
    },
  },
  te: {
    nom: 'Té',
    nomAnglais: 'Tee',
    tailles: {
      '1/2': { centreFace: 1.12, mcmaster: '44605K154' },
      '3/4': { centreFace: 1.31, mcmaster: '44605K155' },
    },
  },
  union: {
    nom: 'Union',
    nomAnglais: 'Union',
    feminin: true,
    tailles: {
      // hexagone : bouts sur plats ; octogone : écrou sur plats ; longBout : longueur de chaque hexagone ;
      // filet : profondeur taraudée (plans McMaster)
      '1/2': { longueur: 1.72, octogone: 1.45, hexagone: 1.01, longBout: 0.57, filet: 0.43, mcmaster: '44605K492' },
      '3/4': { longueur: 1.94, octogone: 1.71, hexagone: 1.19, longBout: 0.64, filet: 0.55, mcmaster: '44605K493' },
    },
  },
  mamelon: {
    nom: 'Mamelon',
    nomAnglais: 'Nipple',
    // Tuyau schedule 40 fileté aux deux bouts ; la longueur se choisit.
    tailles: {
      '1/2': { longueurs: [1.125, 1.5, 2, 2.5, 3, 4, 6] },
      '3/4': { longueurs: [1.375, 1.5, 2, 2.5, 3, 4, 6] },
    },
  },
};
