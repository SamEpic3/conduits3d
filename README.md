# Conduits 3D

Montages de tuyaux, tubes et raccords en 3D pour les étudiants en électromécanique :
acier NPT (fonte malléable noire), cuivre à souder, raccords de tube SAE 45°, inverted flare et compression.

En ligne (après activation de GitHub Pages) : https://samepic3.github.io/conduits3d/

## Utilisation
1. Choisis une pièce et clique **Ajouter** : la première pièce se place au centre.
2. Les **anneaux orange** sont les sorties libres ; clique-en une (elle devient bleue) pour y brancher la pièce suivante.
   Les filets mâles entrent de la longueur d'engagement (1/2 po : 0,500 ; 3/4 po : 0,5625).
3. Clique une pièce pour la **tourner** autour de son joint (45° ou 90°), la brancher par une **autre sortie** ou la **supprimer**.
4. **Mesure** (M) : clique deux points repères — centre d'un raccord (violet), face d'un raccord ou bout de tuyau (gris) —
   en distance directe ou en écart X, Y ou Z. Les mesures suivent le montage quand on le modifie.
5. **Coupe** montre l'intérieur ; **Annuler** (Ctrl+Z) revient en arrière.

## Fichiers
- `index.html` : l'application complète en un seul fichier (fonctionne aussi hors ligne, par double-clic). **Généré** : ne pas modifier à la main.
- `src/` : le code source.
  - `donnees/` : dimensions des tuyaux, filets et raccords (sources dans `docs/`).
  - `geometrie/` : surfaces de révolution, filets en hélice.
  - `pieces/` : construction 3D de chaque raccord.
  - `montage.js` : assemblage des pièces par leurs sorties ; `mesure.js` : outil de mesure.
- `vendor/` : moteur 3D Three.js r160 (licence MIT).

## Modifier
1. Modifier les fichiers dans `src/`.
2. `node build.mjs` pour régénérer `index.html` (et `dev.html`).
3. Vérifier : `node tests/capture.mjs /tmp/capture.png` (capture d'écran avec Chrome)
   ou `node tests/scenario.mjs scenario.js /tmp/capture.png` (exécute un script dans la page, puis capture).
