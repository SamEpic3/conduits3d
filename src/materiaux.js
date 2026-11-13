// Matériaux partagés par toutes les pièces.
import * as THREE from 'three';

const std = o => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });

export const MATERIAUX = {
  // Fonte malléable noire : fini noir mat, légèrement métallique.
  fonte: std({ color: 0x2a2c2f, metalness: 0.45, roughness: 0.62 }),
  // Filets usinés : métal brut, plus pâle et plus brillant.
  filet: std({ color: 0x77797c, metalness: 0.85, roughness: 0.38 }),
  // Tuyau d'acier noir.
  acierNoir: std({ color: 0x34373b, metalness: 0.55, roughness: 0.5 }),
};
