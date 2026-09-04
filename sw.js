/* Stratégie :
   - HTML : réseau d'abord, cache en secours -> un déploiement Vercel est visible
     au rechargement suivant, sans avoir à modifier ce fichier.
   - Icônes / manifest : cache d'abord, rafraîchi en arrière-plan.
   Aucune constante de version à incrémenter à la main. */

const CACHE = 'comparateur-lu';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // Pas de skipWaiting() ici : la nouvelle version attend que l'utilisateur
  // touche le bandeau. Sinon elle s'activerait seule et rechargerait la page,
  // éventuellement en pleine saisie.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const estHTML = req =>
  req.mode === 'navigate' ||
  (req.headers.get('accept') || '').includes('text/html');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (estHTML(req)) {
    // réseau d'abord
    e.respondWith(
      fetch(req)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put('./index.html', clone));
          return resp;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // cache d'abord, revalidation en arrière-plan
  e.respondWith(
    caches.match(req).then(cached => {
      const reseau = fetch(req)
        .then(resp => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || reseau;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
