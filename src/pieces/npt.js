// Raccords NPT en fonte malléable noire (classe 150) et mamelons en acier noir.
// Convention : les pièces droites sont sur l'axe X ; les coudes et le té sont dans le plan XY.
// Chaque pièce porte userData.ports : position de la face, direction de sortie, type et taille.
import * as THREE from 'three';
import { FILETS_NPT, FONTE_150, RACCORDS_NPT, hauteurFilet, CONICITE } from 'app/donnees/npt.js';
import { revolution, arrondi } from 'app/geometrie/revolution.js';
import { surfaceFiletee, bouchonFilet } from 'app/geometrie/filets.js';
import { MATERIAUX } from 'app/materiaux.js';
import { placer, port, cheminCoude, cylindrePerce, brancheTe, prisme } from 'app/geometrie/formes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SEG = 72;

// ---------------------------------------------------------------------------
// Bout femelle : (bourrelet,) face, fraisure d'entrée et taraudage conique.
// Repère local : face dans le plan z = 0, le filet entre vers +Z.
export function boutFemelle(taille, { phase = 0, bourrelet = true, longBourrelet, profondeur, materiaux = { corps: MATERIAUX.fonte, filet: MATERIAUX.filet } } = {}) {
  const f = FILETS_NPT[taille], fo = FONTE_150[taille];
  const pas = 1 / f.tpi, h = hauteurFilet(f.tpi);
  const rFlanc = z => f.E1 / 2 - z * CONICITE / 2;       // plus étroit en s'enfonçant
  const rMaj0 = rFlanc(0) + h / 2;                        // fond du taraudage à la face
  const fraisure = 0.035;                                 // fraisure à 45° à l'entrée
  const rFr = rMaj0 + fraisure;
  const B = profondeur ?? fo.longFiletee;
  const rB = fo.bourrelet.d / 2, lB = longBourrelet ?? fo.bourrelet.l, rC = fo.corps / 2;
  const conge = 0.03;

  const g = new THREE.Group();
  if (bourrelet) {
    // Extérieur : fraisure → face → bourrelet → épaulement vers le corps.
    g.add(new THREE.Mesh(revolution([
      [rMaj0, fraisure], [rFr, 0],
      ...arrondi([rFr, 0], [rB, 0], [rB, lB], 0.025),
      ...arrondi([rB, 0], [rB, lB], [rC, lB], 0.02),
      ...arrondi([rB, lB], [rC, lB], [rC, lB + conge * 2], conge),
      [rC, lB + conge * 2],
    ], SEG), materiaux.corps));
  } else {
    g.add(new THREE.Mesh(revolution([[rMaj0, fraisure], [rFr, 0]], SEG), materiaux.corps));
  }

  // Taraudage (métal brut, plus pâle que la fonte).
  const opt = { z0: fraisure, z1: B, rFlanc, pas, hauteur: h, interieur: true, phase };
  g.add(new THREE.Mesh(surfaceFiletee(opt), materiaux.filet));
  g.add(new THREE.Mesh(bouchonFilet({ ...opt, z: fraisure, R: rMaj0, sens: -1 }), materiaux.filet));
  const rFond = rFlanc(B) - h / 2;
  g.add(new THREE.Mesh(bouchonFilet({ ...opt, z: B, R: rFond, sens: 1 }), materiaux.filet));

  return { groupe: g, corps: rC, debutCorps: lB + conge * 2, alesage: rFond, profondeur: B, rFraisure: rFr };
}

// Nervure de moulage le long de Z, posée sur un corps de rayon rCorps, à l'angle donné autour de l'axe.
function nervure(rCorps, saillie, longueur, angle) {
  const largeur = rCorps * 0.19, r = Math.min(saillie, largeur) * 0.45;
  const bas = -0.03, haut = saillie, w = largeur / 2;
  const s = new THREE.Shape();
  s.moveTo(-w, bas);
  s.lineTo(-w, haut - r); s.quadraticCurveTo(-w, haut, -w + r, haut);
  s.lineTo(w - r, haut); s.quadraticCurveTo(w, haut, w, haut - r);
  s.lineTo(w, bas); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: longueur, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -longueur / 2);
  const m = new THREE.Mesh(geo, MATERIAUX.fonte);
  m.position.y = rCorps;
  const pivot = new THREE.Group();
  pivot.add(m);
  pivot.rotation.z = angle - Math.PI / 2;
  return pivot;
}

