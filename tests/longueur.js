(() => {
const C = window.__conduits, m = C.montage, $ = C.$, T = C.THREE, res = {};
const aj = (type, taille, L) => { $('selPiece').value = type; $('selPiece').onchange(); $('selTaille').value = taille; if (L) $('txtLongueur').value = L; C.ajouter(); };
const c = id => new T.Vector3().setFromMatrixPosition(m.objets.get(id).matrix);
// 1. Chaîne
aj('coude90','1/2'); aj('mamelon','1/2','4'); aj('te','1/2'); aj('mamelon','1/2','3'); aj('coude90','1/2');
const d0 = c(1).distanceTo(c(3)), p5 = c(5).clone();
C.selectionner(2); $('txtNouvLongueur').value = '6'; C.changerLongueur();
res.chaine = { note: $('note').textContent, gain: +(c(1).distanceTo(c(3)) - d0).toFixed(4), cinqBouge: c(5).distanceTo(p5) > 1e-6 };
// 2. Boucle de cuivre
m.vider();
aj('cu-coude90','1/2'); aj('cu-tube','1/2','4'); aj('cu-coude90','1/2'); aj('cu-tube','1/2','6'); aj('cu-coude90','1/2'); aj('cu-tube','1/2','4'); aj('cu-coude90','1/2');
let l;
search: for (const a3 of [0,90,180,270]) for (const a5 of [0,90,180,270]) for (const a7 of [0,90,180,270]) {
  m.piece(3).angle=a3; m.piece(5).angle=a5; m.piece(7).angle=a7; m.placer();
  l = m.sortiesLibres(); const r = m.analyserFermeture({id:l[0].id,port:l[0].port},{id:l[1].id,port:l[1].port});
  if (!r.erreur) break search;
}
res.fermer = C.fermer({id:l[0].id,port:l[0].port},{id:l[1].id,port:l[1].port});
res.noteF = $('note').textContent;
const ferme = m.pieces.find(p=>p.fermeture);
res.ferme = ferme && [ferme.id, ferme.type, +ferme.longueur.toFixed(3)];
C.selectionner(4); $('txtNouvLongueur').value = '7 1/2'; C.changerLongueur();
res.boucle = { note: $('note').textContent, ferme: ferme && +m.piece(ferme.id).longueur.toFixed(3), fermetures: m.pieces.filter(p=>p.fermeture).length };
C.selectionner(2); $('txtNouvLongueur').value = '5'; C.changerLongueur();
res.boucle2 = { note: $('note').textContent, fermetures: m.pieces.filter(p=>p.fermeture).length, l: m.pieces.filter(p=>p.type==='cu-tube').map(p=>+p.longueur.toFixed(3)) };
C.selectionner(2); $('txtNouvLongueur').value = '1'; C.changerLongueur();
res.boucle3 = { note: $('note').textContent };
$('txtNouvLongueur').value = '6'; C.changerLongueur(); res.refus = $('note').textContent; res.l = m.pieces.filter(p=>p.type==='cu-tube').map(p=>+p.longueur.toFixed(3)); C.selectionner(4);
window.__res = res; C.vue.cadrer(m.groupe);
})();
