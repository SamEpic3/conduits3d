// Tube de cuivre et raccords à souder (wrot), plus les adaptateurs cuivre × NPT.
// Mêmes conventions que les raccords NPT : pièces droites sur l'axe X, coudes et té dans le plan XY.
// Types de sorties : 'cu-f' = douille (le tube entre dedans), 'cu-m' = bout de tube.
import * as THREE from 'three';
import { TUBE_CUIVRE, JEU_SOUDURE, RACCORDS_CUIVRE, HEX_ADAPTATEUR } from 'app/donnees/cuivre.js';
import { FILETS_NPT } from 'app/donnees/npt.js';
import { revolution, arrondi } from 'app/geometrie/revolution.js';
import { placer, port, cheminCoude, cylindrePerce, brancheTe, prisme } from 'app/geometrie/formes.js';
import { boutFemelle, boutMale } from 'app/pieces/npt.js';
import { MATERIAUX } from 'app/materiaux.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SEG = 64;
const EPAULEMENT = 0.06;     // longueur du rétrécissement entre la douille et le corps

// Dimensions de base d'une grosseur.
function cotes(taille) {
  const t = TUBE_CUIVRE[taille];
  const Ri = t.D / 2 + JEU_SOUDURE;        // intérieur de la douille
  const Ro = Ri + t.paroi;                 // extérieur de la douille
  const Rb = t.D / 2;                      // extérieur du corps (même Ø que le tube)
  const rbi = Rb - t.paroi;                // intérieur du corps
  return { ...t, Ri, Ro, Rb, rbi, P: t.profondeur };
}

// Douille : face dans le plan z = 0, le tube entre vers +Z jusqu'à l'arrêt (z = P),
// puis l'épaulement ramène au diamètre du corps.
export function douille(taille) {
  const c = cotes(taille), { Ri, Ro, Rb, rbi, P } = c;
  const l = 0.012;   // arrondi de la lèvre
  const profil = [
    [rbi, P + EPAULEMENT], [rbi, P], [Ri, P],
    ...arrondi([Ri, P], [Ri, 0], [Ro, 0], l, 3),
    ...arrondi([Ri, 0], [Ro, 0], [Ro, P], l, 3),
    ...arrondi([Ro, 0], [Ro, P], [Rb, P + EPAULEMENT], 0.03, 4),
    [Rb, P + EPAULEMENT],
  ];
  const g = new THREE.Group();
  g.add(new THREE.Mesh(revolution(profil, SEG), MATERIAUX.cuivre));
  return { groupe: g, ...c, debutCorps: P + EPAULEMENT };
}

// Coude : d1, d2 = directions des sorties ; C = centre à l'arrêt du tube (NIBCO).
function coude(taille, C, d1, d2) {
  const c = cotes(taille), A = C + c.P;
  const g = new THREE.Group();
  for (const d of [d1, d2]) g.add(placer(douille(taille).groupe, d.clone().multiplyScalar(A), d.clone().negate()));
  const tg = Math.tan((Math.PI - d1.angleTo(d2)) / 2);
  const R = Math.max(C / tg, c.Rb + 0.015);       // rayon de cintrage (coude à rayon court)
  const dc = C - EPAULEMENT;
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cheminCoude(d1, d2, dc, dc, R), 80, c.Rb, SEG, false), MATERIAUX.cuivre));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cheminCoude(d1, d2, C, C, R), 80, c.rbi, SEG, false), MATERIAUX.cuivre));
  g.userData.ports = [port(d1.clone().multiplyScalar(A), d1, 'cu-f', taille), port(d2.clone().multiplyScalar(A), d2, 'cu-f', taille)];
  return g;
}

export const coude90 = taille => coude(taille, RACCORDS_CUIVRE.coude90.tailles[taille].centreArret, V(1, 0, 0), V(0, 1, 0));
export const coude45 = taille => coude(taille, RACCORDS_CUIVRE.coude45.tailles[taille].centreArret, V(1, 0, 0),
  V(Math.cos(3 * Math.PI / 4), Math.sin(3 * Math.PI / 4), 0));

// Té : passage sur X, dérivation vers +Y (dérivation étirée, avec un petit congé).
export function te(taille) {
  const c = cotes(taille), C = RACCORDS_CUIVRE.te.tailles[taille].centreArret, A = C + c.P;
  const g = new THREE.Group();
  const dirs = [V(1, 0, 0), V(-1, 0, 0), V(0, 1, 0)];
  for (const d of dirs) g.add(placer(douille(taille).groupe, d.clone().multiplyScalar(A), d.clone().negate()));
  const dc = C - EPAULEMENT + 0.01;
  const ext = brancheTe(c.Rb, c.Rb, dc, f => c.Rb * 0.3 * Math.cos(f) ** 2);
  const int = brancheTe(c.rbi, c.rbi, C, f => c.rbi * 0.25 * Math.cos(f) ** 2);
  g.add(new THREE.Mesh(cylindrePerce(c.Rb, -dc, dc, f => ext.baseBranche(f) - 0.005), MATERIAUX.cuivre));
  g.add(new THREE.Mesh(ext.geo, MATERIAUX.cuivre));
  g.add(new THREE.Mesh(cylindrePerce(c.rbi, -C, C, f => int.baseBranche(f) - 0.004), MATERIAUX.cuivre));
  g.add(new THREE.Mesh(int.geo, MATERIAUX.cuivre));
  g.userData.ports = dirs.map(d => port(d.clone().multiplyScalar(A), d, 'cu-f', taille));
  return g;
}

