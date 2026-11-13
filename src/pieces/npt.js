// Raccords NPT en fonte malléable noire (classe 150) et mamelons en acier noir.
// Convention : les pièces droites sont sur l'axe X ; les coudes et le té sont dans le plan XY.
// Chaque pièce porte userData.ports : position de la face, direction de sortie, type et taille.
import * as THREE from 'three';
import { FILETS_NPT, FONTE_150, RACCORDS_NPT, hauteurFilet, CONICITE } from 'app/donnees/npt.js';
import { revolution, arrondi } from 'app/geometrie/revolution.js';
import { surfaceFiletee, bouchonFilet } from 'app/geometrie/filets.js';
import { MATERIAUX } from 'app/materiaux.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SEG = 72;

// ---------------------------------------------------------------------------
// Bout femelle : (bourrelet,) face, fraisure d'entrée et taraudage conique.
// Repère local : face dans le plan z = 0, le filet entre vers +Z.
export function boutFemelle(taille, { phase = 0, bourrelet = true, profondeur } = {}) {
  const f = FILETS_NPT[taille], fo = FONTE_150[taille];
  const pas = 1 / f.tpi, h = hauteurFilet(f.tpi);
  const rFlanc = z => f.E1 / 2 - z * CONICITE / 2;       // plus étroit en s'enfonçant
  const rMaj0 = rFlanc(0) + h / 2;                        // fond du taraudage à la face
  const fraisure = 0.035;                                 // fraisure à 45° à l'entrée
  const rFr = rMaj0 + fraisure;
  const B = profondeur ?? fo.longFiletee;
  const rB = fo.bourrelet.d / 2, lB = fo.bourrelet.l, rC = fo.corps / 2;
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
    ], SEG), MATERIAUX.fonte));
  } else {
    g.add(new THREE.Mesh(revolution([[rMaj0, fraisure], [rFr, 0]], SEG), MATERIAUX.fonte));
  }

  // Taraudage (métal brut, plus pâle que la fonte).
  const opt = { z0: fraisure, z1: B, rFlanc, pas, hauteur: h, interieur: true, phase };
  g.add(new THREE.Mesh(surfaceFiletee(opt), MATERIAUX.filet));
  g.add(new THREE.Mesh(bouchonFilet({ ...opt, z: fraisure, R: rMaj0, sens: -1 }), MATERIAUX.filet));
  const rFond = rFlanc(B) - h / 2;
  g.add(new THREE.Mesh(bouchonFilet({ ...opt, z: B, R: rFond, sens: 1 }), MATERIAUX.filet));

  return { groupe: g, corps: rC, debutCorps: lB + conge * 2, alesage: rFond, profondeur: B, rFraisure: rFr };
}

// Place un groupe construit sur l'axe Z : son origine à « position », son +Z vers « direction ».
function placer(groupe, position, direction) {
  groupe.quaternion.setFromUnitVectors(V(0, 0, 1), direction.clone().normalize());
  groupe.position.copy(position);
  return groupe;
}

const port = (position, sortie, type, taille) => ({ position, sortie: sortie.clone().normalize(), type, taille });

// ---------------------------------------------------------------------------
// Outils de géométrie

// Arc de cercle de a vers b autour du centre c.
class Arc extends THREE.Curve {
  constructor(c, a, b) {
    super();
    this.c = c; this.u = a.clone().sub(c); this.v = b.clone().sub(c);
    this.phi = this.u.angleTo(this.v);
  }
  getPoint(t, cible = new THREE.Vector3()) {
    const s = Math.sin(this.phi);
    return cible.copy(this.c)
      .addScaledVector(this.u, Math.sin((1 - t) * this.phi) / s)
      .addScaledVector(this.v, Math.sin(t * this.phi) / s);
  }
}

// Chemin d'un coude : droite depuis la sortie 1, arc de rayon R tangent aux deux axes, droite jusqu'à la sortie 2.
// d1 et d2 : directions (depuis le centre du raccord) des deux sorties.
function cheminCoude(d1, d2, dist1, dist2, R) {
  const deviation = Math.PI - d1.angleTo(d2);
  const t = R * Math.tan(deviation / 2);
  const T1 = d1.clone().multiplyScalar(t), T2 = d2.clone().multiplyScalar(t);
  const C = d1.clone().add(d2).normalize().multiplyScalar(Math.hypot(t, R));
  const ch = new THREE.CurvePath();
  if (dist1 > t + 1e-4) ch.add(new THREE.LineCurve3(d1.clone().multiplyScalar(dist1), T1));
  ch.add(new Arc(C, T1, T2));
  if (dist2 > t + 1e-4) ch.add(new THREE.LineCurve3(T2, d2.clone().multiplyScalar(dist2)));
  return ch;
}

