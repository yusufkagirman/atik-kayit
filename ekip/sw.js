// ETS service worker: kabuk önbelleği + web push. Supabase çağrıları (başka kaynak) hiç önbelleğe girmez.
const V = 'ets-v2';
const KABUK = ['stil.css', 'config.js', 'onay.js', 'pwa.js', 'logo.png', 'icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(KABUK)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  // Sayfa: önce ağ (hep güncel), çevrimdışıysa önbellek. Sorgu (token) yok sayılır.
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const k = res.clone(); caches.open(V).then(c => c.put(u.pathname, k)); return res; }).catch(() => caches.match(u.pathname)));
    return;
  }
  // Varlıklar: önbellekten hemen ver, arkada tazele (sürüm ?v= parametresi ayrı kayıt olur).
  e.respondWith(caches.match(r).then(c => {
    const ag = fetch(r).then(res => { if (res.ok) { const k = res.clone(); caches.open(V).then(x => x.put(r, k)); } return res; }).catch(() => c);
    return c || ag;
  }));
});

self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.baslik || 'ATİK ETS', {body: d.metin || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.etiket, data: {url: d.url || './'}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(l => {
    const w = l.find(c => c.url.split('?')[0] === url.split('?')[0]);
    return w ? w.focus().then(c => c.navigate(url).catch(() => c)) : self.clients.openWindow(url);
  }));
});
