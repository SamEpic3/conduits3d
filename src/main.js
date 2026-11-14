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
import { Fleches, Cercles, AXES } from 'app/fleches.js';
import { creerCatalogue } from 'app/catalogue-ui.js';

const $ = id => document.getElementById(id);
const vue = creerScene($('cv'));
const montage = new Montage(vue.scene);
const mesures = new Mesures(vue, $('etiquettes'));
const fleches = new Fleches(vue);
const cercles = new Cercles(vue);

let outil = 'main';
let cible = null;         // sortie choisie {id, port}
let selection = null;     // id de la pièce choisie
let glisse = null;         // déplacement en cours avec une flèche
let tourne = null;         // rotation en cours avec un cercle
let manip = null;          // outil affiché sur la pièce choisie : null, 'translation' ou 'rotation'
let manipPour = null;      // … pour quelle pièce
let pas = 15;              // pas de rotation (degrés)
let onglet = 'pieces';
const refaire = [];
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

// 5.24 → « 5,24 » (au plus 3 décimales)
const po3 = v => (+v.toFixed(3)).toString().replace('.', ',');

// « 3 », « 3,5 », « 3.5 », « 3 1/2 », « 1/2 » → nombre (ou NaN)
function lireLongueur(txt) {
  const t = txt.trim().replace(',', '.').replace(/["po]+$/i, '').trim();
  const m = t.match(/^(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return NaN;
  return (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? parseInt(m[2]) / parseInt(m[3]) : 0);
}

// « femelle NPT 1/2 po », « douille de cuivre 3/4 po »…
function decrirePort(pm) {
  const [fam, genre] = pm.type.split('-');
  const t = `${pm.taille} po`;
  if (fam === 'npt') return genre === 'f' ? `filet femelle NPT ${t}` : `filet mâle NPT ${t}`;
  if (fam === 'cu') return genre === 'f' ? `douille de cuivre ${t}, reçoit un tube` : `bout de tube de cuivre ${t}`;
  return genre === 'f' ? `raccord de tube ${t}` : `bout de tube ${t}`;
}

// Choisit d'avance la grosseur qui va sur la sortie choisie.
function tailleSelonCible() {
  if (!cible) return;
  const pm = montage.portMonde(montage.piece(cible.id), cible.port);
  const e = CATALOGUE[$('selPiece').value], fam = pm.type.split('-')[0];
  if (e.famille === fam && e.listeTailles.includes(pm.taille)) $('selTaille').value = pm.taille;
  else if (e.listeTaillesB?.includes(pm.taille)) $('selTailleB').value = pm.taille;
  majPanneau();
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
// Flèches de déplacement et repères d'accrochage

function centrePiece(id) {
  const o = montage.objets.get(id);
  return o ? new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()) : null;
}

// Axe du joint de la pièce (direction de la sortie du parent), pour le cercle cuivre.
function axeJoint(id) {
  const p = montage.piece(id);
  return p?.lien ? montage.portMonde(montage.piece(p.lien.parent), p.lien.port).sortie : null;
}

function placerFleches() {
  if (manipPour !== selection) manip = null;
  const ok = selection && outil === 'main' && !fermeture;
  fleches.montrer(ok && manip === 'translation' ? centrePiece(selection) : null);
  cercles.montrer(ok && manip === 'rotation' ? centrePiece(selection) : null, ok && manip === 'rotation' ? axeJoint(selection) : null);
  $('barreRot').hidden = !(ok && manip === 'rotation') || outil === 'mesure';
  $('btnTranslation').classList.toggle('on', manip === 'translation');
  $('btnRotation').classList.toggle('on', manip === 'rotation');
  if (!glisse) fleches.actif(-1);
  if (!tourne) cercles.actif(-1);
}

function choisirManip(m) {
  if (!selection) return;
  manip = manip === m ? null : m;
  manipPour = selection;
  placerFleches();
  vue.demander();
  if (manip === 'translation') note('Translation : glisse une flèche (rouge = X, verte = profondeur, bleue = verticale). Tout le morceau suit, au 1/16 po ; près d\'une sortie compatible, il se branche quand tu lâches.');
  if (manip === 'rotation') note(`Rotation : glisse un cercle (rouge, vert, bleu : tout le morceau tourne autour de la pièce${axeJoint(selection) ? ' ; cuivre : la pièce tourne autour de son joint' : ''}), par pas de ${pas}°.`);
}

const accroche = new THREE.Group();
vue.scene.add(accroche);
const matAccroche = new THREE.MeshBasicMaterial({ color: 0x2fbf4a, depthTest: false, transparent: true });
function montrerAccroche(c) {
  accroche.traverse(o => o.geometry?.dispose());
  accroche.clear();
  if (!c) return;
  for (const s of [c.m, c.t]) {
    const pm = montage.portMonde(montage.piece(s.id), s.port);
    const D = pm.type.startsWith('cu') ? TUBE_CUIVRE[pm.taille].D : pm.type.startsWith('tube') ? TUBE[pm.taille].D : FILETS_NPT[pm.taille].D;
    const m = new THREE.Mesh(new THREE.TorusGeometry(D / 2 + 0.12, 0.03, 10, 48), matAccroche);
    m.renderOrder = 998;
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pm.sortie);
    m.position.copy(pm.position);
    accroche.add(m);
  }
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
  placerFleches();
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
  $('nomChoisi').textContent = entree.nom;
  verifierCible();
  catalogue.compatibles(cible ? montage.portMonde(montage.piece(cible.id), cible.port) : null);
  remplir($('selTaille'), entree.listeTailles);
  if (entree.listeTaillesB) remplir($('selTailleB'), entree.listeTaillesB);
  $('lblLongueur').hidden = !entree.longueur;
  $('lblTailleTexte').textContent = entree.premiereTaille ?? 'Diamètre nominal';
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
  const tuile = document.querySelector(`.tuile[data-type="${$('selPiece').value}"]`);
  if (cible && tuile?.classList.contains('non')) {
    $('btnAjouter').disabled = true;
    $('indice').textContent = `Cette pièce ne se branche pas sur la sortie choisie (${decrirePort(montage.portMonde(montage.piece(cible.id), cible.port))}). Choisis une pièce qui n'est pas grisée.`;
  }

  // Fiche de la pièce choisie
  const p = selection && montage.piece(selection);
  $('secPiece').hidden = !p;
  $('pieceVide').hidden = !!p;

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
        ${par ? `<dt>Branchée sur</dt><dd>${nomPiece(par)}</dd>` : `<dt>Position</dt><dd>${!p.ancrage ? 'première pièce' : montage.composante(p.id).size > 1 ? 'base d\'un morceau détaché' : 'seule, détachée'}</dd>`}
      </dl>`;
    if (p.cintrage) $('fiche').insertAdjacentHTML('beforeend', `<p class="muted">Coudes (depuis le bout A) :</p><ol class="coudes">${
      p.cintrage.coudes.map(b => `<li>à ${fmtPo(b.s0)} : ${b.a.toFixed(1).replace('.', ',')}°, rotation ${b.th.toFixed(0)}°</li>`).join('') || '<li>aucun (tube droit)</li>'}</ol>`);
    if (p.fermeture) $('fiche').querySelector('dl').insertAdjacentHTML('beforeend', `<dt>Ferme la boucle avec</dt><dd>${nomPiece(montage.piece(p.fermeture.id))}</dd>`);
    const autres = montage.ports(p).length - 1 - [...montage.occupees(p)].filter(i => i !== p.lien?.portEnfant).length;
    $('btnSortie').disabled = !p.lien || autres < 1;
    $('btnDetacher').disabled = montage.composante(p.id).size < 2;
    $('rangLongueur').hidden = !e.longueur;
    if (e.longueur && $('rangLongueur').dataset.id !== String(p.id) + ':' + p.longueur) {
      $('rangLongueur').dataset.id = String(p.id) + ':' + p.longueur;
      $('txtNouvLongueur').value = po3(p.longueur);
      $('longueursPiece').innerHTML = e.longueur.suggestions(p.taille).map(l => `<option value="${fraction(l)}">`).join('');
    }
  }

  // Liste des mesures
  $('listeMesures').innerHTML = mesures.liste.map(m => `<li>${NOMS_MODES[m.mode]} : ${fmtPo(longueurMesure(m))}</li>`).join('');
  $('mesVide').hidden = mesures.liste.length > 0;
  $('btnEffMesures').disabled = !mesures.liste.length;
  $('btnAnnuler').disabled = !historique.length;
  $('btnRetablir').disabled = !refaire.length;
  majMateriel();
  const pastille = n => n ? ` <span class="pastille">${n}</span>` : '';
  document.querySelector('[data-onglet="materiel"]').innerHTML = 'Matériel' + pastille(montage.pieces.length);
  document.querySelector('[data-onglet="mesures"]').innerHTML = 'Mesures' + pastille(mesures.liste.length);
}

// ---------------------------------------------------------------------------
// Onglets du panneau

function choisirOnglet(o) {
  onglet = o;
  document.querySelectorAll('[data-onglet]').forEach(b => { b.classList.toggle('on', b.dataset.onglet === o); b.setAttribute('aria-selected', String(b.dataset.onglet === o)); });
  document.querySelectorAll('[data-panneau]').forEach(s => { s.hidden = s.dataset.panneau !== o; });
  const panneau = document.querySelector('.panel');
  if (panneau.classList.contains('replie')) { panneau.classList.remove('replie'); $('btnPanneau').setAttribute('aria-expanded', 'true'); }
}
document.querySelectorAll('[data-onglet]').forEach(b => b.onclick = () => choisirOnglet(b.dataset.onglet));

// ---------------------------------------------------------------------------
// Liste de matériel : pièces comptées par sorte et grosseur ; tuyaux et tubes avec chaque longueur de coupe.

const FAMILLES = { npt: 'Acier NPT', cu: 'Cuivre à souder', tube: 'Raccords de tube' };
function materiel() {
  const groupes = new Map();
  for (const p of montage.pieces) {
    const e = CATALOGUE[p.type];
    const cle = `${e.famille}|${p.type}|${p.taille}|${p.tailleB ?? ''}`;
    if (!groupes.has(cle)) groupes.set(cle, { e, p, n: 0, longueurs: [] });
    const g = groupes.get(cle);
    g.n++;
    if (e.longueur) g.longueurs.push(p.longueur);
    if (p.cintrage) g.longueurs.push(p.cintrage.longueur);
  }
  const ordre = Object.keys(FAMILLES);
  return [...groupes.values()].sort((a, b) => ordre.indexOf(a.e.famille) - ordre.indexOf(b.e.famille) || (!!a.e.longueur - !!b.e.longueur) || a.e.nom.localeCompare(b.e.nom, 'fr'))
    .map(g => ({ famille: g.e.famille, n: g.n,
      nom: `${g.e.nom} ${g.p.taille}${g.p.tailleB ? ` × ${g.p.tailleB}` : ''} po`,
      longueurs: g.longueurs.sort((a, b) => b - a),
      total: g.longueurs.reduce((a, b) => a + b, 0), cintre: !!g.p.cintrage }));
}

function majMateriel() {
  const liste = materiel();
  if (!liste.length) { $('listeMateriel').innerHTML = '<p class="muted">Le montage est vide.</p>'; $('btnCopierMateriel').disabled = true; return; }
  $('btnCopierMateriel').disabled = false;
  let fam = null, html = '<table><thead><tr><th>Qté</th><th>Pièce</th></tr></thead><tbody>';
  for (const l of liste) {
    if (l.famille !== fam) { fam = l.famille; html += `<tr class="fam"><td colspan="2">${FAMILLES[fam]}</td></tr>`; }
    const det = l.longueurs.length
      ? `<div class="l">${l.cintre ? 'longueur développée' : 'coupes'} : ${l.longueurs.map(v => po3(v)).join(' · ')} po${l.longueurs.length > 1 ? ` — total ${po3(l.total)} po` : ''}</div>` : '';
    html += `<tr><td class="q">${l.n}</td><td>${l.nom}${det}</td></tr>`;
  }
  $('listeMateriel').innerHTML = html + '</tbody></table>';
}

function texteMateriel() {
  let fam = null, t = 'Liste de matériel — Conduits 3D\n';
  for (const l of materiel()) {
    if (l.famille !== fam) { fam = l.famille; t += `\n${FAMILLES[fam]}\n`; }
    t += `  ${l.n} × ${l.nom}` + (l.longueurs.length ? ` (${l.longueurs.map(v => po3(v) + ' po').join(', ')}${l.longueurs.length > 1 ? ` ; total ${po3(l.total)} po` : ''})` : '') + '\n';
  }
  return t;
}
$('btnCopierMateriel').onclick = async () => {
  try { await navigator.clipboard.writeText(texteMateriel()); note('Liste de matériel copiée : colle-la dans un courriel ou un document.'); }
  catch { note('Le navigateur a refusé la copie. Sélectionne la liste à la main.', true); }
};

function memoriser() {
  historique.push({ etat: montage.etat(), cible, selection });
  if (historique.length > 100) historique.shift();
  refaire.length = 0;
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

function changerLongueur() {
  const p = selection && montage.piece(selection);
  if (!p) return;
  const L = lireLongueur($('txtNouvLongueur').value);
  if (!(L > 0)) return note('Longueur illisible : écris par exemple 6, 6,5 ou 6 1/2.', true);
  const avant = p.longueur;
  memoriser();
  const r = montage.changerLongueur(p.id, L);
  if (r.erreur) { historique.pop(); $('txtNouvLongueur').value = po3(avant); return note(r.erreur, true); }
  if (!r.u) { historique.pop(); return; }
  rafraichir();
  const dl = L - avant, txt = `${dl > 0 ? 'rallongé' : 'raccourci'} de ${po3(Math.abs(dl))} po (${po3(avant)} → ${po3(L)} po)`;
  let msg = `${CATALOGUE[p.type].nom} ${txt}. `
    + (r.deplacees ? `${r.deplacees} pièce${r.deplacees > 1 ? 's ont' : ' a'} glissé dans l'axe du tuyau ; rien n'est débranché.` : 'Rien d\'autre n\'a eu à bouger.');
  if (r.ajuste) msg += ` Pour garder la boucle, l'autre ${CATALOGUE[montage.piece(r.ajuste.id).type].nom.toLowerCase()} parallèle passe de ${po3(r.ajuste.avant)} à ${po3(r.ajuste.apres)} po.`;
  note(msg);
}

function detacher() {
  if (!selection) return;
  const p = montage.piece(selection);
  if (montage.composante(selection).size < 2) return note('Cette pièce est déjà seule.', true);
  memoriser();
  montage.detacher(selection);
  cible = null;
  rafraichir();
  note(`${nomPiece(p)} détaché${e_(p)} : glisse-${CATALOGUE[p.type].feminin ? 'la' : 'le'} avec les flèches. Près d'une sortie compatible (1/2 po), ${CATALOGUE[p.type].feminin ? 'elle' : 'il'} se branche quand tu lâches.`);
}

// ---------------------------------------------------------------------------
// Enregistrer et ouvrir un montage

function enregistrer() {
  if (!montage.pieces.length) return note('Le montage est vide : rien à enregistrer.', true);
  const date = new Date().toISOString().slice(0, 10);
  let nom = prompt('Nom du fichier :', `montage-${date}`);
  if (nom === null) return;
  nom = (nom.trim() || `montage-${date}`).replace(/[\\/:*?"<>|]/g, '-').replace(/\.json$/i, '') + '.json';
  const donnees = {
    format: 'conduits3d-montage', version: 2, date: new Date().toISOString(),
    pieces: montage.pieces, seq: montage.seq,
    mesures: mesures.liste.map(m => ({ mode: m.mode, ca: m.ca, cb: m.cb })),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 1)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nom });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  note(`Montage enregistré : ${nom} (${montage.pieces.length} pièce${montage.pieces.length > 1 ? 's' : ''}).`);
}

function ouvrirTexte(texte) {
  let d;
  try { d = JSON.parse(texte); } catch { return note('Ce fichier n\'est pas un montage lisible (JSON invalide).', true); }
  if (d?.format === 'tube-cintre') return note('Ce fichier est un tube cintré : utilise plutôt « Importer un tube cintré ».', true);
  if (d?.format !== 'conduits3d-montage' || !Array.isArray(d.pieces)) return note('Ce fichier n\'est pas un montage de Conduits 3D.', true);
  const inconnu = d.pieces.find(p => !CATALOGUE[p.type]);
  if (inconnu) return note(`Ce montage contient une pièce inconnue (« ${inconnu.type} ») : il vient peut-être d'une version plus récente de l'app.`, true);
  memoriser();
  const avant = montage.etat();
  try {
    montage.restaurer(JSON.stringify({ pieces: d.pieces, seq: d.seq ?? Math.max(0, ...d.pieces.map(p => p.id)) }));
    if ((d.version ?? 1) < 2) montage.convertirVersion1();
  } catch (err) {
    montage.restaurer(avant); historique.pop();
    return note('Impossible d\'ouvrir ce montage : ' + err.message, true);
  }
  mesures.effacer();
  const V = () => new THREE.Vector3();
  mesures.liste = (d.mesures || []).map(m => ({ mode: m.mode, ca: m.ca, cb: m.cb, a: V(), b: V() }));
  cible = null; selection = null;
  rafraichir();
  vue.cadrer(montage.groupe);
  note(`Montage ouvert : ${montage.pieces.length} pièce${montage.pieces.length > 1 ? 's' : ''}${mesures.liste.length ? `, ${mesures.liste.length} mesure${mesures.liste.length > 1 ? 's' : ''}` : ''}. (Annuler pour revenir au montage d'avant.)`);
}

function annuler() {
  const h = historique.pop();
  if (!h) return;
  refaire.push({ etat: montage.etat(), cible, selection });
  montage.restaurer(h.etat);
  cible = h.cible; selection = h.selection;
  rafraichir();
  note('Dernière action annulée. (Rétablir pour la refaire.)');
}

function retablir() {
  const h = refaire.pop();
  if (!h) return;
  historique.push({ etat: montage.etat(), cible, selection });
  montage.restaurer(h.etat);
  cible = h.cible; selection = h.selection;
  rafraichir();
  note('Action rétablie.');
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
    : 'Sélection : clique une sortie (anneau) pour y brancher la prochaine pièce, ou une pièce pour la tourner, la déplacer avec les flèches ou la supprimer.');
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
// Les flèches passent avant la rotation de la vue : on écoute à la capture, sur le parent du canevas.
$('cv').parentElement.addEventListener('pointerdown', e => {
  if (e.target !== $('cv') || outil !== 'main' || !selection || fermeture) return;
  viser(e);
  const rc = cercles.viser(lancer);
  if (rc >= 0) return debutTourne(e, rc);
  const axe = fleches.viser(lancer);
  if (axe < 0) return;
  e.stopPropagation();
  const origine = fleches.groupe.position.clone();
  const s0 = Fleches.surAxe(lancer, origine, AXES[axe].dir);
  if (s0 === null) return note('Cette flèche pointe vers toi : tourne un peu la vue pour la glisser.', true);
  memoriser();
  glisse = { axe, origine, s0, etat: montage.debutDeplacement(selection), d: 0, candidat: null, id: e.pointerId };
  $('cv').setPointerCapture(e.pointerId);
  fleches.actif(axe);
  appui = null;
}, { capture: true });

// --- Rotation avec un cercle -------------------------------------------------
function debutTourne(e, i) {
  e.stopPropagation();
  const centre = cercles.groupe.position.clone(), axe = cercles.axes[i].clone();
  const plan = new THREE.Plane().setFromNormalAndCoplanarPoint(axe, centre);
  const p0 = lancer.ray.intersectPlane(plan, new THREE.Vector3());
  if (!p0 || Math.abs(lancer.ray.direction.dot(axe)) < 0.08) return note('Ce cercle est vu de profil : tourne un peu la vue pour le saisir.', true);
  memoriser();
  const ref = p0.sub(centre);
  const p = montage.piece(selection);
  tourne = { i, centre, axe, ref, a: 0, id: e.pointerId, piece: p,
    etat: i < 3 ? montage.debutDeplacement(selection) : null, angle0: p.angle, candidat: null };
  $('cv').setPointerCapture(e.pointerId);
  cercles.actif(i);
  appui = null;
}

function tourner_(e) {
  viser(e);
  const t = tourne;
  const ang = Cercles.angle(lancer, t.centre, t.axe, t.ref);
  if (ang === null) return;
  const a = Math.round(THREE.MathUtils.radToDeg(ang) / pas) * pas;
  if (a === t.a) return;
  t.a = a;
  if (t.etat) {
    const R = new THREE.Matrix4().makeTranslation(t.centre.x, t.centre.y, t.centre.z)
      .multiply(new THREE.Matrix4().makeRotationAxis(t.axe, THREE.MathUtils.degToRad(a)))
      .multiply(new THREE.Matrix4().makeTranslation(-t.centre.x, -t.centre.y, -t.centre.z));
    montage.deplacerMatrice(t.etat, R);
    t.candidat = montage.candidatAccrochage(t.etat.ids);
    montrerAccroche(t.candidat);
  } else {
    t.piece.angle = ((t.angle0 + a) % 360 + 360) % 360;
    montage.placer();
  }
  dessinerAnneaux();
  surligner(selection);
  const nomAxe = t.i < 3 ? `autour de ${['X', 'la profondeur', 'la verticale'][t.i]}` : 'autour du joint';
  note(`Rotation ${nomAxe} : ${a > 0 ? '+' : ''}${a}°` + (t.candidat ? ` — lâche ici pour brancher sur ${nomPiece(montage.piece(t.candidat.t.id))}.` : '.'));
  vue.demander();
}

function finTourne(annule = false) {
  const t = tourne;
  tourne = null;
  if (t.id !== undefined && $('cv').hasPointerCapture(t.id)) $('cv').releasePointerCapture(t.id);
  montrerAccroche(null);
  if (annule || (!t.a && !t.candidat)) {
    const h = historique.pop();
    montage.restaurer(h.etat);
    rafraichir();
    if (annule) note('Rotation annulée.');
    return;
  }
  if (t.candidat) {
    const r = montage.accrocher(t.candidat.m, t.candidat.t, t.etat.ids);
    const ouv = apresModification();
    rafraichir();
    if (!ouv) note(`Branché sur ${nomPiece(montage.piece(t.candidat.t.id))}.` + (r.joints.length ? ' Un autre bout est arrivé pile dans un raccord : la boucle est fermée.' : ''));
    return;
  }
  const ouv = apresModification();
  rafraichir();
  if (!ouv) note(t.etat ? `Morceau tourné de ${t.a}° ${['autour de X', 'autour de la profondeur', 'autour de la verticale'][t.i]}.` : `Pièce tournée de ${t.a}° autour de son joint.`);
}

function glisser(e) {
  viser(e);
  const s = Fleches.surAxe(lancer, glisse.origine, AXES[glisse.axe].dir);
  if (s === null) return;
  const d = Math.round((s - glisse.s0) * 16) / 16;     // au 1/16 po
  if (d === glisse.d) return;
  glisse.d = d;
  montage.deplacer(glisse.etat, AXES[glisse.axe].dir.clone().multiplyScalar(d));
  glisse.candidat = montage.candidatAccrochage(glisse.etat.ids);
  montrerAccroche(glisse.candidat);
  dessinerAnneaux();
  surligner(selection);
  fleches.montrer(centrePiece(selection));
  const c = glisse.candidat;
  note(`Déplacement en ${AXES[glisse.axe].nom} : ${d < 0 ? '−' : ''}${fraction(Math.abs(d))} po.`
    + (c ? ` Lâche ici pour brancher sur ${nomPiece(montage.piece(c.t.id))}.` : ''));
  vue.demander();
}

function finGlisse(annule = false) {
  const g = glisse;
  glisse = null;
  if (g.id !== undefined && $('cv').hasPointerCapture(g.id)) $('cv').releasePointerCapture(g.id);
  montrerAccroche(null);
  if (annule || (!g.d && !g.candidat)) {
    const h = historique.pop();
    montage.restaurer(h.etat);
    rafraichir();
    if (annule) note('Déplacement annulé.');
    return;
  }
  const n = g.etat.ids.size;
  if (g.candidat) {
    const r = montage.accrocher(g.candidat.m, g.candidat.t, g.etat.ids);
    const ouv = apresModification();
    rafraichir();
    if (!ouv) note(`${n > 1 ? 'Morceau branché' : `${nomPiece(montage.piece(r.id))} branché${e_(montage.piece(r.id))}`} sur ${nomPiece(montage.piece(g.candidat.t.id))}.`
      + (r.joints.length ? ` Un autre bout est arrivé pile dans un raccord : la boucle est fermée.` : ''));
    return;
  }
  const ouv = apresModification();
  rafraichir();
  if (!ouv) note(`${n > 1 ? `Morceau de ${n} pièces déplacé` : 'Pièce déplacée'} de ${g.d < 0 ? '−' : ''}${fraction(Math.abs(g.d))} po en ${AXES[g.axe].nom}.`);
}

$('cv').addEventListener('pointerdown', e => { appui = { x: e.clientX, y: e.clientY }; });
$('cv').addEventListener('pointerup', e => {
  if (glisse) { finGlisse(); return; }
  if (tourne) { finTourne(); return; }
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
    rafraichir();
    tailleSelonCible();
    choisirOnglet('pieces');
    if (document.querySelector('.tuile.on.non')) document.querySelector('.tuile:not(.non)')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const pm = montage.portMonde(montage.piece(s.id), s.port);
    note(`Sortie choisie (${decrirePort(pm)}). Choisis la pièce à brancher, puis clique « Ajouter ». Les pièces grisées ne s'y branchent pas.`);
    return;
  }
  const plan = vue.renderer.clippingPlanes[0];
  const surPiece = lancer.intersectObjects(montage.groupe.children, true)
    .find(i => !plan || plan.distanceToPoint(i.point) >= 0);
  selection = surPiece ? ancetre(surPiece.object, 'idPiece')?.userData.idPiece ?? null : null;
  rafraichir();
  if (selection) { const p = montage.piece(selection); choisirOnglet('piece'); note(`${nomPiece(p)} choisi${e_(p)}. Clic droit ou toucher long : translation, rotation et autres actions.`); }
});
$('cv').addEventListener('pointercancel', () => { if (glisse) finGlisse(true); if (tourne) finTourne(true); });
$('cv').addEventListener('pointermove', e => {
  if (glisse) return glisser(e);
  if (tourne) return tourner_(e);
  if (outil !== 'mesure' || !mesures.apercu) return;
  const pt = viser(e);
  mesures.survol(pt.x, pt.y);
});

// ---------------------------------------------------------------------------
// Menu de la pièce : clic droit, ou toucher long (1/2 s sans bouger)

function pieceSous(x, y) {
  viser({ clientX: x, clientY: y });
  const plan = vue.renderer.clippingPlanes[0];
  const i = lancer.intersectObjects(montage.groupe.children, true).find(i => !plan || plan.distanceToPoint(i.point) >= 0);
  return i ? ancetre(i.object, 'idPiece')?.userData.idPiece ?? null : null;
}

function ouvrirMenu(x, y) {
  if (outil !== 'main' || fermeture) return false;
  const id = pieceSous(x, y);
  if (!id) return false;
  selection = id;
  rafraichir();
  const p = montage.piece(id), e = CATALOGUE[p.type];
  $('menuTitre').textContent = nomPiece(p);
  const menu = $('menuPiece');
  menu.querySelector('[data-action="longueur"]').hidden = !e.longueur;
  const autres = montage.ports(p).length - 1 - [...montage.occupees(p)].filter(i => i !== p.lien?.portEnfant).length;
  menu.querySelector('[data-action="sortie"]').disabled = !p.lien || autres < 1;
  menu.querySelector('[data-action="detacher"]').disabled = montage.composante(p.id).size < 2;
  menu.querySelector('[data-action="translation"]').classList.toggle('on', manip === 'translation' && manipPour === id);
  menu.querySelector('[data-action="rotation"]').classList.toggle('on', manip === 'rotation' && manipPour === id);
  menu.hidden = false;
  const r = $('stage').getBoundingClientRect(), m = menu.getBoundingClientRect();
  menu.style.left = Math.max(6, Math.min(x - r.left, r.width - m.width - 6)) + 'px';
  menu.style.top = Math.max(6, Math.min(y - r.top, r.height - m.height - 6)) + 'px';
  return true;
}
const fermerMenu = () => { $('menuPiece').hidden = true; };

$('menuPiece').addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  fermerMenu();
  ({
    translation: () => choisirManip('translation'),
    rotation: () => choisirManip('rotation'),
    longueur: () => { choisirOnglet('piece'); $('txtNouvLongueur').focus(); $('txtNouvLongueur').select(); },
    sortie: changerSortie,
    detacher,
    fiche: () => choisirOnglet('piece'),
    supprimer,
  })[b.dataset.action]();
});
document.addEventListener('pointerdown', e => { if (!$('menuPiece').hidden && !e.target.closest('#menuPiece')) fermerMenu(); }, true);

