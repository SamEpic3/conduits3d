// Étape 1 : visionneuse d'une pièce, pour valider les modèles avant de construire les montages.
import * as THREE from 'three';
import { creerScene } from 'app/scene.js';
import { RACCORDS_NPT, FILETS_NPT, FONTE_150 } from 'app/donnees/npt.js';
import { CONSTRUCTEURS_NPT } from 'app/pieces/npt.js';

const $ = id => document.getElementById(id);
const vue = creerScene($('cv'));
let piece = null;

const fmt = v => `${v.toFixed(3).replace('.', ',')} po`;
// Fraction lisible : 1.125 → « 1 1/8 »
const frac = v => {
  const e = Math.floor(v), r = Math.round((v - e) * 16);
  if (!r) return `${e}`;
  let n = r, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; }
  return e ? `${e} ${n}/${d}` : `${n}/${d}`;
};

function majLongueurs() {
  const type = $('selPiece').value, taille = $('selTaille').value;
  $('lblLongueur').hidden = type !== 'mamelon';
  if (type !== 'mamelon') return;
  const avant = $('selLongueur').value;
  const ls = RACCORDS_NPT.mamelon.tailles[taille].longueurs;
  $('selLongueur').innerHTML = ls.map((l, i) => `<option value="${l}">${frac(l)} po${i === 0 ? ' (serré)' : ''}</option>`).join('');
  if (ls.map(String).includes(avant)) $('selLongueur').value = avant;
}

function afficher() {
  majLongueurs();
  const type = $('selPiece').value, taille = $('selTaille').value;
  const longueur = Number($('selLongueur').value) || undefined;
  if (piece) {
    vue.scene.remove(piece);
    piece.traverse(o => o.geometry?.dispose());
  }
  piece = CONSTRUCTEURS_NPT[type](taille, longueur);
  vue.scene.add(piece);
  vue.cadrer(piece);

  const r = RACCORDS_NPT[type], d = r.tailles[taille], f = FILETS_NPT[taille], fo = FONTE_150[taille];
  $('fiche').innerHTML = `
    <h2>${r.nom} ${taille} po NPT</h2>
    <p class="muted">${r.nomAnglais} · ${type === 'mamelon' ? 'acier noir, schedule 40' : 'fonte malléable noire, classe 150'}</p>
    <dl>
      ${type === 'mamelon' ? `<dt>Longueur</dt><dd>${fmt(longueur)}</dd>` : ''}
      ${d.longueur ? `<dt>Longueur</dt><dd>${fmt(d.longueur)}</dd>` : ''}
      ${d.centreFace ? `<dt>Centre à face</dt><dd>${fmt(d.centreFace)}</dd>` : ''}
      ${type === 'union' ? `<dt>Écrou</dt><dd>octogone ${fmt(d.octogone)}</dd><dt>Bouts</dt><dd>hexagone ${fmt(d.hexagone)}</dd>` : ''}
      ${['manchon', 'coude90', 'coude45', 'te'].includes(type) ? `<dt>Ø du bourrelet</dt><dd>${fmt(fo.bourrelet.d)}</dd>` : ''}
      <dt>Filets</dt><dd>${f.tpi} filets/po, conicité 1:16</dd>
      ${type === 'mamelon'
        ? `<dt>Ø extérieur</dt><dd>${fmt(f.D)}</dd><dt>Ø intérieur</dt><dd>${fmt(f.diInt)}</dd><dt>Filetage</dt><dd>${fmt(f.L4)} par bout</dd>`
        : `<dt>Longueur taraudée</dt><dd>${fmt(type === 'union' ? d.filet : fo.longFiletee)}</dd><dt>Ø ext. du tuyau</dt><dd>${fmt(f.D)}</dd>`}
    </dl>
    ${d.mcmaster ? `<p class="muted petit">Référence : McMaster-Carr ${d.mcmaster}</p>` : ''}`;
}

$('selPiece').onchange = afficher;
$('selTaille').onchange = afficher;
$('selLongueur').onchange = afficher;
$('chkCoupe').onchange = e => vue.coupe(e.target.checked);
$('btnCadrer').onclick = () => vue.cadrer(piece);

afficher();
$('chargement').hidden = true;
window.__conduits = { vue, THREE };
