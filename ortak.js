// Form.html ve yonetim.html önizlemesi aynı çizimi/doğrulamayı kullanır.
// Alan türleri: metin tc tel sayi tarih uzun onay secim radyo coktan | baslik (bölüm) gorsel video
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const GOSTERIM = ['baslik', 'gorsel', 'video'];           // veri üretmeyen türler
  const SECENEKLI = ['secim', 'radyo', 'coktan'];
  const AYRAC = '; ';                                       // çoktan seçmeli değer ayracı

  function tcGecerli(t) {
    if (!/^[1-9]\d{10}$/.test(t)) return false;
    const d = t.split('').map(Number);
    const a = (d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7]);
    return ((a % 10) + 10) % 10 === d[9] && d.slice(0, 10).reduce((x, y) => x + y) % 10 === d[10];
  }
  const tel = v => { v = v.replace(/\D/g, ''); if (v.startsWith('90') && v.length === 12) v = '0' + v.slice(2); if (v.length === 10) v = '0' + v; return v; };

  // Yalnız YouTube/Vimeo gömülür; başka adres null döner (iframe ile rastgele site açılmasın).
  function videoGomme(u) {
    let m;
    u = String(u || '').trim();
    if ((m = u.match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/)) || (m = u.match(/^https:\/\/youtu\.be\/([\w-]{11})/)) || (m = u.match(/^https:\/\/(?:www\.)?youtube\.com\/(?:shorts|embed)\/([\w-]{11})/)))
      return 'https://www.youtube-nocookie.com/embed/' + m[1];
    if ((m = u.match(/^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
    return null;
  }
  const gorselGuvenli = u => /^https:\/\//.test(u || '') ? u : '';

  // Bölümler: `baslik` öğesi yeni sayfa açar; ilk öğe baslik değilse başlıksız ilk bölüm vardır.
  function bolumler(alanlar) {
    const b = [{baslik: '', ipucu: '', alanlar: []}];
    for (const a of alanlar) {
      if (a.tur === 'baslik') { if (b.length === 1 && !b[0].alanlar.length && !b[0].baslik) b[0] = {baslik: a.etiket, ipucu: a.ipucu || '', alanlar: []}; else b.push({baslik: a.etiket, ipucu: a.ipucu || '', alanlar: []}); }
      else b[b.length - 1].alanlar.push(a);
    }
    return b;
  }

  function alanHtml(a) {
    const y = a.zorunlu ? '<span class="yildiz">*</span>' : '';
    const id = 'a_' + a.ad, sec = a.secenekler || [];
    const sar = (ic, ek = '') => `<div class="alan" data-ad="${esc(a.ad)}"${ek}>${ic}</div>`;
    const bas = `<label class="bas" for="${id}">${esc(a.etiket)}${y}</label>${a.ipucu ? `<div class="kvkk" style="margin:-2px 0 6px">${esc(a.ipucu)}</div>` : ''}`;
    if (a.tur === 'gorsel') { const u = gorselGuvenli(a.url); return sar(u ? `<img class="medya" src="${esc(u)}" alt="${esc(a.etiket)}" loading="lazy">${a.etiket ? `<div class="kvkk">${esc(a.etiket)}</div>` : ''}` : ''); }
    if (a.tur === 'video') { const u = videoGomme(a.url); return sar(u ? `<div class="video"><iframe src="${esc(u)}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" title="${esc(a.etiket || 'Video')}"></iframe></div>${a.etiket ? `<div class="kvkk">${esc(a.etiket)}</div>` : ''}` : ''); }
    if (a.tur === 'onay') return sar(`<label class="secim"><input type="checkbox" id="${id}"><span>${esc(a.etiket)}${y}</span></label>`);
    if (a.tur === 'radyo' || a.tur === 'coktan') {
      const t = a.tur === 'radyo' ? 'radio' : 'checkbox';
      return sar(`<div class="bas" style="margin-bottom:6px">${esc(a.etiket)}${y}</div>${a.ipucu ? `<div class="kvkk" style="margin:-2px 0 6px">${esc(a.ipucu)}</div>` : ''}` +
        sec.map((s, i) => `<label class="secim" style="margin-bottom:8px"><input type="${t}" name="${id}" value="${esc(s)}"><span>${esc(s)}</span></label>`).join(''));
    }
    let g;
    if (a.tur === 'uzun') g = `<textarea id="${id}" maxlength="500"></textarea>`;
    else if (a.tur === 'secim') g = `<select id="${id}"><option value="">Seçiniz</option>${sec.map(s => `<option>${esc(s)}</option>`).join('')}</select>`;
    else {
      const t = {tc: 'text', tel: 'tel', sayi: 'number', tarih: 'date'}[a.tur] || 'text';
      const im = a.tur === 'tc' ? ' inputmode="numeric" maxlength="11"' : a.tur === 'tel' ? ' inputmode="tel" maxlength="16"' : a.tur === 'sayi' ? ' inputmode="numeric" min="0" max="999"' : ' maxlength="120"';
      g = `<input id="${id}" type="${t}"${im} autocomplete="off">`;
    }
    return sar(bas + g);
  }

  function ham(a, kok) {
    if (a.tur === 'onay') { const e = kok.querySelector('#a_' + a.ad); return e && e.checked ? 'Evet' : ''; }
    if (a.tur === 'radyo') { const e = kok.querySelector(`input[name="a_${a.ad}"]:checked`); return e ? e.value : ''; }
    if (a.tur === 'coktan') return [...kok.querySelectorAll(`input[name="a_${a.ad}"]:checked`)].map(e => e.value).join(AYRAC);
    const e = kok.querySelector('#a_' + a.ad); return e ? e.value.trim() : '';
  }
  const kokte = (a, kok) => kok.querySelector(`[data-ad="${a.ad}"]`);
  const gorunur = (a, kok) => { const el = kokte(a, kok); return !!el && !el.hidden; };

  // Koşullu alanları göster/gizle; zincirleme olduğu için sırayla (üstteki gizliyse alttaki de gizli).
  function kosullar(alanlar, kok) {
    for (const a of alanlar) {
      if (!a.kosul) continue;
      const el = kokte(a, kok); if (!el) continue;
      const k = alanlar.find(x => x.ad === a.kosul.alan);
      const v = k && gorunur(k, kok) ? ham(k, kok) : '';
      const vals = v.split(AYRAC).filter(Boolean);
      el.hidden = !(a.kosul.esit || []).some(e => vals.includes(e));
    }
  }

  // Görünen alanları doğrular. {veri, ok, ilkHata}; yalnız görünen ve veri üreten alanlar veriye girer.
  function oku(alanlar, kok) {
    kok.querySelectorAll('.mesaj').forEach(e => e.remove());
    kok.querySelectorAll('.hatali').forEach(e => e.classList.remove('hatali'));
    const veri = {}; let ok = true, ilk = null;
    const isaret = (a, m) => { const el = kokte(a, kok); el.classList.add('hatali'); el.insertAdjacentHTML('beforeend', `<div class="mesaj">${m}</div>`); ok = false; ilk = ilk || el; };
    for (const a of alanlar) {
      if (GOSTERIM.includes(a.tur) || !gorunur(a, kok)) continue;
      let v = ham(a, kok);
      if (a.tur === 'tel' && v) v = tel(v);
      if (a.zorunlu && !v) isaret(a, a.tur === 'onay' ? 'Devam etmek için işaretleyin.' : 'Bu alan zorunlu.');
      else if (v && a.tur === 'tc' && !tcGecerli(v)) isaret(a, 'T.C. kimlik numarası hatalı görünüyor.');
      else if (v && a.tur === 'tel' && !/^05\d{9}$/.test(v)) isaret(a, 'Telefon 05XX ile başlayan 11 haneli olmalı.');
      veri[a.ad] = v;
    }
    return {veri, ok, ilk};
  }

  // Formu kap içine çizer. adim: bölümlere göre İleri/Geri. kok.sayfa(i) ile geçiş yapılır.
  function ciz(etk, kok, o = {}) {
    const bl = bolumler(etk.alanlar || []);
    kok.innerHTML = bl.map((b, i) => `<section class="bolum" data-b="${i}"${i ? ' hidden' : ''}>${b.baslik ? `<h2 class="bolum-b">${esc(b.baslik)}</h2>` : ''}${b.ipucu ? `<p class="alt">${esc(b.ipucu)}</p>` : ''}<div class="kart">${b.alanlar.map(alanHtml).join('') || '<p class="kvkk">Bu bölümde alan yok.</p>'}</div></section>`).join('');
    const guncelle = () => kosullar(etk.alanlar || [], kok);
    kok.addEventListener('input', guncelle); kok.addEventListener('change', guncelle);
    guncelle();
    return {bolumler: bl, say: bl.length, guncelle,
      goster(i) { kok.querySelectorAll('.bolum').forEach(s => s.hidden = +s.dataset.b !== i); },
      oku(i) { const alanlar = i == null ? etk.alanlar : bl[i].alanlar; return oku(alanlar, kok); }};
  }

  window.FormUI = {esc, tcGecerli, tel, videoGomme, gorselGuvenli, bolumler, alanHtml, ciz, oku, kosullar, GOSTERIM, SECENEKLI, AYRAC};
})();
