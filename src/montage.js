// Modèle du montage : un arbre de pièces reliées par leurs sorties (ports).
// La première pièce est à l'origine ; chaque autre pièce est vissée sur une sortie libre d'une pièce déjà posée.
import * as THREE from 'three';
import { CATALOGUE, compatibles, engagementJoint } from 'app/catalogue.js';
import { MATERIAUX } from 'app/materiaux.js';
import { TUBE_CUIVRE } from 'app/donnees/cuivre.js';
import { revolution } from 'app/geometrie/revolution.js';

const Y = new THREE.Vector3(0, 1, 0);

export { compatibles };

export class Montage {
  constructor(scene) {
    this.groupe = new THREE.Group();
    scene.add(this.groupe);
    this.pieces = [];          // {id, type, taille, longueur, angle, lien: null | {parent, port, portEnfant}}
    this.objets = new Map();   // id → THREE.Group
    this.seq = 0;
    this.soudures = new THREE.Group();     // cordons de soudure aux joints de cuivre
    this.groupe.add(this.soudures);
  }

  piece(id) { return this.pieces.find(p => p.id === id); }

  // Construit (ou reprend) l'objet 3D d'une pièce.
  objet(p) {
    let o = this.objets.get(p.id);
    if (!o) {
      o = CATALOGUE[p.type].construire(p.taille, p.longueur, p.tailleB, p);
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
    if (p.fermeture) s.add(p.fermeture.portEnfant);
    for (const q of this.pieces) {
      if (q.lien?.parent === p.id) s.add(q.lien.port);
      if (q.fermeture?.id === p.id) s.add(q.fermeture.port);
    }
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
      engagement: pt.engagement, garniture: pt.garniture, raccord: pt.raccord,
    };
  }

