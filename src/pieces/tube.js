// Raccords de tube en laiton (SAE 45°, inverted flare, compression) et tube de cuivre recuit.
// Les connecteurs sont livrés montés : écrou (et bague, en compression) en place.
// Repère de construction : axe Z, bout NPT à z = 0, côté tube vers +Z ; la pièce finie est tournée sur l'axe X.
// Sorties : 'npt-m' / 'npt-f' côté tuyau ; 'tube-f' côté tube (avec engagement et garniture), 'tube-m' pour le tube.
import * as THREE from 'three';
import { TUBE, FILETS_TUBE, ECROUS, BAGUES, ARRET_COMPRESSION, CONNECTEURS } from 'app/donnees/tube.js';
import { FILETS_NPT } from 'app/donnees/npt.js';
import { revolution, arrondi } from 'app/geometrie/revolution.js';
import { filetDroitComplet, rayonsFiletDroit } from 'app/geometrie/filets.js';
import { placer, port, prisme } from 'app/geometrie/formes.js';
import { boutFemelle, boutMale } from 'app/pieces/npt.js';
import { MATERIAUX } from 'app/materiaux.js';
import { repereA, surfaceCintree, bout } from 'app/geometrie/cintrage.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SEG = 56;
const LAITON = { corps: MATERIAUX.laiton, filet: MATERIAUX.filetLaiton };
const rev = (profil, mat) => new THREE.Mesh(revolution(profil, SEG, 40), mat);
const LONG_HEX = 0.24;

function filet(g, opt, mat) { for (const geo of filetDroitComplet(opt)) g.add(new THREE.Mesh(geo, mat)); }

// Côté NPT : filet mâle conique (z de 0 à lN) ou taraudage (z de 0 à B). Renvoie la fin du côté NPT.
function coteNpt(g, genre, tn, rb) {
  const f = FILETS_NPT[tn];
  if (genre === 'm') {
    const lN = f.L1 + 0.15;
    g.add(boutMale(tn, { longueurFiletee: lN, rInt: rb, materiau: MATERIAUX.filetLaiton }));
    return { fin: lN, rFace: f.D / 2 * 0.97 };
  }
  const B = f.L1 + 3 / f.tpi;
  const fem = boutFemelle(tn, { bourrelet: false, profondeur: B, materiaux: LAITON });
  g.add(fem.groupe);
  g.add(rev([[fem.alesage, B], [rb, B + 0.04]], MATERIAUX.laiton));
  return { fin: B + 0.12, rFace: fem.rFraisure, debutHex: 0 };
}

// --- SAE 45° : nez à 45° fileté sur le corps, écrou femelle (à jupe) par-dessus. ---
function sae(g, t, zh1, L, rb) {
  const th = FILETS_TUBE.sae[t], { rMaj, rMin } = rayonsFiletDroit(th.maj, th.tpi);
  const e = ECROUS.sae[t], R = TUBE[t].D / 2, p = TUBE[t].paroi;
  const zN = L, rTip = rb + 0.03, zt1 = zN - (rMin - rTip), zt0 = zh1 + 0.05;
  // Corps : gorge, filet, nez conique.
  g.add(rev([[rMin - 0.006, zh1], [rMin - 0.006, zt0]], MATERIAUX.laiton));
  filet(g, { z0: zt0, z1: zt1, maj: th.maj, tpi: th.tpi, phase: 0.4 }, MATERIAUX.filetLaiton);
  g.add(rev([[rMin, zt1], [rTip, zN], [rb, zN]], MATERIAUX.laiton));
  // Écrou : hexagone puis jupe conique ; taraudage, cône d'appui à 45°, alésage.
  const zn0 = zh1 + 0.08, zB = zn0 + e.L, lhx = e.L * 0.5, rD = e.D / 2;
  const rS = R + 0.085, ep = 0.045;
  const zCone1 = zN - (rMaj - rTip - ep), zCone2 = zN + ep - (rD - rTip);
  g.add(new THREE.Mesh(prisme(6, e.hex, zn0, zn0 + lhx, [rMaj, rS]), MATERIAUX.laiton));
  filet(g, { z0: zn0 + 0.02, z1: zCone1, maj: th.maj, tpi: th.tpi, interieur: true, phase: 0.4 }, MATERIAUX.filetLaiton);
  g.add(rev([
    [rD, zCone2], [rMaj, zCone1],
  ], MATERIAUX.filetLaiton));
  g.add(rev([
    [rD, zB], [rD, zCone2],
  ], MATERIAUX.laiton));
  g.add(rev([
    [e.hex / 2 * 0.95, zn0 + lhx - 0.005], [e.hex / 2 * 0.9, zn0 + lhx + 0.03],
    [rS, zB - 0.035], [rS - 0.01, zB - 0.008], [rS - 0.03, zB], [rD, zB],
  ], MATERIAUX.laiton));
  // Évasement du tube : coquille conique posée sur le nez (coordonnées : [rayon, profondeur depuis la face de l'écrou]).
  const zFin = zN + 0.02, d = z => zB - z;
  const garniture = {
    profil: [[R - p, d(zFin)], [R, d(zFin)], [rTip + ep, d(zN)], [rMin + 0.01, d(zN - (rMin + 0.01 - rTip - ep))],
      [rMin - 0.03, d(zN - (rMin - 0.03 - rTip))], [rTip, d(zN)], [R - p, d(zFin)]],
    materiau: 'cuivre',
  };
  return { face: zB, engagement: zB - zFin, garniture };
}

