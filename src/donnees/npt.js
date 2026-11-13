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
  '1/4': { tpi: 18, D: 0.540, E0: 0.47739, E1: 0.49163, L1: 0.228, L2: 0.4018, L4: 0.5946, diInt: 0.364, engagement: 0.375 },
  '3/8': { tpi: 18, D: 0.675, E0: 0.61201, E1: 0.62701, L1: 0.240, L2: 0.4078, L4: 0.6006, diInt: 0.493, engagement: 0.375 },
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
  // 1/4 et 3/8 : seulement pour les taraudages (réducteurs) ; bourrelet et corps estimés.
  '1/4': { bourrelet: { d: 0.91, l: 0.21 }, corps: 0.80, longFiletee: 0.32 },
  '3/8': { bourrelet: { d: 1.06, l: 0.23 }, corps: 0.94, longFiletee: 0.36 },
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
      '1/4': { longueurs: [0.875, 1.5, 2, 3, 4, 6] },
      '3/8': { longueurs: [1, 1.5, 2, 3, 4, 6] },
      '1/2': { longueurs: [1.125, 1.5, 2, 2.5, 3, 4, 6] },
      '3/4': { longueurs: [1.375, 1.5, 2, 2.5, 3, 4, 6] },
    },
  },
  capuchon: {
    nom: 'Capuchon',
    nomAnglais: 'Cap',
    // Plans McMaster 4778K144 / 4778K145 (classe 150, même forme qu'en NPT)
    tailles: {
      '1/2': { longueur: 0.75, bourrelet: 0.18, mcmaster: '4778K144' },
      '3/4': { longueur: 0.87, bourrelet: 0.20, mcmaster: '4778K145' },
    },
  },
  bouchon: {
    nom: 'Bouchon',
    nomAnglais: 'Square head plug',
    // Plans McMaster 4627K333 / 4627K334 : tête carrée (sur plats), longueur totale, longueur filetée
    tailles: {
      '1/2': { carre: 9 / 16, longueur: 0.94, filet: 0.56, mcmaster: '4627K333' },
      '3/4': { carre: 5 / 8, longueur: 1.25, filet: 0.62, mcmaster: '4627K334' },
    },
  },
  reducteur: {
    nom: 'Réducteur hexagonal',
    nomAnglais: 'Hex bushing (M × F)',
    feminin: false,
    // Clé « mâle|femelle ». Plan McMaster 44605K346.
    tailles: {
      '3/4|1/2': { hexagone: 1 + 5 / 32, longueur: 0.85, longHex: 0.29, mcmaster: '44605K346' },
      '3/4|3/8': { hexagone: 1 + 5 / 32, longueur: 0.85, longHex: 0.29, mcmaster: '44605K345' },
      '3/4|1/4': { hexagone: 1 + 5 / 32, longueur: 0.85, longHex: 0.29, mcmaster: '44605K344' },
      // 1/2 × 3/8 et 1/2 × 1/4 : pas offerts en fonte chez McMaster ; cotes estimées.
      '1/2|3/8': { hexagone: 15 / 16, longueur: 0.72, longHex: 0.25 },
      '1/2|1/4': { hexagone: 15 / 16, longueur: 0.72, longHex: 0.25 },
    },
  },
};