// Bout mâle : filet conique au bout d'un tuyau, avec les filets incomplets à la fin du filetage.
// Repère local : bout du tuyau dans le plan z = 0, le tuyau s'étend vers +Z.
// longueurFiletee : longueur filetée (par défaut L4) ; rInt : rayon intérieur (face du bout).
export function boutMale(taille, { longueurFiletee, phase = 0, rInt, materiau = MATERIAUX.filet } = {}) {
  const f = FILETS_NPT[taille];
  const pas = 1 / f.tpi, h = hauteurFilet(f.tpi), R = f.D / 2;
  const lf = longueurFiletee ?? f.L4;
  const fin = Math.min(f.L4, lf), debutEvan = Math.min(f.L2, fin * 0.75);
  const g = new THREE.Group();
  const opt = {
    z0: 0, z1: lf, rFlanc: zz => f.E0 / 2 + zz * CONICITE / 2, pas, hauteur: h, phase,
    rMax: R, evanouissement: [debutEvan, fin],
  };
  g.add(new THREE.Mesh(surfaceFiletee(opt), materiau));
  g.add(new THREE.Mesh(bouchonFilet({ ...opt, z: 0, R: rInt ?? f.diInt / 2, sens: -1 }), materiau));
  return g;
}

// ---------------------------------------------------------------------------
// Raccords

// Manchon (coupling) : axe X, centré à l'origine.
export function manchon(taille) {
  const L = RACCORDS_NPT.manchon.tailles[taille].longueur;
  const g = new THREE.Group(), axe = new THREE.Group();
  const a = boutFemelle(taille), b = boutFemelle(taille, { phase: 1.3 });
  axe.add(placer(a.groupe, V(0, 0, -L / 2), V(0, 0, 1)));
  axe.add(placer(b.groupe, V(0, 0, L / 2), V(0, 0, -1)));
  const zc = L / 2 - a.debutCorps, zb = L / 2 - a.profondeur;
  axe.add(new THREE.Mesh(revolution([[a.corps, -zc], [a.corps, zc]], SEG), MATERIAUX.fonte));
  axe.add(new THREE.Mesh(revolution([[a.alesage, zb], [a.alesage, -zb]], SEG), MATERIAUX.fonte));
  // Nervures de moulage, de chaque côté, d'un bourrelet à l'autre.
  for (const angle of [0, Math.PI])
    axe.add(nervure(a.corps, (FONTE_150[taille].bourrelet.d / 2 - a.corps) * 0.6, zc * 2 + 0.16, angle));
  axe.rotation.y = Math.PI / 2;            // axe Z local → axe X
  g.add(axe);
  g.userData.ports = [port(V(-L / 2, 0, 0), V(-1, 0, 0), 'npt-f', taille), port(V(L / 2, 0, 0), V(1, 0, 0), 'npt-f', taille)];
  return g;
}

// Coude : deux sorties d1 et d2 (directions depuis le centre), centre à face A, rayon de cintrage du corps.
function coude(taille, A, d1, d2, rayon) {
  const g = new THREE.Group();
  const a = boutFemelle(taille), b = boutFemelle(taille, { phase: 2.1 });
  g.add(placer(a.groupe, d1.clone().multiplyScalar(A), d1.clone().negate()));
  g.add(placer(b.groupe, d2.clone().multiplyScalar(A), d2.clone().negate()));
  const tg = Math.tan((Math.PI - d1.angleTo(d2)) / 2);
  // Corps : tube cintré entre l'arrière des deux bourrelets.
  const dc = A - a.debutCorps;
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cheminCoude(d1, d2, dc, dc, rayon), 96, a.corps, SEG, false), MATERIAUX.fonte));
  // Passage intérieur, entre le fond des deux taraudages.
  const di = A - a.profondeur;
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cheminCoude(d1, d2, di, di, Math.min(rayon, di / tg)), 96, a.alesage, SEG, false), MATERIAUX.fonte));
  g.userData.ports = [port(d1.clone().multiplyScalar(A), d1, 'npt-f', taille), port(d2.clone().multiplyScalar(A), d2, 'npt-f', taille)];
  return g;
}

// Coude 90° : sorties vers +X et +Y. Le corps est cintré d'un bourrelet à l'autre :
// l'intérieur de la courbe garde un bon rayon (≈ 0,3 po), comme sur les vrais coudes.
export function coude90(taille) {
  const A = RACCORDS_NPT.coude90.tailles[taille].centreFace;
  const deb = boutFemelle(taille).debutCorps;
  return coude(taille, A, V(1, 0, 0), V(0, 1, 0), A - deb);
}

