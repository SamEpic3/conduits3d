// Cintreuse, téléphone : maintenir un doigt sur le tube puis relâcher pose une marque (Marqueur).
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
const err = []; page.on('pageerror', e => err.push(e.message));
await page.goto('file:///home/claude/cintreuse3d/index.html?integre=1');
await page.waitForFunction(() => window.__cint);
await page.tap('#btnInsert'); await page.waitForTimeout(1500);
// d'abord un geste à deux doigts (vue), comme sur le téléphone
const cdp0 = await page.context().newCDPSession(page);
await cdp0.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:60,y:250,id:1}] });
await cdp0.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:60,y:250,id:1},{x:200,y:300,id:2}] });
for (let i=1;i<6;i++) await cdp0.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x:60+5*i,y:250,id:1},{x:200+5*i,y:300,id:2}] });
await cdp0.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[{x:85,y:250,id:1}] });
await cdp0.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
console.log('après deux doigts', await page.evaluate(() => window.__cint.doigts));
await page.tap('[data-tool="marker"]'); await page.waitForTimeout(300);
// un doigt « perdu » (relâché jamais reçu, comme sur iOS après un menu natif)
await page.evaluate(() => document.getElementById('cv').dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,pointerType:'touch',clientX:30,clientY:400,bubbles:true})));
console.log('doigt perdu', await page.evaluate(() => window.__cint.doigts)); await page.waitForTimeout(1700);
const tube = await page.evaluate(() => { for (let y=120; y<420; y+=3) for (let x=20; x<370; x+=3) if (window.__cint.pickAt(x,y)==='tube') return [x,y]; });
const cdp = await page.context().newCDPSession(page);
for (let i=0;i<3;i++) {
  const [x,y] = [tube[0]+i*6, tube[1]+i*4];
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x,y}] });
  for (let k=1;k<=5;k++){ await page.waitForTimeout(120); await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x:x+k,y}] }); }
  await page.waitForTimeout(300);
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await page.waitForTimeout(300);
  console.log(i, await page.evaluate(() => [window.__cint.state.marks.length, window.__cint.doigts, document.getElementById('note').textContent]));
}
console.log('erreurs', err); await nav.close();
