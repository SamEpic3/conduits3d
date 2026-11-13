// Modèle du montage : un arbre de pièces reliées par leurs sorties (ports).
// La première pièce est à l'origine ; chaque autre pièce est vissée sur une sortie libre d'une pièce déjà posée.
import * as THREE from 'three';
import { FILETS_NPT } from 'app/donnees/npt.js';
import { CONSTRUCTEURS_NPT } from 'app/pieces/npt.js';

const Y = new THREE.Vector3(0, 1, 0);

// Deux sorties peuvent se raccorder si elles sont de même grosseur et de genres opposés.
export function compatibles(a, b) {
  if (a.taille !== b.taille) return `Les grosseurs ne correspondent pas (${a.taille} po et ${b.taille} po).`;
  const ga = a.type.slice(-1), gb = b.type.slice(-1);
  if (ga === 'f' && gb === 'f') return 'Deux bouts femelles ne se vissent pas ensemble : il faut un mamelon ou un bout de tuyau entre les deux.';
  if (ga === 'm' && gb === 'm') return 'Deux bouts mâles ne se vissent pas ensemble : il faut un raccord (manchon, coude, té, union) entre les deux.';
  return null;
}

// Longueur du bout mâle qui entre dans le raccord une fois serré à la clé.
export const engagement = taille => FILETS_NPT[taille].engagement;

export class Montage {
  constructor(scene) {
    this.groupe = new THREE.Group();
    scene.add(this.groupe);
    this.pieces = [];          // {id, type, taille, longueur, angle, lien: null | {parent, port, portEnfant}}
    this.objets = new Map();   // id → THREE.Group
    this.seq = 0;
  }

  piece(id) { return this.pieces.find(p => p.id === id); }

  // Construit (ou reprend) l'objet 3D d'une pièce.
  objet(p) {
    let o = this.objets.get(p.id);
    if (!o) {
      o = CONSTRUCTEURS_NPT[p.type](p.taille, p.longueur);
      o.userData.idPiece = p.id;
      o.matrixAutoUpdate = false;
      this.objets.set(p.id, o);
      this.groupe.add(o);
    }
    return o;
  }

  ports(p) { return this.objet(p).userData.ports; }

  // Sorties déjà occupées d'une pièce (indices).
  occupees(p) {
    const s = new Set();
    if (p.lien) s.add(p.lien.portEnfant);
    for (const q of this.pieces) if (q.lien?.parent === p.id) s.add(q.lien.port);
    return s;
  }

  // Sorties libres de tout le montage, en coordonnées du monde.
  sortiesLibres() {
    const out = [];
    for (const p of this.pieces) {
      const occ = this.occupees(p);
      this.ports(p).forEach((pt, i) => { if (!occ.has(i)) out.push({ id: p.id, port: i, ...this.portMonde(p, i) }); });
    }
    return out;
  }

  portMonde(p, i) {
    const o = this.objet(p), pt = this.ports(p)[i];
    const q = new THREE.Quaternion().setFromRotationMatrix(o.matrix);
    return {
      position: pt.position.clone().applyMatrix4(o.matrix),
      sortie: pt.sortie.clone().applyQuaternion(q).normalize(),
      type: pt.type, taille: pt.taille,
    };
  }

  // Ajoute une pièce. cible = {id, port} ou null pour la première pièce.
  // Renvoie {id} ou {erreur}.
  ajouter({ type, taille, longueur }, cible) {
    const p = { id: ++this.seq, type, taille, longueur, angle: 0, lien: null };
    if (cible) {
      const parent = this.piece(cible.id);
      const pp = this.ports(parent)[cible.port];
      // Première sortie compatible de la nouvelle pièce.
      const essai = CONSTRUCTEURS_NPT[type](taille, longueur);
      const ports = essai.userData.ports;
      const i = ports.findIndex(pt => !compatibles(pp, pt));
      essai.traverse(o => o.geometry?.dispose());
      if (i < 0) { this.seq--; return { erreur: compatibles(pp, ports[0]) }; }
      p.lien = { parent: parent.id, port: cible.port, portEnfant: i };
    } else if (this.pieces.length) {
      this.seq--;
      return { erreur: 'Choisis d\'abord une sortie libre (anneau orange) où brancher la pièce.' };
    }
    this.pieces.push(p);
    this.placer();
    return { id: p.id };
  }

