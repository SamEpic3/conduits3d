// Assemble l'application en un seul fichier index.html, utilisable hors ligne
// (double-clic sur le fichier) et sur GitHub Pages.
//   node build.mjs
// Produit aussi dev.html, qui charge les fichiers de src/ directement (avec un petit serveur local).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const racine = new URL('.', import.meta.url).pathname;
const lire = p => readFileSync(join(racine, p));

const fichiers = dossier => readdirSync(join(racine, dossier)).flatMap(n => {
  const p = join(dossier, n);
  return statSync(join(racine, p)).isDirectory() ? fichiers(p) : [p];
});

const dataUrl = p => 'data:text/javascript;base64,' + lire(p).toString('base64');

const vendeur = {
  'three': 'vendor/three.module.js',
  'three/addons/controls/OrbitControls.js': 'vendor/addons/OrbitControls.js',
  'three/addons/environments/RoomEnvironment.js': 'vendor/addons/RoomEnvironment.js',
};
const modules = fichiers('src').filter(p => p.endsWith('.js'));

// Numéro de version affiché dans l'app : pris dans sw.js (conduits) et dans cintreuse.html (cintreuse)
const vApp = /VERSION = 'conduits3d-v(\d+)'/.exec(lire('sw.js').toString())[1];
const vCint = (/<meta name="version" content="v(\d+)">/.exec(lire('cintreuse.html').toString()) || [, '?'])[1];
const gabarit = lire('src/index.html').toString().replaceAll('__VERSION__', vApp).replaceAll('__VERSION_CINT__', vCint);

// Version autonome
const imports = {};
for (const [k, p] of Object.entries(vendeur)) imports[k] = dataUrl(p);
for (const p of modules) imports['app/' + relative('src', p)] = dataUrl(p);
writeFileSync(join(racine, 'index.html'),
  gabarit.replace('<!--IMPORTMAP-->', `<script type="importmap">${JSON.stringify({ imports })}</script>`));

// Version de développement
const dev = { ...Object.fromEntries(Object.entries(vendeur).map(([k, p]) => [k, './' + p])), 'app/': './src/' };
writeFileSync(join(racine, 'dev.html'),
  gabarit.replace('<!--IMPORTMAP-->', `<script type="importmap">${JSON.stringify({ imports: dev })}</script>`));

console.log(`index.html : ${modules.length} modules, ${(statSync(join(racine, 'index.html')).size / 1024).toFixed(0)} ko`);
