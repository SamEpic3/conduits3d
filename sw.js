// Service worker : garde l'app en cache pour qu'elle s'ouvre sans Internet.
// Change VERSION à chaque mise à jour du site pour que les appareils récupèrent la nouvelle version.
const VERSION = 'conduits3d-v5';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icone-192.png', './icons/icone-512.png', './icons/icone.svg', './icons/icone-masquable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Page : réseau d'abord (pour avoir la dernière version), cache si hors ligne
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(k => k.put('./index.html', c)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // Polices Google et fichiers du site : cache d'abord, puis réseau
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(k => k.put(req, c)); }
      return r;
    })));
  }
});