// --- Inverted flare : taraudage dans le corps, cône d'appui saillant au fond, écrou mâle en acier. ---
function inverse(g, t, L, rb) {
  const th = FILETS_TUBE.if[t], { rMaj, rMin } = rayonsFiletDroit(th.maj, th.tpi);
  const e = ECROUS.if[t], R = TUBE[t].D / 2, p = TUBE[t].paroi;
  const lhn = 0.19, tIF = e.L - lhn - 0.02;
  const zF = L, zBas = zF - tIF - 0.02, rc = R + 0.075;
  // Port femelle du corps : fraisure, taraudage, fond plat, cône saillant à 45°.
  g.add(rev([[rMaj, zF - 0.03], [rMaj + 0.03, zF]], MATERIAUX.laiton));
  filet(g, { z0: zBas + 0.02, z1: zF - 0.03, maj: th.maj, tpi: th.tpi, interieur: true, phase: 1.1 }, MATERIAUX.filetLaiton);
  g.add(rev([[rb, zBas + (rc - rb)], [rc, zBas], [rMaj, zBas], [rMaj, zBas + 0.02]], MATERIAUX.laiton));
  // Écrou mâle (acier zingué) : tige filetée puis tête hexagonale hors du corps.
  const zT = zBas + 0.1, zH0 = zF + 0.1, zH1 = zT + e.L, rD = e.D / 2;
  filet(g, { z0: zT, z1: zH0, maj: th.maj - 0.008, tpi: th.tpi, phase: 1.1 }, MATERIAUX.acierZingue);
  g.add(rev([[rD, zH0], [rD, zT], [rMin - 0.008, zT - 0.0001]], MATERIAUX.acierZingue));
  g.add(rev([[rMin - 0.008, zH0], [e.hex / 2 * 0.9, zH0]], MATERIAUX.acierZingue));
  g.add(new THREE.Mesh(prisme(6, e.hex, zH0, zH1, rD), MATERIAUX.acierZingue));
  g.add(rev([[rD, zH1], [rD, zH0]], MATERIAUX.acierZingue));
  // Double évasement : du bout du tube (au bout de l'écrou) jusqu'au cône saillant.
  const d = z => zH1 - z;
  const garniture = {
    profil: [[R - p, d(zT)], [R, d(zT)], [rc, d(zBas + 0.012)], [rc - 0.02, d(zBas + 0.004)],
      [rb + 0.01, d(zBas + (rc - rb) - 0.012)], [R - p, d(zT)]],
    materiau: 'cuivre',
  };
  return { face: zH1, engagement: zH1 - zT, garniture };
}

// --- Compression : filet mâle sur le corps, embouchure conique, arrêt du tube ; écrou et bague. ---
function compression(g, t, zh1, L, rb) {
  const th = FILETS_TUBE.comp[t], { rMaj, rMin } = rayonsFiletDroit(th.maj, th.tpi);
  const e = ECROUS.comp[t], b = BAGUES[t], R = TUBE[t].D / 2, E = ARRET_COMPRESSION[t];
  const zB = L, zN = zB - 0.17, zt0 = zh1 + 0.03, zS = zN - E;
  const rBouche = b.F / 2 + 0.008, rT = R + 0.003;
  // Corps : filet, nez, embouchure conique, logement du tube, arrêt.
  filet(g, { z0: zt0, z1: zN - 0.02, maj: th.maj, tpi: th.tpi, phase: 0.7 }, MATERIAUX.filetLaiton);
  g.add(rev([[rb, zS], [rT, zS], [rT, zN - 0.07], [rBouche, zN], [rMin - 0.02, zN], [rMin, zN - 0.02]], MATERIAUX.laiton));
  // Écrou hexagonal : taraudage, cône intérieur, trou du tube.
  const zn0 = zB - e.L, rD = R + 0.006;
  g.add(new THREE.Mesh(prisme(6, e.hex, zn0, zB, [rMaj, rD]), MATERIAUX.laiton));
  filet(g, { z0: zn0 + 0.02, z1: zN + 0.03, maj: th.maj, tpi: th.tpi, interieur: true, phase: 0.7 }, MATERIAUX.filetLaiton);
  g.add(rev([[rD, zB], [rD, zB - 0.05], [rMaj, zN + 0.03]], MATERIAUX.laiton));
  // Bague biconique (sleeve).
  const zc = zN + 0.03, rb0 = R + 0.004, rbx = R + 0.018;
  g.add(rev([[rb0, zc + b.L / 2], [rb0, zc - b.L / 2], [rbx, zc - b.L / 2], [b.F / 2, zc], [rbx, zc + b.L / 2], [rb0, zc + b.L / 2]], MATERIAUX.laiton));
  return { face: zB, engagement: zB - zS, garniture: null };
}

