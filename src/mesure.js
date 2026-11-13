// Outil de mesure (comme dans la cintreuse 3D) : deux points accrochés aux points repères,
// distance directe ou écart selon X, Y ou Z.
import * as THREE from 'three';

export const NOMS_MODES = { d: 'Directe', x: 'Écart X', y: 'Écart Y', z: 'Écart Z' };
const SYMB = { d: '⤢', x: '↔ X', y: '↕ Y', z: '⊙ Z' };

// 1.375 → « 1,375 po (1 3/8) »
export function fmtPo(v) {
  const e = Math.floor(v + 1e-9), r = Math.round((v - e) * 16);
  let txt;
  if (r === 16) txt = `${e + 1}`;
  else if (!r) txt = `${e}`;
  else { let n = r, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; } txt = e ? `${e} ${n}/${d}` : `${n}/${d}`; }
  return `${v.toFixed(3).replace('.', ',')} po (≈ ${txt}")`;
}

export const longueurMesure = m => m.mode === 'd' ? m.a.distanceTo(m.b) : Math.abs(m.b[m.mode] - m.a[m.mode]);

function geometrie(m) {
  if (m.mode === 'd') return { plein: [m.a, m.b], tirets: null, etiquette: m.a.clone().lerp(m.b, 0.5) };
  const c = m.a.clone(); c[m.mode] = m.b[m.mode];
  return { plein: [m.a, c], tirets: [c, m.b], etiquette: m.a.clone().lerp(c, 0.5) };
}

export class Mesures {
  constructor(vue, calque) {
    this.vue = vue;
    this.calque = calque;          // div HTML pour les étiquettes
    this.liste = [];
    this.apercu = null;
    this.mode = 'd';
    this.reperes = [];             // points repères affichés
    this.groupe = new THREE.Group();
    this.groupe.renderOrder = 10;
    vue.scene.add(this.groupe);
    this.sphere = new THREE.SphereGeometry(1, 14, 10);
    vue.avantRendu.push(() => this.etiquettes());
  }

  ligne(a, b, couleur, tirets) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = tirets
      ? new THREE.LineDashedMaterial({ color: couleur, dashSize: 0.08, gapSize: 0.05, depthTest: false, transparent: true })
      : new THREE.LineBasicMaterial({ color: couleur, depthTest: false, transparent: true });
    const l = new THREE.Line(g, mat);
    if (tirets) l.computeLineDistances();
    l.renderOrder = 10;
    this.groupe.add(l);
  }

  point(p, couleur, r, plein = true) {
    const m = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: couleur, depthTest: false, transparent: true, opacity: plein ? 1 : 0.6 }));
    m.position.copy(p); m.scale.setScalar(r); m.renderOrder = 11;
    this.groupe.add(m);
  }

  // Redessine les mesures et, si l'outil est actif, les points repères.
  dessiner(afficherReperes) {
    this.groupe.traverse(o => { if (o.geometry && o.geometry !== this.sphere) o.geometry.dispose(); o.material?.dispose(); });
    this.groupe.clear();
    for (const m of this.liste.concat(this.apercu ? [this.apercu] : [])) {
      const c = m === this.apercu ? 0xe0560b : 0x1f56c4, g = geometrie(m);
      this.ligne(...g.plein, c, false);
      if (g.tirets) this.ligne(...g.tirets, c, true);
      this.point(m.a, c, 0.03); this.point(m.b, c, 0.03);
    }
    if (afficherReperes) for (const r of this.reperes)
      this.point(r.p, r.genre === 'centre' ? 0x7b3fb5 : 0x56606a, r.genre === 'centre' ? 0.035 : 0.028, false);
    this.vue.demander();
  }

  // Point repère le plus proche du curseur (en pixels), ou null.
  accrocher(x, y, rayonPx = matchMedia('(pointer: coarse)').matches ? 32 : 22) {
    const { camera, renderer } = this.vue;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    let best = null, dmin = rayonPx;
    for (const r of this.reperes) {
      const s = r.p.clone().project(camera);
      const d = Math.hypot((s.x + 1) / 2 * w - x, (1 - s.y) / 2 * h - y);
      if (d < dmin) { dmin = d; best = r; }
    }
    return best;
  }

  // Clic avec l'outil Mesure. Renvoie un message pour l'utilisateur.
  clic(x, y) {
    const r = this.accrocher(x, y);
    if (!this.apercu) {
      if (!r) return { message: 'Clique sur un point repère : centre d\'un raccord (violet), face ou bout de tuyau (gris).', erreur: true };
      this.apercu = { mode: this.mode, a: r.p.clone(), b: r.p.clone(), ca: r.cle, cb: r.cle };
      this.dessiner(true);
      return { message: 'Premier point posé. Clique le deuxième point (Échap pour annuler).' };
    }
    if (!r) return { message: 'Le deuxième point doit être sur un point repère.', erreur: true };
    const m = this.apercu; m.b = r.p.clone(); m.cb = r.cle; this.apercu = null;
    if (m.a.distanceTo(m.b) < 1e-3) { this.dessiner(true); return { message: 'Les deux points sont au même endroit : aucune mesure.', erreur: true }; }
    this.liste.push(m);
    this.dessiner(true);
    return { message: `${NOMS_MODES[m.mode]} : ${fmtPo(longueurMesure(m))}`, ajoutee: true };
  }

  survol(x, y) {
    if (!this.apercu) return;
    const r = this.accrocher(x, y);
    if (r) { this.apercu.b = r.p.clone(); this.apercu.cb = r.cle; this.dessiner(true); }
  }

  // Après une modification du montage : les mesures suivent leurs points repères ;
  // celles dont un point a disparu (pièce supprimée) sont retirées.
  actualiser(reperes, afficherReperes) {
    this.reperes = reperes;
    const par = new Map(reperes.map(r => [r.cle, r.p]));
    this.liste = this.liste.filter(m => par.has(m.ca) && par.has(m.cb));
    for (const m of this.liste) { m.a = par.get(m.ca).clone(); m.b = par.get(m.cb).clone(); }
    if (this.apercu && !par.has(this.apercu.ca)) this.apercu = null;
    this.dessiner(afficherReperes);
  }

  annulerApercu() { this.apercu = null; this.dessiner(true); }
  effacer() { this.liste = []; this.apercu = null; }

  // Étiquettes HTML au milieu de chaque mesure.
  etiquettes() {
    const { camera, renderer } = this.vue;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    let html = '';
    for (const m of this.liste.concat(this.apercu && this.apercu.a.distanceTo(this.apercu.b) > 1e-3 ? [this.apercu] : [])) {
      const s = geometrie(m).etiquette.clone().project(camera);
      if (s.z > 1) continue;
      html += `<div class="etq${m === this.apercu ? ' apercu' : ''}" style="left:${(s.x + 1) / 2 * w}px;top:${(1 - s.y) / 2 * h}px">${SYMB[m.mode]} ${fmtPo(longueurMesure(m))}</div>`;
    }
    this.calque.innerHTML = html;
  }
}
