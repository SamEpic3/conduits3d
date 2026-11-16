// Cintreuse, téléphone : les doigts posés sur les lectures (degrés, zéro, rotation) ou sur un message passent à la vue.
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
const err = []; page.on('pageerror', e => err.push(e.message));
await page.goto('file:///home/claude/cintreuse3d/index.html?integre=1');
await page.waitForFunction(() => window.__cint);
await page.tap('#btnInsert'); await page.waitForTimeout(1500);
const z = await page.evaluate(() => { const r=e=>e.getBoundingClientRect(), h=r(document.querySelector('.hud')), n=r(document.getElementById('note'));
  const c=(x,y)=>document.elementFromPoint(x,y).id||document.elementFromPoint(x,y).className;
  return { hud:[h.left+20,h.top+h.height/2], note:[n.left+30,n.top+n.height/2], cibles:[c(h.left+20,h.top+h.height/2), c(n.left+30,n.top+n.height/2)] }; });
console.log(z.cibles);
const cdp = await page.context().newCDPSession(page);
const t0 = await page.evaluate(() => window.__cint.controls.target.toArray());
const d0 = await page.evaluate(() => window.__cint.camera.getWorldDirection(window.__cint.camera.position.clone()).toArray());
const a=z.hud, b=[z.hud[0]+120, z.note[1]];
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a[0],y:a[1],id:1}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a[0],y:a[1],id:1},{x:b[0],y:b[1],id:2}]});
for(let i=1;i<=10;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a[0]+5*i,y:a[1]-5*i,id:1},{x:b[0]+5*i,y:b[1]-5*i,id:2}]}); await page.waitForTimeout(16); }
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await page.waitForTimeout(100);
const r = await page.evaluate(([t0,d0]) => { const t=window.__cint.controls.target.toArray(), d=window.__cint.camera.getWorldDirection(window.__cint.camera.position.clone()).toArray();
  return { pan:+Math.hypot(...t.map((v,i)=>v-t0[i])).toFixed(3), rot:+Math.hypot(...d.map((v,i)=>v-d0[i])).toFixed(3), zoomPage: visualViewport.scale }; }, [t0,d0]);
console.log(r, 'touch-action body', await page.evaluate(()=>getComputedStyle(document.body).touchAction), 'erreurs', err);
await nav.close();
