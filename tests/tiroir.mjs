import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page.setDefaultTimeout(150000);
await page.addInitScript(() => localStorage.setItem('conduits3d-vignettes-2', '{}'));
await page.goto('file:///home/claude/conduits3d/index.html');
await page.waitForFunction(() => window.__conduits);
await page.tap('#cv', { position: { x: 60, y: 200 } });
await page.waitForTimeout(600);
await page.evaluate(() => window.__conduits.$('btnFermer').click());
await page.waitForTimeout(300);
const r = await page.evaluate(() => [document.getElementById('note').getBoundingClientRect().bottom, document.querySelector('.panel').getBoundingClientRect().top]);
// tirer par les onglets
const b = await page.locator('.onglets').boundingBox();
await page.evaluate(([x, y]) => { const o = document.querySelector('.onglets'); const ev = (t, yy) => o.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: yy, pointerId: 5, bubbles: true, pointerType: 'touch' }));
  ev('pointerdown', y); ev('pointermove', y - 20); ev('pointermove', y - 250); ev('pointerup', y - 250); }, [b.x + 60, b.y + b.height / 2]);
await page.waitForTimeout(500);
const r2 = await page.evaluate(() => [document.querySelector('.panel').offsetHeight, document.getElementById('note').getBoundingClientRect().bottom, document.querySelector('.panel').getBoundingClientRect().top]);
// toucher l'onglet actif : se range
await page.tap('[data-onglet="pieces"]'); await page.waitForTimeout(400);
const r3 = await page.evaluate(() => document.querySelector('.panel').offsetHeight);
await page.tap('[data-onglet="materiel"]'); await page.waitForTimeout(400);
const r4 = await page.evaluate(() => document.querySelector('.panel').offsetHeight);
await page.screenshot({ path: '/tmp/t/n2.png' });
console.log(JSON.stringify({ r, r2, r3, r4 }));
await nav.close();
