// Tarayıcının kendi confirm() penceresi yerine sitenin kendi onay paneli. Kullanım: if (!await onayla('Silinsin mi?', 'Sil')) return;
window.onayla = (mesaj, dugme = 'Evet', tehlikeli = true) => new Promise(ok => {
  const d = document.createElement('dialog');
  d.className = 'onay';
  d.innerHTML = '<div class="onay-ic"><p></p><div class="onay-bt"><button type="button" class="btn" data-v="0">Vazgeç</button><button type="button" class="btn"></button></div></div>';
  d.querySelector('p').textContent = mesaj;
  const ev = d.querySelector('.onay-bt button:last-child');
  ev.textContent = dugme; ev.dataset.v = '1'; ev.classList.add(tehlikeli ? 'tehlike' : 'ana');
  d.onclick = e => { const v = e.target.dataset?.v; if (v !== undefined) d.close(v); else if (e.target === d) d.close('0'); };
  d.onclose = () => { d.remove(); ok(d.returnValue === '1'); };
  document.body.append(d); d.showModal();
  d.querySelector('button').focus(); // varsayılan odak "Vazgeç": yanlışlıkla Enter silmesin
});
