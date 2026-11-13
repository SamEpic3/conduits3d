// Tube cintré décrit comme dans la cintreuse 3D : une longueur et une liste de coudes
// { s0 : début du coude depuis le bout A (po), a : angle (°), th : rotation du tube (°) }.
// Même calcul que la cintreuse : un repère (P, T, N, B) transporté le long de l'axe du tube.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const longueurArc = (b, R) => R * b.a * DEG;

// Repère à l'abscisse s (depuis le bout A). Au départ, le tube va vers +Z.
export function repereA(coudes, s, R) {
  const P = V(0, 0, 0), T = V(0, 0, 1), N = V(1, 0, 0), B = V(0, 1, 0);
  let c = 0;
  const sortie = () => ({ P, T, N, B });
  for (const b of coudes) {
    if (s <= b.s0) { P.addScaledVector(T, s - c); return sortie(); }
    P.addScaledVector(T, b.s0 - c);
    const len = longueurArc(b, R), ang = Math.min(s - b.s0, len) / R, th = b.th * DEG;
    const dir = N.clone().multiplyScalar(Math.cos(th)).addScaledVector(B, Math.sin(th));
    const k = T.clone().cross(dir).normalize(), C = P.clone().addScaledVector(dir, R);
    P.sub(C).applyAxisAngle(k, ang).add(C);
    T.applyAxisAngle(k, ang); N.applyAxisAngle(k, ang); B.applyAxisAngle(k, ang);
    if (s <= b.s0 + len) return sortie();
    c = b.s0 + len;
  }
  P.addScaledVector(T, s - c);
  return sortie();
}

// Abscisses d'échantillonnage : les bouts, plus des points serrés dans chaque coude.
function abscisses(coudes, L, R) {
  const ss = [0, L];
  for (const b of coudes) {
    const len = longueurArc(b, R), n = Math.max(2, Math.ceil(b.a / 3));
    for (let i = 0; i <= n; i++) { const s = b.s0 + len * i / n; if (s > 0 && s < L) ss.push(s); }
  }
  return [...new Set(ss.map(s => +s.toFixed(6)))].sort((u, v) => u - v);
}

// Surface tubulaire de rayon r le long de l'axe ; interieur : normales vers l'axe.
export function surfaceCintree(coudes, L, R, r, interieur = false, seg = 40) {
  const ss = abscisses(coudes, L, R), pos = [], nor = [], idx = [];
  ss.forEach((s, i) => {
    const q = repereA(coudes, s, R);
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * 2 * Math.PI;
      const n = q.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(q.B, Math.sin(a));
      pos.push(q.P.x + n.x * r, q.P.y + n.y * r, q.P.z + n.z * r);
      const sg = interieur ? -1 : 1;
      nor.push(n.x * sg, n.y * sg, n.z * sg);
    }
    if (i) {
      const b0 = (i - 1) * (seg + 1), b1 = i * (seg + 1);
      for (let j = 0; j < seg; j++) {
        if (interieur) idx.push(b0 + j, b0 + j + 1, b1 + j, b0 + j + 1, b1 + j + 1, b1 + j);
        else idx.push(b0 + j, b1 + j, b0 + j + 1, b0 + j + 1, b1 + j, b1 + j + 1);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// Couronne au bout du tube (épaisseur de la paroi), à l'abscisse s.
export function bout(coudes, s, R, rExt, rInt, seg = 40) {
  const q = repereA(coudes, s, R), sg = s <= 0 ? -1 : 1, pos = [], idx = [];
  for (let j = 0; j <= seg; j++) {
    const a = j / seg * 2 * Math.PI;
    const n = q.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(q.B, Math.sin(a));
    for (const rr of [rExt, rInt]) pos.push(q.P.x + n.x * rr, q.P.y + n.y * rr, q.P.z + n.z * rr);
  }
  for (let j = 0; j < seg; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  void sg;
  return g;
}

// Lit et vérifie un fichier exporté par la cintreuse. Renvoie { longueur, rayon, coudes } ou { erreur }.
export function lireTubeCintre(texte) {
  let d;
  try { d = JSON.parse(texte); } catch { return { erreur: 'Ce fichier n\'est pas un tube exporté par la cintreuse (format illisible).' }; }
  if (d?.format !== 'tube-cintre' || !(d.longueur > 0) || !Array.isArray(d.coudes))
    return { erreur: 'Ce fichier n\'est pas un tube exporté par la cintreuse 3D.' };
  const coudes = d.coudes.map(b => ({ s0: +b.s0, a: +b.a, th: +b.th }))
    .filter(b => Number.isFinite(b.s0) && b.a > 0.01 && Number.isFinite(b.th)).sort((u, v) => u.s0 - v.s0);
  return { longueur: +d.longueur, rayon: +d.rayon || 15 / 16, coudes, tube: d.tube };
}
