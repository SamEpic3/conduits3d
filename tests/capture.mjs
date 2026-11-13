// Capture d'écran de l'app pour vérifier le rendu (Playwright + Chrome).
//   node tests/capture.mjs [sortie.png] [script JS à exécuter avant la capture]
import { chromium } from 'playwright';
const [,, sortie = '/tmp/capture.png', script = ''] = process.argv;
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 1200, height: 800 } });
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
await page.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await page.waitForFunction(() => window.__conduits, null, { timeout: 30000 });
if (script) await page.evaluate(script);
await page.waitForTimeout(800);
await page.screenshot({ path: sortie });
console.log(erreurs.length ? 'ERREURS:\n' + erreurs.join('\n') : 'aucune erreur');
await nav.close();
