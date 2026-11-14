window.__res = (async () => {
const C = window.__conduits, m = C.montage, $ = C.$, T = C.THREE, res = {};
$('selPiece').value = 'tb-sae-m'; $('selPiece').onchange(); $('selTaille').value = '3/8'; $('selTailleB').value = '1/4'; C.ajouter();
let s = m.sortiesLibres().find(x => x.type.startsWith('tube')); C.choisirSortie(s.id, s.port);
$('selPiece').value = 'tb-tube'; $('selPiece').onchange(); $('selTaille').value = '3/8';
await C.importerTexte(JSON.stringify({ format: 'tube-cintre', version: 1, tube: '3/8', rayon: 15 / 16, longueur: 12, coudes: [{ s0: 4, a: 90, th: 0 }] }));
s = m.sortiesLibres().find(x => x.id === 2); C.choisirSortie(2, s.port);
$('selPiece').value = 'tb-comp-f'; $('selPiece').onchange(); $('selTaille').value = '3/8'; $('selTailleB').value = '1/4'; C.ajouter();
C.selectionner(3); C.detacher();
const pc = m.portMonde(m.piece(3), m.ports(m.piece(3)).findIndex(x => x.type === 'tube-f'));
// on recule le connecteur de 0,2 po : il manque 0,2 po au tube
const etat = m.debutDeplacement(3); m.deplacer(etat, pc.sortie.clone().multiplyScalar(0.2));
const libre = m.sortiesLibres().find(x => x.id === 2), cible = m.sortiesLibres().find(x => x.id === 3 && x.type === 'tube-f');
C.fermer({ id: 2, port: libre.port }, { id: 3, port: cible.port });
res.note = $('note').textContent; res.L = m.piece(2).cintrage.longueur;
res.ecart = m.ecartJoint(m.portMonde(m.piece(2), libre.port), m.portMonde(m.piece(3), cible.port));
// 0,4 po : hors tolérance
C.annuler(); const e2 = m.debutDeplacement(3); m.deplacer(e2, pc.sortie.clone().multiplyScalar(0.2));
C.fermer({ id: 2, port: libre.port }, { id: 3, port: cible.port });
res.note2 = $('note').textContent;
// 0,07 po de côté et 0,1 po trop court : le tube se force et s'allonge
{ const eb = m.debutDeplacement(3); m.deplacer(eb, pc.sortie.clone().multiplyScalar(-0.4)); }
const lat = new T.Vector3(1, 0, 0).cross(pc.sortie).normalize(); if (lat.length() < 0.5) lat.set(0, 1, 0);
const lat2 = pc.sortie.clone().cross(lat).normalize(); const e3 = m.debutDeplacement(3); m.deplacer(e3, lat2.clone().multiplyScalar(0.07).addScaledVector(pc.sortie, -0.1));
C.fermer({ id: 2, port: libre.port }, { id: 3, port: cible.port });
res.note3 = $('note').textContent;
res.ecart3 = m.ecartJoint(m.portMonde(m.piece(2), libre.port), m.portMonde(m.piece(3), cible.port));
res.ressort = m.piece(2).cintrage.ressort;
const s2 = JSON.stringify({ pieces: m.pieces, seq: m.seq }); m.restaurer(s2); res.apresRestaurer = m.ecartJoint(m.portMonde(m.piece(2), libre.port), m.portMonde(m.piece(3), cible.port));
return res;
})().catch(e => ({ erreur: e.message }));