// Manchon à arrêt roulé : une rainure roulée au milieu forme l'arrêt du tube à l'intérieur.
export function manchon(taille) {
  const c = cotes(taille), e = RACCORDS_CUIVRE.manchon.tailles[taille].ecart;
  const L = 2 * c.P + e, h = L / 2, { Ri, Ro } = c;
  const creux = 0.03, lr = Math.max(e / 2, 0.05);
  const p = [
    [Ri, -h + 0.012], [Ri + 0.006, -h], [Ro - 0.006, -h], [Ro, -h + 0.012],
    [Ro, -lr - 0.03], [Ro - creux, 0], [Ro, lr + 0.03],
    [Ro, h - 0.012], [Ro - 0.006, h], [Ri + 0.006, h], [Ri, h - 0.012],
    [Ri, lr], [Ri - creux, 0], [Ri, -lr], [Ri, -h + 0.012],
  ];
  const g = new THREE.Group(), axe = new THREE.Group();
  axe.add(new THREE.Mesh(revolution(p, SEG, 25), MATERIAUX.cuivre));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(-h, 0, 0), V(-1, 0, 0), 'cu-f', taille), port(V(h, 0, 0), V(1, 0, 0), 'cu-f', taille)];
  return g;
}

// Union : douille de cuivre – bout hexagonal en laiton – écrou hexagonal en laiton – douille de cuivre.
export function union(taille) {
  const c = cotes(taille), u = RACCORDS_CUIVRE.union.tailles[taille];
  const L = 2 * c.P + u.ecart, h = L / 2;
  const g = new THREE.Group(), axe = new THREE.Group();
  axe.add(placer(douille(taille).groupe, V(0, 0, -h), V(0, 0, 1)));
  axe.add(placer(douille(taille).groupe, V(0, 0, h), V(0, 0, -1)));
  const zArretA = -h + c.P, zArretB = h - c.P;
  axe.add(new THREE.Mesh(revolution([[c.rbi, zArretB], [c.rbi, zArretA]], SEG), MATERIAUX.cuivre));
  const hex1 = u.hexagone * 0.82;
  axe.add(new THREE.Mesh(prisme(6, hex1, zArretA - 0.14, zArretA + 0.1, c.Ro), MATERIAUX.laiton));
  axe.add(new THREE.Mesh(prisme(6, u.hexagone, zArretA + 0.1, zArretB + 0.16, c.Ro), MATERIAUX.laiton));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(-h, 0, 0), V(-1, 0, 0), 'cu-f', taille), port(V(h, 0, 0), V(1, 0, 0), 'cu-f', taille)];
  return g;
}

// Capuchon : douille fermée par un fond bombé.
export function capuchon(taille) {
  const c = cotes(taille), N = RACCORDS_CUIVRE.capuchon.tailles[taille].bout;
  const { Ri, Ro, P } = c;
  const fond = P + N;
  const profil = [
    [0, P], [Ri, P],
    ...arrondi([Ri, P], [Ri, 0], [Ro, 0], 0.012, 3),
    ...arrondi([Ri, 0], [Ro, 0], [Ro, fond], 0.012, 3),
    ...arrondi([Ro, 0], [Ro, fond], [0, fond], N * 1.1, 8),
    [0, fond],
  ];
  const g = new THREE.Group(), axe = new THREE.Group();
  axe.add(new THREE.Mesh(revolution(profil, SEG, 50), MATERIAUX.cuivre));
  axe.rotation.y = -Math.PI / 2;            // la douille s'ouvre vers +X
  g.add(axe);
  g.userData.ports = [port(V(0, 0, 0), V(1, 0, 0), 'cu-f', taille)];
  return g;
}

// Courbe en S (évasement) de [r0, z0] à [r1, z1], pour les adaptateurs.
function evasement(r0, z0, r1, z1, n = 10) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n, s = u * u * (3 - 2 * u);
    pts.push([r0 + (r1 - r0) * s, z0 + (z1 - z0) * u]);
  }
  return pts;
}

// Lèvre et intérieur de la douille, de l'arrêt (z = P) jusqu'à l'extérieur à la face.
function levreDouille(c) {
  const { Ri, Ro, P } = c, l = 0.012;
  return [
    [c.rbi, P + 0.04], [c.rbi, P], [Ri, P],
    ...arrondi([Ri, P], [Ri, 0], [Ro, 0], l, 3),
    ...arrondi([Ri, 0], [Ro, 0], [Ro, P], l, 3),
  ];
}

