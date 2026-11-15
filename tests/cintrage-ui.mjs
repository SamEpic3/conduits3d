// Cintrage intégré : allure de Conduits 3D (bureau et téléphone), menu Vue, tiroir.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const err = [];
for (const [nom, vp, tel] of [['bureau', { width: 1200, height: 800 }, false], ['tel', { width: 390, height: 800 }, true], ['couche', { width: 800, height: 390 }, true]]) {
  const page = await nav.newPage({ viewport: vp, hasTouch: tel, isMobile: tel });
  page.setDefaultTimeout(150000); page.on('pageerror', e => err.push(nom + ': ' + e.message));
  await page.addInitScript(() => localStorage.setItem('conduits3d-vignettes-2', '{}'));
  await page.goto('file:///home/claude/conduits3d/index.html');
  await page.waitForFunction(() => window.__conduits);
  await page.click('[data-mode-app="cintrage"]');
  const f = page.frameLocator('#cadreCintreuse');
  await f.locator('#btnInsert').click();
  const cadre = page.frames().find(fr => fr.url().includes('cintreuse.html'));
  await cadre.waitForFunction(() => window.__cint && window.__cint.state.present);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/t/ui-${nom}.png` });
  const vue = tel && nom === 'tel' ? '#btnVueRond' : '#btnVue';
  await f.locator(vue).click(); await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/t/ui-${nom}-vue.png` });
  await f.locator('[data-vue2="top"]').click(); await page.waitForTimeout(900);
  console.log(nom, await cadre.evaluate(() => ({ menu: document.getElementById('menuVue').hidden,
    outils: document.querySelector('.toolbar.tools').getBoundingClientRect().toJSON(),
    panneau: document.getElementById('panel').getBoundingClientRect().toJSON(),
    vues: getComputedStyle(document.querySelector('.toolbar.views')).display })));
  if (nom === 'tel') {
    await f.locator('#tabCmd').click(); await page.waitForTimeout(500);
    const h1 = await cadre.evaluate(() => document.getElementById('panel').offsetHeight);
    await f.locator('#tabRel').click(); await page.waitForTimeout(500);
    const h2 = await cadre.evaluate(() => document.getElementById('panel').offsetHeight);
    console.log('tiroir replie/ouvert', h1, h2);
    await page.screenshot({ path: `/tmp/t/ui-tel-rel.png` });
  }
  await page.close();
}
console.log('erreurs', err); await nav.close();
