// Catalogue de toutes les pièces, toutes familles confondues.
// Chaque entrée : nom, nomAnglais, famille, matiere, construire(taille, longueur),
//   longueur : null, ou { min(taille), suggestions(taille) } pour les tuyaux et tubes coupés sur mesure
//   centre : true si la pièce a un centre utile pour la mesure
//   deuxiemeTaille : étiquette de la 2e grosseur (adaptateurs, réducteurs), sinon absent
//   fiche(taille, longueur, tailleB) : lignes [étiquette, valeur en po] pour la fiche de la pièce
import { RACCORDS_NPT, FONTE_150, FILETS_NPT } from 'app/donnees/npt.js';
import { RACCORDS_CUIVRE, TUBE_CUIVRE } from 'app/donnees/cuivre.js';
import { CONSTRUCTEURS_NPT } from 'app/pieces/npt.js';
import { CONSTRUCTEURS_CUIVRE } from 'app/pieces/cuivre.js';

const FONTE = 'fonte malléable noire, classe 150';
const CUIVRE = 'cuivre corroyé (wrot), à souder';

const npt = (cle, extra) => ({
  ...RACCORDS_NPT[cle], famille: 'npt', matiere: FONTE, centre: true, longueur: null,
  construire: CONSTRUCTEURS_NPT[cle], ...extra,
});
const cu = (cle, extra) => ({
  ...RACCORDS_CUIVRE[cle], famille: 'cu', matiere: CUIVRE, centre: true, longueur: null,
  construire: CONSTRUCTEURS_CUIVRE[cle], ...extra,
});

const centreFace = cle => t => [['Centre à face', RACCORDS_NPT[cle].tailles[t].centreFace]];
const centreArret = cle => t => [
  ['Centre à l\'arrêt', RACCORDS_CUIVRE[cle].tailles[t].centreArret],
  ['Profondeur de douille', TUBE_CUIVRE[t].profondeur],
];

export const CATALOGUE = {
  // --- Acier NPT ---
  mamelon: npt('mamelon', {
    nom: 'Mamelon / tuyau', matiere: 'acier noir, schedule 40', centre: false,
    longueur: { min: t => RACCORDS_NPT.mamelon.tailles[t].longueurs[0], suggestions: t => RACCORDS_NPT.mamelon.tailles[t].longueurs },
    fiche: (t, L) => [['Longueur de coupe', L], ['Ø extérieur', FILETS_NPT[t].D], ['Filetage par bout', Math.min(FILETS_NPT[t].L4, L / 2)]],
  }),
  manchon: npt('manchon', { fiche: t => [['Longueur', RACCORDS_NPT.manchon.tailles[t].longueur], ['Ø du bourrelet', FONTE_150[t].bourrelet.d]] }),
  coude90: npt('coude90', { fiche: centreFace('coude90') }),
  coude45: npt('coude45', { fiche: centreFace('coude45') }),
  te: npt('te', { fiche: centreFace('te') }),
  union: npt('union', { fiche: t => [['Longueur', RACCORDS_NPT.union.tailles[t].longueur], ['Écrou (sur plats)', RACCORDS_NPT.union.tailles[t].octogone]] }),

  // --- Cuivre à souder ---
  'cu-tube': cu('tube', {
    nom: 'Tube de cuivre', matiere: 'cuivre type L', centre: false,
    longueur: { min: () => 0.25, suggestions: t => RACCORDS_CUIVRE.tube.tailles[t].longueurs },
    fiche: (t, L) => [['Longueur de coupe', L], ['Ø extérieur réel', TUBE_CUIVRE[t].D], ['Épaisseur (type L)', TUBE_CUIVRE[t].paroi]],
  }),
  'cu-coude90': cu('coude90', { nom: 'Coude 90° cuivre', fiche: centreArret('coude90') }),
  'cu-coude45': cu('coude45', { nom: 'Coude 45° cuivre', fiche: centreArret('coude45') }),
  'cu-te': cu('te', { nom: 'Té cuivre', fiche: centreArret('te') }),
  'cu-manchon': cu('manchon', {
    nom: 'Manchon cuivre',
    fiche: t => [['Longueur', 2 * TUBE_CUIVRE[t].profondeur + RACCORDS_CUIVRE.manchon.tailles[t].ecart], ['Profondeur de douille', TUBE_CUIVRE[t].profondeur]],
  }),
  'cu-union': cu('union', {
    nom: 'Union cuivre', matiere: 'cuivre et laiton, à souder',
    fiche: t => [['Entre les arrêts', RACCORDS_CUIVRE.union.tailles[t].ecart], ['Profondeur de douille', TUBE_CUIVRE[t].profondeur]],
  }),
  'cu-capuchon': cu('capuchon', {
    nom: 'Capuchon cuivre', centre: false,
    fiche: t => [['Longueur', TUBE_CUIVRE[t].profondeur + RACCORDS_CUIVRE.capuchon.tailles[t].bout]],
  }),
  'cu-adaptF': cu('adaptF', {
    nom: 'Adaptateur cuivre × NPT femelle', centre: false, deuxiemeTaille: 'Filet NPT femelle',
    fiche: (t, L, tb) => [['Arrêt à face NPT', RACCORDS_CUIVRE.adaptF.tailles[`${t}|${tb}`].arretFace], ['Profondeur de douille', TUBE_CUIVRE[t].profondeur]],
  }),
  'cu-adaptM': cu('adaptM', {
    nom: 'Adaptateur cuivre × NPT mâle', centre: false, deuxiemeTaille: 'Filet NPT mâle',
    fiche: (t, L, tb) => [['Filetage', RACCORDS_CUIVRE.adaptM.tailles[`${t}|${tb}`].filet], ['Profondeur de douille', TUBE_CUIVRE[t].profondeur]],
  }),
};

// Longueur dont un bout entre dans l'autre au joint : engagement des filets (NPT)
// ou profondeur de la douille (cuivre).
export function engagementJoint(type, taille) {
  return type.startsWith('cu') ? TUBE_CUIVRE[taille].profondeur : FILETS_NPT[taille].engagement;
}

// Deux sorties peuvent se raccorder si elles sont de la même famille, de même grosseur et de genres opposés.
// Renvoie null si c'est possible, sinon l'explication pour l'élève.
export function compatibles(a, b) {
  const [fa, ga] = a.type.split('-'), [fb, gb] = b.type.split('-');
  if (fa !== fb) return 'Le cuivre à souder ne se raccorde pas directement à un filet NPT : il faut un adaptateur cuivre × NPT.';
  if (a.taille !== b.taille) return `Les grosseurs ne correspondent pas (${a.taille} po et ${b.taille} po).`;
  if (fa === 'cu') {
    if (ga === 'f' && gb === 'f') return 'Deux douilles ne se soudent pas ensemble : il faut un bout de tube de cuivre entre les deux.';
    if (ga === 'm' && gb === 'm') return 'Deux bouts de tube ne se soudent pas bout à bout : il faut un raccord (manchon, coude, té…).';
  } else {
    if (ga === 'f' && gb === 'f') return 'Deux bouts femelles ne se vissent pas ensemble : il faut un mamelon ou un bout de tuyau entre les deux.';
    if (ga === 'm' && gb === 'm') return 'Deux bouts mâles ne se vissent pas ensemble : il faut un raccord (manchon, coude, té, union) entre les deux.';
  }
  return null;
}
