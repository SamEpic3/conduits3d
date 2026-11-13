// Scène 3D : rendu, éclairage, caméra et vue en coupe.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Téléphone en portrait : même règle que le tiroir du bas dans la mise en page CSS.
export const mobile = () => matchMedia('(max-width:760px) and (orientation:portrait)').matches;

export function creerScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const lum = new THREE.DirectionalLight(0xffffff, 1.2);
  lum.position.set(3, 5, 4);
  scene.add(lum, new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.35));

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  camera.position.set(2.2, 1.6, 2.6);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  // Plan de coupe : enlève la moitié avant (z > 0 dans le repère de la vue) pour voir l'intérieur.
  const planCoupe = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  let enAttente = false;
  const avantRendu = [];
  const dessiner = () => {
    enAttente = false;
    if (controls.update()) demander();
    renderer.render(scene, camera);
    for (const f of avantRendu) f();
  };
  const demander = () => { if (!enAttente) { enAttente = true; requestAnimationFrame(dessiner); } };
  controls.addEventListener('change', demander);

  const redimensionner = () => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Le panneau cache une partie de la vue : sur un écran large, il est à droite (on décale l'image vers la gauche) ;
    // sur un téléphone, c'est un tiroir au bas (on remonte l'image).
    const panneau = document.querySelector('.panel');
    let dx = 0, dy = 0;
    if (panneau) {
      if (mobile()) dy = Math.min(panneau.offsetHeight, h * 0.6) / 2;
      else if (w > 700) dx = (panneau.offsetWidth + 12) / 2;
    }
    if (dx || dy) camera.setViewOffset(w, h, dx, dy, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    demander();
  };
  new ResizeObserver(redimensionner).observe(canvas.parentElement);
  const panneau = document.querySelector('.panel');
  if (panneau) new ResizeObserver(() => {
    canvas.parentElement.style.setProperty('--hauteur-panneau', panneau.offsetHeight + 'px');
    redimensionner();
  }).observe(panneau);

  return {
    scene, camera, controls, renderer, demander, avantRendu,
    // Vue normalisée : 'face' (regarde vers -Z), 'dessus' (vers -Y), 'cote' (vers -X), 'iso'.
    vue(nom, objet) {
      const dirs = { face: [0, 0, 1], dessus: [0, 1, 0.0001], cote: [1, 0, 0], iso: [0.8, 0.65, 1] };
      const d = new THREE.Vector3(...dirs[nom]).normalize();
      const dist = camera.position.distanceTo(controls.target) || 5;
      camera.position.copy(controls.target).addScaledVector(d, dist);
      this.cadrer(objet);
    },
    coupe(actif) {
      renderer.clippingPlanes = actif ? [planCoupe] : [];
      demander();
    },
    // Cadre la caméra sur un objet sans changer l'angle de vue.
    cadrer(objet) {
      const boite = new THREE.Box3().setFromObject(objet);
      if (boite.isEmpty()) { demander(); return; }
      const centre = boite.getCenter(new THREE.Vector3());
      const rayon = boite.getSize(new THREE.Vector3()).length() / 2;
      const dir = camera.position.clone().sub(controls.target).normalize();
      // Le champ le plus étroit (vertical, ou horizontal sur un écran en portrait) décide de la distance.
      const fv = THREE.MathUtils.degToRad(camera.fov / 2), fh = Math.atan(Math.tan(fv) * camera.aspect);
      const dist = rayon / Math.sin(Math.min(fv, fh)) * 1.15;
      controls.target.copy(centre);
      camera.position.copy(centre).addScaledVector(dir, dist);
      demander();
    },
  };
}