// Coude 45° : sorties vers +X et à 135° (le tuyau dévie de 45°). Le corps est cintré d'un bourrelet à l'autre.
export function coude45(taille) {
  const A = RACCORDS_NPT.coude45.tailles[taille].centreFace;
  const d2 = V(Math.cos(3 * Math.PI / 4), Math.sin(3 * Math.PI / 4), 0);
  const deb = boutFemelle(taille).debutCorps;
  return coude(taille, A, V(1, 0, 0), d2, (A - deb) / Math.tan(Math.PI / 8));
}

// Té : passage droit sur X, dérivation vers +Y.
export function te(taille) {
  const A = RACCORDS_NPT.te.tailles[taille].centreFace;
  const g = new THREE.Group();
  const dirs = [V(1, 0, 0), V(-1, 0, 0), V(0, 1, 0)];
  const bouts = dirs.map((d, i) => {
    const b = boutFemelle(taille, { phase: i * 1.7 });
    g.add(placer(b.groupe, d.clone().multiplyScalar(A), d.clone().negate()));
    return b;
  });
  const b0 = bouts[0];
  const rC = b0.corps, dc = A - b0.debutCorps, ra = b0.alesage, di = A - b0.profondeur;
  // Congés de fonderie : plein congé dans l'entrejambe, nul sur les côtés.
  const congeExt = f => rC * 0.42 * Math.cos(f) ** 2;
  const congeInt = f => ra * 0.35 * Math.cos(f) ** 2;
  const ext = brancheTe(rC, rC, dc, congeExt), int = brancheTe(ra, ra, di, congeInt);
  g.add(new THREE.Mesh(cylindrePerce(rC, -dc, dc, f => ext.baseBranche(f) - 0.006), MATERIAUX.fonte));
  g.add(new THREE.Mesh(ext.geo, MATERIAUX.fonte));
  g.add(new THREE.Mesh(cylindrePerce(ra, -di, di, f => int.baseBranche(f) - 0.004), MATERIAUX.fonte));
  g.add(new THREE.Mesh(int.geo, MATERIAUX.fonte));
  g.userData.ports = dirs.map(d => port(d.clone().multiplyScalar(A), d, 'npt-f', taille));
  return g;
}

// Union : bout hexagonal – écrou octogonal – bout hexagonal, axe X.
export function union(taille) {
  const u = RACCORDS_NPT.union.tailles[taille];
  const L = u.longueur, lb = u.longBout;
  const g = new THREE.Group(), axe = new THREE.Group();
  const a = boutFemelle(taille, { bourrelet: false, profondeur: u.filet });
  const b = boutFemelle(taille, { bourrelet: false, profondeur: u.filet, phase: 0.8 });
  axe.add(placer(a.groupe, V(0, 0, -L / 2), V(0, 0, 1)));
  axe.add(placer(b.groupe, V(0, 0, L / 2), V(0, 0, -1)));
  axe.add(new THREE.Mesh(prisme(6, u.hexagone, -L / 2, -L / 2 + lb, a.rFraisure), MATERIAUX.fonte));
  axe.add(new THREE.Mesh(prisme(6, u.hexagone, L / 2 - lb, L / 2, a.rFraisure), MATERIAUX.fonte));
  axe.add(new THREE.Mesh(prisme(8, u.octogone, -L / 2 + lb, L / 2 - lb, u.hexagone / 2 * 0.9), MATERIAUX.fonte));
  const zb = L / 2 - u.filet;
  axe.add(new THREE.Mesh(revolution([[a.alesage, zb], [a.alesage, -zb]], SEG), MATERIAUX.fonte));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(-L / 2, 0, 0), V(-1, 0, 0), 'npt-f', taille), port(V(L / 2, 0, 0), V(1, 0, 0), 'npt-f', taille)];
  return g;
}

// Mamelon (nipple) : tuyau schedule 40 fileté aux deux bouts, axe X.
export function mamelon(taille, longueur) {
  const f = FILETS_NPT[taille];
  const L = longueur ?? RACCORDS_NPT.mamelon.tailles[taille].longueurs[0];
  const pas = 1 / f.tpi, h = hauteurFilet(f.tpi), R = f.D / 2, ri = f.diInt / 2;
  const g = new THREE.Group(), axe = new THREE.Group();
  const lf = Math.min(f.L4, L / 2);                       // un mamelon court est fileté d'un bout à l'autre
  for (const [z, dir, phase] of [[-L / 2, 1, 0], [L / 2, -1, 2.4]])
    axe.add(placer(boutMale(taille, { longueurFiletee: lf, phase }), V(0, 0, z), V(0, 0, dir)));
  if (L / 2 > lf + 1e-4) axe.add(new THREE.Mesh(revolution([[R, -L / 2 + lf], [R, L / 2 - lf]], SEG), MATERIAUX.acierNoir));
  axe.add(new THREE.Mesh(revolution([[ri, L / 2], [ri, -L / 2]], SEG), MATERIAUX.acierNoir));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(-L / 2, 0, 0), V(-1, 0, 0), 'npt-m', taille), port(V(L / 2, 0, 0), V(1, 0, 0), 'npt-m', taille)];
  return g;
}

