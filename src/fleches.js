// Flèches de déplacement (comme dans Blender) : rouge = X, vert = profondeur, bleu = vertical.
// Elles sont dessinées par-dessus le montage et gardent la même taille à l'écran.
import * as THREE from 'three';

export const AXES = [
  { nom: 'X', dir: new THREE.Vector3(1, 0, 0), couleur: 0xe0303a },
  { nom: 'Y', dir: new THREE.Vector3(0, 0, -1), couleur: 0x4cae2e },  // profondeur (vert)
  { nom: 'Z', dir: new THREE.Vector3(0, 1, 0), couleur: 0x2f6fe0 },   // vertical (bleu, comme Blender)
];

export class Fleches {
  constructor(vue) {
    this.vue = vue;
    this.groupe = new THREE.Group();
    this.groupe.visible = false;
    this.groupe.renderOrder = 999;
    vue.scene.add(this.groupe);
    this.cibles = [];
    this.materiaux = [];
    AXES.forEach((a, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: a.couleur, depthTest: false, depthWrite: false, transparent: true });
      this.materiaux.push(mat);
      const g = new THREE.Group();
      const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.8, 12), mat);
      tige.position.y = 0.4 + 0.12;
      const pointe = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.2, 20), mat);
      pointe.position.y = 1.02;
      // Zone de prise plus large que la flèche (doigt sur un téléphone).
      const prise = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.05, 8), new THREE.MeshBasicMaterial({ visible: false }));
      prise.position.y = 0.6;
      prise.userData.axe = i;
      for (const m of [tige, pointe]) m.renderOrder = 999;
      g.add(tige, pointe, prise);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.dir);
      this.groupe.add(g);
      this.cibles.push(prise);
    });
    const centre = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true }));
    centre.renderOrder = 999;
    this.groupe.add(centre);
    vue.controls.addEventListener('change', () => this.echelle());
  }

  montrer(position) {
    if (!position) { this.groupe.visible = false; return; }
    this.groupe.visible = true;
    this.groupe.position.copy(position);
    this.echelle();
  }

  // Taille constante à l'écran : environ 1/8 de la hauteur de la vue.
  echelle() {
    const cam = this.vue.camera;
    const h = cam.isOrthographicCamera ? cam.top / cam.zoom
      : cam.position.distanceTo(this.groupe.position) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    this.groupe.scale.setScalar(h * 0.32);
    this.groupe.updateMatrixWorld(true);
  }

  // Indice de l'axe visé par le rayon, ou -1.
  viser(rayon) {
    if (!this.groupe.visible) return -1;
    this.groupe.updateMatrixWorld(true);
    const i = rayon.intersectObjects(this.cibles, false)[0];
    return i ? i.object.userData.axe : -1;
  }

  actif(i) {
    this.materiaux.forEach((m, k) => { m.opacity = i < 0 || k === i ? 1 : 0.25; });
  }

  // Position le long de l'axe (passant par « origine ») du point le plus proche du rayon.
  static surAxe(rayon, origine, dir) {
    const D = rayon.ray.direction, w0 = origine.clone().sub(rayon.ray.origin);
    const b = dir.dot(D), d = dir.dot(w0), e = D.dot(w0);
    const den = 1 - b * b;
    if (den < 1e-4) return null;   // on regarde dans l'axe de la flèche
    return (b * e - d) / den;
  }
}
