// Capture chaque pièce seule avec deux grosseurs : node tests/planche2.mjs taille tailleB types prefixe [coupe]
import { chromium } from 'playwright';
const [,, taille, tailleB, types, prefixe = '/tmp/piece', coupe] = process.argv;
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 1200, height: 800 } });
const err = []; page.on('pageerror', e => err.push(e.message));
await page.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await page.waitForFunction(() => window.__conduits);
for (const t of types.split(',')) {
  const note = await page.evaluate(([t, taille, tailleB, coupe]) => {
    const C = window.__conduits, $ = C.$;
    $('btnToutEffacer').click(); $('selPiece').value = t; $('selPiece').dispatchEvent(new Event('change'));
    $('selTaille').value = taille; $('selTailleB').value = tailleB; $('txtLongueur').value = '3';
    C.ajouter(); C.choisirOutil('mesure');
    if (coupe && !C.vue.renderer.clippingPlanes.length) $('btnCoupe').click();
    C.vue.camera.position.set(1.2, 1.0, 3); C.vue.controls.target.set(0, 0, 0); C.vue.cadrer(C.montage.groupe);
    return $('note').textContent;
  }, [t, taille, tailleB, coupe]);
  if (/Offert|invalide/.test(note)) console.log(t, note);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${prefixe}_${t}.png`, clip: { x: 16, y: 120, width: 840, height: 600 } });
}
console.log(err.join('\n') || 'aucune erreur');
await nav.close();