// Cylindre le long de X (de x0 à x1), rayon r, percé en haut (+Y) d'un trou de rayon rTrou
// centré en x = 0 (pour le té).
function cylindrePerce(r, x0, x1, rTrou) {
  const nx = Math.ceil((x1 - x0) / 0.008), nf = 120;
  const pos = [], idx = [];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nf; j++) {
    const x = x0 + (x1 - x0) * i / nx, f = 2 * Math.PI * j / nf;
    pos.push(x, r * Math.cos(f), r * Math.sin(f));
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nf; j++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / nx, f = 2 * Math.PI * (j + 0.5) / nf;
    const y = r * Math.cos(f), z = r * Math.sin(f);
    if (y > 0 && x * x + z * z < rTrou * rTrou) continue;
    const a = i * (nf + 1) + j, b = a + 1, c = a + nf + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Cylindre le long de +Y, rayon r, qui part de l'intersection avec un cylindre horizontal
// de rayon R (axe X) et monte jusqu'à y1 (la branche du té).
function cylindreSelle(r, R, y1) {
  const nf = 120, ny = 24;
  const pos = [], idx = [];
  for (let j = 0; j <= nf; j++) {
    const f = 2 * Math.PI * j / nf, x = r * Math.cos(f), z = r * Math.sin(f);
    const y0 = Math.sqrt(Math.max(0, R * R - z * z));
    for (let i = 0; i <= ny; i++) pos.push(x, y0 + (y1 - y0) * i / ny, z);
  }
  for (let j = 0; j < nf; j++) for (let i = 0; i < ny; i++) {
    const a = j * (ny + 1) + i, b = a + 1, c = a + ny + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Prisme à n pans (hexagone, octogone) le long de Z, de z0 à z1, avec un chanfrein à 30°
// à chaque bout (comme un écrou) et un trou central de rayon rInt. Un plat est tourné vers +Y.
function prisme(n, surPlats, z0, z1, rInt) {
  const a = surPlats / 2, rCoin = a / Math.cos(Math.PI / n);
  const rBout = a * 0.94;                          // le chanfrein laisse un cercle sur la face
  const lc = (rCoin - rBout) * Math.tan(Math.PI / 6);
  const rPoly = f => {
    const s = 2 * Math.PI / n;
    const rel = ((f - Math.PI / 2) % s + s) % s - s / 2;
    return a / Math.cos(rel);
  };
  const rCone = z => Math.min(rBout + (z - z0) / Math.tan(Math.PI / 6), rBout + (z1 - z) / Math.tan(Math.PI / 6));
  const zs = [];
  for (let k = 0; k <= 8; k++) zs.push(z0 + lc * k / 8);
  for (let k = 8; k >= 0; k--) zs.push(z1 - lc * k / 8);
  const nf = n * 24;
  const pos = [];
  const sommet = (f, z) => { const r = Math.min(rPoly(f), rCone(z)); return [r * Math.cos(f), r * Math.sin(f), z]; };
  const tri = (p, q, s) => pos.push(...p, ...q, ...s);
  for (let j = 0; j < nf; j++) {
    const f0 = 2 * Math.PI * j / nf, f1 = 2 * Math.PI * (j + 1) / nf;
    for (let i = 0; i < zs.length - 1; i++) {
      const A = sommet(f0, zs[i]), B = sommet(f0, zs[i + 1]), C = sommet(f1, zs[i]), D = sommet(f1, zs[i + 1]);
      tri(A, C, B); tri(B, C, D);
    }
    // faces des bouts (anneaux)
    for (const [z, sens] of [[z0, -1], [z1, 1]]) {
      const E = sommet(f0, z), F = sommet(f1, z);
      const I = [rInt * Math.cos(f0), rInt * Math.sin(f0), z], J = [rInt * Math.cos(f1), rInt * Math.sin(f1), z];
      if (sens > 0) { tri(I, E, J); tri(E, F, J); } else { tri(I, J, E); tri(E, J, F); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
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

// Coude 90° : sorties vers +X et +Y. Rayon de cintrage du corps mesuré sur le plan McMaster (0,56 po en 1/2).
export function coude90(taille) {
  const A = RACCORDS_NPT.coude90.tailles[taille].centreFace, rC = FONTE_150[taille].corps / 2;
  return coude(taille, A, V(1, 0, 0), V(0, 1, 0), Math.max(A * 0.5, rC + 0.02));
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
  g.add(new THREE.Mesh(cylindrePerce(rC, -dc, dc, rC - 0.006), MATERIAUX.fonte));
  g.add(new THREE.Mesh(cylindreSelle(rC, rC, dc), MATERIAUX.fonte));
  g.add(new THREE.Mesh(cylindrePerce(ra, -di, di, ra - 0.004), MATERIAUX.fonte));
  g.add(new THREE.Mesh(cylindreSelle(ra, ra, di), MATERIAUX.fonte));
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
  for (const [z, dir, phase] of [[-L / 2, 1, 0], [L / 2, -1, 2.4]]) {
    const bout = new THREE.Group();
    const opt = {
      z0: 0, z1: lf, rFlanc: zz => f.E0 / 2 + zz * CONICITE / 2, pas, hauteur: h, phase,
      rMax: R, evanouissement: [f.L2, f.L4],
    };
    bout.add(new THREE.Mesh(surfaceFiletee(opt), MATERIAUX.filet));
    bout.add(new THREE.Mesh(bouchonFilet({ ...opt, z: 0, R: ri, sens: -1 }), MATERIAUX.filet));
    axe.add(placer(bout, V(0, 0, z), V(0, 0, dir)));
  }
  if (L / 2 > lf + 1e-4) axe.add(new THREE.Mesh(revolution([[R, -L / 2 + lf], [R, L / 2 - lf]], SEG), MATERIAUX.acierNoir));
  axe.add(new THREE.Mesh(revolution([[ri, L / 2], [ri, -L / 2]], SEG), MATERIAUX.acierNoir));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(-L / 2, 0, 0), V(-1, 0, 0), 'npt-m', taille), port(V(L / 2, 0, 0), V(1, 0, 0), 'npt-m', taille)];
  return g;
}

export const CONSTRUCTEURS_NPT = { manchon, coude90, coude45, te, union, mamelon };
