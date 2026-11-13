// Formes communes à plusieurs familles de raccords : placement, ports, coudes, té, prismes.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Place un groupe construit sur l'axe Z : son origine à « position », son +Z vers « direction ».
export function placer(groupe, position, direction) {
  groupe.quaternion.setFromUnitVectors(V(0, 0, 1), direction.clone().normalize());
  groupe.position.copy(position);
  return groupe;
}

export const port = (position, sortie, type, taille) => ({ position, sortie: sortie.clone().normalize(), type, taille });

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
export function cheminCoude(d1, d2, dist1, dist2, R) {
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

// Cylindre le long de X (de x0 à x1), rayon r, percé en haut (+Y) d'un trou centré en x = 0
// (pour le té). rTrou(θ) : rayon du trou selon l'angle autour de la branche (θ = 0 vers +X).
export function cylindrePerce(r, x0, x1, rTrou) {
  const nx = Math.ceil((x1 - x0) / 0.008), nf = 120;
  const pos = [], idx = [];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nf; j++) {
    const x = x0 + (x1 - x0) * i / nx, f = 2 * Math.PI * j / nf;
    pos.push(x, r * Math.cos(f), r * Math.sin(f));
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nf; j++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / nx, f = 2 * Math.PI * (j + 0.5) / nf;
    const y = r * Math.cos(f), z = r * Math.sin(f);
    if (y > 0 && Math.hypot(x, z) < rTrou(Math.atan2(z, x))) continue;
    const a = i * (nf + 1) + j, b = a + 1, c = a + nf + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Branche du té : cylindre le long de +Y, rayon r, qui part du cylindre horizontal de rayon R (axe X)
// et monte jusqu'à y1. À la jonction, un congé de rayon conge(θ) évase la branche
// (plein congé dans l'entrejambe, θ = 0 ou π ; rien sur les côtés, où les deux cylindres se rejoignent).
// Renvoie aussi baseBranche(θ) : rayon de la branche au pied du congé, pour percer le cylindre horizontal.
export function brancheTe(r, R, y1, conge) {
  const nf = 120, ny = 40;
  const pos = [], idx = [];
  const pied = f => {
    const c = conge(f), rb = r + c, z = rb * Math.sin(f);
    return { c, rb, y0: Math.sqrt(Math.max(0, R * R - z * z)) };
  };
  for (let j = 0; j <= nf; j++) {
    const f = 2 * Math.PI * j / nf, { c, y0 } = pied(f);
    for (let i = 0; i <= ny; i++) {
      // Rangées serrées dans le congé, puis le reste de la branche.
      const k = i / ny;
      const y = k < 0.5 ? y0 + c * (k / 0.5) : y0 + c + (y1 - y0 - c) * ((k - 0.5) / 0.5);
      const dy = y0 + c - y;
      const rr = dy > 0 && c > 0 ? r + c - Math.sqrt(Math.max(0, c * c - dy * dy)) : r;
      pos.push(rr * Math.cos(f), y, rr * Math.sin(f));
    }
  }
  for (let j = 0; j < nf; j++) for (let i = 0; i < ny; i++) {
    const a = j * (ny + 1) + i, b = a + 1, c = a + ny + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geo: g, baseBranche: f => pied(f).rb };
}

// Prisme à n pans (hexagone, octogone) le long de Z, de z0 à z1, avec un chanfrein à 30°
// à chaque bout (comme un écrou) et un trou central de rayon rInt (un nombre, ou [rayon en z0, rayon en z1]).
// Un plat est tourné vers +Y.
export function prisme(n, surPlats, z0, z1, rInt) {
  const [rI0, rI1] = Array.isArray(rInt) ? rInt : [rInt, rInt];
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
    for (const [z, sens, ri] of [[z0, -1, rI0], [z1, 1, rI1]]) {
      const E = sommet(f0, z), F = sommet(f1, z);
      const I = [ri * Math.cos(f0), ri * Math.sin(f0), z], J = [ri * Math.cos(f1), ri * Math.sin(f1), z];
      if (sens > 0) { tri(I, E, J); tri(E, F, J); } else { tri(I, J, E); tri(E, J, F); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

