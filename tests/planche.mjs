// Capture chaque pièce seule (vue 3D), pour vérifier les modèles.
//   node tests/planche.mjs taille type1,type2,... sortie_prefixe [coupe]
import { chromium } from 'playwright';
const [,, taille = '1/2', types, prefixe = '/tmp/piece', coupe] = process.argv;
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 1200, height: 800 } });
const err = []; page.on('pageerror', e => err.push(e.message));
await page.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await page.waitForFunction(() => window.__conduits);
for (const t of types.split(',')) {
  await page.evaluate(([t, taille, coupe]) => {
    const C = window.__conduits, $ = C.$;
    $('btnToutEffacer').click(); $('selPiece').value = t; $('selTaille').value = taille; $('txtLongueur').value = '2';
    C.ajouter(); C.choisirOutil('mesure');
    if (coupe && !C.vue.renderer.clippingPlanes.length) $('btnCoupe').click();
    C.vue.camera.position.set(2, 1.4, 3); C.vue.controls.target.set(0, 0, 0); C.vue.cadrer(C.montage.groupe);
  }, [t, taille, coupe]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${prefixe}_${t}.png`, clip: { x: 16, y: 16, width: 840, height: 768 } });
}
console.log(err.join('\n') || 'aucune erreur');
await nav.close();
