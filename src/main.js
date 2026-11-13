// Étape 2 : montage de raccords NPT, avec l'outil de mesure.
import * as THREE from 'three';
import { creerScene } from 'app/scene.js';
import { FILETS_NPT } from 'app/donnees/npt.js';
import { TUBE_CUIVRE } from 'app/donnees/cuivre.js';
import { TUBE } from 'app/donnees/tube.js';
import { CATALOGUE } from 'app/catalogue.js';
import { Montage } from 'app/montage.js';
import { lireTubeCintre } from 'app/geometrie/cintrage.js';
import { Mesures, NOMS_MODES, longueurMesure, fmtPo } from 'app/mesure.js';

const $ = id => document.getElementById(id);
const vue = creerScene($('cv'));
const montage = new Montage(vue.scene);
const mesures = new Mesures(vue, $('etiquettes'));

let outil = 'main';
let cible = null;         // sortie choisie {id, port}
let selection = null;     // id de la pièce choisie
let fermeture = null;     // mode « fermer une boucle » : null, ou { premiere: sortie ou null }
const historique = [];

// ---------------------------------------------------------------------------
// Messages

function note(texte, erreur = false) {
  $('note').textContent = texte;
  $('note').classList.toggle('erreur', erreur);
}

const nomPiece = p => `${CATALOGUE[p.type].nom}${CATALOGUE[p.type].longueur ? ` ${fraction(p.longueur)} po` : ''} (${p.taille}${p.tailleB ? ` × ${p.tailleB}` : ''} po)`;

// Accord : « ajouté » ou « ajoutée » selon la pièce.
const e_ = p => CATALOGUE[p.type].feminin ? 'e' : '';

// Première sortie libre d'une pièce, ou null.
function sortieLibre(id) {
  const p = montage.piece(id), occ = montage.occupees(p);
  const i = montage.ports(p).findIndex((_, k) => !occ.has(k));
  return i >= 0 ? { id, port: i } : null;
}

// 1.125 → « 1 1/8 »
function fraction(v) {
  const e = Math.floor(v + 1e-9), r = Math.round((v - e) * 16);
  if (!r) return `${e}`;
  if (r === 16) return `${e + 1}`;
  let n = r, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; }
  return e ? `${e} ${n}/${d}` : `${n}/${d}`;
}

