// Raccords NPT en fonte malléable noire (classe 150).
import * as THREE from 'three';
import { FILETS_NPT, FONTE_150, RACCORDS_NPT, hauteurFilet, CONICITE } from 'app/donnees/npt.js';
import { revolution, arrondi } from 'app/geometrie/revolution.js';
import { surfaceFiletee, bouchonFilet } from 'app/geometrie/filets.js';
import { MATERIAUX } from 'app/materiaux.js';

// Bout femelle : bourrelet, face, fraisure d'entrée et taraudage conique.
// Repère local : face dans le plan z = 0, le filet entre vers +Z.
// Renvoie { groupe, arriere } : arriere = [rayon du corps, z] où le corps du raccord doit se raccorder.
export function boutFemelle(taille, phase = 0) {
  const f = FILETS_NPT[taille], fo = FONTE_150[taille];
  const pas = 1 / f.tpi, h = hauteurFilet(f.tpi);
  const rFlanc = z => f.E1 / 2 - z * CONICITE / 2;       // plus étroit en s'enfonçant
  const rMaj0 = rFlanc(0) + h / 2;                        // fond du taraudage à la face
  const fraisure = 0.035;                                 // fraisure à 45° à l'entrée
  const rFr = rMaj0 + fraisure;
  const B = fo.longFiletee;
  const rB = fo.bourrelet.d / 2, lB = fo.bourrelet.l, rC = fo.corps / 2;
  const congé = 0.03;

  const g = new THREE.Group();

  // Extérieur : fraisure → face → bourrelet → épaulement vers le corps.
  const coinFace = arrondi([rFr, 0], [rB, 0], [rB, lB], 0.025);
  const coinArriere = arrondi([rB, 0], [rB, lB], [rC, lB], 0.02);
  const profil = [
    [rMaj0, fraisure], [rFr, 0],
    ...coinFace,
    ...coinArriere,
    ...arrondi([rB, lB], [rC, lB], [rC, lB + congé * 2], congé),
    [rC, lB + congé * 2],
  ];
  g.add(new THREE.Mesh(revolution(profil, 72), MATERIAUX.fonte));

  // Taraudage (filets bruts, un peu plus pâles que la fonte peinte).
  const opt = { z0: fraisure, z1: B, rFlanc, pas, hauteur: h, interieur: true, phase };
  g.add(new THREE.Mesh(surfaceFiletee(opt), MATERIAUX.filet));
  g.add(new THREE.Mesh(bouchonFilet({ ...opt, z: fraisure, R: rMaj0, sens: -1 }), MATERIAUX.filet));
  const rFondFilet = rFlanc(B) - h / 2;
  g.add(new THREE.Mesh(bouchonFilet({ ...opt, z: B, R: rFondFilet, sens: 1 }), MATERIAUX.filet));

  return { groupe: g, corps: rC, debutCorps: lB + congé * 2, alesage: rFondFilet, profondeur: B };
}

// Place un bout femelle : face à « position », filet entrant dans la direction « entree ».
function placer(bout, position, entree) {
  bout.groupe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), entree.clone().normalize());
  bout.groupe.position.copy(position);
  return bout.groupe;
}

// Nervure de moulage le long de Z, posée sur un corps de rayon rCorps, à l'angle donné autour de l'axe.
//   saillie : hauteur au-dessus du corps ; longueur : centrée sur z = 0
function nervure(rCorps, saillie, longueur, angle) {
  const largeur = rCorps * 0.19, r = Math.min(saillie, largeur) * 0.45;
  // Section arrondie (en x : largeur, en y : hauteur), qui part sous la surface pour bien se fondre au corps.
  const bas = -0.03, haut = saillie, w = largeur / 2;
  const s = new THREE.Shape();
  s.moveTo(-w, bas);
  s.lineTo(-w, haut - r); s.quadraticCurveTo(-w, haut, -w + r, haut);
  s.lineTo(w - r, haut); s.quadraticCurveTo(w, haut, w, haut - r);
  s.lineTo(w, bas); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: longueur, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -longueur / 2);
  const m = new THREE.Mesh(geo, MATERIAUX.fonte);
  // La section est dessinée dans le plan XY avec la hauteur vers +Y : on la pose sur le corps.
  const pivot = new THREE.Group();
  m.position.y = rCorps;
  pivot.add(m);
  pivot.rotation.z = angle - Math.PI / 2;
  return pivot;
}

// Manchon : axe Z, centré à l'origine.
export function manchon(taille) {
  const L = RACCORDS_NPT.manchon.tailles[taille].longueur;
  const g = new THREE.Group();
  const a = boutFemelle(taille, 0), b = boutFemelle(taille, 1.3);
  g.add(placer(a, new THREE.Vector3(0, 0, -L / 2), new THREE.Vector3(0, 0, 1)));
  g.add(placer(b, new THREE.Vector3(0, 0, L / 2), new THREE.Vector3(0, 0, -1)));

  // Corps et alésage entre les deux taraudages.
  const zc = L / 2 - a.debutCorps;
  g.add(new THREE.Mesh(revolution([[a.corps, -zc], [a.corps, zc]], 72), MATERIAUX.fonte));
  const zb = L / 2 - a.profondeur;
  g.add(new THREE.Mesh(revolution([[a.alesage, zb], [a.alesage, -zb]], 72), MATERIAUX.fonte));

  // Nervures de moulage : une de chaque côté, au plan de joint du moule, d'un bourrelet à l'autre.
  for (const angle of [0, Math.PI]) g.add(nervure(a.corps, (FONTE_150[taille].bourrelet.d / 2 - a.corps) * 0.6, zc * 2 + 0.16, angle));

  g.userData = {
    ports: [
      { position: new THREE.Vector3(0, 0, -L / 2), sortie: new THREE.Vector3(0, 0, -1), type: 'npt-f', taille },
      { position: new THREE.Vector3(0, 0, L / 2), sortie: new THREE.Vector3(0, 0, 1), type: 'npt-f', taille },
    ],
  };
  return g;
}

export const CONSTRUCTEURS_NPT = { manchon };