// Connecteur tube × NPT. raccord : 'sae', 'if' ou 'comp' ; genre : 'm' ou 'f' (côté NPT).
function connecteur(raccord, genre, t, tn) {
  const c = CONNECTEURS[`${raccord}-${genre}`][`${t}|${tn}`];
  const rb = c.D / 2, g = new THREE.Group(), axe = new THREE.Group();
  const npt = coteNpt(axe, genre, tn, rb);
  let res;
  if (raccord === 'if') {
    // Le corps hexagonal contient le port femelle du tube.
    const zh0 = genre === 'm' ? npt.fin : 0;
    axe.add(new THREE.Mesh(prisme(6, c.hex, zh0, c.L, [npt.rFace, FILETS_TUBE.if[t].maj / 2 + 0.03]), MATERIAUX.laiton));
    res = inverse(axe, t, c.L, rb);
    axe.add(rev([[rb, c.L - ECROUS.if[t].L], [rb, genre === 'm' ? 0 : npt.fin - 0.04]], MATERIAUX.laiton));
  } else {
    const zh0 = genre === 'm' ? npt.fin : 0;
    const zh1 = genre === 'm' ? zh0 + LONG_HEX : Math.max(npt.fin, LONG_HEX + 0.1);
    const th = FILETS_TUBE[raccord][t];
    axe.add(new THREE.Mesh(prisme(6, c.hex, zh0, zh1, [npt.rFace, rayonsFiletDroit(th.maj, th.tpi).rMin - 0.006]), MATERIAUX.laiton));
    res = raccord === 'sae' ? sae(axe, t, zh1, c.L, rb) : compression(axe, t, zh1, c.L, rb);
    const fond = raccord === 'sae' ? c.L : c.L - 0.17 - ARRET_COMPRESSION[t];
    axe.add(rev([[rb, fond], [rb, genre === 'm' ? 0 : npt.fin - 0.04]], MATERIAUX.laiton));
  }
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  const pt = port(V(res.face, 0, 0), V(1, 0, 0), 'tube-f', t);
  pt.engagement = res.engagement;
  pt.garniture = res.garniture;
  pt.raccord = raccord;
  g.userData.ports = [port(V(0, 0, 0), V(-1, 0, 0), `npt-${genre}`, tn), pt];
  return g;
}

export const saeM = (t, _l, tn) => connecteur('sae', 'm', t, tn);
export const saeF = (t, _l, tn) => connecteur('sae', 'f', t, tn);
export const ifM = (t, _l, tn) => connecteur('if', 'm', t, tn);
export const ifF = (t, _l, tn) => connecteur('if', 'f', t, tn);
export const compM = (t, _l, tn) => connecteur('comp', 'm', t, tn);
export const compF = (t, _l, tn) => connecteur('comp', 'f', t, tn);

// Tube de cuivre recuit, coupé d'équerre.
export function tube(t, longueur) {
  const d = TUBE[t], L = longueur ?? 6, h = L / 2, R = d.D / 2, r = R - d.paroi, b = 0.004;
  const g = new THREE.Group(), axe = new THREE.Group();
  axe.add(new THREE.Mesh(revolution([
    [r, h - b], [r + b, h], [R - b, h], [R, h - b], [R, -h + b], [R - b, -h], [r + b, -h], [r, -h + b], [r, h - b],
  ].reverse(), SEG, 25), MATERIAUX.cuivre));
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  g.userData.ports = [port(V(-h, 0, 0), V(-1, 0, 0), 'tube-m', t), port(V(h, 0, 0), V(1, 0, 0), 'tube-m', t)];
  return g;
}

// Tube cintré importé de la cintreuse 3D : piece.cintrage = { longueur, rayon, coudes }.
// Le bout A est à l'origine ; le tube part vers +Z.
export function tubeCintre(t, _l, _tb, piece) {
  const { longueur: L, rayon: Rc, coudes } = piece.cintrage;
  const d = TUBE[t], R = d.D / 2, r = R - d.paroi;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(surfaceCintree(coudes, L, Rc, R), MATERIAUX.cuivre));
  g.add(new THREE.Mesh(surfaceCintree(coudes, L, Rc, r, true), MATERIAUX.cuivre));
  g.add(new THREE.Mesh(bout(coudes, 0, Rc, R, r), MATERIAUX.cuivre));
  g.add(new THREE.Mesh(bout(coudes, L, Rc, R, r), MATERIAUX.cuivre));
  const a = repereA(coudes, 0, Rc), b = repereA(coudes, L, Rc);
  g.userData.ports = [port(a.P.clone(), a.T.clone().negate(), 'tube-m', t), port(b.P.clone(), b.T.clone(), 'tube-m', t)];
  return g;
}

export const CONSTRUCTEURS_TUBE = { tube, saeM, saeF, ifM, ifF, compM, compF, tubeCintre };