  // Change la sortie par laquelle une pièce est branchée (ex. : brancher un té par sa dérivation).
  changerSortie(id) {
    const p = this.piece(id);
    if (!p?.lien) return false;
    const pp = this.ports(this.piece(p.lien.parent))[p.lien.port];
    const ports = this.ports(p), occ = this.occupees(p);
    for (let k = 1; k <= ports.length; k++) {
      const i = (p.lien.portEnfant + k) % ports.length;
      if (i === p.lien.portEnfant) break;
      if (occ.has(i)) continue;
      if (!compatibles(pp, ports[i])) { p.lien.portEnfant = i; this.placer(); return true; }
    }
    return false;
  }

  tourner(id, degres) {
    const p = this.piece(id);
    if (!p) return;
    p.angle = ((p.angle + degres) % 360 + 360) % 360;
    this.placer();
  }

  // Supprime une pièce et tout ce qui est branché dessus.
  supprimer(id) {
    const aSupprimer = new Set([id]);
    for (const p of this.pieces) if (p.lien && aSupprimer.has(p.lien.parent)) aSupprimer.add(p.id);
    this.pieces = this.pieces.filter(p => {
      if (!aSupprimer.has(p.id)) return true;
      const o = this.objets.get(p.id);
      if (o) { this.groupe.remove(o); o.traverse(x => x.geometry?.dispose()); this.objets.delete(p.id); }
      return false;
    });
  }

  vider() { for (const p of [...this.pieces]) if (!p.lien) this.supprimer(p.id); this.seq = 0; }

  // Calcule la position de chaque pièce (les parents sont toujours avant leurs enfants).
  placer() {
    for (const p of this.pieces) {
      const o = this.objet(p);
      if (!p.lien) {
        o.matrix.makeRotationAxis(Y, THREE.MathUtils.degToRad(p.angle));
      } else {
        const parent = this.piece(p.lien.parent);
        const cible = this.portMonde(parent, p.lien.port);
        const pe = this.ports(p)[p.lien.portEnfant];
        // La sortie de l'enfant pointe à l'opposé de celle du parent, puis on tourne autour de l'axe du joint.
        const q = new THREE.Quaternion().setFromUnitVectors(pe.sortie, cible.sortie.clone().negate());
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(cible.sortie, THREE.MathUtils.degToRad(p.angle)));
        // Le bout mâle entre dans le raccord : les deux ports sont décalés de l'engagement.
        const pos = cible.position.clone().addScaledVector(cible.sortie, -engagement(p.taille))
          .sub(pe.position.clone().applyQuaternion(q));
        o.matrix.compose(pos, q, new THREE.Vector3(1, 1, 1));
      }
      o.matrixWorldNeedsUpdate = true;
    }
    this.groupe.updateMatrixWorld(true);
  }

  // Points repères pour la mesure : centre de chaque raccord, faces et bouts de tuyau.
  pointsReperes() {
    const pts = [];
    for (const p of this.pieces) {
      const o = this.objet(p);
      if (p.type !== 'mamelon') pts.push({ p: new THREE.Vector3().applyMatrix4(o.matrix), genre: 'centre', cle: `${p.id}:c` });
      this.ports(p).forEach((_, i) => {
        const pm = this.portMonde(p, i);
        pts.push({ p: pm.position, genre: p.type === 'mamelon' ? 'bout' : 'face', cle: `${p.id}:${i}` });
      });
    }
    return pts;
  }

  // Pour annuler : état sérialisable.
  etat() { return JSON.stringify({ pieces: this.pieces, seq: this.seq }); }
  restaurer(json) {
    const e = JSON.parse(json);
    for (const p of [...this.pieces]) if (!p.lien) this.supprimer(p.id);
    this.pieces = e.pieces; this.seq = e.seq;
    this.placer();
  }
}
