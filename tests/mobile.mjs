// Capture en format téléphone : node tests/mobile.mjs script.js sortie.png [largeur hauteur]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [,, script, sortie = '/tmp/mobile.png', W = 390, H = 844] = process.argv;
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: +W, height: +H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const err = []; page.on('pageerror', e => err.push(e.message));
await page.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await page.waitForFunction(() => window.__conduits);
if (script) await page.evaluate(readFileSync(script, 'utf8'));
await page.waitForTimeout(900);
await page.screenshot({ path: sortie });
console.log(err.join('\n') || 'aucune erreur');
await nav.close();
