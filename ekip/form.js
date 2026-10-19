// ETS ortak rapor formu: lider paneli ve yönetim aynı formu kullanır (ortak.js gerekir).
// RaporFormu.ac(kap, {baslik, rapor, uyeler, ikramlar, varsayilanYer, izin(yol), jeton(), onizle(yollar), kaydet(d), vazgec(), sil()})
window.RaporFormu = (() => {
  const TURLER = ['Namaz', 'Manevi Gelişim', 'Oyun', 'Gezi'];
  const YERLER = ['Saadetdere Merkez', 'Avcılar Kulüp', 'Avcılar Dernek', 'İbrahim Cevahir Cami'];
  const DIGER = 'Başka konum';
  const FOTO_MAKS = 30, VIDEO_MAKS = 5, VIDEO_DOGRUDAN = 45 * 1048576, VIDEO_HEDEF = 40 * 1048576;
  const UZANTI = {'image/jpeg': '.jpg', 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/x-m4v': '.m4v', 'video/3gpp': '.3gp'};
  const g = id => document.getElementById(id);
  const tl = n => Number(n || 0).toLocaleString('tr-TR', {maximumFractionDigits: 2}) + ' ₺';
  const bugun = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const mb = b => (b / 1048576).toFixed(b < 1e7 ? 1 : 0) + ' MB';
  const bildir = (m, h) => window.bildir?.(m, h);
  let kap = null, uyari = null;

  const SABLON = `
    <div class="kart">
      <h2 id="formBaslik">Yeni faaliyet</h2>
      <div class="iki">
        <div class="alan"><label class="et" for="fTarih">Tarih</label><input type="date" id="fTarih"></div>
        <div class="alan faal"><label class="et" for="fSure">Süre (dakika)</label><input type="number" id="fSure" inputmode="numeric" min="0" max="1440" placeholder="90"></div>
      </div>
      <label class="uye" id="yokSatir" style="margin-bottom:16px"><input type="checkbox" id="fYok"><span>Bu gün faaliyet yapılmadı</span></label>
      <div class="alan faal"><label class="et">Faaliyet türü <small class="not" style="font-weight:500">(birden fazla seçebilirsiniz)</small></label>
        <div class="cipler" id="turCip"></div>
        <input id="fTur" maxlength="120" placeholder="Listede yoksa kendiniz yazınız" style="margin-top:8px">
      </div>
      <div class="alan faal"><label class="et">Yer</label>
        <div class="cipler" id="yerCip"></div>
        <input id="fYer" maxlength="160" placeholder="Konumu yazınız" style="margin-top:8px" hidden>
      </div>
      <div class="alan"><label class="et" for="fOzet" id="ozetEt">Ne yaptınız?</label><textarea id="fOzet" maxlength="4000" placeholder="Kısaca anlatınız: konu, program, öne çıkan an…"></textarea></div>
    </div>
    <div class="kart faal">
      <h2>Kimler geldi? <small id="katSay">0 kişi</small></h2>
      <div style="display:flex;gap:8px;margin-bottom:10px"><input id="uyeAra" placeholder="Ara…"><button class="btn kucuk" id="tumunuSec" type="button">Tümü</button></div>
      <div class="uye-liste" id="uyeSecim"></div>
      <div class="alan" style="margin-top:14px"><label class="et" for="fEk">Listede olmayan misafir sayısı</label><input type="number" id="fEk" inputmode="numeric" min="0" max="500" value="0"></div>
      <div class="toplam-satir"><span>Toplam katılım</span><b id="katToplam">0</b></div>
    </div>
    <div class="kart faal">
      <h2>İkram ve harcama</h2>
      <div class="alan"><label class="et" for="fIkram">Ne ikram edildi?</label><input id="fIkram" maxlength="500" placeholder="Örn. çay, simit, pizza" list="ikramOneri"><datalist id="ikramOneri"></datalist></div>
      <label class="et">Harcamalar</label>
      <div id="harcamalar"></div>
      <button class="btn kucuk" id="harcamaEkle" type="button">＋ Harcama kalemi</button>
      <div class="toplam-satir"><span>Toplam harcama</span><b id="harToplam">0 ₺</b></div>
    </div>
    <div class="kart faal">
      <h2>Fotoğraf ve video</h2>
      <div class="medya-ekle">
        <label class="yukle-kutu" for="fFoto">📷 Fotoğraf</label>
        <label class="yukle-kutu" for="fVideo">🎬 Video</label>
      </div>
      <input type="file" id="fFoto" accept="image/*" multiple hidden>
      <input type="file" id="fVideo" accept="video/*" multiple hidden>
      <div class="fotolar" id="fotolar"></div>
      <div id="videolar"></div>
      <p class="not">Video doğrudan buradan yüklenir, başka uygulamaya gerek yoktur. Büyük videolar otomatik küçültülür; bu sırada ekranı kapatmayınız.</p>
      <details class="vlink"><summary>Bağlantı olarak ekle (YouTube, Drive, Instagram)</summary>
        <textarea id="fVideoLink" style="min-height:70px;margin-top:8px" placeholder="Her satıra bir bağlantı"></textarea></details>
    </div>
    <button class="btn sil tam" id="taslakSil" type="button" hidden>Bu taslağı sil</button>
    <div class="alt-cubuk"><div>
      <button class="btn" id="vazgec" type="button" style="flex:0 0 auto" aria-label="Geri">←</button>
      <button class="btn" id="taslakKaydet" type="button">Taslak</button>
      <button class="btn ana" id="gonder" type="button">Gönder</button>
    </div></div>`;

  function ac(kapsayici, o) {
    kapat();
    kap = kapsayici; kap.innerHTML = SABLON;
    const r = o.rapor || null;
    let turSec = new Set(), yerSec = '', secili = new Set(r?.katilanlar || []), kirli = false, yukleniyor = 0;
    const uyeler = o.uyeler || [];
    const foto = (r?.medya || []).filter(m => m.t === 'foto').map(m => ({...m})), video = (r?.medya || []).filter(m => m.t === 'video' && m.yol).map(m => ({...m}));
    const onizleme = {}, kirlet = () => { kirli = true; };

    g('formBaslik').textContent = o.baslik || (r ? (r.durum === 'taslak' ? 'Taslağı tamamla' : 'Raporu düzenle') : 'Yeni faaliyet');
    g('fTarih').value = r?.tarih || bugun();
    if (!o.tarihSerbest) g('fTarih').max = bugun();
    g('fSure').value = r?.sure_dk ?? '';
    g('fOzet').value = r?.ozet || '';
    g('fIkram').value = r?.ikram || '';
    g('fEk').value = r?.ek_katilimci || 0;
    g('fYok').checked = r?.durum === 'yapilmadi';
    g('fVideoLink').value = (r?.medya || []).filter(m => m.t === 'video' && m.url).map(m => m.url).join('\n');
    g('ikramOneri').innerHTML = (o.ikramlar || []).map(i => `<option value="${esc(i)}">`).join('');
    g('taslakSil').hidden = !(r && r.durum !== 'gonderildi' && o.sil);
    g('taslakKaydet').hidden = r?.durum === 'gonderildi';

    // ---- faaliyet türü: seçilen çipler + serbest yazı, virgülle birleşik
    g('turCip').innerHTML = TURLER.map(t => `<button type="button" class="cip" data-t="${t}">${t}</button>`).join('');
    for (const p of String(r?.tur || '').split(',').map(x => x.trim()).filter(Boolean)) TURLER.includes(p) ? turSec.add(p) : (g('fTur').value += (g('fTur').value ? ', ' : '') + p);
    const turCiz = () => { for (const c of g('turCip').children) c.classList.toggle('secili', turSec.has(c.dataset.t)); };
    g('turCip').onclick = e => { const c = e.target.closest('.cip'); if (!c) return; turSec.has(c.dataset.t) ? turSec.delete(c.dataset.t) : turSec.add(c.dataset.t); turCiz(); kirlet(); };
    const turOku = () => [...TURLER.filter(t => turSec.has(t)), ...g('fTur').value.split(',').map(x => x.trim()).filter(Boolean)].join(', ');

    // ---- yer
    g('yerCip').innerHTML = [...YERLER, DIGER].map(t => `<button type="button" class="cip">${t}</button>`).join('');
    const yerAyarla = (sec, metin = '') => {
      yerSec = sec;
      for (const c of g('yerCip').children) c.classList.toggle('secili', c.textContent === sec);
      g('fYer').hidden = sec !== DIGER; g('fYer').value = sec === DIGER ? metin : '';
    };
    g('yerCip').onclick = e => { const c = e.target.closest('.cip'); if (!c) return; yerAyarla(c.textContent === yerSec && c.textContent !== DIGER ? '' : c.textContent); kirlet(); if (yerSec === DIGER) g('fYer').focus(); };
    const y0 = r ? r.yer : (o.varsayilanYer || '');
    if (!y0) yerAyarla(''); else if (YERLER.includes(y0)) yerAyarla(y0); else yerAyarla(DIGER, y0);
    const yerOku = () => yerSec === DIGER ? g('fYer').value.trim() : yerSec;

    // ---- yapılmadı
    const yokCiz = () => {
      const yok = g('fYok').checked;
      for (const el of kap.querySelectorAll('.faal')) el.hidden = yok;
      g('ozetEt').textContent = yok ? 'Neden yapılmadı?' : 'Ne yaptınız?';
      g('fOzet').placeholder = yok ? 'Örn. lider hasta, hava kötü, bayram tatili…' : 'Kısaca anlatınız: konu, program, öne çıkan an…';
      g('gonder').textContent = yok ? 'Kaydet' : 'Gönder';
    };
    g('fYok').onchange = () => { yokCiz(); kirlet(); };

    // ---- katılımcılar
    const katToplam = () => { const t = secili.size + (parseInt(g('fEk').value) || 0); g('katToplam').textContent = t; g('katSay').textContent = t + ' kişi'; };
    const uyeCiz = () => {
      const q = g('uyeAra').value.trim().toLocaleLowerCase('tr');
      g('uyeSecim').innerHTML = uyeler.filter(u => !q || u.ad.toLocaleLowerCase('tr').includes(q)).map(u =>
        `<label class="uye${secili.has(u.id) ? ' secili' : ''}"><input type="checkbox" value="${u.id}"${secili.has(u.id) ? ' checked' : ''}><span>${esc(u.ad)}</span></label>`).join('')
        || `<div class="not" style="grid-column:1/-1">${uyeler.length ? 'Eşleşen yok.' : 'Ekipte kayıtlı üye bulunmuyor. Gelenleri misafir sayısı olarak girebilirsiniz.'}</div>`;
      katToplam();
    };
    g('uyeSecim').onchange = e => { const id = e.target.value; e.target.checked ? secili.add(id) : secili.delete(id); e.target.parentElement.classList.toggle('secili', e.target.checked); katToplam(); kirlet(); };
    g('uyeAra').oninput = uyeCiz;
    g('tumunuSec').onclick = () => { const hepsi = uyeler.every(u => secili.has(u.id)); uyeler.forEach(u => hepsi ? secili.delete(u.id) : secili.add(u.id)); uyeCiz(); kirlet(); };
    g('fEk').oninput = katToplam;

    // ---- harcama
    const harcamaOku = () => [...g('harcamalar').children].map(d => { const [k, t] = d.querySelectorAll('input'); return {kalem: k.value.trim(), tutar: Number(t.value) || 0}; }).filter(h => h.kalem || h.tutar);
    const harToplam = () => { g('harToplam').textContent = tl(harcamaOku().reduce((a, h) => a + h.tutar, 0)); };
    const harcamaSatir = h => {
      const d = document.createElement('div'); d.className = 'harcama-satir';
      d.innerHTML = `<input placeholder="Kalem (örn. simit)" maxlength="80" value="${esc(h.kalem)}"><input type="number" inputmode="decimal" min="0" step="0.01" placeholder="₺" value="${esc(h.tutar)}"><button type="button" class="x" title="Sil">×</button>`;
      d.querySelector('.x').onclick = () => { d.remove(); harToplam(); kirlet(); };
      g('harcamalar').append(d);
    };
    (r?.harcama?.length ? r.harcama : [{kalem: '', tutar: ''}]).forEach(harcamaSatir);
    g('harcamaEkle').onclick = () => { harcamaSatir({kalem: '', tutar: ''}); g('harcamalar').lastChild.querySelector('input').focus(); };
    g('harcamalar').oninput = () => { harToplam(); kirlet(); };

    // ---- yükleme (fotoğraf ve video aynı kova; lider yol izni alır, yönetici doğrudan)
    const yolOlustur = ext => bugun().slice(0, 7) + '/' + crypto.randomUUID() + ext;
    async function gonderDosya(yol, blob, tip, ilerle, iptalKayit) {
      await o.izin?.(yol);
      const p = xhrYukle(CFG.URL + '/storage/v1/object/rapor-medya/' + yol, {apikey: CFG.ANON, Authorization: 'Bearer ' + (o.jeton ? o.jeton() : CFG.ANON), 'Content-Type': tip, 'x-upsert': 'false'}, blob, ilerle);
      iptalKayit?.(() => p.iptal());
      return p;
    }
    const fotoCiz = () => {
      g('fotolar').innerHTML = foto.map((m, i) => {
        const u = onizleme[m.yol];
        return m.durum === 'yukleniyor' ? '<div>Yükleniyor…</div>' : `<div style="${u ? `background-image:url(${u})` : ''}">${u ? '' : '📷'}<button type="button" data-i="${i}" title="Kaldır" aria-label="Fotoğrafı kaldır">×</button></div>`;
      }).join('');
    };
    g('fFoto').onchange = async e => {
      const dosyalar = [...e.target.files]; e.target.value = '';
      if (foto.length + dosyalar.length > FOTO_MAKS) return bildir('Bir rapora en fazla ' + FOTO_MAKS + ' fotoğraf eklenir.', 1);
      for (const f of dosyalar) {
        const m = {t: 'foto', yol: yolOlustur('.jpg'), durum: 'yukleniyor'}; foto.push(m); fotoCiz(); yukleniyor++;
        try {
          const b = await kucultFoto(f);
          await gonderDosya(m.yol, b, 'image/jpeg');
          onizleme[m.yol] = URL.createObjectURL(b); m.durum = 'tamam'; kirlet();
        } catch (er) { foto.splice(foto.indexOf(m), 1); bildir(er.message, 1); }
        yukleniyor--; fotoCiz();
      }
    };
    g('fotolar').onclick = e => { const b = e.target.closest('button'); if (b) { foto.splice(+b.dataset.i, 1); fotoCiz(); kirlet(); } };

    const durumYazi = m => m.durum === 'kucultuyor' ? `Küçültülüyor %${Math.round(m.yuzde * 100)} · ekranı kapatmayınız` : m.durum === 'yukleniyor' ? `Yükleniyor %${Math.round(m.yuzde * 100)}` : m.durum === 'hata' ? 'Başarısız' : 'Hazır ✓';
    const videoCiz = () => {
      g('videolar').innerHTML = video.map((m, i) => `<div class="video-satir" data-i="${i}"><span class="vi">🎬</span><div class="vg"><b>${esc(m.ad || 'Video')}</b><small>${m.boyut ? mb(m.boyut) + ' · ' : ''}<span class="vd">${durumYazi(m)}</span></small>
        <div class="ilerleme"${m.durum === 'tamam' || !m.durum ? ' hidden' : ''}><i style="transform:scaleX(${m.yuzde || 0})"></i></div></div>${m.durum === 'kucultuyor' ? '' : '<button type="button" class="x" aria-label="Videoyu kaldır">×</button>'}</div>`).join('');
    };
    const videoIlerle = m => {
      const s = g('videolar').children[video.indexOf(m)]; if (!s) return;
      s.querySelector('.vd').textContent = durumYazi(m); s.querySelector('.ilerleme i').style.transform = `scaleX(${m.yuzde})`;
    };
    g('fVideo').onchange = async e => {
      const dosyalar = [...e.target.files]; e.target.value = '';
      if (video.length + dosyalar.length > VIDEO_MAKS) return bildir('Bir rapora en fazla ' + VIDEO_MAKS + ' video eklenir.', 1);
      for (const f of dosyalar) {
        let tip = f.type || ({mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v', '3gp': 'video/3gpp'}[(f.name.split('.').pop() || '').toLowerCase()] || 'video/mp4');
        if (!UZANTI[tip]) tip = 'video/mp4';
        const m = {t: 'video', ad: f.name, boyut: f.size, durum: 'yukleniyor', yuzde: 0, yol: ''}; video.push(m); videoCiz(); yukleniyor++;
        try {
          let blob = f;
          if (f.size > VIDEO_DOGRUDAN) {
            m.durum = 'kucultuyor'; videoIlerle(m);
            blob = await videoKucult(f, y => { m.yuzde = y; videoIlerle(m); }, VIDEO_HEDEF);
            tip = blob.type; if (!UZANTI[tip]) tip = 'video/webm';
            m.boyut = blob.size; m.durum = 'yukleniyor'; m.yuzde = 0;
          }
          m.yol = yolOlustur(UZANTI[tip]); videoCiz();
          await gonderDosya(m.yol, blob, tip, y => { m.yuzde = y; videoIlerle(m); }, fn => { m.iptal = fn; });
          m.durum = 'tamam'; m.yuzde = 1; kirlet();
        } catch (er) { const i = video.indexOf(m); if (i >= 0) video.splice(i, 1); if (er.message !== 'iptal') bildir(er.message, 1); }
        yukleniyor--; videoCiz();
      }
    };
    g('videolar').onclick = e => {
      const b = e.target.closest('.x'); if (!b) return;
      const m = video[+b.closest('.video-satir').dataset.i]; if (!m) return;
      if (m.durum === 'yukleniyor') m.iptal?.(); else { video.splice(video.indexOf(m), 1); videoCiz(); kirlet(); }
    };

    // ---- kaydet
    async function kaydet(durum) {
      if (yukleniyor) return bildir('Dosyalar yükleniyor, bitince tekrar deneyiniz.', 1);
      const linkler = g('fVideoLink').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (linkler.some(v => !/^https?:\/\//i.test(v))) return bildir('Video bağlantıları http ile başlamalıdır.', 1);
      const medya = [...foto.map(m => ({t: 'foto', yol: m.yol})), ...video.map(m => ({t: 'video', yol: m.yol, ad: m.ad, boyut: m.boyut})), ...linkler.map(url => ({t: 'video', url}))];
      const d = {tarih: g('fTarih').value, tur: turOku(), yer: yerOku(), sure_dk: g('fSure').value, ozet: g('fOzet').value.trim(), ikram: g('fIkram').value.trim(),
        katilanlar: [...secili], ek_katilimci: parseInt(g('fEk').value) || 0, harcama: harcamaOku(), medya, durum};
      if (!d.tarih) return bildir('Lütfen tarihi seçiniz.', 1);
      if (durum === 'yapilmadi') { if (!d.ozet) return bildir('Lütfen "Neden yapılmadı?" kısmını yazınız.', 1); }
      else if (durum === 'gonderildi') {
        if (!d.yer) return bildir('Lütfen yeri seçiniz ya da "Başka konum" olarak yazınız.', 1);
        if (!d.tur) return bildir('Lütfen faaliyet türünü seçiniz ya da yazınız.', 1);
        if (d.tur.length > 120) return bildir('Faaliyet türü çok uzun; lütfen kısaltınız.', 1);
        if (!d.ozet) return bildir('Lütfen "Ne yaptınız?" kısmını doldurunuz.', 1);
        if (secili.size + d.ek_katilimci === 0) return bildir('Lütfen katılımcıları işaretleyiniz ya da misafir sayısını giriniz.', 1);
        if (d.harcama.some(h => !h.kalem)) return bildir('Lütfen her harcamaya bir kalem adı yazınız.', 1);
      }
      for (const b of ['gonder', 'taslakKaydet']) g(b).disabled = true;
      try { await o.kaydet(d); kirli = false; }
      catch (er) { bildir(er.message, 1); }
      for (const b of ['gonder', 'taslakKaydet']) if (g(b)) g(b).disabled = false;
    }
    g('gonder').onclick = () => kaydet(g('fYok').checked ? 'yapilmadi' : 'gonderildi');
    g('taslakKaydet').onclick = () => kaydet('taslak');
    g('vazgec').onclick = async () => { if (!kirli || await onayla('Kaydedilmemiş değişiklikler silinsin mi?', 'Sil')) { kirli = false; o.vazgec?.(); } };
    g('taslakSil').onclick = async () => { if (await onayla('Bu rapor taslağı silinsin mi?', 'Sil')) { try { await o.sil(); kirli = false; } catch (er) { bildir(er.message, 1); } } };
    for (const id of ['fTarih', 'fSure', 'fYer', 'fOzet', 'fIkram', 'fVideoLink', 'fTur']) g(id).addEventListener('input', kirlet);
    uyari = e => { if (kirli) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', uyari);

    turCiz(); uyeCiz(); harToplam(); fotoCiz(); videoCiz(); yokCiz();
    if (foto.length && o.onizle) o.onizle(foto.map(m => m.yol)).then(h => { Object.assign(onizleme, h); fotoCiz(); }).catch(() => {});
    scrollTo(0, 0);
    return {kirli: () => kirli};
  }

  function kapat() { if (uyari) removeEventListener('beforeunload', uyari); uyari = null; if (kap) kap.innerHTML = ''; kap = null; }
  return {ac, kapat};
})();
