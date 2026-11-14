# Conduits 3D

Montages de tuyaux, tubes et raccords en 3D pour les étudiants en électromécanique :
acier NPT (fonte malléable noire), cuivre à souder, raccords de tube SAE 45°, inverted flare et compression.

En ligne (après activation de GitHub Pages) : https://samepic3.github.io/conduits3d/

## Installer comme application (PWA)
Sur https://samepic3.github.io/conduits3d/ :
- **Chrome / Edge (ordinateur, Android)** : icône « Installer » dans la barre d'adresse, ou menu ⋮ → Installer l'application.
- **iPhone / iPad (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

Une fois ouverte une première fois, l'app fonctionne sans Internet.
Après une mise à jour du site, changer `VERSION` dans `sw.js` pour que les appareils récupèrent la nouvelle version.

Sur téléphone : outils en haut (icônes), panneau en tiroir au bas en portrait (à droite en paysage), repliable avec ▾.

## Utilisation
1. Onglet **Ajouter** : choisis une pièce dans le catalogue en images, sa grosseur, puis **Ajouter**. La première pièce se
   place au centre. Les pièces grisées ne se branchent pas sur la sortie choisie.
2. Les **anneaux orange** sont les sorties libres ; clique-en une (elle devient bleue) pour y brancher la pièce suivante.
   Les filets mâles entrent de la longueur d'engagement (1/2 po : 0,500 ; 3/4 po : 0,5625).
3. Clique une pièce : sa fiche s'ouvre (onglet **Pièce**). **Clic droit** ou **toucher long** sur une pièce : menu
   Translation, Rotation, Changer la longueur, Changer de sortie, Détacher, Fiche, Supprimer
   (seule cette pièce est enlevée : ce qui était branché dessus reste en place, et se rebranche avec « Fermer une boucle »).
4. **Translation** (G) : trois flèches (rouge = X, verte = profondeur, bleue = verticale). Glisse une flèche : tout le
   morceau relié à la pièce suit, au 1/16 po. **Rotation** (R) : cercles rouge, vert et bleu pour tourner le morceau
   autour de la pièce, et un cercle cuivre pour tourner la pièce autour de son joint, par pas de 5, 15, 45 ou 90°.
   **Détacher** sépare la pièce pour la bouger seule.
   Si, en lâchant, une sortie du morceau est à moins de 1/2 po d'une sortie compatible (anneaux verts), le morceau
   s'aligne et se branche tout seul ; un autre bout qui arrive alors pile dans un raccord (tube, cuivre) ferme la boucle.
   Échap pendant le glissement annule. Près d'une sortie compatible, le morceau se branche aussi après une rotation.
5. **Changer la longueur** d'un tuyau ou d'un tube droit (fiche de la pièce) : le côté qui compte le moins de pièces
   glisse dans l'axe, rien ne se débranche. Dans une boucle, l'autre tuyau droit parallèle de la boucle s'ajuste
   d'autant ; s'il n'y en a pas (ou s'il deviendrait trop court), l'app refuse et explique pourquoi.
6. **Mesure** (M) : clique deux points repères — centre d'un raccord (violet), face d'un raccord ou bout de tuyau (gris) —
   en distance directe ou en écart X, Y ou Z. Les mesures suivent le montage quand on le modifie.
7. **Fermer une boucle** :
   - deux raccords face à face : l'app y met le tuyau ou le tube de la bonne longueur (distance entre les faces + les deux engagements) ;
   - le bout libre d'un tube (ex. : tube cintré importé) puis un raccord : l'app cherche la rotation du tube autour de son joint
     qui l'aligne, et accepte si le bout arrive au bon endroit (tolérance 1/16 po et 2°), sinon elle dit de combien il est trop
     long, trop court, décalé ou désaligné. En fileté NPT, il faut une union (on ne visse pas les deux bouts d'un tuyau).
   Si on tourne une pièce ensuite, la boucle s'ouvre (avec un avertissement).
8. **Importer un tube cintré** : dans la cintreuse 3D, onglet Relevé → « Exporter le tube (.json) » ; ici, choisis la sortie
   (et la grosseur 5/16 ou 3/8), puis « Importer un tube cintré ». Le tube garde ses coudes (rayon 15/16 po).
9. **Enregistrer** (Ctrl+S) télécharge le montage et ses mesures dans un fichier `.json` ; **Ouvrir** (Ctrl+O) le recharge
   (Annuler revient au montage d'avant). Sur iPhone, le fichier va dans l'app Fichiers.
10. **Ortho** (O) bascule entre la perspective et la vue orthogonale (sans perspective, comme un dessin technique).
11. **Image** exporte un PNG : vue (actuelle, 3D, face, dessus, côté), projection, format, mesures ou non, coupe ou non,
    fond blanc ou transparent. Les anneaux des sorties, les flèches et la surbrillance n'y sont jamais.
12. **Coupe** montre l'intérieur ; **Annuler** (Ctrl+Z) revient en arrière, **Rétablir** (Ctrl+Y) refait.
13. Onglet **Matériel** : les pièces comptées par sorte et grosseur, avec chaque longueur de coupe ; « Copier la liste ».

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
3. Changer `VERSION` dans `sw.js`.
4. Vérifier : `node tests/capture.mjs /tmp/capture.png` (capture d'écran avec Chrome),
   `node tests/mobile.mjs script.js /tmp/m.png [largeur hauteur]` (format téléphone), `node tests/toucher.mjs` (touchers)
   ou `node tests/scenario.mjs scenario.js /tmp/capture.png` (exécute un script dans la page, puis capture).
