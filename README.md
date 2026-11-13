# Conduits 3D

Montages de tuyaux, tubes et raccords en 3D pour les étudiants en électromécanique :
acier NPT (fonte malléable noire), cuivre à souder, raccords de tube SAE 45°, inverted flare et compression.

En ligne (après activation de GitHub Pages) : https://samepic3.github.io/conduits3d/

## Fichiers
- `index.html` : l'application complète en un seul fichier (fonctionne aussi hors ligne, par double-clic). **Généré** : ne pas modifier à la main.
- `src/` : le code source.
  - `donnees/` : dimensions des tuyaux, filets et raccords (sources dans `docs/`).
  - `geometrie/` : surfaces de révolution, filets en hélice.
  - `pieces/` : construction 3D de chaque raccord.
- `vendor/` : moteur 3D Three.js r160 (licence MIT).

## Modifier
1. Modifier les fichiers dans `src/`.
2. `node build.mjs` pour régénérer `index.html` (et `dev.html`).
3. Vérifier : `node tests/capture.mjs /tmp/capture.png` (capture d'écran avec Chrome).
