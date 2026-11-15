// Téléphone : catalogue en haut + tirer vers le bas = le tiroir descend ; anneau du toucher long.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page.setDefaultTimeout(150000);
const err = []; page.on('pageerror', e => err.push(e.message));
await page.addInitScript(() => localStorage.setItem('conduits3d-vignettes-2', '{}'));
await page.goto('file:///home/claude/conduits3d/index.html');
await page.waitForFunction(() => window.__conduits);
const h = () => page.evaluate(() => document.querySelector('.panel').offsetHeight);
const r = { depart: await h() };
const tirer = (dy) => page.evaluate(dy => {
  const c = document.querySelector('.contenu'), b = c.getBoundingClientRect(), x = b.left + 100, y = b.top + 150;
  const t = yy => new Touch({ identifier: 1, target: c, clientX: x, clientY: yy });
  c.dispatchEvent(new TouchEvent('touchstart', { touches: [t(y)], changedTouches: [t(y)], bubbles: true }));
  for (let k = 1; k <= 8; k++) c.dispatchEvent(new TouchEvent('touchmove', { touches: [t(y + dy * k / 8)], changedTouches: [t(y + dy * k / 8)], bubbles: true, cancelable: true }));
  c.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(y + dy)], bubbles: true }));
}, dy);
await tirer(40); await page.waitForTimeout(400); r.petit = await h();
await tirer(160); await page.waitForTimeout(400); r.ferme = await h();
// toucher long sur la pièce : anneau
await page.evaluate(() => { const C = window.__conduits, $ = C.$; $('selPiece').value = 'te'; $('selPiece').onchange(); C.ajouter(); C.vue.cadrer(C.montage.groupe); });
await page.waitForTimeout(300);
const pos = await page.evaluate(() => { const C = window.__conduits; const v = new C.THREE.Vector3().setFromMatrixPosition(C.montage.objets.get(1).matrix).project(C.vue.camera); const r = C.vue.renderer.domElement.getBoundingClientRect(); return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height]; });
await page.evaluate(([x, y]) => document.getElementById('cv').dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerType: 'touch', pointerId: 9, bubbles: true, isPrimary: true })), pos);
await page.waitForTimeout(350);
r.anneau = await page.evaluate(() => document.getElementById('anneauToucher').className);
await page.screenshot({ path: '/tmp/t/anneau.png' });
await page.waitForFunction(() => !document.getElementById('menuPiece').hidden);
r.menu = true;
console.log(JSON.stringify(r));
await nav.close();
