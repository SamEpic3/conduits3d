// Repère X Y Z en bas à gauche (bureau et téléphone), flèches dans le même repère.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [n, vp] of [['bureau', { width: 1200, height: 800 }], ['port', { width: 390, height: 844 }]]) {
  const page = await nav.newPage({ viewport: vp, isMobile: n !== 'bureau', hasTouch: n !== 'bureau', deviceScaleFactor: 2 });
  page.setDefaultTimeout(150000);
  const err = []; page.on('pageerror', e => err.push(e.message));
  await page.addInitScript(() => localStorage.setItem('conduits3d-vignettes-2', '{}'));
  await page.goto('file:///home/claude/conduits3d/index.html');
  await page.waitForFunction(() => window.__conduits);
  await page.evaluate(() => { const C = window.__conduits, $ = C.$; $('selPiece').value = 'te'; $('selPiece').onchange(); C.ajouter(); C.selectionner(1); C.choisirManip('translation'); C.vue.cadrer(C.montage.groupe); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/tmp/t/repere-${n}.png` });
  console.log(n, await page.evaluate(() => document.querySelectorAll('#gizmo line').length), err.join('\n') || 'ok');
  await page.close();
}
await nav.close();
