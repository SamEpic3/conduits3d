// Vérifie les touchers au doigt sur téléphone (portrait).
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const err = []; page.on('pageerror', e => err.push(e.message));
await page.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await page.waitForFunction(() => window.__conduits);
await page.evaluate(() => { const C = window.__conduits, $ = C.$; $('selPiece').value = 'te'; $('selPiece').dispatchEvent(new Event('change')); C.ajouter(); $('btnPanneau').click(); });
await page.waitForTimeout(500);
const ecran = cle => page.evaluate(cle => {
  const C = window.__conduits, M = C.montage;
  const p = cle === 'port2' ? M.portMonde(M.pieces[0], 2).position : M.pointsReperes().find(r => r.cle === cle).p;
  const s = p.clone().project(C.vue.camera), el = C.vue.renderer.domElement, r = el.getBoundingClientRect();
  return [r.left + (s.x + 1) / 2 * el.clientWidth, r.top + (1 - s.y) / 2 * el.clientHeight];
}, cle);
let [x, y] = await ecran('port2');
await page.touchscreen.tap(x, y);
await page.waitForTimeout(300);
const r1 = await page.textContent('#note');
await page.tap('[data-outil="mesure"]');
for (const cle of ['1:0', '1:1']) { [x, y] = await ecran(cle); await page.touchscreen.tap(x, y); await page.waitForTimeout(200); }
const r2 = await page.textContent('#note');
await page.screenshot({ path: '/tmp/toucher.png' });
console.log(JSON.stringify([r1, r2]), err.join('\n') || 'aucune erreur');
await nav.close();