  // Ajoute une pièce. cible = {id, port} ou null pour la première pièce.
  // Renvoie {id} ou {erreur}.
  ajouter({ type, taille, longueur, tailleB, cintrage }, cible) {
    const p = { id: ++this.seq, type, taille, longueur, tailleB, angle: 0, lien: null };
    if (cintrage) p.cintrage = cintrage;
    if (cible) {
      const parent = this.piece(cible.id);
      const pp = this.ports(parent)[cible.port];
      // Première sortie compatible de la nouvelle pièce.
      const essai = CATALOGUE[type].construire(taille, longueur, tailleB, p);
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
    // Une pièce qui fermait une boucle sur une pièce supprimée perd seulement ce deuxième lien.
    for (const p of this.pieces) if (p.fermeture && aSupprimer.has(p.fermeture.id)) delete p.fermeture;
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
        // L'engagement vient du raccord femelle s'il le précise (raccords de tube), sinon de la famille.
        const fem = cible.type.endsWith('-f') ? cible : pe;
        const eng = fem.engagement ?? engagementJoint(fem.type, fem.taille);
        const pos = cible.position.clone().addScaledVector(cible.sortie, -eng)
          .sub(pe.position.clone().applyQuaternion(q));
        o.matrix.compose(pos, q, new THREE.Vector3(1, 1, 1));
      }
      o.matrixWorldNeedsUpdate = true;
    }
    this.dessinerSoudures();
    this.groupe.updateMatrixWorld(true);
  }

  // Un mince cordon de soudure à l'entrée de chaque douille où un tube est soudé.
  dessinerSoudures() {
    this.soudures.traverse(o => o.geometry?.dispose());
    this.soudures.clear();
    for (const p of this.pieces) {
      if (p.lien) this.garnirJoint(this.portMonde(this.piece(p.lien.parent), p.lien.port), this.portMonde(p, p.lien.portEnfant));
      if (p.fermeture) this.garnirJoint(this.portMonde(this.piece(p.fermeture.id), p.fermeture.port), this.portMonde(p, p.fermeture.portEnfant));
    }
  }

  // Ce qu'on voit au joint : évasement du tube (SAE, inverted) ou cordon de soudure (cuivre).
  garnirJoint(a, b) {
    const face = a.type.endsWith('-f') ? a : b;
    if (face.garniture) {
      const g = new THREE.Mesh(revolution(face.garniture.profil.map(([r, d]) => [r, -d]), 48, 60), MATERIAUX[face.garniture.materiau]);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.sortie);
      g.position.copy(face.position);
      this.soudures.add(g);
      return;
    }
    if (!a.type.startsWith('cu')) return;
    const R = TUBE_CUIVRE[face.taille].D / 2;
    const m = new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.011, 8, 56), MATERIAUX.soudure);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.sortie);
    m.position.copy(face.position).addScaledVector(face.sortie, 0.004);
    this.soudures.add(m);
  }

  // ---------------------------------------------------------------------------
  // Boucles fermées

  // Ce qu'il faut pour relier deux sorties face à face : renvoie {type, taille, longueur} ou {erreur}.
  analyserFermeture(a, b) {
    const pa = this.piece(a.id), pb = this.piece(b.id);
    if (!pa || !pb) return { erreur: 'Sortie introuvable.' };
    if (a.id === b.id) return { erreur: 'Choisis deux sorties de pièces différentes.' };
    const A = this.portMonde(pa, a.port), B = this.portMonde(pb, b.port);
    const [fa, ga] = A.type.split('-'), [fb, gb] = B.type.split('-');
    if (fa !== fb) return { erreur: 'Ces deux sorties ne sont pas de la même famille (NPT, cuivre ou tube) : il faut un adaptateur.' };
    if (A.taille !== B.taille) return { erreur: `Les grosseurs ne correspondent pas (${A.taille} po et ${B.taille} po) : il faut une réduction.` };
    if (ga !== 'f' || gb !== 'f') return { erreur: 'Pour fermer une boucle, choisis deux sorties femelles (raccords) : l\'app y mettra le tuyau ou le tube.' };
    const angle = THREE.MathUtils.radToDeg(A.sortie.angleTo(B.sortie.clone().negate()));
    if (angle > 0.5) return { erreur: `Les deux sorties ne sont pas dans le même axe : il manque ${angle.toFixed(1).replace('.', ',')}° pour qu'elles se fassent face.` };
    const v = B.position.clone().sub(A.position), d = v.dot(A.sortie);
    if (d <= 0) return { erreur: 'Les deux sorties ne se font pas face : elles regardent dans des directions qui s\'éloignent.' };
    const decalage = v.clone().addScaledVector(A.sortie, -d).length();
    if (decalage > 0.01) return { erreur: `Les deux sorties sont décalées de ${decalage.toFixed(3).replace('.', ',')} po : elles ne sont pas sur le même axe.`, decalage };
    const eng = P => P.engagement ?? engagementJoint(P.type, P.taille);
    const type = { npt: 'mamelon', cu: 'cu-tube', tube: 'tb-tube' }[fa];
    const longueur = d + eng(A) + eng(B);
    const min = CATALOGUE[type].longueur.min(A.taille);
    if (longueur < min - 1e-6) return { erreur: `Il faudrait ${longueur.toFixed(3).replace('.', ',')} po de ${type === 'mamelon' ? 'tuyau' : 'tube'}, mais c'est plus court que le minimum (${min} po).`, longueur };
    return { type, taille: A.taille, longueur, distance: d };
  }

  // Ferme une boucle entre deux sorties libres en y mettant le bout de tuyau ou de tube de la bonne longueur.
  fermer(a, b) {
    const r = this.analyserFermeture(a, b);
    if (r.erreur) return r;
    const res = this.ajouter({ type: r.type, taille: r.taille, longueur: r.longueur }, a);
    if (res.erreur) return res;
    const p = this.piece(res.id);
    p.fermeture = { id: b.id, port: b.port, portEnfant: 1 - p.lien.portEnfant };
    this.placer();
    return { id: p.id, ...r };
  }

  // Après une modification : les boucles suivent (la longueur s'ajuste) ou s'ouvrent si les sorties
  // ne sont plus face à face. Renvoie la liste des boucles ouvertes.
  verifierFermetures() {
    const ouvertes = [];
    let refaire = false;
    for (const p of this.pieces) {
      if (!p.fermeture || !p.lien) continue;
      const A = this.portMonde(this.piece(p.lien.parent), p.lien.port);
      const B = this.portMonde(this.piece(p.fermeture.id), p.fermeture.port);
      const angle = A.sortie.angleTo(B.sortie.clone().negate());
      const v = B.position.clone().sub(A.position), d = v.dot(A.sortie);
      const decalage = v.clone().addScaledVector(A.sortie, -d).length();
      if (angle > THREE.MathUtils.degToRad(0.5) || d <= 0 || decalage > 0.01) { delete p.fermeture; ouvertes.push(p.id); continue; }
      const eng = P => P.engagement ?? engagementJoint(P.type, P.taille);
      const L = d + eng(A) + eng(B);
      if (Math.abs(L - p.longueur) > 1e-4) {
        p.longueur = L;
        const o = this.objets.get(p.id);
        this.groupe.remove(o); o.traverse(x => x.geometry?.dispose()); this.objets.delete(p.id);
        refaire = true;
      }
    }
    if (refaire) this.placer();
    return ouvertes;
  }

  // Points repères pour la mesure : centre de chaque raccord, faces et bouts de tuyau.
  pointsReperes() {
    const pts = [];
    for (const p of this.pieces) {
      const o = this.objet(p);
      if (CATALOGUE[p.type].centre) pts.push({ p: new THREE.Vector3().applyMatrix4(o.matrix), genre: 'centre', cle: `${p.id}:c` });
      this.ports(p).forEach((_, i) => {
        const pm = this.portMonde(p, i);
        pts.push({ p: pm.position, genre: pm.type.endsWith('-m') ? 'bout' : 'face', cle: `${p.id}:${i}` });
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
