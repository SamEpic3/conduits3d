// Étape 1 : visionneuse d'une pièce, pour valider les modèles avant de construire les montages.
import * as THREE from 'three';
import { creerScene } from 'app/scene.js';
import { RACCORDS_NPT, FILETS_NPT, FONTE_150 } from 'app/donnees/npt.js';
import { CONSTRUCTEURS_NPT } from 'app/pieces/npt.js';

const $ = id => document.getElementById(id);
const vue = creerScene($('cv'));
let piece = null;

const fmt = v => `${v.toFixed(3).replace('.', ',')} po`;

function afficher() {
  const type = $('selPiece').value, taille = $('selTaille').value;
  if (piece) {
    vue.scene.remove(piece);
    piece.traverse(o => o.geometry?.dispose());
  }
  piece = CONSTRUCTEURS_NPT[type](taille);
  // Axe du raccord à l'horizontale (X) : la coupe passe alors par l'axe.
  piece.rotation.y = Math.PI / 2;
  vue.scene.add(piece);
  vue.cadrer(piece);

  const r = RACCORDS_NPT[type], d = r.tailles[taille], f = FILETS_NPT[taille], fo = FONTE_150[taille];
  $('fiche').innerHTML = `
    <h2>${r.nom} ${taille} po NPT</h2>
    <p class="muted">${r.nomAnglais} · fonte malléable noire, classe 150</p>
    <dl>
      ${d.longueur ? `<dt>Longueur</dt><dd>${fmt(d.longueur)}</dd>` : ''}
      ${d.centreFace ? `<dt>Centre à face</dt><dd>${fmt(d.centreFace)}</dd>` : ''}
      <dt>Ø du bourrelet</dt><dd>${fmt(fo.bourrelet.d)}</dd>
      <dt>Filets</dt><dd>${f.tpi} filets/po, conicité 1:16</dd>
      <dt>Longueur taraudée</dt><dd>${fmt(fo.longFiletee)}</dd>
      <dt>Ø ext. du tuyau</dt><dd>${fmt(f.D)}</dd>
    </dl>
    ${d.mcmaster ? `<p class="muted petit">Référence : McMaster-Carr ${d.mcmaster}</p>` : ''}`;
}

$('selPiece').onchange = afficher;
$('selTaille').onchange = afficher;
$('chkCoupe').onchange = e => vue.coupe(e.target.checked);
$('btnCadrer').onclick = () => vue.cadrer(piece);

afficher();
$('chargement').hidden = true;
window.__conduits = { vue, THREE };
