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
  // Supprime une seule pièce. Ce qui était branché dessus reste en place : ces pièces deviennent
  // un morceau de montage détaché, fixé là où il était (on peut le rebrancher avec « Fermer une boucle »).
  supprimer(id) {
    for (const p of this.pieces) {
      if (p.lien?.parent === id) {
        p.ancrage = this.objet(p).matrix.toArray();
        p.angle = 0;
        delete p.lien;
        p.lien = null;
      }
      // Une pièce qui fermait une boucle sur la pièce supprimée perd seulement ce deuxième lien.
      if (p.fermeture?.id === id) delete p.fermeture;
    }
    this.retirerObjet(id);
    this.pieces = this.pieces.filter(p => p.id !== id);
    this.placer();
  }

  retirerObjet(id) {
    const o = this.objets.get(id);
    if (o) { this.groupe.remove(o); o.traverse(x => x.geometry?.dispose()); this.objets.delete(id); }
  }

  // Nombre de pièces qui deviendraient détachées si on supprimait cette pièce.
  enfants(id) { return this.pieces.filter(p => p.lien?.parent === id).length; }

  vider() {
    for (const p of this.pieces) this.retirerObjet(p.id);
    this.pieces = [];
    this.seq = 0;
    this.placer();
  }

  // Pièces dans un ordre où chaque parent passe avant ses enfants.
  ordre() {
    const enfants = new Map(), out = [];
    for (const p of this.pieces) if (p.lien) {
      if (!enfants.has(p.lien.parent)) enfants.set(p.lien.parent, []);
      enfants.get(p.lien.parent).push(p);
    }
    const pile = this.pieces.filter(p => !p.lien).reverse();
    while (pile.length) {
      const p = pile.pop();
      out.push(p);
      for (const e of (enfants.get(p.id) || []).slice().reverse()) pile.push(e);
    }
    return out;
  }

  // Calcule la position de chaque pièce (les parents d'abord).
  placer({ garnitures = true, ancien = false } = {}) {
    for (const p of this.ordre()) {
      const o = this.objet(p);
      if (!p.lien && p.ancrage) {
        // Morceau détaché : fixé où il était ; la rotation se fait autour d'un axe vertical passant par la pièce.
        const m0 = new THREE.Matrix4().fromArray(p.ancrage), p0 = new THREE.Vector3().setFromMatrixPosition(m0);
        o.matrix.makeTranslation(p0.x, p0.y, p0.z)
          .multiply(new THREE.Matrix4().makeRotationAxis(Y, THREE.MathUtils.degToRad(p.angle)))
          .multiply(new THREE.Matrix4().makeTranslation(-p0.x, -p0.y, -p0.z))
          .multiply(m0);
      } else if (!p.lien) {
        o.matrix.makeRotationAxis(Y, THREE.MathUtils.degToRad(p.angle));
      } else {
        const parent = this.piece(p.lien.parent);
        const cible = this.portMonde(parent, p.lien.port);
        const pe = this.ports(p)[p.lien.portEnfant];
        // La sortie de l'enfant pointe à l'opposé de celle du parent, puis on tourne autour de l'axe du joint.
        // L'orientation se calcule dans le repère du parent : si le parent tourne, l'enfant tourne avec lui.
        let q;
        if (ancien) {
          // Version 1 des fichiers : orientation calculée dans le repère du monde (pour convertir les vieux montages).
          q = new THREE.Quaternion().setFromUnitVectors(pe.sortie, cible.sortie.clone().negate());
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(cible.sortie, THREE.MathUtils.degToRad(p.angle)));
        } else {
          const sLoc = this.ports(parent)[p.lien.port].sortie.clone().normalize();
          const rel = new THREE.Quaternion().setFromUnitVectors(pe.sortie, sLoc.clone().negate());
          rel.premultiply(new THREE.Quaternion().setFromAxisAngle(sLoc, THREE.MathUtils.degToRad(p.angle)));
          q = new THREE.Quaternion().setFromRotationMatrix(this.objet(parent).matrix).multiply(rel);
        }
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
    if (garnitures) this.dessinerSoudures();
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
  // Déplacement et assemblage automatique

  // Toutes les pièces reliées à celle-ci (par un joint ou une boucle) : le morceau de montage.
  composante(id) {
    const vu = new Set([id]), pile = [id];
    while (pile.length) {
      const p = this.piece(pile.pop());
      const voisins = this.pieces.filter(q => q.lien?.parent === p.id || q.fermeture?.id === p.id).map(q => q.id);
      if (p.lien) voisins.push(p.lien.parent);
      if (p.fermeture) voisins.push(p.fermeture.id);
      for (const v of voisins) if (!vu.has(v)) { vu.add(v); pile.push(v); }
    }
    return vu;
  }

  // Sépare une pièce du montage : elle reste où elle est, seule ; ce qui y était branché reste en place.
  detacher(id) {
    const p = this.piece(id);
    if (!p) return;
    for (const q of this.pieces) {
      if (q.lien?.parent === id) { q.ancrage = this.objet(q).matrix.toArray(); q.angle = 0; q.lien = null; }
      if (q.fermeture?.id === id) delete q.fermeture;
    }
    if (p.lien) { p.ancrage = this.objet(p).matrix.toArray(); p.angle = 0; p.lien = null; }
    delete p.fermeture;
    this.placer();
  }

  // Début d'un déplacement : on fige la position de départ de chaque pièce de base du morceau.
  debutDeplacement(id) {
    const ids = this.composante(id);
    const racines = this.pieces.filter(p => ids.has(p.id) && !p.lien);
    for (const r of racines) if (!r.ancrage) { r.ancrage = this.objet(r).matrix.toArray(); r.angle = 0; }
    // Une rotation autour de la verticale déjà faite sur une pièce ancrée est intégrée à son ancrage.
    for (const r of racines) if (r.angle) { r.ancrage = this.objet(r).matrix.toArray(); r.angle = 0; }
    return { ids, depart: new Map(racines.map(r => [r.id, r.ancrage.slice()])) };
  }

  // Déplace le morceau de d (THREE.Vector3) par rapport à sa position de départ.
  deplacer(etat, d) {
    const t = new THREE.Matrix4().makeTranslation(d.x, d.y, d.z);
    for (const [id, m0] of etat.depart)
      this.piece(id).ancrage = t.clone().multiply(new THREE.Matrix4().fromArray(m0)).toArray();
    this.placer();
  }

  // Applique une transformation (THREE.Matrix4, ex. une rotation) au morceau, par rapport à sa position de départ.
  deplacerMatrice(etat, M) {
    for (const [id, m0] of etat.depart)
      this.piece(id).ancrage = M.clone().multiply(new THREE.Matrix4().fromArray(m0)).toArray();
    this.placer();
  }

  // Écart entre deux sorties qui pourraient s'emboîter (sans tenir compte de l'orientation).
  ecartPosition(A, B) {
    const [M, F] = A.type.endsWith('-m') ? [A, B] : [B, A];
    const eng = F.engagement ?? engagementJoint(F.type, F.taille);
    return M.position.distanceTo(F.position.clone().addScaledVector(F.sortie, -eng));
  }

  // Sortie libre du morceau la plus près d'une sortie libre compatible d'ailleurs (à moins de « rayon »).
  candidatAccrochage(ids, rayon = Montage.ACCROCHAGE) {
    const libres = this.sortiesLibres();
    const dedans = libres.filter(s => ids.has(s.id)), dehors = libres.filter(s => !ids.has(s.id));
    let meilleur = null;
    for (const a of dedans) for (const b of dehors) {
      if (compatibles(a, b)) continue;
      const d = this.ecartPosition(a, b);
      if (d <= rayon && (!meilleur || d < meilleur.distance)) meilleur = { m: { id: a.id, port: a.port }, t: { id: b.id, port: b.port }, distance: d };
    }
    return meilleur;
  }

  static ACCROCHAGE = 0.5;

  // Angle (autour de l'axe du joint) qui donne à la pièce l'orientation la plus proche de « cible ».
  angleConservant(p, cible) {
    const angle0 = p.angle;
    p.angle = 0;
    this.placer({ garnitures: false });
    const q0 = new THREE.Quaternion().setFromRotationMatrix(this.objet(p).matrix);
    const qc = new THREE.Quaternion().setFromRotationMatrix(cible);
    const axe = this.portMonde(this.piece(p.lien.parent), p.lien.port).sortie;
    const dq = qc.multiply(q0.invert());
    p.angle = angle0;
    let a = THREE.MathUtils.radToDeg(2 * Math.atan2(dq.x * axe.x + dq.y * axe.y + dq.z * axe.z, dq.w));
    return ((a % 360) + 360) % 360;
  }

  // Branche la sortie m du morceau déplacé (ids) sur la sortie t d'une autre pièce.
  // Le morceau s'aligne sur le joint en gardant le plus possible son orientation.
  accrocher(m, t, ids) {
    const pm = this.piece(m.id);
    const anciennes = new Map([...ids].map(id => [id, this.objet(this.piece(id)).matrix.clone()]));
    // Chemin de la pièce jusqu'à la base de son arbre : on inverse les liens pour qu'elle devienne la base.
    const chemin = [pm];
    for (let p = pm; p.lien;) { p = this.piece(p.lien.parent); chemin.push(p); }
    const base = chemin[chemin.length - 1];
    for (let i = chemin.length - 1; i > 0; i--) {
      const l = chemin[i - 1].lien;
      chemin[i].lien = { parent: chemin[i - 1].id, port: l.portEnfant, portEnfant: l.port };
      delete chemin[i].ancrage;
    }
    pm.lien = { parent: t.id, port: t.port, portEnfant: m.port };
    delete pm.ancrage;
    pm.angle = this.angleConservant(pm, anciennes.get(pm.id));
    this.placer({ garnitures: false });
    // Le reste du morceau suit la pièce comme un bloc rigide.
    const T = this.objet(pm).matrix.clone().multiply(anciennes.get(pm.id).clone().invert());
    for (const q of chemin.slice(1)) {
      q.angle = this.angleConservant(q, T.clone().multiply(anciennes.get(q.id)));
      this.placer({ garnitures: false });
    }
    for (const q of this.pieces)
      if (ids.has(q.id) && !q.lien && q !== base) { q.ancrage = T.clone().multiply(anciennes.get(q.id)).toArray(); q.angle = 0; }
    this.placer();
    // D'autres bouts du morceau qui arrivent maintenant pile dans un raccord : on les joint aussi.
    const joints = [];
    const libres = this.sortiesLibres();
    for (const a of libres) {
      if (!ids.has(a.id) || !a.type.endsWith('-m') || a.type.startsWith('npt')) continue;
      const p = this.piece(a.id);
      if (p.fermeture) continue;
      for (const b of libres) {
        if (ids.has(b.id) || compatibles(a, b)) continue;
        if (!Montage.dansTolerance(this.ecartJoint(a, b))) continue;
        if (this.occupees(this.piece(b.id)).has(b.port)) continue;
        p.fermeture = { id: b.id, port: b.port, portEnfant: a.port, joint: true };
        joints.push(p.id);
        break;
      }
    }
    if (joints.length) this.placer();
    return { id: pm.id, joints };
  }

  // ---------------------------------------------------------------------------
  // Changer la longueur d'un tuyau ou d'un tube droit sans rien débrancher

  static estDroit(p) { return !!CATALOGUE[p.type].longueur; }

  refaireObjet(p) {
    const o = this.objets.get(p.id);
    if (!o) return;
    this.groupe.remove(o); o.traverse(x => x.geometry?.dispose()); this.objets.delete(p.id);
  }

  // Groupes de pièces qui restent ensemble quand on « coupe » les tuyaux donnés (chaque bout du tuyau
  // reste avec ce qui y est branché). Renvoie une fonction groupe(id, port?) → nom du groupe.
  groupes(coupes) {
    const parent = new Map();
    const nom = (id, port) => coupes.has(id) ? `${id}.${port}` : `${id}`;
    const trouver = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const unir = (a, b) => parent.set(trouver(a), trouver(b));
    for (const p of this.pieces) {
      if (coupes.has(p.id)) for (let i = 0; i < this.ports(p).length; i++) parent.set(nom(p.id, i), nom(p.id, i));
      else parent.set(nom(p.id), nom(p.id));
    }
    for (const p of this.pieces) {
      if (p.lien) unir(nom(p.id, p.lien.portEnfant), nom(p.lien.parent, p.lien.port));
      if (p.fermeture) unir(nom(p.id, p.fermeture.portEnfant), nom(p.fermeture.id, p.fermeture.port));
    }
    return (id, port) => trouver(nom(id, port));
  }

  // Change la longueur du tuyau « id ». Le côté qui compte le moins de pièces glisse dans l'axe du tuyau.
  // Dans une boucle, un autre tuyau droit de la boucle, parallèle, absorbe la différence (il raccourcit ou
  // s'allonge d'autant) ; sinon, on refuse. Renvoie {erreur} ou {deplacees, ajuste:{id, avant, apres}|null}.
  changerLongueur(id, L) {
    const P = this.piece(id);
    if (!P || !Montage.estDroit(P)) return { erreur: 'Seuls les tuyaux et les tubes droits ont une longueur à changer.' };
    const min = CATALOGUE[P.type].longueur.min(P.taille);
    if (L < min - 1e-6) return { erreur: `C'est plus court que le minimum (${min} po).` };
    const delta = L - P.longueur;
    if (Math.abs(delta) < 1e-6) return { deplacees: 0, ajuste: null };
    const bout = (p, i) => this.portMonde(p, i).position;
    const axe = p => bout(p, 1).sub(bout(p, 0)).normalize();
    const uP = axe(P);

    // Options : quel côté du tuyau glisse (le côté de son bout 1 ou de son bout 0), et avec quel tuyau compensateur.
    const options = [];
    const essayer = (Q) => {
      const coupes = new Set(Q ? [P.id, Q.id] : [P.id]);
      const g = this.groupes(coupes);
      const g0 = g(P.id, 0), g1 = g(P.id, 1);
      if (g0 === g1) return;
      for (const [gm, gf, u] of [[g1, g0, uP], [g0, g1, uP.clone().negate()]]) {
        let ajuste = null;
        if (Q) {
          const q0 = g(Q.id, 0), q1 = g(Q.id, 1);
          if (!((q0 === gm && q1 === gf) || (q1 === gm && q0 === gf))) return;
          const kM = q1 === gm ? 1 : 0;
          const uQ = bout(Q, kM).sub(bout(Q, 1 - kM)).normalize();
          const nouv = Q.longueur + delta * u.dot(uQ);
          if (nouv < CATALOGUE[Q.type].longueur.min(Q.taille) - 1e-6) { options.push({ trop: { Q, nouv } }); continue; }
          ajuste = { Q, avant: Q.longueur, apres: nouv, finQ: 1 - kM };
        }
        // Toutes les autres pièces doivent être d'un côté ou de l'autre.
        const bouge = [], reste = [];
        for (const p of this.pieces) {
          if (coupes.has(p.id)) continue;
          const x = g(p.id);
          if (x === gm) bouge.push(p.id); else if (x === gf) reste.push(p.id); else return;
        }
        options.push({ bouge: new Set(bouge), u, ajuste, finP: gf === g0 ? 0 : 1, gm, g });
      }
    };
    essayer(null);
    if (!options.some(o => o.bouge)) {
      for (const Q of this.pieces)
        if (Q !== P && Montage.estDroit(Q) && Math.abs(Math.abs(axe(Q).dot(uP)) - 1) < 1e-6) essayer(Q);
    }
    const valides = options.filter(o => o.bouge);
    if (!valides.length) {
      const trop = options.find(o => o.trop);
      const nomQ = trop && (CATALOGUE[trop.trop.Q.type].nom.toLowerCase());
      return { erreur: trop
        ? `Ce ${P.type === 'mamelon' ? 'tuyau' : 'tube'} fait partie d'une boucle fermée : pour garder la boucle, le ${nomQ} parallèle devrait passer à ${trop.trop.nouv.toFixed(3).replace('.', ',')} po, plus court que son minimum.`
        : `Ce ${P.type === 'mamelon' ? 'tuyau' : 'tube'} fait partie d'une boucle fermée, et aucun autre tuyau droit de la boucle n'est parallèle pour compenser : le changer débrancherait la boucle.` };
    }
    // Celle qui bouge le moins de pièces ; à égalité, sans tuyau compensateur, puis le côté du bout 1.
    valides.sort((a, b) => a.bouge.size - b.bouge.size || (!!a.ajuste - !!b.ajuste));
    const o = valides[0];

    const avant = this.etat();
    const anciennes = new Map(this.pieces.map(p => [p.id, this.objet(p).matrix.clone()]));
    const fixe = new Map([[P.id, o.finP]]);          // bout de chaque tuyau coupé qui ne bouge pas
    if (o.ajuste) fixe.set(o.ajuste.Q.id, o.ajuste.finQ);
    const posFixe = new Map([...fixe].map(([pid, k]) => [pid, bout(this.piece(pid), k)]));
    const d = o.u.clone().multiplyScalar(delta);
    P.longueur = L; this.refaireObjet(P);
    if (o.ajuste) { o.ajuste.Q.longueur = o.ajuste.apres; this.refaireObjet(o.ajuste.Q); }
    // Les pièces de base (sans lien) prennent leur nouvelle position ; le reste suit par les joints.
    for (const r of this.pieces.filter(p => !p.lien)) {
      const m = anciennes.get(r.id).clone();
      if (fixe.has(r.id)) {
        const k = fixe.get(r.id), local = this.ports(r)[k].position.clone();
        m.premultiply(new THREE.Matrix4().makeTranslation(posFixe.get(r.id).clone().sub(local.applyMatrix4(m))));
      } else if (o.bouge.has(r.id)) m.premultiply(new THREE.Matrix4().makeTranslation(d.x, d.y, d.z));
      r.ancrage = m.toArray(); r.angle = 0;
    }
    this.placer();
    // Vérification : chaque pièce est là où elle doit être, et aucune boucle ne s'ouvre.
    let ok = true;
    for (const p of this.pieces) {
      if (fixe.has(p.id)) { ok &&= bout(p, fixe.get(p.id)).distanceTo(posFixe.get(p.id)) < 1e-4; continue; }
      const voulu = new THREE.Vector3().setFromMatrixPosition(anciennes.get(p.id));
      if (o.bouge.has(p.id)) voulu.add(d);
      ok &&= new THREE.Vector3().setFromMatrixPosition(this.objet(p).matrix).distanceTo(voulu) < 1e-4;
    }
    if (ok && this.verifierFermetures().length) ok = false;
    if (!ok) { this.restaurer(avant); return { erreur: 'Impossible de changer la longueur sans débrancher une autre pièce.' }; }
    return { deplacees: o.bouge.size, u: o.u, ajuste: o.ajuste && { id: o.ajuste.Q.id, avant: o.ajuste.avant, apres: o.ajuste.apres } };
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
    if (ga !== gb) return { joindre: true };
    if (ga !== 'f') return { erreur: 'Deux bouts mâles ne se raccordent pas : choisis un bout et un raccord, ou deux raccords (l\'app y mettra le tuyau ou le tube).' };
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
    if (r.joindre) return this.joindre(a, b);
    const res = this.ajouter({ type: r.type, taille: r.taille, longueur: r.longueur }, a);
    if (res.erreur) return res;
    const p = this.piece(res.id);
    p.fermeture = { id: b.id, port: b.port, portEnfant: 1 - p.lien.portEnfant };
    this.placer();
    return { id: p.id, ...r };
  }

  // Écart entre un bout mâle et l'endroit où il devrait arriver dans un raccord femelle.
  //   axial > 0 : le bout va trop loin (trop long) ; axial < 0 : il n'arrive pas (trop court)
  ecartJoint(M, F) {
    const eng = F.engagement ?? engagementJoint(F.type, F.taille);
    const attendu = F.position.clone().addScaledVector(F.sortie, -eng);
    const e = M.position.clone().sub(attendu), entree = F.sortie.clone().negate();
    const axial = e.dot(entree);
    return {
      axial, lateral: e.addScaledVector(entree, -axial).length(),
      angle: THREE.MathUtils.radToDeg(M.sortie.angleTo(entree)),
    };
  }

  static TOLERANCE = { axial: 1 / 16, lateral: 1 / 16, angle: 2 };
  static dansTolerance(e) {
    const t = Montage.TOLERANCE;
    return Math.abs(e.axial) <= t.axial && e.lateral <= t.lateral && e.angle <= t.angle;
  }

  // Joint un bout mâle déjà posé (ex. : bout d'un tube cintré) à un raccord libre.
  // On cherche d'abord la rotation de la pièce autour de son joint qui aligne le mieux le bout.
  joindre(a, b) {
    const pa = this.piece(a.id), pb = this.piece(b.id);
    const A = this.portMonde(pa, a.port);
    const [m, f, pm] = A.type.endsWith('-m') ? [a, b, pa] : [b, a, pb];
    const famille = A.type.split('-')[0];
    if (famille === 'npt')
      return { erreur: 'En fileté, on ne peut pas visser les deux bouts d\'un tuyau en même temps : pour fermer une boucle, il faut une union.' };
    if (pm.fermeture) return { erreur: 'Cette pièce ferme déjà une boucle.' };
    const ecart = () => this.ecartJoint(this.portMonde(pm, m.port), this.portMonde(this.piece(f.id), f.port));
    const score = e => Math.abs(e.axial) + e.lateral + e.angle / 30;
    // La pièce ne peut pas tourner sur elle-même si le raccord visé est en aval d'elle.
    const angle0 = pm.angle;
    let meilleur = { angle: angle0, e: ecart() };
    if (!this.estDescendant(f.id, pm.id)) {
      const essayer = ang => { pm.angle = ((ang % 360) + 360) % 360; this.placer({ garnitures: false }); const e = ecart(); if (score(e) < score(meilleur.e)) meilleur = { angle: pm.angle, e }; };
      for (let ang = 0; ang < 360; ang += 1) essayer(ang);
      const centre = meilleur.angle;
      for (let d = -1; d <= 1; d += 0.05) essayer(centre + d);
    }
    pm.angle = meilleur.angle;
    this.placer();
    const e = meilleur.e;
    if (!Montage.dansTolerance(e)) {
      pm.angle = angle0;
      this.placer();
      return { erreur: Montage.expliquer(e), ecart: e };
    }
    pm.fermeture = { id: f.id, port: f.port, portEnfant: m.port, joint: true };
    this.placer();
    let rot = ((meilleur.angle - angle0) % 360 + 540) % 360 - 180;
    return { id: pm.id, joint: true, ecart: e, rotation: Math.abs(rot) > 0.01 ? rot : 0 };
  }

  estDescendant(id, ancetre) {
    let p = this.piece(id);
    while (p?.lien) { if (p.lien.parent === ancetre) return true; p = this.piece(p.lien.parent); }
    return false;
  }

  // Explique pourquoi le bout n'arrive pas dans le raccord (meilleure orientation trouvée).
  static expliquer(e) {
    const po = v => `${v.toFixed(3).replace('.', ',')} po`;
    const t = Montage.TOLERANCE, raisons = [];
    if (e.axial > t.axial) raisons.push(`trop long de ${po(e.axial)}`);
    if (e.axial < -t.axial) raisons.push(`trop court de ${po(-e.axial)}`);
    if (e.lateral > t.lateral) raisons.push(`décalé de ${po(e.lateral)} sur le côté`);
    if (e.angle > t.angle) raisons.push(`désaligné de ${e.angle.toFixed(1).replace('.', ',')}°`);
    return `Le bout n'arrive pas dans le raccord, même en tournant la pièce : ${raisons.join(', ')}. (Tolérance : 1/16 po et 2°.)`;
  }

  // Après une modification : les boucles suivent (la longueur s'ajuste) ou s'ouvrent si les sorties
  // ne sont plus face à face. Renvoie la liste des boucles ouvertes.
  verifierFermetures() {
    const ouvertes = [];
    let refaire = false;
    for (const p of this.pieces) {
      if (!p.fermeture) continue;
      if (p.fermeture.joint) {
        const e = this.ecartJoint(this.portMonde(p, p.fermeture.portEnfant), this.portMonde(this.piece(p.fermeture.id), p.fermeture.port));
        if (!Montage.dansTolerance(e)) { delete p.fermeture; ouvertes.push(p.id); }
        continue;
      }
      if (!p.lien) continue;
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

  // Montage enregistré avec la version 1 (orientation dans le repère du monde) : on garde exactement la même
  // forme en recalculant l'angle de chaque pièce pour le repère du parent.
  convertirVersion1() {
    this.placer({ garnitures: false, ancien: true });
    const voulu = new Map(this.pieces.map(p => [p.id, this.objet(p).matrix.clone()]));
    for (const p of this.ordre()) if (p.lien) {
      p.angle = this.angleConservant(p, voulu.get(p.id));
      this.placer({ garnitures: false });
    }
    this.placer();
  }

  // Pour annuler : état sérialisable.
  etat() { return JSON.stringify({ pieces: this.pieces, seq: this.seq }); }
  restaurer(json) {
    const e = JSON.parse(json);
    for (const p of this.pieces) this.retirerObjet(p.id);
    this.pieces = e.pieces; this.seq = e.seq;
    this.placer();
  }
}
