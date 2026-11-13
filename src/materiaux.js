// Matériaux partagés par toutes les pièces.
import * as THREE from 'three';

const std = o => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });

// Surface grenue de la fonte coulée (moulage au sable) : on perturbe la normale avec un bruit 3D
// calculé dans le repère de la pièce. Pas besoin de coordonnées de texture, et le grain reste
// collé à la pièce quand elle bouge.
function grainDeFonte(materiau, { echelle = 55, force = 0.55 } = {}) {
  materiau.onBeforeCompile = shader => {
    shader.uniforms.uGrainEchelle = { value: echelle };
    shader.uniforms.uGrainForce = { value: force };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPosPiece;
        varying vec3 vNm0; varying vec3 vNm1; varying vec3 vNm2;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPosPiece = position;
        vNm0 = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vNm1 = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
        vNm2 = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPosPiece;
        varying vec3 vNm0; varying vec3 vNm1; varying vec3 vNm2;
        uniform float uGrainEchelle; uniform float uGrainForce;
        float hashG(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float bruitG(vec3 x){
          vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hashG(i), hashG(i + vec3(1,0,0)), f.x), mix(hashG(i + vec3(0,1,0)), hashG(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hashG(i + vec3(0,0,1)), hashG(i + vec3(1,0,1)), f.x), mix(hashG(i + vec3(0,1,1)), hashG(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        float reliefG(vec3 p){ return bruitG(p) * 0.65 + bruitG(p * 2.3 + 7.1) * 0.35; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 p = vPosPiece * uGrainEchelle; float e = 0.35;
          float h0 = reliefG(p);
          vec3 g = vec3(reliefG(p + vec3(e,0,0)) - h0, reliefG(p + vec3(0,e,0)) - h0, reliefG(p + vec3(0,0,e)) - h0) / e;
          vec3 gv = g.x * vNm0 + g.y * vNm1 + g.z * vNm2;     // gradient dans le repère de la caméra
          normal = normalize(normal - uGrainForce * (gv - dot(gv, normal) * normal));
        }`);
  };
  return materiau;
}

export const MATERIAUX = {
  // Fonte malléable noire : fini noir mat, grenu, légèrement métallique.
  fonte: grainDeFonte(std({ color: 0x2c2e31, metalness: 0.4, roughness: 0.68 })),
  // Filets usinés : métal brut, plus pâle et plus brillant.
  filet: std({ color: 0x77797c, metalness: 0.85, roughness: 0.38 }),
  // Tuyau d'acier noir (calamine lisse).
  acierNoir: std({ color: 0x313438, metalness: 0.55, roughness: 0.5 }),
  // Cuivre : tube et raccords corroyés (wrot), légèrement satiné.
  cuivre: std({ color: 0xc8805a, metalness: 1.0, roughness: 0.33 }),
  // Filets usinés dans le cuivre ou le laiton : plus brillants.
  filetCuivre: std({ color: 0xd99a6e, metalness: 1.0, roughness: 0.25 }),
  // Filets usinés dans le laiton.
  filetLaiton: std({ color: 0xd2b36e, metalness: 1.0, roughness: 0.28 }),
  // Acier zingué (écrous inverted flare).
  acierZingue: std({ color: 0xb4b8bc, metalness: 0.9, roughness: 0.35 }),
  // Soudure à l'étain (cordon au joint).
  soudure: std({ color: 0xb9bbb6, metalness: 1.0, roughness: 0.3 }),
  // Laiton (écrou d'union).
  laiton: std({ color: 0xb8975a, metalness: 1.0, roughness: 0.42 }),
};
