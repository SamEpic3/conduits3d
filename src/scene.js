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
  // Vue orthogonale : même direction de regard, sans perspective (les lignes parallèles restent parallèles).
  // La hauteur visible est H / zoom ; OrbitControls change le zoom au lieu d'avancer la caméra.
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  ortho.userData.H = 2;
  const RECUL = 300;                 // la caméra orthogonale reste loin derrière : rien n'est coupé
  let cam = camera;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  // Plan de coupe : enlève la moitié avant (z > 0 dans le repère de la vue) pour voir l'intérieur.
  const planCoupe = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  let enAttente = false;
  const avantRendu = [];
  const dessiner = () => {
    enAttente = false;
    if (controls.update()) demander();
    renderer.render(scene, cam);
    for (const f of avantRendu) f();
  };
  const demander = () => { if (!enAttente) { enAttente = true; requestAnimationFrame(dessiner); } };
  controls.addEventListener('change', demander);

  const redimensionner = () => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const H = ortho.userData.H;
    Object.assign(ortho, { left: -H * w / h, right: H * w / h, top: H, bottom: -H });
    // Le panneau cache une partie de la vue : sur un écran large, il est à droite (on décale l'image vers la gauche) ;
    // sur un téléphone, c'est un tiroir au bas (on remonte l'image).
    const panneau = document.querySelector('.panel');
    let dx = 0, dy = 0;
    if (panneau) {
      if (mobile()) dy = Math.min(panneau.offsetHeight, h * 0.6) / 2;
      else if (w > 700) dx = (panneau.offsetWidth + 12) / 2;
    }
    for (const c of [camera, ortho]) {
      if (dx || dy) c.setViewOffset(w, h, dx, dy, w, h); else c.clearViewOffset();
      c.updateProjectionMatrix();
    }
    demander();
  };
  new ResizeObserver(redimensionner).observe(canvas.parentElement);
  const panneau = document.querySelector('.panel');
  if (panneau) new ResizeObserver(() => {
    canvas.parentElement.style.setProperty('--hauteur-panneau', panneau.offsetHeight + 'px');
    redimensionner();
  }).observe(panneau);

  const demiHauteur = () => cam === ortho ? ortho.userData.H / ortho.zoom
    : cam.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  return {
    scene, controls, renderer, demander, avantRendu, redimensionner,
    get camera() { return cam; },
    get orthogonale() { return cam === ortho; },
    demiHauteur,
    // Pour l'export d'image : état de la caméra, à remettre ensuite.
    etatCamera() {
      return { ortho: cam === ortho, p: camera.position.clone(), po: ortho.position.clone(), zoom: ortho.zoom, H: ortho.userData.H,
        cible: controls.target.clone(), coupe: renderer.clippingPlanes.length > 0 };
    },
    restaurerCamera(e) {
      cam = e.ortho ? ortho : camera;
      controls.object = cam;
      camera.position.copy(e.p); ortho.position.copy(e.po); ortho.zoom = e.zoom; ortho.userData.H = e.H;
      controls.target.copy(e.cible);
      renderer.clippingPlanes = e.coupe ? [planCoupe] : [];
      cam.lookAt(controls.target);
      redimensionner();
      controls.update();
      controls.dispatchEvent({ type: 'change' });
    },
    // Rendu hors écran à W × H pixels (sans le décalage du panneau). « preparer » peut cadrer la vue ;
    // « dessiner2d(ctx, camera) » ajoute ce qui est en HTML à l'écran (étiquettes). Renvoie un canevas.
    // Recadre serré : l'objet remplit ~88 % de l'image (d'après les boîtes de chaque maillage, vues à l'écran).
    ajuster(objet, marge = 0.88) {
      const coins = [];
      objet.updateMatrixWorld(true);
      objet.traverse(m => {
        if (!m.isMesh || !m.geometry) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox;
        for (let i = 0; i < 8; i++)
          coins.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld));
      });
      if (!coins.length) return;
      for (let essai = 0; essai < 3; essai++) {
        cam.updateMatrixWorld(); cam.updateProjectionMatrix();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const c of coins) { const p = c.clone().project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, f = Math.max((x1 - x0) / 2, (y1 - y0) / 2) / marge;
        const droite = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), haut = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        const hh = demiHauteur(), hw = hh * (cam === ortho ? (ortho.right / ortho.top) : camera.aspect);
        const d = droite.multiplyScalar(cx * hw).add(haut.multiplyScalar(cy * hh));
        controls.target.add(d); cam.position.add(d);
        if (cam === ortho) ortho.zoom /= f;
        else cam.position.sub(controls.target).multiplyScalar(f).add(controls.target);
      }
      cam.updateProjectionMatrix();
    },
    image(W, H, { fond = '#ffffff', preparer, dessiner2d, pardessus } = {}) {
      const ratio = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      const Ho = ortho.userData.H;
      Object.assign(ortho, { left: -Ho * W / H, right: Ho * W / H, top: Ho, bottom: -Ho });
      for (const c of [camera, ortho]) { c.clearViewOffset(); c.updateProjectionMatrix(); }
      preparer?.();
      cam.lookAt(controls.target);
      cam.updateMatrixWorld();
      if (pardessus) {
        // Ce qui doit rester entier même en coupe (les mesures) : rendu à part, sans plan de coupe.
        const plans = renderer.clippingPlanes, vis = pardessus.visible;
        pardessus.visible = false;
        renderer.render(scene, cam);
        pardessus.visible = vis;
        renderer.clippingPlanes = []; renderer.autoClear = false;
        if (vis) renderer.render(pardessus, cam);
        renderer.clippingPlanes = plans; renderer.autoClear = true;
      } else renderer.render(scene, cam);
      const sortie = Object.assign(document.createElement('canvas'), { width: W, height: H });
      const ctx = sortie.getContext('2d');
      if (fond) { ctx.fillStyle = fond; ctx.fillRect(0, 0, W, H); }
      ctx.drawImage(renderer.domElement, 0, 0);
      dessiner2d?.(ctx, cam);
      renderer.setPixelRatio(ratio);
      redimensionner();
      return sortie;
    },
    // Petite image d'une autre scène (vignettes du catalogue), avec le même éclairage ; la vue principale est
    // redessinée tout de suite après, sans clignement.
    vignette(objet, W = 160) {
      const sc = new THREE.Scene();
      sc.environment = scene.environment;
      const l = lum.clone(); sc.add(l, new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.35));
      sc.add(objet);
      const boite = new THREE.Box3().setFromObject(objet), sphere = boite.getBoundingSphere(new THREE.Sphere());
      const c = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
      const dir = new THREE.Vector3(1, 0.75, 1.15).normalize();
      c.position.copy(sphere.center).addScaledVector(dir, sphere.radius / Math.sin(THREE.MathUtils.degToRad(14)) * 1.02);
      c.lookAt(sphere.center);
      const ratio = renderer.getPixelRatio(), plans = renderer.clippingPlanes;
      renderer.setPixelRatio(1); renderer.setSize(W, W, false); renderer.clippingPlanes = [];
      renderer.render(sc, c);
      const toile = Object.assign(document.createElement('canvas'), { width: W, height: W });
      toile.getContext('2d').drawImage(renderer.domElement, 0, 0);
      sc.remove(objet);
      renderer.clippingPlanes = plans; renderer.setPixelRatio(ratio);
      redimensionner();
      renderer.render(scene, cam);
      return toile;
    },
    // Bascule entre perspective et orthogonale en gardant à peu près la même grandeur à l'écran.
    projection(orthogonale) {
      if (orthogonale === (cam === ortho)) return;
      const dir = cam.position.clone().sub(controls.target).normalize();
      const H = demiHauteur();
      if (orthogonale) {
        ortho.userData.H = H; ortho.zoom = 1;
        ortho.position.copy(controls.target).addScaledVector(dir, RECUL);
        ortho.up.copy(camera.up);
        cam = ortho;
      } else {
        camera.position.copy(controls.target).addScaledVector(dir, H / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        cam = camera;
      }
      cam.lookAt(controls.target);
      controls.object = cam;
      redimensionner();
      controls.update();
      controls.dispatchEvent({ type: 'change' });
    },
    // Vue normalisée : 'face' (regarde vers -Z), 'dessus' (vers -Y), 'cote' (vers -X), 'iso'.
    vue(nom, objet) {
      const dirs = { face: [0, 0, 1], dessus: [0, 1, 0.0001], cote: [1, 0, 0], iso: [0.8, 0.65, 1] };
      const d = new THREE.Vector3(...dirs[nom]).normalize();
      const dist = cam.position.distanceTo(controls.target) || 5;
      cam.position.copy(controls.target).addScaledVector(d, dist);
      cam.lookAt(controls.target);
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
      const dir = cam.position.clone().sub(controls.target).normalize();
      if (cam === ortho) {
        // Hauteur visible = H / zoom ; on prend le côté le plus étroit.
        ortho.zoom = ortho.userData.H * Math.min(1, camera.aspect) / (rayon * 1.1);
        ortho.updateProjectionMatrix();
        controls.target.copy(centre);
        ortho.position.copy(centre).addScaledVector(dir, RECUL);
        controls.update();
        controls.dispatchEvent({ type: 'change' });
        demander();
        return;
      }
      // Le champ le plus étroit (vertical, ou horizontal sur un écran en portrait) décide de la distance.
      const fv = THREE.MathUtils.degToRad(camera.fov / 2), fh = Math.atan(Math.tan(fv) * camera.aspect);
      const dist = rayon / Math.sin(Math.min(fv, fh)) * 1.15;
      controls.target.copy(centre);
      camera.position.copy(centre).addScaledVector(dir, dist);
      demander();
    },
  };
}
