// Simule le mode app installée (display-mode: standalone) en format téléphone.
import { chromium } from 'playwright';
const [,, url, sortie] = process.argv;
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
await page.goto(url);
await page.waitForTimeout(2500);
console.log(await page.evaluate(() => { const b = document.getElementById('bandeIos'); const r = b.getBoundingClientRect(); return JSON.stringify({ bande: [r.top, r.height, getComputedStyle(b).display], stage: document.querySelector('.stage').getBoundingClientRect().top, bas: document.querySelector('.stage').getBoundingClientRect().bottom, hauteur: innerHeight }); }));
await page.screenshot({ path: sortie });
await nav.close();