// « 3 », « 3,5 », « 3.5 », « 3 1/2 », « 1/2 » → nombre (ou NaN)
function lireLongueur(txt) {
  const t = txt.trim().replace(',', '.').replace(/["po]+$/i, '').trim();
  const m = t.match(/^(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return NaN;
  return (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? parseInt(m[2]) / parseInt(m[3]) : 0);
}

// ---------------------------------------------------------------------------
// Anneaux sur les sorties libres

const anneaux = new THREE.Group();
vue.scene.add(anneaux);
const matAnneau = new THREE.MeshBasicMaterial({ color: 0xd9782e });
const matAnneauChoisi = new THREE.MeshBasicMaterial({ color: 0x1f56c4 });
const matDisque = new THREE.MeshBasicMaterial({ color: 0xd9782e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
const matDisqueChoisi = new THREE.MeshBasicMaterial({ color: 0x1f56c4, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });

function dessinerAnneaux() {
  anneaux.traverse(o => o.geometry?.dispose());
  anneaux.clear();
  if (outil !== 'main') return;
  for (const s of montage.sortiesLibres()) {
    const choisi = fermeture
      ? fermeture.premiere && fermeture.premiere.id === s.id && fermeture.premiere.port === s.port
      : cible && cible.id === s.id && cible.port === s.port;
    const D = s.type.startsWith('cu') ? TUBE_CUIVRE[s.taille].D : s.type.startsWith('tube') ? TUBE[s.taille].D : FILETS_NPT[s.taille].D;
    const r = D / 2 + (s.type.startsWith('tube') ? 0.07 : 0.1);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 10, 48), choisi ? matAnneauChoisi : matAnneau));
    g.add(new THREE.Mesh(new THREE.CircleGeometry(r, 40), choisi ? matDisqueChoisi : matDisque));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.sortie);
    g.position.copy(s.position).addScaledVector(s.sortie, 0.04);
    g.userData.sortie = { id: s.id, port: s.port };
    anneaux.add(g);
  }
}

// ---------------------------------------------------------------------------
// Surbrillance de la pièce choisie

const originaux = new Map();
function surligner(id) {
  for (const [m, mat] of originaux) { m.material.dispose(); m.material = mat; }
  originaux.clear();
  const o = id && montage.objets.get(id);
  if (!o) return;
  o.traverse(m => {
    if (!m.isMesh) return;
    originaux.set(m, m.material);
    const c = m.material.clone();
    c.onBeforeCompile = m.material.onBeforeCompile;
    c.emissive = new THREE.Color(0x3d2409);
    m.material = c;
  });
}

// ---------------------------------------------------------------------------
// Mise à jour générale

// Oublie la sortie choisie si elle n'existe plus ou n'est plus libre.
function verifierCible() {
  if (!cible) return;
  const p = montage.piece(cible.id);
  if (!p || montage.occupees(p).has(cible.port)) cible = null;
}

function rafraichir() {
  verifierCible();
  if (selection && !montage.piece(selection)) selection = null;
  dessinerAnneaux();
  surligner(selection);
  mesures.actualiser(montage.pointsReperes(), outil === 'mesure');
  majPanneau();
  vue.demander();
}

// Met les grosseurs offertes dans un menu, en gardant le choix actuel s'il existe encore.
function remplir(sel, liste) {
  const actuel = sel.value;
  if ([...sel.options].map(o => o.value).join() !== liste.join())
    sel.innerHTML = liste.map(t => `<option>${t}</option>`).join('');
  if (liste.includes(actuel)) sel.value = actuel;
}

function majPanneau() {
  const entree = CATALOGUE[$('selPiece').value];
  remplir($('selTaille'), entree.listeTailles);
  if (entree.listeTaillesB) remplir($('selTailleB'), entree.listeTaillesB);
  $('lblLongueur').hidden = !entree.longueur;
  $('lblTailleB').hidden = !entree.deuxiemeTaille;
  if (entree.deuxiemeTaille) $('lblTailleBTexte').textContent = entree.deuxiemeTaille;
  if (entree.longueur) $('longueursStd').innerHTML = entree.longueur.suggestions($('selTaille').value)
    .map(l => `<option value="${fraction(l)}">`).join('');

  const vide = !montage.pieces.length;
  $('indice').textContent = vide
    ? 'La première pièce sera placée au centre.'
    : cible
      ? `Sera branchée sur la sortie en bleu (${nomPiece(montage.piece(cible.id))}).`
      : 'Clique sur une sortie (anneau orange) pour choisir où brancher la pièce.';
  $('btnAjouter').disabled = !vide && !cible;

  // Fiche de la pièce choisie
  const p = selection && montage.piece(selection);
  $('secPiece').hidden = !p;
  if (p) {
    const e = CATALOGUE[p.type];
    const par = p.lien && montage.piece(p.lien.parent);
    const lignes = e.fiche(p.taille, p.longueur, p.tailleB, p);
    if (e.famille === 'npt') lignes.push(['Engagement des filets', FILETS_NPT[p.taille].engagement]);
    $('fiche').innerHTML = `
      <h2>${nomPiece(p)}</h2>
      <p class="muted">${e.nomAnglais} · ${e.matiere}</p>
      <dl>
        ${lignes.map(([k, v]) => `<dt>${k}</dt><dd>${fmtPo(v)}</dd>`).join('')}
        ${par ? `<dt>Branchée sur</dt><dd>${nomPiece(par)}</dd>` : '<dt>Position</dt><dd>première pièce</dd>'}
      </dl>`;
    if (p.cintrage) $('fiche').insertAdjacentHTML('beforeend', `<p class="muted">Coudes (depuis le bout A) :</p><ol class="coudes">${
      p.cintrage.coudes.map(b => `<li>à ${fmtPo(b.s0)} : ${b.a.toFixed(1).replace('.', ',')}°, rotation ${b.th.toFixed(0)}°</li>`).join('') || '<li>aucun (tube droit)</li>'}</ol>`);
    if (p.fermeture) $('fiche').querySelector('dl').insertAdjacentHTML('beforeend', `<dt>Ferme la boucle avec</dt><dd>${nomPiece(montage.piece(p.fermeture.id))}</dd>`);
    const autres = montage.ports(p).length - 1 - [...montage.occupees(p)].filter(i => i !== p.lien?.portEnfant).length;
    $('btnSortie').disabled = !p.lien || autres < 1;
  }

  // Liste des mesures
  $('listeMesures').innerHTML = mesures.liste.map(m => `<li>${NOMS_MODES[m.mode]} : ${fmtPo(longueurMesure(m))}</li>`).join('');
  $('mesVide').hidden = mesures.liste.length > 0;
  $('btnEffMesures').disabled = !mesures.liste.length;
  $('btnAnnuler').disabled = !historique.length;
}

function memoriser() {
  historique.push({ etat: montage.etat(), cible, selection });
  if (historique.length > 100) historique.shift();
}

// ---------------------------------------------------------------------------
// Actions

function ajouter() {
  const type = $('selPiece').value, taille = $('selTaille').value;
  const tailleB = CATALOGUE[type].deuxiemeTaille ? $('selTailleB').value : undefined;
  const combos = CATALOGUE[type].combinaisons;
  if (combos && !combos.includes(`${taille}|${tailleB}`))
    return note(`Offert seulement en ${combos.map(c => c.replace('|', ' × ')).join(', ')} po .`, true);
  let longueur;
  const entree = CATALOGUE[type];
  if (entree.longueur) {
    longueur = lireLongueur($('txtLongueur').value);
    const min = entree.longueur.min(taille);
    if (!(longueur > 0)) return note('Longueur invalide. Exemples : 3, 3,5 ou 3 1/2.', true);
    if (longueur < min - 1e-6) return note(type === 'mamelon'
      ? `Le plus court mamelon ${taille} po est le mamelon serré de ${fraction(min)} po.`
      : `Longueur trop courte (minimum ${fraction(min)} po).`, true);
    if (longueur > 120) return note('Longueur trop grande (maximum 120 po).', true);
  }
  verifierCible();
  memoriser();
  const premier = !montage.pieces.length;
  const r = montage.ajouter({ type, taille, longueur, tailleB }, cible);
  if (r.erreur) { historique.pop(); return note(r.erreur, true); }
  selection = r.id;
  // On choisit d'emblée une sortie libre de la nouvelle pièce pour continuer le montage.
  const p = montage.piece(r.id);
  cible = sortieLibre(r.id);
  rafraichir();
  vue.cadrer(montage.groupe);
  note(premier
    ? `${nomPiece(p)} placé${e_(p)}. Les anneaux orange sont les sorties libres ; la bleue est choisie pour la prochaine pièce.`
    : `${nomPiece(p)} ajouté${e_(p)}. Au besoin, tourne la pièce autour du joint avec ↺ ↻.`);
}

function demarrerFermeture() {
  if (outil !== 'main') choisirOutil('main');
  fermeture = { premiere: null };
  $('btnFermer').classList.add('primary');
  rafraichir();
  note('Fermer une boucle : clique deux raccords face à face (l\'app ajoute le tuyau ou le tube), ou le bout libre d\'un tube puis le raccord où il doit entrer. Échap pour annuler.');
}

function arreterFermeture() {
  fermeture = null;
  $('btnFermer').classList.remove('primary');
  rafraichir();
}

function clicFermeture(s) {
  if (!fermeture.premiere) {
    fermeture.premiere = s;
    rafraichir();
    note('Première sortie choisie. Clique maintenant le raccord (ou le bout) à relier.');
    return;
  }
  const a = fermeture.premiere;
  memoriser();
  const r = montage.fermer(a, s);
  if (r.erreur) {
    historique.pop();
    fermeture.premiere = null;
    rafraichir();
    return note(r.erreur, true);
  }
  arreterFermeture();
  selection = r.id; cible = null;
  rafraichir();
  const p = montage.piece(r.id);
  if (r.joint) {
    const e = r.ecart, po = v => `${Math.abs(v).toFixed(3).replace('.', ',')} po`;
    return note(`Boucle fermée : le bout arrive dans le raccord (écart ${po(e.axial)} en profondeur, ${po(e.lateral)} sur le côté, ${e.angle.toFixed(1).replace('.', ',')}°).`
      + (r.rotation ? ` La pièce a été tournée de ${r.rotation.toFixed(1).replace('.', ',')}° autour de son joint pour s'aligner.` : ''));
  }
  note(`Boucle fermée avec ${r.type === 'mamelon' ? 'un tuyau' : 'un tube'} de ${fmtPo(r.longueur)} (longueur de coupe : distance entre les faces ${fmtPo(r.distance)} + les deux engagements).`);
  void p;
}

// Après une modification : les boucles qui ne ferment plus s'ouvrent.
function apresModification() {
  const ouvertes = montage.verifierFermetures();
  if (ouvertes.length) note(`Attention : ${ouvertes.length === 1 ? 'une boucle ne ferme plus' : ouvertes.length + ' boucles ne ferment plus'} (les sorties ne sont plus face à face). Le tuyau reste branché d'un seul côté.`, true);
  return ouvertes.length;
}

// Importe un tube cintré exporté par la cintreuse 3D.
async function importerTube(fichier) {
  const d = lireTubeCintre(await fichier.text());
  if (d.erreur) return note(d.erreur, true);
  verifierCible();
  const taille = ['5/16', '3/8'].includes($('selTaille').value) ? $('selTaille').value : (d.tube || '3/8');
  memoriser();
  const premier = !montage.pieces.length;
  const r = montage.ajouter({ type: 'tb-cintre', taille, cintrage: d }, cible);
  if (r.erreur) { historique.pop(); return note(r.erreur, true); }
  selection = r.id;
  cible = sortieLibre(r.id);
  rafraichir();
  vue.cadrer(montage.groupe);
  note(`Tube cintré ${taille} po importé : ${d.coudes.length} coude${d.coudes.length > 1 ? 's' : ''}, longueur développée ${fmtPo(d.longueur)}.${premier ? '' : ' Tourne-le autour du joint au besoin avec ↺ ↻.'}`);
}

function tourner(deg) {
  if (!selection) return;
  memoriser();
  montage.tourner(selection, deg);
  apresModification();
  rafraichir();
}

function changerSortie() {
  if (!selection) return;
  memoriser();
  if (!montage.changerSortie(selection)) { historique.pop(); return note('Cette pièce n\'a pas d\'autre sortie compatible libre.', true); }
  cible = sortieLibre(selection);
  const ouv = apresModification();
  rafraichir();
  if (!ouv) note('La pièce est maintenant branchée par une autre de ses sorties.');
}

function supprimer() {
  if (!selection) return;
  const p = montage.piece(selection);
  memoriser();
  const detachees = montage.enfants(selection);
  montage.supprimer(selection);
  // On reprend la sortie libérée sur le parent.
  cible = p.lien ? { id: p.lien.parent, port: p.lien.port } : null;
  selection = p.lien ? p.lien.parent : null;
  apresModification();
  rafraichir();
  note(`${nomPiece(p)} supprimé${e_(p)}.${detachees ? ' Ce qui était branché dessus reste en place ; pour le rebrancher, utilise « Fermer une boucle ».' : ''}`);
}

function annuler() {
  const h = historique.pop();
  if (!h) return;
  montage.restaurer(h.etat);
  cible = h.cible; selection = h.selection;
  rafraichir();
  note('Dernière action annulée.');
}

function choisirOutil(o) {
  if (o !== 'main' && fermeture) { fermeture = null; $('btnFermer').classList.remove('primary'); }
  outil = o;
  document.querySelectorAll('[data-outil]').forEach(b => b.classList.toggle('on', b.dataset.outil === o));
  $('modes').hidden = o !== 'mesure';
  $('stage').classList.toggle('outil-mesure', o === 'mesure');
  if (o !== 'mesure') mesures.apercu = null;
  rafraichir();
  note(o === 'mesure'
    ? 'Mesure : clique deux points repères. Violet = centre d\'un raccord ; gris = face d\'un raccord ou bout de tuyau.'
    : 'Sélection : clique une sortie (anneau) pour y brancher la prochaine pièce, ou une pièce pour la tourner ou la supprimer.');
}

// ---------------------------------------------------------------------------
// Souris

const lancer = new THREE.Raycaster();
function viser(e) {
  const r = vue.renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  lancer.setFromCamera(ndc, vue.camera);
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
const ancetre = (o, cle) => { while (o && o.userData[cle] === undefined) o = o.parent; return o; };

let appui = null;
$('cv').addEventListener('pointerdown', e => { appui = { x: e.clientX, y: e.clientY }; });
$('cv').addEventListener('pointerup', e => {
  if (!appui || Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 5) { appui = null; return; }
  appui = null;
  const pt = viser(e);
  if (outil === 'mesure') {
    const r = mesures.clic(pt.x, pt.y);
    note(r.message, r.erreur);
    if (r.ajoutee) majPanneau();
    return;
  }
  const surAnneau = lancer.intersectObjects(anneaux.children, true)[0];
  if (surAnneau) {
    const s = ancetre(surAnneau.object, 'sortie').userData.sortie;
    if (fermeture) return clicFermeture(s);
    cible = s; selection = s.id;
    const tp = montage.ports(montage.piece(s.id))[s.port].taille;
    if ([...$('selTaille').options].some(o => o.value === tp)) $('selTaille').value = tp;
    rafraichir();
    note('Sortie choisie. Choisis la pièce à brancher, puis clique « Ajouter ».');
    return;
  }
  const plan = vue.renderer.clippingPlanes[0];
  const surPiece = lancer.intersectObjects(montage.groupe.children, true)
    .find(i => !plan || plan.distanceToPoint(i.point) >= 0);
  selection = surPiece ? ancetre(surPiece.object, 'idPiece')?.userData.idPiece ?? null : null;
  rafraichir();
  if (selection) { const p = montage.piece(selection); note(`${nomPiece(p)} choisi${e_(p)}.`); }
});
$('cv').addEventListener('pointermove', e => {
  if (outil !== 'mesure' || !mesures.apercu) return;
  const pt = viser(e);
  mesures.survol(pt.x, pt.y);
});

// ---------------------------------------------------------------------------
// Boutons et clavier

$('btnPanneau').onclick = () => {
  const replie = document.querySelector('.panel').classList.toggle('replie');
  $('btnPanneau').setAttribute('aria-expanded', String(!replie));
};
$('btnAjouter').onclick = ajouter;
$('btnImporter').onclick = () => $('fichierTube').click();
$('fichierTube').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importerTube(f); };
$('btnFermer').onclick = () => fermeture ? (arreterFermeture(), note('Fermeture de boucle annulée.')) : demarrerFermeture();
$('selPiece').onchange = majPanneau;
$('selTaille').onchange = majPanneau;
$('btnTournerDe').onclick = () => { const v = Number($('txtAngle').value.replace(',', '.')); if (Number.isFinite(v) && v) tourner(v); };
document.querySelectorAll('[data-tourner]').forEach(b => b.onclick = () => tourner(Number(b.dataset.tourner)));
$('btnSortie').onclick = changerSortie;
$('btnSupprimer').onclick = supprimer;
$('btnAnnuler').onclick = annuler;
document.querySelectorAll('[data-outil]').forEach(b => b.onclick = () => choisirOutil(b.dataset.outil));
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
  mesures.mode = b.dataset.mode;
  if (mesures.apercu) mesures.apercu.mode = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
  mesures.dessiner(outil === 'mesure');
});
document.querySelectorAll('[data-vue]').forEach(b => b.onclick = () => vue.vue(b.dataset.vue, montage.groupe));
let coupe = false;
$('btnCoupe').onclick = () => { coupe = !coupe; vue.coupe(coupe); $('btnCoupe').classList.toggle('on', coupe); };
$('btnEffMesures').onclick = () => { mesures.effacer(); rafraichir(); note('Mesures effacées.'); };
$('btnToutEffacer').onclick = () => {
  if (!montage.pieces.length) return;
  memoriser();
  montage.vider(); mesures.effacer(); cible = null; selection = null;
  rafraichir();
  note('Nouveau montage. (Annuler pour revenir en arrière.)');
};

document.addEventListener('keydown', e => {
  if (e.target.matches('input, select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); annuler(); return; }
  if (e.key === 'Escape') {
    if (fermeture) { arreterFermeture(); note('Fermeture de boucle annulée.'); return; }
    if (mesures.apercu) { mesures.annulerApercu(); note('Mesure annulée.'); }
    else { selection = null; rafraichir(); }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') supprimer();
  if (e.key.toLowerCase() === 'm') choisirOutil('mesure');
  if (e.key.toLowerCase() === 's') choisirOutil('main');
});

rafraichir();
$('chargement').hidden = true;
window.__conduits = { importerTexte: t => importerTube({ text: async () => t }), vue, montage, mesures, THREE, ajouter, choisirOutil, tourner, $, selectionner: id => { selection = id; rafraichir(); }, choisirSortie: (id, port) => { cible = { id, port }; rafraichir(); }, fermer: (a, b) => { demarrerFermeture(); clicFermeture(a); clicFermeture(b); } };
