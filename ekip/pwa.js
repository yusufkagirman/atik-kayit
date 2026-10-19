// ETS PWA: manifest (token'lı start_url), service worker, "Ana ekrana ekle" bandı, rozet.
(() => {
  const lider = /lider\.html/.test(location.pathname);
  const abs = f => new URL(f, location.href).href;
  const kurulu = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // Kişiye özel linkteki token start_url'e girer: ikon her zaman kendi ekibini açar.
  const man = {
    name: lider ? 'ATİK ETS · Lider' : 'ATİK ETS · Yönetim', short_name: lider ? 'ETS' : 'ETS Yönetim',
    start_url: location.href, scope: abs('./'), display: 'standalone', orientation: 'portrait',
    background_color: '#ffffff', theme_color: '#0f3f27', lang: 'tr',
    icons: [{src: abs('icon-192.png'), sizes: '192x192', type: 'image/png'}, {src: abs('icon-512.png'), sizes: '512x512', type: 'image/png'}, {src: abs('icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable'}]
  };
  const l = document.createElement('link'); l.rel = 'manifest';
  l.href = URL.createObjectURL(new Blob([JSON.stringify(man)], {type: 'application/manifest+json'}));
  document.head.append(l);

  if ('serviceWorker' in navigator) {
    const eski = navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(k => document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && k.update().catch(() => {}))).catch(() => {});
    // Yeni sürüm devraldığında açık sayfa eski kalır: yenileme önerisi (yazılan taslak kaybolmasın diye kendiliğinden yenilenmez)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!eski || document.querySelector('.kurulum.yeni')) return;
      const b = document.createElement('div'); b.className = 'kurulum yeni';
      b.innerHTML = '<img src="icon-192.png" alt=""><p>Yeni sürüm hazır.</p><button type="button" class="btn ana">Yenile</button>';
      b.querySelector('.btn').onclick = () => location.reload(); document.body.append(b);
    });
  }

  // Rozet: okunmamış sayısı (sayfalar window.rozet(n) çağırır; desteklenmeyen yerde sessizce geçer).
  window.rozet = n => { try { n > 0 ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch {} };

  // Bildirim: sayfa window.pushKur(kapsayici, kaydet) çağırır; kaydet(sub) aboneliği sunucuya yazar.
  const b64b = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const anahtar = k => btoa(String.fromCharCode(...new Uint8Array(k))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function abone() {
    const kayit = await navigator.serviceWorker.ready;
    let s = await kayit.pushManager.getSubscription();
    if (!s) {
      const {pub} = await fetch(CFG.URL + '/functions/v1/ets-push').then(r => r.json());
      s = await kayit.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64b(pub)});
    }
    return {endpoint: s.endpoint, p256dh: anahtar(s.getKey('p256dh')), auth: anahtar(s.getKey('auth'))};
  }
  window.pushKur = async (kap, kaydet) => {
    const iosTarayici = /iphone|ipad|ipod/i.test(navigator.userAgent) && !kurulu;
    const destek = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const kart = (metin, dugme, tikla) => {
      const d = document.createElement('div'); d.className = 'kart bildirim-kart'; d.innerHTML = '<p></p>'; d.firstChild.textContent = metin;
      if (dugme) { const b = document.createElement('button'); b.className = 'btn ana kucuk'; b.type = 'button'; b.textContent = dugme; b.onclick = tikla; d.append(b); }
      kap.prepend(d); return d;
    };
    if (!destek) return iosTarayici ? kart('Bildirim almak için bu sayfayı önce ana ekrana ekleyin (Paylaş ▸ Ana Ekrana Ekle), sonra ana ekrandaki ATİK ikonundan açın.') : 0;
    if (Notification.permission === 'denied') return kart('Bildirimler kapalı. Telefonun ayarlarından ATİK ETS için bildirime izin verirseniz yeni duyuru ve mesajlar anında gelir.');
    if (Notification.permission === 'granted') { try { await kaydet(await abone()); } catch {} return; }
    const k = kart('Yeni duyuru ve mesajlardan anında haberdar olun.', '🔔 Bildirimleri aç', async () => {
      try { if (await Notification.requestPermission() !== 'granted') return k.remove(); await kaydet(await abone()); k.remove(); window.bildir?.('Bildirimler açıldı'); }
      catch (e) { window.bildir?.('Bildirim açılamadı: ' + e.message, 1); }
    });
  };

  // Kurulum bandı: kuruluysa hiç çıkmaz; kapatılırsa 14 gün susar.
  const SUS = 'ets-kurulum-sus';
  let sus = 0; try { sus = +localStorage.getItem(SUS) || 0; } catch {}
  if (kurulu || Date.now() < sus) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let olay = null;
  const bant = (metin, dugme) => {
    const b = document.createElement('div'); b.className = 'kurulum';
    b.innerHTML = '<img src="icon-192.png" alt=""><p></p><button type="button" class="btn ana"></button><button type="button" class="kapat" aria-label="Kapat">×</button>';
    b.querySelector('p').textContent = metin;
    const d = b.querySelector('.btn'); dugme ? d.textContent = dugme : d.remove();
    b.querySelector('.kapat').onclick = () => { b.remove(); try { localStorage.setItem(SUS, Date.now() + 14 * 864e5); } catch {} };
    if (dugme) d.onclick = async () => { if (olay) { olay.prompt(); await olay.userChoice; olay = null; b.remove(); } else iosRehber(); };
    document.body.append(b); return b;
  };
  const iosRehber = () => alert('1) Safari\'de altaki Paylaş (□↑) düğmesine dokunun.\n2) "Ana Ekrana Ekle"yi seçin.\n3) Ekle\'ye dokunun.\n\nSonra ana ekrandaki ATİK ikonundan açın.');
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); olay = e; bant('ETS\'yi telefonunuza uygulama olarak ekleyin.', 'Yükle'); });
  if (ios) addEventListener('load', () => setTimeout(() => bant('ETS\'yi ana ekrana ekleyin: bildirimler ve hızlı açılış için.', 'Nasıl?'), 1500));
})();