let droit = null, toucherLong = null;
$('cv').addEventListener('contextmenu', e => e.preventDefault());
$('cv').addEventListener('pointerdown', e => {
  if (e.button === 2) droit = { x: e.clientX, y: e.clientY };
  if (e.pointerType === 'touch' && !glisse && !tourne) {
    clearTimeout(toucherLong?.minuterie);
    toucherLong = { x: e.clientX, y: e.clientY, minuterie: setTimeout(() => {
      if (ouvrirMenu(toucherLong.x, toucherLong.y)) { appui = null; navigator.vibrate?.(15); }
      toucherLong = null;
    }, 550) };
  }
});
$('cv').addEventListener('pointermove', e => {
  if (toucherLong && Math.hypot(e.clientX - toucherLong.x, e.clientY - toucherLong.y) > 8) { clearTimeout(toucherLong.minuterie); toucherLong = null; }
});
const finToucher = () => { if (toucherLong) { clearTimeout(toucherLong.minuterie); toucherLong = null; } };
$('cv').addEventListener('pointercancel', finToucher);
$('cv').addEventListener('pointerup', e => {
  finToucher();
  if (e.button === 2 && droit) {
    if (Math.hypot(e.clientX - droit.x, e.clientY - droit.y) <= 5) ouvrirMenu(e.clientX, e.clientY);
    droit = null;
  }
});