// Adaptateur cuivre × NPT femelle : douille, évasement courbe, hexagone mince taraudé.
// taille = grosseur du cuivre ; tailleNpt = grosseur du filet.
export function adaptF(taille, _longueur, tailleNpt = taille) {
  const c = cotes(taille), a = RACCORDS_CUIVRE.adaptF.tailles[`${taille}|${tailleNpt}`];
  const f = FILETS_NPT[tailleNpt];
  const face = c.P + a.arretFace;
  const B = Math.min(a.arretFace - 0.12, f.L1 + 3 / f.tpi);
  const rH = HEX_ADAPTATEUR.femelle[tailleNpt] / 2;
  const lh = Math.min(0.3, a.arretFace * 0.4);             // longueur de l'hexagone
  const g = new THREE.Group(), axe = new THREE.Group();
  const fem = boutFemelle(tailleNpt, { bourrelet: false, profondeur: B, materiaux: { corps: MATERIAUX.cuivre, filet: MATERIAUX.filetCuivre } });
  const rFin = Math.max(rH * 0.985, c.Ro);
  axe.add(new THREE.Mesh(revolution([
    [fem.alesage, face - B],
    ...levreDouille(c),
    ...evasement(c.Ro, c.P - 0.06, rFin, face - lh + 0.004).slice(0),
  ].filter((p, i, t) => i === 0 || p[0] !== t[i - 1][0] || p[1] !== t[i - 1][1]), SEG, 40), MATERIAUX.cuivre));
  axe.add(placer(fem.groupe, V(0, 0, face), V(0, 0, -1)));
  axe.add(new THREE.Mesh(prisme(6, rH * 2, face - lh, face, [rFin * 0.99, fem.rFraisure]), MATERIAUX.cuivre));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(0, 0, 0), V(-1, 0, 0), 'cu-f', taille), port(V(face, 0, 0), V(1, 0, 0), 'npt-f', tailleNpt)];
  return g;
}

// Adaptateur cuivre × NPT mâle : douille, évasement courbe, hexagone mince, puis filet mâle.
export function adaptM(taille, _longueur, tailleNpt = taille) {
  const c = cotes(taille), a = RACCORDS_CUIVRE.adaptM.tailles[`${taille}|${tailleNpt}`];
  const f = FILETS_NPT[tailleNpt];
  const rH = Math.max(HEX_ADAPTATEUR.male[tailleNpt], 2 * c.Ro + 0.1) / 2;
  const lh = 0.16;
  const zh0 = c.P + 0.08, zh1 = zh0 + lh, bout = zh1 + a.filet;
  const ri = f.D / 2 - 0.09;
  const rFin = Math.max(rH * 0.985, c.Ro);
  const g = new THREE.Group(), axe = new THREE.Group();
  axe.add(new THREE.Mesh(revolution([
    [ri, bout], [ri, zh1], [Math.min(c.rbi, ri), c.P + 0.04],
    ...levreDouille(c).slice(1),
    ...evasement(c.Ro, c.P - 0.06, rFin, zh0 + 0.004),
  ], SEG, 40), MATERIAUX.cuivre));
  axe.add(new THREE.Mesh(prisme(6, rH * 2, zh0, zh1, [rFin * 0.99, f.D / 2 * 0.97]), MATERIAUX.cuivre));
  axe.add(placer(boutMale(tailleNpt, { longueurFiletee: a.filet, rInt: ri, materiau: MATERIAUX.filetCuivre }), V(0, 0, bout), V(0, 0, -1)));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(0, 0, 0), V(-1, 0, 0), 'cu-f', taille), port(V(bout, 0, 0), V(1, 0, 0), 'npt-m', tailleNpt)];
  return g;
}

// Tube de cuivre type L, coupé d'équerre et ébavuré.
export function tube(taille, longueur) {
  const t = TUBE_CUIVRE[taille], L = longueur ?? 3, h = L / 2;
  const R = t.D / 2, r = R - t.paroi, b = 0.006;
  const profil = [
    [r, h - b], [r + b, h], [R - b, h], [R, h - b],
    [R, -h + b], [R - b, -h], [r + b, -h], [r, -h + b], [r, h - b],
  ];
  // Profil parcouru pour avoir la matière à droite : on l'inverse.
  const g = new THREE.Group(), axe = new THREE.Group();
  axe.add(new THREE.Mesh(revolution(profil.reverse(), SEG, 25), MATERIAUX.cuivre));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(-h, 0, 0), V(-1, 0, 0), 'cu-m', taille), port(V(h, 0, 0), V(1, 0, 0), 'cu-m', taille)];
  return g;
}

export const CONSTRUCTEURS_CUIVRE = { tube, coude90, coude45, te, manchon, union, capuchon, adaptF, adaptM };
