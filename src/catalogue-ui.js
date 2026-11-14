// Catalogue en images : une tuile (vignette 3D + nom) par pièce, regroupées par famille.
// Les vignettes sont rendues une fois au premier lancement, puis gardées dans le navigateur.
import { CATALOGUE } from 'app/catalogue.js';

const VERSION = 'conduits3d-vignettes-2';

export function creerCatalogue({ vue, conteneur, select, surChoix }) {
  const tuiles = new Map();       // type → bouton
  const sorties = new Map();      // type → types de sorties ('npt-f', …), connus une fois la vignette faite
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(VERSION)) || {}; } catch { cache = {}; }

  for (const groupe of select.querySelectorAll('optgroup')) {
    const fam = document.createElement('div');
    fam.className = 'famille';
    fam.textContent = groupe.label;
    const grille = document.createElement('div');
    grille.className = 'tuiles';
    for (const opt of groupe.querySelectorAll('option')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tuile';
      b.dataset.type = opt.value;
      b.title = CATALOGUE[opt.value].nom;
      const c = cache[opt.value];
      b.innerHTML = (c ? `<img alt="" src="${c.img}">` : '<span class="vide"></span>') + `<span>${opt.textContent}</span>`;
      if (c) sorties.set(opt.value, c.sorties);
      b.onclick = () => { if (!b.classList.contains('non')) choisir(opt.value); };
      grille.append(b);
      tuiles.set(opt.value, b);
    }
    conteneur.append(fam, grille);
  }

  function choisir(type, defiler = true) {
    select.value = type;
    for (const [t, b] of tuiles) b.classList.toggle('on', t === type);
    surChoix(type);
    // Au téléphone, le choix de grosseur est sous la grille : on le montre.
    if (defiler && matchMedia('(max-width:760px)').matches) document.querySelector('.choix')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

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
      const o = e.construire(t, e.longueur ? 2.5 : undefined, tb, {});
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
  let dernierPort = null;
  function compatibles(port) {
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
  }

  return { choisir, compatibles };
}
