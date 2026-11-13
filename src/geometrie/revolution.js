// Surfaces de révolution autour de l'axe Z.
import * as THREE from 'three';

// Révolution d'un profil [[r, z], ...] autour de Z.
// Les normales suivent le sens du profil : en parcourant le profil, la matière est à droite
// (profil extérieur : z croissant vers l'extérieur ; profil intérieur : à l'envers).
// Les coins vifs (angle > angleVif) reçoivent des sommets doublés pour garder une arête nette.
export function revolution(profil, segments = 64, angleVif = 35) {
  // Découpe le profil en tronçons lisses.
  const pts = profil.map(([r, z]) => new THREE.Vector2(r, z));
  const troncons = [[pts[0]]];
  for (let i = 1; i < pts.length; i++) {
    troncons[troncons.length - 1].push(pts[i]);
    if (i < pts.length - 1) {
      const a = pts[i].clone().sub(pts[i - 1]).normalize();
      const b = pts[i + 1].clone().sub(pts[i]).normalize();
      const ang = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * 180 / Math.PI;
      if (ang > angleVif) troncons.push([pts[i]]);
    }
  }

  const pos = [], nor = [], idx = [];
  for (const t of troncons) {
    if (t.length < 2) continue;
    // Normale 2D de chaque sommet du tronçon (moyenne des segments voisins).
    const n2 = t.map((p, i) => {
      const a = t[Math.max(0, i - 1)], b = t[Math.min(t.length - 1, i + 1)];
      const d = b.clone().sub(a).normalize();
      return new THREE.Vector2(d.y, -d.x); // perpendiculaire, côté droit
    });
    const base = pos.length / 3;
    for (let s = 0; s <= segments; s++) {
      const th = s / segments * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      t.forEach((p, i) => {
        pos.push(p.x * c, p.x * sn, p.y);
        nor.push(n2[i].x * c, n2[i].x * sn, n2[i].y);
      });
    }
    const n = t.length;
    for (let s = 0; s < segments; s++) for (let i = 0; i < n - 1; i++) {
      const a = base + s * n + i, b = a + 1, c2 = a + n, d = c2 + 1;
      idx.push(a, c2, b, b, c2, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// Ajoute un arrondi (quart de cercle approché) entre trois points du profil.
// Renvoie les points qui remplacent le coin « b ».
export function arrondi(a, b, c, rayon, n = 4) {
  const A = new THREE.Vector2(...a), B = new THREE.Vector2(...b), C = new THREE.Vector2(...c);
  const u = A.clone().sub(B).normalize(), v = C.clone().sub(B).normalize();
  const la = Math.min(rayon, A.distanceTo(B) / 2), lc = Math.min(rayon, C.distanceTo(B) / 2);
  const p0 = B.clone().addScaledVector(u, la), p1 = B.clone().addScaledVector(v, lc);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; // courbe de Bézier quadratique p0 → B → p1
    const q = p0.clone().multiplyScalar((1 - t) ** 2)
      .addScaledVector(B, 2 * t * (1 - t)).addScaledVector(p1, t * t);
    out.push([q.x, q.y]);
  }
  return out;
}

// Applique des arrondis à certains coins d'un profil : coins = {indice: rayon}.
export function arrondirProfil(profil, coins) {
  const out = [];
  profil.forEach((p, i) => {
    const r = coins[i];
    if (r && i > 0 && i < profil.length - 1) out.push(...arrondi(profil[i - 1], p, profil[i + 1], r));
    else out.push(p);
  });
  return out;
}
