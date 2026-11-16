// Cintreuse : le levier est aimanté au ½ degré, l'angle affiché est l'angle réel.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 1200, height: 800 } });
const err = []; page.on('pageerror', e => err.push(e.message));
await page.goto('file:///home/claude/cintreuse3d/index.html?integre=1');
await page.waitForFunction(() => window.__cint);
await page.click('#btnInsert'); await page.waitForTimeout(1500);
const lv = await page.evaluate(() => { for (let y=60; y<760; y+=4) for (let x=20; x<860; x+=4) if (window.__cint.pickAt(x,y)==='lever') return [x,y]; });
console.log('levier à', lv);
for (const [dx,dy] of [[37,23],[61,-13],[23,41]]) {
  await page.mouse.move(lv[0], lv[1]); await page.mouse.down();
  for (let i=1;i<=9;i++) await page.mouse.move(lv[0]+dx*i/9, lv[1]+dy*i/9);
  console.log(await page.evaluate(() => [window.__cint.state.lever, window.__cint.state.cur?.a, document.getElementById('roLever').textContent, document.getElementById('roTube').textContent]));
  await page.mouse.up(); await page.waitForTimeout(200);
}
console.log('erreurs', err); await nav.close();
