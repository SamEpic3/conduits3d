(() => {
const C = window.__conduits, m = C.montage, $ = C.$, T = C.THREE, res = {};
const aj = (type, taille, L) => { $('selPiece').value = type; $('selPiece').onchange(); $('selTaille').value = taille; if (L) $('txtLongueur').value = L; C.ajouter(); };
aj('mamelon','1/2','4'); aj('te','1/2');
const branche = () => { const p = m.piece(2); const occ = m.occupees(p); const i = m.ports(p).findIndex((_, k) => !occ.has(k) && m.ports(p)[k].sortie.y > 0.5 || false); return m.portMonde(p, 2).sortie.toArray().map(v => +v.toFixed(3)); };
res.avant = branche();
// rotation de 90° du morceau autour de l'axe du tuyau (X), au centre du té
const etat = m.debutDeplacement(2), c = new T.Vector3().setFromMatrixPosition(m.objets.get(2).matrix);
const axe = m.portMonde(m.piece(1), 1).sortie;
const R = new T.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new T.Matrix4().makeRotationAxis(axe, Math.PI / 2)).multiply(new T.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
m.deplacerMatrice(etat, R);
res.apres = branche();
res.axeTuyau = axe.toArray().map(v => +v.toFixed(3));
// conversion d'un vieux montage : même forme
m.vider();
aj('coude90','1/2'); aj('mamelon','1/2','4'); aj('coude90','1/2'); C.tourner(90); aj('mamelon','1/2','3'); aj('te','1/2'); C.tourner(45);
m.placer({ ancien: true });
const vieux = m.pieces.map(p => m.objets.get(p.id).matrix.clone());
m.convertirVersion1();
res.conversion = Math.max(...m.pieces.map((p, i) => { const a = m.objets.get(p.id).matrix.elements, b = vieux[i].elements; return Math.max(...a.map((v, k) => Math.abs(v - b[k]))); }));
window.__res = res; C.vue.cadrer(m.groupe);
})();
