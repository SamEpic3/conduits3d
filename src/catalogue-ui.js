// Catalogue en images : une tuile (vignette 3D + nom) par pièce, regroupées par famille.
// Les vignettes sont rendues une fois au premier lancement, puis gardées dans le navigateur.
import { CATALOGUE } from 'app/catalogue.js';

const VERSION = 'conduits3d-vignettes-2';

export function creerCatalogue({ vue, conteneur, select, surChoix, surRefus = () => {} }) {
  const tuiles = new Map();       // type → bouton
  const sorties = new Map();      // type → types de sorties ('npt-f', …), connus une fois la vignette faite
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(VERSION)) || {}; } catch { cache = {}; }

  const familles = [];   // { entete, grille, types }
  let ouvertes;
  try { const l = JSON.parse(localStorage.getItem('conduits3d-familles')); ouvertes = Array.isArray(l) ? new Set(l) : null; } catch { ouvertes = null; }
  const garderOuvertes = () => { try { localStorage.setItem('conduits3d-familles', JSON.stringify(familles.filter(f => !f.grille.hidden).map(f => f.nom))); } catch { /* */ } };
  const plier = (f, ouvert) => { f.grille.hidden = !ouvert; f.entete.setAttribute('aria-expanded', String(ouvert)); };
  for (const groupe of select.querySelectorAll('optgroup')) {
    const fam = document.createElement('button');
    fam.type = 'button';
    fam.className = 'famille';
    fam.innerHTML = `<span class="chevron">▸</span><span>${groupe.label}</span><span class="compte"></span>`;
    const grille = document.createElement('div');
    grille.className = 'tuiles';
    const f = { nom: groupe.label, entete: fam, grille, types: [...groupe.querySelectorAll('option')].map(o => o.value) };
    familles.push(f);
    plier(f, ouvertes ? ouvertes.has(groupe.label) : familles.length === 1);
    fam.onclick = () => { plier(f, grille.hidden); garderOuvertes(); };
    for (const opt of groupe.querySelectorAll('option')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tuile';
      b.dataset.type = opt.value;
      b.title = CATALOGUE[opt.value].nom;
      const c = cache[opt.value];
      b.innerHTML = (c ? `<img alt="" src="${c.img}">` : '<span class="vide"></span>') + `<span>${opt.textContent}</span>`;
      if (c) sorties.set(opt.value, c.sorties);
      b.onclick = () => {
        if (b.classList.contains('non')) return surRefus(opt.value);
        choisir(opt.value, true);
      };
      grille.append(b);
      tuiles.set(opt.value, b);
    }
    conteneur.append(fam, grille);
  }

  // clic : vrai quand l'élève a touché la tuile (ajout rapide), faux quand le choix vient du code.
  function choisir(type, clic = false) {
    select.value = type;
    for (const [t, b] of tuiles) b.classList.toggle('on', t === type);
    surChoix(type, clic);
  }
  const image = type => tuiles.get(type)?.querySelector('img')?.src || '';

  // Vignettes manquantes : une à la fois, entre deux images, pour ne pas figer l'app.
  const manquantes = [...tuiles.keys()].filter(t => !cache[t]);
  const suivante = () => {
    const type = manquantes.shift();
    if (!type) {
      try { localStorage.setItem(VERSION, JSON.stringify(cache)); } catch { /* stockage plein : tant pis */ }
      return;
    }
    const e = CATALOGUE[type];
    let t = e.listeTailles[e.listeTailles.length > 1 && e.famille !== 'tube' ? e.listeTailles.length - 1 : 0];
    let tb = e.listeTaillesB?.[0];
    // Certaines pièces n'existent qu'en quelques combinaisons de grosseurs : on en prend une qui existe.
    if (e.combinaisons && !e.combinaisons.includes(`${t}|${tb}`))
      [t, tb] = (e.combinaisons.find(c => c.startsWith(t + '|')) ?? e.combinaisons[0]).split('|');
    try {
      const demo = type === 'tb-cintre' ? { cintrage: { longueur: 7, rayon: 15 / 16, coudes: [{ s0: 2.5, a: 90, th: 0 }] } } : {};
      const o = e.construire(t, e.longueur ? 2.5 : undefined, tb, demo);
      const types = [...new Set((o.userData.ports || []).map(p => p.type))];
      const img = vue.vignette(o).toDataURL('image/webp', 0.85);
      o.traverse(x => x.geometry?.dispose());
      cache[type] = { img, sorties: types };
      sorties.set(type, types);
      const b = tuiles.get(type);
      b.querySelector('.vide')?.replaceWith(Object.assign(document.createElement('img'), { alt: '', src: img }));
      if (dernierPort) compatibles(dernierPort);
    } catch (err) {
      // Pas de vignette : on n'affiche pas un chargement sans fin.
      console.warn('vignette', type, err);
      tuiles.get(type).querySelector('.vide')?.classList.add('echec');
    }
    setTimeout(suivante, 30);
  };
  if (manquantes.length) setTimeout(suivante, 1200);

  // Grise les pièces qui n'ont aucune sortie pouvant se brancher sur la sortie choisie.
  // ouvrir : déplie les familles qui ont une pièce compatible et replie les autres (nouvelle sortie choisie).
  let dernierPort = null;
  function compatibles(port, ouvrir = false) {
    dernierPort = port;
    for (const [type, b] of tuiles) {
      const s = sorties.get(type);
      let ok = true;
      if (port && s) {
        const [fam, genre] = port.type.split('-');
        ok = s.some(x => { const [f, g] = x.split('-'); return f === fam && g !== genre; });
      }
      b.classList.toggle('non', !ok);
      b.title = CATALOGUE[type].nom + (ok ? '' : ' — ne se branche pas sur la sortie choisie');
    }
    for (const f of familles) {
      const n = f.types.filter(t => !tuiles.get(t).classList.contains('non')).length;
      f.entete.querySelector('.compte').textContent = port ? `${n} / ${f.types.length}` : f.types.length;
      if (ouvrir && port) plier(f, n > 0);
    }
  }

  return { choisir, compatibles, image };
}
