// Barre d'outils : menus Fichier et Vue (bureau et téléphone).
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const err = [];
for (const [nom, vp] of [['bureau', { viewport: { width: 1200, height: 800 } }], ['tel', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const page = await nav.newPage(vp); page.setDefaultTimeout(120000); page.on('pageerror', e => err.push(e.message));
  await page.addInitScript(() => localStorage.setItem('conduits3d-vignettes-2', '{}'));
  await page.goto('file:///home/claude/conduits3d/index.html');
  await page.waitForFunction(() => window.__conduits);
  await page.evaluate(() => { const C = window.__conduits, $ = C.$; $('selPiece').value = 'coude90'; $('selPiece').onchange(); C.ajouter(); });
  await page.click('[data-menu="menuFichier"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: `/tmp/t/menu-fichier-${nom}.png` });
  await page.click('[data-menu="menuVue"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: `/tmp/t/menu-vue-${nom}.png` });
  await page.click('#btnOrtho');
  const r = await page.evaluate(() => [window.__conduits.vue.orthogonale, document.getElementById('menuVue').hidden]);
  await page.click('#btnFermer');
  const f = await page.evaluate(() => document.getElementById('btnFermer').classList.contains('on'));
  console.log(nom, r, f);
  await page.close();
}
console.log(err.join('\n') || 'ok');
await nav.close();