// Capuchon (cap) : bourrelet, corps et fond bombé ; s'ouvre vers -X.
export function capuchon(taille) {
  const c = RACCORDS_NPT.capuchon.tailles[taille];
  const L = c.longueur;
  const B = Math.min(FONTE_150[taille].longFiletee, L - 0.22);
  const g = new THREE.Group(), axe = new THREE.Group();
  const b = boutFemelle(taille, { longBourrelet: c.bourrelet, profondeur: B });
  axe.add(b.groupe);
  const rC = b.corps, rd = rC * 0.45;
  axe.add(new THREE.Mesh(revolution([
    [rC, b.debutCorps],
    ...arrondi([rC, b.debutCorps], [rC, L], [0, L], rd, 10),
    [0, L],
  ], SEG, 50), MATERIAUX.fonte));
  axe.add(new THREE.Mesh(revolution([[0.001, B], [b.alesage, B]], SEG), MATERIAUX.fonte));
  // Nervure de moulage sur le côté, du bourrelet vers le fond.
  const lgN = L - b.debutCorps - rd * 0.6;
  for (const angle of [0, Math.PI]) {
    const n = nervure(rC, (FONTE_150[taille].bourrelet.d / 2 - rC) * 0.6, lgN + 0.06, angle);
    n.position.z = b.debutCorps - 0.03 + lgN / 2;
    axe.add(n);
  }
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(0, 0, 0), V(-1, 0, 0), 'npt-f', taille)];
  return g;
}

// Bouchon à tête carrée (plug) : filet mâle conique, tête carrée aux coins arrondis.
export function bouchon(taille) {
  const c = RACCORDS_NPT.bouchon.tailles[taille], f = FILETS_NPT[taille];
  const g = new THREE.Group(), axe = new THREE.Group();
  axe.add(boutMale(taille, { longueurFiletee: c.filet, rInt: 0.001 }));
  // Épaulement entre le filet et la tête.
  axe.add(new THREE.Mesh(revolution([[f.D / 2, c.filet], [0.001, c.filet]], SEG), MATERIAUX.filet));
  axe.add(new THREE.Mesh(prisme(4, c.carre, c.filet, c.longueur, 0.001, { chanfrein: false, rCoins: c.carre * 0.6 }), MATERIAUX.fonte));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(0, 0, 0), V(-1, 0, 0), 'npt-m', taille)];
  return g;
}

// Réducteur hexagonal (bushing) : filet mâle (taille) d'un côté, hexagone taraudé (tailleB) de l'autre.
export function reducteur(taille, _longueur, tailleB) {
  const r = RACCORDS_NPT.reducteur.tailles[`${taille}|${tailleB}`];
  const fm = FILETS_NPT[taille];
  const g = new THREE.Group(), axe = new THREE.Group();
  const lf = r.longueur - r.longHex, face = r.longueur;
  const B = Math.min(r.longueur - 0.12, FONTE_150[tailleB].longFiletee + 0.12);
  const fem = boutFemelle(tailleB, { bourrelet: false, profondeur: B });
  axe.add(placer(fem.groupe, V(0, 0, face), V(0, 0, -1)));
  axe.add(boutMale(taille, { longueurFiletee: lf, rInt: fem.alesage }));
  axe.add(new THREE.Mesh(revolution([[fem.alesage, face - B], [fem.alesage, 0]], SEG), MATERIAUX.fonte));
  axe.add(new THREE.Mesh(prisme(6, r.hexagone, lf, face, [fm.D / 2 * 0.97, fem.rFraisure]), MATERIAUX.fonte));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(0, 0, 0), V(-1, 0, 0), 'npt-m', taille), port(V(face, 0, 0), V(1, 0, 0), 'npt-f', tailleB)];
  return g;
}

export const CONSTRUCTEURS_NPT = { manchon, coude90, coude45, te, union, mamelon, capuchon, bouchon, reducteur };