// ---------------------------------------------------------------------------
// Boutons et clavier

const catalogue = creerCatalogue({
  vue, conteneur: $('catalogue'), select: $('selPiece'),
  surChoix: () => { majPanneau(); tailleSelonCible(); },
});
catalogue.choisir($('selPiece').value, false);
$('btnTranslation').onclick = () => choisirManip('translation');
$('btnRotation').onclick = () => choisirManip('rotation');
$('btnRetablir').onclick = retablir;
document.querySelectorAll('[data-pas]').forEach(b => b.onclick = () => {
  pas = Number(b.dataset.pas);
  document.querySelectorAll('[data-pas]').forEach(x => x.classList.toggle('on', x === b));
  note(`Pas de rotation : ${pas}°.`);
});

$('btnPanneau').onclick = () => {
  const replie = document.querySelector('.panel').classList.toggle('replie');
  $('btnPanneau').setAttribute('aria-expanded', String(!replie));
};
$('btnAjouter').onclick = ajouter;
$('btnImporter').onclick = () => $('fichierTube').click();
$('fichierTube').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importerTube(f); };
$('btnFermer').onclick = () => fermeture ? (arreterFermeture(), note('Fermeture de boucle annulée.')) : demarrerFermeture();
$('selPiece').onchange = () => catalogue.choisir($('selPiece').value, false);
$('selTaille').onchange = majPanneau;
$('btnTournerDe').onclick = () => { const v = Number($('txtAngle').value.replace(',', '.')); if (Number.isFinite(v) && v) tourner(v); };
document.querySelectorAll('[data-tourner]').forEach(b => b.onclick = () => tourner(Number(b.dataset.tourner)));
$('btnSortie').onclick = changerSortie;
$('btnSupprimer').onclick = supprimer;
$('btnDetacher').onclick = detacher;
$('btnLongueur').onclick = changerLongueur;
$('txtNouvLongueur').onkeydown = e => { if (e.key === 'Enter') changerLongueur(); };
$('btnEnregistrer').onclick = enregistrer;
$('btnOuvrir').onclick = () => $('fichierMontage').click();
$('fichierMontage').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) ouvrirTexte(await f.text()); };
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
function basculerOrtho() {
  vue.projection(!vue.orthogonale);
  $('btnOrtho').classList.toggle('on', vue.orthogonale);
  placerFleches();
  note(vue.orthogonale ? 'Vue orthogonale : sans perspective, les lignes parallèles restent parallèles (comme un dessin technique).' : 'Vue en perspective.');
}
$('btnOrtho').onclick = basculerOrtho;

