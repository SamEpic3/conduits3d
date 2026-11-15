// Cintreuse, téléphone : deux doigts dont un posé sur le tube → la vue se déplace (pas de rotation qui oscille).
import { chromium } from 'playwright';
const nav = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
const err = []; page.on('pageerror', e => err.push(e.message));
await page.goto('file:///home/claude/cintreuse3d/index.html?integre=1');
await page.waitForFunction(() => window.__cint);
await page.click('#btnInsert'); await page.waitForTimeout(1500);
// repli du tiroir pour avoir de la place, puis trouver un point sur le tube et un point vide
const pts = await page.evaluate(() => { let tube=null, vide=null;
  for (let y=80; y<420 && !tube; y+=3) for (let x=20; x<370; x+=3) { const k=window.__cint.pickAt(x,y); if(k==='tube'){tube=[x,y];break;} }
  for (let y=200; y<420 && !vide; y+=10) for (let x=20; x<370; x+=10) { if(!window.__cint.pickAt(x,y)){ vide=[x,y]; break; } }
  return {tube, vide}; });
console.log(pts);
const cdp = await page.context().newCDPSession(page);
const etat = () => page.evaluate(() => { const c=window.__cint.camera, t=window.__cint.controls.target; return { pos:c.position.toArray().map(v=>+v.toFixed(3)), dir:c.getWorldDirection(new c.position.constructor()).toArray().map(v=>+v.toFixed(3)), t:t.toArray().map(v=>+v.toFixed(3)) }; });
async function essai(premier, second) {
  const a = await etat();
  const tp = (p,id) => ({ x:p[0], y:p[1], id });
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[tp(premier,1)] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[tp(premier,1), tp(second,2)] });
  const dirs=[];
  for (let i=1;i<=12;i++) { await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[tp([premier[0]+4*i,premier[1]+3*i],1), tp([second[0]+4*i,second[1]+3*i],2)] }); await page.waitForTimeout(16); dirs.push((await etat()).dir); }
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await page.waitForTimeout(100);
  const b = await etat();
  const rot = Math.max(...dirs.map(d=>Math.hypot(d[0]-a.dir[0],d[1]-a.dir[1],d[2]-a.dir[2])));
  const pan = Math.hypot(b.t[0]-a.t[0],b.t[1]-a.t[1],b.t[2]-a.t[2]);
  return { rotationMax:+rot.toFixed(3), deplacementCible:+pan.toFixed(3), drag: await page.evaluate(()=>!!window.__cint.drag), p: await page.evaluate(()=>window.__cint.state.p) };
}
console.log('vide puis tube', await essai(pts.vide, pts.tube));
console.log('tube puis vide', await essai(pts.tube, pts.vide));
await page.click('[data-tool="marker"]'); console.log('avant', await page.evaluate(()=>window.__cint.doigts)); await page.evaluate(()=>{ window.__log=[]; const cv=document.getElementById('cv'); for(const t of ['pointerdown','pointermove']) cv.addEventListener(t,e=>window.__log.push(t[7]+e.pointerId),false); });
console.log('marqueur', await essai(pts.tube, pts.vide), await page.evaluate(()=>[window.__cint.state.marks.length, window.__log.slice(0,12).join(' '), window.__cint.doigts]));
console.log('erreurs', err); await nav.close();
