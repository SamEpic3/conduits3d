import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [n, vp] of [['port', { width: 390, height: 844 }], ['pays', { width: 844, height: 390 }], ['bureau', { width: 1200, height: 800 }]]) {
const page = await nav.newPage({ viewport: vp, isMobile: n !== 'bureau', hasTouch: n !== 'bureau', deviceScaleFactor: 2 });
page.setDefaultTimeout(150000);
await page.addInitScript(() => localStorage.setItem('conduits3d-vignettes-2', '{}'));
await page.goto('file:///home/claude/conduits3d/index.html');
await page.waitForFunction(() => window.__conduits);
await page.evaluate(() => { const C = window.__conduits, $ = C.$; $('selPiece').value = 'coude90'; $('selPiece').onchange(); C.ajouter(); C.choisirOutil('mesure'); });
await page.waitForTimeout(300);
await page.screenshot({ path: `/tmp/t/mes-${n}.png` });
console.log(n, await page.evaluate(() => [...document.querySelectorAll('#modes button')].map(b => b.getBoundingClientRect().width > 0)));
await page.close(); }
await nav.close();
