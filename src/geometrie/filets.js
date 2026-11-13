// Filets en hélice (profil à 60° tronqué, comme le NPT), le long de l'axe Z.
import * as THREE from 'three';

// Profil sur un pas (t de 0 à 1 le long de l'axe) : écart radial par rapport au rayon sur flancs.
// Fond et sommet plats (troncature), flancs à 60°.
export function profilFilet(hauteur) {
  const plat = 0.04, flanc = 0.5 - plat, h = hauteur / 2;
  return [
    [0, -h], [plat, -h],                      // fond
    [plat + flanc, h], [2 * plat + flanc, h], // flanc montant, sommet
    [1, -h],                                  // flanc descendant
  ];
}

function ecart(profil, t) {
  for (let k = 0; k < profil.length - 1; k++) {
    const [ta, da] = profil[k], [tb, db] = profil[k + 1];
    if (t >= ta && t <= tb) return da + (db - da) * (tb > ta ? (t - ta) / (tb - ta) : 0);
  }
  return profil[0][1];
}

// Construit la surface filetée entre z0 et z1.
//   rFlanc(z) : rayon sur flancs (diamètre sur flancs / 2) à la hauteur z — permet la conicité
//   pas       : distance entre deux filets (1 / filets par pouce)
//   hauteur   : profondeur radiale du filet
//   interieur : true pour un filet femelle (taraudage), false pour un filet mâle
//   phase     : décalage angulaire du départ du filet (radians)
// Le filet est à droites : il avance vers +Z en tournant dans le sens trigonométrique.
export function surfaceFiletee({ z0, z1, rFlanc, pas, hauteur, interieur = false, phase = 0, segments = 72 }) {
  const profil = profilFilet(hauteur);

  const tours = (z1 - z0) / pas;
  const phiMin = -2 * Math.PI;                    // un tour de plus pour couvrir le début
  const phiMax = 2 * Math.PI * (tours + 0.0001);
  const nPhi = Math.ceil((phiMax - phiMin) / (2 * Math.PI) * segments);

  const pos = [], idx = [];
  const point = (phi, t) => {
    let z = z0 + (phi / (2 * Math.PI) + t) * pas;
    const r = rFlanc(THREE.MathUtils.clamp(z, z0, z1));
    const d = ecart(profil, t);
    // Hors des limites, on écrase le filet sur le plan de coupe (comme un filet coupé net).
    z = THREE.MathUtils.clamp(z, z0, z1);
    const a = phi + phase;
    return [(r + d) * Math.cos(a), (r + d) * Math.sin(a), z];
  };

  // Chaque segment du profil a ses propres sommets : arêtes nettes entre flancs et plats.
  for (let k = 0; k < profil.length - 1; k++) {
    const ta = profil[k][0], tb = profil[k + 1][0];
    const base = pos.length / 3;
    for (let i = 0; i <= nPhi; i++) {
      const phi = phiMin + (phiMax - phiMin) * i / nPhi;
      pos.push(...point(phi, ta), ...point(phi, tb));
    }
    for (let i = 0; i < nPhi; i++) {
      const a = base + 2 * i, b = a + 1, c = a + 2, d = a + 3;
      if (interieur) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Bouche le bout d'un filet : anneau plat dans le plan z, entre le bord en dents de scie
// du filet et le rayon R. sens = +1 si la face regarde vers +Z, -1 vers -Z.
// z0, pas, hauteur, rFlanc et phase doivent être les mêmes que pour surfaceFiletee.
export function bouchonFilet({ z, z0, rFlanc, pas, hauteur, phase = 0, R, sens, segments = 72 }) {
  const profil = profilFilet(hauteur);
  const n = segments * 4;
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const phi = 2 * Math.PI * i / n;
    let t = (z - z0) / pas - phi / (2 * Math.PI);
    t -= Math.floor(t);
    const r = rFlanc(z) + ecart(profil, t), a = phi + phase;
    pos.push(r * Math.cos(a), r * Math.sin(a), z, R * Math.cos(a), R * Math.sin(a), z);
  }
  for (let i = 0; i < n; i++) {
    const a = 2 * i, b = a + 1, c = a + 2, d = a + 3;
    // Avec phi croissant, (a→c) tourne dans le sens trigonométrique vu de +Z.
    const versExt = R > rFlanc(z);
    if ((sens > 0) === versExt) idx.push(a, b, c, b, d, c);
    else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0).flatMap(() => [0, 0, sens]), 3));
  g.setIndex(idx);
  return g;
}