// ---------------------------------------------------------------------------
// Exporter une image : sans anneaux, flèches ni surbrillance ; mesures et coupe au choix.

function rendreImage(echelle = 1) {
  const [W, H] = $('imgFormat').value.split('x').map(n => Math.round(Number(n) * echelle));
  const avecMesures = $('imgMesures').checked, nomVue = $('imgVue').value;
  const etat = vue.etatCamera();
  const caches = [anneaux, accroche, fleches.groupe].map(o => [o, o.visible]);
  for (const [o] of caches) o.visible = false;
  surligner(null);
  mesures.dessiner(false);
  mesures.groupe.visible = avecMesures;
  let toile;
  try {
    vue.projection($('imgProjection').value === 'ortho');
    vue.coupe($('imgCoupe').checked);
    toile = vue.image(W, H, {
      fond: $('imgFond').checked ? '#ffffff' : null,
      preparer: () => { if (nomVue !== 'actuelle') { vue.vue(nomVue, montage.groupe); vue.ajuster(montage.groupe); } },
      pardessus: mesures.groupe,
      dessiner2d: (ctx, camera) => {
        if (!avecMesures) return;
        const t = Math.round(H / 46);
        ctx.font = `600 ${t}px "IBM Plex Mono", Menlo, Consolas, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const e of mesures.positionsEtiquettes(camera, W, H)) {
          const l = ctx.measureText(e.texte).width + t, h = t * 1.6, y = e.y - h * 0.8;
          ctx.fillStyle = '#1f56c4';
          ctx.beginPath(); ctx.roundRect(e.x - l / 2, y - h / 2, l, h, t * 0.4); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(e.texte, e.x, y + 1);
        }
      },
    });
  } finally {
    vue.restaurerCamera(etat);
    for (const [o, v] of caches) o.visible = v;
    mesures.groupe.visible = true;
    rafraichir();
  }
  return toile;
}

function apercuImage() { $('imgApercu').src = rendreImage(0.4).toDataURL('image/png'); }

$('btnImage').onclick = () => {
  if (!montage.pieces.length) return note('Le montage est vide : rien à exporter.', true);
  $('imgProjection').value = vue.orthogonale ? 'ortho' : 'persp';
  $('imgCoupe').checked = coupe;
  $('imgMesures').disabled = !mesures.liste.length;
  $('imgMesures').checked = mesures.liste.length > 0;
  $('dlgImage').showModal();
  apercuImage();
};
for (const id of ['imgVue', 'imgProjection', 'imgFormat', 'imgMesures', 'imgCoupe', 'imgFond']) $(id).onchange = apercuImage;
$('btnTelecharger').onclick = e => {
  e.preventDefault();
  rendreImage().toBlob(b => {
    const url = URL.createObjectURL(b);
    const nom = `montage-${$('imgVue').value}-${new Date().toISOString().slice(0, 10)}.png`;
    const a = Object.assign(document.createElement('a'), { href: url, download: nom });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    $('dlgImage').close();
    note(`Image enregistrée : ${nom}.`);
  }, 'image/png');
};
$('btnEffMesures').onclick = () => { mesures.effacer(); rafraichir(); note('Mesures effacées.'); };
$('btnToutEffacer').onclick = () => {
  if (!montage.pieces.length) return;
  memoriser();
  montage.vider(); mesures.effacer(); cible = null; selection = null;
  rafraichir();
  note('Nouveau montage. (Annuler pour revenir en arrière.)');
};

document.addEventListener('keydown', e => {
  if (e.target.matches('input, select') || $('dlgImage').open) return;
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); retablir(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); annuler(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); $('fichierMontage').click(); return; }
  if (e.key === 'Escape') {
    if (!$('menuPiece').hidden) { fermerMenu(); return; }
    if (glisse) { finGlisse(true); return; }
    if (tourne) { finTourne(true); return; }
    if (manip) { manip = null; placerFleches(); vue.demander(); return; }
    if (fermeture) { arreterFermeture(); note('Fermeture de boucle annulée.'); return; }
    if (mesures.apercu) { mesures.annulerApercu(); note('Mesure annulée.'); }
    else { selection = null; rafraichir(); }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') supprimer();
  if (e.key.toLowerCase() === 'm') choisirOutil('mesure');
  if (e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.metaKey) basculerOrtho();
  if (e.key.toLowerCase() === 's') choisirOutil('main');
  if (e.key.toLowerCase() === 'g') choisirManip('translation');
  if (e.key.toLowerCase() === 'r') choisirManip('rotation');
});

rafraichir();
$('chargement').hidden = true;
window.__conduits = { cercles, choisirManip, choisirOnglet, retablir, annuler, ouvrirMenu, materiel, catalogue, fleches, changerLongueur, ouvrirTexte, importerTexte: t => importerTube({ text: async () => t }), vue, montage, mesures, THREE, ajouter, choisirOutil, tourner, $, detacher, deplacer: (id, axe, d) => { selection = id; rafraichir(); const etat = montage.debutDeplacement(id); memoriser(); glisse = { axe, etat, d, candidat: null }; montage.deplacer(etat, AXES[axe].dir.clone().multiplyScalar(d)); glisse.candidat = montage.candidatAccrochage(etat.ids); finGlisse(); }, selectionner: id => { selection = id; rafraichir(); }, choisirSortie: (id, port) => { cible = { id, port }; rafraichir(); }, fermer: (a, b) => { demarrerFermeture(); clicFermeture(a); clicFermeture(b); } };
