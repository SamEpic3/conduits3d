// Scène 3D : rendu, éclairage, caméra et vue en coupe.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
  const dessiner = () => {
    enAttente = false;
    if (controls.update()) demander();
    renderer.render(scene, camera);
  };
  const demander = () => { if (!enAttente) { enAttente = true; requestAnimationFrame(dessiner); } };
  controls.addEventListener('change', demander);

  const redimensionner = () => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Sur un écran large, on décale l'image vers la gauche pour qu'elle ne soit pas sous le panneau.
    const panneau = document.querySelector('.panel');
    const decal = panneau && w > 700 ? (panneau.offsetWidth + 12) / 2 : 0;
    if (decal) camera.setViewOffset(w, h, decal, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    demander();
  };
  new ResizeObserver(redimensionner).observe(canvas.parentElement);

  return {
    scene, camera, controls, renderer, demander,
    coupe(actif) {
      renderer.clippingPlanes = actif ? [planCoupe] : [];
      demander();
    },
    // Cadre la caméra sur un objet sans changer l'angle de vue.
    cadrer(objet) {
      const boite = new THREE.Box3().setFromObject(objet);
      const centre = boite.getCenter(new THREE.Vector3());
      const rayon = boite.getSize(new THREE.Vector3()).length() / 2;
      const dir = camera.position.clone().sub(controls.target).normalize();
      const dist = rayon / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15;
      controls.target.copy(centre);
      camera.position.copy(centre).addScaledVector(dir, dist);
      demander();
    },
  };
}
